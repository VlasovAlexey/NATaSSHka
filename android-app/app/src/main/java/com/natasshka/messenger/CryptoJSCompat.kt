package com.natasshka.messenger

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoJSCompat {
    private const val SIGNATURE = "NATASSSHKA_VALID"
    fun encryptFileToBase64(data: ByteArray, password: String): String {
        if (password.isEmpty()) {
            return Base64.encodeToString(data, Base64.NO_WRAP)
        }
        try {
            val base64Data = Base64.encodeToString(data, Base64.NO_WRAP)
            val signatureBase64 = Base64.encodeToString(
                SIGNATURE.toByteArray(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            )
            val dataWithSignature = signatureBase64 + base64Data
            val encryptedText = encryptText(dataWithSignature, password)
            return encryptedText
        } catch (e: Exception) {
            return Base64.encodeToString(data, Base64.NO_WRAP)
        }
    }
    fun encryptText(message: String, password: String): String {
        if (password.isEmpty()) {
            return message
        }
        try {
            val salt = ByteArray(8).apply {
                java.security.SecureRandom().nextBytes(this)
            }
            val (key, iv) = generateCryptoJSKeyAndIV(password, salt)
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))
            val result = ByteArray(8 + 8 + encrypted.size).apply {
                System.arraycopy("Salted__".toByteArray(StandardCharsets.UTF_8), 0, this, 0, 8)
                System.arraycopy(salt, 0, this, 8, 8)
                System.arraycopy(encrypted, 0, this, 16, encrypted.size)
            }
            val base64Result = Base64.encodeToString(result, Base64.NO_WRAP)
            return base64Result
        } catch (e: Exception) {
            return message
        }
    }
    fun decryptFileCompatibleJS(encryptedBase64: String, password: String): ByteArray {
        if (password.isEmpty()) {
            return Base64.decode(encryptedBase64, Base64.NO_WRAP)
        }
        return try {
            val decryptedText = decryptText(encryptedBase64, password)
            val signatureBase64 = Base64.encodeToString(
                SIGNATURE.toByteArray(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            )
            if (!decryptedText.startsWith(signatureBase64)) {
                throw Exception("Неверный ключ шифрования или формат данных")
            }
            val base64Data = decryptedText.substring(signatureBase64.length)
            val result = Base64.decode(base64Data, Base64.NO_WRAP)
            result
        } catch (e: Exception) {
            throw e
        }
    }
    fun decryptText(encryptedBase64: String, password: String): String {
        if (password.isEmpty()) {
            return encryptedBase64
        }
        try {
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            if (encryptedData.size < 16) {
                throw Exception("Неверный размер зашифрованных данных")
            }
            val prefix = String(encryptedData.copyOfRange(0, 8), StandardCharsets.UTF_8)
            if (prefix != "Salted__") {
                throw Exception("Неверный формат данных (отсутствует 'Salted__')")
            }
            val salt = encryptedData.copyOfRange(8, 16)
            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)
            val (key, iv) = generateCryptoJSKeyAndIV(password, salt)
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
            val decrypted = cipher.doFinal(ciphertext)
            val result = String(decrypted, StandardCharsets.UTF_8)
            return result
        } catch (e: Exception) {
            throw e
        }
    }
    private fun generateCryptoJSKeyAndIV(password: String, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)
        var data = passwordBytes + salt
        val md = MessageDigest.getInstance("MD5")
        val round1 = md.digest(data)
        val round2 = md.digest(round1 + passwordBytes + salt)
        val round3 = md.digest(round2 + passwordBytes + salt)
        val key = ByteArray(32)
        System.arraycopy(round1, 0, key, 0, 16)
        System.arraycopy(round2, 0, key, 16, 16)
        val iv = ByteArray(16)
        System.arraycopy(round3, 0, iv, 0, 16)
        return Pair(key, iv)
    }
    fun decryptFileFromBase64(encryptedBase64: String, password: String): ByteArray {
        return decryptFileCompatibleJS(encryptedBase64, password)
    }
    fun isCryptoJSEncrypted(encryptedBase64: String): Boolean {
        try {
            if (encryptedBase64.isEmpty()) return false
            val decoded = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            if (decoded.size >= 8) {
                val prefix = String(decoded.copyOfRange(0, 8), StandardCharsets.UTF_8)
                if (prefix == "Salted__") {
                    return true
                }
            }
            return false
        } catch (e: Exception) {
            return false
        }
    }
}