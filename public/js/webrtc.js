const poster_call = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIEdlbmVyYXRvcjogU1ZHIFJlcG8gTWl4ZXIgVG9vbHMgLS0+Cgo8c3ZnCiAgIHdpZHRoPSIxNDAwIgogICBoZWlnaHQ9IjgwMCIKICAgdmlld0JveD0iMCAwIDQyIDI0IgogICBmaWxsPSJub25lIgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxIgogICBzb2RpcG9kaTpkb2NuYW1lPSJpbWFnZS5zdmciCiAgIGlua3NjYXBlOnZlcnNpb249IjEuNC4yIChmNDMyN2Y0LCAyMDI1LTA1LTEzKSIKICAgeG1sbnM6aW5rc2NhcGU9Imh0dHA6Ly93d3cuaW5rc2NhcGUub3JnL25hbWVzcGFjZXMvaW5rc2NhcGUiCiAgIHhtbG5zOnNvZGlwb2RpPSJodHRwOi8vc29kaXBvZGkuc291cmNlZm9yZ2UubmV0L0RURC9zb2RpcG9kaS0wLmR0ZCIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzMSIgLz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9Im5hbWVkdmlldzEiCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjMDAwMDAwIgogICAgIGJvcmRlcm9wYWNpdHk9IjAuMjUiCiAgICAgaW5rc2NhcGU6c2hvd3BhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlY2hlY2tlcmJvYXJkPSIwIgogICAgIGlua3NjYXBlOmRlc2tjb2xvcj0iI2QxZDFkMSIKICAgICBpbmtzY2FwZTp6b29tPSIwLjcxMzI5Mzk3IgogICAgIGlua3NjYXBlOmN4PSI2MjguNzczMDIiCiAgICAgaW5rc2NhcGU6Y3k9IjM0NC4xNzc4NyIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjE5MjAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iMTAwOSIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMTkxMiIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iLTgiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJzdmcxIiAvPgogIDxwYXRoCiAgICAgZD0ibSAxOC4wMTE4NTYsOC43MTcxMTA0IGMgMS45NTI2LC0xLjk1MjYyIDUuMTE4NCwtMS45NTI2MiA3LjA3MTEsMCBtIC05Ljg5OTcxLC0yLjgyODIzIGMgMy41MTQ3MiwtMy41MTQ3MiA5LjIxMzIxLC0zLjUxNDcyIDEyLjcyNzkxLDAgbSAtMy41MjcsMTAuMjEzNDY5NiBjIC0xLjY1MzYsLTAuMzc4NiAtNC4wMjAyLC0wLjM3ODYgLTUuNjczODMsMCAtMC43MzYxMywwLjE2ODUgLTEuMTYzMDcsMC44Njk2IC0xLjE2MzA3LDEuNjI0OCB2IDAuMTQyOCBjIDAsMC44MTMxIC0wLjQ5MjI0LDEuNTQ1MyAtMS4yNDUxOCwxLjg1MjEgbCAtMSwwLjQwNzYgYyAtMS4zMTU0MywwLjUzNjEgLTIuNzU0ODIsLTAuNDMxNiAtMi43NTQ4MiwtMS44NTIxIHYgLTEuNjE5NiBjIDAsLTAuNTM3IDAuMjExMDYsLTEuMDU4MSAwLjYxOTk1LC0xLjQwNjMgNC42OTY2OCwtMy45OTkxIDEyLjA2MzQ1LC0zLjk5OTEgMTYuNzYwMTUsMCAwLjQwODgsMC4zNDgyIDAuNjE5OSwwLjg2OTMgMC42MTk5LDEuNDA2MyB2IDEuNjE5NiBjIDAsMS40MjA1IC0xLjQzOTQsMi4zODgyIC0yLjc1NDgsMS44NTIxIGwgLTEsLTAuNDA3NiBjIC0wLjc1MywtMC4zMDY4IC0xLjI0NTIsLTEuMDM5IC0xLjI0NTIsLTEuODUyMSB2IC0wLjE0MjggYyAwLC0wLjc1NTIgLTAuNDI2OSwtMS40NTYzIC0xLjE2MzEsLTEuNjI0OCB6IgogICAgIHN0cm9rZT0iI2VlZWVlZSIKICAgICBzdHJva2Utd2lkdGg9IjIiCiAgICAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogICAgIHN0cm9rZS1saW5lam9pbj0icm91bmQiCiAgICAgaWQ9InBhdGgxIiAvPgo8L3N2Zz4K';
class WebRTCManager {
	constructor(socket) {
		if (!socket) {
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
		this.socket.on('webrtc-offer', async (data) => {
			if (this.isCallActive) {
				this.sendCallRejected(data.from, window.t('MODAL_ALREADY_IN_CALL'));
				return;
			}
			this.showIncomingCallModal(data);
		});
		this.socket.on('webrtc-answer', async (data) => {
			if (!this.peerConnection) return;
			try {
				await this.peerConnection.setRemoteDescription(data.answer);
			} catch (error) {}
		});
		this.socket.on('webrtc-ice-candidate', async (data) => {
			if (!this.peerConnection) return;
			try {
				await this.peerConnection.addIceCandidate(data.candidate);
			} catch (error) {}
		});
		this.socket.on('webrtc-reject', (data) => {
			this.hideCallModal();
			if (window.showMessage) {
				window.showMessage(window.t('MODAL_CALL'), window.t('MODAL_CALL_REJECTED', { username: data.fromUsername }));
			} else {
				alert(window.t('MODAL_CALL_REJECTED', { username: data.fromUsername }));
			}
		});
		this.socket.on('webrtc-hangup', (data) => {
			this.endCall();
			if (window.showMessage) {
				window.showMessage(window.t('MODAL_CALL'), window.t('MODAL_CALL_ENDED', { username: data.fromUsername }));
			} else {
				alert(window.t('MODAL_CALL_ENDED', { username: data.fromUsername }));
			}
		});
	}
	setupUI() {
		this.createUserSelectionModal();
		this.createIncomingCallModal();
		this.createCallInterface();
	}
	createUserSelectionModal() {
		const modal = document.createElement('div');
		modal.id = 'userSelectionModal';
		modal.className = 'modal hidden';
		modal.innerHTML = `
    <div class="modal-content">
        <h2>${window.t('MODAL_SELECT_USER')}</h2>
        <div id="availableUsersList"></div>
        <div class="modal-buttons-container">
            <button id="cancelCallBtn" class="modal-call-btn">${window.t('CANCEL')}</button>
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
        <h2>${window.t('MODAL_INCOMING_CALL')}</h2>
        <p id="incomingCallInfo"></p>
        <div class="call-buttons">
            <button id="acceptCallBtn" class="modal-call-btn">${window.t('MODAL_ACCEPT_CALL')}</button>
            <button id="rejectCallBtn" class="modal-call-btn">${window.t('MODAL_REJECT_CALL')}</button>
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
        <button id="endCallBtn" class="call-end-btn">${window.t('END_CALL')}</button>
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
		const currentUserElement = document.getElementById('userInfo');
		let currentUsername = '';
		if (currentUserElement) {
			currentUsername = currentUserElement.textContent.replace('✪ ', '');
		}
		const roomUsers = Array.from(document.querySelectorAll('.user-item'))
			.map(userEl => userEl.textContent)
			.filter(username => username !== currentUsername);
		if (roomUsers.length === 0) {
			if (window.showMessage) {
				window.showMessage(window.t('MODAL_INFO'), window.t('MODAL_NO_USERS'));
			} else {
				alert(window.t('MODAL_NO_USERS'));
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
		const typeText = data.type === 'video' ? window.t('VIDEO_CALL') : window.t('AUDIO_CALL');
		callInfo.textContent = window.t('MODAL_INCOMING_CALL_INFO', { username: data.fromUsername, type: typeText });
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
		this.room = document.getElementById('roomInfo').textContent.replace('Комната: ', '').replace('Room: ', '').replace('Sala: ', '').replace('房间：', '');
		this.hideUserSelectionModal();
		try {
			this.localStream = await window.mediaDevicesManager.requestMediaAccess(
				this.callType === 'video',
				true
			);
			this.createPeerConnection();
			this.localStream.getTracks().forEach(track => {
				this.peerConnection.addTrack(track, this.localStream);
			});
			if (this.callType === 'video') {
				document.getElementById('localVideo').srcObject = this.localStream;
			} else {
				document.getElementById('localVideo').poster = poster_call;
				document.getElementById('remoteVideo').poster = poster_call;
			}
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
			this.callTimeout = setTimeout(() => {
				if (this.isCallActive && !this.peerConnection.remoteDescription) {
					this.endCall();
					if (window.showMessage) {
						window.showMessage(window.t('MODAL_CALL'), window.t('MODAL_CALL_NO_ANSWER'));
					} else {
						alert(window.t('MODAL_CALL_NO_ANSWER'));
					}
				}
			}, 30000);
		} catch (error) {
			if (window.showMessage) {
				window.showMessage(window.t('MODAL_ERROR'), window.t('ERROR_CALL_START', { error: error.message }));
			} else {
				alert(window.t('ERROR_CALL_START', { error: error.message }));
			}
		}
	}
	async acceptIncomingCall() {
		if (!this.incomingCallData) return;
		this.callType = this.incomingCallData.type;
		this.targetUser = this.incomingCallData.fromUsername;
		this.hideIncomingCallModal();
		try {
			this.localStream = await window.mediaDevicesManager.requestMediaAccess(
				this.callType === 'video',
				true
			);
			this.createPeerConnection();
			this.localStream.getTracks().forEach(track => {
				this.peerConnection.addTrack(track, this.localStream);
			});
			if (this.callType === 'video') {
				document.getElementById('localVideo').srcObject = this.localStream;
			} else {
				document.getElementById('localVideo').poster = poster_call;
				document.getElementById('remoteVideo').poster = poster_call;
			}
			await this.peerConnection.setRemoteDescription(this.incomingCallData.offer);
			const answer = await this.peerConnection.createAnswer();
			await this.peerConnection.setLocalDescription(answer);
			this.socket.emit('webrtc-answer', {
				answer: answer,
				targetUsername: this.incomingCallData.fromUsername
			});
			this.isCallActive = true;
			this.showCallInterface();
		} catch (error) {
			if (window.showMessage) {
				window.showMessage(window.t('MODAL_ERROR'), window.t('ERROR_CALL_ACCEPT', { error: error.message }));
			} else {
				alert(window.t('ERROR_CALL_ACCEPT', { error: error.message }));
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
		const iceServers = window.rtcConfig?.iceServers || [{
				urls: 'stun:stun.l.google.com:19302'
			},
			{
				urls: 'stun:stun1.l.google.com:19302'
			}
		];
		const config = {
			iceServers: iceServers,
			iceTransportPolicy: 'all'
		};
		this.peerConnection = new RTCPeerConnection(config);
		this.peerConnection.ontrack = (event) => {
			this.remoteStream = event.streams[0];
			document.getElementById('remoteVideo').srcObject = this.remoteStream;
		};
		this.peerConnection.onicecandidate = (event) => {
			if (event.candidate && this.targetUser) {
				this.socket.emit('webrtc-ice-candidate', {
					candidate: event.candidate,
					targetUsername: this.targetUser
				});
			}
		};
		this.peerConnection.onconnectionstatechange = () => {
			if (this.peerConnection.connectionState === 'disconnected' ||
				this.peerConnection.connectionState === 'failed') {
				this.endCall();
			}
		};
		this.peerConnection.oniceconnectionstatechange = () => {
			if (this.peerConnection.iceConnectionState === 'disconnected' ||
				this.peerConnection.iceConnectionState === 'failed') {}
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
		document.getElementById('localVideo').srcObject = null;
		document.getElementById('remoteVideo').srcObject = null;
		document.getElementById('localVideo').poster = '';
		this.hideCallInterface();
	}
}