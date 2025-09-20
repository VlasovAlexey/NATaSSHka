// mediaDevices.js - Управление доступом к медиаустройствам

class MediaDevicesManager {
    constructor() {
        this.localStream = null;
        this.hasMediaAccess = false;
        this.mediaAccessRequested = false;
    }

    // Запрос доступа к медиаустройствам
    async requestMediaAccess(video = true, audio = true) {
        try {
            // Проверяем, поддерживается ли getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Ваш браузер не поддерживает доступ к медиаустройствам');
            }

            // Запрашиваем разрешение
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: audio
            });
            
            this.hasMediaAccess = true;
            this.mediaAccessRequested = true;
            
            // Создаем событие об успешном получении доступа
            const event = new CustomEvent('mediaAccessGranted', { 
                detail: { stream: this.localStream, video: video, audio: audio }
            });
            window.dispatchEvent(event);
            
            return this.localStream;
        } catch (error) {
            this.hasMediaAccess = false;
            this.mediaAccessRequested = true;
            
            // Создаем событие об ошибке доступа
            const event = new CustomEvent('mediaAccessDenied', { 
                detail: { error: error.message, video: video, audio: audio }
            });
            window.dispatchEvent(event);
            
            throw error;
        }
    }

    // Остановка всех медиапотоков
    stopAllStreams() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.hasMediaAccess = false;
    }

    // Проверка, является ли текущий контекст безопасным (HTTPS или localhost)
    isSecureContext() {
        return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    }

    // Получение списка доступных устройств
    async getAvailableDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                throw new Error('Ваш браузер не поддерживает получение списка устройств');
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                audioInput: devices.filter(device => device.kind === 'audioinput'),
                videoInput: devices.filter(device => device.kind === 'videoinput'),
                audioOutput: devices.filter(device => device.kind === 'audiooutput')
            };
        } catch (error) {
            console.error('Ошибка получения списка устройств:', error);
            throw error;
        }
    }
}

// Создаем глобальный экземпляр менеджера медиаустройств
window.mediaDevicesManager = new MediaDevicesManager();

// Функция для инициализации медиаустройств при загрузке страницы
async function initializeMediaDevices() {
    // Проверяем безопасный контекст
    if (!window.mediaDevicesManager.isSecureContext()) {
        console.warn('Страница загружена в небезопасном контексте. Доступ к медиаустройствам может быть ограничен.');
        
        // Показываем предупреждение пользователю
        const warningEvent = new CustomEvent('mediaInsecureContext', {
            detail: { message: 'Для работы голосовой и видео связи рекомендуется использовать HTTPS или localhost.' }
        });
        window.dispatchEvent(warningEvent);
    }
    
    // Можно автоматически запросить доступ к аудио при загрузке
    // или дождаться явного действия пользователя
}

// Инициализируем при загрузке документа
document.addEventListener('DOMContentLoaded', initializeMediaDevices);