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
        this.messageInput.addEventListener('input', () => {
            this.handleTextChange();
        });
        
        window.addEventListener('resize', () => {
            this.calculateButtonsWidth();
            this.updateInputWidth();
        });
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.messageInput.value.trim()) {
                this.sendMessageBtn.click();
                e.preventDefault();
            }
        });
        
        this.sendMessageBtn.addEventListener('click', (e) => {
            if (this.messageInput.value.trim()) {
                if (window.sendMessage) {
                    window.sendMessage();
                }
            }
            e.preventDefault();
        });
        
        this.recordButtonsContainer.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity') {
                this.handleRecordButtonsAnimationEnd();
            }
        });
        
        this.fileInputLabel.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity') {
                this.handleFileLabelAnimationEnd();
            }
        });
        
        this.messageInput.addEventListener('focus', () => {
            this.messageInputContainer.classList.add('focused');
        });
        
        this.messageInput.addEventListener('blur', () => {
            this.messageInputContainer.classList.remove('focused');
        });
    }
    
    calculateButtonsWidth() {
        const originalDisplay = this.recordButtonsContainer.style.display;
        this.recordButtonsContainer.style.display = 'flex';
        
        this.recordButtonsWidth = this.recordButtonsContainer.offsetWidth;
        
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
            this.scheduleInputExpansion();
        } else {
            this.updateInputWidth();
            this.recordButtonsContainer.style.width = 'auto';
            this.recordButtonsContainer.style.overflow = 'visible';
        }
    }
    
    handleRecordButtonsAnimationEnd() {
        if (this.messageInputContainer.classList.contains('has-text')) {
            this.recordButtonsContainer.style.width = '0';
            this.recordButtonsContainer.style.overflow = 'hidden';
        }
        
        this.checkAllAnimationsComplete();
    }
    
    handleFileLabelAnimationEnd() {
        this.checkAllAnimationsComplete();
    }
    
    checkAllAnimationsComplete() {
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
        this.animationTimeout = setTimeout(() => {
            if (this.isAnimating) {
                this.checkAllAnimationsComplete();
                this.scheduleInputExpansion();
            }
        }, 40);
    }
    
    updateInputWidth() {
        const hasText = this.messageInputContainer.classList.contains('has-text');
        
        if (hasText) {
            this.messageInput.style.flexGrow = '1';
            this.messageInput.style.marginRight = '0';
        } else {
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
    
    forceUpdate() {
        this.calculateButtonsWidth();
        this.updateButtonStates();
    }
    
    updateButtonStates() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.messageInputContainer.classList.toggle('has-text', hasText);
        this.updateInputWidth();
        this.updateSendButtonState(hasText);
        
        if (!hasText) {
            this.recordButtonsContainer.style.width = 'auto';
            this.recordButtonsContainer.style.overflow = 'visible';
        }
    }
    
    clearInput() {
        this.messageInput.value = '';
        this.updateButtonStates();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.messageInputAnimations = new MessageInputAnimations();
        
        window.clearMessageInput = function() {
            if (window.messageInputAnimations) {
                window.messageInputAnimations.clearInput();
            }
        };
        
        window.updateMessageInputState = function() {
            if (window.messageInputAnimations) {
                window.messageInputAnimations.forceUpdate();
            }
        };
    }, 100);
});