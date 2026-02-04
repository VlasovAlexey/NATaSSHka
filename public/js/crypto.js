class EncryptionManager {
    constructor() {
        this.encryptionKey = '';
        this.debounceTimer = null;
    }
    setEncryptionKey(key) {
        this.encryptionKey = key;
        if (window.decryptedFilesCache) {
            window.decryptedFilesCache = {};
        }
    }
    encryptMessage(message) {
        if (!this.encryptionKey || !message) return message;
        try {
            return CryptoJS.AES.encrypt(message, this.encryptionKey).toString();
        } catch (error) {
            return message;
        }
    }
    decryptMessage(encryptedMessage) {
        if (!this.encryptionKey || !encryptedMessage) return encryptedMessage;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedMessage, this.encryptionKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted && encryptedMessage.length > 0) {
                return "🔒 Неверный ключ шифрования";
            }
            return decrypted || encryptedMessage;
        } catch (error) {
            return "🔒 Ошибка дешифрования";
        }
    }
    encryptFile(base64Data) {
        if (!this.encryptionKey || !base64Data) {
            return base64Data;
        }
        try {
            const signature = "NATASSSHKA_VALID";
            const signatureBase64 = btoa(signature);
            const dataWithSignature = signatureBase64 + base64Data;
            return CryptoJS.AES.encrypt(dataWithSignature, this.encryptionKey).toString();
        } catch (error) {
            return base64Data;
        }
    }
    decryptFile(encryptedBase64) {
        if (!this.encryptionKey || !encryptedBase64) {
            throw new Error('Неверный ключ шифрования');
        }
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedBase64, this.encryptionKey);
            if (!bytes.sigBytes || bytes.sigBytes === 0) {
                throw new Error('Неверный ключ шифрования');
            }
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted) {
                throw new Error('Неверный ключ шифрования');
            }
            const signature = "NATASSSHKA_VALID";
            const signatureBase64 = btoa(signature);
            if (!decrypted.startsWith(signatureBase64)) {
                throw new Error('Неверный ключ шифрования');
            }
            return decrypted.substring(signatureBase64.length);
        } catch (error) {
            throw new Error('Неверный ключ шифрования');
        }
    }
    debounce(callback, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(callback, delay);
    }
}
window.encryptionManager = new EncryptionManager();