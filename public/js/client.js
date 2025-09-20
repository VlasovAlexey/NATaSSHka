document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
    });

    // Делаем сокет глобально доступным
    window.socket = socket;
    
    let currentUser = null;
    let currentRoom = null;
    let isReconnecting = false;
    let quotedMessage = null;
    let messageHistory = [];
    let encryptionDebounceDelay = 500;
    let debounceTimer = null;
    
    // Инициализация WebRTC менеджера после создания socket
    window.webrtcManager = new WebRTCManager(socket);
    
    // Глобальная переменная для кэширования расшифрованных файлов
    window.decryptedFilesCache = {};

    // Функция для преобразования Blob в base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Функция для преобразования base64 в Blob
    function base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], {type: mimeType});
    }

// Функция для расшифровки и отображения файла
window.decryptAndDisplayFile = async function(fileUrl, fileType, fileName, messageId, element) {
    try {
        console.log('Начало расшифровки файла:', fileName);
        
        // Показываем индикатор загрузки
        element.innerHTML = 'Загрузка и расшифровка...';
        
        // Проверяем кэш
        if (window.decryptedFilesCache[fileUrl]) {
            console.log('Файл найден в кэше:', fileName);
            const cacheEntry = window.decryptedFilesCache[fileUrl];
            
            // Проверяем, подходит ли текущий ключ для этого файла
            if (cacheEntry.encryptionKey === window.encryptionManager.encryptionKey) {
                if (cacheEntry.status === 'success') {
                    displayDecryptedFile(cacheEntry.blob, fileType, fileName, element);
                } else {
                    showDecryptionError(element, fileName);
                }
                return;
            } else {
                console.log('Ключ изменился, пробуем расшифровать заново');
                // Удаляем старую запись из кэша
                delete window.decryptedFilesCache[fileUrl];
            }
        }

        // Проверяем наличие ключа шифрования
        if (!window.encryptionManager.encryptionKey) {
            console.log('Дешифрование файла пропущено (нет ключа)');
            showDecryptionError(element, fileName);
            return;
        }

        // Загружаем файл с сервера
        console.log('Загрузка файла с сервера:', fileUrl);
        const response = await fetch(fileUrl);
        const encryptedBlob = await response.blob();
        
        // Преобразуем в base64
        console.log('Преобразование Blob в base64');
        const encryptedBase64 = await blobToBase64(encryptedBlob);
        
        // Расшифровываем
        console.log('Расшифровка файла');
        let decryptedBase64;
        try {
            decryptedBase64 = window.encryptionManager.decryptFile(encryptedBase64);
        } catch (error) {
            console.error('Ошибка дешифрования файла:', error);
            throw new Error('Неверный ключ шифрования');
        }
        
        // Проверяем, является ли результат валидным base64
        if (!isValidBase64(decryptedBase64)) {
            console.error('Результат дешифрования не является валидным base64');
            throw new Error('Неверный ключ шифрования');
        }
        
        // Преобразуем обратно в Blob
        console.log('Преобразование base64 в Blob');
        const decryptedBlob = base64ToBlob(decryptedBase64, fileType);
        
        // Проверяем, является ли Blob валидным
        if (decryptedBlob.size === 0) {
            console.error('Размер расшифрованного файла равен 0');
            throw new Error('Неверный ключ шифрования');
        }
        
        // Сохраняем в кэш
        console.log('Сохранение в кэш:', fileName);
        window.decryptedFilesCache[fileUrl] = {
            blob: decryptedBlob,
            status: 'success',
            encryptionKey: window.encryptionManager.encryptionKey
        };
        
        // Отображаем файл
        console.log('Отображение расшифрованного файла:', fileName);
        displayDecryptedFile(decryptedBlob, fileType, fileName, element);
        
    } catch (error) {
        console.error('Ошибка расшифровки файла:', error);
        
        // Сохраняем информацию об ошибке в кэш только если это ошибка ключа
        if (error.message.includes('Неверный ключ шифрования')) {
            window.decryptedFilesCache[fileUrl] = {
                status: 'error',
                encryptionKey: window.encryptionManager.encryptionKey,
                error: error.message
            };
        }
        
        showDecryptionError(element, fileName);
    }
};

