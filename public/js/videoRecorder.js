// videoRecorder.js - Функционал записи и отправки видео
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
        
        // Элементы DOM
        this.recordButton = document.getElementById('recordVideoBtn');
        this.recordingIndicator = document.getElementById('videoRecordingIndicator');
        this.cameraPreviewModal = document.getElementById('cameraPreviewModal');
        this.cameraPreview = document.getElementById('cameraPreview');
        this.recordingTimerElement = document.querySelector('.recording-timer');
        this.preparingModal = document.getElementById('preparingModal');
        
        // Проверяем поддержку MediaRecorder
        this.checkMediaRecorderSupport();
        
        // Инициализируем обработчики событий
        this.initEventHandlers();
    }
    
    // Проверка поддержки MediaRecorder
    checkMediaRecorderSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Ваш браузер не поддерживает запись видео');
            this.showError('Ваш браузер не поддерживает запись видео');
            return false;
        }
        
        if (typeof MediaRecorder === 'undefined') {
            console.error('MediaRecorder не поддерживается вашим браузером');
            this.showError('MediaRecorder не поддерживается вашим браузером');
            return false;
        }
        
        return true;
    }
    
    // Инициализация обработчиков событий
    initEventHandlers() {
        if (!this.recordButton) {
            console.error('Кнопка записи видео не найдена');
            return;
        }
        
        // Обработка нажатия кнопки записи
        this.recordButton.addEventListener('mousedown', (e) => {
            this.startRecording();
            e.preventDefault();
        });
        
        this.recordButton.addEventListener('touchstart', (e) => {
            this.startRecording();
            e.preventDefault();
        });
        
        // Обработка отпускания кнопки записи
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
        
        // Предотвращаем перетаскивание кнопки
        this.recordButton.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    }
    
    // Показать окно подготовки
    showPreparingModal() {
        if (this.preparingModal) {
            this.preparingModal.classList.remove('hidden');
        }
    }
    
    // Скрыть окно подготовки
    hidePreparingModal() {
        if (this.preparingModal) {
            this.preparingModal.classList.add('hidden');
        }
    }
    
    // Запрос доступа к камее
    async requestCameraAccess() {
        try {
            console.log('Запрос доступа к камере...');
            
            // Получаем конфигурацию из глобальной переменной или используем значения по умолчанию
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
            
            console.log('Доступ к камере получен');
            return this.stream;
        } catch (error) {
            console.error('Ошибка доступа к камере:', error);
            this.showError('Не удалось получить доступ к камере: ' + error.message);
            return null;
        }
    }
    
    // Начало записи
    async startRecording() {
        if (this.isRecording) return;
        
        if (!this.checkMediaRecorderSupport()) {
            return;
        }
        
        // Проверяем соединение с сервером
        if (!this.checkSocketConnection()) {
            this.showError('Нет соединения с сервером. Подождите подключения...');
            return;
        }
        
        // Показываем окно подготовки
        this.showPreparingModal();
        
        const stream = await this.requestCameraAccess();
        
        // Скрываем окно подготовки после получения доступа
        this.hidePreparingModal();
        
        if (!stream) return;
        
        try {
            this.videoChunks = [];
            this.isRecording = true;
            this.recordStartTime = Date.now();
            
            // Показываем превью камеры
            this.showCameraPreview(stream);
            
            // Получаем конфигурацию из глобальной переменной
            const config = window.rtcConfig || {};
            const mimeType = config.videoRec_mimeType || 'video/webm;codecs=vp9';
            const bitrate = config.videoRec_bitrate || 2500000;
            
            // Создаем MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: bitrate
            });
            
            // Обработка данных записи
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.videoChunks.push(event.data);
                }
            };
            
            // Обработка окончания записи
            this.mediaRecorder.onstop = () => {
                if (this.videoChunks.length === 0) {
                    this.showError('Не удалось записать видео');
                    return;
                }
                
                this.videoBlob = new Blob(this.videoChunks, { type: 'video/webm' });
                this.sendVideoAsFile();
                this.isRecording = false;
                
                // Останавливаем все треки потока
                stream.getTracks().forEach(track => track.stop());
                
                // Скрываем индикатор записи и превью
                this.hideRecordingIndicator();
                this.hideCameraPreview();
                
                // Останавливаем таймер
                if (this.recordingTimer) {
                    clearInterval(this.recordingTimer);
                    this.recordingTimer = null;
                }
                
                // Восстанавливаем иконку кнопки
                //this.recordButton.innerHTML = '<img src="icons/video.svg" alt="File icon" class="file-icon">';
            };
            
            // Запускаем запись
            this.mediaRecorder.start(100);
            
            // Показываем индикатор записи
            this.showRecordingIndicator();
            
            // Запускаем таймер
            this.startRecordingTimer();
            
            // Меняем иконку кнопки
            //this.recordButton.innerHTML = '<img src="icons/video.svg" alt="File icon" class="file-icon">';
            
            // Устанавливаем таймаут для автоматической остановки записи (60 секунд)
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, 60000);
            
        } catch (error) {
            console.error('Ошибка начала записи:', error);
            this.showError('Ошибка начала записи: ' + error.message);
            this.isRecording = false;
            
            // Скрываем окно подготовки в случае ошибки
            this.hidePreparingModal();
            
            // Останавливаем поток в случае ошибки
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }
    
    // Остановка записи
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        
        // Скрываем окно подготовки
        this.hidePreparingModal();
        
        clearTimeout(this.recordingTimeout);
        this.recordDuration = (Date.now() - this.recordStartTime) / 1000;
        
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        this.isRecording = false;
    }
    
    // Показать превью камеры
    showCameraPreview(stream) {
        this.cameraPreview.srcObject = stream;
        this.cameraPreviewModal.classList.remove('hidden');
    }
    
    // Скрыть превью камеры
    hideCameraPreview() {
        this.cameraPreviewModal.classList.add('hidden');
        this.cameraPreview.srcObject = null;
    }
    
   // Показать индикатор записи
