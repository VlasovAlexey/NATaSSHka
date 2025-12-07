// app/src/main/java/com/natasshka/messenger/CryptoJSCompat.kt
package com.natasshka.messenger

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Класс для совместимости с CryptoJS шифрованием
 * ВАЖНО: CryptoJS.AES.encrypt() возвращает объект CipherParams,
 * который при .toString() дает строку в OpenSSL-совместимом формате:
 * "Salted__<salt><encrypted_data>"
 */
object CryptoJSCompat {
    private const val SIGNATURE = "NATASSSHKA_VALID"

    // Параметры PBKDF2 как в CryptoJS (по умолчанию)
    private const val PBKDF2_ITERATIONS = 1 // CryptoJS использует 1 итерацию по умолчанию!
    private const val KEY_SIZE = 256 // бит
    private const val KEY_SIZE_BYTES = KEY_SIZE / 8

    /**
     * Шифрует сообщение в точности как CryptoJS.AES.encrypt(text, password)
     * Возвращает строку в формате "U2FsdGVkX1<base64_encoded_data>"
     */
    fun encryptText(message: String, password: String): String {
        if (password.isEmpty() || message.isEmpty()) {
            return message
        }

        try {
            // Генерируем случайную соль (8 байт)
            val salt = ByteArray(8)
            SecureRandom().nextBytes(salt)

            // Генерируем ключ и IV из пароля и соли
            // ВАЖНО: CryptoJS использует EVP_BytesToKey с 1 итерацией, а не PBKDF2!
            val (key, iv) = generateKeyAndIV(password, salt)

            // Шифруем данные
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))

            // Формируем результат: "Salted__" + salt + encrypted
            val result = ByteArray(8 + 8 + encrypted.size).apply {
                // "Salted__" в байтах
                System.arraycopy("Salted__".toByteArray(StandardCharsets.UTF_8), 0, this, 0, 8)
                // Соль
                System.arraycopy(salt, 0, this, 8, 8)
                // Зашифрованные данные
                System.arraycopy(encrypted, 0, this, 16, encrypted.size)
            }

            // Кодируем в Base64 (как делает CryptoJS)
            return Base64.encodeToString(result, Base64.NO_WRAP)

        } catch (e: Exception) {
            e.printStackTrace()
            return message
        }
    }

    /**
     * Расшифровывает сообщение, зашифрованное CryptoJS
     */
    fun decryptText(encryptedBase64: String, password: String): String {
        if (password.isEmpty() || encryptedBase64.isEmpty()) {
            return encryptedBase64
        }

        try {
            // Декодируем Base64
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)

            // Проверяем формат "Salted__"
            if (encryptedData.size < 16) {
                throw Exception("Неверный формат: слишком короткие данные")
            }

            val prefix = String(encryptedData.copyOfRange(0, 8), StandardCharsets.UTF_8)
            if (prefix != "Salted__") {
                throw Exception("Неверный формат: отсутствует префикс 'Salted__'")
            }

            // Извлекаем соль (8 байт)
            val salt = encryptedData.copyOfRange(8, 16)

            // Извлекаем зашифрованные данные
            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

            // Генерируем ключ и IV
            val (key, iv) = generateKeyAndIV(password, salt)

            // Дешифруем
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val decrypted = cipher.doFinal(ciphertext)
            return String(decrypted, StandardCharsets.UTF_8)

        } catch (e: Exception) {
            e.printStackTrace()
            return "🔒 Неверный ключ шифрования"
        }
    }

    /**
     * Проверяет, зашифровано ли сообщение в формате CryptoJS
     * CryptoJS формат: начинается с "U2FsdGVkX1" в Base64 (что декодируется в "Salted__")
     */
    fun isCryptoJSEncrypted(encryptedBase64: String): Boolean {
        if (encryptedBase64.isEmpty()) return false

        try {
            // Быстрая проверка: CryptoJS шифрование начинается с "U2FsdGVkX1" в Base64
            if (encryptedBase64.startsWith("U2FsdGVkX1")) {
                return true
            }

            // Дополнительная проверка через декодирование
            val decoded = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            if (decoded.size < 16) return false

            val prefix = String(decoded.copyOfRange(0, 8), StandardCharsets.UTF_8)
            return prefix == "Salted__"
        } catch (e: Exception) {
            return false
        }
    }

    /**
     * Генерирует ключ и IV из пароля и соли, как это делает CryptoJS
     * CryptoJS использует OpenSSL-совместимый алгоритм EVP_BytesToKey с MD5 и 1 итерацией
     */
    private fun generateKeyAndIV(password: String, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)

        // Первый раунд MD5: password + salt
        val md5Round1 = md5(passwordBytes + salt)

        // Второй раунд MD5: round1 + password + salt
        val md5Round2 = md5(md5Round1 + passwordBytes + salt)

        // Третий раунд MD5: round2 + password + salt (для IV)
        val md5Round3 = md5(md5Round2 + passwordBytes + salt)

        // Берем первые 16 байт из round1+round2 для ключа (256 бит = 32 байта)
        val key = ByteArray(32)
        System.arraycopy(md5Round1, 0, key, 0, 16)
        System.arraycopy(md5Round2, 0, key, 16, 16)

        // Берем первые 16 байт из round3 для IV
        val iv = ByteArray(16)
        System.arraycopy(md5Round3, 0, iv, 0, 16)

        return Pair(key, iv)
    }

    /**
     * MD5 хеш (CryptoJS использует MD5 для EVP_BytesToKey)
     */
    private fun md5(data: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("MD5")
        return md.digest(data)
    }

    /**
     * Упрощенная версия для совместимости со старым кодом
     * Использует прямое хеширование SHA256 (не CryptoJS-совместимое)
     */
    fun encryptTextSimple(message: String, password: String): String {
        if (password.isEmpty()) return message

        try {
            // Генерируем ключ из пароля через SHA256
            val key = generateKeySHA256(password)

            // Генерируем случайный IV
            val iv = ByteArray(16)
            SecureRandom().nextBytes(iv)

            // Шифруем
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))

            // Объединяем IV + encrypted
            val result = ByteArray(iv.size + encrypted.size)
            System.arraycopy(iv, 0, result, 0, iv.size)
            System.arraycopy(encrypted, 0, result, iv.size, encrypted.size)

            return Base64.encodeToString(result, Base64.NO_WRAP)
        } catch (e: Exception) {
            e.printStackTrace()
            return message
        }
    }

    fun decryptTextSimple(encryptedBase64: String, password: String): String {
        if (password.isEmpty()) return encryptedBase64

        try {
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)

            // Первые 16 байт - IV
            val iv = encryptedData.copyOfRange(0, 16)
            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

            // Генерируем ключ
            val key = generateKeySHA256(password)

            // Дешифруем
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val decrypted = cipher.doFinal(ciphertext)
            return String(decrypted, StandardCharsets.UTF_8)
        } catch (e: Exception) {
            e.printStackTrace()
            return "🔒 Неверный ключ шифрования"
        }
    }

    private fun generateKeySHA256(password: String): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(password.toByteArray(StandardCharsets.UTF_8))
    }

}