// Функция для проверки валидности base64 строки
function isValidBase64(str) {
    try {
        // Проверяем, может ли строка быть корректно декодирована и закодирована обратно
        return btoa(atob(str)) === str;
    } catch (e) {
        return false;
    }
}

// Функция для отображения ошибки дешифрования
function showDecryptionError(element, fileName) {
    element.innerHTML = `
        <button class="encrypted-file-btn error">
            🔒 Ключ дешифрации не верный.
        </button>
        <div class="file-info">${fileName}</div>
    `;
}

// Функция для повторной попытки дешифрования
window.retryDecryption = function(element) {
    const messageFileElement = element.closest('.message-file');
    const encryptedBtn = messageFileElement.querySelector('.encrypted-file-btn');
    
    // Возвращаем исходное состояние
    encryptedBtn.innerHTML = '🔒 Файл зашифрован. Нажмите для расшифровки.';
    encryptedBtn.classList.remove('error');
    
    // Удаляем обработчик ошибок и возвращаем исходный
    encryptedBtn.onclick = function() {
        const fileUrl = this.dataset.fileUrl;
        const fileType = this.dataset.fileType;
        const fileName = this.dataset.fileName;
        const messageId = this.dataset.messageId;
        window.decryptAndDisplayFile(fileUrl, fileType, fileName, messageId, this);
    };
};

