const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const users = new Map();
const rooms = new Set(['Room_01']);
const messageReactions = new Map();
const reactionUsers = new Map();
const configPath = path.join(__dirname, 'config.json');
let config = {
	port: 3000,
	password: 'pass',
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
	killCode: 'kill',
	killAllCode: 'killall',
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
	videoRec_mimeType: 'video/webm;codecs=vp9'
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
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir, {
	index: false,
	redirect: false
}));

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
		console.log(`Сообщение сохранено: ${messageFile}`);
		return true;
	} catch (error) {
		console.error('Ошибка сохранения сообщения в файл:', error);
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
						console.error('Ошибка чтения файла сообщения:', messageFile, error);
					}
				});
			}
		});
		messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
	} catch (error) {
		console.error('Ошибка загрузки сообщений комнаты:', room, error);
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
		console.log(`Метаданные файла сохранены: ${metadataFile}`);
		return true;
	} catch (error) {
		console.error('Ошибка сохранения метаданных файла:', error);
		return false;
	}
}

function getIceServers() {
	const iceServers = [...config.stunServers];
	if (config.useTurnServers && config.turnServers && config.turnServers.length > 0) {
		console.log('='.repeat(60));
		console.log('TURN СЕРВЕРЫ: АКТИВИРОВАНЫ');
		console.log('='.repeat(60));
		config.turnServers.forEach((server, index) => {
			console.log(`TURN сервер ${index + 1}:`);
			console.log(`  URL: ${server.urls}`);
			console.log(`  Имя пользователя: ${server.username}`);
			console.log(`  Пароль: ${server.credential ? '***' + server.credential.slice(-3) : 'не указан'}`);
			if (!server.urls) {
				console.error('  ❌ ОШИБКА: отсутствует URL TURN сервера');
			} else {
				const protocols = ['turn:', 'turns:', 'stun:'];
				const hasValidProtocol = protocols.some(proto => server.urls.includes(proto));
				if (!hasValidProtocol) {
					console.error('  ❌ ОШИБКА: неверный протокол в URL. Допустимы: turn:, turns:, stun:');
				}
			}
			if (!server.username || !server.credential) {
				console.error('  ❌ ОШИБКА: отсутствуют учетные данные TURN сервера');
			} else {
				console.log('  ✅ Учетные данные присутствуют');
			}
			const portMatch = server.urls.match(/:(\d+)/);
			if (portMatch) {
				const port = parseInt(portMatch[1]);
				console.log(`  Порт: ${port}`);
				if (port < 1 || port > 65535) {
					console.error('  ❌ ОШИБКА: неверный номер порта');
				} else if (port < 1024) {
					console.warn('  ⚠️  ВНИМАНИЕ: порт < 1024 может требовать прав администратора');
				}
			}
			console.log('  ---');
		});
		console.log(`Всего TURN серверов: ${config.turnServers.length}`);
		console.log('='.repeat(60));
		iceServers.push(...config.turnServers);
	} else {
		console.log('='.repeat(60));
		console.log('TURN СЕРВЕРЫ: ОТКЛЮЧЕНЫ');
		console.log('='.repeat(60));
		console.log('⚠️  WebRTC соединения могут не работать через NAT/firewall');
		if (!config.turnServers || config.turnServers.length === 0) {
			console.log('ℹ️  TURN серверы не настроены в config.json');
		} else if (!config.useTurnServers) {
			console.log('ℹ️  TURN серверы отключены в настройках (useTurnServers: false)');
		}
		console.log('='.repeat(60));
	}
	return iceServers;
}

