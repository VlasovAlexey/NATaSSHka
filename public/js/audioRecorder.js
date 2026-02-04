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
			this.showError(window.t('ERROR_MEDIA_NOT_SUPPORTED'));
			return false;
		}
		if (typeof MediaRecorder === 'undefined') {
			this.showError(window.t('ERROR_MEDIARECORDER_NOT_SUPPORTED'));
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
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 44100,
					sampleSize: 16,
					channelCount: 1
				}
			});
			this.hidePreparingModal();
			return this.stream;
		} catch (error) {
			this.showError(window.t('ERROR_MEDIA_PERMISSION', { error: error.message }));
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
			this.showError(window.t('ERROR_NO_SERVER_CONNECTION'));
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
					this.showError(window.t('ERROR_AUDIO_RECORD'));
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
			this.showError(`${window.t('ERROR_SENDING_AUDIO')}: ${error.message}`);
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
        this.showError(window.t('ERROR_AUDIO_RECORD'));
        return;
    }
    try {
        if (window.noCacheUploader && typeof window.noCacheUploader.uploadAudio === 'function') {
            await window.noCacheUploader.uploadAudio(this.audioBlob, this.recordDuration);
        } else {
            throw new Error('Uploader not available');
        }
    } catch (error) {
        this.showError(`${window.t('ERROR_SENDING_AUDIO')}: ${error.message}`);
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
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
			this.audioElement = null;
		};
		this.audioElement.play().catch(error => {
			buttonElement.classList.remove('playing');
			buttonElement.innerHTML = '';
		});
	}
	showError(message) {
		if (window.addSystemMessage) {
			window.addSystemMessage(message);
		} else if (window.showMessage) {
			window.showMessage(window.t('MODAL_ERROR'), message);
		} else {
			alert(message);
		}
	}
	showRecordingIndicator() {
		if (this.recordingIndicator) {
			this.recordingIndicator.classList.remove('hidden');
			this.recordingIndicator.innerHTML = `<div class="recording-dot"></div>${window.t('RECORDING_AUDIO')}`;
		}
	}
	hideRecordingIndicator() {
		if (this.recordingIndicator) {
			this.recordingIndicator.classList.add('hidden');
		}
	}
}
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.audioRecorder = new AudioRecorder();
        console.log('AudioRecorder initialized, uploader available:',
                   window.noCacheUploader && typeof window.noCacheUploader.uploadAudio === 'function');
    }, 100);
});