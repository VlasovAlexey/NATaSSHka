class MediaDevicesManager {
    constructor() {
        this.localStream = null;
        this.hasMediaAccess = false;
        this.mediaAccessRequested = false;
    }

    async requestMediaAccess(video = true, audio = true) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error(window.t('ERROR_MEDIA_NOT_SUPPORTED'));
            }

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: audio
            });

            this.hasMediaAccess = true;
            this.mediaAccessRequested = true;

            const event = new CustomEvent('mediaAccessGranted', {
                detail: { stream: this.localStream, video: video, audio: audio }
            });
            window.dispatchEvent(event);

            return this.localStream;
        } catch (error) {
            this.hasMediaAccess = false;
            this.mediaAccessRequested = true;

            const event = new CustomEvent('mediaAccessDenied', {
                detail: { error: error.message, video: video, audio: audio }
            });
            window.dispatchEvent(event);

            throw error;
        }
    }

    stopAllStreams() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.hasMediaAccess = false;
    }

    isSecureContext() {
        return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    }

    async getAvailableDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error(window.t('ERROR_MEDIA_NOT_SUPPORTED'));
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                audioInput: devices.filter(device => device.kind === 'audioinput'),
                videoInput: devices.filter(device => device.kind === 'videoinput'),
                audioOutput: devices.filter(device => device.kind === 'audiooutput')
            };
        } catch (error) {
            throw error;
        }
    }
}

window.mediaDevicesManager = new MediaDevicesManager();

async function initializeMediaDevices() {
    if (!window.mediaDevicesManager.isSecureContext()) {
        const warningEvent = new CustomEvent('mediaInsecureContext', {
            detail: { message: window.t('ERROR_INSECURE_CONTEXT') }
        });
        window.dispatchEvent(warningEvent);
    }
}

document.addEventListener('DOMContentLoaded', initializeMediaDevices);