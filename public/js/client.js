﻿document.addEventListener('DOMContentLoaded', () => {
	const socket = io({
		transports: ['websocket', 'polling'],
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
		reconnectionAttempts: Infinity
	});
	window.socket = socket;
	let currentUser = null;
	let currentRoom = null;
	let isReconnecting = false;
	let quotedMessage = null;
	let messageHistory = [];
	let encryptionDebounceDelay = 500;
	let debounceTimer = null;
	let shouldAutoScroll = true;
	window.webrtcManager = new WebRTCManager(socket);
	window.decryptedFilesCache = {};
	socket.on('stun-config', (iceServers) => {
		console.log('Получены ICE серверы:', iceServers);
		if (!window.rtcConfig) {
			window.rtcConfig = {};
		}
		window.rtcConfig.iceServers = iceServers;
	});
	socket.on('rtc-config', (rtcConfig) => {
		window.rtcConfig = {
			...window.rtcConfig,
			...rtcConfig
		};
		console.log('Полная конфигурация RTC:', window.rtcConfig);
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
	let pushConfig = {
		enabled: true,
		displayTime: 7000,
		autoCloseDelay: 5000,
		playSound: true
	};
	let notificationPermission = null;
	let notificationSound = null;

	function initializePushNotifications() {
		if (!('Notification' in window)) {
			console.log('Браузер не поддерживает уведомления');
			return;
		}
		if (Notification.permission === 'default') {
			requestNotificationPermission();
		} else {
			notificationPermission = Notification.permission;
		}
		if (pushConfig.playSound) {
			notificationSound = new Audio(pushConfig.soundFile || '/sounds/notification.mp3');
			notificationSound.preload = 'auto';
		}
		console.log('Уведомления инициализированы, разрешение:', notificationPermission);
	}

	function requestNotificationPermission() {
		Notification.requestPermission().then(permission => {
			notificationPermission = permission;
			console.log('Разрешение на уведомления:', permission);
			if (permission === 'granted') {
				showTestNotification();
			}
		});
	}

	function showTestNotification() {
		if (notificationPermission === 'granted') {
			const notification = new Notification('NATaSSHka - Уведомления включены', {
				body: 'Вы будете получать уведомления о новых сообщениях',
				icon: '/icons/icon-192x192.png',
				tag: 'test-notification'
			});
			setTimeout(() => {
				notification.close();
			}, 3000);
		}
	}

	function showMessageNotification(message) {
		if (!pushConfig.enabled || notificationPermission !== 'granted') {
			return;
		}
		if (message.userId === socket.id) {
			return;
		}
		if (message.isSystem || message.isKillAll) {
			return;
		}
		let title = `Новое сообщение от ${message.username}`;
		let body = '';
		let icon = '/icons/icon-192x192.png';
		if (message.isFile) {
			if (message.isAudio) {
				title = `🎤 Голосовое сообщение от ${message.username}`;
				body = `Длительность: ${message.duration} сек`;
				icon = '/icons/mic.svg';
			} else if (message.fileType.startsWith('image/')) {
				title = `🖼️ Изображение от ${message.username}`;
				body = `Файл: ${message.fileName}`;
				icon = '/icons/image.svg';
			} else if (message.fileType.startsWith('video/')) {
				title = `🎥 Видео от ${message.username}`;
				body = `Длительность: ${message.duration} сек`;
				icon = '/icons/video.svg';
			} else {
				title = `📎 Файл от ${message.username}`;
				body = `Файл: ${message.fileName} (${message.fileSize})`;
				icon = '/icons/clip.svg';
			}
		} else {
			let text = message.text;
			if (message.isEncrypted) {
				if (window.encryptionManager && window.encryptionManager.encryptionKey) {
					try {
						text = window.encryptionManager.decryptMessage(message.text);
					} catch (error) {
						text = '🔒 Зашифрованное сообщение';
					}
				} else {
					text = '🔒 Зашифрованное сообщение';
				}
			}
			if (text.length > 100) {
				text = text.substring(0, 100) + '...';
			}
			body = text;
		}
		const notification = new Notification(title, {
			body: body,
			icon: icon,
			tag: `message-${message.id}`,
			requireInteraction: false,
			silent: !pushConfig.playSound
		});
		if (pushConfig.playSound && notificationSound) {
			notificationSound.play().catch(e => console.log('Не удалось воспроизвести звук уведомления:', e));
		}
		setTimeout(() => {
			notification.close();
		}, pushConfig.displayTime);
		notification.onclick = function() {
			window.focus();
			notification.close();
			const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
			if (messageElement) {
				messageElement.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
				messageElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
				setTimeout(() => {
					messageElement.style.backgroundColor = '';
				}, 2000);
			}
		};
	}
	socket.on('push-config', (config) => {
		pushConfig = {
			...pushConfig,
			...config
		};
		console.log('Конфигурация уведомлений получена:', pushConfig);
		initializePushNotifications();
	});

	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result.split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function base64ToBlob(base64, mimeType) {
		try {
			const byteCharacters = atob(base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			return new Blob([byteArray], {
				type: mimeType
			});
		} catch (error) {
			console.error('Ошибка преобразования base64 в Blob:', error);
			throw new Error('Неверный ключ шифрования');
		}
	}
	window.decryptAndDisplayFile = async function(fileUrl, fileType, fileName, messageId, buttonElement) {
		const messageFileElement = buttonElement.closest('.message-file');
		if (!messageFileElement) {
			console.error('Не найден контейнер для файла');
			return;
		}
		try {
			console.log('Начало расшифровки файла:', fileName);
			messageFileElement.innerHTML = 'Загрузка и расшифровка...';
			if (window.decryptedFilesCache[fileUrl]) {
				console.log('Файл найден в кэше:', fileName);
				const cacheEntry = window.decryptedFilesCache[fileUrl];
				if (cacheEntry.encryptionKey === window.encryptionManager.encryptionKey) {
					if (cacheEntry.status === 'success') {
						displayDecryptedFile(cacheEntry.blob, fileType, fileName, messageFileElement);
					} else {
						showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
					}
					return;
				} else {
					console.log('Ключ изменился, пробуем расшифровать заново');
					delete window.decryptedFilesCache[fileUrl];
				}
			}
			if (!window.encryptionManager.encryptionKey) {
				console.log('Дешифрование файла пропущено (нет ключа)');
				showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
				return;
			}
			console.log('Загрузка файла с сервера:', fileUrl);
			const response = await fetch(fileUrl);
			if (!response.ok) {
				throw new Error(`Ошибка загрузки файла: ${response.status}`);
			}
			const encryptedBlob = await response.blob();
			console.log('Преобразование Blob в base64');
			const encryptedBase64 = await blobToBase64(encryptedBlob);
			console.log('Расшифровка файла');
			let decryptedBase64;
			try {
				decryptedBase64 = window.encryptionManager.decryptFile(encryptedBase64);
			} catch (error) {
				console.error('Ошибка дешифрования файла:', error);
				throw new Error('Неверный ключ шифрования');
			}
			console.log('Преобразование base64 в Blob');
			const decryptedBlob = base64ToBlob(decryptedBase64, fileType);
			if (!decryptedBlob || decryptedBlob.size === 0) {
				console.error('Расшифрованный файл невалиден');
				throw new Error('Неверный ключ шифрования');
			}
			console.log('Сохранение в кэш:', fileName);
			window.decryptedFilesCache[fileUrl] = {
				blob: decryptedBlob,
				status: 'success',
				encryptionKey: window.encryptionManager.encryptionKey
			};
			console.log('Отображение расшифрованного файла:', fileName);
			displayDecryptedFile(decryptedBlob, fileType, fileName, messageFileElement);
		} catch (error) {
			console.error('Ошибка расшифровки файла:', error.message);
			window.decryptedFilesCache[fileUrl] = {
				status: 'error',
				encryptionKey: window.encryptionManager.encryptionKey,
				error: error.message
			};
			showDecryptionError(messageFileElement, fileName, fileUrl, fileType, messageId);
		}
	};

	function blobToText(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsText(blob);
		});
	}

	function isValidBase64(str) {
		if (typeof str !== 'string') {
			return false;
		}
		const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
		if (str.length % 4 !== 0) {
			return false;
		}
		if (!base64Regex.test(str)) {
			return false;
		}
		try {
			const decoded = atob(str);
			const reencoded = btoa(decoded);
			return reencoded === str;
		} catch (e) {
			return false;
		}
	}

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
            <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${url}', this) style="background-image: url("../icons/play.svg");"">
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
	const imageModal = document.getElementById('imageModal');
	const modalImage = document.getElementById('modalImage');
	const videoModal = document.getElementById('videoModal');
	const modalVideo = document.getElementById('modalVideo');
	if (sendMessageBtn) {
		sendMessageBtn.innerHTML = '<img src="icons/send-2.svg" alt="File icon" class="file-icon">';
		sendMessageBtn.title = 'Отправить сообщение';
	}
	window.showMessage = function(title, text) {
		const messageModal = document.getElementById('messageModal');
		const messageModalTitle = document.getElementById('messageModalTitle');
		const messageModalText = document.getElementById('messageModalText');
		const messageModalOkBtn = document.getElementById('messageModalOkBtn');
		messageModalTitle.textContent = title;
		messageModalText.textContent = text;
		messageModal.classList.remove('hidden');
		messageModalOkBtn.onclick = () => {
			messageModal.classList.add('hidden');
		};
		messageModal.addEventListener('click', (e) => {
			if (e.target === messageModal) {
				messageModal.classList.add('hidden');
			}
		});
	};
	const savedUsername = getCookie('chatUsername');
	if (savedUsername) {
		usernameInput.value = savedUsername;
	}
	loginModal.classList.remove('hidden');
	socket.on('rtc-config', (rtcConfig) => {
		window.rtcConfig = rtcConfig;
	});
	socket.on('config', (config) => {
		if (config.encryptionDebounceDelay) {
			encryptionDebounceDelay = config.encryptionDebounceDelay;
		}
	});
	socket.on('connect', () => {
		console.log('Подключено к серверу');
		isReconnecting = false;
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
		setTimeout(() => {
			if (isReconnecting) {
				console.log('Попытка переподключения...');
				socket.connect();
			}
		}, 2000);
	});
	socket.on('killall-message', (message) => {
		messagesContainer.innerHTML = '';
		addMessageToChat(message);
		setTimeout(() => {
			showMessage('Информация', 'Сервер завершил работу. Страница будет перезагружена.');
			setTimeout(() => {
				location.reload();
			}, 2000);
		}, 3000);
	});

	function validateInput(input) {
		const regex = /^[a-zA-Z0-9_-]{1,64}$/;
		return regex.test(input);
	}
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
	socket.on('join-error', (error) => {
		showLoginError(error);
	});

	function showLoginError(message) {
		loginError.textContent = message;
		loginError.style.display = 'block';
	}
	socket.on('user-joined', (data) => {
		currentUser = data.username;
		currentRoom = data.room;
		window.currentRoom = currentRoom;
		if (userInfo) userInfo.textContent = '✪ ' + currentUser;
		if (roomInfo) roomInfo.textContent = `Комната: ${currentRoom}`;
		loginModal.classList.add('hidden');
		messagesContainer.innerHTML = '';
		messageHistory = data.messageHistory || [];
		if (!window.reactionUsersData) {
			window.reactionUsersData = new Map();
		}
		if (data.reactionUsersData) {
			Object.entries(data.reactionUsersData).forEach(([messageId, usersData]) => {
				window.reactionUsersData.set(messageId, usersData);
			});
		}
		shouldAutoScroll = true;
		messageHistory.forEach(message => addMessageToChat(message));
		addCallButtons();
		if (window.rtcConfig) {
			toggleCallButtons(window.rtcConfig.useTurnServers);
		}
		setupMessageQuoting();
		setupEncryptionKeyHandler();
		setupSidebarToggle();
		setupImageModal();
		setupVideoModal();
		updateButtonStates();
	});
	socket.on('clear-chat', () => {
		messagesContainer.innerHTML = '';
		messageHistory = [];
		addSystemMessage('История чата была очищена');
	});
	socket.on('new-message', (message) => {
		messageHistory.push(message);
		addMessageToChat(message);
		showMessageNotification(message);
	});
	socket.on('message-updated', (message) => {
		const messageIndex = messageHistory.findIndex(msg => msg.id === message.id);
		if (messageIndex !== -1) {
			messageHistory[messageIndex] = message;
		}
		const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
		if (messageElement) {
			updateMessageReactions(messageElement, message);
		}
	});
	socket.on('message-deleted', (data) => {
		const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
		if (messageElement) {
			messageElement.remove();
			const index = messageHistory.findIndex(msg => msg.id === data.messageId);
			if (index !== -1) {
				messageHistory.splice(index, 1);
			}
		}
	});

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

	function scrollToBottom() {
		if (shouldAutoScroll) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function addDeleteButton(messageElement, message) {
		if (!messageElement || !message) return;
		if (canDeleteMessage(message)) {
			const deleteButton = document.createElement('button');
			deleteButton.className = 'message-delete-btn';
			deleteButton.innerHTML = '<svg fill="#ff4444" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><title>cancel</title><path d="M16 29c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13zM21.961 12.209c0.244-0.244 0.244-0.641 0-0.885l-1.328-1.327c-0.244-0.244-0.641-0.244-0.885 0l-3.761 3.761-3.761-3.761c-0.244-0.244-0.641-0.244-0.885 0l-1.328 1.327c-0.244 0.244-0.244 0.641 0 0.885l3.762 3.762-3.762 3.76c-0.244 0.244-0.244 0.641 0 0.885l1.328 1.328c0.244 0.244 0.641 0.244 0.885 0l3.761-3.762 3.761 3.762c0.244 0.244 0.641 0.244 0.885 0l1.328-1.328c0.244-0.244 0.244-0.641 0-0.885l-3.762-3.76 3.762-3.762z"></path></svg>';
			deleteButton.title = 'Удалить сообщение';
			deleteButton.addEventListener('click', (e) => {
				e.stopPropagation();
				showDeleteConfirmation(message.id);
			});
			const messageInfo = messageElement.querySelector('.message-info');
			if (messageInfo) {
				const timeContainer = document.createElement('div');
				timeContainer.className = 'message-time-container';
				const timeElement = messageInfo.querySelector('.message-time');
				if (timeElement) {
					messageInfo.removeChild(timeElement);
					timeContainer.appendChild(timeElement);
				}
				timeContainer.appendChild(deleteButton);
				messageInfo.appendChild(timeContainer);
			}
		}
	}

	function canDeleteMessage(message) {
		return currentUser &&
			message.username === currentUser &&
			!message.isSystem &&
			!message.isKillAll &&
			!message.isWarning;
	}
	socket.on('delete-error', (data) => {
		console.error('Ошибка удаления сообщения:', data.error);
		showMessage('Ошибка', 'Не удалось удалить сообщение: ' + data.error);
	});

	function showDeleteConfirmation(messageId) {
		const modal = document.createElement('div');
		modal.className = 'modal';
		modal.style.display = 'flex';
		modal.innerHTML = `
    <div class="modal-content">
      <h2>Подтверждение удаления</h2>
      <p>Вы действительно хотите безвозвратно удалить это сообщение?</p>
      <div class="modal-buttons-container">
        <button id="cancelDelete" class="modal-ok-btn" style="background-color: #6c757d;">Отмена</button>
        <button id="confirmDelete" class="modal-ok-btn" style="background-color: #dc3545;">Удалить</button>
      </div>
    </div>
  `;
		document.body.appendChild(modal);
		document.getElementById('cancelDelete').addEventListener('click', () => {
			document.body.removeChild(modal);
		});
		document.getElementById('confirmDelete').addEventListener('click', () => {
			const confirmBtn = document.getElementById('confirmDelete');
			confirmBtn.disabled = true;
			confirmBtn.textContent = 'Удаление...';
			socket.emit('delete-message', {
				messageId
			}, (response) => {
				if (response && response.error) {
					console.error('Ошибка удаления:', response.error);
					showMessage('Ошибка', 'Не удалось удалить сообщение: ' + response.error);
				}
				document.body.removeChild(modal);
			});
		});
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal);
			}
		});
	}

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
		if (message.isWarning) {
			messageElement.classList.add('warning-message');
		}
		if (message.isFile || message.isAudio) {
			messageElement.dataset.hasFile = 'true';
		}
		const isMyMessage = message.userId === socket.id;
		if (!message.isSystem && !message.isKillAll && !message.isWarning) {
			if (window.reactionsManager) {
				window.reactionsManager.addReactionButton(messageElement);
				window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
				if (message.reactions && Object.keys(message.reactions).length > 0) {
					if (!window.reactionUsersData) {
						window.reactionUsersData = new Map();
					}
				}
			}
			messageElement.classList.add(isMyMessage ? 'my-message' : 'other-message');
		}
		const time = new Date(message.timestamp).toLocaleTimeString();
		let messageContent = `
        <div class="message-info">
            <span class="message-sender">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
    `;
		if (message.quote) {
			let quoteText = message.quote.text;
			let quoteUsername = message.quote.username;
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
    if (message.isAudio) {
      messageContent += `
        <div class="message-audio">
          <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${message.fileUrl}', this)">
          </button>
          <span class="audio-duration">${message.duration} сек • ${message.fileSize}</span>
        </div>
      `;

    } else if (message.fileType && message.fileType.startsWith('image/')) {
      messageContent += `
        <div class="message-file">
          <img src="${message.fileUrl}" alt="${message.fileName}" 
               onclick="console.log('🖼️ Клик по изображению в чате:', '${message.fileUrl}'); window.expandImage('${message.fileUrl}', '${message.fileType}')">
          <div class="file-size">${message.fileSize}</div>
        </div>
      `;
    } else if (message.fileType && message.fileType.startsWith('video/')) {
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
      // Для файлов без типа или с неизвестным типом
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
			messageContent += `<div class="message-text">${messageText}</div>`;
		}
		messageElement.innerHTML = messageContent;
		messagesContainer.appendChild(messageElement);
		if (!message.isSystem && !message.isKillAll && !message.isWarning) {
			if (window.reactionsManager) {
				window.reactionsManager.addReactionButton(messageElement);
				window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
				if (message.reactions && Object.keys(message.reactions).length > 0) {}
			}
		}
		messagesContainer.appendChild(messageElement);
		setTimeout(() => {
			addDeleteButton(messageElement, message);
		}, 0);
		scrollToBottom();
	}

	function updateMessageReactions(messageElement, message) {
		if (window.reactionsManager) {
			window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
		}
	}
	socket.on('reactions-updated', (data) => {
		const {
			messageId,
			reactions,
			reactionUsers
		} = data;
		if (!window.reactionUsersData) {
			window.reactionUsersData = new Map();
		}
		window.reactionUsersData.set(messageId, reactionUsers);
		const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
		if (messageElement && window.reactionsManager) {
			window.reactionsManager.updateMessageReactions(messageElement, reactions);
		}
	});
	socket.on('users-list', (users) => {
		usersList.innerHTML = '';
		users.forEach(user => {
			const userElement = document.createElement('div');
			userElement.classList.add('user-item');
			userElement.textContent = user.username;
			usersList.appendChild(userElement);
		});
	});
	socket.on('user-joined-room', (user) => {
		addSystemMessage(`Пользователь ${user.username} присоединился к комнате`);
	});
	socket.on('user-left-room', (user) => {
		addSystemMessage(`Пользователь ${user.username} вышел из комнате`);
	});
	window.expandImage = function(imageUrl, fileType) {
		console.log('🖼️ expandImage вызвана:', {
			imageUrl,
			fileType
		});
		if (imageModal.classList.contains('active')) {
			closeImageModal();
			return;
		}
		if (!imageModal || !modalImage) {
			console.error('❌ Элементы модального окна изображения не найдены');
			return;
		}
		console.log('✅ Элементы модального окна найдены');
		imageModal.classList.add('active');
		modalImage.src = imageUrl;
		modalImage.alt = 'Увеличенное изображение';
		modalImage.onload = function() {
			console.log('✅ Изображение успешно загружено');
		};
		modalImage.onerror = function() {
			console.error('❌ Ошибка загрузки изображения:', imageUrl);
			modalImage.alt = 'Ошибка загрузки изображения';
			modalImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iMC4zNWVtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE4Ij7QndC10YI8L3RleHQ+PC9zdmc+';
		};
	};

	function closeImageModal() {
		console.log('🔄 Закрываем модальное окно изображения...');
		if (!imageModal || !modalImage) {
			console.error('❌ Элементы модального окна изображения не найдены при закрытии');
			return;
		}
		modalImage.onload = null;
		modalImage.onerror = null;
		imageModal.classList.remove('active');
		if (window.imageModalDebug) {
			window.imageModalDebug.modalState = 'closing';
		}
		setTimeout(() => {
			modalImage.src = '';
			console.log('✅ Модальное окно изображения закрыто');
			if (window.imageModalDebug) {
				window.imageModalDebug.modalState = 'closed';
			}
		}, 300);
	}
	window.expandVideoWithSound = function(videoUrl, chatVideoElement = null) {
		console.log('🎥 expandVideoWithSound вызвана:', videoUrl);
		const isMobile = window.innerWidth <= 770;
		console.log('📱 Это мобильное устройство:', isMobile);
		if (chatVideoElement && !chatVideoElement.paused) {
			console.log('⏸️ Ставим видео в чате на паузу');
			chatVideoElement.pause();
			window.pausedChatVideo = chatVideoElement;
		}
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
		console.log('🔄 Показываем модальное окно видео...');
		videoModal.classList.add('active');
		window.videoModalDebug.modalState = 'opening';
		setTimeout(() => {
			if (modalVideo.src) {
				URL.revokeObjectURL(modalVideo.src);
			}
			modalVideo.src = videoUrl;
			modalVideo.controls = true;
			modalVideo.muted = false;
			modalVideo.onloadeddata = function() {
				console.log('✅ Видео успешно загружено');
				window.videoModalDebug.modalState = 'video_loaded';
				modalVideo.play().then(() => {
					console.log('✅ Видео воспроизводится');
				}).catch(error => {
					console.warn('⚠️ Автовоспроизведение заблокировано:', error);
				});
			};
			modalVideo.onerror = function(e) {
				if (!videoModal.classList.contains('active')) {
					console.log('⚠️ Ошибка загрузки видео проигнорирована (модальное окно закрыто)');
					return;
				}
				console.error('❌ Ошибка загрузки видео:', videoUrl, e);
				window.videoModalDebug.modalState = 'video_load_error';
				if (videoModal.classList.contains('active')) {
					modalVideo.controls = false;
					modalVideo.poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iMC4zNWVtIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXNpemU9IjE0Ij7QktC40LTQtdC+INC90LUg0LTQvtC00L7QvNC10YAg0LTQvtCx0YDQtdGC0L7QsiDQtNC+0YHRgtC+0LfQstC+0Lk8L3RleHQ+PC9zdmc+';
				}
			};
			modalVideo.onended = function() {
				console.log('✅ Видео завершено');
			};
		}, 10);
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

	function adjustMediaSize() {
		const messagesContainer = document.getElementById('messagesContainer');
		if (!messagesContainer) return;
		const containerHeight = messagesContainer.clientHeight;
		const maxMediaHeight = containerHeight * 0.9;
		const minMediaHeight = 200;
		const mediaElements = messagesContainer.querySelectorAll('.message-file img, .message-file video');
		mediaElements.forEach(media => {
			const messageFile = media.closest('.message-file');
			if (!messageFile) return;
			const naturalHeight = media.naturalHeight || media.videoHeight;
			const naturalWidth = media.naturalWidth || media.videoWidth;
			if (!naturalHeight || !naturalWidth) {
				media.onload = function() {
					adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight);
				};
				return;
			}
			adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight);
		});
	}

	function adjustSingleMediaSize(media, maxMediaHeight, minMediaHeight) {
		const messageFile = media.closest('.message-file');
		const naturalHeight = media.naturalHeight || media.videoHeight;
		const naturalWidth = media.naturalWidth || media.videoWidth;
		if (!naturalHeight || !naturalWidth) return;
		const aspectRatio = naturalWidth / naturalHeight;
		if (naturalHeight > maxMediaHeight) {
			messageFile.classList.add('media-large');
			media.style.maxHeight = `${maxMediaHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';
			const calculatedWidth = maxMediaHeight * aspectRatio;
			if (calculatedWidth > media.parentElement.clientWidth) {
				media.style.width = '100%';
				media.style.height = 'auto';
			}
		} else if (naturalHeight > minMediaHeight) {
			messageFile.classList.remove('media-large');
			media.style.maxHeight = `${naturalHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';
		} else {
			messageFile.classList.remove('media-large');
			media.style.maxHeight = `${minMediaHeight}px`;
			media.style.width = 'auto';
			media.style.maxWidth = '100%';
		}
	}

	function handleMediaResize() {
		clearTimeout(window.mediaResizeTimeout);
		window.mediaResizeTimeout = setTimeout(() => {
			adjustMediaSize();
		}, 100);
	}

	function closeVideoModal() {
		console.log('🔄 Закрываем модальное окно видео...');
		if (!videoModal || !modalVideo) {
			console.error('❌ Элементы модального окна видео не найдены при закрытии');
			return;
		}
		modalVideo.pause();
		modalVideo.currentTime = 0;
		modalVideo.onloadeddata = null;
		modalVideo.onerror = null;
		modalVideo.onended = null;
		videoModal.classList.remove('active');
		window.videoModalDebug.modalState = 'closing';
		setTimeout(() => {
			if (modalVideo.src) {
				URL.revokeObjectURL(modalVideo.src);
				modalVideo.removeAttribute('src');
				modalVideo.load();
			}
			modalVideo.controls = false;
			modalVideo.poster = '';
			console.log('✅ Модальное окно видео закрыто');
			window.videoModalDebug.modalState = 'closed';
		}, 300);
	}

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
		const imageCloseBtn = imageModal.querySelector('.image-close-btn');
		if (imageCloseBtn) {
			imageCloseBtn.addEventListener('click', (e) => {
				console.log('🖱️ Клик по кнопке закрытия изображения');
				closeImageModal();
				e.stopPropagation();
			});
		}
		const imageOverlay = imageModal.querySelector('.image-modal-overlay');
		if (imageOverlay) {
			imageOverlay.addEventListener('click', (e) => {
				console.log('🖱️ Клик по overlay изображения');
				closeImageModal();
			});
		}
		modalImage.addEventListener('click', (e) => {
			console.log('🖱️ Клик по изображению в модальном окне');
			closeImageModal();
			e.stopPropagation();
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && imageModal.classList.contains('active')) {
				console.log('⌨️ Нажата клавиша Escape, закрываем модальное окно изображения');
				closeImageModal();
			}
		});
		console.log('✅ Модальное окно для изображений инициализировано');
	}
	sendMessageBtn.addEventListener('click', sendMessage);
	messageInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			sendMessage();
		}
	});
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
		const videoOverlay = videoModal.querySelector('.video-modal-overlay');
		const videoCloseBtn = videoModal.querySelector('.video-close-btn');
		if (videoOverlay) {
			videoOverlay.addEventListener('click', (e) => {
				console.log('🖱️ Клик по overlay видео');
				closeVideoModal();
			});
		}
		if (videoCloseBtn) {
			videoCloseBtn.addEventListener('click', (e) => {
				console.log('🖱️ Клик по кнопке закрытия видео');
				e.stopPropagation();
				closeVideoModal();
			});
		} else {
			console.error('❌ Кнопка закрытия видео не найдена!');
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
		modalVideo.addEventListener('click', (e) => {
			console.log('🖱️ Клик по видео - предотвращаем закрытие');
			e.stopPropagation();
			if (window.innerWidth <= 770) {
				if (modalVideo.paused) {
					modalVideo.play().catch(console.error);
				} else {
					modalVideo.pause();
				}
			}
		});
		let startY = 0;
		modalVideo.addEventListener('touchstart', (e) => {
			startY = e.touches[0].clientY;
		});
		modalVideo.addEventListener('touchmove', (e) => {
			if (Math.abs(e.touches[0].clientY - startY) > 10) {
				e.stopPropagation();
			}
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && videoModal.classList.contains('active')) {
				console.log('⌨️ Нажата клавиша Escape, закрываем модальное окно видео');
				closeVideoModal();
			}
		});
		modalVideo.onended = function() {
			console.log('✅ Видео завершено');
		};
		modalVideo.addEventListener('play', function() {
			if (window.innerWidth <= 770 && this.webkitEnterFullscreen) {
				try {
					this.webkitEnterFullscreen();
				} catch (error) {
					console.log('Автоматический полноэкранный режим не поддерживается');
				}
			}
		});
		console.log('✅ Модальное окно для видео инициализировано');
	}
	fileInput.addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (!file) return;
		if (file.size > 50 * 1024 * 1024) {
			addSystemMessage(`Файл слишком большой. Максимальный размер: 50 МБ`);
			fileInput.value = '';
			return;
		}
		showFileUploadIndicator(file.name);
		currentFileReader = new FileReader();
		currentFileReader.onload = async function(event) {
			let fileData = event.target.result.split(',')[1];
			let isEncrypted = false;
			console.log('Обработка файла:', file.name, 'Размер:', file.size, 'Тип:', file.type);
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
			socket.emit('send-file', {
				fileName: file.name,
				fileType: file.type,
				fileData: fileData,
				isEncrypted: isEncrypted
			}, (response) => {
				if (response && response.error) {
					console.error('Ошибка отправки файла:', response.error);
					addSystemMessage(`Ошибка отправки файла ${file.name}: ${response.error}`);
					showFileUploadError();
				} else {
					console.log('Файл успешно отправлен:', file.name);
					hideFileUploadIndicator();
				}
			});
		};
		currentFileReader.onerror = function() {
			console.error('Ошибка чтения файла:', file.name);
			addSystemMessage(`Ошибка чтения файла: ${file.name}`);
			showFileUploadError();
			fileInput.value = '';
		};
		currentFileReader.onabort = function() {
			console.log('Загрузка файла отменена:', file.name);
			fileInput.value = '';
		};
		currentFileReader.readAsDataURL(file);
	});

	function sendMessage() {
		const text = messageInput.value.trim();
		if (text) {
			let messageData = {
				text
			};
			if (quotedMessage) {
				messageData.quote = {
					username: quotedMessage.username,
					text: quotedMessage.text,
					isEncrypted: false
				};
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
			if (window.clearMessageInput) {
				window.clearMessageInput();
			} else {
				messageInput.value = '';
				if (window.messageInputAnimations) {
					window.messageInputAnimations.updateButtonStates();
				}
			}
			cancelQuote();
		}
	}

	function setQuotedMessage(messageElement, messageData) {
		const previousQuoted = document.querySelector('.message.quoted');
		if (previousQuoted) {
			previousQuoted.classList.remove('quoted');
		}
		messageElement.classList.add('quoted');
		quotedMessage = {
			id: messageData.id,
			username: messageData.username,
			text: messageData.text,
			originalMessage: messageData.originalMessage
		};
		showQuoteBlock();
	}

	function showQuoteBlock() {
		const oldQuoteBlock = document.querySelector('.quote-block');
		if (oldQuoteBlock) {
			oldQuoteBlock.remove();
		}
		const quoteBlock = document.createElement('div');
		quoteBlock.className = 'quote-block';
		let quoteText = quotedMessage.text;
		let quoteUsername = quotedMessage.username;
		if (quotedMessage.originalMessage.isEncrypted) {
			if (window.encryptionManager && window.encryptionManager.encryptionKey) {
				try {
					quoteText = window.encryptionManager.decryptMessage(quotedMessage.originalMessage.text);
				} catch (error) {
					quoteText = "🔒 Неверный ключ шифрования";
				}
			} else {
				quoteText = "🔒 Неверный ключ шифрования";
			}
		} else {
			quoteText = quotedMessage.originalMessage.text;
		}
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
		const messageInputContainer = document.querySelector('.message-input-container');
		messageInputContainer.parentNode.insertBefore(quoteBlock, messageInputContainer);
		quoteBlock.querySelector('.cancel-quote').addEventListener('click', () => {
			cancelQuote();
		});
	}

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

	function setupMessageQuoting() {
		messagesContainer.addEventListener('click', (e) => {
			const messageElement = e.target.closest('.message');
			if (!messageElement ||
				messageElement.classList.contains('system-message') ||
				messageElement.classList.contains('killall-message')) {
				return;
			}
			const hasFile = messageElement.querySelector('.message-file, .message-audio');
			if (hasFile) {
				console.log('Цитирование файловых сообщений не поддерживается');
				return;
			}
			const messageId = messageElement.dataset.messageId;
			const messageUsername = messageElement.dataset.messageUsername;
			const messageTextElement = messageElement.querySelector('.message-text');
			if (!messageTextElement) {
				console.log('Текстовое сообщение не найдено');
				return;
			}
			let messageText = messageTextElement.textContent;
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

	function addCallButtons() {
		const callButtonsContainer = document.querySelector('.call-buttons-container');
		if (!callButtonsContainer) {
			console.error('Контейнер для кнопок звонков не найден');
			return;
		}
		callButtonsContainer.innerHTML = '';
		const audioCallBtn = document.createElement('button');
		audioCallBtn.id = 'audioCallBtn';
		audioCallBtn.className = 'call-btn';
		audioCallBtn.innerHTML = '<img src="icons/call.svg" alt="File icon" class="file-icon">';
		audioCallBtn.title = 'Аудиозвонок';
		const videoCallBtn = document.createElement('button');
		videoCallBtn.id = 'videoCallBtn';
		videoCallBtn.className = 'call-btn';
		videoCallBtn.innerHTML = '<img src="icons/camera-5.svg" alt="File icon" class="file-icon">';
		videoCallBtn.title = 'Видеозвонок';
		callButtonsContainer.appendChild(audioCallBtn);
		callButtonsContainer.appendChild(videoCallBtn);
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

	function setupEncryptionKeyHandler() {
		if (!encryptionKeyInput) return;

		function updateClearButtonVisibility() {
			if (clearEncryptionKeyBtn) {
				if (encryptionKeyInput.value) {
					clearEncryptionKeyBtn.style.display = 'flex';
				} else {
					clearEncryptionKeyBtn.style.display = 'none';
				}
			}
		}
		updateClearButtonVisibility();
		encryptionKeyInput.addEventListener('input', (e) => {
			const key = e.target.value;
			if (window.encryptionManager) {
				window.encryptionManager.setEncryptionKey(key);
				window.decryptedFilesCache = {};
				updateClearButtonVisibility();
				const encryptedFileButtons = document.querySelectorAll('.encrypted-file-btn.error');
				encryptedFileButtons.forEach(button => {
					button.classList.remove('error');
					button.textContent = '🔒 Файл зашифрован. Нажмите для расшифровки.';
					const fileUrl = button.dataset.fileUrl;
					const fileType = button.dataset.fileType;
					const fileName = button.dataset.fileName;
					const messageId = button.dataset.messageId;
					button.onclick = function() {
						window.decryptAndDisplayFile(fileUrl, fileType, fileName, messageId, this);
					};
				});
				shouldAutoScroll = false;
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
		if (clearEncryptionKeyBtn) {
			clearEncryptionKeyBtn.addEventListener('click', () => {
				encryptionKeyInput.value = '';
				if (window.encryptionManager) {
					window.encryptionManager.setEncryptionKey('');
				}
				window.decryptedFilesCache = {};
				updateClearButtonVisibility();
				const encryptedFileButtons = document.querySelectorAll('.encrypted-file-btn.error');
				encryptedFileButtons.forEach(button => {
					button.classList.remove('error');
					button.textContent = '🔒 Файл зашифрован. Нажмите для расшифровки.';
					const fileUrl = button.dataset.fileUrl;
					const fileType = button.dataset.fileType;
					const fileName = button.dataset.fileName;
					const messageId = button.dataset.messageId;
					button.onclick = function() {
						window.decryptAndDisplayFile(fileUrl, fileType, fileName, messageId, this);
					};
				});
				shouldAutoScroll = false;
				reDecryptAllMessages();
			});
		}
	}

	function reDecryptAllMessages() {
		messagesContainer.innerHTML = '';
		messageHistory.forEach(message => {
			addMessageToChat(message);
		});
		shouldAutoScroll = true;
	}

	function setupSidebarToggle() {
		const showSidebarBtn = document.getElementById('showSidebarBtn');
		const hideSidebarBtn = document.getElementById('hideSidebarBtn');
		const sidebar = document.querySelector('.sidebar');
		const overlay = document.createElement('div');
		overlay.className = 'sidebar-overlay';
		document.body.appendChild(overlay);
		if (sidebar && sidebar.parentNode) {
			sidebar.parentNode.insertBefore(overlay, sidebar);
		}
		showSidebarBtn.addEventListener('click', () => {
			sidebar.classList.add('active');
			overlay.classList.add('active');
			setTimeout(() => {
				if (sidebar.style.zIndex !== '1002') {
					sidebar.style.zIndex = '1002';
				}
				if (overlay.style.zIndex !== '1001') {
					overlay.style.zIndex = '1001';
				}
			}, 10);
		});
		hideSidebarBtn.addEventListener('click', () => {
			sidebar.classList.remove('active');
			overlay.classList.remove('active');
		});
		overlay.addEventListener('click', () => {
			sidebar.classList.remove('active');
			overlay.classList.remove('active');
		});
		window.addEventListener('resize', handleOrientationChange);
		handleOrientationChange();
	}

	function handleOrientationChange() {
		const sidebar = document.querySelector('.sidebar');
		const overlay = document.querySelector('.sidebar-overlay');
		const showSidebarBtn = document.getElementById('showSidebarBtn');
		const hideSidebarBtn = document.getElementById('hideSidebarBtn');
		if (window.innerWidth > window.innerHeight) {
			sidebar.classList.remove('active');
			if (overlay) overlay.classList.remove('active');
			if (showSidebarBtn) showSidebarBtn.classList.add('hidden');
			if (hideSidebarBtn) hideSidebarBtn.classList.add('hidden');
		} else {
			sidebar.classList.remove('active');
			if (overlay) overlay.classList.remove('active');
			if (showSidebarBtn) showSidebarBtn.classList.remove('hidden');
			if (hideSidebarBtn) hideSidebarBtn.classList.remove('hidden');
		}
	}

	function updateButtonStates() {
		if (!messageInputContainer) return;
		const hasText = messageInput.value.trim().length > 0;
		messageInputContainer.classList.toggle('has-text', hasText);
		if (window.messageInputAnimations) {
			window.messageInputAnimations.updateButtonStates();
		}
	}
	if (messageInput) {
		messageInput.addEventListener('input', updateButtonStates);
	}
	window.addEventListener('orientationchange', function() {
		if (videoModal && videoModal.classList.contains('active')) {
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
	window.addEventListener('resize', function() {
		if (videoModal && videoModal.classList.contains('active')) {
			console.log('🔄 Изменение размера окна, обновляем видео');
		}
	});
	let currentFileUploadIndicator = null;
	let currentFileReader = null;

	function showFileUploadIndicator(fileName) {
		if (currentFileUploadIndicator) {
			currentFileUploadIndicator.remove();
		}
		const indicator = document.createElement('div');
		indicator.className = 'file-upload-indicator';
		indicator.innerHTML = `
        <div class="upload-progress-bar"></div>
        <div class="upload-text">Загрузка: ${fileName}</div>
        <button class="cancel-upload">✕</button>
    `;
		const messageInputContainer = document.querySelector('.message-input-container');
		messageInputContainer.parentNode.insertBefore(indicator, messageInputContainer);
		const cancelBtn = indicator.querySelector('.cancel-upload');
		cancelBtn.addEventListener('click', cancelFileUpload);
		currentFileUploadIndicator = indicator;
	}

	function hideFileUploadIndicator() {
		if (currentFileUploadIndicator) {
			currentFileUploadIndicator.remove();
			currentFileUploadIndicator = null;
		}
	}

	function showFileUploadError() {
		if (!currentFileUploadIndicator) return;
		currentFileUploadIndicator.classList.add('error');
		currentFileUploadIndicator.querySelector('.upload-text').textContent = 'Ошибка загрузки!';
		setTimeout(() => {
			hideFileUploadIndicator();
		}, 2000);
	}

	function cancelFileUpload() {
		if (currentFileReader && currentFileReader.readyState === 1) {
			currentFileReader.abort();
		}
		fileInput.value = '';
		hideFileUploadIndicator();
	}
	setTimeout(() => {
		updateButtonStates();
	}, 100);
});

function handleViewportResize() {
	const appContainer = document.querySelector('.app-container');
	const chatContainer = document.querySelector('.chat-container');
	if (!appContainer || !chatContainer) return;
	const visualViewport = window.visualViewport || window;
	const height = visualViewport.height;
	appContainer.style.height = height + 'px';
	chatContainer.style.height = height + 'px';
	const messagesContainer = document.getElementById('messagesContainer');
	if (messagesContainer && window.shouldAutoScroll) {
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}
}
window.addEventListener('beforeunload', () => {
	if (currentFileReader && currentFileReader.readyState === 1) {
		currentFileReader.abort();
	}
});
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', handleViewportResize);
if (window.visualViewport) {
	window.visualViewport.addEventListener('resize', handleViewportResize);
}
document.addEventListener('DOMContentLoaded', () => {
	setTimeout(handleViewportResize, 100);
	setTimeout(handleViewportResize, 500);
});
document.addEventListener('focusin', () => {
	setTimeout(handleViewportResize, 300);
});
document.addEventListener('focusout', () => {
	setTimeout(handleViewportResize, 300);
});
document.addEventListener('play', function(e) {
	const target = e.target;
	if ((target.tagName === 'VIDEO' || target.tagName === 'AUDIO') &&
		target.closest('#messagesContainer')) {
		target.muted = false;
		const allMedia = document.querySelectorAll('#messagesContainer video, #messagesContainer audio');
		allMedia.forEach(media => {
			if (media !== target && !media.paused) {
				media.pause();
			}
		});
	}
}, true);