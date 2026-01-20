// js/fileNameFormatter.js - Упрощенная версия
// Форматирование имен файлов для корректного отображения в чате

window.fileNameFormatter = {
    /**
     * Форматирует имя файла для отображения в чате
     * Если имя файла длиннее 18 символов, обрезает его: первые 10 символов...последние 3 символа.расширение
     * @param {string} fileName - Исходное имя файла
     * @returns {string} Отформатированное имя файла
     */
    formatFileName: function(fileName) {
        // Проверка входных данных
        if (!fileName || typeof fileName !== 'string') {
            return fileName || '';
        }
        
        // Если имя файла короче 19 символов, не форматируем
        if (fileName.length <= 18) {
            return fileName;
        }
        
        try {
            // Находим последнюю точку для расширения
            const lastDotIndex = fileName.lastIndexOf('.');
            
            // Если нет точки или точка в начале, обрабатываем как имя без расширения
            if (lastDotIndex <= 0) {
                // Берем первые 10 символов и последние 3 символа
                const firstPart = fileName.substring(0, 10);
                const lastPart = fileName.length > 13 ? 
                    fileName.substring(fileName.length - 3) : 
                    fileName.substring(10);
                return `${firstPart}...${lastPart}`;
            }
            
            // Разделяем имя и расширение
            const nameWithoutExt = fileName.substring(0, lastDotIndex);
            const extension = fileName.substring(lastDotIndex); // включая точку
            
            // Если имя без расширения короткое, возвращаем как есть
            if (nameWithoutExt.length <= 18) {
                return fileName;
            }
            
            // Берем первые 10 символов имени
            const firstPart = nameWithoutExt.substring(0, 10);
            
            // Берем последние 3 символа имени
            const lastPart = nameWithoutExt.length > 13 ? 
                nameWithoutExt.substring(nameWithoutExt.length - 3) : 
                nameWithoutExt.substring(10);
            
            // Формируем обрезанное имя
            return `${firstPart}...${lastPart}${extension}`;
            
        } catch (error) {
            console.error('Error formatting filename:', error);
            // В случае ошибки возвращаем исходное имя
            return fileName;
        }
    },
    
    /**
     * Применяет форматирование ко всем именам файлов в контейнере
     * @param {HTMLElement} container - Контейнер сообщений
     */
    applyToContainer: function(container) {
        if (!container) return;
        
        // Элементы с именами файлов
        const elements = container.querySelectorAll('.file-info, .file-download-link');
        
        elements.forEach(element => {
            // Пропускаем уже отформатированные элементы
            if (element.dataset.formatted) {
                return;
            }
            
            const originalText = element.textContent || '';
            
            // Простая логика: ищем текст, похожий на имя файла
            // Разбиваем текст на слова и проверяем каждое
            const words = originalText.split(/\s+/);
            
            words.forEach(word => {
                // Проверяем, похоже ли слово на имя файла (содержит точку и буквы после нее)
                if (word.includes('.') && word.length > 18) {
                    const formatted = this.formatFileName(word);
                    if (formatted !== word) {
                        // Заменяем слово в тексте
                        const newText = originalText.replace(word, formatted);
                        element.textContent = newText;
                        element.title = word; // Полное имя в подсказке
                        element.dataset.formatted = 'true';
                    }
                }
            });
        });
    },
    
    /**
     * Форматирует имя файла в элементе на основе данных сообщения
     * @param {HTMLElement} element - Элемент сообщения
     * @param {string} fileName - Имя файла из данных сообщения
     */
    formatElementWithFileName: function(element, fileName) {
        if (!element || !fileName) return;
        
        const formattedName = this.formatFileName(fileName);
        
        if (formattedName !== fileName) {
            element.textContent = element.textContent.replace(fileName, formattedName);
            element.title = fileName;
            element.dataset.formatted = 'true';
        }
    },
    
    /**
     * Инициализация наблюдателя за DOM
     * @param {HTMLElement} container - Контейнер для наблюдения
     */
    initializeObserver: function(container) {
        if (!container || !window.MutationObserver) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('message')) {
                            setTimeout(() => {
                                this.applyToContainer(node);
                            }, 50);
                        }
                    });
                }
            });
        });
        
        observer.observe(container, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }
};