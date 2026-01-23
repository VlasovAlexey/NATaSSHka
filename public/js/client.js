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


    socket.on('stun-config', (iceServers) => {
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
        toggleCallButtons(rtcConfig.useTurnServers);
    });


function linkifyMessageText(text, isEncrypted = false, isSystem = false) {
    if (!text || typeof text !== 'string') {
        return text;
    }


    if (isSystem) {
        return text;
    }

    let processedText = text;


    if (isEncrypted) {
        if (window.encryptionManager && window.encryptionManager.encryptionKey) {
            try {
                processedText = window.encryptionManager.decryptMessage(text);

            } catch (error) {

                return window.t('ERROR_WRONG_ENCRYPTION_KEY');
            }
        } else {

            return window.t('ERROR_WRONG_ENCRYPTION_KEY');
        }
    }


    try {
        if (window.Autolinker) {
            return Autolinker.link(processedText, {
                urls: {
                    schemeMatches: true,
                    wwwMatches: true,
                    tldMatches: true
                },
                email: true,
                phone: true,
                stripPrefix: false,
                stripTrailingSlash: false,
                newWindow: true,
                truncate: {
                    length: 50,
                    location: 'smart'
                },
                className: 'message-link',
                sanitizeHtml: true
            });
        }
    } catch (error) {
        console.warn('Autolinker error:', error);

        return processedText;
    }

    return processedText;
}


