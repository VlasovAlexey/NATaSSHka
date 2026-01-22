﻿﻿class NoCacheUploader {
    constructor() {
        // Инициализация если нужно
    }

    async uploadFile(fileData, fileName, fileType, isEncrypted = false, duration = 0, fileSize = null) {
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substr(2, 9);
        
        // Создаем уникальное имя файла с timestamp
        const uniqueFileName = `file_${timestamp}_${uniqueId}_${fileName}`;
        
        const data = {
            fileName: uniqueFileName,
            fileType: fileType,
            fileData: fileData,
            isEncrypted: isEncrypted,
            _nocache: `${timestamp}_${uniqueId}`
        };
        
        if (duration > 0) {
            data.duration = duration;
        }
        
        if (fileSize) {
            data.fileSize = fileSize;
        }
        
        return new Promise((resolve, reject) => {
            if (!window.socket || !window.socket.connected) {
                reject(new Error(window.t('ERROR_NO_SERVER_CONNECTION')));
                return;
            }
            
            window.socket.emit('send-file', data, (response) => {
                if (response && response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    async uploadAudio(audioBlob, duration) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    let fileData = reader.result.split(',')[1];
                    let isEncrypted = false;
                    const fileSizeKB = (audioBlob.size / 1024).toFixed(2);
                    
                    if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                        try {
                            fileData = window.encryptionManager.encryptFile(fileData);
                            isEncrypted = true;
                        } catch (error) {
                            // Оставляем незашифрованным в случае ошибки
                        }
                    }
                    
                    const result = await this.uploadFile(
                        fileData,
                        `audio.webm`,
                        'audio/webm',
                        isEncrypted,
                        duration,
                        fileSizeKB
                    );
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error(window.t('ERROR_PROCESSING_AUDIO')));
            };
            
            reader.readAsDataURL(audioBlob);
        });
    }
    
    async uploadVideo(videoBlob, duration) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    let fileData = reader.result.split(',')[1];
                    let isEncrypted = false;
                    const fileSizeKB = (videoBlob.size / 1024).toFixed(2);
                    
                    if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                        try {
                            fileData = window.encryptionManager.encryptFile(fileData);
                            isEncrypted = true;
                        } catch (error) {
                            // Оставляем незашифрованным в случае ошибки
                        }
                    }
                    
                    const result = await this.uploadFile(
                        fileData,
                        `video.webm`,
                        'video/webm',
                        isEncrypted,
                        duration,
                        fileSizeKB
                    );
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error(window.t('ERROR_PROCESSING_VIDEO')));
            };
            
            reader.readAsDataURL(videoBlob);
        });
    }
}

// Создаем экземпляр класса (чтобы методы были доступны как window.noCacheUploader.uploadAudio())
window.noCacheUploader = new NoCacheUploader();