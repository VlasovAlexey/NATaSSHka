package com.natasshka.messenger

import android.content.ContentValues
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.*

class FileManager(private val context: Context) {
    companion object {
        private const val APP_FOLDER_NAME = "NATaSSHka"
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
    suspend fun saveToDownloads(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                } catch (e: Exception) {
                    throw IOException("Не удалось расшифровать файл: ${e.message}")
                }
            } else {
                Base64.decode(fileData, Base64.DEFAULT)
            }
            val finalFile = createUniqueFile(fileName)
            finalFile.outputStream().use { output ->
                output.write(decodedBytes)
            }
            if (finalFile.exists() && finalFile.length() > 0) {
                finalFile
            } else {
                return@withContext saveToInternalStorage(fileData, fileName, isEncrypted, encryptionKey)
            }
        } catch (e: Exception) {
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
        return finalFile
    }
    private suspend fun saveToInternalStorage(
        fileData: String,
        fileName: String,
        isEncrypted: Boolean,
        encryptionKey: String = ""
    ): File = withContext(Dispatchers.IO) {
        try {
            val decodedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                } catch (e: Exception) {
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
            finalFile
        } catch (e: Exception) {
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
    suspend fun prepareFileForSending(
        uri: Uri,
        fileName: String,
        mimeType: String,
        encryptionKey: String = "",
        duration: Double = 0.0
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            val contentResolver = context.contentResolver
            val fileExists = try {
                contentResolver.openFileDescriptor(uri, "r")?.use { true } ?: false
            } catch (e: Exception) {
                false
            }
            if (!fileExists) {
                throw IOException("Файл не существует или недоступен: $uri")
            }
            val inputStream = contentResolver.openInputStream(uri)
                ?: throw IOException("Не удалось открыть файл")
            val fileBytes = inputStream.use { it.readBytes() }
            if (fileBytes.isEmpty()) {
                throw IOException("Файл пустой: 0 байт")
            }
            val hexStart = fileBytes.take(4).joinToString("") { "%02x".format(it) }
            val base64Data = Base64.encodeToString(fileBytes, Base64.NO_WRAP)
            var finalFileData = base64Data
            val isEncrypted = encryptionKey.isNotEmpty()
            if (isEncrypted) {
                try {
                    finalFileData = CryptoJSCompat.encryptFileToBase64(fileBytes, encryptionKey)
                } catch (e: Exception) {
                    throw e
                }
            }
            val fileSizeKB = String.format("%.2f", fileBytes.size / 1024.0)
            return@withContext JSONObject().apply {
                put("fileName", fileName)
                put("fileType", mimeType)
                put("fileData", finalFileData)
                put("fileSize", fileSizeKB)
                put("isEncrypted", isEncrypted)
                put("fileCategory", "AUDIO")
                put("isFile", true)
                put("isAudio", true)
                if (duration > 0) {
                    put("duration", String.format("%.1f", duration))
                } else {
                    try {
                        val fileDuration = getMediaDuration(uri, mimeType)
                        if (fileDuration > 0) {
                            put("duration", String.format("%.1f", fileDuration / 1000.0))
                        }
                    } catch (e: Exception) {
                    }
                }
            }
        } catch (e: Exception) {
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
                        return@withContext 0
                    }
                    val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    retriever.release()
                    return@withContext durationStr?.toLongOrNull() ?: 0
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
        } catch (e: Exception) {
        }
    }
}