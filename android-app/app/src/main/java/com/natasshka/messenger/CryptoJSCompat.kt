package com.natasshka.messenger

import android.util.Base64
import android.util.Log
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoJSCompat {
    private const val TAG = "CryptoJSCompat"
    private const val SIGNATURE = "NATASSSHKA_VALID"

    /**
     * ШИФРОВАНИЕ ФАЙЛОВ КАК НА JS-КЛИЕНТЕ
     * Последовательность: data → base64 → сигнатура + base64 → шифрование AES → зашифрованный base64
     * ТОЧНО ТАК ЖЕ КАК В JS: signatureBase64 + base64Data → шифрование
     */
    fun encryptFileToBase64(data: ByteArray, password: String): String {
        Log.d(TAG, "encryptFileToBase64: размер данных=${data.size}, есть пароль=${password.isNotEmpty()}")

        if (password.isEmpty()) {
            return Base64.encodeToString(data, Base64.NO_WRAP)
        }

        try {
            // 1. Преобразуем данные в base64 (как JS FileReader.readAsDataURL())
            val base64Data = Base64.encodeToString(data, Base64.NO_WRAP)
            Log.d(TAG, "Шаг 1: Данные преобразованы в base64, длина: ${base64Data.length}")

            // 2. Добавляем сигнатуру КАК В JS-КЛИЕНТЕ: signatureBase64 = btoa(signature)
            val signatureBase64 = Base64.encodeToString(
                SIGNATURE.toByteArray(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            )
            // В JS: const dataWithSignature = signatureBase64 + base64Data;
            val dataWithSignature = signatureBase64 + base64Data
            Log.d(TAG, "Шаг 2: Добавлена сигнатура, общая длина: ${dataWithSignature.length}")

            // 3. Шифруем КАК В JS: CryptoJS.AES.encrypt(dataWithSignature, encryptionKey).toString()
            val encryptedText = encryptText(dataWithSignature, password)
            Log.d(TAG, "Шаг 3: Зашифровано, длина результата: ${encryptedText.length}")

            return encryptedText

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка шифрования файла: ${e.message}", e)
            return Base64.encodeToString(data, Base64.NO_WRAP)
        }
    }

    /**
     * ШИФРОВАНИЕ ТЕКСТА (совместимо с JS CryptoJS.AES.encrypt)
     * Формат: Salted__ + salt + IV + encrypted data
     */
    fun encryptText(message: String, password: String): String {
        Log.d(TAG, "encryptText: длина сообщения=${message.length}, есть пароль=${password.isNotEmpty()}")

        if (password.isEmpty()) {
            return message
        }

        try {
            // Генерируем случайный salt (8 байт) как CryptoJS
            val salt = ByteArray(8).apply {
                java.security.SecureRandom().nextBytes(this)
            }

            // Генерируем ключ и IV из пароля и salt (как CryptoJS.EvpKDF)
            val (key, iv) = generateCryptoJSKeyAndIV(password, salt)

            // Шифруем данные
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))

            // Формируем результат в формате CryptoJS: Salted__ + salt + encrypted data
            val result = ByteArray(8 + 8 + encrypted.size).apply {
                // "Salted__" префикс
                System.arraycopy("Salted__".toByteArray(StandardCharsets.UTF_8), 0, this, 0, 8)
                // Salt (8 байт)
                System.arraycopy(salt, 0, this, 8, 8)
                // Зашифрованные данные
                System.arraycopy(encrypted, 0, this, 16, encrypted.size)
            }

            val base64Result = Base64.encodeToString(result, Base64.NO_WRAP)
            Log.d(TAG, "encryptText: успешно, длина результата=${base64Result.length}")

            return base64Result

        } catch (e: Exception) {
            Log.e(TAG, "encryptText error: ${e.message}", e)
            return message
        }
    }

    /**
     * ДЕШИФРОВАНИЕ ФАЙЛОВ КАК НА JS-КЛИЕНТЕ
     * Обратный процесс: encryptedBase64 → дешифрование → проверка сигнатуры → извлечение base64 → декодирование
     */
    fun decryptFileCompatibleJS(encryptedBase64: String, password: String): ByteArray {
        Log.d(TAG, "decryptFileCompatibleJS: длина base64=${encryptedBase64.length}, есть пароль=${password.isNotEmpty()}")

        if (password.isEmpty()) {
            return Base64.decode(encryptedBase64, Base64.NO_WRAP)
        }

        return try {
            // 1. Дешифруем текст (CryptoJS.AES.decrypt на JS)
            val decryptedText = decryptText(encryptedBase64, password)
            Log.d(TAG, "Дешифрованный текст длина: ${decryptedText.length}")

            // 2. Проверяем сигнатуру КАК В JS: const signatureBase64 = btoa("NATASSSHKA_VALID")
            val signatureBase64 = Base64.encodeToString(
                SIGNATURE.toByteArray(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            )

            if (!decryptedText.startsWith(signatureBase64)) {
                Log.e(TAG, "❌ Сигнатура не найдена в дешифрованном тексте")
                Log.d(TAG, "Начинается с: ${decryptedText.take(50)}...")
                throw Exception("Неверный ключ шифрования или формат данных")
            }

            // 3. Извлекаем base64 данных (после сигнатуры) КАК В JS
            val base64Data = decryptedText.substring(signatureBase64.length)
            Log.d(TAG, "Base64 данных длина: ${base64Data.length}")

            // 4. Декодируем base64 в байты
            val result = Base64.decode(base64Data, Base64.NO_WRAP)
            Log.d(TAG, "✅ Успешно! Размер после декодирования: ${result.size} байт")

            result

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка в decryptFileCompatibleJS: ${e.message}")
            throw e
        }
    }

    /**
     * ДЕШИФРОВАНИЕ ТЕКСТА (совместимо с JS CryptoJS.AES.decrypt)
     */
    fun decryptText(encryptedBase64: String, password: String): String {
        Log.d(TAG, "decryptText: длина base64=${encryptedBase64.length}, есть пароль=${password.isNotEmpty()}")

        if (password.isEmpty()) {
            return encryptedBase64
        }

        try {
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)

            // Проверяем формат CryptoJS "Salted__"
            if (encryptedData.size < 16) {
                throw Exception("Неверный размер зашифрованных данных")
            }

            val prefix = String(encryptedData.copyOfRange(0, 8), StandardCharsets.UTF_8)
            if (prefix != "Salted__") {
                throw Exception("Неверный формат данных (отсутствует 'Salted__')")
            }

            // Извлекаем salt
            val salt = encryptedData.copyOfRange(8, 16)
            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

            // Генерируем ключ и IV из пароля и salt
            val (key, iv) = generateCryptoJSKeyAndIV(password, salt)

            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val decrypted = cipher.doFinal(ciphertext)
            val result = String(decrypted, StandardCharsets.UTF_8)

            Log.d(TAG, "✅ decryptText: успешно, длина результата=${result.length}")
            return result

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка дешифрования текста: ${e.message}")
            throw e
        }
    }

    /**
     * Генерация ключа и IV в стиле CryptoJS (EVP_BytesToKey с MD5)
     */
    private fun generateCryptoJSKeyAndIV(password: String, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)

        var data = passwordBytes + salt
        val md = MessageDigest.getInstance("MD5")

        // 3 раунда MD5 как в CryptoJS.EvpKDF с 1 итерацией
        val round1 = md.digest(data)
        val round2 = md.digest(round1 + passwordBytes + salt)
        val round3 = md.digest(round2 + passwordBytes + salt)

        // Ключ AES-256: 32 байта
        val key = ByteArray(32)
        System.arraycopy(round1, 0, key, 0, 16)
        System.arraycopy(round2, 0, key, 16, 16)

        // IV: 16 байт
        val iv = ByteArray(16)
        System.arraycopy(round3, 0, iv, 0, 16)

        Log.d(TAG, "Сгенерирован ключ (${key.size} байт) и IV (${iv.size} байт)")
        return Pair(key, iv)
    }

    /**
     * Методы для обратной совместимости (оставляем старые сигнатуры)
     */
    fun decryptFileFromBase64(encryptedBase64: String, password: String): ByteArray {
        return decryptFileCompatibleJS(encryptedBase64, password)
    }

    /**
     * Проверка, зашифрованы ли данные
     */
    fun isCryptoJSEncrypted(encryptedBase64: String): Boolean {
        try {
            if (encryptedBase64.isEmpty()) return false

            val decoded = Base64.decode(encryptedBase64, Base64.NO_WRAP)

            // Проверяем формат CryptoJS "Salted__"
            if (decoded.size >= 8) {
                val prefix = String(decoded.copyOfRange(0, 8), StandardCharsets.UTF_8)
                if (prefix == "Salted__") {
                    return true
                }
            }

            return false
        } catch (e: Exception) {
            Log.e(TAG, "isCryptoJSEncrypted error: ${e.message}")
            return false
        }
    }
}