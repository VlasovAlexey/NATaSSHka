const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');

class BackupRoomsPlugin {
    constructor({ config, mainConfig, io, uploadsDir, pluginManager, translations, serverTranslate }) {
        this.config = config;
        this.mainConfig = mainConfig;
        this.io = io;
        this.uploadsDir = uploadsDir;
        this.pluginManager = pluginManager;
        this.translations = translations;
        this.serverTranslate = serverTranslate;
        this.backupsDir = path.join(__dirname, '..', '..', 'backups');
        this.secureDeleter = null;
        this.activeBackups = new Map();
        this.downloadingBackups = new Map();
        this.language = config.language || mainConfig.language || 'ru';

        this.cleanupTimeoutMinutes = config.backupCleanupTimeout || 30;

        this.ensureBackupsDirSync();
    }

    ensureBackupsDirSync() {
        if (!fsSync.existsSync(this.backupsDir)) {
            fsSync.mkdirSync(this.backupsDir, { recursive: true });
        }
    }

    translate(key, params = {}) {
        if (this.translations && this.translations.translate) {
            return this.translations.translate(this.language, key, params);
        }

        if (this.serverTranslate) {
            return this.serverTranslate(this.language, key, params);
        }

        return key;
    }

    async init() {
        if (this.mainConfig.secureDelete && this.mainConfig.secureDelete.enabled) {
            const SecureDeleter = require('../../secure-delete.js');
            this.secureDeleter = new SecureDeleter(this.mainConfig);
        }

        console.log(`[BackupRooms] ${this.translate('BACKUP_PLUGIN_INITIALIZED', {
            command: this.config.backupCommand,
            timeout: this.cleanupTimeoutMinutes
        })}`);


        if (this.config.publicUrl && this.config.forcePublicUrl) {
            console.log(`[BackupRooms] ${this.translate('USING_PUBLIC_URL', { url: this.config.publicUrl })}`);
        } else if (this.config.publicUrl) {
            console.log(`[BackupRooms] ${this.translate('PUBLIC_URL_SET_BUT_NOT_FORCED', { url: this.config.publicUrl })}`);
        } else {
            console.log(`[BackupRooms] ${this.translate('USING_RELATIVE_URLS')}`);
        }
    }

    async handleMessage(message, socket) {
        if (!message.text || typeof message.text !== 'string') {
            return false;
        }

        const text = message.text.trim();

        if (text === this.config.backupCommand) {
            await this.startBackup(message, socket);
            return true;
        }

        return false;
    }

    async startBackup(triggerMessage, socket) {
        const backupId = Date.now().toString();
        const fileName = `backup_${backupId}.zip`;
        const backupPath = path.join(this.backupsDir, fileName);
        const user = {
            username: triggerMessage.username,
            room: triggerMessage.room,
            socketId: socket.id
        };

        const startMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: this.translate('BACKUP_STARTED', { username: user.username }),
            timestamp: new Date(),
            room: user.room,
            isSystem: true
        };

        this.io.to(user.room).emit('new-message', startMessage);

        this.activeBackups.set(backupId, {
            user,
            backupPath,
            fileName,
            backupId,
            socketId: socket.id,
            progress: 0,
            totalFiles: 0,
            processedFiles: 0,
            created: Date.now()
        });