function displayDecryptedFile(blob, fileType, fileName, element) {
    const url = URL.createObjectURL(blob);
    
    if (fileType.startsWith('image/')) {
        element.innerHTML = `
            <img src="${url}" alt="${fileName}" onclick="expandImage('${url}', '${fileType}')">
            <div class="file-size">${(blob.size / 1024).toFixed(2)} KB</div>
        `;
    } else if (fileType.startsWith('video/')) {
        element.innerHTML = `
            <video src="${url}" controls muted onclick="expandVideoWithSound('${url}')">
                Ваш браузер не поддерживает видео.
            </video>
            <div class="file-size">${(blob.size / 1024).toFixed(2)} KB</div>
        `;
    } else if (fileType.startsWith('audio/')) {
        element.innerHTML = `
            <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${url}', this)">
                🔊
            </button>
            <span class="audio-duration">${(blob.size / 1024).toFixed(2)} KB</span>
        `;
    } else {
        element.innerHTML = `
            <a href="${url}" download="${fileName}">
                📄 ${fileName}
            </a>
            <div class="file-size">${(blob.size / 1024).toFixed(2)} KB</div>
        `;
    }
}

    // Элементы DOM
    const loginModal = document.getElementById('loginModal');
    const usernameInput = document.getElementById('usernameInput');
    const roomInput = document.getElementById('roomInput');
    const passwordInput = document.getElementById('passwordInput');
    const joinChatBtn = document.getElementById('joinChatBtn');
    const loginError = document.getElementById('loginError');
    const userInfo = document.getElementById('userInfo');
    const roomInfo = document.getElementById('roomInfo');
    const usersList = document.getElementById('usersList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const fileInput = document.getElementById('fileInput');
    const recordVideoBtn = document.getElementById('recordVideoBtn');
    const fullscreenImage = document.getElementById('fullscreenImage');
    const expandedImage = document.getElementById('expandedImage');
    const closeFullscreen = document.querySelector('.close-fullscreen');
    const chatTitle = document.getElementById('chatTitle');
    const encryptionKeyInput = document.getElementById('encryptionKeyInput');
    const clearEncryptionKeyBtn = document.getElementById('clearEncryptionKey');
    
    // Меняем текст кнопки отправки на символ
    if (sendMessageBtn) {
        sendMessageBtn.textContent = ' ↵ ';
        sendMessageBtn.title = 'Отправить сообщение';
    }
    
    // Функция для показа сообщений
    window.showMessage = function(title, text) {
        const messageModal = document.getElementById('messageModal');
        const messageModalTitle = document.getElementById('messageModalTitle');
        const messageModalText = document.getElementById('messageModalText');
        const messageModalOkBtn = document.getElementById('messageModalOkBtn');
        
        messageModalTitle.textContent = title;
        messageModalText.textContent = text;
        messageModal.classList.remove('hidden');
        
        // Обработчик для кнопки OK
        messageModalOkBtn.onclick = () => {
            messageModal.classList.add('hidden');
        };
        
        // Закрытие по клику вне модального окна
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) {
                messageModal.classList.add('hidden');
            }
        });
    };
    
    // Проверяем сохраненное имя пользователя
    const savedUsername = getCookie('chatUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
    
    // Показать модальное окно входа
    loginModal.classList.remove('hidden');
    
    // Обработка получения конфигурации RTC от сервера
    socket.on('rtc-config', (rtcConfig) => {
        window.rtcConfig = rtcConfig;
    });
    
    // Обработка получения конфигурации шифрования
    socket.on('config', (config) => {
        if (config.encryptionDebounceDelay) {
            encryptionDebounceDelay = config.encryptionDebounceDelay;
        }
    });
    
    // Обработка событий подключения/отключения
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        isReconnecting = false;
        
        // Если мы были подключены ранее, восстанавливаем сессию
        if (currentUser && currentRoom) {
            console.log('Восстановление сессии после переподключения...');
            socket.emit('user-join-attempt', {
                username: currentUser,
                room: currentRoom,
                password: localStorage.getItem('chatPassword') || 'pass'
            });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Отключено от сервера:', reason);
        isReconnecting = true;
        
        // Пытаемся переподключиться
        setTimeout(() => {
            if (isReconnecting) {
                console.log('Попытка переподключения...');
                socket.connect();
            }
        }, 2000);
    });

    // Обработка killall сообщения
    socket.on('killall-message', (message) => {
        // Очищаем чат и показываем сообщение
        messagesContainer.innerHTML = '';
        addMessageToChat(message);
        
        // Через 3 секунды показываем сообщение и перезагружаем страницу
        setTimeout(() => {
            showMessage('Информация', 'Сервер завершил работу. Страница будет перезагружена.');
            setTimeout(() => {
                location.reload();
            }, 2000);
        }, 3000);
    });
    
    // Подключение к чату
    joinChatBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const room = roomInput.value.trim() || 'Room_01';
        const password = passwordInput.value.trim();
        
        if (username && password) {
            // Сохраняем имя пользователя в cookie
            setCookie('chatUsername', username, 30);
            localStorage.setItem('chatPassword', password);
            socket.emit('user-join-attempt', { username, room, password });
        } else {
            showLoginError('Заполните все поля');
        }
    });
    
    // Обработка ошибки входа
    socket.on('join-error', (error) => {
        showLoginError(error);
    });
    
    function showLoginError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
    
    // Успешное подключение
    socket.on('user-joined', (data) => {
        currentUser = data.username;
        currentRoom = data.room;
        
        userInfo.textContent = currentUser;
        roomInfo.textContent = `Комната: ${currentRoom}`;
        chatTitle.textContent = `Чат комнаты: ${currentRoom}`;
        
        loginModal.classList.add('hidden');
        
        // Загружаем историю сообщений
        messagesContainer.innerHTML = '';
        messageHistory = data.messageHistory || [];
        messageHistory.forEach(message => addMessageToChat(message));
        
        // Добавляем кнопки звонков
        addCallButtons();
        
        // Инициализируем цитирование
        setupMessageQuoting();
        
        // Инициализируем обработчик ключа шифрования
        setupEncryptionKeyHandler();
    });
    
    // Обработка очистки чата
    socket.on('clear-chat', () => {
        messagesContainer.innerHTML = '';
        messageHistory = [];
        addSystemMessage('История чата была очищена');
    });
    
    // Обработка получения нового сообщения
    socket.on('new-message', (message) => {
        messageHistory.push(message);
        addMessageToChat(message);
    });
    
    // Добавление системного сообщения
    function addSystemMessage(text) {
        const message = {
            id: Date.now().toString(),
            username: 'Система',
            userId: 'system',
            text: text,
            timestamp: new Date(),
            isSystem: true
        };
        messageHistory.push(message);
        addMessageToChat(message);
    }
    
    // Добавление сообщения в чат
    function addMessageToChat(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.messageUsername = message.username;
        
        if (message.isSystem) {
            messageElement.classList.add('system-message');
        }
        
        if (message.isKillAll) {
            messageElement.classList.add('killall-message');
        }
        
        // Определяем, наше ли это сообщение
        const isMyMessage = message.userId === socket.id;
        if (!message.isSystem && !message.isKillAll) {
            messageElement.classList.add(isMyMessage ? 'my-message' : 'other-message');
        }
        
        // Форматируем время
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        let messageContent = `
            <div class="message-info">
                <span class="message-sender">${message.username}</span>
                <span class="message-time">${time}</span>
            </div>
        `;
        
        // Добавляем цитату, если она есть
        if (message.quote) {
            let quoteText = message.quote.text;
            let quoteUsername = message.quote.username;
            
            // Обрабатываем цитату (расшифровываем если нужно)
            if (message.quote.isEncrypted) {
                if (window.encryptionManager.encryptionKey) {
                    try {
                        quoteText = window.encryptionManager.decryptMessage(quoteText);
                    } catch (error) {
                        quoteText = "🔒 Неверный ключ шифрования";
                    }
                } else {
                    quoteText = "🔒 Неверный ключ шифрования";
                }
            }
            
            messageContent += `
                <div class="message-quote">
                    <div class="quote-username">${quoteUsername}</div>
                    <div class="quote-text">${quoteText}</div>
                </div>
            `;
        }
        
        // Обрабатываем текст сообщения (расшифровываем если нужно)
        let messageText = message.text;
        let isEncryptedMessage = message.isEncrypted;
        
        if (isEncryptedMessage) {
            if (window.encryptionManager.encryptionKey) {
                try {
                    messageText = window.encryptionManager.decryptMessage(messageText);
                } catch (error) {
                    messageText = "🔒 Неверный ключ шифрования";
                }
            } else {
                messageText = "🔒 Неверный ключ шифрования";
            }
        }
        
       if (message.isFile) {
        console.log('Отображение файла в чате:', message.fileName, 'Зашифрован:', message.isEncrypted);
        
        if (message.isEncrypted) {
            // Для зашифрованных файлов показываем placeholder
            messageContent += `
                <div class="message-file">
                    <button class="encrypted-file-btn" 
                            onclick="decryptAndDisplayFile('${message.fileUrl}', '${message.fileType}', '${message.fileName}', '${message.id}', this)"
                            data-file-url="${message.fileUrl}"
                            data-file-type="${message.fileType}"
                            data-file-name="${message.fileName}"
                            data-message-id="${message.id}">
                        🔒 Файл зашифрован. Нажмите для расшифровки.
                    </button>
                    <div class="file-info">${message.fileName} (${message.fileSize})</div>
                </div>
            `;
        } else {
                // Для незашифрованных файлов стандартное отображение
                if (message.isAudio) {
                    messageContent += `
                        <div class="message-audio">
                            <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${message.fileUrl}', this)">
                                🔊
                            </button>
                            <span class="audio-duration">${message.duration} сек • ${message.fileSize}</span>
                        </div>
                    `;
                } else if (message.fileType.startsWith('image/')) {
                    if (message.fileType === 'image/gif') {
                        messageContent += `
                            <div class="message-file">
                                <img src="${message.fileUrl}" alt="${message.fileName}" 
                                     onclick="expandImage('${message.fileUrl}', '${message.fileType}')">
                                <div class="file-size">${message.fileSize}</div>
                            </div>
                        `;
                    } else {
                        messageContent += `
                            <div class="message-file">
                                <img src="${message.fileUrl}" alt="${message.fileName}" 
                                     onclick="expandImage('${message.fileUrl}', '${message.fileType}')">
                                <div class="file-size">${message.fileSize}</div>
                            </div>
                        `;
                    }
                } else if (message.fileType.startsWith('video/')) {
                    messageContent += `
                        <div class="message-file">
                            <video src="${message.fileUrl}" controls muted 
                                   onclick="expandVideoWithSound('${message.fileUrl}')">
                                Ваш браузер не поддерживает видео.
                            </video>
                            <div class="file-size">${message.duration} сек • ${message.fileSize}</div>
                        </div>
                    `;
                } else {
                    messageContent += `
                        <div class="message-file">
                            <a href="${message.fileUrl}" download="${message.fileName}">
                                📄 ${message.fileName}
                            </a>
                            <div class="file-size">${message.fileSize}</div>
                        </div>
                    `;
                }
            }
        } else {
            // Если это текстовое сообщение
            messageContent += `<div class="message-text">${messageText}</div>`;
        }
        
        messageElement.innerHTML = messageContent;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Обработка списка пользователей
    socket.on('users-list', (users) => {
        usersList.innerHTML = '';
        users.forEach(user => {
            if (user.username !== currentUser) {
                const userElement = document.createElement('div');
                userElement.classList.add('user-item');
                userElement.textContent = user.username;
                usersList.appendChild(userElement);
            }
        });
    });
    
    // Пользователь присоединился к комнате
    socket.on('user-joined-room', (user) => {
        addSystemMessage(`Пользователь ${user.username} присоединился к комнате`);
    });
    
    // Пользователь вышел из комнате
    socket.on('user-left-room', (user) => {
        addSystemMessage(`Пользователь ${user.username} вышел из комнате`);
    });
    
    // Функция для расширения изображения
    window.expandImage = function(imageUrl, fileType) {
        // Очищаем контейнер
        expandedImage.innerHTML = '';
        
        if (fileType === 'image/gif') {
            // Для GIF используем img элемент для сохранения анимации
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Полноэкранное изображение';
            img.style.maxWidth = '90%';
            img.style.maxHeight = '90%';
            img.style.objectFit = 'contain';
            expandedImage.appendChild(img);
        } else {
            // Для других изображений
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Полноэкранное изображение';
            img.style.maxWidth = '90%';
            img.style.maxHeight = '90%';
            img.style.objectFit = 'contain';
            expandedImage.appendChild(img);
        }
        
        fullscreenImage.style.display = 'flex';
    };
    
    // Функция для расширения видео
    window.expandVideo = function(videoUrl) {
        // Очищаем контейнер
        expandedImage.innerHTML = '';
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.style.maxWidth = '90%';
        video.style.maxHeight = '90%';
        video.style.objectFit = 'contain';
        expandedImage.appendChild(video);
        fullscreenImage.style.display = 'flex';
        
        // Воспроизводим со звуком
        video.muted = false;
        video.play();
    };
    
    // Функция для открытия видео со звуком
    window.expandVideoWithSound = function(videoUrl) {
        // Очищаем контейнер
        expandedImage.innerHTML = '';
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.autoplay = true;
        video.style.maxWidth = '90%';
        video.style.maxHeight = '90%';
        video.style.objectFit = 'contain';
        expandedImage.appendChild(video);
        fullscreenImage.style.display = 'flex';
        
        // Воспроизводим со звуком
        video.muted = false;
        video.play();
    };
    
    // Закрытие полноэкранного изображения
    closeFullscreen.addEventListener('click', () => {
        fullscreenImage.style.display = 'none';
        
        // Останавливаем видео при закрытии
        const videoElement = expandedImage.querySelector('video');
        if (videoElement) {
            videoElement.pause();
        }
        
        // Не очищаем содержимое полностью, чтобы не прерывать анимацию GIF
        // При следующем открытии контент будет заменен
    });
    
    // Закрытие по клику вне изображения
    fullscreenImage.addEventListener('click', (e) => {
        if (e.target === fullscreenImage) {
            fullscreenImage.style.display = 'none';
            
            // Останавливаем видео при закрытии
            const videoElement = expandedImage.querySelector('video');
            if (videoElement) {
                videoElement.pause();
            }
        }
    });
    
    // Отправка сообщения по нажатию кнопки
    sendMessageBtn.addEventListener('click', sendMessage);
    
    // Отправка сообщения по нажатию Enter
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Добавляем обработчик события keypress для полей ввода в модальном окне
    usernameInput.addEventListener('keypress', handleEnterKeyPress);
    roomInput.addEventListener('keypress', handleEnterKeyPress);
    passwordInput.addEventListener('keypress', handleEnterKeyPress);

    function handleEnterKeyPress(e) {
        if (e.key === 'Enter') {
            joinChatBtn.click();
        }
    }
    
    // Отправка файла
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Проверяем размер файла (50 МБ)
        if (file.size > 50 * 1024 * 1024) {
            addSystemMessage(`Файл слишком большой. Максимальный размер: 50 МБ`);
            fileInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async function(event) {
            let fileData = event.target.result.split(',')[1];
            let isEncrypted = false;
            
            console.log('Обработка файла:', file.name, 'Размер:', file.size, 'Тип:', file.type);
            
            // Шифруем файл, если установлен ключ
            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                try {
                    console.log('Шифрование файла перед отправкой');
                    fileData = window.encryptionManager.encryptFile(fileData);
                    isEncrypted = true;
                    console.log('Файл успешно зашифрован');
                } catch (error) {
                    console.error('Ошибка шифрования файла:', error);
                }
            } else {
                console.log('Ключ шифрования не установлен, файл отправляется без шифрования');
            }
            
            // Отправляем файл с callback для обработки результата
            socket.emit('send-file', {
                fileName: file.name,
                fileType: file.type,
                fileData: fileData,
                isEncrypted: isEncrypted
            }, (response) => {
                if (response && response.error) {
                    console.error('Ошибка отправки файла:', response.error);
                    addSystemMessage(`Ошибка отправки файла ${file.name}: ${response.error}`);
                } else {
                    console.log('Файл успешно отправлен:', file.name);
                }
            });
        };
        
        reader.onerror = function() {
            console.error('Ошибка чтения файла:', file.name);
            addSystemMessage(`Ошибка чтения файла: ${file.name}`);
            fileInput.value = '';
        };
        
        reader.readAsDataURL(file);
        fileInput.value = '';
    });
    
    // Функция отправки сообщения
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            let messageData = { text };
            
            // Добавляем цитату, если есть
            if (quotedMessage) {
                messageData.quote = {
                    username: quotedMessage.username,
                    text: quotedMessage.text,
                    isEncrypted: false
                };
                
                // Шифруем цитату, если установлен ключ
                if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                    try {
                        messageData.quote.text = window.encryptionManager.encryptMessage(quotedMessage.text);
                        messageData.quote.isEncrypted = true;
                    } catch (error) {
                        console.error('Ошибка шифрования цитаты:', error);
                        messageData.quote.isEncrypted = false;
                    }
                }
            }
            
            // Шифруем основное сообщение, если установлен ключ
            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                try {
                    messageData.text = window.encryptionManager.encryptMessage(text);
                    messageData.isEncrypted = true;
                } catch (error) {
                    console.error('Ошибка шифрования:', error);
                    messageData.isEncrypted = false;
                }
            }
            
            socket.emit('send-message', messageData);
            messageInput.value = '';
            cancelQuote();
        }
    }
    
    // Функция для установки цитируемого сообщения
    function setQuotedMessage(messageElement, messageData) {
        // Снимаем выделение с предыдущего сообщения
        const previousQuoted = document.querySelector('.message.quoted');
        if (previousQuoted) {
            previousQuoted.classList.remove('quoted');
        }
        
        // Выделяем новое сообщение
        messageElement.classList.add('quoted');
        quotedMessage = {
            id: messageData.id,
            username: messageData.username,
            text: messageData.text
        };
        
        // Показываем блок цитаты
        showQuoteBlock();
    }
    
    // Функция для отображения блока цитаты
    function showQuoteBlock() {
        // Удаляем старый блок цитаты, если есть
        const oldQuoteBlock = document.querySelector('.quote-block');
        if (oldQuoteBlock) {
            oldQuoteBlock.remove();
        }
        
        // Создаем блок цитаты
        const quoteBlock = document.createElement('div');
        quoteBlock.className = 'quote-block';
        
        let quoteText = quotedMessage.text;
        let quoteUsername = quotedMessage.username;
        
        // Пытаемся расшифровать цитату, если она зашифрована
        if (window.encryptionManager && window.encryptionManager.encryptionKey) {
            try {
                quoteText = window.encryptionManager.decryptMessage(quoteText);
            } catch (error) {
                quoteText = "🔒 Неверный ключ шифрования";
            }
        } else {
            quoteText = "🔒 Неверный ключ шифрования";
        }
        
        quoteBlock.innerHTML = `
            <div class="quote-content">
                <div class="quote-username">${quoteUsername}</div>
                <div class="quote-text">${quoteText}</div>
            </div>
            <button class="cancel-quote">✕</button>
        `;
        
        // Добавляем блок цитаты перед поле ввода
        const messageInputContainer = document.querySelector('.message-input-container');
        messageInputContainer.parentNode.insertBefore(quoteBlock, messageInputContainer);
        
        // Обработчик для кнопки отмены цитирования
        quoteBlock.querySelector('.cancel-quote').addEventListener('click', () => {
            cancelQuote();
        });
    }
    
    // Функция для отмена цитирования
    function cancelQuote() {
        quotedMessage = null;
        const quoteBlock = document.querySelector('.quote-block');
        if (quoteBlock) {
            quoteBlock.remove();
        }
        
        const quotedElement = document.querySelector('.message.quoted');
        if (quotedElement) {
            quotedElement.classList.remove('quoted');
        }
    }
    
    // Настройка цитирования сообщений
    function setupMessageQuoting() {
        messagesContainer.addEventListener('click', (e) => {
            const messageElement = e.target.closest('.message');
            if (!messageElement || messageElement.classList.contains('system-message') || 
                messageElement.classList.contains('killall-message')) {
                return;
            }
            
            // Получаем данные сообщения из атрибутов
            const messageId = messageElement.dataset.messageId;
            const messageUsername = messageElement.dataset.messageUsername;
            const messageText = messageElement.querySelector('.message-text')?.textContent || '';
            
            setQuotedMessage(messageElement, {
                id: messageId,
                username: messageUsername,
                text: messageText
            });
        });
    }
    
    // Добавление кнопок звонков
    function addCallButtons() {
        const chatHeader = document.querySelector('.chat-header');
        
        // Удаляем старые кнопки, если есть
        const oldAudioBtn = document.getElementById('audioCallBtn');
        const oldVideoBtn = document.getElementById('videoCallBtn');
        if (oldAudioBtn) oldAudioBtn.remove();
        if (oldVideoBtn) oldVideoBtn.remove();
        
        // Создаем кнопку аудиозвонка
        const audioCallBtn = document.createElement('button');
        audioCallBtn.id = 'audioCallBtn';
        audioCallBtn.className = 'call-btn';
        audioCallBtn.innerHTML = '📞';
        audioCallBtn.title = 'Аудиозвонок';
        
        // Создаем кнопку видеозвонка
        const videoCallBtn = document.createElement('button');
        videoCallBtn.id = 'videoCallBtn';
        videoCallBtn.className = 'call-btn';
        videoCallBtn.innerHTML = '📹';
        videoCallBtn.title = 'Видеозвонок';
        
        // Добавляем кнопки в заголовок чата
        const callButtonsContainer = document.createElement('div');
        callButtonsContainer.className = 'call-buttons';
        callButtonsContainer.appendChild(audioCallBtn);
        callButtonsContainer.appendChild(videoCallBtn);
        
        chatHeader.appendChild(callButtonsContainer);
        
        // Обработчики для кнопок звонков
        audioCallBtn.addEventListener('click', () => {
            if (window.webrtcManager) {
                window.webrtcManager.showUserSelectionModal('audio');
            } else {
                console.error('WebRTCManager not initialized');
            }
        });
        
        videoCallBtn.addEventListener('click', () => {
            if (window.webrtcManager) {
                window.webrtcManager.showUserSelectionModal('video');
            } else {
                console.error('WebRTCManager not initialized');
            }
        });
    }
    
