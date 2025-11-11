class AudioRecorder {
	constructor() {
		this.mediaRecorder = null;
		this.audioChunks = [];
		this.isRecording = false;
		this.audioBlob = null;
		this.recordStartTime = null;
		this.recordingTimeout = null;
		this.stream = null;
		this.recordDuration = 0;
		this.recordButton = document.getElementById('recordButton');
		this.recordingIndicator = document.getElementById('recordingIndicator');
		this.preparingModal = document.getElementById('preparingModal');
		this.audioElement = null;
		this.checkMediaRecorderSupport();
		this.initEventHandlers();
	}
	checkMediaRecorderSupport() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			console.error('Ваш браузер не поддерживает запись аудио');
			this.showError('Ваш браузер не поддерживает запись аудио');
			return false;
		}
		if (typeof MediaRecorder === 'undefined') {
			console.error('MediaRecorder не поддерживается вашим браузером');
			this.showError('MediaRecorder не поддерживается вашим браузером');
			return false;
		}
		return true;
	}
	initEventHandlers() {
		if (!this.recordButton) return;
		this.recordButton.addEventListener('mousedown', (e) => {
			this.startRecording();
			e.preventDefault();
		});
		this.recordButton.addEventListener('touchstart', (e) => {
			this.startRecording();
			e.preventDefault();
		});
		document.addEventListener('mouseup', () => {
			if (this.isRecording) {
				this.stopRecording();
			} else {
				this.hidePreparingModal();
			}
		});
		document.addEventListener('touchend', () => {
			if (this.isRecording) {
				this.stopRecording();
			} else {
				this.hidePreparingModal();
			}
		});
		this.recordButton.addEventListener('dragstart', (e) => {
			e.preventDefault();
		});
	}
	showPreparingModal() {
		if (this.preparingModal) {
			this.preparingModal.classList.remove('hidden');
		}
	}
	hidePreparingModal() {
		if (this.preparingModal) {
			this.preparingModal.classList.add('hidden');
		}
	}
	async requestMicrophoneAccess() {
		try {
			console.log('Запрос доступа к микрофону...');
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 44100,
					sampleSize: 16,
					channelCount: 1
				}
			});
			console.log('Доступ к микрофону получен');
			this.hidePreparingModal();
			return this.stream;
		} catch (error) {
			console.error('Ошибка доступа к микрофону:', error);
			this.showError('Не удалось получить доступ к микрофону: ' + error.message);
			this.hidePreparingModal();
			return null;
		}
	}
	async startRecording() {
		if (this.isRecording) return;
		if (!this.checkMediaRecorderSupport()) {
			return;
		}
		if (!this.checkSocketConnection()) {
			this.showError('Нет соединения с сервером. Подождите подключения...');
			return;
		}
		this.showPreparingModal();
		const stream = await this.requestMicrophoneAccess();
		if (!stream) {
			return;
		}
		try {
			this.audioChunks = [];
			this.isRecording = true;
			this.recordStartTime = Date.now();
			this.mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus'
			});
			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.audioChunks.push(event.data);
				}
			};
			this.mediaRecorder.onstop = () => {
				if (this.audioChunks.length === 0) {
					this.showError('Не удалось записать аудио');
					return;
				}
				this.audioBlob = new Blob(this.audioChunks, {
					type: 'audio/webm'
				});
				this.sendAudioAsFile();
				this.isRecording = false;
				stream.getTracks().forEach(track => track.stop());
				if (this.recordingIndicator) {
					this.recordingIndicator.classList.add('hidden');
				}
			};
			this.mediaRecorder.start(100);
			if (this.recordingIndicator) {
				this.recordingIndicator.classList.remove('hidden');
			}
			this.recordingTimeout = setTimeout(() => {
				if (this.isRecording) {
					this.stopRecording();
				}
			}, 60000);
		} catch (error) {
			console.error('Ошибка начала записи:', error);
			this.showError('Ошибка начала записи: ' + error.message);
			this.isRecording = false;
			stream.getTracks().forEach(track => track.stop());
			this.hidePreparingModal();
		}
	}
	stopRecording() {
		if (!this.isRecording || !this.mediaRecorder) return;
		clearTimeout(this.recordingTimeout);
		this.recordDuration = (Date.now() - this.recordStartTime) / 1000;
		this.hidePreparingModal();
		if (this.mediaRecorder.state === 'recording') {
			this.mediaRecorder.stop();
		}
		this.isRecording = false;
	}
	checkSocketConnection() {
		return window.socket && window.socket.connected;
	}
	async sendAudioAsFile() {
		if (!this.audioBlob || this.audioBlob.size === 0) {
			this.showError('Не удалось записать аудио');
			return;
		}
		try {
			console.log('Подготовка аудио к отправке');
			const reader = new FileReader();
			reader.onload = async () => {
				let fileData = reader.result.split(',')[1];
				let isEncrypted = false;
				const fileSizeKB = (this.audioBlob.size / 1024).toFixed(2);
				console.log('Размер аудио данных:', fileData.length, 'байт');
				if (window.encryptionManager && window.encryptionManager.encryptionKey) {
					try {
						console.log('Шифрование аудио перед отправкой');
						fileData = window.encryptionManager.encryptFile(fileData);
						isEncrypted = true;
						console.log('Аудио успешно зашифровано');
					} catch (error) {
						console.error('Ошибка шифрования аудио:', error);
					}
				} else {
					console.log('Ключ шифрования не установлен, аудио отправляется без шифрования');
				}
				if (this.checkSocketConnection()) {
					console.log('Отправка аудио на сервер');
					window.socket.emit('send-file', {
						fileName: `audio_message_${Date.now()}.webm`,
						fileType: 'audio/webm',
						fileData: fileData,
						duration: this.recordDuration.toFixed(1),
						fileSize: fileSizeKB,
						isEncrypted: isEncrypted
					}, (response) => {
						if (response && response.error) {
							console.error('Ошибка отправки аудио:', response.error);
							this.showError('Ошибка отправки аудио: ' + response.error);
						} else {
							console.log('Аудио успешно отправлено');
						}
					});
				} else {
					this.showError('Нет соединения с сервером');
				}
			};
			reader.onerror = () => {
				console.error('Ошибка обработки аудио');
				this.showError('Ошибка обработки аудио');
			};
			reader.readAsDataURL(this.audioBlob);
		} catch (error) {
			console.error('Ошибка отправки аудиосообщения:', error);
			this.showError('Ошибка отправки аудиосообщения');
		}
	}
	playAudioMessage(audioUrl, buttonElement) {
		if (!buttonElement) return;
		if (buttonElement.classList.contains('playing')) {
			if (this.audioElement) {
				this.audioElement.pause();
				this.audioElement = null;
			}
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
			return;
		}
		this.audioElement = new Audio(audioUrl);
		this.audioElement.onplay = () => {
			buttonElement.classList.add('playing');
			buttonElement.innerHTML = '';
		};
		this.audioElement.onpause = () => {
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
		};
		this.audioElement.onended = () => {
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
			this.audioElement = null;
		};
		this.audioElement.onerror = () => {
			console.error('Ошибка воспроизведения аудио');
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
			this.audioElement = null;
		};
		this.audioElement.play().catch(error => {
			console.error('Ошибка воспроизведения:', error);
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
		});
	}
	showError(message) {
		console.error('AudioRecorder Error:', message);
		if (window.addSystemMessage) {
			window.addSystemMessage(message);
		} else if (window.showMessage) {
			window.showMessage('Ошибка', message);
		} else {
			alert(message);
		}
	}
	showRecordingIndicator() {
		if (this.recordingIndicator) {
			this.recordingIndicator.classList.remove('hidden');
			this.recordingIndicator.innerHTML = '<div class="recording-dot"></div>Запись...';
		}
	}
	hideRecordingIndicator() {
		if (this.recordingIndicator) {
			this.recordingIndicator.classList.add('hidden');
		}
	}
}
document.addEventListener('DOMContentLoaded', () => {
	window.audioRecorder = new AudioRecorder();
});