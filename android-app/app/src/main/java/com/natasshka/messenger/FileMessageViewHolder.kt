package com.natasshka.messenger

import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import java.io.File

class FileMessageViewHolder(
    private val binding: ItemFileMessageBinding,
    private val onFileClickListener: (FileMessage) -> Unit = {},
    private val onFileRetryClickListener: (FileMessage) -> Unit = {},
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

        binding.retryButton.setOnClickListener {
            currentFileMessage?.let { fileMessage ->
                onFileRetryClickListener(fileMessage)
            }
        }
    }

    fun bind(fileMessage: FileMessage) {
        currentFileMessage = fileMessage

        // Форматируем имя файла для отображения
        val displayName = formatFileName(fileMessage.fileName)
        binding.fileName.text = displayName

        // Форматируем размер файла
        binding.fileSize.text = formatFileSize(fileMessage.fileSize)

        // Устанавливаем иконку в зависимости от типа файла
        val fileManager = FileManager(binding.root.context)
        val fileType = fileMessage.fileCategory

        // Иконка файла
        binding.fileIcon.setImageResource(fileManager.getFileIcon(fileType))

        // Цвет фона карточки
        val backgroundColor = fileManager.getFileBackgroundColor(fileType)
        binding.fileCard.setCardBackgroundColor(binding.root.context.getColor(backgroundColor))

        // Длительность для видео/аудио
        if (fileMessage.duration > 0 &&
            (fileType == FileManager.FileType.VIDEO || fileType == FileManager.FileType.AUDIO)) {
            binding.durationText.visibility = View.VISIBLE
            val minutes = fileMessage.duration / 1000 / 60
            val seconds = (fileMessage.duration / 1000) % 60
            binding.durationText.text = String.format("%02d:%02d", minutes, seconds)
        } else {
            binding.durationText.visibility = View.GONE
        }

        // Индикатор шифрования
        binding.encryptionIndicator.visibility =
            if (fileMessage.isEncrypted) View.VISIBLE else View.GONE

        // Кнопка воспроизведения для видео
        binding.playButton.visibility =
            if (fileType == FileManager.FileType.VIDEO) View.VISIBLE else View.GONE

        // Миниатюры для изображений и видео
        binding.thumbnailImage.visibility = View.GONE
        binding.videoThumbnail.visibility = View.GONE

        if (fileType == FileManager.FileType.IMAGE) {
            // Для изображений показываем миниатюру
            binding.thumbnailImage.visibility = View.VISIBLE
            loadImageThumbnail(fileMessage)
        } else if (fileType == FileManager.FileType.VIDEO) {
            // Для видео показываем миниатюру видео
            binding.videoThumbnail.visibility = View.VISIBLE
            // Здесь можно добавить загрузку миниатюры видео
        }

        // Прогресс загрузки/отправки
        if (fileMessage.isDownloading || fileMessage.isUploading) {
            binding.uploadProgress.visibility = View.VISIBLE
            binding.uploadProgress.progress = fileMessage.uploadProgress
        } else {
            binding.uploadProgress.visibility = View.GONE
        }


        // Статус файла
        updateStatusText(fileMessage)
    }

    private fun loadImageThumbnail(fileMessage: FileMessage) {
        try {
            // Если есть локальный путь
            fileMessage.localPath?.let { localPath ->
                val file = File(localPath)
                if (file.exists()) {
                    Glide.with(binding.root.context)
                        .load(file)
                        .override(300, 300)
                        .centerCrop()
                        .into(binding.thumbnailImage)
                    return
                }
            }

            // Если есть fileData (base64)
            fileMessage.fileData?.let { fileData ->
                if (fileData.isNotEmpty()) {
                    try {
                        // Для зашифрованных файлов нужно дешифровать
                        val imageBytes = if (fileMessage.isEncrypted && encryptionKey.isNotEmpty()) {
                            CryptoJSCompat.decryptFileCompatibleJS(fileData, encryptionKey)
                        } else {
                            android.util.Base64.decode(fileData, android.util.Base64.DEFAULT)
                        }

                        Glide.with(binding.root.context)
                            .load(imageBytes)
                            .override(300, 300)
                            .centerCrop()
                            .into(binding.thumbnailImage)
                    } catch (e: Exception) {
                        Log.e("FileMessageViewHolder", "Ошибка загрузки изображения из данных", e)
                    }
                }
            }

            // Если есть URL
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
                    .override(300, 300)
                    .centerCrop()
                    .into(binding.thumbnailImage)
            }

        } catch (e: Exception) {
            Log.e("FileMessageViewHolder", "Ошибка загрузки миниатюры", e)
        }
    }

    private fun updateStatusText(fileMessage: FileMessage) {
        val statusText = when {
            fileMessage.isDownloading -> "Скачивается..."
            fileMessage.isUploading -> "Отправляется..."
            fileMessage.localPath != null -> "✓ Сохранено"
            fileMessage.fileData != null -> "✓ Доступно"
            fileMessage.fileUrl != null -> "Загрузить"
            else -> "Недоступно"
        }

        binding.statusText.text = statusText
    }

    fun updateEncryptionKey(newKey: String) {
        encryptionKey = newKey
        currentFileMessage?.let { fileMessage ->
            if (fileMessage.isEncrypted && fileMessage.fileCategory == FileManager.FileType.IMAGE) {
                // Перезагружаем миниатюру если это зашифрованное изображение
                loadImageThumbnail(fileMessage)
            }
        }
    }

    fun clear() {
        // Очищаем ресурсы Glide при переиспользовании ViewHolder
        Glide.with(binding.root.context).clear(binding.thumbnailImage)
        Glide.with(binding.root.context).clear(binding.videoThumbnail)
        currentFileMessage = null
    }

    // Метод для форматирования имени файла
    private fun formatFileName(fileName: String): String {
        val maxLength = 16

        // Если имя файла с расширением короче 16 символов, показываем все
        if (fileName.length <= maxLength) {
            return fileName
        }

        // Разделяем имя и расширение
        val lastDotIndex = fileName.lastIndexOf('.')

        return if (lastDotIndex != -1 && lastDotIndex > 0) {
            // Есть расширение
            val name = fileName.substring(0, lastDotIndex)
            val extension = fileName.substring(lastDotIndex + 1)

            // Если имя слишком длинное: первые 6 символов + ... + последние 2 символа + . + расширение
            if (name.length > 6) {
                "${name.take(6)}...${name.takeLast(2)}.$extension"
            } else {
                // Имя короткое, но с длинным расширением или общая длина больше 16
                fileName
            }
        } else {
            // Нет расширения
            if (fileName.length > maxLength) {
                "${fileName.take(6)}...${fileName.takeLast(2)}"
            } else {
                fileName
            }
        }
    }

    // Метод для форматирования размера файла
    private fun formatFileSize(size: Long): String {
        return when {
            size >= 1024 * 1024 -> String.format("%.1f MB", size.toFloat() / (1024 * 1024))
            size >= 1024 -> String.format("%.1f KB", size.toFloat() / 1024)
            else -> "$size B"
        }
    }
}