// Настройка обработчика ключа шифрования
function setupEncryptionKeyHandler() {
    if (!encryptionKeyInput) return;
    
    // Функция для обновления видимости кнопки очистки
    function updateClearButtonVisibility() {
        if (clearEncryptionKeyBtn) {
            if (encryptionKeyInput.value) {
                clearEncryptionKeyBtn.style.display = 'flex';
            } else {
                clearEncryptionKeyBtn.style.display = 'none';
            }
        }
    }
    
    // Инициализируем видимость кнопки
    updateClearButtonVisibility();
    
    encryptionKeyInput.addEventListener('input', (e) => {
        const key = e.target.value;
        if (window.encryptionManager) {
            window.encryptionManager.setEncryptionKey(key);
            
            // Очищаем кэш при изменении ключа
            window.decryptedFilesCache = {};
            
            // Обновляем видимость кнопки очистки
            updateClearButtonVisibility();
            
            // Обновляем все сообщения с зашифрованными файлами
            const encryptedFileButtons = document.querySelectorAll('.encrypted-file-btn.error');
            encryptedFileButtons.forEach(button => {
                button.classList.remove('error');
                button.textContent = '🔒 Файл зашифрован. Нажмите для расшифровки.';
                
                // Восстанавливаем обработчик клика
                const fileUrl = button.dataset.fileUrl;
                const fileType = button.dataset.fileType;
                const fileName = button.dataset.fileName;
                const messageId = button.dataset.messageId;
                
                button.onclick = function() {
                    window.decryptAndDisplayFile(fileUrl, fileType, fileName, messageId, this);
                };
            });
            
            // Debounce перерасшифровки сообщений
            if (window.encryptionManager.debounce) {
                window.encryptionManager.debounce(() => {
                    reDecryptAllMessages();
                }, encryptionDebounceDelay);
            } else {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    reDecryptAllMessages();
                }, encryptionDebounceDelay);
            }
        }
    });
    
    // Обработчик для кнопки очистки ключа
    if (clearEncryptionKeyBtn) {
        clearEncryptionKeyBtn.addEventListener('click', () => {
            encryptionKeyInput.value = '';
            if (window.encryptionManager) {
                window.encryptionManager.setEncryptionKey('');
            }
            
            // Очищаем кэш
            window.decryptedFilesCache = {};
            
            // Скрываем кнопку очистки
            updateClearButtonVisibility();
            
            // Обновляем все сообщения с зашифрованными файлами
            const encryptedFileButtons = document.querySelectorAll('.encrypted-file-btn.error');
            encryptedFileButtons.forEach(button => {
                button.classList.remove('error');
                button.textContent = '🔒 Файл зашифрован. Нажмите для расшифровки.';
                
                // Восстанавливаем обработчик клика
                const fileUrl = button.dataset.fileUrl;
                const fileType = button.dataset.fileType;
                const fileName = button.dataset.fileName;
                const messageId = button.dataset.messageId;
                
                button.onclick = function() {
                    window.decryptAndDisplayFile(fileUrl, fileType, fileName, messageId, this);
                };
            });
            
            // Немедленно обновляем все сообщения
            reDecryptAllMessages();
        });
    }
}
    // Функция для перерасшифровки всех сообщений
    function reDecryptAllMessages() {
        messagesContainer.innerHTML = '';
        messageHistory.forEach(message => {
            addMessageToChat(message);
        });
    }
});