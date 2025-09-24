// crypto.js - Функции шифрования и дешифрования сообщений и файлов
class EncryptionManager {
    constructor() {
        this.encryptionKey = '';
        this.debounceTimer = null;
    }

     setEncryptionKey(key) {
        console.log('Установлен ключ шифрования:', key ? '***' : 'пустой');
        this.encryptionKey = key;
        
        // Очищаем кэш при изменении ключа
        if (window.decryptedFilesCache) {
            window.decryptedFilesCache = {};
            console.log('Кэш файлов очищен из-за смены ключа');
        }
    }

    encryptMessage(message) {
        if (!this.encryptionKey || !message) return message;
        
        try {
            console.log('Шифрование текстового сообщения');
            return CryptoJS.AES.encrypt(message, this.encryptionKey).toString();
        } catch (error) {
            console.error('Ошибка шифрования:', error);
            return message;
        }
    }

    decryptMessage(encryptedMessage) {
    if (!this.encryptionKey || !encryptedMessage) return encryptedMessage;
    
    try {
        console.log('Дешифрование текстового сообщения');
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, this.encryptionKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decrypted && encryptedMessage.length > 0) {
            return "🔒 Неверный ключ шифрования";
        }
        
        return decrypted || encryptedMessage;
    } catch (error) {
        console.error('Ошибка дешифрования:', error);
        return "🔒 Ошибка дешифрования";
    }
}

    encryptFile(base64Data) {
        if (!this.encryptionKey || !base64Data) {
            console.log('Шифрование файла пропущено (нет ключа или данных)');
            return base64Data;
        }
        
        try {
            console.log('Шифрование файла');
            return CryptoJS.AES.encrypt(base64Data, this.encryptionKey).toString();
        } catch (error) {
            console.error('Ошибка шифрования файла:', error);
            return base64Data;
        }
    }

    decryptFile(encryptedBase64) {
        if (!this.encryptionKey || !encryptedBase64) {
            console.log('Дешифрование файла пропущено (нет ключа или данных)');
            return encryptedBase64;
        }
        
        try {
            console.log('Дешифрование файла');
            const bytes = CryptoJS.AES.decrypt(encryptedBase64, this.encryptionKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decrypted && encryptedBase64.length > 0) {
                throw new Error('Неверный ключ шифрования');
            }
            
            return decrypted || encryptedBase64;
        } catch (error) {
            console.error('Ошибка дешифрования файла:', error);
            throw error;
        }
    }

    debounce(callback, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(callback, delay);
    }
}

// Глобальный экземпляр менеджера шифрования
window.encryptionManager = new EncryptionManager();