io.on('connection', (socket) => {
	console.log('Новое подключение:', socket.id);
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

	socket.on('delete-message', (data, callback) => {
		const user = users.get(socket.id);
		if (user) {
			const {
				messageId
			} = data;
			console.log(`Пользователь ${user.username} запросил удаление сообщения ${messageId} в комнате ${user.room}`);
			const userDir = path.join(uploadsDir, user.room, user.username);
			const messageFile = path.join(userDir, `${messageId}.xml`);
			if (!fs.existsSync(messageFile)) {
				console.log(`Сообщение ${messageId} не найдено для пользователя ${user.username}`);
				if (callback) callback({
					error: 'Сообщение не найдено'
				});
				return;
			}
			try {
				const fileContent = fs.readFileSync(messageFile, 'utf8');
				const usernameMatch = fileContent.match(/<username>(.*?)<\/username>/);
				if (usernameMatch && usernameMatch[1] === user.username) {
					const deleteResult = deleteMessageFromFiles(user.room, messageId, user.username);
					if (deleteResult) {
						io.to(user.room).emit('message-deleted', {
							messageId
						});
						console.log(`Пользователь ${user.username} успешно удалил сообщение ${messageId}`);
						if (callback) callback({
							success: true
						});
					} else {
						console.error(`Не удалось удалить файлы сообщения ${messageId}`);
						if (callback) callback({
							error: 'Не удалось удалить файлы сообщения'
						});
					}
				} else {
					console.log(`Попытка удалить чужое сообщение: ${user.username} пытается удалить сообщение ${usernameMatch ? usernameMatch[1] : 'неизвестного пользователя'}`);
					if (callback) callback({
						error: 'Нельзя удалять чужие сообщения'
					});
				}
			} catch (readError) {
				console.error('Ошибка чтения XML файла сообщения:', readError);
				if (callback) callback({
					error: 'Ошибка при проверке сообщения'
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
				console.log(`Директория пользователя не найдена: ${userDir}`);
				return false;
			}
			console.log(`Начинаем удаление файлов сообщения ${messageId} пользователя ${username} в комнате ${room}`);
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
					console.log(`Найдено fileUrls в XML:`, fileUrls);
					fs.unlinkSync(messageFile);
					console.log(`Удален XML файл сообщения: ${messageFile}`);
				} catch (readError) {
					console.error('Ошибка чтения XML файла:', readError);
					if (fs.existsSync(messageFile)) {
						fs.unlinkSync(messageFile);
					}
				}
			} else {
				console.log(`XML файл сообщения не найден: ${messageFile}`);
			}
			fileUrls.forEach(fileUrl => {
				try {
					if (fileUrl && fileUrl.startsWith('/uploads/')) {
						const fileName = fileUrl.split('/').pop();
						if (fileName) {
							const filePath = path.join(userDir, fileName);
							if (fs.existsSync(filePath)) {
								fs.unlinkSync(filePath);
								console.log(`Удален файл: ${filePath}`);
							}
						}
					}
				} catch (fileError) {
					console.error(`Ошибка удаления файла ${fileUrl}:`, fileError);
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
								console.log(`Удален связанный файл: ${filePath}`);
							}
						}
					} catch (error) {
						console.error(`Ошибка удаления связанного файла ${filePath}:`, error);
					}
				}
			});
			console.log(`Завершено удаление файлов сообщения ${messageId}`);
			return true;
		} catch (error) {
			console.error('Общая ошибка удаления файлов сообщения:', error);
			return false;
		}
	}

	socket.on('add-reaction', (data) => {
		const user = users.get(socket.id);
		if (user) {
			const {
				messageId,
				reactionCode
			} = data;
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
				console.log(`Пользователь ${username} добавил реакцию ${reactionCode} к сообщению ${messageId}`);
			} else {
				console.log(`Пользователь ${username} уже ставил реакцию ${reactionCode} для сообщения ${messageId}`);
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
						console.log(`Реакции обновлены в файле: ${messageFile}`);
						return true;
					}
				}
			}
		} catch (error) {
			console.error('Ошибка обновления реакций в файле:', error);
		}
		return false;
	}

	socket.on('user-join-attempt', (data) => {
		if (data.password !== config.password) {
			socket.emit('join-error', 'Неверный пароль');
			return;
		}
		const {
			username,
			room
		} = data;
		const existingUser = Array.from(users.values()).find(user =>
			user.username === username && user.room === room
		);
		if (existingUser) {
			socket.emit('join-error', 'Пользователь с таким именем уже существует в этой комнате');
			const warningMessage = {
				id: Date.now().toString(),
				username: 'system',
				userId: 'system',
				text: `Внимание! Попытка входа ${username} под уже вошедшим пользователем с другого устройства!`,
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
			text: `Пользователь ${username} присоединился к комнате`,
			timestamp: new Date(),
			room: room,
			isSystem: true
		};
		/*
		saveSystemMessageToFile(room, joinMessage);
		socket.to(room).emit('new-message', joinMessage);
		*/
		const roomUsers = Array.from(users.values()).filter(user => user.room === room);
		io.to(room).emit('users-list', roomUsers);
		console.log(`Пользователь ${username} вошел в комнату ${room}`);
	});

	socket.on('disconnect', (reason) => {
		const user = users.get(socket.id);
		if (user) {
			console.log(`Пользователь ${user.username} вышел из комнаты ${user.room}. Причина: ${reason}`);
			const leaveMessage = {
				id: Date.now().toString(),
				username: 'system',
				userId: 'system',
				text: `Пользователь ${user.username} вышел из комнаты`,
				timestamp: new Date(),
				room: user.room,
				isSystem: true
			};
			/*
			saveSystemMessageToFile(user.room, leaveMessage);
			socket.to(user.room).emit('new-message', leaveMessage);
			*/
			users.delete(socket.id);
			const roomUsers = Array.from(users.values()).filter(u => u.room === user.room);
			io.to(user.room).emit('users-list', roomUsers);
		}
	});

	socket.on('send-message', (data) => {
		const user = users.get(socket.id);
		if (user) {
			if (data.text === config.killCode) {
				const roomDir = path.join(uploadsDir, user.room);
				if (fs.existsSync(roomDir)) {
					fs.rmSync(roomDir, {
						recursive: true,
						force: true
					});
					console.log(`Удалена папка комнаты ${user.room} по команде kill`);
				}
				const clearMessage = {
					id: Date.now().toString(),
					username: 'system',
					userId: 'system',
					text: `История чата была очищена пользователем ${user.username}`,
					timestamp: new Date(),
					room: user.room,
					isSystem: true
				};
				saveSystemMessageToFile(user.room, clearMessage);
				io.to(user.room).emit('clear-chat');
				io.to(user.room).emit('new-message', clearMessage);
				console.log(`Пользователь ${user.username} очистил чат комнаты ${user.room} и удалил файлы`);
				return;
			}
			if (data.text === config.killAllCode) {
				console.log(`Пользователь ${user.username} активировал killall команду`);
				const killAllMessage = {
					id: Date.now().toString(),
					username: 'system',
					userId: 'system',
					text: 'The tower has fallen!',
					timestamp: new Date(),
					isSystem: true,
					isKillAll: true
				};
				saveSystemMessageToFile(user.room, killAllMessage);
				if (fs.existsSync(uploadsDir)) {
					fs.rmSync(uploadsDir, {
						recursive: true,
						force: true
					});
					console.log('Удалена папка uploads со всем содержимым');
				}
				fs.mkdirSync(uploadsDir, {
					recursive: true
				});
				io.emit('killall-message', killAllMessage);
				setTimeout(() => {
					console.log('Сервер завершает работу по команде killall');
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
				console.log(`Сообщение сохранено в файл: ${user.room}/${user.username}/${message.id}.xml`);
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
		if (data.fileData.length * 0.75 > config.maxFileSize) {
			const errorMsg = `Файл слишком большой. Максимальный размер: ${config.maxFileSize / (1024 * 1024)} МБ`;
			if (callback) callback({
				error: errorMsg
			});
			const errorMessage = {
				id: Date.now().toString(),
				username: 'Система',
				userId: 'system',
				text: `Не удалось отправить файл ${data.fileName}: ${errorMsg}`,
				timestamp: new Date(),
				room: user.room,
				isSystem: true
			};
			socket.emit('new-message', errorMessage);
			return;
		}
		const fileExt = data.fileName.split('.').pop();
		const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
		const roomDir = path.join(uploadsDir, user.room);
		const userDir = path.join(roomDir, user.username);
		ensureDirectoryExistence(userDir);
		const filePath = path.join(userDir, uniqueFileName);
		const fileUrl = `/uploads/${user.room}/${user.username}/${uniqueFileName}`;
		fs.writeFile(filePath, data.fileData, 'base64', (err) => {
			if (err) {
				console.error('Ошибка сохранения файла:', err);
				if (callback) callback({
					error: 'Ошибка сохранения файла'
				});
				const errorMessage = {
					id: Date.now().toString(),
					username: 'Система',
					userId: 'system',
					text: `Не удалось отправить файл ${data.fileName}: Ошибка сохранения`,
					timestamp: new Date(),
					room: user.room,
					isSystem: true
				};
				socket.emit('new-message', errorMessage);
				return;
			}
			console.log(`Файл сохранен: ${filePath}`);
			const isAudio = data.fileType.startsWith('audio/');
			const isVideo = data.fileType.startsWith('video/');
			let fileSizeDisplay, duration;
			if (isAudio || isVideo) {
				fileSizeDisplay = data.fileSize ? `${data.fileSize} КБ` : '0 КБ';
				duration = data.duration || 0;
			} else {
				const fileSizeMB = (data.fileData.length * 0.75 / (1024 * 1024)).toFixed(2);
				fileSizeDisplay = `${fileSizeMB} МБ`;
				duration = 0;
			}
			const message = {
				id: Date.now().toString(),
				username: user.username,
				userId: socket.id,
				fileName: data.fileName,
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
				console.log(`Сообщение о файле сохранено: ${user.room}/${user.username}/${message.id}.xml`);
			}
			saveFileMetadata(user.room, user.username, uniqueFileName, {
				fileName: data.fileName,
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
		console.log('Получено аудиосообщение от пользователя:', socket.id);
		const user = users.get(socket.id);
		if (!user) {
			if (callback) callback({
				error: 'Пользователь не авторизован'
			});
			return;
		}
		console.log('Размер аудиоданных:', data.audioData.length, 'байт');
		const fileExt = data.fileName.split('.').pop();
		const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
		const roomDir = path.join(uploadsDir, user.room);
		const userDir = path.join(roomDir, user.username);
		ensureDirectoryExistence(userDir);
		const filePath = path.join(userDir, uniqueFileName);
		const fileUrl = `/uploads/${user.room}/${user.username}/${uniqueFileName}`;
		fs.writeFile(filePath, data.audioData, 'base64', (err) => {
			if (err) {
				console.error('Ошибка сохранения аудиофайла:', err);
				if (callback) callback({
					error: 'Ошибка сохранения аудиофайла'
				});
				return;
			}
			console.log('Аудиофайл сохранен:', filePath);
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
				console.log(`Сообщение о аудиофайле сохранено: ${user.room}/${user.username}/${message.id}.xml`);
			}
			saveFileMetadata(user.room, user.username, uniqueFileName, {
				fileName: data.fileName,
				fileType: data.fileType,
				fileUrl: fileUrl,
				fileSize: `${(data.audioData.length * 0.75 / 1024).toFixed(2)} КБ`,
				duration: data.duration,
				isEncrypted: data.isEncrypted || false
			});
			io.to(user.room).emit('new-message', message);
			console.log('Аудиосообщение отправлено в комнату:', user.room);
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
					reason: data.reason || 'Звонок отклонен'
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
			console.log(`Пользователь ${user.username} вышел из комнаты ${user.room}. Причина: ${reason}`);
			//socket.to(user.room).emit('user-left-room', user);
			users.delete(socket.id);
			const roomUsers = Array.from(users.values()).filter(u => u.room === user.room);
			io.to(user.room).emit('users-list', roomUsers);
		}
	});
});

const PORT = config.port;
server.listen(PORT, () => {
	console.log('='.repeat(60));
	console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ: ${PORT}`);
	console.log('='.repeat(60));
	const net = require('net');
	const tester = net.createServer();
	tester.once('error', (err) => {
		if (err.code === 'EADDRINUSE') {
			console.error(`❌ ОШИБКА: Порт ${PORT} уже занят!`);
			console.error('   Возможные решения:');
			console.error('   1. Измените порт в config.json');
			console.error('   2. Закройте другое приложение, использующее этот порт');
			console.error('   3. Подождите несколько секунд и попробуйте снова');
		}
	});
	tester.once('listening', () => {
		tester.close();
		console.log(`✅ Порт ${PORT} доступен для использования`);
	});
	console.log(`📁 Максимальный размер файла: ${config.maxFileSize / (1024 * 1024)} МБ`);
	console.log(`💾 Сообщения и файлы сохраняются в: ${uploadsDir}`);
	console.log(`🔧 Использование TURN серверов: ${config.useTurnServers ? 'ВКЛЮЧЕНО' : 'ОТКЛЮЧЕНО'}`);
	const iceServers = getIceServers();
	console.log(`🌐 Всего ICE серверов: ${iceServers.length}`);
	console.log('='.repeat(60));
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
		console.log(`Системное сообщение сохранено: ${messageFile}`);
		return true;
	} catch (error) {
		console.error('Ошибка сохранения системного сообщения в файл:', error);
		return false;
	}
}