// webrtc.js - Управление WebRTC звонками
class WebRTCManager {
    constructor(socket) {
        if (!socket) {
            console.error('WebRTCManager: Socket is required');
            return;
        }
        
        this.socket = socket;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isCallActive = false;
        this.callType = null;
        this.targetUser = null;
        this.room = null;
        
        this.setupSocketListeners();
        this.setupUI();
    }
    
    setupSocketListeners() {
        // Обработка входящего предложения звонка
        this.socket.on('webrtc-offer', async (data) => {
            if (this.isCallActive) {
                this.sendCallRejected(data.from, 'Уже в звонке');
                return;
            }
            
            this.showIncomingCallModal(data);
        });
        
        // Обработка входящего ответа на звонок
        this.socket.on('webrtc-answer', async (data) => {
            if (!this.peerConnection) return;
            
            try {
                await this.peerConnection.setRemoteDescription(data.answer);
            } catch (error) {
                console.error('Ошибка при установке ответа:', error);
            }
        });
        
        // Обработка ICE кандидатов
        this.socket.on('webrtc-ice-candidate', async (data) => {
            if (!this.peerConnection) return;
            
            try {
                await this.peerConnection.addIceCandidate(data.candidate);
            } catch (error) {
                console.error('Ошибка при добавлении ICE кандидата:', error);
            }
        });
        
        // Обработка отклонения звонка
        this.socket.on('webrtc-reject', (data) => {
            this.hideCallModal();
            if (window.showMessage) {
                window.showMessage('Звонок', `Пользователь ${data.fromUsername} отклонил звонок`);
            } else {
                alert(`Пользователь ${data.fromUsername} отклонил звонок`);
            }
        });
        
        // Обработка завершения звонка
        this.socket.on('webrtc-hangup', (data) => {
            this.endCall();
            if (window.showMessage) {
                window.showMessage('Звонок', `Пользователь ${data.fromUsername} завершил звонок`);
            } else {
                alert(`Пользователь ${data.fromUsername} завершил звонок`);
            }
        });
    }
    
    setupUI() {
        // Создаем модальное окно для выбора пользователя
        this.createUserSelectionModal();
        
        // Создаем модальное окно для входящего звонка
        this.createIncomingCallModal();
        
        // Создаем интерфейс активного звонка
        this.createCallInterface();
    }
    
    createUserSelectionModal() {
        const modal = document.createElement('div');
        modal.id = 'userSelectionModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
    <div class="modal-content">
        <h2>Выберите пользователя для звонка</h2>
        <div id="availableUsersList"></div>
        <div class="modal-buttons-container">
            <button id="cancelCallBtn" class="modal-call-btn">Отмена</button>
        </div>
    </div>
`;
        document.body.appendChild(modal);
        
        document.getElementById('cancelCallBtn').addEventListener('click', () => {
            this.hideUserSelectionModal();
        });
    }
    
    createIncomingCallModal() {
        const modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
    <div class="modal-content">
        <h2>Входящий звонок</h2>
        <p id="incomingCallInfo"></p>
        <div class="call-buttons">
            <button id="acceptCallBtn" class="modal-call-btn">Принять</button>
            <button id="rejectCallBtn" class="modal-call-btn">Отклонить</button>
        </div>
    </div>
`;
        document.body.appendChild(modal);
        
        document.getElementById('acceptCallBtn').addEventListener('click', () => {
            this.acceptIncomingCall();
        });
        
        document.getElementById('rejectCallBtn').addEventListener('click', () => {
            this.rejectIncomingCall();
        });
    }
    
    createCallInterface() {
        const callInterface = document.createElement('div');
        callInterface.id = 'callInterface';
        callInterface.className = 'call-container hidden';
        callInterface.innerHTML = `
    <div class="video-container">
        <video id="localVideo" autoplay muted></video>
        <video id="remoteVideo" autoplay></video>
    </div>
    <div class="call-controls">
        <button id="endCallBtn" class="call-end-btn">Завершить звонок</button>
    </div>
`;
        document.body.appendChild(callInterface);
        
        document.getElementById('endCallBtn').addEventListener('click', () => {
            this.endCall();
        });
    }
    
