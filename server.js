const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { translate } = require('./lng-server.js');
const SecureDeleter = require('./secure-delete.js');
const PluginManager = require('./plugins-manager.js');

const users = new Map();
const rooms = new Set(['Room_01']);
const messageReactions = new Map();
const reactionUsers = new Map();
const configPath = path.join(__dirname, 'config.json');


let config = {
    port: 3000,
    language: 'ru',
    password: 'pass',
    cors: {
        enabled: true,
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: false,
        maxAge: 86400
    },
    https: {
        enabled: false,
        port: 3443,
        key: "./ssl/key.pem",
        cert: "./ssl/cert.pem",
        ca: "./ssl/ca.pem",
        passphrase: "",
        redirectHttp: true,
        httpPort: 3000
    },
    stunServers: [{
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls: 'stun:stun1.l.google.com:19302'
        }
    ],
    turnServers: [{
        urls: 'turn:your-turn-server.com:3478',
        username: 'your-username',
        credential: 'your-password'
    }],
    useTurnServers: false,
    killCode: ['kill','очистка','clear'],
    killAllCode: ['killall','nuke','destroyall'],
    maxFileSize: 50 * 1024 * 1024,
    audio: {
        sampleRate: 44100,
        sampleSize: 16,
        mimeType: 'audio/webm'
    },
    rtc_video: {
        width: 640,
        height: 480,
        frameRate: 30
    },
    rtc_audio: {
        channelCount: 1,
        sampleRate: 44100,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true
    },
    videoRec_width: 640,
    videoRec_height: 480,
    videoRec_frameRate: 30,
    videoRec_bitrate: 2500000,
    videoRec_mimeType: 'video/webm;codecs=vp9',
    secureDelete: {
        enabled: true,
        gostPasses: 2,
        verifyDeletion: true,
        ssdOptimized: true,
        hddExtended: true,
        changeMetadata: true,
        bufferSize: 1048576,
        reportErrors: true
    }
};

if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = {
        ...config,
        ...JSON.parse(configData)
    };
} else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const app = express();


if (config.cors && config.cors.enabled) {
    app.use((req, res, next) => {
        const origin = config.cors.origin === "*" ? "*" : config.cors.origin;
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', config.cors.methods.join(', '));
        res.header('Access-Control-Allow-Headers', config.cors.allowedHeaders.join(', '));
        res.header('Access-Control-Allow-Credentials', config.cors.credentials);

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        next();
    });
}


let server;
let isHttps = false;

if (config.https && config.https.enabled) {
    try {
        const httpsOptions = {
            key: fs.readFileSync(config.https.key),
            cert: fs.readFileSync(config.https.cert)
        };


        if (config.https.ca && fs.existsSync(config.https.ca)) {
            httpsOptions.ca = fs.readFileSync(config.https.ca);
        }


        if (config.https.passphrase && config.https.passphrase.trim() !== '') {
            httpsOptions.passphrase = config.https.passphrase;
        }

        server = https.createServer(httpsOptions, app);
        isHttps = true;
        console.log(translate(config.language, 'HTTPS_ENABLED', { port: config.https.port }));

    } catch (error) {
        console.error(translate(config.language, 'HTTPS_ERROR'), error);
        console.log(translate(config.language, 'FALLBACK_TO_HTTP'));
        server = http.createServer(app);
    }
} else {
    server = http.createServer(app);
    console.log(translate(config.language, 'SERVER_START') + ' ' + config.port);
}


const io = socketIo(server, {
    cors: config.cors && config.cors.enabled ? {
        origin: config.cors.origin,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
        credentials: config.cors.credentials
    } : {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: config.maxFileSize,
    pingTimeout: 60000,
    pingInterval: 25000
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {
        recursive: true
    });
}


let pluginManager;
try {
    pluginManager = new PluginManager(config, io, uploadsDir);
    pluginManager.loadPlugins().then(() => {
        console.log(translate(config.language, 'PLUGINS_INITIALIZED'));
    }).catch(error => {
        console.error(translate(config.language, 'PLUGINS_LOAD_ERROR_GENERAL'), error);
    });
} catch (error) {
    console.error('Failed to initialize plugin manager:', error);
}


app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir, {
    index: false,
    redirect: false
}));

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Last-Modified', new Date().toUTCString());
    }
}));

app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Last-Modified', new Date().toUTCString());
    }
}));

