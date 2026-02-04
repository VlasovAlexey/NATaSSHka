const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
class BackupRoomsPlugin {
    constructor({ config, mainConfig, io, uploadsDir, pluginManager, translations, serverTranslate }) {
        this.config = config;
        this.mainConfig = mainConfig;
        this.io = io;
        this.uploadsDir = uploadsDir;
        this.pluginManager = pluginManager;
        this.translations = translations;
        this.serverTranslate = serverTranslate;
        this.hmacSecret = config.hmacSecret || this.generateHMACSecret();
        this.backupsDir = path.join(__dirname, '..', '..', 'backups');
        this.secureDeleter = null;
        this.activeBackups = new Map();
        this.downloadingBackups = new Map();
        this.signedPaths = new Map();
        this.language = config.language || mainConfig.language || 'ru';
        this.cleanupTimeoutMinutes = config.backupCleanupTimeout || 30;
        this.maxBackupAgeMinutes = config.maxBackupAge || 60;
        this.ensureBackupsDirSync();
        if (!config.hmacSecret) {
            this.saveHMACSecretToConfig();
        }
    }
    generateHMACSecret() {
        return crypto.randomBytes(32).toString('base64');
    }
    saveHMACSecretToConfig() {
        try {
            const configPath = path.join(__dirname, 'backup-rooms.json');
            const configData = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
            configData.hmacSecret = this.hmacSecret;
            fsSync.writeFileSync(configPath, JSON.stringify(configData, null, 2));
            console.log(`[BackupRooms] ${this.translate('HMAC_SECRET_GENERATED_AND_SAVED')}`);
        } catch (error) {
            console.error(`[BackupRooms] ${this.translate('ERROR_SAVING_HMAC_SECRET')}:`, error);
        }
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
        console.log(`[BackupRooms] ${this.translate('HMAC_SIGNING_ENABLED')}`);
        if (this.config.publicUrl && this.config.forcePublicUrl) {
            console.log(`[BackupRooms] ${this.translate('USING_PUBLIC_URL', { url: this.config.publicUrl })}`);
        } else if (this.config.publicUrl) {
            console.log(`[BackupRooms] ${this.translate('PUBLIC_URL_SET_BUT_NOT_FORCED', { url: this.config.publicUrl })}`);
        } else {
            console.log(`[BackupRooms] ${this.translate('USING_RELATIVE_URLS')}`);
        }
        this.startCleanupInterval();
    }
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupOldBackupDirectories();
        }, 10 * 60 * 1000);
        setTimeout(() => this.cleanupOldBackupDirectories(), 5000);
    }
    async cleanupOldBackupDirectories() {
        try {
            const items = await fs.readdir(this.backupsDir, { withFileTypes: true });
            const now = Date.now();
            const maxAge = this.maxBackupAgeMinutes * 60 * 1000;
            for (const item of items) {
                if (!item.isDirectory() || !item.name.startsWith('backup-')) {
                    continue;
                }
                const dirPath = path.join(this.backupsDir, item.name);
                const stats = await fs.stat(dirPath);
                const dirAge = now - stats.mtimeMs;
                if (dirAge > maxAge) {
                    console.log(`[BackupRooms] ${this.translate('REMOVING_OLD_BACKUP_DIR', {
                        dir: item.name,
                        age: Math.round(dirAge / 60000)
                    })}`);
                    await this.cleanupSecureDirectory(dirPath);
                    for (const [pathId, pathInfo] of this.signedPaths.entries()) {
                        if (pathInfo.secureDirName === item.name) {
                            this.signedPaths.delete(pathId);
                        }
                    }
                }
            }
            this.cleanupExpiredSignedPaths();
        } catch (error) {
            console.error(`[BackupRooms] ${this.translate('ERROR_CLEANUP_OLD_DIRS')}:`, error);
        }
    }
    cleanupExpiredSignedPaths() {
        const now = Date.now();
        for (const [pathId, pathInfo] of this.signedPaths.entries()) {
            if (now > pathInfo.expires) {
                this.signedPaths.delete(pathId);
            }
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
            backupId,
            socketId: socket.id,
            progress: 0,
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
        const { user } = backupInfo;
        const { secureDirName, signature, timestamp } = this.generateHMACSignedDirectory(backupId);
        const secureDirPath = path.join(this.backupsDir, secureDirName);
        await fs.mkdir(secureDirPath, { recursive: true });
        const metadata = {
            backupId,
            createdBy: user.username,
            room: user.room,
            timestamp: new Date().toISOString(),
            signature,
            hmacTimestamp: timestamp
        };
        await fs.writeFile(
            path.join(secureDirPath, '.metadata.json'),
            JSON.stringify(metadata, null, 2)
        );
        const fileName = `backup_${backupId}.zip`;
        const backupPath = path.join(secureDirPath, fileName);
        backupInfo.secureDirName = secureDirName;
        backupInfo.secureDirPath = secureDirPath;
        backupInfo.backupPath = backupPath;
        backupInfo.fileName = fileName;
        backupInfo.signature = signature;
        backupInfo.hmacTimestamp = timestamp;
        this.activeBackups.set(backupId, backupInfo);
        const pathId = this.generatePathId(secureDirName);
        this.signedPaths.set(pathId, {
            secureDirName,
            backupId,
            created: Date.now(),
            expires: Date.now() + (this.cleanupTimeoutMinutes * 60 * 1000),
            signature,
            hmacTimestamp: timestamp
        });
        try {
            const output = fsSync.createWriteStream(backupPath);
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });
            return new Promise((resolve, reject) => {
                output.on('close', async () => {
                    const fileSize = archive.pointer();
                    console.log(`[BackupRooms] ${this.translate('BACKUP_CREATED_IN_SECURE_DIR', {
                        dir: secureDirName,
                        bytes: fileSize
                    })}`);
                    await this.notifyBackupComplete(backupId, fileSize, secureDirName, fileName);
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
            await this.cleanupSecureDirectory(secureDirPath);
            throw error;
        }
    }
    generateHMACSignedDirectory(backupId) {
        const timestamp = Date.now();
        const dataToSign = `${backupId}:${timestamp}:${this.hmacSecret}`;
        const hmac = crypto.createHmac('sha256', this.hmacSecret);
        hmac.update(dataToSign);
        const signature = hmac.digest('hex').slice(0, 32); // Берем первые 32 символа
        const timestampBase36 = timestamp.toString(36);
        const secureDirName = `backup-${signature}-${timestampBase36}`;
        return {
            secureDirName,
            signature,
            timestamp
        };
    }
    generatePathId(secureDirName) {
        const hash = crypto.createHash('sha256');
        hash.update(secureDirName);
        return hash.digest('hex').slice(0, 16);
    }
    validateHMACPath(secureDirName) {
        try {
            const parts = secureDirName.split('-');
            if (parts.length !== 3 || parts[0] !== 'backup') {
                return { valid: false, reason: 'INVALID_FORMAT' };
            }
            const signature = parts[1];
            const timestampBase36 = parts[2];
            const timestamp = parseInt(timestampBase36, 36);
            if (signature.length !== 32 || !/^[a-f0-9]+$/.test(signature)) {
                return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
            }
            const now = Date.now();
            const maxAge = this.maxBackupAgeMinutes * 60 * 1000;
            if (now - timestamp > maxAge) {
                return { valid: false, reason: 'EXPIRED' };
            }
            const pathId = this.generatePathId(secureDirName);
            const pathInfo = this.signedPaths.get(pathId);
            if (pathInfo) {
                return {
                    valid: true,
                    pathInfo,
                    secureDirName
                };
            }
            const dataToVerify = `unknown:${timestamp}:${this.hmacSecret}`;
            const hmac = crypto.createHmac('sha256', this.hmacSecret);
            hmac.update(dataToVerify);
            const expectedSignature = hmac.digest('hex').slice(0, 32);
            if (signature === expectedSignature) {
                const dirPath = path.join(this.backupsDir, secureDirName);
                if (fsSync.existsSync(dirPath)) {
                    return {
                        valid: true,
                        secureDirName,
                        timestamp
                    };
                }
            }
            return { valid: false, reason: 'INVALID_SIGNATURE' };
        } catch (error) {
            console.error(`[BackupRooms] ${this.translate('ERROR_VALIDATING_HMAC_PATH')}:`, error);
            return { valid: false, reason: 'VALIDATION_ERROR' };
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
    getDownloadUrl(secureDirName, fileName) {
        const downloadPath = `/backups/${secureDirName}/${fileName}`;
        if (this.config.publicUrl && this.config.forcePublicUrl) {
            let publicUrl = this.config.publicUrl.trim();
            if (publicUrl.endsWith('/')) {
                publicUrl = publicUrl.slice(0, -1);
            }
            return `${publicUrl}${downloadPath}`;
        }
        return downloadPath;
    }
    async notifyBackupComplete(backupId, fileSize, secureDirName, fileName) {
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
        const downloadUrl = this.getDownloadUrl(secureDirName, fileName);
        this.io.to(backupInfo.socketId).emit('backup-ready', {
            backupId: backupId,
            fileName: fileName,
            secureDirName: secureDirName,
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
        await this.cleanupSecureDirectory(backupInfo.secureDirPath);
        const pathId = this.generatePathId(backupInfo.secureDirName);
        this.signedPaths.delete(pathId);
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
        const pathId = this.generatePathId(backupInfo.secureDirName);
        this.signedPaths.delete(pathId);
        await this.cleanupSecureDirectory(backupInfo.secureDirPath);
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
        const pathId = this.generatePathId(backupInfo.secureDirName);
        this.signedPaths.delete(pathId);
        await this.cleanupSecureDirectory(backupInfo.secureDirPath);
        this.downloadingBackups.delete(backupId);
        console.log(`[BackupRooms] ${this.translate('BACKUP_FILE_DELETED', { backupId: backupId })}`);
    }
    async cleanupSecureDirectory(dirPath) {
    if (!fsSync.existsSync(dirPath)) {
        return;
    }
    try {
        if (this.secureDeleter) {
            await this.secureDeleter.deleteDirectory(dirPath, this.io, 'backup');
        } else {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                await fs.unlink(filePath);
            }
            await fs.rmdir(dirPath);
        }
        console.log(`[BackupRooms] ${this.translate('SECURE_DIR_CLEANED', {
            dir: path.basename(dirPath)
        })}`);
    } catch (error) {
        console.error(`[BackupRooms] ${this.translate('ERROR_CLEANING_DIR', {
            dir: dirPath
        })}:`, error);
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`[BackupRooms] ${this.translate('SECURE_DIR_FORCE_CLEANED', {
                dir: path.basename(dirPath)
            })}`);
        } catch (forceError) {
            console.error(`[BackupRooms] ${this.translate('ERROR_FORCE_CLEANING_DIR', {
                dir: dirPath
            })}:`, forceError);
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
    isValidBackupPath(secureDirName) {
        const validation = this.validateHMACPath(secureDirName);
        return validation.valid;
    }
    async destroy() {
        for (const [backupId, backupInfo] of this.downloadingBackups) {
            if (backupInfo.cleanupTimer) {
                clearTimeout(backupInfo.cleanupTimer);
            }
            await this.cleanupSecureDirectory(backupInfo.secureDirPath);
        }
        this.activeBackups.clear();
        this.downloadingBackups.clear();
        this.signedPaths.clear();
        console.log(`[BackupRooms] ${this.translate('PLUGIN_UNLOADED')}`);
    }
}
module.exports = BackupRoomsPlugin;