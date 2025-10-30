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
            // Добавляем сигнатуру для проверки целостности
            const signature = "NATASSSHKA_VALID";
            const signatureBase64 = btoa(signature);
            const dataWithSignature = signatureBase64 + base64Data;
            
            return CryptoJS.AES.encrypt(dataWithSignature, this.encryptionKey).toString();
        } catch (error) {
            console.error('Ошибка шифрования файла:', error);
            return base64Data;
        }
    }

    decryptFile(encryptedBase64) {
        if (!this.encryptionKey || !encryptedBase64) {
            throw new Error('Неверный ключ шифрования');
        }
        
        try {
            console.log('Дешифрование файла');
            const bytes = CryptoJS.AES.decrypt(encryptedBase64, this.encryptionKey);
            
            // Проверяем, является ли результат валидным
            if (!bytes.sigBytes || bytes.sigBytes === 0) {
                throw new Error('Неверный ключ шифрования');
            }
            
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decrypted) {
                throw new Error('Неверный ключ шифрования');
            }
            
            // Проверяем сигнатуру
            const signature = "NATASSSHKA_VALID";
            const signatureBase64 = btoa(signature);
            
            if (!decrypted.startsWith(signatureBase64)) {
                throw new Error('Неверный ключ шифрования');
            }
            
            // Убираем сигнатуру
            return decrypted.substring(signatureBase64.length);
        } catch (error) {
            console.error('Ошибка дешифрования файла:', error);
            throw new Error('Неверный ключ шифрования');
        }
    }

    debounce(callback, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(callback, delay);
    }
}

// Глобальный экземпляр менеджера шифрования
window.encryptionManager = new EncryptionManager();