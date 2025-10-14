﻿document.addEventListener('DOMContentLoaded', () => {
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
	let shouldAutoScroll = true; // Флаг для управления авто-прокруткой

	// Инициализация WebRTC менеджера после создания socket
	window.webrtcManager = new WebRTCManager(socket);

	// Глобальная переменная для кэширования расшифрованных файлов
	window.decryptedFilesCache = {};

	// Обработка получения конфигурации ICE серверов от сервера
	socket.on('stun-config', (iceServers) => {
		console.log('Получены ICE серверы:', iceServers);
		if (!window.rtcConfig) {
			window.rtcConfig = {};
		}
		window.rtcConfig.iceServers = iceServers;
	});

	// Обработка получения конфигурации RTC от сервера
	socket.on('rtc-config', (rtcConfig) => {
		window.rtcConfig = {
			...window.rtcConfig,
			...rtcConfig
		};
		console.log('Полная конфигурация RTC:', window.rtcConfig);

		// Скрываем кнопки звонков если TURN серверы отключены
		toggleCallButtons(rtcConfig.useTurnServers);
	});

	function toggleCallButtons(useTurnServers) {
		const audioCallBtn = document.getElementById('audioCallBtn');
		const videoCallBtn = document.getElementById('videoCallBtn');
		const callButtonsContainer = document.querySelector('.call-buttons-container');

		if (!useTurnServers) {
			if (audioCallBtn) audioCallBtn.style.display = 'none';
			if (videoCallBtn) videoCallBtn.style.display = 'none';
			if (callButtonsContainer) callButtonsContainer.style.display = 'none';
		} else {
			if (audioCallBtn) audioCallBtn.style.display = 'flex';
			if (videoCallBtn) videoCallBtn.style.display = 'flex';
			if (callButtonsContainer) callButtonsContainer.style.display = 'flex';
		}
	}
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
		return new Blob([byteArray], {
			type: mimeType
		});
	}

	// Функция для расшифровки и отображения файла
window.decryptAndDisplayFile = async function(fileUrl, fileType, fileName, messageId, buttonElement) {
    try {
        console.log('Начало расшифровки файла:', fileName);

        // Сохраняем контейнер ДО изменения DOM
        const messageFileElement = buttonElement.closest('.message-file');
        if (!messageFileElement) {
            console.error('Не найден контейнер для файла');
            return;
        }

        // Показываем индикатор загрузки
        messageFileElement.innerHTML = 'Загрузка и расшифровка...';

        // Проверяем кэш
        if (window.decryptedFilesCache[fileUrl]) {
            console.log('Файл найден в кэше:', fileName);
            const cacheEntry = window.decryptedFilesCache[fileUrl];

            // Проверяем, подходит ли текущий ключ для этого файла
            if (cacheEntry.encryptionKey === window.encryptionManager.encryptionKey) {
                if (cacheEntry.status === 'success') {
                    displayDecryptedFile(cacheEntry.blob, fileType, fileName, messageFileElement);
                } else {
                    showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
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
            showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
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
        displayDecryptedFile(decryptedBlob, fileType, fileName, messageFileElement);

    } catch (error) {
        console.error('Ошибка расшифровки файла:', error);

        // Сохраняем контейнер для показа ошибки
        const messageFileElement = buttonElement.closest('.message-file');
        if (!messageFileElement) {
            console.error('Не найден контейнер для файла при ошибке');
            return;
        }

        // Сохраняем информацию об ошибке в кэш только если это ошибка ключа
        if (error.message.includes('Неверный ключ шифрования')) {
            window.decryptedFilesCache[fileUrl] = {
                status: 'error',
                encryptionKey: window.encryptionManager.encryptionKey,
                error: error.message
            };
        }

        showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
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
function showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId) {
    messageFileElement.innerHTML = `
        <button class="encrypted-file-btn error" 
                onclick="decryptAndDisplayFile('${fileUrl}', '${fileType}', '${fileName}', '${messageId}', this)"
                data-file-url="${fileUrl}"
                data-file-type="${fileType}"
                data-file-name="${fileName}"
                data-message-id="${messageId}">
            🔒 Ключ дешифрации не верный.
        </button>
        <div class="file-info">${fileName}</div>
    `;
}

	// Функция для отображения расшифрованного файла
function displayDecryptedFile(blob, fileType, fileName, messageFileElement) {
    const url = URL.createObjectURL(blob);
    const fileSize = (blob.size / 1024).toFixed(2);

    if (fileType.startsWith('image/')) {
        messageFileElement.innerHTML = `
            <img src="${url}" alt="${fileName}" 
                 onclick="console.log('🖼️ Клик по расшифрованному изображению:', '${url}'); window.expandImage('${url}', '${fileType}')">
            <div class="file-size">${fileSize} KB</div>
        `;
    } else if (fileType.startsWith('video/')) {
        messageFileElement.innerHTML = `
            <video src="${url}" controls muted 
                   onclick="console.log('🎥 Клик по расшифрованному видео:', '${url}'); window.expandVideoWithSound('${url}')">
                Ваш браузер не поддерживает видео.
            </video>
            <div class="file-size">${fileSize} KB</div>
        `;
    } else if (fileType.startsWith('audio/')) {
        messageFileElement.innerHTML = `
            <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${url}', this)">
                🔊
            </button>
            <span class="audio-duration">${fileSize} KB</span>
        `;
    } else {
        messageFileElement.innerHTML = `
            <a href="${url}" download="${fileName}">
                📄 ${fileName}
            </a>
            <div class="file-size">${fileSize} KB</div>
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
	const encryptionKeyInput = document.getElementById('encryptionKeyInput');
	const clearEncryptionKeyBtn = document.getElementById('clearEncryptionKey');
	const messageInputContainer = document.querySelector('.message-input-container');

	// Элементы для модального окна изображений
	const imageModal = document.getElementById('imageModal');
	const modalImage = document.getElementById('modalImage');

	// Элементы для модального окна видео
	const videoModal = document.getElementById('videoModal');
	const modalVideo = document.getElementById('modalVideo');

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

	// Валидация ввода имени пользователя и комнаты
	function validateInput(input) {
		const regex = /^[a-zA-Z0-9_-]{1,64}$/;
		return regex.test(input);
	}

	// Подключение к чату
	joinChatBtn.addEventListener('click', () => {
		const username = usernameInput.value.trim();
		const room = roomInput.value.trim() || 'Room_01';
		const password = passwordInput.value.trim();

		if (!validateInput(username)) {
			showLoginError('Имя пользователя может содержать только латинские буквы, цифры, дефис и нижнее подчеркивание (макс. 64 символа)');
			return;
		}

		if (!validateInput(room)) {
			showLoginError('Название комнаты может содержать только латинские буквы, цифры, дефис и нижнее подчеркивание (макс. 64 символа)');
			return;
		}

		if (username && password) {
			// Сохраняем имя пользователя в cookie
			setCookie('chatUsername', username, 30);
			localStorage.setItem('chatPassword', password);
			socket.emit('user-join-attempt', {
				username,
				room,
				password
			});
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

    // Устанавливаем глобальную переменную для комнаты
    window.currentRoom = currentRoom;

    if (userInfo) userInfo.textContent = '✪ ' + currentUser;
    if (roomInfo) roomInfo.textContent = `Комната: ${currentRoom}`;

    loginModal.classList.add('hidden');

    // Загружаем историю сообщений
    messagesContainer.innerHTML = '';
    messageHistory = data.messageHistory || [];

    // Инициализируем глобальное хранилище для данных о пользователях реакций
    if (!window.reactionUsersData) {
        window.reactionUsersData = new Map();
    }

    // Загружаем данные о пользователях реакций из истории
    if (data.reactionUsersData) {
        Object.entries(data.reactionUsersData).forEach(([messageId, usersData]) => {
            window.reactionUsersData.set(messageId, usersData);
        });
    }

    // Включаем авто-прокрутку при входе в комнату
    shouldAutoScroll = true;
    messageHistory.forEach(message => addMessageToChat(message));

    // Добавляем кнопки звонков (с проверкой TURN серверов)
    addCallButtons();

    // Проверяем состояние TURN серверов и скрываем кнопки если нужно
    if (window.rtcConfig) {
        toggleCallButtons(window.rtcConfig.useTurnServers);
    }

    // Инициализируем цитирование
    setupMessageQuoting();

    // Инициализируем обработчик ключа шифрования
    setupEncryptionKeyHandler();

    // Инициализируем переключение sidebar
    setupSidebarToggle();

    // Инициализируем модальные окна
    setupImageModal();
    setupVideoModal();

    // Обновляем состояние каретки
    updateButtonStates();
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

// Обработка обновления сообщения (например, при добавлении реакции)
socket.on('message-updated', (message) => {
    // Обновляем сообщение в истории
    const messageIndex = messageHistory.findIndex(msg => msg.id === message.id);
    if (messageIndex !== -1) {
        messageHistory[messageIndex] = message;
    }
    
    // Обновляем отображение сообщения
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (messageElement) {
        updateMessageReactions(messageElement, message);
    }
});

	// Добавление системного сообщения
	function addSystemMessage(text) {
		const message = {
			id: Date.now().toString(),
			username: 'system',
			userId: 'system',
			text: text,
			timestamp: new Date(),
			isSystem: true
		};
		messageHistory.push(message);
		addMessageToChat(message);
	}

	// Функция для прокрутки вниз
	function scrollToBottom() {
		if (shouldAutoScroll) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
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

    // Добавляем класс для предупреждающих сообщений
    if (message.isWarning) {
        messageElement.classList.add('warning-message');
    }

    if (message.isFile || message.isAudio) {
        messageElement.dataset.hasFile = 'true';
    }

    // Определяем, наше ли это сообщение
    const isMyMessage = message.userId === socket.id;
    if (!message.isSystem && !message.isKillAll && !message.isWarning) {
		if (window.reactionsManager) {
        window.reactionsManager.addReactionButton(messageElement);
        window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
        
        // Сохраняем информацию о пользователях реакций при загрузке истории
        if (message.reactions && Object.keys(message.reactions).length > 0) {
            if (!window.reactionUsersData) {
                window.reactionUsersData = new Map();
            }
            // Здесь можно добавить логику для загрузки пользователей реакций из истории
        }
    }
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
            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
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
        if (window.encryptionManager && window.encryptionManager.encryptionKey) {
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
                messageContent += `
                    <div class="message-file">
                        <img src="${message.fileUrl}" alt="${message.fileName}" 
                             onclick="console.log('🖼️ Клик по изображению в чате:', '${message.fileUrl}'); window.expandImage('${message.fileUrl}', '${message.fileType}')">
                        <div class="file-size">${message.fileSize}</div>
                    </div>
                `;
            } else if (message.fileType.startsWith('video/')) {
                messageContent += `
                    <div class="message-file">
                        <video src="${message.fileUrl}" controls muted 
                               onclick="window.expandVideoWithSound('${message.fileUrl}', this)">
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

    // Добавляем кнопку реакции и отображаем существующие реакции
    if (!message.isSystem && !message.isKillAll && !message.isWarning) {
        if (window.reactionsManager) {
            window.reactionsManager.addReactionButton(messageElement);
            window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
            
            // Инициализируем данные о пользователях реакций для этого сообщения
            if (message.reactions && Object.keys(message.reactions).length > 0) {
                // Если у сообщения есть реакции, но нет данных о пользователях в глобальном хранилище,
                // пытаемся найти их в загруженных данных истории
                if (!window.reactionUsersData.has(message.id)) {
                    // Можно попробовать найти данные в message.reactionUsers, если они были загружены из XML
                    // Для этого нужно обновить функцию loadMessagesFromRoom на сервере
                }
            }
        }
    }

    // Прокручиваем только если включена авто-прокрутка
    scrollToBottom();
}

// Функция для обновления реакций сообщения
function updateMessageReactions(messageElement, message) {
    if (window.reactionsManager) {
        window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
    }
}

// Обработка обновления реакций
socket.on('reactions-updated', (data) => {
    const { messageId, reactions, reactionUsers } = data;
    
    // Сохраняем информацию о пользователях реакций в глобальное хранилище
    if (!window.reactionUsersData) {
        window.reactionUsersData = new Map();
    }
    window.reactionUsersData.set(messageId, reactionUsers);
    
    // Обновляем отображение реакций
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement && window.reactionsManager) {
        window.reactionsManager.updateMessageReactions(messageElement, reactions);
    }
});
	// Обработка списка пользователей
	socket.on('users-list', (users) => {
		usersList.innerHTML = '';
		users.forEach(user => {
			const userElement = document.createElement('div');
			userElement.classList.add('user-item');
			// Добавляем символ перед именем пользователя
			userElement.textContent = user.username;
			usersList.appendChild(userElement);
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

	// Новая функция для открытия изображения в модальном окне
	window.expandImage = function(imageUrl, fileType) {
		console.log('🖼️ expandImage вызвана:', {
			imageUrl,
			fileType
		});

		// Если модальное окно уже открыто, закрываем его
		if (imageModal.classList.contains('active')) {
			closeImageModal();
			return;
		}

		if (!imageModal || !modalImage) {
			console.error('❌ Элементы модального окна изображения не найдены');
			return;
		}

		console.log('✅ Элементы модального окна найдены');

		// Показываем модальное окно
		imageModal.classList.add('active');

		// Устанавливаем источник изображения
		modalImage.src = imageUrl;
		modalImage.alt = 'Увеличенное изображение';

		// Обработчик успешной загрузки
		modalImage.onload = function() {
			console.log('✅ Изображение успешно загружено');
		};

		// Обработчик ошибки загрузки
		modalImage.onerror = function() {
			console.error('❌ Ошибка загрузки изображения:', imageUrl);
			modalImage.alt = 'Ошибка загрузки изображения';
			modalImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iMC4zNWVtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE4Ij7QndC10YI8L3RleHQ+PC9zdmc+';
		};
	};

	// Функция для закрытия модального окна изображения
	function closeImageModal() {
		console.log('🔄 Закрываем модальное окно изображения...');

		if (!imageModal || !modalImage) {
			console.error('❌ Элементы модального окна изображения не найдены при закрытии');
			return;
		}

		// Сначала убираем обработчики
		modalImage.onload = null;
		modalImage.onerror = null;

		// Скрываем модальное окно с анимацией
		imageModal.classList.remove('active');

		// Добавляем проверку на существование imageModalDebug
		if (window.imageModalDebug) {
			window.imageModalDebug.modalState = 'closing';
		}

		// Через время анимации очищаем источник
		setTimeout(() => {
			modalImage.src = '';
			console.log('✅ Модальное окно изображения закрыто');

			// Добавляем проверку на существование imageModalDebug
			if (window.imageModalDebug) {
				window.imageModalDebug.modalState = 'closed';
			}
		}, 300);
	}

	// Функция для открытия видео в модальном окне
	window.expandVideoWithSound = function(videoUrl, chatVideoElement = null) {
		console.log('🎥 expandVideoWithSound вызвана:', videoUrl);

		// Определяем, это мобильное устройство или десктоп
		const isMobile = window.innerWidth <= 770;
		console.log('📱 Это мобильное устройство:', isMobile);

		// Ставим на паузу видео в чате, если оно передано и воспроизводится
		if (chatVideoElement && !chatVideoElement.paused) {
			console.log('⏸️ Ставим видео в чате на паузу');
			chatVideoElement.pause();
			window.pausedChatVideo = chatVideoElement;
		}


		// Обновляем отладочную информацию
		window.videoModalDebug = window.videoModalDebug || {
			openAttempts: 0,
			lastVideoUrl: '',
			modalState: 'unknown'
		};

		window.videoModalDebug.openAttempts++;
		window.videoModalDebug.lastVideoUrl = videoUrl;

		if (!videoModal) {
			console.error('❌ videoModal не найден в DOM');
			window.videoModalDebug.modalState = 'not_found';
			return;
		}

		if (!modalVideo) {
			console.error('❌ modalVideo не найден в DOM');
			window.videoModalDebug.modalState = 'video_not_found';
			return;
		}

		console.log('✅ Элементы модального окна видео найдены');

		// Сначала показываем модальное окно
		console.log('🔄 Показываем модальное окно видео...');
		videoModal.classList.add('active');
		window.videoModalDebug.modalState = 'opening';

		// Устанавливаем источник видео ПОСЛЕ показа модального окна
		setTimeout(() => {
			// Безопасная установка источника
			if (modalVideo.src) {
				URL.revokeObjectURL(modalVideo.src);
			}

			modalVideo.src = videoUrl;
			modalVideo.controls = true;
			modalVideo.muted = false;

			// Обработчик успешной загрузки
			modalVideo.onloadeddata = function() {
				console.log('✅ Видео успешно загружено');
				window.videoModalDebug.modalState = 'video_loaded';

				// Пытаемся воспроизвести видео
				modalVideo.play().then(() => {
					console.log('✅ Видео воспроизводится');
				}).catch(error => {
					console.warn('⚠️ Автовоспроизведение заблокировано:', error);
					// Пользователь сможет нажать play вручную
				});
			};

			// Обработчик ошибки загрузки - БЕЗ вывода в консоль при закрытии
			modalVideo.onerror = function(e) {
				// Проверяем, не вызвана ли ошибка из-за закрытия модального окна
				if (!videoModal.classList.contains('active')) {
					console.log('⚠️ Ошибка загрузки видео проигнорирована (модальное окно закрыто)');
					return;
				}

				console.error('❌ Ошибка загрузки видео:', videoUrl, e);
				window.videoModalDebug.modalState = 'video_load_error';

				// Показываем сообщение об ошибке только если модальное окно открыто
				if (videoModal.classList.contains('active')) {
					modalVideo.controls = false;
					modalVideo.poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iMC4zNWVtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjE0Ij7QktC40LTQtdC+INC90LUg0LTQvtC00L7QvNC10YAg0LTQvtCx0YDQtdGC0L7QsiDQtNC+0YHRgtC+0LfQstC+0Lk8L3RleHQ+PC9zdmc+';
				}
			};

			// Обработчик закрытия модального окна при окончании видео
			modalVideo.onended = function() {
				console.log('✅ Видео завершено');
				// Не закрываем автоматически, пусть пользователь сам закроет
			};
		}, 10);

		// Проверяем через небольшой таймаут
		setTimeout(() => {
			if (videoModal.classList.contains('active')) {
				console.log('✅ Модальное окно видео успешно открыто');
				window.videoModalDebug.modalState = 'opened';
			} else {
				console.error('❌ Модальное окно видео не открылось');
				window.videoModalDebug.modalState = 'failed_to_open';
			}
		}, 100);
	};

	// Функция для ограничения размера медиа-файлов
	function adjustMediaSize() {
		const messagesContainer = document.getElementById('messagesContainer');
		if (!messagesContainer) return;

		const containerHeight = messagesContainer.clientHeight;
		const maxMediaHeight = containerHeight * 0.9; // 90% от высоты контейнера
		const minMediaHeight = 200; // Минимальная высота для маленьких изображений

		const mediaElements = messagesContainer.querySelectorAll('.message-file img, .message-file video');

		mediaElements.forEach(media => {
			const messageFile = media.closest('.message-file');
			if (!messageFile) return;

			// Получаем естественные размеры медиа
			const naturalHeight = media.naturalHeight || media.videoHeight;
			const naturalWidth = media.naturalWidth || media.videoWidth;

			if (!naturalHeight || !naturalWidth) {
				// Если размеры еще не загружены, ждем загрузки
				media.onload = function() {
					adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight);
				};
				return;
			}

			adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight);
		});
	}

	// Функция для настройки размера отдельного медиа-файла
	function adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight) {
		const messageFile = media.closest('.message-file');
		const naturalHeight = media.naturalHeight || media.videoHeight;
		const naturalWidth = media.naturalWidth || media.videoWidth;

		if (!naturalHeight || !naturalWidth) return;

		const aspectRatio = naturalWidth / naturalHeight;

		// Определяем, нужно ли ограничивать размер
		if (naturalHeight > maxMediaHeight) {
			// Высота слишком большая - ограничиваем и корректируем ширину
			messageFile.classList.add('media-large');
			media.style.maxHeight = `${maxMediaHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';

			// Рассчитываем ширину на основе пропорций
			const calculatedWidth = maxMediaHeight * aspectRatio;
			if (calculatedWidth > media.parentElement.clientWidth) {
				media.style.width = '100%';
				media.style.height = 'auto';
			}
		} else if (naturalHeight > minMediaHeight) {
			// Средний размер - используем естественные пропорции
			messageFile.classList.remove('media-large');
			media.style.maxHeight = `${naturalHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';
		} else {
			// Маленькое изображение - стандартное отображение
			messageFile.classList.remove('media-large');
			media.style.maxHeight = `${minMediaHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';
		}
	}

	// Функция для пересчета размеров при изменении окна
	function handleMediaResize() {
		clearTimeout(window.mediaResizeTimeout);
		window.mediaResizeTimeout = setTimeout(() => {
			adjustMediaSize();
		}, 100);
	}

	// Функция для закрытия модального окна видео
	function closeVideoModal() {
		console.log('🔄 Закрываем модальное окно видео...');

		if (!videoModal || !modalVideo) {
			console.error('❌ Элементы модального окна видео не найдены при закрытии');
			return;
		}

		// Сначала останавливаем видео и снимаем обработчики
		modalVideo.pause();
		modalVideo.currentTime = 0;

		// Убираем все обработчики событий
		modalVideo.onloadeddata = null;
		modalVideo.onerror = null;
		modalVideo.onended = null;

		// Скрываем модальное окно с анимацией
		videoModal.classList.remove('active');
		window.videoModalDebug.modalState = 'closing';

		// Через время анимации очищаем источник БЕЗ вызова ошибки
		setTimeout(() => {
			// Используем безопасный метод очистки источника
			if (modalVideo.src) {
				URL.revokeObjectURL(modalVideo.src);
				modalVideo.removeAttribute('src');
				modalVideo.load(); // Безопасная перезагрузка
			}
			modalVideo.controls = false;
			modalVideo.poster = '';
			console.log('✅ Модальное окно видео закрыто');
			window.videoModalDebug.modalState = 'closed';
		}, 300);
	}

	// Инициализация обработчиков событий для модального окна изображений
	function setupImageModal() {
		console.log('🔄 Инициализация модального окна для изображений...');

		if (!imageModal) {
			console.error('❌ imageModal не найден для инициализации');
			return;
		}

		if (!modalImage) {
			console.error('❌ modalImage не найден для инициализации');
			return;
		}

		console.log('✅ Элементы модального окна изображений найдены для инициализации');

		// Находим кнопку закрытия
		const imageCloseBtn = imageModal.querySelector('.image-close-btn');

		// Обработчик для кнопки закрытия
		if (imageCloseBtn) {
			imageCloseBtn.addEventListener('click', (e) => {
				console.log('🖱️ Клик по кнопке закрытия изображения');
				closeImageModal();
				e.stopPropagation();
			});
		}

		// Закрытие по клику на overlay (любая область вокруг изображения)
		const imageOverlay = imageModal.querySelector('.image-modal-overlay');
		if (imageOverlay) {
			imageOverlay.addEventListener('click', (e) => {
				console.log('🖱️ Клик по overlay изображения');
				closeImageModal();
			});
		}

		// Закрытие по клику на само изображение
		modalImage.addEventListener('click', (e) => {
			console.log('🖱️ Клик по изображению в модальном окне');
			closeImageModal();
			e.stopPropagation();
		});

		// Закрытие по нажатию Escape
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && imageModal.classList.contains('active')) {
				console.log('⌨️ Нажата клавиша Escape, закрываем модальное окно изображения');
				closeImageModal();
			}
		});

		console.log('✅ Модальное окно для изображений инициализировано');
	}




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

	function setupVideoModal() {
		console.log('🔄 Инициализация модального окна для видео...');

		if (!videoModal) {
			console.error('❌ videoModal не найден для инициализации');
			return;
		}

		if (!modalVideo) {
			console.error('❌ modalVideo не найден для инициализации');
			return;
		}

		console.log('✅ Элементы модального окна видео найдены для инициализации');

		// Находим overlay и кнопку закрытия
		const videoOverlay = videoModal.querySelector('.video-modal-overlay');
		const videoCloseBtn = videoModal.querySelector('.video-close-btn');

		// Закрытие по клику на overlay
		if (videoOverlay) {
			videoOverlay.addEventListener('click', (e) => {
				console.log('🖱️ Клик по overlay видео');
				closeVideoModal();
			});
		}

		// Закрытие по клику на кнопку закрытия
		if (videoCloseBtn) {
			videoCloseBtn.addEventListener('click', (e) => {
				console.log('🖱️ Клик по кнопке закрытия видео');
				e.stopPropagation();
				closeVideoModal();
			});
		} else {
			console.error('❌ Кнопка закрытия видео не найдена!');
			// Создаем кнопку закрытия программно, если она не найдена
			const closeBtn = document.createElement('button');
			closeBtn.className = 'video-close-btn';
			closeBtn.innerHTML = '×';
			closeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				closeVideoModal();
			});

			const videoContent = videoModal.querySelector('.video-modal-content');
			if (videoContent) {
				videoContent.appendChild(closeBtn);
				console.log('✅ Кнопка закрытия видео создана программно');
			}
		}

		// Предотвращаем закрытие при клике на само видео или элементы управления
		modalVideo.addEventListener('click', (e) => {
			console.log('🖱️ Клик по видео - предотвращаем закрытие');
			e.stopPropagation();

			// На мобильных устройствах переключаем воспроизведение по клику
			if (window.innerWidth <= 770) {
				if (modalVideo.paused) {
					modalVideo.play().catch(console.error);
				} else {
					modalVideo.pause();
				}
			}
		});

		// Обработка жестов на мобильных устройствах
		let startY = 0;
		modalVideo.addEventListener('touchstart', (e) => {
			startY = e.touches[0].clientY;
		});

		modalVideo.addEventListener('touchmove', (e) => {
			// Предотвращаем закрытие при вертикальном скролле
			if (Math.abs(e.touches[0].clientY - startY) > 10) {
				e.stopPropagation();
			}
		});

		// Закрытие по нажатию Escape
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && videoModal.classList.contains('active')) {
				console.log('⌨️ Нажата клавиша Escape, закрываем модальное окно видео');
				closeVideoModal();
			}
		});

		// Обработчик окончания видео
		modalVideo.onended = function() {
			console.log('✅ Видео завершено');
		};

		// Автоматический полноэкранный режим для мобильных при начале воспроизведения
		modalVideo.addEventListener('play', function() {
			if (window.innerWidth <= 770 && this.webkitEnterFullscreen) {
				// Для iOS - пытаемся войти в полноэкранный режим
				try {
					this.webkitEnterFullscreen();
				} catch (error) {
					console.log('Автоматический полноэкранный режим не поддерживается');
				}
			}
		});

		console.log('✅ Модальное окно для видео инициализировано');
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
			let messageData = {
				text
			};

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

			// Очищаем поле ввода через анимации
			if (window.clearMessageInput) {
				window.clearMessageInput();
			} else {
				messageInput.value = '';
				// Принудительно обновляем состояние
				if (window.messageInputAnimations) {
					window.messageInputAnimations.updateButtonStates();
				}
			}

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
			text: messageData.text,
			originalMessage: messageData.originalMessage
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

		// Обрабатываем текст цитаты в зависимости от шифрования
		if (quotedMessage.originalMessage.isEncrypted) {
			if (window.encryptionManager && window.encryptionManager.encryptionKey) {
				try {
					// Пытаемся расшифровать оригинальный зашифрованный текст
					quoteText = window.encryptionManager.decryptMessage(quotedMessage.originalMessage.text);
				} catch (error) {
					quoteText = "🔒 Неверный ключ шифрования";
				}
			} else {
				quoteText = "🔒 Неверный ключ шифрования";
			}
		} else {
			// Для незашифрованных сообщений используем оригинальный текст
			quoteText = quotedMessage.originalMessage.text;
		}

		// Обрезаем длинный текст цитаты
		if (quoteText.length > 100) {
			quoteText = quoteText.substring(0, 100) + '...';
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
			if (!messageElement ||
				messageElement.classList.contains('system-message') ||
				messageElement.classList.contains('killall-message')) {
				return;
			}

			// Проверяем, является ли сообщение текстовым (не содержит файлов)
			const hasFile = messageElement.querySelector('.message-file, .message-audio');
			if (hasFile) {
				console.log('Цитирование файловых сообщений не поддерживается');
				return;
			}

			// Получаем данные сообщения
			const messageId = messageElement.dataset.messageId;
			const messageUsername = messageElement.dataset.messageUsername;
			const messageTextElement = messageElement.querySelector('.message-text');

			if (!messageTextElement) {
				console.log('Текстовое сообщение не найдено');
				return;
			}

			let messageText = messageTextElement.textContent;

			// Получаем оригинальное сообщение из истории
			const originalMessage = messageHistory.find(msg => msg.id === messageId);
			if (!originalMessage) {
				console.log('Оригинальное сообщение не найдено в истории');
				return;
			}

			setQuotedMessage(messageElement, {
				id: messageId,
				username: messageUsername,
				text: messageText,
				originalMessage: originalMessage
			});
		});
	}
	// Добавление кнопок звонков
	function addCallButtons() {
		const callButtonsContainer = document.querySelector('.call-buttons-container');

		if (!callButtonsContainer) {
			console.error('Контейнер для кнопок звонков не найден');
			return;
		}

		// Очищаем контейнер
		callButtonsContainer.innerHTML = '';

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

		// Добавляем кнопки в контейнер
		callButtonsContainer.appendChild(audioCallBtn);
		callButtonsContainer.appendChild(videoCallBtn);

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

				// Отключаем авто-прокрутку при дешифрации
				shouldAutoScroll = false;

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

				// Отключаем авто-прокрутку при дешифрации
				shouldAutoScroll = false;

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
		 // ВКЛЮЧАЕМ авто-прокрутку после перерасшифровки всех сообщений
    	shouldAutoScroll = true;
	}

	// Функции для управления sidebar
	function setupSidebarToggle() {
		const showSidebarBtn = document.getElementById('showSidebarBtn');
		const hideSidebarBtn = document.getElementById('hideSidebarBtn');
		const sidebar = document.querySelector('.sidebar');

		// Создаем overlay для затемнения фона
		const overlay = document.createElement('div');
		overlay.className = 'sidebar-overlay';
		document.body.appendChild(overlay);

		// Убедимся, что overlay находится ПОД sidebar в DOM
		// Перемещаем overlay перед sidebar в иерархии
		if (sidebar && sidebar.parentNode) {
			sidebar.parentNode.insertBefore(overlay, sidebar);
		}

		// Показать sidebar
		showSidebarBtn.addEventListener('click', () => {
			sidebar.classList.add('active');
			overlay.classList.add('active');

			// Убедимся, что sidebar выше overlay
			setTimeout(() => {
				if (sidebar.style.zIndex !== '1002') {
					sidebar.style.zIndex = '1002';
				}
				if (overlay.style.zIndex !== '1001') {
					overlay.style.zIndex = '1001';
				}
			}, 10);
		});

		// Скрыть sidebar
		hideSidebarBtn.addEventListener('click', () => {
			sidebar.classList.remove('active');
			overlay.classList.remove('active');
		});

		// Скрыть sidebar при клике на overlay
		overlay.addEventListener('click', () => {
			sidebar.classList.remove('active');
			overlay.classList.remove('active');
		});

		// Обработка изменения ориентации экрана
		window.addEventListener('resize', handleOrientationChange);
		handleOrientationChange(); // Инициализация при загрузке
	}
	// Обработка изменения ориентации экрана
	function handleOrientationChange() {
		const sidebar = document.querySelector('.sidebar');
		const overlay = document.querySelector('.sidebar-overlay');
		const showSidebarBtn = document.getElementById('showSidebarBtn');
		const hideSidebarBtn = document.getElementById('hideSidebarBtn');

		// Если перешли в ландшафтный режим - показываем sidebar автоматически
		if (window.innerWidth > window.innerHeight) {
			sidebar.classList.remove('active');
			if (overlay) overlay.classList.remove('active');
			if (showSidebarBtn) showSidebarBtn.classList.add('hidden');
			if (hideSidebarBtn) hideSidebarBtn.classList.add('hidden');
		} else {
			// Портретный режим - скрываем sidebar по умолчанию
			sidebar.classList.remove('active');
			if (overlay) overlay.classList.remove('active');
			if (showSidebarBtn) showSidebarBtn.classList.remove('hidden');
			if (hideSidebarBtn) hideSidebarBtn.classList.remove('hidden');
		}
	}

	// Функция для обновления состояния каретки
	function updateButtonStates() {
		if (!messageInputContainer) return;

		const hasText = messageInput.value.trim().length > 0;
		messageInputContainer.classList.toggle('has-text', hasText);

		// Обновляем видимость каретки
		if (window.messageInputAnimations) {
			window.messageInputAnimations.updateButtonStates();
		}
	}

	// Добавляем обработчик изменения текста
	if (messageInput) {
		messageInput.addEventListener('input', updateButtonStates);
	}

	// Обработчик изменения ориентации экрана для видео
	window.addEventListener('orientationchange', function() {
		if (videoModal && videoModal.classList.contains('active')) {
			// При смене ориентации перезагружаем видео для корректного отображения
			setTimeout(() => {
				if (modalVideo && modalVideo.src) {
					const currentTime = modalVideo.currentTime;
					modalVideo.load();
					modalVideo.currentTime = currentTime;
					modalVideo.play().catch(console.error);
				}
			}, 300);
		}
	});

	// Обработчик изменения размера окна
	window.addEventListener('resize', function() {
		if (videoModal && videoModal.classList.contains('active')) {
			console.log('🔄 Изменение размера окна, обновляем видео');
		}
	});

	// Инициализация при загрузке
	setTimeout(() => {
		updateButtonStates();
	}, 100);
});


// Обработчик изменения высоты viewport на мобильных устройствах
function handleViewportResize() {
	const appContainer = document.querySelector('.app-container');
	const chatContainer = document.querySelector('.chat-container');

	if (!appContainer || !chatContainer) return;

	// Устанавливаем высоту с учетом безопасных зон
	const visualViewport = window.visualViewport || window;
	const height = visualViewport.height;

	appContainer.style.height = height + 'px';
	chatContainer.style.height = height + 'px';

	// Прокручиваем к последнему сообщению только если включена авто-прокрутка
	const messagesContainer = document.getElementById('messagesContainer');
	if (messagesContainer && window.shouldAutoScroll) {
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}
}

// Обработчики событий
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', handleViewportResize);

// iOS специфичные обработчики
if (window.visualViewport) {
	window.visualViewport.addEventListener('resize', handleViewportResize);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
	setTimeout(handleViewportResize, 100);
	setTimeout(handleViewportResize, 500); // Двойная проверка
});

// Также обновляем при показе/скрытии клавиатуры
document.addEventListener('focusin', () => {
	setTimeout(handleViewportResize, 300);
});

document.addEventListener('focusout', () => {
	setTimeout(handleViewportResize, 300);
});