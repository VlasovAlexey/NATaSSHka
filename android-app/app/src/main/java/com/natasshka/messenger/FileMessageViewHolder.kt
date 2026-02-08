package com.natasshka.messenger

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CenterCrop
import com.bumptech.glide.load.resource.bitmap.RoundedCorners
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import android.util.Base64
import java.net.URL
import android.graphics.BitmapFactory
import java.io.ByteArrayInputStream
/*
class FileMessageViewHolder(
    private val binding: ItemFileMessageBinding,
    private val onFileClickListener: (FileMessage) -> Unit = {},
    private val onFileRetryClickListener: (FileMessage) -> Unit = {},
    private val onDeleteMessageClickListener: (String) -> Unit = {},
    private val serverBaseUrl: String = "http://10.0.2.2:3000",
    private var encryptionKey: String = ""
) : RecyclerView.ViewHolder(binding.root) {

    private var currentFileMessage: FileMessage? = null

    init {
        binding.root.setOnClickListener {
            currentFileMessage?.let { fileMessage ->
                onFileClickListener(fileMessage)
            }
        }

        binding.videoPlayOverlay?.setOnClickListener {
            currentFileMessage?.let { fileMessage ->
                if (fileMessage.fileCategory == FileManager.FileType.VIDEO) {
                    onFileClickListener(fileMessage)
                }
            }
        }

        binding.retryButton.setOnClickListener {
            currentFileMessage?.let { fileMessage ->
                onFileRetryClickListener(fileMessage)
            }
        }

        binding.deleteFileButton.setOnClickListener {
            currentFileMessage?.let { fileMessage ->
                onDeleteMessageClickListener(fileMessage.messageId)
            }
        }
    }

    fun bind(fileMessage: FileMessage, chatMessage: ChatMessage? = null) {
        currentFileMessage = fileMessage

        val displayName = formatFileName(fileMessage.fileName)
        binding.fileName.text = displayName
        binding.fileSize.text = formatFileSize(fileMessage.fileSize)

        val fileManager = FileManager(binding.root.context)
        val fileType = fileMessage.fileCategory

        binding.fileIcon.setImageResource(fileManager.getFileIcon(fileType))
        val backgroundColor = fileManager.getFileBackgroundColor(fileType)
        binding.rootLayout.setBackgroundColor(binding.root.context.getColor(backgroundColor))

        // Показываем длительность для видео и аудио
        if (fileMessage.duration > 0 &&
            (fileType == FileManager.FileType.VIDEO || fileType == FileManager.FileType.AUDIO)) {
            binding.durationText.visibility = View.VISIBLE
            val minutes = fileMessage.duration / 1000 / 60
            val seconds = (fileMessage.duration / 1000) % 60
            binding.durationText.text = String.format("%02d:%02d", minutes, seconds)
        } else {
            binding.durationText.visibility = View.GONE
        }

        binding.encryptionIndicator.visibility =
            if (fileMessage.isEncrypted) View.VISIBLE else View.GONE

        // Сначала скрываем все превью
        binding.thumbnailImage.visibility = View.GONE
        binding.videoThumbnailContainer.visibility = View.GONE

        // Загружаем превью в зависимости от типа файла
        when (fileType) {
            FileManager.FileType.IMAGE -> {
                binding.thumbnailImage.visibility = View.VISIBLE
                loadImageThumbnail(fileMessage)
            }
            FileManager.FileType.VIDEO -> {
                binding.videoThumbnailContainer.visibility = View.VISIBLE
                binding.videoPlayOverlay?.visibility = View.VISIBLE
                loadVideoThumbnail(fileMessage)
            }
            else -> {
                // Для аудио и документов не показываем превью
                binding.thumbnailImage.visibility = View.GONE
                binding.videoThumbnailContainer.visibility = View.GONE
            }
        }

        // Показываем прогресс загрузки/скачивания
        if (fileMessage.isDownloading || fileMessage.isUploading) {
            binding.uploadProgress.visibility = View.VISIBLE
            binding.uploadProgress.progress = fileMessage.uploadProgress
        } else {
            binding.uploadProgress.visibility = View.GONE
        }

        // Обновляем статус файла
        updateStatusText(fileMessage)

        // Настраиваем кнопку удаления
        val canDelete = chatMessage?.canDelete == true
        binding.deleteFileButton.visibility = if (canDelete) View.VISIBLE else View.GONE
    }

    private fun loadImageThumbnail(fileMessage: FileMessage) {
        try {
            // 1. Пробуем загрузить из локального пути
            fileMessage.localPath?.let { localPath ->
                val file = File(localPath)
                if (file.exists()) {
                    Glide.with(binding.root.context)
                        .load(file)
                        .apply(GlideCacheManager.getNoCacheOptions())
                        .override(150, 150)
                        .transform(CenterCrop(), RoundedCorners(8))
                        .into(binding.thumbnailImage)
                    return
                }
            }

            // 2. Пробуем загрузить из fileData (Base64)
            fileMessage.fileData?.let { fileData ->
                if (fileData.isNotEmpty()) {
                    try {
                        val imageBytes = if (fileMessage.isEncrypted && encryptionKey.isNotEmpty()) {
                            CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                        } else {
                            Base64.decode(fileData, Base64.DEFAULT)
                        }

                        Glide.with(binding.root.context)
                            .load(imageBytes)
                            .apply(GlideCacheManager.getNoCacheOptions())
                            .override(150, 150)
                            .transform(CenterCrop(), RoundedCorners(8))
                            .into(binding.thumbnailImage)
                        return
                    } catch (e: Exception) {
                        // Если не удалось декодировать как Base64, пробуем загрузить как URL
                    }
                }
            }

            // 3. Пробуем загрузить по URL
            fileMessage.fileUrl?.let { fileUrl ->
                val fullUrl = if (fileUrl.startsWith("http")) {
                    fileUrl
                } else {
                    if (fileUrl.startsWith("/")) {
                        "$serverBaseUrl$fileUrl"
                    } else {
                        "$serverBaseUrl/$fileUrl"
                    }
                }

                Glide.with(binding.root.context)
                    .load(fullUrl)
                    .apply(GlideCacheManager.getNoCacheOptions())
                    .override(150, 150)
                    .transform(CenterCrop(), RoundedCorners(8))
                    //.placeholder(R.drawable.ic_image_placeholder)
                    //.error(R.drawable.ic_error_placeholder)
                    .into(binding.thumbnailImage)
                return
            }

            // 4. Если ничего не сработало, показываем placeholder
            //binding.thumbnailImage.setImageResource(R.drawable.ic_image_placeholder)

        } catch (e: Exception) {
            //binding.thumbnailImage.setImageResource(R.drawable.ic_error_placeholder)
        }
    }

    private fun loadVideoThumbnail(fileMessage: FileMessage) {
        try {
            // Показываем плейсхолдер
            binding.videoThumbnail.setImageResource(R.drawable.ic_video_placeholder)

            // Пробуем загрузить миниатюру в фоне
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val thumbnail = extractVideoThumbnail(fileMessage)
                    withContext(Dispatchers.Main) {
                        if (thumbnail != null) {
                            binding.videoThumbnail.setImageBitmap(thumbnail)
                        } else {
                            binding.videoThumbnail.setImageResource(R.drawable.ic_video_placeholder)
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.videoThumbnail.setImageResource(R.drawable.ic_video_placeholder)
                    }
                }
            }
        } catch (e: Exception) {
            binding.videoThumbnail.setImageResource(R.drawable.ic_video_placeholder)
        }
    }

    private suspend fun extractVideoThumbnail(fileMessage: FileMessage): Bitmap? {
        return withContext(Dispatchers.IO) {
            try {
                val retriever = MediaMetadataRetriever()

                when {
                    // 1. Локальный файл
                    fileMessage.localPath != null -> {
                        val file = File(fileMessage.localPath!!)
                        if (file.exists()) {
                            retriever.setDataSource(file.absolutePath)
                        } else {
                            return@withContext null
                        }
                    }

                    // 2. Данные в Base64
                    fileMessage.fileData != null -> {
                        val videoBytes = if (fileMessage.isEncrypted && encryptionKey.isNotEmpty()) {
                            CryptoJSCompat.decryptFileCompatibleJS(fileMessage.fileData!!, encryptionKey)
                        } else {
                            Base64.decode(fileMessage.fileData!!, Base64.DEFAULT)
                        }

                        // Создаем временный файл для миниатюры
                        val tempFile = File(binding.root.context.cacheDir,
                            "temp_thumb_${System.currentTimeMillis()}.mp4")
                        tempFile.outputStream().use { it.write(videoBytes) }
                        retriever.setDataSource(tempFile.absolutePath)
                        tempFile.delete()
                    }

                    // 3. URL
                    fileMessage.fileUrl != null -> {
                        val fullUrl = if (fileMessage.fileUrl!!.startsWith("http")) {
                            fileMessage.fileUrl
                        } else {
                            if (fileMessage.fileUrl!!.startsWith("/")) {
                                "$serverBaseUrl${fileMessage.fileUrl}"
                            } else {
                                "$serverBaseUrl/${fileMessage.fileUrl}"
                            }
                        }
                        retriever.setDataSource(fullUrl, emptyMap())
                    }

                    else -> return@withContext null
                }

                // Получаем кадр на 1 секунде
                val thumbnail = retriever.getFrameAtTime(1000000,
                    MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                retriever.release()

                // Масштабируем миниатюру
                thumbnail?.let {
                    Bitmap.createScaledBitmap(it, 150, 150, true)
                }
            } catch (e: Exception) {
                null
            }
        }
    }

    private fun updateStatusText(fileMessage: FileMessage) {
        val statusText = when {
            fileMessage.isDownloading -> "⏬ Скачивается..."
            fileMessage.isUploading -> "⏫ Отправляется..."
            fileMessage.localPath != null -> "✓ Сохранено"
            fileMessage.fileData != null -> "✓ Доступно"
            fileMessage.fileUrl != null -> "Нажмите для скачивания"
            else -> "Недоступно"
        }
        binding.statusText.text = statusText
    }

    fun updateEncryptionKey(newKey: String) {
        encryptionKey = newKey
        currentFileMessage?.let { fileMessage ->
            if (fileMessage.isEncrypted) {
                when (fileMessage.fileCategory) {
                    FileManager.FileType.IMAGE -> {
                        loadImageThumbnail(fileMessage)
                    }
                    FileManager.FileType.VIDEO -> {
                        loadVideoThumbnail(fileMessage)
                    }
                    else -> {}
                }
            }
        }
    }

    fun clear() {
        Glide.with(binding.root.context).clear(binding.thumbnailImage)
        Glide.with(binding.root.context).clear(binding.videoThumbnail)
        currentFileMessage = null
    }

    private fun formatFileName(fileName: String): String {
        val maxLength = 16
        if (fileName.length <= maxLength) {
            return fileName
        }
        val lastDotIndex = fileName.lastIndexOf('.')
        return if (lastDotIndex != -1 && lastDotIndex > 0) {
            val name = fileName.substring(0, lastDotIndex)
            val extension = fileName.substring(lastDotIndex + 1)
            if (name.length > 6) {
                "${name.take(6)}...${name.takeLast(2)}.$extension"
            } else {
                fileName
            }
        } else {
            if (fileName.length > maxLength) {
                "${fileName.take(6)}...${fileName.takeLast(2)}"
            } else {
                fileName
            }
        }
    }

    private fun formatFileSize(size: Long): String {
        return when {
            size >= 1024 * 1024 -> String.format("%.1f МБ", size.toFloat() / (1024 * 1024))
            size >= 1024 -> String.format("%.1f КБ", size.toFloat() / 1024)
            else -> "$size Б"
        }
    }
}*/