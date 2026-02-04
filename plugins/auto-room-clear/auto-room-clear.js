const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
class AutoRoomClearPlugin {
    constructor({ config, mainConfig, io, uploadsDir, pluginManager, translations }) {
        this.config = config;
        this.mainConfig = mainConfig;
        this.io = io;
        this.uploadsDir = uploadsDir;
        this.pluginManager = pluginManager;
        this.translations = translations;
        this.intervals = new Map();
        this.secureDeleter = null;
        this.language = config.language || mainConfig.language || 'ru';
    }
    translate(key, params = {}) {
        if (!this.translations || !this.translations.translate) {
            console.error(`[AutoRoomClear] Translations not loaded for key: ${key}`);
            return key;
        }
        return this.translations.translate(this.language, key, params);
    }
    async init() {
        if (this.mainConfig.secureDelete && this.mainConfig.secureDelete.enabled) {
            const SecureDeleter = require('../../secure-delete.js');
            this.secureDeleter = new SecureDeleter(this.mainConfig);
        }
        console.log(`[AutoRoomClear] ${this.translate('AUTO_CLEAR_INITIALIZED', {
            deleteMessagesOlderThan: this.config.deleteMessagesOlderThan || 60,
            checkFrequency: this.config.checkFrequency || 1
        })}`);
        this.startAutoClear();
    }
    startAutoClear() {
        const checkFrequency = this.config.checkFrequency || 1;
        const intervalMs = checkFrequency * 60 * 1000;
        const checkInterval = setInterval(async () => {
            await this.checkAndDeleteOldMessages();
        }, intervalMs);
        this.intervals.set('main', checkInterval);
        console.log(`[AutoRoomClear] ${this.translate('AUTO_CLEAR_STARTED', { checkFrequency })}`);
        setTimeout(() => {
            this.checkAndDeleteOldMessages();
        }, 5000);
    }
    async checkAndDeleteOldMessages() {
        try {
            const rooms = await fs.readdir(this.uploadsDir, { withFileTypes: true });
            for (const roomDir of rooms) {
                if (!roomDir.isDirectory()) continue;
                const roomName = roomDir.name;
                if (this.config.excludedRooms && this.config.excludedRooms.includes(roomName)) {
                    console.log(`[AutoRoomClear] ${this.translate('ROOM_EXCLUDED', { room: roomName })}`);
                    continue;
                }
                await this.processRoomMessages(roomName);
            }
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_CHECKING_ROOMS')}:`, error);
        }
    }
    async processRoomMessages(roomName) {
        try {
            const roomPath = path.join(this.uploadsDir, roomName);
            if (!fsSync.existsSync(roomPath)) {
                return;
            }
            console.log(`[AutoRoomClear] ${this.translate('CHECKING_ROOM', { room: roomName })}`);
            const deleteThreshold = this.config.deleteMessagesOlderThan || 60; // минут
            const thresholdDate = new Date(Date.now() - deleteThreshold * 60 * 1000);
            let totalDeleted = 0;
            const users = await fs.readdir(roomPath, { withFileTypes: true });
            for (const userDir of users) {
                if (!userDir.isDirectory()) continue;
                const userPath = path.join(roomPath, userDir.name);
                const messageFiles = await fs.readdir(userPath);
                const xmlFiles = messageFiles.filter(file => file.endsWith('.xml'));
                for (const xmlFile of xmlFiles) {
                    const shouldDelete = await this.shouldDeleteMessage(userPath, xmlFile, thresholdDate);
                    if (shouldDelete) {
                        await this.deleteMessageFiles(roomName, xmlFile.replace('.xml', ''), userDir.name);
                        totalDeleted++;
                    }
                }
            }
            if (totalDeleted > 0) {
                console.log(`[AutoRoomClear] ${this.translate('MESSAGES_DELETED', {
                    deletedCount: totalDeleted,
                    room: roomName
                })}`);
                if (this.config.notifyOnClear !== false) {
                    await this.sendDeletionNotification(roomName, totalDeleted);
                }
                await this.refreshChatHistory(roomName);
            } else {
                console.log(`[AutoRoomClear] ${this.translate('NO_MESSAGES_TO_DELETE', { room: roomName })}`);
            }
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ROOM_CLEAR_ERROR', { room: roomName })}:`, error);
        }
    }
    async shouldDeleteMessage(userPath, xmlFile, thresholdDate) {
        try {
            const filePath = path.join(userPath, xmlFile);
            const content = await fs.readFile(filePath, 'utf8');
            const timestampMatch = content.match(/<timestamp>(.*?)<\/timestamp>/);
            if (!timestampMatch) {
                console.log(`[AutoRoomClear] ${this.translate('NO_TIMESTAMP_FOUND', { file: xmlFile })}`);
                return false;
            }
            const messageDate = new Date(timestampMatch[1]);
            return messageDate < thresholdDate;
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_READING_MESSAGE_FILE', { file: xmlFile })}:`, error);
            return false;
        }
    }
     async deleteMessageFiles(room, messageId, username) {
        try {
            const userDir = path.join(this.uploadsDir, room, username);
            const xmlFilePath = path.join(userDir, `${messageId}.xml`);
            if (fsSync.existsSync(xmlFilePath)) {
                try {
                    const content = await fs.readFile(xmlFilePath, 'utf8');
                    const fileUrlMatches = content.match(/<fileUrl>(.*?)<\/fileUrl>/g);
                    if (fileUrlMatches) {
                        const fileUrls = fileUrlMatches.map(match =>
                            match.replace(/<fileUrl>|<\/fileUrl>/g, '')
                        );
                        for (const fileUrl of fileUrls) {
                            if (fileUrl && fileUrl.startsWith('/uploads/')) {
                                const fileName = fileUrl.split('/').pop();
                                if (fileName) {
                                    const filePath = path.join(userDir, fileName);
                                    if (fsSync.existsSync(filePath)) {
                                        if (this.secureDeleter) {
                                            await this.secureDeleter.secureDeleteFile(filePath);
                                        } else {
                                            await fs.unlink(filePath);
                                        }
                                        console.log(`[AutoRoomClear] ${this.translate('ASSOCIATED_FILE_DELETED', { file: filePath })}`);
                                    }
                                }
                            }
                        }
                    }
                } catch (readError) {
                    console.error(`[AutoRoomClear] ${this.translate('ERROR_READING_XML_FOR_FILES')}:`, readError);
                }
                if (this.secureDeleter) {
                    await this.secureDeleter.secureDeleteFile(xmlFilePath);
                } else {
                    await fs.unlink(xmlFilePath);
                }
                this.io.to(room).emit('message-deleted', { messageId });
                return true;
            }
            return false;
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_DELETING_MESSAGE_FILES', { messageId: messageId })}:`, error);
            return false;
        }
    }
    async refreshChatHistory(roomName) {
        try {
            const messages = await this.loadMessagesFromRoomProperly(roomName);
            this.io.to(roomName).emit('refresh-chat-history', {
                room: roomName,
                messages: messages
            });
            console.log(`[AutoRoomClear] ${this.translate('CHAT_HISTORY_REFRESHED', { room: roomName })}`);
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_REFRESHING_CHAT_HISTORY', { room: roomName })}:`, error);
        }
    }
    async loadMessagesFromRoomProperly(room) {
        const messages = [];
        try {
            const roomDir = path.join(this.uploadsDir, room);
            if (!fsSync.existsSync(roomDir)) {
                return messages;
            }
            const userDirs = await fs.readdir(roomDir, { withFileTypes: true });
            for (const userDir of userDirs) {
                if (!userDir.isDirectory()) continue;
                const userPath = path.join(roomDir, userDir.name);
                const messageFiles = (await fs.readdir(userPath)).filter(file => file.endsWith('.xml'));
                for (const messageFile of messageFiles) {
                    try {
                        const filePath = path.join(userPath, messageFile);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        const idMatch = fileContent.match(/<id>(.*?)<\/id>/);
                        const usernameMatch = fileContent.match(/<username>(.*?)<\/username>/);
                        const userIdMatch = fileContent.match(/<userId>(.*?)<\/userId>/);
                        const textMatch = fileContent.match(/<text>(.*?)<\/text>/);
                        const timestampMatch = fileContent.match(/<timestamp>(.*?)<\/timestamp>/);
                        const roomMatch = fileContent.match(/<room>(.*?)<\/room>/);
                        const isSystemMatch = fileContent.match(/<isSystem>(.*?)<\/isSystem>/);
                        const isEncryptedMatch = fileContent.match(/<isEncrypted>(.*?)<\/isEncrypted>/);
                        const isFileMatch = fileContent.match(/<isFile>(.*?)<\/isFile>/);
                        const isAudioMatch = fileContent.match(/<isAudio>(.*?)<\/isAudio>/);
                        const fileNameMatch = fileContent.match(/<fileName>(.*?)<\/fileName>/);
                        const fileTypeMatch = fileContent.match(/<fileType>(.*?)<\/fileType>/);
                        const fileUrlMatch = fileContent.match(/<fileUrl>(.*?)<\/fileUrl>/);
                        const fileSizeMatch = fileContent.match(/<fileSize>(.*?)<\/fileSize>/);
                        const durationMatch = fileContent.match(/<duration>(.*?)<\/duration>/);
                        const message = {
                            id: idMatch ? idMatch[1] : path.parse(messageFile).name,
                            username: usernameMatch ? this.unescapeXml(usernameMatch[1]) : userDir.name,
                            userId: userIdMatch ? userIdMatch[1] : '',
                            text: textMatch ? this.unescapeXml(textMatch[1]) : '',
                            timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
                            room: roomMatch ? this.unescapeXml(roomMatch[1]) : room,
                            isSystem: isSystemMatch ? isSystemMatch[1] === 'true' : (userDir.name === 'system'),
                            isEncrypted: isEncryptedMatch ? isEncryptedMatch[1] === 'true' : false,
                            isFile: isFileMatch ? isFileMatch[1] === 'true' : false,
                            isAudio: isAudioMatch ? isAudioMatch[1] === 'true' : false,
                            fileName: fileNameMatch ? this.unescapeXml(fileNameMatch[1]) : null,
                            fileType: fileTypeMatch ? this.unescapeXml(fileTypeMatch[1]) : null,
                            fileUrl: fileUrlMatch ? this.unescapeXml(fileUrlMatch[1]) : null,
                            fileSize: fileSizeMatch ? this.unescapeXml(fileSizeMatch[1]) : null,
                            duration: durationMatch ? parseFloat(durationMatch[1]) || 0 : 0
                        };
                        const shouldSkip = !message.isSystem &&
                            !message.isFile &&
                            !message.isAudio &&
                            (!message.text || message.text.trim() === '');
                        if (!shouldSkip) {
                            messages.push(message);
                        }
                    } catch (error) {
                        console.error(`[AutoRoomClear] ${this.translate('ERROR_LOADING_SINGLE_MESSAGE', { file: messageFile })}:`, error);
                    }
                }
            }
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_LOADING_MESSAGES', { room: room })}:`, error);
        }
        return messages;
    }
    unescapeXml(safe) {
        if (!safe) return '';
        return safe.toString()
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
    async sendDeletionNotification(roomName, count) {
        try {
            const notificationMessage = {
                id: Date.now().toString(),
                username: 'system',
                userId: 'system',
                text: this.translate('MESSAGE_DELETED_NOTIFICATION', {
                    count: count,
                    room: roomName
                }),
                timestamp: new Date(),
                room: roomName,
                isSystem: true
            };
            await this.saveSystemMessageToFile(roomName, notificationMessage);
            this.io.to(roomName).emit('new-message', notificationMessage);
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_SENDING_DELETION_NOTIFICATION')}:`, error);
        }
    }
    async saveSystemMessageToFile(room, message) {
        try {
            const roomDir = path.join(this.uploadsDir, room);
            const systemDir = path.join(roomDir, 'system');
            if (!fsSync.existsSync(systemDir)) {
                await fs.mkdir(systemDir, { recursive: true });
            }
            const messageFile = path.join(systemDir, `${message.id}.xml`);
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += '<message>\n';
            xmlContent += `  <id>${message.id}</id>\n`;
            xmlContent += `  <username>${this.escapeXml(message.username)}</username>\n`;
            xmlContent += `  <userId>${message.userId}</userId>\n`;
            xmlContent += `  <text>${this.escapeXml(message.text)}</text>\n`;
            xmlContent += `  <timestamp>${message.timestamp.toISOString()}</timestamp>\n`;
            xmlContent += `  <room>${this.escapeXml(message.room)}</room>\n`;
            xmlContent += `  <isSystem>${message.isSystem || true}</isSystem>\n`;
            xmlContent += '</message>';
            await fs.writeFile(messageFile, xmlContent, 'utf8');
            console.log(`[AutoRoomClear] ${this.translate('SYSTEM_MESSAGE_SAVED', { file: messageFile })}`);
            return true;
        } catch (error) {
            console.error(`[AutoRoomClear] ${this.translate('ERROR_SAVING_SYSTEM_MESSAGE')}:`, error);
            return false;
        }
    }
    escapeXml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    async handleMessage(message, socket) {
        return false;
    }
    async destroy() {
        for (const [name, interval] of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
        console.log(`[AutoRoomClear] ${this.translate('PLUGIN_UNLOADED')}`);
    }
}
module.exports = AutoRoomClearPlugin;