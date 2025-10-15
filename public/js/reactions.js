// reactions.js - Функционал реакций (смайлов) для сообщений
class ReactionsManager {
    constructor() {
        this.reactionPicker = null;
        this.usersPopup = null;
        this.availableReactions = [
            { code: '128512', symbol: '😀' },
            { code: '128530', symbol: '😒' },
            { code: '129505', symbol: '🧡' },
            { code: '128078', symbol: '👎' },
            { code: '128077', symbol: '👍' },
            { code: '128175', symbol: '💯' },
            { code: '128076', symbol: '👌' }
        ];
        
        this.isTouchDevice = this.checkTouchDevice();
        this.init();
    }
    
    checkTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    init() {
        this.createReactionPicker();
        this.createUsersPopup();
        this.setupEventListeners();
    }
    
    createReactionPicker() {
        this.reactionPicker = document.createElement('div');
        this.reactionPicker.className = 'reaction-picker hidden';
        this.reactionPicker.innerHTML = `
            <div class="reaction-options">
                ${this.availableReactions.map(reaction => 
                    `<div class="reaction-option" data-code="${reaction.code}">
                        ${reaction.symbol}
                    </div>`
                ).join('')}
            </div>
        `;
        document.body.appendChild(this.reactionPicker);
    }
    
    createUsersPopup() {
        this.usersPopup = document.createElement('div');
        this.usersPopup.className = 'users-popup hidden';
        this.usersPopup.innerHTML = `
            <div class="users-popup-content"></div>
        `;
        document.body.appendChild(this.usersPopup);
    }
    
    setupEventListeners() {
        // Закрытие пикера при клике вне его
        document.addEventListener('click', (e) => {
            if (this.reactionPicker && !this.reactionPicker.contains(e.target) && 
                !e.target.closest('.reaction-btn')) {
                this.hideReactionPicker();
            }
            
            // Закрытие попапа пользователей на touch устройствах
            if (this.isTouchDevice && this.usersPopup && !this.usersPopup.contains(e.target) && 
                !e.target.closest('.message-reaction')) {
                this.hideUsersPopup();
            }
        });
        
        // Обработка выбора реакции
        this.reactionPicker.addEventListener('click', (e) => {
            const reactionOption = e.target.closest('.reaction-option');
            if (reactionOption) {
                const reactionCode = reactionOption.dataset.code;
                const messageId = this.reactionPicker.dataset.messageId;
                this.addReaction(messageId, reactionCode);
                this.hideReactionPicker();
            }
        });
        
        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.reactionPicker.classList.contains('hidden')) {
                    this.hideReactionPicker();
                }
                if (!this.usersPopup.classList.contains('hidden')) {
                    this.hideUsersPopup();
                }
            }
        });
    }
    
    showReactionPicker(messageId, buttonElement) {
        if (!this.reactionPicker) return;
        
        const rect = buttonElement.getBoundingClientRect();
        this.reactionPicker.dataset.messageId = messageId;
        
        // Позиционируем пикер над кнопкой
        this.reactionPicker.style.left = `${rect.left}px`;
        this.reactionPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        
        this.reactionPicker.classList.remove('hidden');
    }
    
    hideReactionPicker() {
        if (this.reactionPicker) {
            this.reactionPicker.classList.add('hidden');
        }
    }
    
    showUsersPopup(messageId, reactionCode, reactionElement) {
        if (!this.usersPopup) return;
        
        // Получаем данные о пользователях
        const usersData = window.reactionUsersData && window.reactionUsersData.get(messageId);
        if (!usersData || !usersData[reactionCode] || usersData[reactionCode].length === 0) {
            return;
        }
        
        const rect = reactionElement.getBoundingClientRect();
        const users = usersData[reactionCode];
        
        // Заполняем контент попапа
        const content = this.usersPopup.querySelector('.users-popup-content');
        content.innerHTML = users.map(username => 
            `<div class="user-item">${username}</div>`
        ).join('');
        
        // Позиционируем попап
        this.usersPopup.style.left = `${rect.left}px`;
        this.usersPopup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        
        this.usersPopup.classList.remove('hidden');
    }
    
    hideUsersPopup() {
        if (this.usersPopup) {
            this.usersPopup.classList.add('hidden');
        }
    }
    
    addReaction(messageId, reactionCode) {
        if (!window.socket || !messageId || !reactionCode) return;
        
        // Получаем текущую комнату
        const room = window.currentRoom;
        if (!room) {
            console.error('Комната не определена');
            return;
        }
        
        window.socket.emit('add-reaction', {
            messageId: messageId,
            reactionCode: reactionCode,
            room: room
        });
    }
    
    updateMessageReactions(messageElement, reactions) {
        if (!messageElement) return;
        
        let reactionsContainer = messageElement.querySelector('.message-reactions');
        
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageElement.appendChild(reactionsContainer);
        }
        
        // Очищаем и обновляем реакции
        reactionsContainer.innerHTML = '';
        
        if (reactions && Object.keys(reactions).length > 0) {
            Object.entries(reactions).forEach(([code, count]) => {
                if (count > 0) {
                    const reactionElement = document.createElement('div');
                    reactionElement.className = 'message-reaction';
                    reactionElement.innerHTML = `&#${code}; ${count}`;
                    reactionElement.dataset.code = code;
                    
                    // Добавляем обработчики событий
                    if (this.isTouchDevice) {
                        // На touch устройствах - обработка клика
                        reactionElement.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const messageId = messageElement.dataset.messageId;
                            this.showUsersPopup(messageId, code, reactionElement);
                        });
                    } else {
                        // На компьютере - обработка наведения
                        reactionElement.addEventListener('mouseenter', (e) => {
                            const messageId = messageElement.dataset.messageId;
                            this.showUsersPopup(messageId, code, reactionElement);
                        });
                        
                        reactionElement.addEventListener('mouseleave', () => {
                            this.hideUsersPopup();
                        });
                    }
                    
                    reactionsContainer.appendChild(reactionElement);
                }
            });
        }
    }
    
    addReactionButton(messageElement) {
        if (!messageElement || messageElement.querySelector('.reaction-btn')) return;
        
        const reactionBtn = document.createElement('div');
        reactionBtn.className = 'reaction-btn';
        reactionBtn.innerHTML = '♡';
        reactionBtn.title = 'Добавить реакцию';
        
        reactionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageId = messageElement.dataset.messageId;
            this.showReactionPicker(messageId, reactionBtn);
        });
        
        messageElement.appendChild(reactionBtn);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.reactionsManager = new ReactionsManager();
});