    showUserSelectionModal(type) {
    this.callType = type;
    const modal = document.getElementById('userSelectionModal');
    const usersList = document.getElementById('availableUsersList');
    
    // Получаем текущего пользователя
    const currentUserElement = document.getElementById('userInfo');
    let currentUsername = '';
    if (currentUserElement) {
        // Удаляем символ ✪ из имени пользователя
        currentUsername = currentUserElement.textContent.replace('✪ ', '');
    }
    
    // Получаем список пользователей в комнате (кроме текущего пользователя)
    const roomUsers = Array.from(document.querySelectorAll('.user-item'))
        .map(userEl => userEl.textContent)
        .filter(username => username !== currentUsername);
    
    if (roomUsers.length === 0) {
        if (window.showMessage) {
            window.showMessage('Информация', 'В комнате нет других пользователей');
        } else {
            alert('В комнате нет других пользователей');
        }
        return;
    }
    
    usersList.innerHTML = '';
    roomUsers.forEach(username => {
        const userBtn = document.createElement('button');
        userBtn.className = 'user-call-btn';
        userBtn.textContent = username;
        userBtn.addEventListener('click', () => {
            this.startCall(username);
        });
        usersList.appendChild(userBtn);
    });
    
    modal.classList.remove('hidden');
}
    
    hideUserSelectionModal() {
        document.getElementById('userSelectionModal').classList.add('hidden');
    }
    
    showIncomingCallModal(data) {
        this.incomingCallData = data;
        const modal = document.getElementById('incomingCallModal');
        const callInfo = document.getElementById('incomingCallInfo');
        
        callInfo.textContent = `Пользователь ${data.fromUsername} звонит вам (${data.type === 'video' ? 'видео' : 'аудио'})`;
        modal.classList.remove('hidden');
    }
    
    hideIncomingCallModal() {
        document.getElementById('incomingCallModal').classList.add('hidden');
    }
    
    showCallInterface() {
        document.getElementById('callInterface').classList.remove('hidden');
    }
    
    hideCallInterface() {
        document.getElementById('callInterface').classList.add('hidden');
    }
    
    async startCall(targetUsername) {
        this.targetUser = targetUsername;
        this.room = document.getElementById('roomInfo').textContent.replace('Комната: ', '');
        this.hideUserSelectionModal();
        
        try {
            // Запрос доступа к медиаустройствам
            this.localStream = await window.mediaDevicesManager.requestMediaAccess(
                this.callType === 'video', 
                true
            );
            
            // Создаем PeerConnection
            this.createPeerConnection();
            
            // Добавляем локальный поток
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Показываем локальное видео (если это видео звонок)
            if (this.callType === 'video') {
                document.getElementById('localVideo').srcObject = this.localStream;
            } else {
                // Для аудио звонка показываем placeholder
                document.getElementById('localVideo').poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjM1ZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiIGZvbnQtc2l6U9IjIwIj5BdWRpbyBDYWxsPC90ZXh0Pjwvc3ZnPg==';
            }
            
            // Создаем и отправляем предложение
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                offer: offer,
                type: this.callType,
                targetUsername: targetUsername,
                room: this.room
            });
            
            this.isCallActive = true;
            this.showCallInterface();
            