function enhanceMessageLinks(messageElement) {
    if (!messageElement) return;

    const links = messageElement.querySelectorAll('a.message-link');

    links.forEach(link => {
        const href = link.getAttribute('href') || '';


        if (href.startsWith('mailto:')) {
            link.classList.add('email');
            link.setAttribute('title', window.t('EMAIL_CLICK_TO_SEND', { email: href.replace('mailto:', '') }));
        } else if (href.startsWith('tel:')) {
            link.classList.add('phone');
            link.setAttribute('title', window.t('PHONE_CLICK_TO_CALL', { phone: href.replace('tel:', '') }));
        } else if (href.startsWith('http://') || href.startsWith('https://')) {

            link.setAttribute('rel', 'noopener noreferrer');
            link.setAttribute('title', window.t('LINK_CLICK_TO_OPEN'));
        }


        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}


function getPlainTextForNotification(text, isEncrypted = false) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let processedText = text;


    if (isEncrypted) {
        if (window.encryptionManager && window.encryptionManager.encryptionKey) {
            try {
                processedText = window.encryptionManager.decryptMessage(text);
            } catch (error) {
                return window.t('NOTIFICATION_ENCRYPTED_MESSAGE');
            }
        } else {
            return window.t('NOTIFICATION_ENCRYPTED_MESSAGE');
        }
    }


    processedText = processedText.replace(/<[^>]*>/g, '');


    processedText = processedText.replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')
                               .replace(/&quot;/g, '"')
                               .replace(/&#039;/g, "'")
                               .replace(/&#39;/g, "'");

    return processedText;
}


function getPlainTextForNotification(text, isEncrypted = false) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let processedText = text;


    if (isEncrypted) {
        if (window.encryptionManager && window.encryptionManager.encryptionKey) {
            try {
                processedText = window.encryptionManager.decryptMessage(text);
            } catch (error) {
                return window.t('NOTIFICATION_ENCRYPTED_MESSAGE');
            }
        } else {
            return window.t('NOTIFICATION_ENCRYPTED_MESSAGE');
        }
    }


    processedText = processedText.replace(/<[^>]*>/g, '');


    processedText = processedText.replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')
                               .replace(/&quot;/g, '"')
                               .replace(/&#039;/g, "'")
                               .replace(/&#39;/g, "'");

    return processedText;
}

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
    }


    function requestNotificationPermission() {
        Notification.requestPermission().then(permission => {
            notificationPermission = permission;
            if (permission === 'granted') {
                showTestNotification();
            }
        });
    }

    function showTestNotification() {
        if (notificationPermission === 'granted') {
            const notification = new Notification(window.t('NOTIFICATION_TEST_TITLE'), {
                body: window.t('NOTIFICATION_TEST_BODY'),
                icon: '/icons/icon-192x192.png',
                tag: 'test-notification'
            });

            setTimeout(() => {
                notification.close();
            }, 3000);
        }
    }


function linkifyText(text, isEncrypted = false, encryptionKey = null) {
    if (!text || typeof text !== 'string') {
        return text;
    }


    if (isEncrypted && text === window.t('ERROR_WRONG_ENCRYPTION_KEY')) {
        return text;
    }


    if (isEncrypted && encryptionKey) {
        try {
            text = window.encryptionManager.decryptMessage(text);
        } catch (error) {
            return window.t('ERROR_WRONG_ENCRYPTION_KEY');
        }
    } else if (isEncrypted && !encryptionKey) {
        return window.t('ERROR_WRONG_ENCRYPTION_KEY');
    }

    try {
        if (window.Autolinker) {
            return Autolinker.link(text, {
                urls: {
                    schemeMatches: true,
                    wwwMatches: true,
                    tldMatches: true
                },
                email: true,
                phone: true,
                stripPrefix: false,
                stripTrailingSlash: false,
                newWindow: true,
                truncate: {
                    length: 50,
                    location: 'smart'
                },
                className: 'message-link',
                sanitizeHtml: true,


                phoneUrlScheme: 'tel:',
                replaceFn: function(autolinker, match) {
                    const tag = match.buildTag();

                    if (match.getType() === 'email') {
                        tag.addClass('email');
                        tag.setAttr('title', window.t('EMAIL_CLICK_TO_SEND', { email: match.getEmail() }));
                    }

                    if (match.getType() === 'phone') {
                        tag.addClass('phone');
                        tag.setAttr('title', window.t('PHONE_CLICK_TO_CALL', { phone: match.getNumber() }));
                    }

                    return tag;
                }
            });
        }
    } catch (error) {
        console.warn('Linkify error:', error);
    }

    return text;
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

    let title = window.t('NOTIFICATION_NEW_MESSAGE', { username: message.username });
    let body = '';
    let icon = '/icons/icon-192x192.png';

    if (message.isFile) {
        if (message.isAudio) {
            title = window.t('NOTIFICATION_VOICE_MESSAGE', { username: message.username });
            body = window.t('NOTIFICATION_VOICE_DURATION', { duration: message.duration });
            icon = '/icons/mic.svg';
        } else if (message.fileType.startsWith('image/')) {
            title = window.t('NOTIFICATION_IMAGE_MESSAGE', { username: message.username });
            body = window.t('NOTIFICATION_IMAGE_FILE', { filename: message.fileName });
            icon = '/icons/image.svg';
        } else if (message.fileType.startsWith('video/')) {
            title = window.t('NOTIFICATION_VIDEO_MESSAGE', { username: message.username });
            body = window.t('NOTIFICATION_VIDEO_DURATION', { duration: message.duration });
            icon = '/icons/video.svg';
        } else {
            title = window.t('NOTIFICATION_FILE_MESSAGE', { username: message.username });
            body = window.t('NOTIFICATION_FILE_INFO', { filename: message.fileName, size: message.fileSize });
            icon = '/icons/clip.svg';
        }
    } else {

        body = getPlainTextForNotification(message.text, message.isEncrypted || false);


        if (body.length > 100) {
            body = body.substring(0, 100) + '...';
        }
    }

    const notification = new Notification(title, {
        body: body,
        icon: icon,
        tag: `message-${message.id}`,
        requireInteraction: false,
        silent: !pushConfig.playSound
    });

    if (pushConfig.playSound && notificationSound) {
        notificationSound.play().catch(e => {});
    }

    setTimeout(() => {
        notification.close();
    }, pushConfig.displayTime);

    notification.onclick = function() {
        window.focus();
        notification.close();
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            setTimeout(() => {
                messageElement.style.backgroundColor = '';
            }, 2000);
        }
    };
}

    socket.on('push-config', (config) => {
        pushConfig = { ...pushConfig, ...config };
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
            return new Blob([byteArray], { type: mimeType });
        } catch (error) {
            throw new Error(window.t('ERROR_WRONG_ENCRYPTION_KEY'));
        }
    }

    window.decryptAndDisplayFile = async function(fileUrl, fileType, fileName, messageId, buttonElement) {

    const antiCacheUrl = window.cacheControlManager?.addAntiCacheParam(fileUrl) || fileUrl;


    if (window.fileNameFormatter) {
        window.fileNameFormatter.setupEncryptedFileButton(buttonElement, fileName);
    }

    const messageFileElement = buttonElement.closest('.message-file');
    if (!messageFileElement) {
        return;
    }

    try {
        messageFileElement.innerHTML = window.t('FILE_LOADING_DECRYPTING');


        if (!window.encryptionManager.encryptionKey) {
            showDecryptionError(messageFileElement, fileName, antiCacheUrl, fileType, messageId);
            return;
        }


        const response = await fetch(antiCacheUrl, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`${window.t('ERROR_FILE_READ', { filename: fileName })}: ${response.status}`);
        }

        const encryptedBlob = await response.blob();
        const encryptedBase64 = await blobToBase64(encryptedBlob);

        let decryptedBase64;
        try {
            decryptedBase64 = window.encryptionManager.decryptFile(encryptedBase64);
        } catch (error) {
            throw new Error(window.t('ERROR_WRONG_ENCRYPTION_KEY'));
        }

        const decryptedBlob = base64ToBlob(decryptedBase64, fileType);

        if (!decryptedBlob || decryptedBlob.size === 0) {
            throw new Error(window.t('ERROR_WRONG_ENCRYPTION_KEY'));
        }


        displayDecryptedFile(decryptedBlob, fileType, fileName, messageFileElement);

    } catch (error) {
        showDecryptionError(messageFileElement, fileName, antiCacheUrl, fileType, messageId);
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

        const displayFileName = window.fileNameFormatter ?
            window.fileNameFormatter.formatFileName(fileName) :
            fileName;

        messageFileElement.innerHTML = `
        <button class="encrypted-file-btn error"
                onclick="decryptAndDisplayFile('${fileUrl}', '${fileType}', '${fileName}', '${messageId}', this)"
                data-file-url="${fileUrl}"
                data-file-type="${fileType}"
                data-file-name="${fileName}"
                data-message-id="${messageId}">
            ${window.t('FILE_WRONG_KEY')}
        </button>
        <div class="file-info" title="${fileName}">${displayFileName}</div>
    `;
    }

    function displayDecryptedFile(blob, fileType, fileName, messageFileElement) {
    const url = URL.createObjectURL(blob);
    const fileSize = (blob.size / 1024).toFixed(2);


    const fileAnalysis = window.fileFormats ?
        window.fileFormats.analyzeFile(fileType, fileName) :
        { isImage: fileType && fileType.startsWith('image/'), shouldDisplayAsFile: false };


    const fileIcon = window.fileFormats ?
        window.fileFormats.getFileIcon(fileType, fileName) : '📄';

    if (fileAnalysis.isImage && !fileAnalysis.shouldDisplayAsFile) {

        messageFileElement.innerHTML = `
        <img src="${url}" alt="${fileName}"
             onclick="window.expandImage('${url}', '${fileType}')">
        <div class="file-size">${window.t('FILE_SIZE', { size: fileSize })}</div>
    `;
    } else if (fileType && fileType.startsWith('video/')) {
    messageFileElement.innerHTML = `
    <video src="${url}" controls muted
           onclick="window.expandVideoWithSound('${url}')">
        <div style="padding: 20px; text-align: center; background: #f4f4f4;">
            ${window.t('BROWSER_NOT_SUPPORTED')}
        </div>
    </video>
    <div class="file-size">${window.t('FILE_SIZE', { size: fileSize })}</div>
`;
} else if (fileType && fileType.startsWith('audio/')) {
        messageFileElement.innerHTML = `
        <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${url}', this)">

        </button>
        <span class="audio-duration">${window.t('FILE_SIZE', { size: fileSize })}</span>
    `;
    } else {


        const displayFileName = window.fileNameFormatter ?
            window.fileNameFormatter.formatFileName(fileName) :
            fileName;

        messageFileElement.innerHTML = `
        <a href="${url}" download="${fileName}" class="file-download-link" title="${fileName}">
            ${fileIcon} ${displayFileName}
        </a>
        <div class="file-size">${window.t('FILE_SIZE', { size: fileSize })}</div>
    `;
    }


    setTimeout(() => {
        if (window.fileNameFormatter) {
            window.fileNameFormatter.applyToContainer(messageFileElement);
        }
    }, 10);
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
        sendMessageBtn.title = window.t('SEND_MESSAGE_TOOLTIP');
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
        isReconnecting = false;

        if (currentUser && currentRoom) {
            socket.emit('user-join-attempt', {
                username: currentUser,
                room: currentRoom,
                password: localStorage.getItem('chatPassword') || 'pass'
            });
        }
    });

    socket.on('disconnect', (reason) => {
        isReconnecting = true;

        setTimeout(() => {
            if (isReconnecting) {
                socket.connect();
            }
        }, 2000);
    });

    socket.on('killall-message', (message) => {
        messagesContainer.innerHTML = '';
        addMessageToChat(message);

        setTimeout(() => {
            showMessage(window.t('MODAL_INFO'), window.t('SYSTEM_SERVER_SHUTDOWN'));
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
    const room = roomInput.value.trim() || window.t('ROOM_DEFAULT_VALUE');
    const password = passwordInput.value.trim();
    const language = window.languageManager ? window.languageManager.getCurrentLanguage() : 'ru';

    if (!validateInput(username)) {
        showLoginError(window.t('ERROR_INVALID_USERNAME'));
        return;
    }

    if (!validateInput(room)) {
        showLoginError(window.t('ERROR_INVALID_ROOM'));
        return;
    }

    if (username && password) {
        setCookie('chatUsername', username, 30);
        localStorage.setItem('chatPassword', password);
        socket.emit('user-join-attempt', {
            username,
            room,
            password,
            language
        });
    } else {
        showLoginError(window.t('ERROR_REQUIRED_FIELDS'));
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

        if (userInfo) userInfo.textContent = window.t('USER_INFO', { username: currentUser });
        if (roomInfo) roomInfo.textContent = window.t('ROOM_INFO', { room: currentRoom });

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

        updateInterfaceLanguage();


        if (window.fileNameFormatter && messagesContainer) {

            window.fileNameFormatter.applyToContainer(messagesContainer);


            window.fileNameFormatter.initializeObserver(messagesContainer);
        }
    });

    function updateInterfaceLanguage() {
        if (messageInput) {
            messageInput.placeholder = window.t('MESSAGE_PLACEHOLDER');
        }

        if (encryptionKeyInput) {
            encryptionKeyInput.placeholder = window.t('ENCRYPTION_KEY_PLACEHOLDER');
        }

        if (sendMessageBtn) {
            sendMessageBtn.title = window.t('SEND_MESSAGE_TOOLTIP');
        }

        const audioCallBtn = document.getElementById('audioCallBtn');
        if (audioCallBtn) {
            audioCallBtn.title = window.t('AUDIO_CALL');
        }

        const videoCallBtn = document.getElementById('videoCallBtn');
        if (videoCallBtn) {
            videoCallBtn.title = window.t('VIDEO_CALL');
        }

        const recordButton = document.getElementById('recordButton');
        if (recordButton) {
            const recordingText = document.getElementById('recordingText');
            if (recordingText) {
                recordingText.textContent = window.t('RECORDING_AUDIO');
            }
        }

        const videoRecordingText = document.getElementById('videoRecordingText');
        if (videoRecordingText) {
            videoRecordingText.textContent = window.t('RECORDING_VIDEO');
        }

        const preparingModalTitle = document.getElementById('preparingModalTitle');
        if (preparingModalTitle) {
            preparingModalTitle.textContent = window.t('MODAL_PREPARING_DEVICE');
        }
    }

    socket.on('clear-chat', () => {
        messagesContainer.innerHTML = '';
        messageHistory = [];
        addSystemMessage(window.t('SYSTEM_CHAT_CLEARED'));
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
            deleteButton.innerHTML = '<svg fill="#ff4444" width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><title>cancel</title><path d="M16 29c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13zM21.961 12.209c0.244-0.244 0.244-0.641 0-0.885l-1.328-1.327c-0.244-0.244-0.641-0.244-0.885 0l-3.761 3.761-3.761-3.761c-0.244-0.244-0.641-0.244-0.885 0l-1.328 1.327c0.244 0.244 0.244 0.641 0 0.885l3.762 3.762-3.762 3.76c-0.244 0.244-0.244 0.641 0 0.885l1.328 1.328c0.244 0.244 0.641 0.244 0.885 0l3.761-3.762 3.761 3.762c0.244 0.244 0.641 0.244 0.885 0l1.328-1.328c0.244-0.244 0.244-0.641 0-0.885l-3.762-3.76 3.762-3.762z"></path></svg>';
            deleteButton.title = window.t('DELETE_MESSAGE');
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
        showMessage(window.t('MODAL_ERROR'), `${window.t('ERROR_DELETE_MESSAGE', { error: data.error })}`);
    });

    function showDeleteConfirmation(messageId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
    <div class="modal-content">
      <h2>${window.t('MODAL_CONFIRM_DELETE')}</h2>
      <p>${window.t('MODAL_CONFIRM_DELETE_TEXT')}</p>
      <div class="modal-buttons-container">
        <button id="cancelDelete" class="modal-ok-btn" style="background-color: #6c757d;">${window.t('CANCEL')}</button>
        <button id="confirmDelete" class="modal-ok-btn" style="background-color: #dc3545;">${window.t('CONFIRM_DELETE')}</button>
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
            confirmBtn.textContent = window.t('MODAL_DELETING');

            socket.emit('delete-message', { messageId }, (response) => {
                if (response && response.error) {
                    showMessage(window.t('MODAL_ERROR'), `${window.t('ERROR_DELETE_MESSAGE', { error: response.error })}`);
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
    messageElement.dataset.messageEncrypted = message.isEncrypted ? 'true' : 'false';

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

    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let messageContent = `
        <div class="message-info">
            <span class="message-sender">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
    `;


    if (message.quote) {
        let quoteText = message.quote.text;
        let quoteUsername = message.quote.username;


        quoteText = linkifyMessageText(
            quoteText,
            message.quote.isEncrypted || false,
            false
        );

        messageContent += `
            <div class="message-quote">
                <div class="quote-username">${quoteUsername}</div>
                <div class="quote-text">${quoteText}</div>
            </div>
        `;
    }


    if (message.isFile) {

        const fileType = message.fileType || '';
        const fileName = message.fileName || '';
        const fileSize = message.fileSize || '';
        const fileUrl = message.fileUrl || '';


        const fileAnalysis = window.fileFormats ?
            window.fileFormats.analyzeFile(fileType, fileName) :
            {
                isImage: fileType && typeof fileType === 'string' && fileType.startsWith('image/'),
                shouldDisplayAsFile: false
            };

        if (message.isEncrypted) {
            messageContent += `
            <div class="message-file">
                <button class="encrypted-file-btn"
                        onclick="window.decryptAndDisplayFile('${fileUrl}', '${fileType}', '${fileName}', '${message.id}', this)"
                        data-file-url="${fileUrl}"
                        data-file-type="${fileType}"
                        data-file-name="${fileName}"
                        data-message-id="${message.id}">
                    ${window.t('FILE_ENCRYPTED_CLICK')}
                </button>
                <div class="file-info">${fileName} (${fileSize})</div>
            </div>
            `;
        } else {

            const displayFileName = window.fileNameFormatter ?
                window.fileNameFormatter.formatFileName(fileName) :
                fileName;


            const fileIcon = window.fileFormats ?
                window.fileFormats.getFileIcon(fileType, fileName) : '📄';

            if (message.isAudio) {
                const duration = message.duration || '';
                messageContent += `
                    <div class="message-audio">
                        <button class="audio-play-btn" onclick="window.audioRecorder.playAudioMessage('${fileUrl}', this)">

                        </button>
                        <span class="audio-duration">${window.t('FILE_DURATION_SIZE', { duration: duration, size: fileSize })}</span>
                    </div>
                `;
            } else if (fileAnalysis.isImage && !fileAnalysis.shouldDisplayAsFile) {

                messageContent += `
                    <div class="message-file">
                        <img src="${fileUrl}" alt="${fileName}"
                             onclick="window.expandImage('${fileUrl}', '${fileType}')">
                        <div class="file-size">${fileSize}</div>
                    </div>
                `;
            } else if (fileType && typeof fileType === 'string' && fileType.startsWith('video/')) {
                const duration = message.duration || '';
                messageContent += `
                    <div class="message-file">
                        <video src="${fileUrl}" controls muted
                               onclick="window.expandVideoWithSound('${fileUrl}', this)">
                            ${window.t('VIDEO_NOT_SUPPORTED')}
                        </video>
                        <div class="file-size">${window.t('FILE_DURATION_SIZE', { duration: duration, size: fileSize })}</div>
                    </div>
                `;
            } else {

                messageContent += `
                    <div class="message-file">
                        <a href="${fileUrl}" download="${fileName}" class="file-download-link" title="${fileName}">
                            ${fileIcon} ${displayFileName}
                        </a>
                        <div class="file-size">${fileSize}</div>
                    </div>
                `;
            }
        }
    } else {

        let messageText = message.text || '';


        messageText = linkifyMessageText(
            messageText,
            message.isEncrypted || false,
            message.isSystem || message.isKillAll || message.isWarning
        );

        messageContent += `<div class="message-text">${messageText}</div>`;
    }

    messageElement.innerHTML = messageContent;


    setTimeout(() => {
        enhanceMessageLinks(messageElement);
    }, 0);

    if (!message.isSystem && !message.isKillAll && !message.isWarning) {
        if (window.reactionsManager) {
            window.reactionsManager.addReactionButton(messageElement);
            window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
        }
    }

    messagesContainer.appendChild(messageElement);


    setTimeout(() => {
        if (window.fileNameFormatter && (message.isFile || message.isAudio)) {

            const messageFileElement = messageElement.querySelector('.message-file, .message-audio');
            if (messageFileElement) {

                window.fileNameFormatter.applyToContainer(messageFileElement);
            }
        }
    }, 10);

    setTimeout(() => {
        addDeleteButton(messageElement, message);
    }, 0);

    scrollToBottom();
}

function addClickHandlersToLinks(messageElement) {
    const links = messageElement.querySelectorAll('a.message-link');
    links.forEach(link => {

        if (link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
            if (!link.hasAttribute('rel')) {
                link.setAttribute('rel', 'noopener noreferrer');
            }
            if (!link.hasAttribute('target')) {
                link.setAttribute('target', '_blank');
            }
        }


        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

    function updateMessageReactions(messageElement, message) {
        if (window.reactionsManager) {
            window.reactionsManager.updateMessageReactions(messageElement, message.reactions);
        }
    }

    socket.on('reactions-updated', (data) => {
        const { messageId, reactions, reactionUsers } = data;

        if (!window.reactionUsersData) {
            window.reactionUsersData = new Map();
        }
        window.reactionUsersData.set(messageId, reactionUsers);

        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement && window.reactionsManager) {
            window.reactionsManager.updateMessageReactions(messageElement, reactions);
        }
    });

    socket.on('delete-message', (data, callback) => {
        const user = users.get(socket.id);
        if (user) {
            const { messageId } = data;

            const message = messageHistory.find(msg => msg.id === messageId);
            if (!message) {
                if (callback) callback({ error: window.t('ERROR_MESSAGE_NOT_FOUND') });
                return;
            }

            if (message.username === user.username) {
                const deleteResult = deleteMessageFromFiles(user.room, messageId, user.username);

                if (deleteResult) {
                    const index = messageHistory.findIndex(msg => msg.id === messageId);
                    if (index !== -1) {
                        messageHistory.splice(index, 1);
                    }

                    messageReactions.delete(messageId);
                    reactionUsers.delete(messageId);

                    io.to(user.room).emit('message-deleted', { messageId });

                    if (callback) callback({ success: true });
                } else {
                    if (callback) callback({ error: window.t('ERROR_FILE_DELETE') });
                }
            } else {
                if (callback) callback({ error: window.t('ERROR_CANNOT_DELETE_OTHERS') });
            }
        } else {
            if (callback) callback({ error: window.t('ERROR_UNAUTHORIZED') });
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
        addSystemMessage(window.t('SYSTEM_USER_JOINED', { username: user.username }));
    });

    socket.on('user-left-room', (user) => {
        addSystemMessage(window.t('SYSTEM_USER_LEFT', { username: user.username }));
    });

    window.expandImage = function(imageUrl, fileType) {
        if (imageModal.classList.contains('active')) {
            closeImageModal();
            return;
        }

        if (!imageModal || !modalImage) {
            return;
        }

        imageModal.classList.add('active');

        modalImage.src = imageUrl;
        modalImage.alt = window.t('IMAGE_LOAD_ERROR');

        modalImage.onload = function() {};

        modalImage.onerror = function() {
    modalImage.alt = window.t('IMAGE_LOAD_ERROR');
    modalImage.style.display = 'none';


    const errorContainer = document.createElement('div');
    errorContainer.className = 'image-error-container';
    errorContainer.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f4f4f4;
        color: #999;
        font-family: sans-serif;
        padding: 20px;
        box-sizing: border-box;
        text-align: center;
    `;

    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🖼️</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">${window.t('IMAGE_LOAD_ERROR')}</div>
        <div style="font-size: 14px;">${window.t('UNSUPPORTED_FORMAT')}</div>
    `;


    const imageContainer = modalImage.parentElement;
    if (imageContainer) {
        imageContainer.appendChild(errorContainer);
    }
    };
    };

    function closeImageModal() {
        if (!imageModal || !modalImage) {
            return;
        }

        modalImage.onload = null;
        modalImage.onerror = null;

        const imageErrorContainers = imageModal.querySelectorAll('.image-error-container');
        imageErrorContainers.forEach(container => {
            container.remove();
        });
        modalImage.style.display = '';

        imageModal.classList.remove('active');

        setTimeout(() => {
            modalImage.src = '';
        }, 300);
    }


window.videoPlaybackManager = {
    activeModalVideo: null,
    pausedChatVideos: new Set(),

    pauseAllChatVideos() {
        const allChatVideos = document.querySelectorAll('#messagesContainer video');
        this.pausedChatVideos.clear();

        allChatVideos.forEach(video => {
            if (!video.paused) {
                video.pause();
                this.pausedChatVideos.add(video);
            }
        });
    },

    resumePausedChatVideos() {
        this.pausedChatVideos.forEach(video => {
            if (document.body.contains(video)) {
                video.play().catch(error => {

                });
            }
        });
        this.pausedChatVideos.clear();
    },

    setActiveModalVideo(videoElement) {
        this.activeModalVideo = videoElement;
    },

    clearActiveModalVideo() {
        this.activeModalVideo = null;
    }
};

window.expandVideoWithSound = function(videoUrl, chatVideoElement = null) {
    const isMobile = window.innerWidth <= 770;


    const allChatVideos = document.querySelectorAll('#messagesContainer video');
    const pausedChatVideos = [];

    allChatVideos.forEach(video => {
        if (!video.paused) {
            video.pause();
            pausedChatVideos.push(video);
        }
    });


    window.pausedChatVideosForRestore = pausedChatVideos;


    if (chatVideoElement && chatVideoElement.tagName === 'VIDEO') {
        if (!chatVideoElement.paused) {
            chatVideoElement.pause();

            window.pausedChatVideosForRestore.unshift(chatVideoElement);
        }
        window.clickedChatVideo = chatVideoElement;
    } else {
        window.clickedChatVideo = null;
    }


    window.videoModalDebug = window.videoModalDebug || {
        openAttempts: 0,
        lastVideoUrl: '',
        modalState: 'unknown'
    };

    window.videoModalDebug.openAttempts++;
    window.videoModalDebug.lastVideoUrl = videoUrl;

    if (!videoModal) {
        window.videoModalDebug.modalState = 'not_found';
        return;
    }

    if (!modalVideo) {
        window.videoModalDebug.modalState = 'video_not_found';
        return;
    }


    if (!modalVideo.paused) {
        modalVideo.pause();
    }

    videoModal.classList.add('active');
    window.videoModalDebug.modalState = 'opening';

    setTimeout(() => {

        if (modalVideo.src && modalVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(modalVideo.src);
        }


        modalVideo.src = videoUrl;
        modalVideo.controls = true;
        modalVideo.muted = false;


        modalVideo.onloadeddata = function() {
            window.videoModalDebug.modalState = 'video_loaded';


            modalVideo.play().then(() => {

            }).catch(error => {

                console.log('Autoplay blocked, user interaction required');
            });
        };

        modalVideo.onerror = function(e) {
    if (!videoModal.classList.contains('active')) {
        return;
    }

    window.videoModalDebug.modalState = 'video_load_error';
    console.error('Video load error:', e);

    if (videoModal.classList.contains('active')) {
        modalVideo.controls = false;
        modalVideo.style.display = 'none';


        const errorContainer = document.createElement('div');
        errorContainer.className = 'video-error-container';
        errorContainer.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #000;
            color: #fff;
            font-family: sans-serif;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
        `;

        errorContainer.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🎥</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">${window.t('VIDEO_LOAD_ERROR')}</div>
            <div style="font-size: 14px; margin-bottom: 8px;">${window.t('UNSUPPORTED_FORMAT')}</div>
            <div style="font-size: 12px; opacity: 0.7;">${window.t('BROWSER_NOT_SUPPORTED')}</div>
        `;


        const videoContainer = modalVideo.parentElement;
        if (videoContainer) {
            videoContainer.appendChild(errorContainer);
        }
    }
};

        modalVideo.onplay = function() {

            const currentChatVideos = document.querySelectorAll('#messagesContainer video');
            currentChatVideos.forEach(video => {
                if (!video.paused) {
                    video.pause();
                }
            });
        };

        modalVideo.onpause = function() {

        };

        modalVideo.onended = function() {


        };


        modalVideo.addEventListener('playing', function() {

            const checkAndPauseChatVideos = () => {
                const chatVideos = document.querySelectorAll('#messagesContainer video');
                let foundPlaying = false;

                chatVideos.forEach(video => {
                    if (!video.paused && video !== modalVideo) {
                        video.pause();
                        foundPlaying = true;
                    }
                });

                if (foundPlaying) {

                    setTimeout(checkAndPauseChatVideos, 100);
                }
            };

            checkAndPauseChatVideos();
        });

    }, 10);

    setTimeout(() => {
        if (videoModal.classList.contains('active')) {
            window.videoModalDebug.modalState = 'opened';
        } else {
            window.videoModalDebug.modalState = 'failed_to_open';
        }
    }, 100);
};


function restoreChatVideosOnModalClose() {
    if (window.pausedChatVideosForRestore && window.pausedChatVideosForRestore.length > 0) {

        const validVideos = window.pausedChatVideosForRestore.filter(video =>
            video && video.tagName === 'VIDEO' && document.body.contains(video)
        );


        if (window.clickedChatVideo &&
            document.body.contains(window.clickedChatVideo) &&
            window.clickedChatVideo.tagName === 'VIDEO') {


            setTimeout(() => {
                window.clickedChatVideo.play().catch(error => {

                });
            }, 300);
        }


        window.pausedChatVideosForRestore = [];
        window.clickedChatVideo = null;
    }
}


function closeVideoModal() {
    if (!videoModal || !modalVideo) {
        return;
    }


    modalVideo.pause();
    modalVideo.currentTime = 0;


    modalVideo.onloadeddata = null;
    modalVideo.onerror = null;
    modalVideo.onplay = null;
    modalVideo.onpause = null;
    modalVideo.onended = null;

    const errorContainers = videoModal.querySelectorAll('.video-error-container, .image-error-container');
errorContainers.forEach(container => {
    container.remove();
});
modalVideo.style.display = '';


    const clone = modalVideo.cloneNode(true);
    modalVideo.parentNode.replaceChild(clone, modalVideo);
    modalVideo = clone;

    videoModal.classList.remove('active');
    window.videoModalDebug.modalState = 'closing';

    setTimeout(() => {
        if (modalVideo.src && modalVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(modalVideo.src);
            modalVideo.removeAttribute('src');
            modalVideo.load();
        }
        modalVideo.controls = false;
        modalVideo.poster = '';
        window.videoModalDebug.modalState = 'closed';


    }, 300);
}


document.addEventListener('play', function(e) {
    const target = e.target;


    if (target === modalVideo) {

        const chatVideos = document.querySelectorAll('#messagesContainer video');
        chatVideos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });
    }


    if (target.tagName === 'VIDEO' &&
        target.closest('#messagesContainer') &&
        videoModal.classList.contains('active')) {


        target.pause();

        if (modalVideo && modalVideo.paused) {
            modalVideo.play().catch(() => {});
        }

        e.preventDefault();
        e.stopPropagation();
    }
}, true);


function restoreChatVideoPlayback() {

    if (window.pausedChatVideo && window.pausedChatVideo.tagName === 'VIDEO') {

        if (document.body.contains(window.pausedChatVideo)) {
            window.pausedChatVideo.play().catch(error => {

            });
        }
        window.pausedChatVideo = null;
    }
}

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
    if (!videoModal || !modalVideo) {
        return;
    }


    modalVideo.pause();
    modalVideo.currentTime = 0;

    modalVideo.onloadeddata = null;
    modalVideo.onerror = null;
    modalVideo.onended = null;
    modalVideo.onpause = null;

    videoModal.classList.remove('active');
    window.videoModalDebug.modalState = 'closing';
    window.videoPlaybackManager.clearActiveModalVideo();

    setTimeout(() => {
        if (modalVideo.src) {
            URL.revokeObjectURL(modalVideo.src);
            modalVideo.removeAttribute('src');
            modalVideo.load();
        }
        modalVideo.controls = false;
        modalVideo.poster = '';
        window.videoModalDebug.modalState = 'closed';


        window.videoPlaybackManager.resumePausedChatVideos();
    }, 300);
}


    function setupImageModal() {
        if (!imageModal) {
            return;
        }

        if (!modalImage) {
            return;
        }

        const imageCloseBtn = imageModal.querySelector('.image-close-btn');

        if (imageCloseBtn) {
            imageCloseBtn.addEventListener('click', (e) => {
                closeImageModal();
                e.stopPropagation();
            });
        }

        const imageOverlay = imageModal.querySelector('.image-modal-overlay');
        if (imageOverlay) {
            imageOverlay.addEventListener('click', (e) => {
                closeImageModal();
            });
        }

        modalImage.addEventListener('click', (e) => {
            closeImageModal();
            e.stopPropagation();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageModal.classList.contains('active')) {
                closeImageModal();
            }
        });
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
        if (!videoModal) {
            return;
        }

        if (!modalVideo) {
            return;
        }

        const videoOverlay = videoModal.querySelector('.video-modal-overlay');
        const videoCloseBtn = videoModal.querySelector('.video-close-btn');

        if (videoOverlay) {
            videoOverlay.addEventListener('click', (e) => {
                closeVideoModal();
            });
        }

        if (videoCloseBtn) {
            videoCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeVideoModal();
            });
        } else {
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
            }
        }

        modalVideo.addEventListener('click', (e) => {
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
                closeVideoModal();
            }
        });

        modalVideo.onended = function() {};

        modalVideo.addEventListener('play', function() {
            if (window.innerWidth <= 770 && this.webkitEnterFullscreen) {
                try {
                    this.webkitEnterFullscreen();
                } catch (error) {}
            }
        });
    }

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            addSystemMessage(window.t('ERROR_FILE_TOO_LARGE'));
            fileInput.value = '';
            return;
        }

        showFileUploadIndicator(file.name);

        currentFileReader = new FileReader();

        currentFileReader.onload = async function(event) {
            let fileData = event.target.result.split(',')[1];
            let isEncrypted = false;

            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                try {
                    fileData = window.encryptionManager.encryptFile(fileData);
                    isEncrypted = true;
                } catch (error) {}
            } else {}

            socket.emit('send-file', {
                fileName: file.name,
                fileType: file.type,
                fileData: fileData,
                isEncrypted: isEncrypted
            }, (response) => {
                if (response && response.error) {
                    addSystemMessage(window.t('ERROR_FILE_SEND', { filename: file.name, error: response.error }));
                    showFileUploadError();
                } else {
                    hideFileUploadIndicator();
                }
            });
        };

        currentFileReader.onerror = function() {
            addSystemMessage(window.t('ERROR_FILE_READ', { filename: file.name }));
            showFileUploadError();
            fileInput.value = '';
        };

        currentFileReader.onabort = function() {
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
                        messageData.quote.isEncrypted = false;
                    }
                }
            }

            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                try {
                    messageData.text = window.encryptionManager.encryptMessage(text);
                    messageData.isEncrypted = true;
                } catch (error) {
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
                    quoteText = window.t('ERROR_WRONG_ENCRYPTION_KEY');
                }
            } else {
                quoteText = window.t('ERROR_WRONG_ENCRYPTION_KEY');
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
            return;
        }

        const messageId = messageElement.dataset.messageId;
        const messageUsername = messageElement.dataset.messageUsername;
        const messageTextElement = messageElement.querySelector('.message-text');

        if (!messageTextElement) {
            return;
        }


        let messageText = messageTextElement.innerHTML;


        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageText;
        messageText = tempDiv.textContent || tempDiv.innerText || '';

        const originalMessage = messageHistory.find(msg => msg.id === messageId);
        if (!originalMessage) {
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
            return;
        }

        callButtonsContainer.innerHTML = '';

        const audioCallBtn = document.createElement('button');
        audioCallBtn.id = 'audioCallBtn';
        audioCallBtn.className = 'call-btn';
        audioCallBtn.innerHTML = '<img src="icons/call.svg" alt="File icon" class="file-icon">';
        audioCallBtn.title = window.t('AUDIO_CALL');

        const videoCallBtn = document.createElement('button');
        videoCallBtn.id = 'videoCallBtn';
        videoCallBtn.className = 'call-btn';
        videoCallBtn.innerHTML = '<img src="icons/camera-5.svg" alt="File icon" class="file-icon">';
        videoCallBtn.title = window.t('VIDEO_CALL');

        callButtonsContainer.appendChild(audioCallBtn);
        callButtonsContainer.appendChild(videoCallBtn);

        audioCallBtn.addEventListener('click', () => {
            if (window.webrtcManager) {
                window.webrtcManager.showUserSelectionModal('audio');
            } else {}
        });

        videoCallBtn.addEventListener('click', () => {
            if (window.webrtcManager) {
                window.webrtcManager.showUserSelectionModal('video');
            } else {}
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


            updateClearButtonVisibility();


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


            updateClearButtonVisibility();


            reDecryptAllMessages();
        });
    }
}

    function reDecryptAllMessages() {

    const scrollPosition = messagesContainer.scrollTop;
    const isAtBottom = Math.abs(messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop) < 10;


    messagesContainer.innerHTML = '';


    messageHistory.forEach(message => {
        addMessageToChat(message);
    });


    if (isAtBottom) {
        scrollToBottom();
    } else {
        messagesContainer.scrollTop = scrollPosition;
    }
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
        if (videoModal && videoModal.classList.contains('active')) {}
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
        <div class="upload-text">${window.t('UPLOADING', { filename: fileName })}</div>
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
        currentFileUploadIndicator.querySelector('.upload-text').textContent = window.t('UPLOAD_ERROR');

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

    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = window.languageManager.getCurrentLanguage();

        languageSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            window.setLanguage(lang);
            updateInterfaceLanguage();
        });
    }
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
    setTimeout(() => {
        if (window.languageManager) {
            window.languageManager.updateLoginModal();
        }
    }, 1);
    setTimeout(handleViewportResize, 100);
    setTimeout(handleViewportResize, 500);
});


document.addEventListener('play', function(e) {
    const target = e.target;

    if (target.tagName === 'VIDEO' && target.closest('#messagesContainer')) {

        const allChatVideos = document.querySelectorAll('#messagesContainer video');

        allChatVideos.forEach(video => {
            if (video !== target && !video.paused) {
                video.pause();
            }
        });


        if (modalVideo && modalVideo.src && !modalVideo.paused) {
            modalVideo.pause();
        }
    }


    if (target.tagName === 'VIDEO' && target === modalVideo) {

        const allChatVideos = document.querySelectorAll('#messagesContainer video');
        allChatVideos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });
    }
}, true);

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