app.get('/backups/:secureDir/:filename', (req, res) => {
    const secureDir = req.params.secureDir;
    const filename = req.params.filename;
    
    console.log(`[Server] Backup download requested: ${secureDir}/${filename} from IP: ${req.ip}`);
    
    // Проверяем формат имени директории
    if (!secureDir.startsWith('backup-') || secureDir.length < 45) {
        console.log(`[Server] Invalid directory format: ${secureDir}`);
        return res.status(404).send('Not found');
    }
    
    // Получаем экземпляр плагина для проверки HMAC
    const backupPlugin = pluginManager ? pluginManager.getPlugin('backup-rooms') : null;
    
    if (backupPlugin && backupPlugin.isValidBackupPath) {
        // Используем проверку HMAC через плагин
        const isValid = backupPlugin.isValidBackupPath(secureDir);
        
        if (!isValid) {
            console.log(`[Server] Invalid HMAC signature for path: ${secureDir}`);
            
            // Попробуем удалить невалидную директорию
            try {
                const invalidDirPath = path.join(__dirname, 'backups', secureDir);
                if (fs.existsSync(invalidDirPath)) {
                    fs.rmSync(invalidDirPath, { recursive: true, force: true });
                    console.log(`[Server] Removed invalid backup directory: ${secureDir}`);
                }
            } catch (cleanupError) {
                console.error(`[Server] Error removing invalid directory:`, cleanupError);
            }
            
            return res.status(403).send('Invalid backup URL');
        }
    } else {
        // Если плагин не доступен, используем базовую проверку
        const parts = secureDir.split('-');
        if (parts.length !== 3 || parts[0] !== 'backup') {
            return res.status(404).send('Not found');
        }
        
        const signature = parts[1];
        const timestampBase36 = parts[2];
        
        // Базовая проверка формата
        if (signature.length !== 32 || !/^[a-f0-9]+$/.test(signature)) {
            return res.status(403).send('Invalid backup URL format');
        }
        
        try {
            const timestamp = parseInt(timestampBase36, 36);
            const now = Date.now();
            const maxAge = 60 * 60 * 1000; // 1 час максимум
            
            if (now - timestamp > maxAge) {
                console.log(`[Server] Expired backup directory: ${secureDir}`);
                
                // Удаляем просроченную директорию
                try {
                    const expiredDirPath = path.join(__dirname, 'backups', secureDir);
                    if (fs.existsSync(expiredDirPath)) {
                        fs.rmSync(expiredDirPath, { recursive: true, force: true });
                        console.log(`[Server] Removed expired backup directory: ${secureDir}`);
                    }
                } catch (cleanupError) {
                    console.error(`[Server] Error removing expired directory:`, cleanupError);
                }
                
                return res.status(410).send('Backup expired');
            }
        } catch (error) {
            console.error(`[Server] Error parsing timestamp:`, error);
            return res.status(403).send('Invalid backup URL');
        }
    }
    
    const filePath = path.join(__dirname, 'backups', secureDir, filename);
    
    if (!fs.existsSync(filePath)) {
        console.log(`[Server] Backup file not found: ${filePath}`);
        
        // Проверяем, существует ли директория вообще
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            return res.status(404).send('Backup not found or already deleted');
        }
        
        // Если директория существует, но файла нет, возможно он был удален
        return res.status(404).send('File not found');
    }
    
    try {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        
        // Дополнительная проверка возраста файла
        const fileAge = Date.now() - stats.mtimeMs;
        const maxFileAge = 60 * 60 * 1000; // 1 час максимум
        
        if (fileAge > maxFileAge) {
            console.log(`[Server] File too old: ${secureDir}/${filename}, age: ${Math.round(fileAge/60000)}min`);
            
            // Удаляем старый файл и его директорию
            const dirPath = path.dirname(filePath);
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`[Server] Removed old backup directory: ${secureDir}`);
            
            return res.status(410).send('Backup expired and removed');
        }
        
        // Проверяем, что это ZIP файл
        if (!filename.toLowerCase().endsWith('.zip')) {
            console.log(`[Server] Invalid file type: ${filename}`);
            return res.status(403).send('Invalid file type');
        }
        
        // Настраиваем заголовки ответа
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Backup-Dir', secureDir);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Логируем успешный доступ
        console.log(`[Server] Serving backup: ${secureDir}/${filename}, Size: ${fileSize} bytes, To: ${req.ip}`);
        
        // Отправляем файл
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (error) => {
            console.error(`[Server] Error reading backup file:`, error);
            if (!res.headersSent) {
                res.status(500).send('Error reading file');
            }
        });
        
        fileStream.on('end', () => {
            console.log(`[Server] Backup download completed: ${secureDir}/${filename}`);
            
            // Планируем удаление файла через 1 секунду после завершения отправки
            // (чтобы клиент успел получить файл полностью)
            setTimeout(() => {
                if (pluginManager && backupPlugin) {
                    // Используем механизм плагина для удаления
                    const backupId = filename.replace('backup_', '').replace('.zip', '');
                    
                    // Ищем backupId в downloadingBackups
                    let foundBackupInfo = null;
                    if (backupPlugin.downloadingBackups) {
                        for (const [id, info] of backupPlugin.downloadingBackups.entries()) {
                            if (info.secureDirName === secureDir) {
                                foundBackupInfo = info;
                                break;
                            }
                        }
                    }
                    
                    if (foundBackupInfo) {
                        // Уведомляем плагин о скачивании
                        backupPlugin.handleBackupDownloaded({ backupId: foundBackupInfo.backupId });
                    } else {
                        // Если не нашли в плагине, удаляем напрямую
                        try {
                            const dirPath = path.dirname(filePath);
                            fs.rmSync(dirPath, { recursive: true, force: true });
                            console.log(`[Server] Auto-removed backup directory after download: ${secureDir}`);
                        } catch (cleanupError) {
                            console.error(`[Server] Error auto-removing directory:`, cleanupError);
                        }
                    }
                }
            }, 1000);
        });
        
        fileStream.pipe(res);
        
    } catch (error) {
        console.error(`[Server] Error serving backup file:`, error);
        
        try {
            // При ошибке пытаемся удалить проблемную директорию
            const dirPath = path.dirname(filePath);
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
                console.log(`[Server] Removed problematic backup directory: ${secureDir}`);
            }
        } catch (cleanupError) {
            console.error(`[Server] Error removing problematic directory:`, cleanupError);
        }
        
        if (!res.headersSent) {
            res.status(500).send('Server error');
        }
    }
});

let secureDeleter;
if (config.secureDelete && config.secureDelete.enabled) {
    secureDeleter = new SecureDeleter(config);
} else {
    console.log(translate(config.language, 'SECURE_DELETE_DISABLED'));
}

function ensureDirectoryExistence(dirPath) {
    if (fs.existsSync(dirPath)) {
        return true;
    }
    fs.mkdirSync(dirPath, {
        recursive: true
    });
    return true;
}

