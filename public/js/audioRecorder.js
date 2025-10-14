// audioRecorder.js - Функционал записи и воспроизведения аудио
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
        
        // Элементы DOM
        this.recordButton = document.getElementById('recordButton');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.preparingModal = document.getElementById('preparingModal');
        this.audioElement = null;
        
        // Проверяем поддержку MediaRecorder
        this.checkMediaRecorderSupport();
        
        // Инициализируем обработчики событий
        this.initEventHandlers();
    }
    
    // Проверка поддержки MediaRecorder
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
    
    // Инициализация обработчиков событий
    initEventHandlers() {
        if (!this.recordButton) return;
        
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
            } else {
                // Если запись еще не началась, но окно подготовки показано
                this.hidePreparingModal();
            }
        });
        
        document.addEventListener('touchend', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                // Если запись еще не началась, но окно подготовки показано
                this.hidePreparingModal();
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
    
    // Запрос доступа к микрофону
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
            
            // Скрываем окно подготовки сразу после получения потока
            this.hidePreparingModal();
            
            return this.stream;
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            this.showError('Не удалось получить доступ к микрофону: ' + error.message);
            
            // Скрываем окно подготовки в случае ошибки
            this.hidePreparingModal();
            
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
        
        const stream = await this.requestMicrophoneAccess();
        if (!stream) {
            return;
        }
        
        try {
            this.audioChunks = [];
            this.isRecording = true;
            this.recordStartTime = Date.now();
            
            // Создаем MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            // Обработка данных записи
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Обработка окончания записи
            this.mediaRecorder.onstop = () => {
                if (this.audioChunks.length === 0) {
                    this.showError('Не удалось записать аудио');
                    return;
                }
                
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.sendAudioAsFile();
                this.isRecording = false;
                
                // Останавливаем все треки потока
                stream.getTracks().forEach(track => track.stop());
                
                // Скрываем индикатор записи
                if (this.recordingIndicator) {
                    this.recordingIndicator.classList.add('hidden');
                }
                
                // Восстанавливаем иконку кнопки
                this.recordButton.innerHTML = '🎤';
            };
            
            // Запускаем запись
            this.mediaRecorder.start(100);
            
            // Показываем индикатор записи
            if (this.recordingIndicator) {
                this.recordingIndicator.classList.remove('hidden');
            }
            
            // Меняем иконку кнопки
            this.recordButton.innerHTML = '⏹️';
            
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
            
            // Останавливаем поток в случае ошибки
            stream.getTracks().forEach(track => track.stop());
            
            // Скрываем окно подготовки в случае ошибки
            this.hidePreparingModal();
        }
    }
    
    // Остановка записи
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        
        clearTimeout(this.recordingTimeout);
        this.recordDuration = (Date.now() - this.recordStartTime) / 1000;
        
        // Скрываем окно подготовки
        this.hidePreparingModal();
        
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        this.isRecording = false;
    }
    
    // Проверка соединения с сервером
    checkSocketConnection() {
        return window.socket && window.socket.connected;
    }
    
    // Отправка аудио как файла
    async sendAudioAsFile() {
        if (!this.audioBlob || this.audioBlob.size === 0) {
            this.showError('Не удалось записать аудио');
            return;
        }
        
        try {
            console.log('Подготовка аудио к отправке');
            // Преобразуем Blob в base64
            const reader = new FileReader();
            reader.onload = async () => {
                let fileData = reader.result.split(',')[1];
                let isEncrypted = false;
                const fileSizeKB = (this.audioBlob.size / 1024).toFixed(2);
                
                console.log('Размер аудио данных:', fileData.length, 'байт');
                
                // Шифруем, если установлен ключ
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
                
                // Используем тот же механизм, что и для обычных файлов
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
    
    // Воспроизведение аудиосообщения
    playAudioMessage(audioUrl, buttonElement) {
        if (!buttonElement) return;
        
        // Если аудио уже воспроизводится
        if (buttonElement.classList.contains('playing')) {
            // Останавливаем воспроизведение
            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement = null;
            }
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊';
            return;
        }
        
        // Создаем элемент audio для воспроизведения
        this.audioElement = new Audio(audioUrl);
        
        // Обработка начала воспроизведения
        this.audioElement.onplay = () => {
            buttonElement.classList.add('playing');
            buttonElement.innerHTML = '⏸️';
        };
        
        // Обработка паузы
        this.audioElement.onpause = () => {
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊';
        };
        
        // Обработка окончания воспроизведения
        this.audioElement.onended = () => {
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊';
            this.audioElement = null;
        };
        
        // Обработка ошибки воспроизведения
        this.audioElement.onerror = () => {
            console.error('Ошибка воспроизведения аудио');
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊';
            this.audioElement = null;
        };
        
        // Запускаем воспроизведение
        this.audioElement.play().catch(error => {
            console.error('Ошибка воспроизведения:', error);
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊';
        });
    }
    
    // Показать ошибку
    showError(message) {
        console.error('AudioRecorder Error:', message);
        
        // Показываем ошибку в чате
        if (window.addSystemMessage) {
            window.addSystemMessage(message);
        } else if (window.showMessage) {
            window.showMessage('Ошибка', message);
        } else {
            alert(message);
        }
    }
    // Показать индикатор записи
showRecordingIndicator() {
    if (this.recordingIndicator) {
        this.recordingIndicator.classList.remove('hidden');
        // Устанавливаем текст
        this.recordingIndicator.innerHTML = '<div class="recording-dot"></div>Запись...';
    }
}

// Скрыть индикатор записи
hideRecordingIndicator() {
    if (this.recordingIndicator) {
        this.recordingIndicator.classList.add('hidden');
    }
}
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.audioRecorder = new AudioRecorder();
});