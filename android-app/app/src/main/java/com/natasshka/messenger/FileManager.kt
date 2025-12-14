package com.natasshka.messenger

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.*
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.*
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class FileManager(private val context: Context) {

    companion object {
        private const val TAG = "FileManager"
        private const val APP_FOLDER_NAME = "NATaSSHka"
    }

    private val tempDir: File by lazy {
        File(context.cacheDir, "temp_files").apply {
            if (!exists()) mkdirs()
        }
    }

    // Папка в Downloads/NATaSSHka
    private val downloadsDir: File by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Для Android 10+ используем MediaStore API
            try {
                // Пытаемся получить доступ к Downloads через MediaStore
                val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                File(downloads, APP_FOLDER_NAME).apply {
                    if (!exists()) {
                        mkdirs()
                        // Создаем .nomedia файл чтобы папка не сканировалась галереей
                        File(this, ".nomedia").createNewFile()
                    }
                }
            } catch (e: Exception) {
                // Если не получилось, сохраняем во внутреннее хранилище
                File(context.getExternalFilesDir(null), APP_FOLDER_NAME).apply {
                    if (!exists()) mkdirs()
                }
            }
        } else {
            // Для старых версий Android
            val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            File(downloads, APP_FOLDER_NAME).apply {
                if (!exists()) mkdirs()
            }
        }
    }

    // Метод для сохранения файла в Downloads/NATaSSHka
    suspend fun saveToDownloads(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "saveToDownloads: fileName=$fileName, isEncrypted=$isEncrypted, keyLength=${encryptionKey.length}")

            // Декодируем данные
            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    Log.d(TAG, "Пробуем совместимое с JS дешифрование файла")
                    CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                } catch (e: Exception) {
                    Log.e(TAG, "decryptFileCompatibleJS не сработал: ${e.message}")

                    // Пробуем старый метод для обратной совместимости
                    try {
                        Log.d(TAG, "Пробуем дешифровать как текст")
                        val decryptedText = CryptoJSCompat.decryptText(fileData, encryptionKey)
                        if (!decryptedText.contains("🔒") && decryptedText.isNotEmpty()) {
                            Log.d(TAG, "Успешно дешифровано как текст, длина: ${decryptedText.length}")

                            // Пробуем декодировать как base64 (для файлов)
                            try {
                                val bytes = Base64.decode(decryptedText, Base64.NO_WRAP)
                                Log.d(TAG, "Текст успешно декодирован как base64, размер: ${bytes.size} байт")
                                bytes
                            } catch (e2: Exception) {
                                // Если не base64, используем строку как есть
                                Log.d(TAG, "Текст не base64, используем как текст")
                                decryptedText.toByteArray(Charsets.UTF_8)
                            }
                        } else {
                            Log.e(TAG, "Текст содержит ошибку дешифрования")
                            throw Exception("Ошибка дешифрования")
                        }
                    } catch (e2: Exception) {
                        Log.e(TAG, "Дешифрование как текст не сработало: ${e2.message}")

                        // Последняя попытка - просто base64
                        try {
                            Base64.decode(fileData, Base64.DEFAULT)
                        } catch (e3: Exception) {
                            Log.e(TAG, "Все методы дешифрования провалились")
                            ByteArray(0)
                        }
                    }
                }
            } else {
                Log.d(TAG, "Файл не зашифрован, декодируем base64")
                Base64.decode(fileData, Base64.DEFAULT)
            }

            Log.d(TAG, "Данные декодированы, размер: ${decodedBytes.size} байт")

            // Сохраняем файл
            val finalFile = createUniqueFile(fileName)
            finalFile.outputStream().use { output ->
                output.write(decodedBytes)
            }

            // Проверяем что файл создан
            if (finalFile.exists() && finalFile.length() > 0) {
                Log.d(TAG, "✅ Файл успешно сохранен в Downloads: ${finalFile.absolutePath}")
                Log.d(TAG, "Размер файла: ${finalFile.length()} байт")
            } else {
                Log.e(TAG, "❌ Файл не создан или пустой!")
                // Пробуем сохранить во внутреннее хранилище как запасной вариант
                return@withContext saveToInternalStorage(fileData, fileName, isEncrypted, encryptionKey)
            }

            finalFile

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка сохранения в Downloads: ${e.message}", e)
            // Если не удалось сохранить в Downloads, сохраняем во внутреннее хранилище
            return@withContext saveToInternalStorage(fileData, fileName, isEncrypted, encryptionKey)
        }
    }

    // Вспомогательный метод для создания уникального имени файла
    private fun createUniqueFile(fileName: String): File {
        var finalFile = File(downloadsDir, fileName)
        var counter = 1

        while (finalFile.exists()) {
            val nameWithoutExt = fileName.substringBeforeLast(".")
            val extension = fileName.substringAfterLast(".", "")
            val newName = if (extension.isNotEmpty() && nameWithoutExt != fileName) {
                "${nameWithoutExt}_${counter}.$extension"
            } else {
                "${fileName}_${counter}"
            }
            finalFile = File(downloadsDir, newName)
            counter++
            if (counter > 100) break // Защита от бесконечного цикла
        }

        Log.d(TAG, "Финальный путь: ${finalFile.absolutePath}")
        return finalFile
    }

    // Запасной метод: сохранение во внутреннее хранилище
    private suspend fun saveToInternalStorage(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "saveToInternalStorage: fileName=$fileName")

            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    CryptoJSCompat.decryptFileFromBase64(fileData, encryptionKey)
                } catch (e: Exception) {
                    Log.e(TAG, "Ошибка дешифрования во внутреннем хранилище: ${e.message}")
                    try {
                        val decryptedText = CryptoJSCompat.decryptText(fileData, encryptionKey)
                        decryptedText.toByteArray(Charsets.UTF_8)
                    } catch (e2: Exception) {
                        Base64.decode(fileData, Base64.DEFAULT)
                    }
                }
            } else {
                Base64.decode(fileData, Base64.DEFAULT)
            }

            val internalDir = File(context.getExternalFilesDir(null), APP_FOLDER_NAME).apply {
                if (!exists()) mkdirs()
            }

            var finalFile = File(internalDir, fileName)
            var counter = 1
            while (finalFile.exists()) {
                val nameWithoutExt = fileName.substringBeforeLast(".")
                val extension = fileName.substringAfterLast(".", "")
                val newName = if (extension.isNotEmpty() && nameWithoutExt != fileName) {
                    "${nameWithoutExt}_${counter}.$extension"
                } else {
                    "${fileName}_${counter}"
                }
                finalFile = File(internalDir, newName)
                counter++
            }

            finalFile.outputStream().use { output ->
                output.write(decodedBytes)
            }

            Log.d(TAG, "Файл сохранен во внутреннее хранилище: ${finalFile.absolutePath}")
            finalFile

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка сохранения во внутреннее хранилище: ${e.message}")
            throw e
        }
    }

    // Старый метод оставляем для совместимости
    suspend fun saveReceivedFile(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        // По умолчанию используем сохранение в Downloads
        saveToDownloads(fileData, fileName, isEncrypted, encryptionKey)
    }

    // Метод для подготовки файла для отправки
    suspend fun prepareFileForSending(
        uri: Uri,
        fileName: String,
        mimeType: String,
        encryptionKey: String = ""
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "prepareFileForSending: fileName=$fileName, mimeType=$mimeType, hasKey=${encryptionKey.isNotEmpty()}")

            val inputStream = context.contentResolver.openInputStream(uri)
                ?: throw IOException("Не удалось открыть файл")

            val fileBytes = inputStream.use { it.readBytes() }
            val fileSize = fileBytes.size

            Log.d(TAG, "Файл прочитан, размер: $fileSize байт")

            val fileType = getFileType(mimeType, fileName)

            // Шифруем файл если есть ключ
            val fileData = if (encryptionKey.isNotEmpty()) {
                Log.d(TAG, "Шифруем файл с ключом")
                CryptoJSCompat.encryptFileToBase64(fileBytes, encryptionKey)
            } else {
                Log.d(TAG, "Файл без шифрования")
                Base64.encodeToString(fileBytes, Base64.DEFAULT)
            }

            Log.d(TAG, "Данные подготовлены, длина base64: ${fileData.length}")

            JSONObject().apply {
                put("fileName", fileName)
                put("fileType", mimeType)
                put("fileSize", fileSize)
                put("fileData", fileData)
                put("isEncrypted", encryptionKey.isNotEmpty())
                put("fileCategory", fileType.name)

                if (fileType == FileType.VIDEO || fileType == FileType.AUDIO) {
                    try {
                        val duration = getMediaDuration(uri, mimeType)
                        if (duration > 0) {
                            put("duration", duration)
                            Log.d(TAG, "Длительность медиа: $duration мс")
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Не удалось получить длительность медиа: ${e.message}")
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка подготовки файла: ${e.message}", e)
            throw e
        }
    }

    // Метод для получения пути к папке Downloads/NATaSSHka
    fun getDownloadsPath(): String {
        return downloadsDir.absolutePath
    }

    // Старый метод дешифрования файлов для обратной совместимости
    private fun decryptFileFromBase64Old(encryptedBase64: String, key: String): ByteArray {
        if (key.isEmpty()) {
            return Base64.decode(encryptedBase64, Base64.NO_WRAP)
        }

        try {
            Log.d(TAG, "decryptFileFromBase64Old: keyLength=${key.length}")

            val encryptedData = Base64.decode(encryptedBase64, Base64.NO_WRAP)
            Log.d(TAG, "Декодированный размер: ${encryptedData.size} байт")

            // Проверяем формат "Salted__"
            if (encryptedData.size >= 16) {
                val prefix = String(encryptedData.copyOfRange(0, 8), StandardCharsets.UTF_8)
                Log.d(TAG, "Проверка префикса: '$prefix'")

                if (prefix == "Salted__") {
                    Log.d(TAG, "Обнаружен старый формат CryptoJS (Salted__)")
                    val salt = encryptedData.copyOfRange(8, 16)
                    val ciphertext = encryptedData.copyOfRange(16, encryptedData.size)

                    val (keyBytes, iv) = generateKeyAndIVOld(key, salt)
                    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
                    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"),
                        IvParameterSpec(iv)
                    )

                    return cipher.doFinal(ciphertext)
                }
            }

            Log.d(TAG, "Пробуем как обычный AES (без Salted__)")
            // Пробуем как обычный AES
            val dummySalt = ByteArray(8)
            val (keyBytes, iv) = generateKeyAndIVOld(key, dummySalt)
            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), IvParameterSpec(iv))

            return cipher.doFinal(encryptedData)

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка в decryptFileFromBase64Old: ${e.message}", e)
            throw e
        }
    }

    private fun generateKeyAndIVOld(password: String, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)

        Log.d(TAG, "generateKeyAndIVOld: passwordLength=${password.length}, saltSize=${salt.size}")

        val md5Round1 = md5(passwordBytes + salt)
        val md5Round2 = md5(md5Round1 + passwordBytes + salt)
        val md5Round3 = md5(md5Round2 + passwordBytes + salt)

        val key = ByteArray(32)
        System.arraycopy(md5Round1, 0, key, 0, 16)
        System.arraycopy(md5Round2, 0, key, 16, 16)

        val iv = ByteArray(16)
        System.arraycopy(md5Round3, 0, iv, 0, 16)

        Log.d(TAG, "Ключ сгенерирован: ${key.size} байт, IV: ${iv.size} байт")

        return Pair(key, iv)
    }

    private fun md5(data: ByteArray): ByteArray {
        val md = MessageDigest.getInstance("MD5")
        return md.digest(data)
    }

    // Форматирование размера файла
    fun formatFileSize(size: Long): String {
        return when {
            size >= 1024 * 1024 -> String.format("%.1f MB", size.toFloat() / (1024 * 1024))
            size >= 1024 -> String.format("%.1f KB", size.toFloat() / 1024)
            else -> "$size B"
        }
    }

    // Определение типа файла
    fun getFileType(mimeType: String?, fileName: String?): FileType {
        val mime = mimeType?.lowercase(Locale.getDefault()) ?: ""
        val name = fileName?.lowercase(Locale.getDefault()) ?: ""

        val SUPPORTED_IMAGE_TYPES = listOf("image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp")
        val SUPPORTED_VIDEO_TYPES = listOf("video/mp4", "video/3gpp", "video/webm", "video/mkv")
        val SUPPORTED_AUDIO_TYPES = listOf("audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav")

        return when {
            SUPPORTED_IMAGE_TYPES.any { mime.contains(it) } ||
                    name.endsWith(".png") || name.endsWith(".jpg") ||
                    name.endsWith(".jpeg") || name.endsWith(".gif") || name.endsWith(".webp") ->
                FileType.IMAGE

            SUPPORTED_VIDEO_TYPES.any { mime.contains(it) } ||
                    name.endsWith(".mp4") || name.endsWith(".3gp") ||
                    name.endsWith(".webm") || name.endsWith(".mkv") ->
                FileType.VIDEO

            SUPPORTED_AUDIO_TYPES.any { mime.contains(it) } ||
                    name.endsWith(".mp3") || name.endsWith(".ogg") ||
                    name.endsWith(".wav") ->
                FileType.AUDIO

            else -> FileType.DOCUMENT
        }
    }

    // Получение иконки для типа файла
    fun getFileIcon(fileType: FileType): Int {
        return when (fileType) {
            FileType.IMAGE -> R.drawable.ic_image
            FileType.VIDEO -> R.drawable.ic_video
            FileType.AUDIO -> R.drawable.ic_mic
            FileType.DOCUMENT -> R.drawable.ic_document
        }
    }

    // Получение цвета фона для типа файла
    fun getFileBackgroundColor(fileType: FileType): Int {
        return when (fileType) {
            FileType.IMAGE -> R.color.image_bg
            FileType.VIDEO -> R.color.video_bg
            FileType.AUDIO -> R.color.audio_bg
            FileType.DOCUMENT -> R.color.document_bg
        }
    }

    // Получение длительности медиа файла
    private suspend fun getMediaDuration(uri: Uri, mimeType: String): Long =
        withContext(Dispatchers.IO) {
            try {
                if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
                    val retriever = MediaMetadataRetriever()
                    retriever.setDataSource(context, uri)

                    val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    retriever.release()

                    durationStr?.toLongOrNull() ?: 0
                } else {
                    0
                }
            } catch (e: Exception) {
                0
            }
        }

    // Перечисление типов файлов
    enum class FileType {
        IMAGE, VIDEO, AUDIO, DOCUMENT
    }

    // Очистка временных файлов
    fun cleanupTempFiles() {
        try {
            tempDir.listFiles()?.forEach { it.delete() }
            Log.d(TAG, "Временные файлы очищены")
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка очистки временных файлов: ${e.message}")
        }
    }

    // Вспомогательный метод для отладки - сохранение raw данных
    suspend fun saveRawDataForDebugging(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean
    ) {
        withContext(Dispatchers.IO) {
            try {
                val debugDir = File(context.getExternalFilesDir(null), "debug").apply {
                    if (!exists()) mkdirs()
                }

                val prefix = if (isEncrypted) "encrypted_" else "plain_"
                val debugFile = File(debugDir, "$prefix$fileName.txt")

                debugFile.writeText(fileData)

                Log.d(TAG, "Raw data saved for debugging: ${debugFile.absolutePath}")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving debug data: ${e.message}")
            }
        }
    }
}