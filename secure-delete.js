﻿const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { translate } = require('./lng-server.js');

class SecureDeleter {
    constructor(config) {
        this.config = config;
        this.isSSD = null;
        this.init();
    }

    async init() {
        await this.detectStorageType();
    }

    async detectStorageType() {
        try {
            const platform = process.platform;
            if (platform === 'win32') {
                this.isSSD = await this.detectSSDWindows();
            } else if (platform === 'linux') {
                this.isSSD = await this.detectSSDLinux();
            } else if (platform === 'darwin') {
                this.isSSD = await this.detectSSDMac();
            } else {
                this.isSSD = false;
            }

            console.log(translate(this.config.language, 'STORAGE_TYPE_DETECTED', {
                type: this.isSSD ? 'SSD' : 'HDD'
            }));
        } catch (error) {
            console.error(translate(this.config.language, 'STORAGE_DETECTION_ERROR'), error);
            this.isSSD = false;
        }
    }

    async detectSSDWindows() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const { stdout } = await execPromise('wmic diskdrive get MediaType');
            return stdout.toLowerCase().includes('ssd') ||
                   stdout.toLowerCase().includes('solid state');
        } catch {
            return false;
        }
    }

    async detectSSDLinux() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const { stdout } = await execPromise('lsblk -d -o name,rota');
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('sda') || line.includes('nvme')) {
                    return line.includes('0');
                }
            }
            return false;
        } catch {
            return false;
        }
    }

    async detectSSDMac() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const { stdout } = await execPromise('diskutil info / | grep "Solid State"');
            return stdout.toLowerCase().includes('yes');
        } catch {
            return false;
        }
    }

    async secureDeleteFile(filePath, io, room, username) {
        const language = this.config.language || 'ru';

        try {
            const stats = await fs.lstat(filePath);
            const isSymlink = stats.isSymbolicLink();

            if (isSymlink) {
                console.log(translate(language, 'SYMLINK_DETECTED', { path: filePath }));
                await this.deleteSymlink(filePath);
                return true;
            }

            console.log(translate(language, 'SECURE_DELETE_START', {
                path: filePath,
                size: this.formatFileSize(stats.size)
            }));

            const startTime = Date.now();

            if (this.isSSD) {
                await this.secureDeleteSSD(filePath, stats.size);
            } else {
                await this.secureDeleteHDD(filePath, stats.size);
            }

            const verification = await this.verifyDeletion(filePath);

            if (!verification) {
                throw new Error(translate(language, 'VERIFICATION_FAILED'));
            }

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            console.log(translate(language, 'SECURE_DELETE_COMPLETE', {
                path: filePath,
                time: duration.toFixed(2)
            }));

            return true;

        } catch (error) {
            console.error(translate(language, 'SECURE_DELETE_ERROR'), error);

            if (io && room) {
                const errorMessage = {
                    id: Date.now().toString(),
                    username: 'system',
                    userId: 'system',
                    text: translate(language, 'FILE_DELETE_FAILED', {
                        file: path.basename(filePath),
                        path: filePath,
                        error: error.message
                    }),
                    timestamp: new Date(),
                    room: room,
                    isSystem: true,
                    isWarning: true
                };

                io.to(room).emit('new-message', errorMessage);
            }

            return false;
        }
    }

    async secureDeleteSSD(filePath, originalSize) {
        const language = this.config.language || 'ru';

        try {
            console.log(translate(language, 'SSD_OPTIMIZED_DELETE'));

            await this.overwriteFileGOST(filePath, originalSize);
            await fs.unlink(filePath);

        } catch (error) {
            console.error(translate(language, 'SSD_DELETE_ERROR'), error);
            throw error;
        }
    }

    async secureDeleteHDD(filePath, originalSize) {
        const language = this.config.language || 'ru';

        try {
            console.log(translate(language, 'HDD_FULL_DELETE'));

            await this.overwriteFileGOST(filePath, originalSize);

            const increasedSize = originalSize * 3;
            await this.changeMetadata(filePath, increasedSize);

            await this.overwriteFileGOST(filePath, increasedSize);

            await fs.unlink(filePath);

        } catch (error) {
            console.error(translate(language, 'HDD_DELETE_ERROR'), error);
            throw error;
        }
    }

    async overwriteFileGOST(filePath, size) {
        const language = this.config.language || 'ru';

        try {
            console.log(translate(language, 'GOST_OVERWRITE_START', { passes: 2 }));

            const fileHandle = await fs.open(filePath, 'r+');

            try {
                await this.gostPass1(fileHandle, size);
                await this.gostPass2(fileHandle, size);

                await fileHandle.sync();

            } finally {
                await fileHandle.close();
            }

            console.log(translate(language, 'GOST_OVERWRITE_COMPLETE'));

        } catch (error) {
            console.error(translate(language, 'GOST_OVERWRITE_ERROR'), error);
            throw error;
        }
    }

    async gostPass1(fileHandle, size) {
        console.log(translate(this.config.language, 'GOST_PASS_1_START'));

        const bufferSize = Math.min(1024 * 1024, size);
        const randomBuffer = crypto.randomBytes(bufferSize);

        let bytesWritten = 0;
        while (bytesWritten < size) {
            const writeSize = Math.min(bufferSize, size - bytesWritten);
            await fileHandle.write(randomBuffer.slice(0, writeSize), 0, writeSize, bytesWritten);
            bytesWritten += writeSize;
        }

        await fileHandle.sync();
        console.log(translate(this.config.language, 'GOST_PASS_1_COMPLETE'));
    }

    async gostPass2(fileHandle, size) {
        console.log(translate(this.config.language, 'GOST_PASS_2_START'));

        const pattern = Buffer.from('00000000000000000000000000000000', 'hex');
        const bufferSize = Math.min(1024 * 1024, size);

        let bytesWritten = 0;
        while (bytesWritten < size) {
            const writeSize = Math.min(bufferSize, size - bytesWritten);

            const patternBuffer = Buffer.alloc(writeSize);
            for (let i = 0; i < writeSize; i += pattern.length) {
                pattern.copy(patternBuffer, i);
            }

            await fileHandle.write(patternBuffer, 0, writeSize, bytesWritten);
            bytesWritten += writeSize;
        }

        await fileHandle.sync();
        console.log(translate(this.config.language, 'GOST_PASS_2_COMPLETE'));
    }

    async changeMetadata(filePath, newSize) {
        try {
            const stats = fsSync.statSync(filePath);

            await this.truncateFile(filePath, newSize);

            const newDate = new Date(0);
            fsSync.utimesSync(filePath, newDate, newDate);

            fsSync.chmodSync(filePath, 0o777);

        } catch (error) {
            console.error(translate(this.config.language, 'METADATA_CHANGE_ERROR'), error);
        }
    }

    async truncateFile(filePath, size) {
        const fileHandle = await fs.open(filePath, 'r+');
        try {
            await fileHandle.truncate(size);
        } finally {
            await fileHandle.close();
        }
    }

    async verifyDeletion(filePath) {
        try {
            await fs.access(filePath);

            const stats = await fs.stat(filePath);
            if (stats.size > 0) {
                console.error(translate(this.config.language, 'VERIFICATION_FAILED_SIZE', {
                    path: filePath,
                    size: stats.size
                }));
                return false;
            }

            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return true;
            }
            console.error(translate(this.config.language, 'VERIFICATION_ERROR'), error);
            return false;
        }
    }

    async deleteSymlink(filePath) {
        try {
            const target = await fs.readlink(filePath);
            console.log(translate(this.config.language, 'SYMLINK_TARGET', { target }));
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error(translate(this.config.language, 'SYMLINK_DELETE_ERROR'), error);
            throw error;
        }
    }

    async deleteMessageFiles(room, messageId, username, io = null) {
        const language = this.config.language || 'ru';
        const uploadsDir = path.join(__dirname, 'uploads');
        const userDir = path.join(uploadsDir, room, username);

        if (!fsSync.existsSync(userDir)) {
            console.log(translate(language, 'USER_DIR_NOT_FOUND', { path: userDir }));
            return false;
        }

        console.log(translate(language, 'STARTING_FILE_DELETION', {
            messageId: messageId,
            username: username,
            room: room
        }));

        let fileUrls = [];
        const messageFile = path.join(userDir, `${messageId}.xml`);

        if (fsSync.existsSync(messageFile)) {
            try {
                const fileContent = fsSync.readFileSync(messageFile, 'utf8');
                const fileUrlMatches = fileContent.match(/<fileUrl>(.*?)<\/fileUrl>/g);
                if (fileUrlMatches) {
                    fileUrls = fileUrlMatches.map(match => {
                        return match.replace(/<fileUrl>|<\/fileUrl>/g, '');
                    });
                }
                console.log(translate(language, 'FOUND_FILEURLS_IN_XML'), fileUrls);

                await this.secureDeleteFile(messageFile, io, room, username);

            } catch (readError) {
                console.error(translate(language, 'XML_READ_ERROR'), readError);
                if (fsSync.existsSync(messageFile)) {
                    await fs.unlink(messageFile).catch(() => {});
                }
            }
        }

        for (const fileUrl of fileUrls) {
            try {
                if (fileUrl && fileUrl.startsWith('/uploads/')) {
                    const fileName = fileUrl.split('/').pop();
                    if (fileName) {
                        const filePath = path.join(userDir, fileName);
                        if (fsSync.existsSync(filePath)) {
                            await this.secureDeleteFile(filePath, io, room, username);
                        }
                    }
                }
            } catch (fileError) {
                console.error(translate(language, 'ERROR_DELETING_FILE', { file: fileUrl }), fileError);
            }
        }

        const files = fsSync.readdirSync(userDir);
        for (const file of files) {
            if (file.startsWith(messageId) || file.includes(`-${messageId}-`) || file.includes(`_${messageId}_`)) {
                const filePath = path.join(userDir, file);
                try {
                    if (!file.endsWith('.xml') || file === `${messageId}.xml`) {
                        if (fsSync.existsSync(filePath)) {
                            await this.secureDeleteFile(filePath, io, room, username);
                        }
                    }
                } catch (error) {
                    console.error(translate(language, 'ERROR_DELETING_RELATED_FILE', { file: filePath }), error);
                }
            }
        }

        console.log(translate(language, 'FILE_DELETION_COMPLETED', { messageId }));
        return true;
    }

    async deleteRoomFolder(room, io = null) {
        const language = this.config.language || 'ru';
        const uploadsDir = path.join(__dirname, 'uploads');
        const roomDir = path.join(uploadsDir, room);

        if (!fsSync.existsSync(roomDir)) {
            console.log(translate(language, 'ROOM_DIR_NOT_FOUND', { room }));
            return false;
        }

        console.log(translate(language, 'ROOM_DELETION_START', { room }));

        try {
            await this.deleteDirectorySecure(roomDir, io, room);
            console.log(translate(language, 'ROOM_DELETION_COMPLETE', { room }));
            return true;
        } catch (error) {
            console.error(translate(language, 'ROOM_DELETION_ERROR', { room }), error);
            return false;
        }
    }

    async deleteUploadsFolder(io = null) {
        const language = this.config.language || 'ru';
        const uploadsDir = path.join(__dirname, 'uploads');

        if (!fsSync.existsSync(uploadsDir)) {
            console.log(translate(language, 'UPLOADS_DIR_NOT_FOUND'));
            return false;
        }

        console.log(translate(language, 'UPLOADS_DELETION_START'));

        try {
            await this.deleteDirectorySecure(uploadsDir, io, 'global');
            console.log(translate(language, 'UPLOADS_DELETION_COMPLETE'));
            return true;
        } catch (error) {
            console.error(translate(language, 'UPLOADS_DELETION_ERROR'), error);
            return false;
        }
    }

    async deleteDirectorySecure(dirPath, io, room) {
        const language = this.config.language || 'ru';

        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);

                if (item.isDirectory()) {
                    await this.deleteDirectorySecure(fullPath, io, room);
                } else {
                    try {
                        await this.secureDeleteFile(fullPath, io, room, 'system');
                    } catch (error) {
                        console.error(translate(language, 'DIR_FILE_DELETE_ERROR', { file: fullPath }), error);
                    }
                }
            }

            await fs.rmdir(dirPath);

        } catch (error) {
            console.error(translate(language, 'DIR_DELETION_ERROR', { dir: dirPath }), error);
            throw error;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = SecureDeleter;