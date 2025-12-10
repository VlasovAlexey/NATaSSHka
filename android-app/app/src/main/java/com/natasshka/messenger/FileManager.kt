// [file name]: FileManager.kt
package com.natasshka.messenger

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.*
import java.util.*

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
            Log.d(TAG, "Сохранение в Downloads/NATaSSHka: $fileName")

            // Декодируем данные
            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                decryptFileData(fileData, encryptionKey)
            } else {
                Base64.getDecoder().decode(fileData)
            }

            Log.d(TAG, "Путь к Downloads: ${downloadsDir.absolutePath}")
            Log.d(TAG, "Папка существует: ${downloadsDir.exists()}")
            Log.d(TAG, "Можно писать: ${downloadsDir.canWrite()}")

            // Создаем уникальное имя файла
            var finalFile = File(downloadsDir, fileName)
            var counter = 1

            // Проверяем и создаем уникальное имя если файл уже существует
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

            // Сохраняем файл
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

    // Запасной метод: сохранение во внутреннее хранилище
    private suspend fun saveToInternalStorage(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                decryptFileData(fileData, encryptionKey)
            } else {
                Base64.getDecoder().decode(fileData)
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

    // Остальные методы остаются без изменений
    suspend fun prepareFileForSending(
        uri: Uri,
        fileName: String,
        mimeType: String,
        encryptionKey: String = ""
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: throw IOException("Не удалось открыть файл")

            val fileBytes = inputStream.use { it.readBytes() }
            val fileSize = fileBytes.size

            val fileType = getFileType(mimeType, fileName)

            val fileData = if (encryptionKey.isNotEmpty()) {
                encryptFileData(fileBytes, encryptionKey)
            } else {
                Base64.getEncoder().encodeToString(fileBytes)
            }

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
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Не удалось получить длительность медиа: ${e.message}")
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка подготовки файла: ${e.message}")
            throw e
        }
    }

    // Метод для получения пути к папке Downloads/NATaSSHka
    fun getDownloadsPath(): String {
        return downloadsDir.absolutePath
    }

    // Остальные методы класса остаются без изменений...
    // (getFileType, getFileIcon, getFileBackgroundColor, formatFileSize и т.д.)

    private fun encryptFileData(data: ByteArray, key: String): String {
        return if (key.isEmpty()) {
            Base64.getEncoder().encodeToString(data)
        } else {
            CryptoJSCompat.encryptText(String(data, Charsets.UTF_8), key)
        }
    }

    private fun decryptFileData(encryptedData: String, key: String): ByteArray {
        return if (key.isEmpty()) {
            Base64.getDecoder().decode(encryptedData)
        } else {
            val decryptedText = CryptoJSCompat.decryptText(encryptedData, key)
            decryptedText.toByteArray(Charsets.UTF_8)
        }
    }

    fun formatFileSize(size: Long): String {
        return when {
            size >= 1024 * 1024 -> String.format("%.1f MB", size.toFloat() / (1024 * 1024))
            size >= 1024 -> String.format("%.1f KB", size.toFloat() / 1024)
            else -> "$size B"
        }
    }

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

    fun getFileIcon(fileType: FileType): Int {
        return when (fileType) {
            FileType.IMAGE -> R.drawable.ic_image
            FileType.VIDEO -> R.drawable.ic_video
            FileType.AUDIO -> R.drawable.ic_mic
            FileType.DOCUMENT -> R.drawable.ic_document
        }
    }

    fun getFileBackgroundColor(fileType: FileType): Int {
        return when (fileType) {
            FileType.IMAGE -> R.color.image_bg
            FileType.VIDEO -> R.color.video_bg
            FileType.AUDIO -> R.color.audio_bg
            FileType.DOCUMENT -> R.color.document_bg
        }
    }

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

    enum class FileType {
        IMAGE, VIDEO, AUDIO, DOCUMENT
    }
    fun cleanupTempFiles() {
        try {
            tempDir.listFiles()?.forEach { it.delete() }
            Log.d(TAG, "Временные файлы очищены")
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка очистки временных файлов: ${e.message}")
        }
    }
}