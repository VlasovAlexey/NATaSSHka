// messageInputAnimations.js - Управление анимациями поля ввода сообщений
class MessageInputAnimations {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.messageInputContainer = document.querySelector('.message-input-container');
        this.recordButtonsContainer = document.querySelector('.record-buttons-container');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.fileInputLabel = document.querySelector('.file-input-label');
        
        this.recordButtonsWidth = 0;
        this.isAnimating = false;
        this.animationTimeout = null;
        
        this.initEventHandlers();
        this.calculateButtonsWidth();
        this.updateButtonStates();
    }
    
    initEventHandlers() {
        // Обработчик ввода текста
        this.messageInput.addEventListener('input', () => {
            this.handleTextChange();
        });
        
        // Обработчик изменения размера окна
        window.addEventListener('resize', () => {
            this.calculateButtonsWidth();
            this.updateInputWidth();
        });
        
        // Обработчик нажатия Enter в поле ввода
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.messageInput.value.trim()) {
                this.sendMessageBtn.click();
                e.preventDefault();
            }
        });
        
        // Обработчик клика по кнопке отправки
        this.sendMessageBtn.addEventListener('click', (e) => {
            if (this.messageInput.value.trim()) {
                if (window.sendMessage) {
                    window.sendMessage();
                }
            }
            e.preventDefault();
        });
        
        // Обработчик переходов анимации для кнопок записи
        this.recordButtonsContainer.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity') {
                this.handleRecordButtonsAnimationEnd();
            }
        });
        
        // Обработчик переходов анимации для кнопки файла
        this.fileInputLabel.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity') {
                this.handleFileLabelAnimationEnd();
            }
        });
        
        // Обработчик фокуса на поле ввода
        this.messageInput.addEventListener('focus', () => {
            this.messageInputContainer.classList.add('focused');
        });
        
        this.messageInput.addEventListener('blur', () => {
            this.messageInputContainer.classList.remove('focused');
        });
    }
    
    calculateButtonsWidth() {
        // Временно показываем контейнер для расчета ширины
        const originalDisplay = this.recordButtonsContainer.style.display;
        this.recordButtonsContainer.style.display = 'flex';
        
        // Рассчитываем ширину кнопок записи включая gap
        this.recordButtonsWidth = this.recordButtonsContainer.offsetWidth;
        
        // Восстанавливаем стиль
        this.recordButtonsContainer.style.display = originalDisplay || '';
    }
    
    handleTextChange() {
        const hasText = this.messageInput.value.trim().length > 0;
        const currentlyHasText = this.messageInputContainer.classList.contains('has-text');
        
        if (hasText !== currentlyHasText) {
            this.startAnimation(hasText);
        }
        
        this.updateSendButtonState(hasText);
    }
    
    startAnimation(hasText) {
        if (this.isAnimating) {
            clearTimeout(this.animationTimeout);
        }
        
        this.isAnimating = true;
        this.messageInputContainer.classList.toggle('has-text', hasText);
        
        if (hasText) {
            // При появлении текста - начинаем анимацию скрытия кнопок записи и файла
            this.scheduleInputExpansion();
        } else {
            // При исчезновении текста - сразу сужаем поле ввода и показываем кнопки
            this.updateInputWidth();
            this.recordButtonsContainer.style.width = 'auto';
            this.recordButtonsContainer.style.overflow = 'visible';
        }
    }
    
    handleRecordButtonsAnimationEnd() {
        // Когда анимация кнопок записи завершена
        if (this.messageInputContainer.classList.contains('has-text')) {
            this.recordButtonsContainer.style.width = '0';
            this.recordButtonsContainer.style.overflow = 'hidden';
        }
        
        this.checkAllAnimationsComplete();
    }
    
    handleFileLabelAnimationEnd() {
        // Когда анимация кнопки файла завершена
        this.checkAllAnimationsComplete();
    }
    
    checkAllAnimationsComplete() {
        // Проверяем, завершились ли все анимации
        const recordButtonsHidden = this.recordButtonsContainer.style.opacity === '0' || 
                                  this.recordButtonsContainer.classList.contains('has-text');
        const fileLabelHidden = this.fileInputLabel.style.opacity === '0' || 
                               this.fileInputLabel.classList.contains('has-text');
        
        if (recordButtonsHidden && fileLabelHidden && this.isAnimating) {
            this.isAnimating = false;
            this.updateInputWidth();
        }
    }
    
    scheduleInputExpansion() {
        // Даем время для начала анимации opacity - увеличено до 40мс для 0.23s анимации
        this.animationTimeout = setTimeout(() => {
            if (this.isAnimating) {
                this.checkAllAnimationsComplete();
                this.scheduleInputExpansion();
            }
        }, 40); // Увеличено с 25мс до 40мс для более плавной анимации
    }
    
    updateInputWidth() {
        const hasText = this.messageInputContainer.classList.contains('has-text');
        
        if (hasText) {
            // Расширяем поле ввода после исчезновения кнопок записи и файла
            this.messageInput.style.flexGrow = '1';
            this.messageInput.style.marginRight = '0';
        } else {
            // Сразу сужаем поле ввода для кнопок записи
            this.messageInput.style.marginRight = '0';
        }
    }
    
    updateSendButtonState(hasText) {
        if (hasText) {
            this.sendMessageBtn.disabled = false;
            this.sendMessageBtn.style.cursor = 'pointer';
            this.sendMessageBtn.title = 'Отправить сообщение';
        } else {
            this.sendMessageBtn.disabled = true;
            this.sendMessageBtn.style.cursor = 'not-allowed';
            this.sendMessageBtn.title = 'Введите сообщение для отправки';
        }
    }
    
    // Метод для принудительного обновления состояния
    forceUpdate() {
        this.calculateButtonsWidth();
        this.updateButtonStates();
    }
    
    // Метод для обновления состояний кнопок
    updateButtonStates() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.messageInputContainer.classList.toggle('has-text', hasText);
        this.updateInputWidth();
        this.updateSendButtonState(hasText);
        
        // Принудительно обновляем ширину контейнера кнопок записи
        if (!hasText) {
            this.recordButtonsContainer.style.width = 'auto';
            this.recordButtonsContainer.style.overflow = 'visible';
        }
    }
    
    // Метод для очистки поля ввода и сброса состояния
    clearInput() {
        this.messageInput.value = '';
        this.updateButtonStates();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Ждем полной загрузки DOM для корректного расчета размеров
    setTimeout(() => {
        window.messageInputAnimations = new MessageInputAnimations();
        
        // Делаем функцию очистки доступной глобально
        window.clearMessageInput = function() {
            if (window.messageInputAnimations) {
                window.messageInputAnimations.clearInput();
            }
        };
        
        // Делаем функцию принудительного обновления доступной глобально
        window.updateMessageInputState = function() {
            if (window.messageInputAnimations) {
                window.messageInputAnimations.forceUpdate();
            }
        };
    }, 100);
});