function saveMessageToFile(room, username, message) {
    try {
        if (message.isSystem) {
            return saveSystemMessageToFile(room, message);
        }
        const roomDir = path.join(uploadsDir, room);
        const userDir = path.join(roomDir, username);
        ensureDirectoryExistence(userDir);
        const messageFile = path.join(userDir, `${message.id}.xml`);
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<message>\n';
        xmlContent += `  <id>${message.id}</id>\n`;
        xmlContent += `  <username>${escapeXml(message.username)}</username>\n`;
        xmlContent += `  <userId>${message.userId}</userId>\n`;
        xmlContent += `  <text>${escapeXml(message.text)}</text>\n`;
        xmlContent += `  <timestamp>${message.timestamp.toISOString()}</timestamp>\n`;
        xmlContent += `  <room>${escapeXml(message.room)}</room>\n`;
        xmlContent += `  <isSystem>${message.isSystem || false}</isSystem>\n`;
        xmlContent += `  <isEncrypted>${message.isEncrypted || false}</isEncrypted>\n`;
        xmlContent += `  <isFile>${message.isFile || false}</isFile>\n`;
        xmlContent += `  <isAudio>${message.isAudio || false}</isAudio>\n`;
        if (message.reactions && Object.keys(message.reactions).length > 0) {
            xmlContent += `  <reactions>\n`;
            Object.entries(message.reactions).forEach(([code, count]) => {
                xmlContent += `    <reaction code="${code}" count="${count}"/>\n`;
            });
            xmlContent += `  </reactions>\n`;
        }
        if (message.fileName) {
            xmlContent += `  <fileName>${escapeXml(message.fileName)}</fileName>\n`;
        }
        if (message.fileType) {
            xmlContent += `  <fileType>${escapeXml(message.fileType)}</fileType>\n`;
        }
        if (message.fileUrl) {
            xmlContent += `  <fileUrl>${escapeXml(message.fileUrl)}</fileUrl>\n`;
        }
        if (message.fileSize) {
            xmlContent += `  <fileSize>${escapeXml(message.fileSize)}</fileSize>\n`;
        }
        if (message.duration) {
            xmlContent += `  <duration>${message.duration}</duration>\n`;
        }
        if (message.quote) {
            xmlContent += `  <quote>\n`;
            xmlContent += `    <username>${escapeXml(message.quote.username)}</username>\n`;
            xmlContent += `    <text>${escapeXml(message.quote.text)}</text>\n`;
            xmlContent += `    <isEncrypted>${message.quote.isEncrypted || false}</isEncrypted>\n`;
            xmlContent += `  </quote>\n`;
        }
        xmlContent += '</message>';
        fs.writeFileSync(messageFile, xmlContent, 'utf8');
        console.log(translate(config.language, 'MESSAGE_SAVED') + ' ' + messageFile);
        return true;
    } catch (error) {
        console.error(translate(config.language, 'MESSAGE_SAVE_ERROR'), error);
        return false;
    }
}

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function loadMessagesFromRoom(room) {
    const messages = [];
    try {
        const roomDir = path.join(uploadsDir, room);
        if (!fs.existsSync(roomDir)) {
            return messages;
        }
        const users = fs.readdirSync(roomDir);
        users.forEach(user => {
            const userDir = path.join(roomDir, user);
            if (fs.statSync(userDir).isDirectory()) {
                const messageFiles = fs.readdirSync(userDir).filter(file => file.endsWith('.xml'));
                messageFiles.forEach(messageFile => {
                    try {
                        const filePath = path.join(userDir, messageFile);
                        const fileContent = fs.readFileSync(filePath, 'utf8');
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
                        const isWarningMatch = fileContent.match(/<isWarning>(.*?)<\/isWarning>/);
                        const isKillAllMatch = fileContent.match(/<isKillAll>(.*?)<\/isKillAll>/);
                        const fileNameMatch = fileContent.match(/<fileName>(.*?)<\/fileName>/);
                        const fileTypeMatch = fileContent.match(/<fileType>(.*?)<\/fileType>/);
                        const fileUrlMatch = fileContent.match(/<fileUrl>(.*?)<\/fileUrl>/);
                        const fileSizeMatch = fileContent.match(/<fileSize>(.*?)<\/fileSize>/);
                        const durationMatch = fileContent.match(/<duration>(.*?)<\/duration>/);
                        const message = {
                            id: idMatch ? idMatch[1] : path.parse(messageFile).name,
                            username: usernameMatch ? unescapeXml(usernameMatch[1]) : user,
                            userId: userIdMatch ? userIdMatch[1] : '',
                            text: textMatch ? unescapeXml(textMatch[1]) : '',
                            timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
                            room: roomMatch ? unescapeXml(roomMatch[1]) : room,
                            isSystem: isSystemMatch ? isSystemMatch[1] === 'true' : (user === 'system'),
                            isEncrypted: isEncryptedMatch ? isEncryptedMatch[1] === 'true' : false,
                            isFile: isFileMatch ? isFileMatch[1] === 'true' : false,
                            isAudio: isAudioMatch ? isAudioMatch[1] === 'true' : false,
                            isWarning: isWarningMatch ? isWarningMatch[1] === 'true' : false,
                            isKillAll: isKillAllMatch ? isKillAllMatch[1] === 'true' : false
                        };
                        if (fileNameMatch) message.fileName = unescapeXml(fileNameMatch[1]);
                        if (fileTypeMatch) message.fileType = unescapeXml(fileTypeMatch[1]);
                        if (fileUrlMatch) message.fileUrl = unescapeXml(fileUrlMatch[1]);
                        if (fileSizeMatch) message.fileSize = unescapeXml(fileSizeMatch[1]);
                        if (durationMatch) message.duration = parseFloat(durationMatch[1]) || 0;
                        const reactionsMatch = fileContent.match(/<reactions>([\s\S]*?)<\/reactions>/);
                        if (reactionsMatch) {
                            const reactionsContent = reactionsMatch[1];
                            const reactionMatches = reactionsContent.matchAll(/<reaction code="(.*?)" count="(.*?)"([^>]*)>([\s\S]*?)<\/reaction>/g);
                            message.reactions = {};
                            if (!reactionUsers.has(message.id)) {
                                reactionUsers.set(message.id, {});
                            }
                            const usersReactions = reactionUsers.get(message.id);
                            for (const match of reactionMatches) {
                                const code = match[1];
                                const count = parseInt(match[2]);
                                const innerContent = match[4];
                                message.reactions[code] = count;
                                const usersMatch = innerContent.match(/<users>([\s\S]*?)<\/users>/);
                                if (usersMatch) {
                                    const usersContent = usersMatch[1];
                                    const userMatches = usersContent.matchAll(/<user>(.*?)<\/user>/g);
                                    usersReactions[code] = [];
                                    for (const userMatch of userMatches) {
                                        usersReactions[code].push(unescapeXml(userMatch[1]));
                                    }
                                }
                                if (!messageReactions.has(message.id)) {
                                    messageReactions.set(message.id, {});
                                }
                                messageReactions.get(message.id)[code] = count;
                            }
                            message.reactionUsers = usersReactions;
                        }
                        const quoteMatch = fileContent.match(/<quote>([\s\S]*?)<\/quote>/);
                        if (quoteMatch) {
                            const quoteContent = quoteMatch[1];
                            const quoteUsernameMatch = quoteContent.match(/<username>(.*?)<\/username>/);
                            const quoteTextMatch = quoteContent.match(/<text>(.*?)<\/text>/);
                            const quoteIsEncryptedMatch = quoteContent.match(/<isEncrypted>(.*?)<\/isEncrypted>/);
                            if (quoteUsernameMatch && quoteTextMatch) {
                                message.quote = {
                                    username: unescapeXml(quoteUsernameMatch[1]),
                                    text: unescapeXml(quoteTextMatch[1]),
                                    isEncrypted: quoteIsEncryptedMatch ? quoteIsEncryptedMatch[1] === 'true' : false
                                };
                            }
                        }
                        const shouldSkip = !message.isSystem &&
                            !message.isFile &&
                            !message.isAudio &&
                            !message.isWarning &&
                            !message.isKillAll &&
                            (!message.text || message.text.trim() === '') &&
                            !message.quote;
                        if (!shouldSkip) {
                            messages.push(message);
                        }
                    } catch (error) {
                        console.error(translate(config.language, 'SINGLE_MESSAGE_LOAD_ERROR'), messageFile, error);
                    }
                });
            }
        });
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
        console.error(translate(config.language, 'MESSAGE_LOAD_ERROR'), room, error);
    }
    return messages;
}