            // Таймаут ожидания ответа (30 секунд)
            this.callTimeout = setTimeout(() => {
                if (this.isCallActive && !this.peerConnection.remoteDescription) {
                    this.endCall();
                    if (window.showMessage) {
                        window.showMessage('Звонок', 'Пользователь не ответил на звонок');
                    } else {
                        alert('Пользователь не ответил на звонок');
                    }
                }
            }, 30000);
            
        } catch (error) {
            console.error('Ошибка начала звонка:', error);
            if (window.showMessage) {
                window.showMessage('Ошибка', 'Не удалось начать звонок: ' + error.message);
            } else {
                alert('Не удалось начать звонок: ' + error.message);
            }
        }
    }
    
    async acceptIncomingCall() {
        if (!this.incomingCallData) return;
        
        this.callType = this.incomingCallData.type;
        this.targetUser = this.incomingCallData.fromUsername;
        this.hideIncomingCallModal();
        
        try {
            // Запрос доступа к медиаустройствам
            this.localStream = await window.mediaDevicesManager.requestMediaAccess(
                this.callType === 'video', 
                true
            );
            
            // Создаем PeerConnection
            this.createPeerConnection();
            
            // Добавляем локальный поток
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Показываем локальное видео (если это видео звонок)
            if (this.callType === 'video') {
                document.getElementById('localVideo').srcObject = this.localStream;
            } else {
                // Для аудио звонка показываем placeholder
                document.getElementById('localVideo').poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjM1ZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiIGZvbnQtc2l6U9IjIwIj5BdWRpbyBDYWxsPC90ZXh0Pjwvc3ZnPg==';
            }
            
            // Устанавливаем удаленное предложение
            await this.peerConnection.setRemoteDescription(this.incomingCallData.offer);
            
            // Создаем и отправляем ответ
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('webrtc-answer', {
                answer: answer,
                targetUsername: this.incomingCallData.fromUsername
            });
            
            this.isCallActive = true;
            this.showCallInterface();
            
        } catch (error) {
            console.error('Ошибка при принятии звонка:', error);
            if (window.showMessage) {
                window.showMessage('Ошибка', 'Не удалось принять звонок: ' + error.message);
            } else {
                alert('Не удалось принять звонок: ' + error.message);
            }
        }
    }
    
    rejectIncomingCall() {
        if (!this.incomingCallData) return;
        
        this.socket.emit('webrtc-reject', {
            targetUsername: this.incomingCallData.fromUsername
        });
        
        this.hideIncomingCallModal();
        this.incomingCallData = null;
    }
    
    sendCallRejected(targetUsername, reason) {
        this.socket.emit('webrtc-reject', {
            targetUsername: targetUsername,
            reason: reason
        });
    }
    
    createPeerConnection() {
        // Получаем конфигурацию ICE серверов из глобальной переменной
        const iceServers = window.rtcConfig?.iceServers || [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        
        const config = {
            iceServers: iceServers,
            iceTransportPolicy: 'all' // Используем и STUN и TURN
        };
        
        console.log('Создание PeerConnection с ICE серверами:', iceServers);
        
        this.peerConnection = new RTCPeerConnection(config);
        
        // Обработка получения удаленного потока
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            document.getElementById('remoteVideo').srcObject = this.remoteStream;
        };
        
        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.targetUser) {
                this.socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    targetUsername: this.targetUser
                });
            }
        };
        
        // Обработка изменения состояния соединения
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Состояние соединения:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'disconnected' ||
                this.peerConnection.connectionState === 'failed') {
                this.endCall();
            }
        };
        
        // Обработка ICE соединения
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('Состояние ICE соединения:', this.peerConnection.iceConnectionState);
            
            if (this.peerConnection.iceConnectionState === 'disconnected' ||
                this.peerConnection.iceConnectionState === 'failed') {
                console.log('Проблемы с ICE соединением, возможно нужен TURN сервер');
            }
        };
    }
    
    endCall() {
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.targetUser) {
            this.socket.emit('webrtc-hangup', {
                targetUsername: this.targetUser
            });
        }
        
        this.remoteStream = null;
        this.isCallActive = false;
        this.targetUser = null;
        
        // Очищаем видео элементы
        document.getElementById('localVideo').srcObject = null;
        document.getElementById('remoteVideo').srcObject = null;
        document.getElementById('localVideo').poster = '';
        
        this.hideCallInterface();
    }
}
