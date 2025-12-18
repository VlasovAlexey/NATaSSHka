class VideoRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.videoChunks = [];
        this.isRecording = false;
        this.videoBlob = null;
        this.recordStartTime = null;
        this.recordingTimeout = null;
        this.stream = null;
        this.recordDuration = 0;
        this.recordingTimer = null;

        this.recordButton = document.getElementById('recordVideoBtn');
        this.recordingIndicator = document.getElementById('videoRecordingIndicator');
        this.cameraPreviewModal = document.getElementById('cameraPreviewModal');
        this.cameraPreview = document.getElementById('cameraPreview');
        this.recordingTimerElement = document.querySelector('.recording-timer');
        this.preparingModal = document.getElementById('preparingModal');

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
        if (!this.recordButton) {
            return;
        }

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
            }
        });

        document.addEventListener('touchend', () => {
            if (this.isRecording) {
                this.stopRecording();
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

    async requestCameraAccess() {
        try {
            const config = window.rtcConfig || {};
            const videoConfig = {
                width: config.videoRec_width || 640,
                height: config.videoRec_height || 480,
                frameRate: config.videoRec_frameRate || 30
            };

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: videoConfig,
                audio: true
            });

            return this.stream;
        } catch (error) {
            this.showError(window.t('ERROR_CAMERA_PERMISSION', { error: error.message }));
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

        const stream = await this.requestCameraAccess();

        this.hidePreparingModal();

        if (!stream) return;

        try {
            this.videoChunks = [];
            this.isRecording = true;
            this.recordStartTime = Date.now();

            this.showCameraPreview(stream);

            const config = window.rtcConfig || {};
            const mimeType = config.videoRec_mimeType || 'video/webm;codecs=vp9';
            const bitrate = config.videoRec_bitrate || 2500000;

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: bitrate
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.videoChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                if (this.videoChunks.length === 0) {
                    this.showError(window.t('ERROR_VIDEO_RECORD'));
                    return;
                }

                this.videoBlob = new Blob(this.videoChunks, { type: 'video/webm' });
                this.sendVideoAsFile();
                this.isRecording = false;

                stream.getTracks().forEach(track => track.stop());

                this.hideRecordingIndicator();
                this.hideCameraPreview();

                if (this.recordingTimer) {
                    clearInterval(this.recordingTimer);
                    this.recordingTimer = null;
                }
            };

            this.mediaRecorder.start(100);

            this.showRecordingIndicator();
            this.startRecordingTimer();

            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, 60000);

        } catch (error) {
            this.showError(`${window.t('ERROR_SENDING_VIDEO')}: ${error.message}`);
            this.isRecording = false;

            this.hidePreparingModal();

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.hidePreparingModal();

        clearTimeout(this.recordingTimeout);
        this.recordDuration = (Date.now() - this.recordStartTime) / 1000;

        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        this.isRecording = false;
    }

    showCameraPreview(stream) {
        this.cameraPreview.srcObject = stream;
        this.cameraPreviewModal.classList.remove('hidden');
    }

    hideCameraPreview() {
        this.cameraPreviewModal.classList.add('hidden');
        this.cameraPreview.srcObject = null;
    }

    showRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.remove('hidden');
            this.recordingIndicator.style.display = 'flex';
        }
    }

    hideRecordingIndicator() {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.add('hidden');
            this.recordingIndicator.style.display = 'none';
        }
    }

    startRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }

        this.recordingTimer = setInterval(() => {
            const elapsed = (Date.now() - this.recordStartTime) / 1000;
            if (this.recordingTimerElement) {
                this.recordingTimerElement.textContent = window.t('RECORDING_TIMER', { seconds: elapsed.toFixed(1) });
            }
        }, 100);
    }

    checkSocketConnection() {
        return window.socket && window.socket.connected;
    }

    async sendVideoAsFile() {
        if (!this.videoBlob || this.videoBlob.size === 0) {
            this.showError(window.t('ERROR_VIDEO_RECORD'));
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                let fileData = reader.result.split(',')[1];
                let isEncrypted = false;
                const fileSizeKB = (this.videoBlob.size / 1024).toFixed(2);

                if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                    try {
                        fileData = window.encryptionManager.encryptFile(fileData);
                        isEncrypted = true;
                    } catch (error) {}
                }

                if (this.checkSocketConnection()) {
                    window.socket.emit('send-file', {
                        fileName: `video_message_${Date.now()}.webm`,
                        fileType: 'video/webm',
                        fileData: fileData,
                        duration: this.recordDuration.toFixed(1),
                        fileSize: fileSizeKB,
                        isEncrypted: isEncrypted
                    }, (response) => {
                        if (response && response.error) {
                            this.showError(`${window.t('ERROR_SENDING_VIDEO')}: ${response.error}`);
                        }
                    });
                } else {
                    this.showError(window.t('ERROR_NO_SERVER_CONNECTION'));
                }
            };

            reader.onerror = () => {
                this.showError(window.t('ERROR_PROCESSING_VIDEO'));
            };

            reader.readAsDataURL(this.videoBlob);

        } catch (error) {
            this.showError(window.t('ERROR_SENDING_VIDEO'));
        }
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.videoRecorder = new VideoRecorder();
});