function unescapeXml(safe) {
    if (!safe) return '';
    return safe.toString()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function saveFileMetadata(room, username, fileName, fileData) {
    try {
        const roomDir = path.join(uploadsDir, room);
        const userDir = path.join(roomDir, username);
        ensureDirectoryExistence(userDir);
        const metadataFile = path.join(userDir, `${fileName}.xml`);
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<file>\n';
        xmlContent += `  <originalName>${escapeXml(fileData.fileName)}</originalName>\n`;
        xmlContent += `  <storedName>${escapeXml(fileName)}</storedName>\n`;
        xmlContent += `  <type>${escapeXml(fileData.fileType)}</type>\n`;
        xmlContent += `  <url>${escapeXml(fileData.fileUrl)}</url>\n`;
        xmlContent += `  <size>${escapeXml(fileData.fileSize)}</size>\n`;
        xmlContent += `  <duration>${fileData.duration || 0}</duration>\n`;
        xmlContent += `  <timestamp>${new Date().toISOString()}</timestamp>\n`;
        xmlContent += `  <isEncrypted>${fileData.isEncrypted || false}</isEncrypted>\n`;
        xmlContent += `  <username>${escapeXml(username)}</username>\n`;
        xmlContent += `  <room>${escapeXml(room)}</room>\n`;
        xmlContent += '</file>';
        fs.writeFileSync(metadataFile, xmlContent, 'utf8');
        console.log(translate(config.language, 'FILE_METADATA_SAVED') + ' ' + metadataFile);
        return true;
    } catch (error) {
        console.error(translate(config.language, 'FILE_METADATA_SAVE_ERROR'), error);
        return false;
    }
}

function getIceServers() {
    const iceServers = [...config.stunServers];
    if (config.useTurnServers && config.turnServers && config.turnServers.length > 0) {
        console.log('='.repeat(60));
        console.log(translate(config.language, 'TURN_SERVERS_ENABLED'));
        console.log('='.repeat(60));
        config.turnServers.forEach((server, index) => {
            console.log(translate(config.language, 'TURN_SERVER_DETAILS') + ' ' + (index + 1) + ':');
            console.log('  ' + translate(config.language, 'TURN_URL') + ' ' + server.urls);
            console.log('  ' + translate(config.language, 'TURN_USERNAME') + ' ' + server.username);
            console.log('  ' + translate(config.language, 'TURN_PASSWORD') + ' ' + (server.credential ? '***' + server.credential.slice(-3) : translate(config.language, 'TURN_MISSING_CREDENTIALS').replace('❌ ERROR: ', '')));
            if (!server.urls) {
                console.error('  ' + translate(config.language, 'TURN_MISSING_URL'));
            } else {
                const protocols = ['turn:', 'turns:', 'stun:'];
                const hasValidProtocol = protocols.some(proto => server.urls.includes(proto));
                if (!hasValidProtocol) {
                    console.error('  ' + translate(config.language, 'TURN_INVALID_PROTOCOL'));
                }
            }
            if (!server.username || !server.credential) {
                console.error('  ' + translate(config.language, 'TURN_MISSING_CREDENTIALS'));
            } else {
                console.log('  ' + translate(config.language, 'TURN_CREDENTIALS_OK'));
            }
            const portMatch = server.urls.match(/:(\d+)/);
            if (portMatch) {
                const port = parseInt(portMatch[1]);
                console.log('  ' + translate(config.language, 'TURN_PORT') + ' ' + port);
                if (port < 1 || port > 65535) {
                    console.error('  ' + translate(config.language, 'TURN_INVALID_PORT'));
                } else if (port < 1024) {
                    console.warn('  ' + translate(config.language, 'TURN_LOW_PORT_WARNING'));
                }
            }
            console.log('  ---');
        });
        console.log(translate(config.language, 'TURN_SERVER_COUNT') + ' ' + config.turnServers.length);
        console.log('='.repeat(60));
        iceServers.push(...config.turnServers);
    } else {
        console.log('='.repeat(60));
        console.log(translate(config.language, 'TURN_SERVERS_DISABLED'));
        console.log('='.repeat(60));
        console.log(translate(config.language, 'TURN_WARNING'));
        if (!config.turnServers || config.turnServers.length === 0) {
            console.log(translate(config.language, 'TURN_NOT_CONFIGURED'));
        } else if (!config.useTurnServers) {
            console.log(translate(config.language, 'TURN_DISABLED_IN_SETTINGS'));
        }
        console.log('='.repeat(60));
    }
    return iceServers;
}

io.on('connection', (socket) => {
    console.log(translate(config.language, 'NEW_CONNECTION') + ' ' + socket.id);
    const iceServers = getIceServers();
    socket.emit('push-config', config.pushNotifications);
    socket.emit('stun-config', iceServers);
    socket.emit('rtc-config', {
        video: config.rtc_video,
        audio: config.rtc_audio,
        videoRec: {
            width: config.videoRec_width,
            height: config.videoRec_height,
            frameRate: config.videoRec_frameRate,
            bitrate: config.videoRec_bitrate,
            mimeType: config.videoRec_mimeType
        },
        useTurnServers: config.useTurnServers
    });

    socket.on('backup-downloaded', (data) => {
    console.log('Received backup-downloaded:', data);

    if (pluginManager) {
        const backupPlugin = pluginManager.getPlugin('backup-rooms');
        if (backupPlugin && backupPlugin.handleBackupDownloaded) {
            backupPlugin.handleBackupDownloaded(data);
        }
    }
});

socket.on('backup-canceled', (data) => {
    console.log('Received backup-canceled:', data);

    if (pluginManager) {
        const backupPlugin = pluginManager.getPlugin('backup-rooms');
        if (backupPlugin && backupPlugin.handleBackupCanceled) {
            backupPlugin.handleBackupCanceled(data);
        }
    }
});

    socket.on('delete-message', async (data, callback) => {
        const user = users.get(socket.id);
        if (user) {
            const { messageId } = data;
            console.log(user.username + ' ' + translate(config.language, 'MESSAGE_DELETION_REQUESTED') + ' ' + messageId + ' ' + translate(config.language, 'IN_ROOM') + ' ' + user.room);
            const userDir = path.join(uploadsDir, user.room, user.username);
            const messageFile = path.join(userDir, `${messageId}.xml`);
            if (!fs.existsSync(messageFile)) {
                console.log(translate(config.language, 'MESSAGE_NOT_FOUND') + ' ' + messageId + ' ' + translate(config.language, 'FOR_USER') + ' ' + user.username);
                if (callback) callback({
                    error: translate(config.language, 'MESSAGE_NOT_FOUND')
                });
                return;
            }
            try {
                const fileContent = fs.readFileSync(messageFile, 'utf8');
                const usernameMatch = fileContent.match(/<username>(.*?)<\/username>/);
                if (usernameMatch && usernameMatch[1] === user.username) {
                    let deleteResult;
                    if (secureDeleter) {
                        deleteResult = await secureDeleter.deleteMessageFiles(user.room, messageId, user.username, io);
                    } else {
                        deleteResult = deleteMessageFromFiles(user.room, messageId, user.username);
                    }
                    if (deleteResult) {
                        io.to(user.room).emit('message-deleted', {
                            messageId
                        });
                        console.log(user.username + ' ' + translate(config.language, 'MESSAGE_SUCCESSFULLY_DELETED') + ' ' + messageId);
                        if (callback) callback({
                            success: true
                        });
                    } else {
                        console.error(translate(config.language, 'FILE_DELETION_ERROR') + ' ' + messageId);
                        if (callback) callback({
                            error: translate(config.language, 'FILE_DELETION_ERROR')
                        });
                    }
                } else {
                    console.log(user.username + ' ' + translate(config.language, 'CANNOT_DELETE_OTHERS_MESSAGES') + ': ' + user.username + ' ' + translate(config.language, 'ATTEMPTS_TO_DELETE_MESSAGE_OF') + ' ' + (usernameMatch ? usernameMatch[1] : translate(config.language, 'UNKNOWN_USER')));
                    if (callback) callback({
                        error: translate(config.language, 'CANNOT_DELETE_OTHERS_MESSAGES')
                    });
                }
            } catch (readError) {
                console.error(translate(config.language, 'XML_READ_ERROR'), readError);
                if (callback) callback({
                    error: translate(config.language, 'XML_CHECK_ERROR')
                });
            }
        } else {
            if (callback) callback({
                error: 'Пользователь не авторизован'
            });
        }
    });

    function deleteMessageFromFiles(room, messageId, username) {
        try {
            const roomDir = path.join(uploadsDir, room);
            const userDir = path.join(roomDir, username);
            if (!fs.existsSync(userDir)) {
                console.log(translate(config.language, 'USER_DIR_NOT_FOUND') + ' ' + userDir);
                return false;
            }
            console.log(translate(config.language, 'STARTING_FILE_DELETION', {
                messageId: messageId,
                username: username,
                room: room
            }));
            let fileUrls = [];
            const messageFile = path.join(userDir, `${messageId}.xml`);
            if (fs.existsSync(messageFile)) {
                try {
                    const fileContent = fs.readFileSync(messageFile, 'utf8');
                    const fileUrlMatches = fileContent.match(/<fileUrl>(.*?)<\/fileUrl>/g);
                    if (fileUrlMatches) {
                        fileUrls = fileUrlMatches.map(match => {
                            return match.replace(/<fileUrl>|<\/fileUrl>/g, '');
                        });
                    }
                    console.log(translate(config.language, 'FOUND_FILEURLS_IN_XML') + ':', fileUrls);
                    fs.unlinkSync(messageFile);
                    console.log(translate(config.language, 'XML_MESSAGE_DELETED') + ' ' + messageFile);
                } catch (readError) {
                    console.error(translate(config.language, 'XML_READ_ERROR'), readError);
                    if (fs.existsSync(messageFile)) {
                        fs.unlinkSync(messageFile);
                    }
                }
            } else {
                console.log(translate(config.language, 'XML_MESSAGE_NOT_FOUND') + ' ' + messageFile);
            }
            fileUrls.forEach(fileUrl => {
                try {
                    if (fileUrl && fileUrl.startsWith('/uploads/')) {
                        const fileName = fileUrl.split('/').pop();
                        if (fileName) {
                            const filePath = path.join(userDir, fileName);
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                                console.log(translate(config.language, 'FILE_DELETED') + ' ' + filePath);
                            }
                        }
                    }
                } catch (fileError) {
                    console.error(translate(config.language, 'ERROR_DELETING_FILE') + ' ' + fileUrl + ':', fileError);
                }
            });
            const files = fs.readdirSync(userDir);
            files.forEach(file => {
                if (file.startsWith(messageId) || file.includes(`-${messageId}-`) || file.includes(`_${messageId}_`)) {
                    const filePath = path.join(userDir, file);
                    try {
                        if (!file.endsWith('.xml') || file === `${messageId}.xml`) {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                                console.log(translate(config.language, 'RELATED_FILE_DELETED') + ' ' + filePath);
                            }
                        }
                    } catch (error) {
                        console.error(translate(config.language, 'ERROR_DELETING_RELATED_FILE') + ' ' + filePath + ':', error);
                    }
                }
            });
            console.log(translate(config.language, 'FILE_DELETION_COMPLETED') + ' ' + messageId);
            return true;
        } catch (error) {
            console.error(translate(config.language, 'GENERAL_FILE_DELETION_ERROR') + ':', error);
            return false;
        }
    }

    socket.on('add-reaction', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const { messageId, reactionCode } = data;
            const username = user.username;
            if (!messageReactions.has(messageId)) {
                messageReactions.set(messageId, {});
            }
            if (!reactionUsers.has(messageId)) {
                reactionUsers.set(messageId, {});
            }
            const reactions = messageReactions.get(messageId);
            const usersReactions = reactionUsers.get(messageId);
            if (!reactions[reactionCode]) {
                reactions[reactionCode] = 0;
            }
            if (!usersReactions[reactionCode]) {
                usersReactions[reactionCode] = [];
            }
            if (!usersReactions[reactionCode].includes(username)) {
                reactions[reactionCode]++;
                usersReactions[reactionCode].push(username);
                updateMessageReactionsInFile(user.room, messageId, reactions, usersReactions);
                io.to(user.room).emit('reactions-updated', {
                    messageId: messageId,
                    reactions: reactions,
                    reactionUsers: usersReactions
                });
                console.log(translate(config.language, 'REACTION_ADDED', {
                    username: user.username,
                    reactionCode: reactionCode,
                    messageId: messageId
                }));
            } else {
                console.log(translate(config.language, 'REACTION_ALREADY_ADDED', {
                    username: user.username,
                    reactionCode: reactionCode,
                    messageId: messageId
                }));
            }
        }
    });

    function updateMessageReactionsInFile(room, messageId, reactions, usersReactions) {
        try {
            const roomDir = path.join(uploadsDir, room);
            if (!fs.existsSync(roomDir)) {
                return false;
            }
            const users = fs.readdirSync(roomDir);
            for (const user of users) {
                const userDir = path.join(roomDir, user);
                if (fs.statSync(userDir).isDirectory()) {
                    const messageFile = path.join(userDir, `${messageId}.xml`);
                    if (fs.existsSync(messageFile)) {
                        const fileContent = fs.readFileSync(messageFile, 'utf8');
                        let newContent = fileContent.replace(/<reactions>[\s\S]*?<\/reactions>/, '');
                        if (Object.keys(reactions).length > 0) {
                            let reactionsXml = '\n  <reactions>\n';
                            Object.entries(reactions).forEach(([code, count]) => {
                                reactionsXml += `    <reaction code="${code}" count="${count}">\n`;
                                if (usersReactions && usersReactions[code] && usersReactions[code].length > 0) {
                                    reactionsXml += `      <users>\n`;
                                    usersReactions[code].forEach(username => {
                                        reactionsXml += `        <user>${escapeXml(username)}</user>\n`;
                                    });
                                    reactionsXml += `      </users>\n`;
                                }
                                reactionsXml += `    </reaction>\n`;
                            });
                            reactionsXml += '  </reactions>';
                            newContent = newContent.replace('</message>', `${reactionsXml}\n</message>`);
                        }
                        fs.writeFileSync(messageFile, newContent, 'utf8');
                        console.log(translate(config.language, 'REACTIONS_UPDATED') + ' ' + messageFile);
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error(translate(config.language, 'ERROR_UPDATING_REACTIONS_IN_FILE') + ':', error);
        }
        return false;
    }

    socket.on('user-join-attempt', (data) => {
    const { username, room, password, language = 'ru' } = data;

    if (data.password !== config.password) {
        socket.emit('join-error', translate(language, 'ERROR_WRONG_PASSWORD'));
        return;
    }

    const existingUser = Array.from(users.values()).find(user =>
        user.username === username && user.room === room
    );

    if (existingUser) {
        socket.emit('join-error', translate(language, 'ERROR_USERNAME_EXISTS'));

        const warningMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: translate(config.language, 'DOUBLE_LOGIN_WARNING', {username: username}),
            timestamp: new Date(),
            room: room,
            isSystem: true,
            isWarning: true
        };

        saveSystemMessageToFile(room, warningMessage);
        io.to(room).emit('new-message', warningMessage);
        return;
    }
    if (!rooms.has(room)) {
        rooms.add(room);
    }
    users.set(socket.id, {
        username,
        id: socket.id,
        room
    });
    socket.join(room);


    pluginManager.handleUserJoin({
        username,
        id: socket.id,
        room
    }, socket);

    const messageHistory = loadMessagesFromRoom(room);
    const reactionUsersData = {};
    messageHistory.forEach(message => {
        if (message.id && reactionUsers.has(message.id)) {
            reactionUsersData[message.id] = reactionUsers.get(message.id);
        }
    });
    socket.emit('user-joined', {
        username,
        room,
        messageHistory: messageHistory,
        reactionUsersData: reactionUsersData
    });

    const joinMessage = {
        id: Date.now().toString(),
        username: 'system',
        userId: 'system',
        text: translate(config.language, 'USER_JOINED', {username: username}),
        timestamp: new Date(),
        room: room,
        isSystem: true
    };

    const roomUsers = Array.from(users.values()).filter(user => user.room === room);
    io.to(room).emit('users-list', roomUsers);
    console.log(translate(config.language, 'USER_JOINED_ROOM', {username: username, room: room}));
});


socket.on('send-message', async (data) => {
    const user = users.get(socket.id);
    if (user) {
        const messageForPlugins = {
            id: Date.now().toString(),
            username: user.username,
            userId: socket.id,
            text: data.text,
            timestamp: new Date(),
            room: user.room,
            isEncrypted: data.isEncrypted || false,
            quote: data.quote || null
        };

        let handledByPlugin = false;
        if (pluginManager) {
            handledByPlugin = await pluginManager.handleMessage(messageForPlugins, socket);
        }

        if (handledByPlugin) {
            return;
        }

        if (config.killCode && Array.isArray(config.killCode) && config.killCode.includes(data.text.trim())) {
            if (secureDeleter) {
                await secureDeleter.deleteRoomFolder(user.room, io);
            } else {
                const roomDir = path.join(uploadsDir, user.room);
                if (fs.existsSync(roomDir)) {
                    fs.rmSync(roomDir, {
                        recursive: true,
                        force: true
                    });
                    console.log(translate(config.language, 'ROOM_FOLDER_DELETED', {room: user.room}));
                }
            }

            const clearMessage = {
                id: Date.now().toString(),
                username: 'system',
                userId: 'system',
                text: translate(config.language, 'HISTORY_CLEARED_BY_USER', {username: user.username}),
                timestamp: new Date(),
                room: user.room,
                isSystem: true
            };

            saveSystemMessageToFile(user.room, clearMessage);
            io.to(user.room).emit('clear-chat');
            io.to(user.room).emit('new-message', clearMessage);
            console.log(user.username + ' ' + translate(config.language, 'CLEARED_CHAT_AND_FILES', {room: user.room}));
            return;
        }

        if (config.killAllCode && Array.isArray(config.killAllCode) && config.killAllCode.includes(data.text.trim())) {
            console.log(user.username + ' ' + translate(config.language, 'ACTIVATED_KILLALL_COMMAND'));
            const killAllMessage = {
                id: Date.now().toString(),
                username: 'system',
                userId: 'system',
                text: translate(config.language, 'KILLALL_MESSAGE'),
                timestamp: new Date(),
                isSystem: true,
                isKillAll: true
            };
            saveSystemMessageToFile(user.room, killAllMessage);

            if (secureDeleter) {
                await secureDeleter.deleteUploadsFolder(io);
            } else {
                if (fs.existsSync(uploadsDir)) {
                    fs.rmSync(uploadsDir, {
                        recursive: true,
                        force: true
                    });
                    console.log(translate(config.language, 'UPLOADS_FOLDER_DELETED'));
                }
                fs.mkdirSync(uploadsDir, {
                    recursive: true
                });
            }

            io.emit('killall-message', killAllMessage);
            setTimeout(() => {
                console.log(translate(config.language, 'SERVER_SHUTDOWN'));
                process.exit(0);
            }, 3000);
            return;
        }

        const message = {
            id: Date.now().toString(),
            username: user.username,
            userId: socket.id,
            text: data.text,
            timestamp: new Date(),
            room: user.room,
            quote: data.quote || null,
            isEncrypted: data.isEncrypted || false
        };
        if (saveMessageToFile(user.room, user.username, message)) {
            console.log(translate(config.language, 'MESSAGE_SAVED_TO_FILE', {path: `${user.room}/${user.username}/${message.id}.xml`}));
        }
        io.to(user.room).emit('new-message', message);
    }
});

    socket.on('send-file', (data, callback) => {
    const user = users.get(socket.id);
    if (!user) {
        if (callback) callback({
            error: 'Пользователь не авторизован'
        });
        return;
    }


    let originalFileName = data.fileName;
    if (originalFileName.includes('file_') && originalFileName.includes('_nocache=')) {

        const parts = originalFileName.split('_');
        if (parts.length > 3) {

            originalFileName = parts.slice(3).join('_');

            originalFileName = originalFileName.split('?')[0];
        }
    }


    if (originalFileName.includes('_nocache=')) {
        originalFileName = originalFileName.split('_nocache=')[0];

        if (originalFileName.endsWith('?')) {
            originalFileName = originalFileName.slice(0, -1);
        }
    }


    if (data.fileData.length * 0.75 > config.maxFileSize) {
        const errorMsg = translate(config.language, 'FILES_TOO_BIG') + ' ' + (config.maxFileSize / (1024 * 1024)) + ' ' + translate(config.language, 'MB');
        if (callback) callback({
            error: errorMsg
        });
        const errorMessage = {
            id: Date.now().toString(),
            username: translate(this.config.language, 'SYSTEM'),
            userId: 'system',
            text: translate(this.config.language, 'FAILED_TO_SEND_FILE') + ' ' + originalFileName + ': ' + translate(this.config.language, 'ERROR_SAVING'),
            timestamp: new Date(),
            room: user.room,
            isSystem: true
        };
        socket.emit('new-message', errorMessage);
        return;
    }


    const fileExt = originalFileName.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const uniqueFileName = `${timestamp}-${randomStr}.${fileExt}`;

    const roomDir = path.join(uploadsDir, user.room);
    const userDir = path.join(roomDir, user.username);
    ensureDirectoryExistence(userDir);

    const filePath = path.join(userDir, uniqueFileName);
    const fileUrl = `/uploads/${user.room}/${user.username}/${uniqueFileName}`;

    fs.writeFile(filePath, data.fileData, 'base64', (err) => {
        if (err) {
            console.error(translate(config.language, 'ERROR_SAVING_FILE') + ':', err);
            if (callback) callback({
                error: translate(config.language, 'ERROR_SAVING_FILE')
            });
            const errorMessage = {
                id: Date.now().toString(),
                username: translate(config.language, 'SYSTEM'),
                userId: 'system',
                text: translate(config.language, 'FAILED_TO_SEND_FILE') + ' ' + originalFileName + ': ' + translate(config.language, 'ERROR_SAVING'),
                timestamp: new Date(),
                room: user.room,
                isSystem: true
            };
            socket.emit('new-message', errorMessage);
            return;
        }

        console.log(translate(config.language, 'FILE_SAVED') + ' ' + filePath);

        const isAudio = data.fileType.startsWith('audio/');
        const isVideo = data.fileType.startsWith('video/');
        let fileSizeDisplay, duration;

        if (isAudio || isVideo) {
            fileSizeDisplay = data.fileSize ? data.fileSize + ' ' + translate(config.language, 'KB') : '0 ' + translate(config.language, 'KB');
            duration = data.duration || 0;
        } else {
            const fileSizeMB = (data.fileData.length * 0.75 / (1024 * 1024)).toFixed(2);
            fileSizeDisplay = fileSizeMB + ' ' + translate(config.language, 'MB');
            duration = 0;
        }


        const message = {
            id: Date.now().toString(),
            username: user.username,
            userId: socket.id,
            fileName: originalFileName,
            fileType: data.fileType,
            fileUrl: fileUrl,
            fileSize: fileSizeDisplay,
            duration: duration,
            timestamp: new Date(),
            isFile: true,
            isAudio: isAudio,
            isEncrypted: data.isEncrypted || false,
            room: user.room
        };

        if (saveMessageToFile(user.room, user.username, message)) {
            console.log(translate(config.language, 'FILE_MESSAGE_SAVED', {path: `${user.room}/${user.username}/${message.id}.xml`}));
        }

        saveFileMetadata(user.room, user.username, uniqueFileName, {
            fileName: originalFileName,
            fileType: data.fileType,
            fileUrl: fileUrl,
            fileSize: fileSizeDisplay,
            duration: duration,
            isEncrypted: data.isEncrypted || false
        });

        io.to(user.room).emit('new-message', message);

        if (callback) callback({
            success: true
        });
    });
});

    socket.on('send-audio', (data, callback) => {
        console.log(translate(config.language, 'AUDIO_MESSAGE_RECEIVED_FROM_USER') + ':', socket.id);
        const user = users.get(socket.id);
        if (!user) {
            if (callback) callback({
                error: 'Пользователь не авторизован'
            });
            return;
        }
        console.log(translate(config.language, 'AUDIO_DATA_SIZE') + ':', data.audioData.length, translate(config.language, 'BYTES'));
        const fileExt = data.fileName.split('.').pop();
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const roomDir = path.join(uploadsDir, user.room);
        const userDir = path.join(roomDir, user.username);
        ensureDirectoryExistence(userDir);
        const filePath = path.join(userDir, uniqueFileName);
        const fileUrl = `/uploads/${user.room}/${user.username}/${uniqueFileName}`;
        fs.writeFile(filePath, data.audioData, 'base64', (err) => {
            if (err) {
                console.error(translate(config.language, 'ERROR_SAVING_AUDIO_FILE') + ':', err);
                if (callback) callback({
                    error: translate(config.language, 'ERROR_SAVING_AUDIO_FILE')
                });
                return;
            }
            console.log(translate(config.language, 'AUDIO_FILE_SAVED') + ':', filePath);
            const message = {
                id: Date.now().toString(),
                username: user.username,
                userId: socket.id,
                fileName: data.fileName,
                fileType: data.fileType,
                fileUrl: fileUrl,
                duration: data.duration,
                timestamp: new Date(),
                isFile: true,
                isAudio: true,
                isEncrypted: data.isEncrypted || false,
                room: user.room
            };
            if (saveMessageToFile(user.room, user.username, message)) {
                console.log(translate(config.language, 'AUDIO_MESSAGE_SAVED') + ' ' + user.room + '/' + user.username + '/' + message.id + '.xml');
            }
            saveFileMetadata(user.room, user.username, uniqueFileName, {
                fileName: data.fileName,
                fileType: data.fileType,
                fileUrl: fileUrl,
                fileSize: (data.audioData.length * 0.75 / 1024).toFixed(2) + ' ' + translate(config.language, 'KB'),
                duration: data.duration,
                isEncrypted: data.isEncrypted || false
            });
            io.to(user.room).emit('new-message', message);
            console.log(translate(config.language, 'AUDIO_MESSAGE_SENT_TO_ROOM') + ':', user.room);
            if (callback) callback({
                success: true
            });
        });
    });

    socket.on('webrtc-offer', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const targetUser = Array.from(users.values()).find(u =>
                u.username === data.targetUsername && u.room === user.room
            );
            if (targetUser) {
                socket.to(targetUser.id).emit('webrtc-offer', {
                    offer: data.offer,
                    from: socket.id,
                    fromUsername: user.username,
                    type: data.type,
                    room: data.room
                });
            }
        }
    });

    socket.on('webrtc-answer', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const targetUser = Array.from(users.values()).find(u =>
                u.username === data.targetUsername && u.room === user.room
            );
            if (targetUser) {
                socket.to(targetUser.id).emit('webrtc-answer', {
                    answer: data.answer,
                    from: socket.id,
                    fromUsername: user.username
                });
            }
        }
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const targetUser = Array.from(users.values()).find(u =>
                u.username === data.targetUsername && u.room === user.room
            );
            if (targetUser) {
                socket.to(targetUser.id).emit('webrtc-ice-candidate', {
                    candidate: data.candidate,
                    from: socket.id,
                    fromUsername: user.username
                });
            }
        }
    });

    socket.on('webrtc-reject', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const targetUser = Array.from(users.values()).find(u =>
                u.username === data.targetUsername && u.room === user.room
            );
            if (targetUser) {
                socket.to(targetUser.id).emit('webrtc-reject', {
                    from: socket.id,
                    fromUsername: user.username,
                    reason: data.reason || translate(config.language, 'CALL_REJECTED')
                });
            }
        }
    });

    socket.on('webrtc-hangup', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const targetUser = Array.from(users.values()).find(u =>
                u.username === data.targetUsername && u.room === user.room
            );
            if (targetUser) {
                socket.to(targetUser.id).emit('webrtc-hangup', {
                    from: socket.id,
                    fromUsername: user.username
                });
            }
        }
    });

    socket.on('disconnect', (reason) => {
    const user = users.get(socket.id);
    if (user) {

        pluginManager.handleUserLeave(user);

        console.log(translate(config.language, 'USER_LEFT_ROOM', {username: user.username, room: user.room}));
        const leaveMessage = {
            id: Date.now().toString(),
            username: 'system',
            userId: 'system',
            text: translate(config.language, 'USER_LEFT', {username: user.username}),
            timestamp: new Date(),
            room: user.room,
            isSystem: true
        };

        saveSystemMessageToFile(user.room, leaveMessage);
        io.to(user.room).emit('new-message', leaveMessage);

        users.delete(socket.id);
        const roomUsers = Array.from(users.values()).filter(u => u.room === user.room);
        io.to(user.room).emit('users-list', roomUsers);

        console.log(user.username + ' ' + translate(config.language, 'USER_LEFT_ROOM').replace('вышел из комнаты', 'вышел из комнаты ' + user.room) + '. ' + translate(config.language, 'REASON') + ': ' + reason);
    }
});
});

