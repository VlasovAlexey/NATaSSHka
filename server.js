const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Загрузка конфигурации
const configPath = path.join(__dirname, 'config.json');
let config = {
  port: 3000,
  password: 'pass',
  stunServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
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
  config = { ...config, ...JSON.parse(configData) };
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

// Папка для загружаемых файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Хранилище для пользователей, сообщений и комнат
const users = new Map();
const messages = new Map();
const rooms = new Set(['Room_01']);

// Обработка подключений Socket.io
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  // Отправляем конфигурацию STUN серверов клиенту
  socket.emit('stun-config', config.stunServers);
  socket.emit('rtc-config', {
    video: config.rtc_video,
    audio: config.rtc_audio,
    videoRec: {
      width: config.videoRec_width,
      height: config.videoRec_height,
      frameRate: config.videoRec_frameRate,
      bitrate: config.videoRec_bitrate,
      mimeType: config.videoRec_mimeType
    }
  });
  
  // Обработка входа пользователя
  socket.on('user-join-attempt', (data) => {
    if (data.password !== config.password) {
      socket.emit('join-error', 'Неверный пароль');
      return;
    }
    
    const { username, room } = data;
    
    if (!rooms.has(room)) {
      rooms.add(room);
      messages.set(room, []);
    }
    
    users.set(socket.id, { username, id: socket.id, room });
    socket.join(room);
    
    socket.emit('user-joined', {
      username,
      room,
      messageHistory: messages.get(room) || []
    });
    
    socket.to(room).emit('user-joined-room', { username, id: socket.id });
    
    const roomUsers = Array.from(users.values()).filter(user => user.room === room);
    io.to(room).emit('users-list', roomUsers);
    
    console.log(`Пользователь ${username} вошел в комнату ${room}`);
  });
  
  // Обработка текстовых сообщений
 socket.on('send-message', (data) => {
  const user = users.get(socket.id);
  if (user) {
    // Проверка на кодовое слово "kill"
    if (data.text === config.killCode) {
      // Получаем все сообщения комнаты
      const roomMessages = messages.get(user.room) || [];
      
      // Собираем все файлы из сообщений комнаты
      const filesToDelete = roomMessages
        .filter(msg => msg.isFile && msg.fileUrl)
        .map(msg => {
          // Извлекаем имя файла из URL
          const urlParts = msg.fileUrl.split('/');
          return urlParts[urlParts.length - 1];
        });

      // Удаляем каждый файл
      filesToDelete.forEach(fileName => {
        const filePath = path.join(uploadsDir, fileName);
        fs.unlink(filePath, (err) => {
          if (err) {
            // Если файла нет, или другая ошибка - просто логируем
            console.log(`Файл ${fileName} не найден или ошибка удаления:`, err.message);
          } else {
            console.log(`Файл ${fileName} удален`);
          }
        });
      });

      // Очищаем историю сообщений комнаты
      messages.set(user.room, []);
      io.to(user.room).emit('clear-chat');
      console.log(`Пользователь ${user.username} очистил чат комнаты ${user.room} и удалил файлы`);
      return;
    }
      
      // Проверка на кодовое слово "killall"
      if (data.text === config.killAllCode) {
        console.log(`Пользователь ${user.username} активировал killall команду`);
        
        // Удаляем все файлы из директории uploads
        fs.readdir(uploadsDir, (err, files) => {
          if (err) {
            console.error('Ошибка чтения директории uploads:', err);
            return;
          }
          
          let deletedCount = 0;
          files.forEach(file => {
            fs.unlink(path.join(uploadsDir, file), err => {
              if (err) {
                console.error(`Ошибка удаления файла ${file}:`, err);
              } else {
                deletedCount++;
                console.log(`Удален файл: ${file}`);
              }
            });
          });
          
          console.log(`Удалено файлов: ${deletedCount}`);
        });
        
        // Очищаем историю всех чатов
        messages.clear();
        rooms.forEach(room => {
          messages.set(room, []);
        });
        
        // Отправляем сообщение всем пользователям
        const killAllMessage = {
          id: Date.now().toString(),
          username: 'СИСТЕМА',
          userId: 'system',
          text: 'The tower has fallen!',
          timestamp: new Date(),
          isSystem: true,
          isKillAll: true
        };
        
        io.emit('killall-message', killAllMessage);
        
        // Завершаем работу сервера через 3 секунды
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
      isEncrypted: data.isEncrypted || false // Добавляем флаг шифрования
    };
      
      if (!messages.has(user.room)) {
        messages.set(user.room, []);
      }
      messages.get(user.room).push(message);
      
      io.to(user.room).emit('new-message', message);
    }
  });
  
  // Обработка файлов
  socket.on('send-file', (data, callback) => {
    const user = users.get(socket.id);
    if (!user) {
        if (callback) callback({ error: 'Пользователь не авторизован' });
        return;
    }
    
    // Проверяем размер файла
    if (data.fileData.length * 0.75 > config.maxFileSize) {
        const errorMsg = `Файл слишком большой. Максимальный размер: ${config.maxFileSize / (1024 * 1024)} МБ`;
        if (callback) callback({ error: errorMsg });
        
        // Отправляем сообщение об ошибке в чат
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
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Сохраняем файл (уже зашифрованный, если клиент его зашифровал)
    fs.writeFile(filePath, data.fileData, 'base64', (err) => {
        if (err) {
            console.error('Ошибка сохранения файла:', err);
            if (callback) callback({ error: 'Ошибка сохранения файла' });
            
            // Отправляем сообщение об ошибке в чат
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
        
        // Для аудио и видео файлов используем переданные длительность и размер
        const isAudio = data.fileType.startsWith('audio/');
        const isVideo = data.fileType.startsWith('video/');
        let fileSizeDisplay, duration;
        
        if (isAudio || isVideo) {
            // Для аудио и видео используем переданные значения
            fileSizeDisplay = data.fileSize ? `${data.fileSize} КБ` : '0 КБ';
            duration = data.duration || 0;
        } else {
            // Для других файлов вычисляем размер
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
            fileUrl: `/uploads/${uniqueFileName}`,
            fileSize: fileSizeDisplay,
            duration: duration,
            timestamp: new Date(),
            isFile: true,
            isAudio: isAudio,
            isEncrypted: data.isEncrypted || false, // Добавляем флаг шифрования
            room: user.room
        };
        
        if (!messages.has(user.room)) {
            messages.set(user.room, []);
        }
        messages.get(user.room).push(message);
        
        io.to(user.room).emit('new-message', message);
        if (callback) callback({ success: true });
    });
  });
  
  // Обработка аудиосообщений
  socket.on('send-audio', (data, callback) => {
    console.log('Получено аудиосообщение от пользователя:', socket.id);
    const user = users.get(socket.id);
    if (!user) {
        if (callback) callback({ error: 'Пользователь не авторизован' });
        return;
    }
    
    console.log('Размер аудиоданных:', data.audioData.length, 'байт');
    
    const fileExt = data.fileName.split('.').pop();
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Сохраняем аудиофайл
    fs.writeFile(filePath, data.audioData, 'base64', (err) => {
        if (err) {
            console.error('Ошибка сохранения аудиофайла:', err);
            if (callback) callback({ error: 'Ошибка сохранения аудиофайла' });
            return;
        }
        
        console.log('Аудиофайл сохранен:', uniqueFileName);
        
        const message = {
            id: Date.now().toString(),
            username: user.username,
            userId: socket.id,
            fileName: data.fileName,
            fileType: data.fileType,
            fileUrl: `/uploads/${uniqueFileName}`,
            duration: data.duration,
            timestamp: new Date(),
            isFile: true,
            isAudio: true,
            isEncrypted: data.isEncrypted || false, // Добавляем флаг шифрования
            room: user.room
        };
        
        if (!messages.has(user.room)) {
            messages.set(user.room, []);
        }
        messages.get(user.room).push(message);
        
        io.to(user.room).emit('new-message', message);
        console.log('Аудиосообщение отправлено в комнату:', user.room);
        
        if (callback) callback({ success: true });
    });
  });
  
  // WebRTC сигналы
  socket.on('webrtc-offer', (data) => {
    const user = users.get(socket.id);
    if (user) {
      // Находим целевого пользователя по имени
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
      // Находим целевого пользователя по имени
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
      // Находим целевого пользователя по имени
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
      // Находим целевого пользователя по имени
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
      // Находим целевого пользователя по имени
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
  
  // Обработка отключения пользователя
  socket.on('disconnect', (reason) => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`Пользователь ${user.username} вышел из комнаты ${user.room}. Причина: ${reason}`);
      socket.to(user.room).emit('user-left-room', user);
      users.delete(socket.id);
      
      const roomUsers = Array.from(users.values()).filter(u => u.room === user.room);
      io.to(user.room).emit('users-list', roomUsers);
    }
  });
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Максимальный размер файла: ${config.maxFileSize / (1024 * 1024)} МБ`);
});