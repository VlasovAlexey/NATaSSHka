package com.natasshka.messenger

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoJSCompat {
    private const val SIGNATURE = "NATASSSHKA_VALID"

    private const val PBKDF2_ITERATIONS = 1
    private const val KEY_SIZE = 256
    private const val KEY_SIZE_BYTES = KEY_SIZE / 8

    fun encryptText(message: String, password: String): String {
        if (password.isEmpty() || message.isEmpty()) {
            return message
        }

        try {
            val salt = ByteArray(8)
            SecureRandom().nextBytes(salt)

            val (key, iv) = generateKeyAndIV(password, salt)

            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))

            val result = ByteArray(8 + 8 + encrypted.size).apply {
                System.arraycopy("Salted__".toByteArray(StandardCharsets.UTF_8), 0, this, 0, 8)
                System.arraycopy(salt, 0, this, 8, 8)
                System.arraycopy(encrypted, 0, this, 16, encrypted.size)
            }

            return Base64.encodeToString(result, Base64.NO_WRAP)

        } catch (e: Exception) {
            e.printStackTrace()
            return message
        }
    }

    fun decryptText(encryptedBase64: String, password: String): String {
        if (password.isEmpty() || encryptedBase64.isEmpty()) {
            return encryptedBase64
        }

        try {
            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)

            if (encryptedData.size < 16) {
                throw Exception("Неверный формат: слишком короткие данные")
            }

            val prefix = String(encryptedData.copyOfRange(0, 8), StandardCharsets.UTF_8)
            if (prefix != "Salted__") {
                throw Exception("Неверный формат: отсутствует префикс 'Salted__'")
            }

            val salt = encryptedData.copyOfRange(8, 16)

            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

            val (key, iv) = generateKeyAndIV(password, salt)

            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val decrypted = cipher.doFinal(ciphertext)
            return String(decrypted, StandardCharsets.UTF_8)

        } catch (e: Exception) {
            e.printStackTrace()
            return "🔒 Неверный ключ шифрования"
        }
    }

    fun isCryptoJSEncrypted(encryptedBase64: String): Boolean {
        if (encryptedBase64.isEmpty()) return false

        try {
            if (encryptedBase64.startsWith("U2FsdGVkX1")) {
                return true
            }

            val decoded = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            if (decoded.size < 16) return false

            val prefix = String(decoded.copyOfRange(0, 8), StandardCharsets.UTF_8)
            return prefix == "Salted__"
        } catch (e: Exception) {
            return false
        }
    }

    private fun generateKeyAndIV(password: String, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)

        val md5Round1 = md5(passwordBytes + salt)

        val md5Round2 = md5(md5Round1 + passwordBytes + salt)

        val md5Round3 = md5(md5Round2 + passwordBytes + salt)

        val key = ByteArray(32)
        System.arraycopy(md5Round1, 0, key, 0, 16)
        System.arraycopy(md5Round2, 0, key, 16, 16)

        val iv = ByteArray(16)
        System.arraycopy(md5Round3, 0, iv, 0, 16)

        return Pair(key, iv)
    }

    private fun md5(data: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("MD5")
        return md.digest(data)
    }

    fun encryptTextSimple(message: String, password: String): String {
        if (password.isEmpty()) return message

        try {
            val key = generateKeySHA256(password)

            val iv = ByteArray(16)
            SecureRandom().nextBytes(iv)

            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))

            val encrypted = cipher.doFinal(message.toByteArray(StandardCharsets.UTF_8))

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

            val iv = encryptedData.copyOfRange(0, 16)
            val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

            val key = generateKeySHA256(password)

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