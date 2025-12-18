package com.natasshka.messenger

import android.content.ContentValues
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.util.*

class FileManager(private val context: Context) {

    companion object {
        private const val TAG = "FileManager"
        private const val APP_FOLDER_NAME = "NATaSSHka"
        private const val SIGNATURE = "NATASSSHKA_VALID"
    }

    private val tempDir: File by lazy {
        File(context.cacheDir, "temp_files").apply {
            if (!exists()) mkdirs()
        }
    }

    private val downloadsDir: File by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                File(downloads, APP_FOLDER_NAME).apply {
                    if (!exists()) {
                        mkdirs()
                        File(this, ".nomedia").createNewFile()
                    }
                }
            } catch (e: Exception) {
                File(context.getExternalFilesDir(null), APP_FOLDER_NAME).apply {
                    if (!exists()) mkdirs()
                }
            }
        } else {
            val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            File(downloads, APP_FOLDER_NAME).apply {
                if (!exists()) mkdirs()
            }
        }
    }

    /**
     * СОХРАНЕНИЕ ФАЙЛОВ КАК НА JS-КЛИЕНТЕ
     */
    suspend fun saveToDownloads(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "saveToDownloads: fileName=$fileName, isEncrypted=$isEncrypted, keyLength=${encryptionKey.length}")

            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    // Используем совместимое с JS дешифрование
                    CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                } catch (e: Exception) {
                    Log.e(TAG, "Ошибка дешифрования файла: ${e.message}")
                    throw IOException("Не удалось расшифровать файл: ${e.message}")
                }
            } else {
                // Незашифрованный файл - просто base64
                Base64.decode(fileData, Base64.DEFAULT)
            }

            Log.d(TAG, "Данные декодированы, размер: ${decodedBytes.size} байт")

            // Сохраняем файл
            val finalFile = createUniqueFile(fileName)
            finalFile.outputStream().use { output ->
                output.write(decodedBytes)
            }

            if (finalFile.exists() && finalFile.length() > 0) {
                Log.d(TAG, "✅ Файл успешно сохранен в Downloads: ${finalFile.absolutePath}")
                Log.d(TAG, "Размер файла: ${finalFile.length()} байт")
            } else {
                Log.e(TAG, "❌ Файл не создан или пустой!")
                return@withContext saveToInternalStorage(fileData, fileName, isEncrypted, encryptionKey)
            }

            finalFile

        } catch (e: Exception) {
            Log.e(TAG, "Ошибка сохранения в Downloads: ${e.message}", e)
            return@withContext saveToInternalStorage(fileData, fileName, isEncrypted, encryptionKey)
        }
    }

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
            if (counter > 100) break
        }

        Log.d(TAG, "Финальный путь: ${finalFile.absolutePath}")
        return finalFile
    }

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
                    CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                } catch (e: Exception) {
                    Log.e(TAG, "Ошибка дешифрования во внутреннем хранилище: ${e.message}")
                    throw e
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

    suspend fun saveReceivedFile(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        saveToDownloads(fileData, fileName, isEncrypted, encryptionKey)
    }

    /**
     * ПОДГОТОВКА ФАЙЛА КАК НА JS-КЛИЕНТЕ
     * ТОЧНО ТАК ЖЕ КАК В JS: FileReader.readAsDataURL() → split(',')[1] → шифрование с сигнатурой
     */
    suspend fun prepareFileForSending(
        uri: Uri,
        fileName: String,
        mimeType: String,
        encryptionKey: String = "",
        duration: Double = 0.0
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "=== ПОДГОТОВКА ФАЙЛА ===")
            Log.d(TAG, "URI: $uri")
            Log.d(TAG, "Имя: $fileName")
            Log.d(TAG, "MIME: $mimeType")
            Log.d(TAG, "Длительность: $duration")
            Log.d(TAG, "Шифрование: ${encryptionKey.isNotEmpty()}")

            // Проверяем, что URI существует
            val contentResolver = context.contentResolver
            val fileExists = try {
                contentResolver.openFileDescriptor(uri, "r")?.use { true } ?: false
            } catch (e: Exception) {
                Log.e(TAG, "URI не доступен: ${e.message}")
                false
            }

            if (!fileExists) {
                throw IOException("Файл не существует или недоступен: $uri")
            }

            // Читаем файл
            val inputStream = contentResolver.openInputStream(uri)
                ?: throw IOException("Не удалось открыть файл")

            val fileBytes = inputStream.use { it.readBytes() }
            Log.d(TAG, "Размер файла: ${fileBytes.size} байт")

            if (fileBytes.isEmpty()) {
                throw IOException("Файл пустой: 0 байт")
            }

            // Проверяем первые байты файла (должны быть webm)
            val hexStart = fileBytes.take(4).joinToString("") { "%02x".format(it) }
            Log.d(TAG, "Первые байты файла: 0x$hexStart")

            // Webm signature: 1A 45 DF A3
            if (hexStart != "1a45dfa3") {
                Log.w(TAG, "⚠️ Файл не начинается с WebM сигнатуры. Возможно неправильный формат.")
            }

            // Base64 кодирование
            val base64Data = Base64.encodeToString(fileBytes, Base64.NO_WRAP)
            Log.d(TAG, "Base64 длина: ${base64Data.length}")
            Log.d(TAG, "Base64 первые 100 симв: ${base64Data.take(100)}")

            var finalFileData = base64Data
            val isEncrypted = encryptionKey.isNotEmpty()

            // Шифрование если есть ключ
            if (isEncrypted) {
                Log.d(TAG, "Начинаем шифрование...")
                try {
                    finalFileData = CryptoJSCompat.encryptFileToBase64(fileBytes, encryptionKey)
                    Log.d(TAG, "✅ Шифрование успешно")
                    Log.d(TAG, "Зашифрованная длина: ${finalFileData.length}")
                    Log.d(TAG, "Зашифрованные первые 100 симв: ${finalFileData.take(100)}")

                    // Проверяем формат
                    val isCryptoJS = CryptoJSCompat.isCryptoJSEncrypted(finalFileData)
                    Log.d(TAG, "Формат CryptoJS: $isCryptoJS")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Ошибка шифрования: ${e.message}", e)
                    throw e
                }
            }

            // Размер в КБ (как в JS)
            val fileSizeKB = String.format("%.2f", fileBytes.size / 1024.0)

            // Формируем JSON
            return@withContext JSONObject().apply {
                put("fileName", fileName)
                put("fileType", mimeType)
                put("fileData", finalFileData)
                put("fileSize", fileSizeKB)  // Строка в КБ
                put("isEncrypted", isEncrypted)
                put("fileCategory", "AUDIO")  // Используем строку, не enum
                put("isFile", true)
                put("isAudio", true)

                // Длительность
                if (duration > 0) {
                    put("duration", String.format("%.1f", duration))
                } else {
                    // Пытаемся получить длительность
                    try {
                        val fileDuration = getMediaDuration(uri, mimeType)
                        if (fileDuration > 0) {
                            put("duration", String.format("%.1f", fileDuration / 1000.0))
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Не удалось получить длительность: ${e.message}")
                    }
                }

                Log.d(TAG, "=== ИТОГОВЫЙ JSON ===")
                Log.d(TAG, "fileName: $fileName")
                Log.d(TAG, "fileType: $mimeType")
                Log.d(TAG, "fileSize: $fileSizeKB")
                Log.d(TAG, "isEncrypted: $isEncrypted")
                Log.d(TAG, "duration: ${optString("duration", "не указано")}")
                Log.d(TAG, "fileData length: ${finalFileData.length}")
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Ошибка подготовки файла", e)
            throw e
        }
    }

    fun getDownloadsPath(): String {
        return downloadsDir.absolutePath
    }

    fun getFileType(mimeType: String?, fileName: String?): FileType {
        val mime = mimeType?.lowercase(Locale.getDefault()) ?: ""
        val name = fileName?.lowercase(Locale.getDefault()) ?: ""

        val SUPPORTED_IMAGE_TYPES = listOf("image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp")
        val SUPPORTED_VIDEO_TYPES = listOf("video/mp4", "video/3gpp", "video/webm", "video/mkv")
        val SUPPORTED_AUDIO_TYPES = listOf("audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm")

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
                    name.endsWith(".wav") || name.endsWith(".webm") ->
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

    suspend fun getMediaDuration(uri: Uri, mimeType: String): Long =
        withContext(Dispatchers.IO) {
            try {
                if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
                    val retriever = MediaMetadataRetriever()

                    try {
                        retriever.setDataSource(context, uri)
                    } catch (e: Exception) {
                        Log.w(TAG, "Ошибка setDataSource с URI: ${e.message}")
                        return@withContext 0
                    }

                    val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    retriever.release()

                    return@withContext durationStr?.toLongOrNull() ?: 0
                } else {
                    0
                }
            } catch (e: Exception) {
                Log.w(TAG, "Не удалось получить длительность медиа: ${e.message}")
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