// reactions.js - Функционал реакций (смайлов) для сообщений
class ReactionsManager {
    constructor() {
        this.reactionPicker = null;
        this.availableReactions = [
            { code: '128512', symbol: '😀' },
            { code: '128530', symbol: '😒' },
            { code: '129505', symbol: '🧡' },
            { code: '128078', symbol: '👎' },
            { code: '128077', symbol: '👍' },
            { code: '128175', symbol: '💯' },
            { code: '128076', symbol: '👌' }
        ];
        
        this.init();
    }
    
    init() {
        this.createReactionPicker();
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
    
    setupEventListeners() {
        // Закрытие пикера при клике вне его
        document.addEventListener('click', (e) => {
            if (this.reactionPicker && !this.reactionPicker.contains(e.target) && 
                !e.target.closest('.reaction-btn')) {
                this.hideReactionPicker();
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
            if (e.key === 'Escape' && !this.reactionPicker.classList.contains('hidden')) {
                this.hideReactionPicker();
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
                    reactionsContainer.appendChild(reactionElement);
                }
            });
        }
    }
    
    addReactionButton(messageElement) {
        if (!messageElement || messageElement.querySelector('.reaction-btn')) return;
        
        const reactionBtn = document.createElement('div');
        reactionBtn.className = 'reaction-btn';
        reactionBtn.innerHTML = '&#128170;';
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