const getServerPort = () => {
    if (config.https && config.https.enabled) {
        return config.https.port || config.port;
    }
    return config.port;
};

const PORT = getServerPort();


server.listen(PORT, () => {
    console.log('='.repeat(60));

    if (config.https && config.https.enabled) {


        if (config.https.key && config.https.cert) {
            console.log(translate(config.language, 'SSL_CERTIFICATES'));
            console.log(translate(config.language, 'SSL_KEY') + ' ' + config.https.key);
            console.log(translate(config.language, 'SSL_CERT') + ' ' + config.https.cert);
            if (config.https.ca) {
                console.log(translate(config.language, 'SSL_CA') + ' ' + config.https.ca);
            }
        }
    } else {
        console.log(translate(config.language, 'SERVER_START') + ' ' + PORT);
    }

    console.log(translate(config.language, 'MAX_FILE_SIZE') + ' ' + (config.maxFileSize / (1024 * 1024)) + ' ' + translate(config.language, 'MB'));
    console.log(translate(config.language, 'FILE_STORAGE_PATH') + ' ' + uploadsDir);
    console.log(translate(config.language, 'TURN_STATUS') + ' ' + (config.useTurnServers ? translate(config.language, 'TURN_ENABLED') : translate(config.language, 'TURN_DISABLED')));

    const iceServers = getIceServers();
    console.log(translate(config.language, 'ICE_SERVERS_COUNT') + ' ' + iceServers.length);


    if (config.https && config.https.enabled && config.https.redirectHttp) {
        const redirectPort = config.https.httpPort || 80;


        const httpServer = http.createServer((req, res) => {
            const host = req.headers.host.split(':')[0];
            const httpsUrl = `https://${host}:${PORT}${req.url}`;
            res.writeHead(301, {
                'Location': httpsUrl,
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            });
            res.end();
        });

        httpServer.listen(redirectPort, () => {
            console.log(translate(config.language, 'HTTP_REDIRECT_ENABLED', {
                from: redirectPort,
                to: PORT
            }));
        });
    }

    setTimeout(() => {
        cleanupOldBackupDirectories();
    }, 10000);
    
    console.log('='.repeat(60));
});