        try {
            await this.createBackup(backupId);
        } catch (error) {
            console.error(`[BackupRooms] ${this.translate('BACKUP_CREATION_ERROR')}:`, error);

            const errorMessage = {
                id: Date.now().toString(),
                username: 'system',
                userId: 'system',
                text: this.translate('BACKUP_ERROR', { error: error.message }),
                timestamp: new Date(),
                room: user.room,
                isSystem: true
            };

            this.io.to(user.room).emit('new-message', errorMessage);
            this.activeBackups.delete(backupId);
        }
    }

    async createBackup(backupId) {
        const backupInfo = this.activeBackups.get(backupId);
        if (!backupInfo) {
            throw new Error(this.translate('BACKUP_NOT_FOUND', { backupId }));
        }

        const { user, backupPath, fileName } = backupInfo;

        try {
            const output = fsSync.createWriteStream(backupPath);
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            return new Promise((resolve, reject) => {
                output.on('close', async () => {
                    const fileSize = archive.pointer();
                    console.log(`[BackupRooms] ${this.translate('BACKUP_CREATED', { bytes: fileSize })}`);

                    await this.notifyBackupComplete(backupId, fileSize, fileName);
                    resolve();
                });

                archive.on('warning', (err) => {
                    if (err.code === 'ENOENT') {
                        console.warn(`[BackupRooms] ${this.translate('ARCHIVER_WARNING')}:`, err);
                    } else {
                        reject(err);
                    }
                });

                archive.on('error', (err) => {
                    reject(err);
                });

                archive.on('progress', (progressData) => {
                    const percent = Math.round((progressData.fs.processedBytes / progressData.fs.totalBytes) * 100);
                    this.updateProgress(backupId, percent);
                });

                archive.pipe(output);

                this.readRoomsAndArchive(archive).then(() => {
                    archive.finalize();
                }).catch(reject);
            });

        } catch (error) {
            throw error;
        }
    }

    async readRoomsAndArchive(archive) {
        try {
            const rooms = await fs.readdir(this.uploadsDir, { withFileTypes: true });

            for (const roomDir of rooms) {
                if (!roomDir.isDirectory()) continue;

                const roomName = roomDir.name;

                if (this.config.excludedRooms && this.config.excludedRooms.includes(roomName)) {
                    console.log(`[BackupRooms] ${this.translate('ROOM_EXCLUDED', { room: roomName })}`);
                    continue;
                }

                const roomPath = path.join(this.uploadsDir, roomName);
                archive.directory(roomPath, `rooms/${roomName}`);
            }
        } catch (error) {
            throw error;
        }
    }

    updateProgress(backupId, percent) {
        const backupInfo = this.activeBackups.get(backupId);
        if (!backupInfo) return;

        const lastNotifiedPercent = backupInfo.lastNotifiedPercent || 0;

        if (percent >= lastNotifiedPercent + this.config.progressNotifyPercent) {
            backupInfo.lastNotifiedPercent = percent;
            this.activeBackups.set(backupId, backupInfo);

            this.notifyProgress(backupId, percent);
        }
    }

    notifyProgress(backupId, percent) {
        const backupInfo = this.activeBackups.get(backupId);
        if (!backupInfo) return;

        const progressMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: this.translate('BACKUP_PROGRESS', {
                username: backupInfo.user.username,
                percent: percent
            }),
            timestamp: new Date(),
            room: backupInfo.user.room,
            isSystem: true
        };

        this.io.to(backupInfo.user.room).emit('new-message', progressMessage);
    }


    getDownloadUrl(fileName) {

        if (this.config.publicUrl && this.config.forcePublicUrl) {
            let publicUrl = this.config.publicUrl.trim();


            if (publicUrl.endsWith('/')) {
                publicUrl = publicUrl.slice(0, -1);
            }

            return `${publicUrl}/backups/${fileName}`;
        }


        return `/backups/${fileName}`;
    }

    async notifyBackupComplete(backupId, fileSize, fileName) {
        const backupInfo = this.activeBackups.get(backupId);
        if (!backupInfo) {
            console.error(`[BackupRooms] ${this.translate('BACKUP_NOT_FOUND_WHEN_COMPLETING', { backupId })}`);
            return;
        }

        const completeMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: this.translate('BACKUP_COMPLETE', {
                size: this.formatFileSize(fileSize)
            }),
            timestamp: new Date(),
            room: backupInfo.user.room,
            isSystem: true
        };

        this.io.to(backupInfo.user.room).emit('new-message', completeMessage);


        const downloadUrl = this.getDownloadUrl(fileName);

        this.io.to(backupInfo.socketId).emit('backup-ready', {
            backupId: backupId,
            fileName: fileName,
            downloadUrl: downloadUrl,
            fileSize: fileSize,
            fileSizeFormatted: this.formatFileSize(fileSize),
            cleanupTimeout: this.cleanupTimeoutMinutes
        });

        this.downloadingBackups.set(backupId, {
            ...backupInfo,
            fileSize: fileSize,
            notified: Date.now(),
            cleanupTimer: setTimeout(() => {
                console.log(`[BackupRooms] ${this.translate('AUTO_CLEANING_BACKUP', { backupId: backupId, minutes: this.cleanupTimeoutMinutes })}`);
                this.cleanupOldBackup(backupId);
            }, this.cleanupTimeoutMinutes * 60 * 1000)
        });

        this.activeBackups.delete(backupId);

        console.log(`[BackupRooms] ${this.translate('BACKUP_READY_FOR_DOWNLOAD', { backupId: backupId, minutes: this.cleanupTimeoutMinutes })}`);


        console.log(`[BackupRooms] ${this.translate('DOWNLOAD_URL_GENERATED', { url: downloadUrl })}`);
    }

    async cleanupOldBackup(backupId) {
        const backupInfo = this.downloadingBackups.get(backupId);
        if (!backupInfo) return;

        console.log(`[BackupRooms] ${this.translate('AUTO_CLEANING_OLD_BACKUP', { backupId: backupId })}`);
        await this.secureDeleteBackupFile(backupInfo.backupPath, backupId, backupInfo.user.room, true);

        if (backupInfo.cleanupTimer) {
            clearTimeout(backupInfo.cleanupTimer);
        }

        this.downloadingBackups.delete(backupId);
    }

    async handleBackupCanceled(data) {
        console.log(`[BackupRooms] ${this.translate('BACKUP_CANCELED_CALLED')}:`, data);

        let backupId;
        if (typeof data === 'string') {
            backupId = data;
        } else if (data && typeof data === 'object') {
            backupId = data.backupId || data.backupId;
        }

        if (!backupId) {
            console.error(`[BackupRooms] ${this.translate('CANNOT_EXTRACT_BACKUP_ID')}:`, data);
            return;
        }

        console.log(`[BackupRooms] ${this.translate('USER_CANCELED_DOWNLOAD', { backupId: backupId })}`);

        const backupInfo = this.downloadingBackups.get(backupId);
        if (!backupInfo) {
            console.log(`[BackupRooms] ${this.translate('BACKUP_NOT_FOUND_FOR_CANCELLATION', { backupId: backupId })}`);
            return;
        }

        if (backupInfo.cleanupTimer) {
            clearTimeout(backupInfo.cleanupTimer);
        }

        await this.secureDeleteBackupFile(backupInfo.backupPath, backupId, backupInfo.user.room, false);
        this.downloadingBackups.delete(backupId);

        const canceledMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: this.translate('DOWNLOAD_CANCELED'),
            timestamp: new Date(),
            room: backupInfo.user.room,
            isSystem: true
        };

        this.io.to(backupInfo.user.room).emit('new-message', canceledMessage);

        console.log(`[BackupRooms] ${this.translate('BACKUP_CANCELED_AND_DELETED', { backupId: backupId })}`);
    }

    async handleBackupDownloaded(data) {
        console.log(`[BackupRooms] ${this.translate('BACKUP_DOWNLOADED_CALLED')}:`, data);

        let backupId;
        if (typeof data === 'string') {
            backupId = data;
        } else if (data && typeof data === 'object') {
            backupId = data.backupId || data.backupId;
        }

        if (!backupId) {
            console.error(`[BackupRooms] ${this.translate('CANNOT_EXTRACT_BACKUP_ID_FROM')}:`, data);
            return;
        }

        console.log(`[BackupRooms] ${this.translate('USER_CONFIRMED_DOWNLOAD', { backupId: backupId })}`);

        const backupInfo = this.downloadingBackups.get(backupId);
        if (!backupInfo) {
            console.log(`[BackupRooms] ${this.translate('BACKUP_NOT_FOUND_IN_DOWNLOADING_LIST', { backupId: backupId })}`);
            return;
        }

        if (backupInfo.cleanupTimer) {
            clearTimeout(backupInfo.cleanupTimer);
        }

        await this.secureDeleteBackupFile(backupInfo.backupPath, backupId, backupInfo.user.room, false);
        this.downloadingBackups.delete(backupId);

        console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_DELETED', { backupId: backupId })}`);
    }

    async secureDeleteBackupFile(backupPath, backupId, room, isAutoCleanup = false) {
        console.log(`[BackupRooms] ${this.translate('ATTEMPTING_DELETE_BACKUP_FILE', { path: backupPath })}`);

        if (!fsSync.existsSync(backupPath)) {
            console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_ALREADY_DELETED', { path: backupPath })}`);
            return;
        }

        try {
            const stats = fsSync.statSync(backupPath);
            console.log(`[BackupRooms] ${this.translate('FILE_EXISTS_INFO', { path: backupPath, size: stats.size })}`);

            if (this.secureDeleter) {
                console.log(`[BackupRooms] ${this.translate('USING_SECURE_DELETER', { backupId: backupId })}`);
                const result = await this.secureDeleter.secureDeleteFile(backupPath, this.io, room || 'backup', 'system');
                if (result) {
                    console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_SECURELY_DELETED', { path: backupPath })}`);

                    if (!isAutoCleanup && room) {
                        const messageType = isAutoCleanup ? 'BACKUP_AUTO_CLEANED' : 'BACKUP_CLEANED';
                        const confirmationMessage = {
                            id: Date.now().toString(),
                            username: 'system',
                            userId: 'system',
                            text: this.translate(messageType, { backupId: backupId }),
                            timestamp: new Date(),
                            room: room,
                            isSystem: true
                        };

                        this.io.to(room).emit('new-message', confirmationMessage);
                    }
                } else {
                    console.error(`[BackupRooms] ${this.translate('SECURE_DELETION_FAILED', { path: backupPath })}`);

                    try {
                        await fs.unlink(backupPath);
                        console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_DELETED_NORMALLY', { path: backupPath })}`);
                    } catch (unlinkError) {
                        console.error(`[BackupRooms] ${this.translate('NORMAL_DELETION_FAILED')}:`, unlinkError);
                    }
                }
            } else {
                console.log(`[BackupRooms] ${this.translate('SECURE_DELETER_NOT_AVAILABLE')}`);
                await fs.unlink(backupPath);
                console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_DELETED_NORMALLY', { path: backupPath })}`);
            }
        } catch (error) {
            console.error(`[BackupRooms] ${this.translate('ERROR_DELETING_BACKUP_FILE', { path: backupPath })}:`, error);

            try {
                if (fsSync.existsSync(backupPath)) {
                    await fs.unlink(backupPath);
                    console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_FORCE_DELETED', { path: backupPath })}`);
                }
            } catch (forceError) {
                console.error(`[BackupRooms] ${this.translate('FORCE_DELETION_FAILED')}:`, forceError);
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async destroy() {
        for (const [backupId, backupInfo] of this.downloadingBackups) {
            if (backupInfo.cleanupTimer) {
                clearTimeout(backupInfo.cleanupTimer);
            }
            await this.secureDeleteBackupFile(backupInfo.backupPath, backupId, backupInfo.user.room, true);
        }

        this.activeBackups.clear();
        this.downloadingBackups.clear();
        console.log(`[BackupRooms] ${this.translate('PLUGIN_UNLOADED')}`);
    }
}

module.exports = BackupRoomsPlugin;