showRecordingIndicator() {
    if (this.recordingIndicator) {
        this.recordingIndicator.classList.remove('hidden');
        this.recordingIndicator.style.display = 'flex'; // Явно показываем
    }
}

// Скрыть индикатор записи
hideRecordingIndicator() {
    if (this.recordingIndicator) {
        this.recordingIndicator.classList.add('hidden');
        this.recordingIndicator.style.display = 'none'; // Явно скрываем
    }
}
    
    // Запустить таймер записи
    startRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        
        this.recordingTimer = setInterval(() => {
            const elapsed = (Date.now() - this.recordStartTime) / 1000;
            if (this.recordingTimerElement) {
                this.recordingTimerElement.textContent = `${elapsed.toFixed(1)} сек`;
            }
        }, 100);
    }
    
    // Проверка соединения с сервером
    checkSocketConnection() {
        return window.socket && window.socket.connected;
    }
    
    // Отправка видео как файла
    async sendVideoAsFile() {
    if (!this.videoBlob || this.videoBlob.size === 0) {
        this.showError('Не удалось записать видео');
        return;
    }
    
    try {
        console.log('Подготовка видео к отправке');
        // Преобразуем Blob в base64
        const reader = new FileReader();
        reader.onload = async () => {
            let fileData = reader.result.split(',')[1];
            let isEncrypted = false;
            const fileSizeKB = (this.videoBlob.size / 1024).toFixed(2);
            
            console.log('Размер видео данных:', fileData.length, 'байт');
            
            // Шифруем, если установлен ключ
            if (window.encryptionManager && window.encryptionManager.encryptionKey) {
                try {
                    console.log('Шифрование видео перед отправкой');
                    fileData = window.encryptionManager.encryptFile(fileData);
                    isEncrypted = true;
                    console.log('Видео успешно зашифровано');
                } catch (error) {
                    console.error('Ошибка шифрования видео:', error);
                }
            } else {
                console.log('Ключ шифрования не установлен, видео отправляется без шифрования');
            }
            
            // Используем тот же механизм, что и для обычных файлов
            if (this.checkSocketConnection()) {
                console.log('Отправка видео на сервер');
                window.socket.emit('send-file', {
                    fileName: `video_message_${Date.now()}.webm`,
                    fileType: 'video/webm',
                    fileData: fileData,
                    duration: this.recordDuration.toFixed(1),
                    fileSize: fileSizeKB,
                    isEncrypted: isEncrypted
                }, (response) => {
                    if (response && response.error) {
                        console.error('Ошибка отправки видео:', response.error);
                        this.showError('Ошибка отправки видео: ' + response.error);
                    } else {
                        console.log('Видео успешно отправлено');
                    }
                });
            } else {
                this.showError('Нет соединения с сервером');
            }
        };
        
        reader.onerror = () => {
            console.error('Ошибка обработки видео');
            this.showError('Ошибка обработки видео');
        };
        
        reader.readAsDataURL(this.videoBlob);
        
    } catch (error) {
        console.error('Ошибка отправки видеосообщения:', error);
        this.showError('Ошибка отправки видеосообщения');
    }
}
    
    // Показать ошибку
    showError(message) {
        console.error('VideoRecorder Error:', message);
        
        // Показываем ошибку в чате
        if (window.addSystemMessage) {
            window.addSystemMessage(message);
        } else if (window.showMessage) {
            window.showMessage('Ошибка', message);
        } else {
            alert(message);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.videoRecorder = new VideoRecorder();
});