// Функция для очистки старых директорий бэкапов
function cleanupOldBackupDirectories() {
    const backupsDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupsDir)) {
        return;
    }
    
    try {
        const items = fs.readdirSync(backupsDir, { withFileTypes: true });
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 часа максимум
        
        for (const item of items) {
            if (!item.isDirectory() || !item.name.startsWith('backup-')) {
                continue;
            }
            
            const dirPath = path.join(backupsDir, item.name);
            const stats = fs.statSync(dirPath);
            const dirAge = now - stats.mtimeMs;
            
            if (dirAge > maxAge) {
                console.log(`[Server] Removing very old backup directory: ${item.name} (age: ${Math.round(dirAge/3600000)}h)`);
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        }
    } catch (error) {
        console.error('[Server] Error cleaning up old backup directories:', error);
    }
}

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(translate(config.language, 'PORT_BUSY') + ' ' + PORT + '!');
        console.error(translate(config.language, 'PORT_BUSY_SOLUTIONS'));
    } else {
        console.error('❌ Ошибка сервера:', error.message);
    }
    process.exit(1);
});

function saveSystemMessageToFile(room, message) {
    try {
        const roomDir = path.join(uploadsDir, room);
        const systemDir = path.join(roomDir, 'system');
        ensureDirectoryExistence(systemDir);
        const messageFile = path.join(systemDir, `${message.id}.xml`);
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<message>\n';
        xmlContent += `  <id>${message.id}</id>\n`;
        xmlContent += `  <username>${escapeXml(message.username)}</username>\n`;
        xmlContent += `  <userId>${message.userId}</userId>\n`;
        xmlContent += `  <text>${escapeXml(message.text)}</text>\n`;
        xmlContent += `  <timestamp>${message.timestamp.toISOString()}</timestamp>\n`;
        xmlContent += `  <room>${escapeXml(message.room)}</room>\n`;
        xmlContent += `  <isSystem>${message.isSystem || true}</isSystem>\n`;
        xmlContent += `  <isEncrypted>${message.isEncrypted || false}</isEncrypted>\n`;
        xmlContent += `  <isFile>${message.isFile || false}</isFile>\n`;
        xmlContent += `  <isAudio>${message.isAudio || false}</isAudio>\n`;
        if (message.isWarning) {
            xmlContent += `  <isWarning>${message.isWarning}</isWarning>\n`;
        }
        if (message.isKillAll) {
            xmlContent += `  <isKillAll>${message.isKillAll}</isKillAll>\n`;
        }
        if (message.reactions && Object.keys(message.reactions).length > 0) {
            xmlContent += `  <reactions>\n`;
            Object.entries(message.reactions).forEach(([code, count]) => {
                xmlContent += `    <reaction code="${code}" count="${count}"/>\n`;
            });
            xmlContent += `  </reactions>\n`;
        }
        if (message.fileName) {
            xmlContent += `  <fileName>${escapeXml(message.fileName)}</fileName>\n`;
        }
        if (message.fileType) {
            xmlContent += `  <fileType>${escapeXml(message.fileType)}</fileType>\n`;
        }
        if (message.fileUrl) {
            xmlContent += `  <fileUrl>${escapeXml(message.fileUrl)}</fileUrl>\n`;
        }
        if (message.fileSize) {
            xmlContent += `  <fileSize>${escapeXml(message.fileSize)}</fileSize>\n`;
        }
        if (message.duration) {
            xmlContent += `  <duration>${message.duration}</duration>\n`;
        }
        if (message.quote) {
            xmlContent += `  <quote>\n`;
            xmlContent += `    <username>${escapeXml(message.quote.username)}</username>\n`;
            xmlContent += `    <text>${escapeXml(message.quote.text)}</text>\n`;
            xmlContent += `    <isEncrypted>${message.quote.isEncrypted || false}</isEncrypted>\n`;
            xmlContent += `  </quote>\n`;
        }
        xmlContent += '</message>';
        fs.writeFileSync(messageFile, xmlContent, 'utf8');
        console.log(translate(config.language, 'SYSTEM_MESSAGE_SAVED') + ' ' + messageFile);
        return true;
    } catch (error) {
        console.error(translate(config.language, 'SYSTEM_MESSAGE_SAVE_ERROR'), error);
        return false;
    }
}