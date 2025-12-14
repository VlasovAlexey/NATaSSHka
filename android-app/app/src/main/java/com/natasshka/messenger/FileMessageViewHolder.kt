package com.natasshka.messenger

import android.content.Intent
import android.net.Uri
import com.natasshka.messenger.FullscreenImageActivity

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.bumptech.glide.request.RequestOptions
import kotlinx.coroutines.*
import java.net.URL
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import java.io.InputStream
import android.util.Log
import android.util.Base64
import java.io.IOException
import java.nio.charset.StandardCharsets

class FileMessageViewHolder(
    private val binding: ItemFileMessageBinding,
    private val onFileClickListener: (FileMessage) -> Unit,
    private val onRetryClickListener: (FileMessage) -> Unit,
    private val serverBaseUrl: String = "http://10.0.2.2:3000",
    private var encryptionKey: String = ""
) : androidx.recyclerview.widget.RecyclerView.ViewHolder(binding.root) {

    private var imageLoadJob: Job? = null

    // Метод для обновления ключа шифрования
    fun updateEncryptionKey(newKey: String) {
        encryptionKey = newKey
    }

    fun bind(fileMessage: FileMessage) {
        // Отменяем предыдущую загрузку
        imageLoadJob?.cancel()

        with(binding) {
            // Проверяем, является ли файл изображением И не зашифрован ИЛИ зашифрован И есть ключ
            val isImage = fileMessage.fileCategory == FileManager.FileType.IMAGE

            // Можем ли показать изображение?
            val canShowImage = if (isImage && fileMessage.isEncrypted) {
                // Зашифрованное изображение: показываем как изображение только если есть ключ
                encryptionKey.isNotEmpty()
            } else if (isImage) {
                // Незашифрованное изображение: всегда показываем
                true
            } else {
                // Не изображение: не показываем
                false
            }

            if (canShowImage) {
                // Для изображений показываем миниатюру
                showImagePreview(fileMessage)
            } else {
                // Для зашифрованных без ключа или других типов файлов используем старый вид
                showRegularFileInfo(fileMessage)
            }

            // Обработчик кликов на всю карточку файла
            fileCard.setOnClickListener {
                onFileClickListener(fileMessage)
            }

            // Обработчик кнопки повторной попытки
            retryButton.setOnClickListener {
                onRetryClickListener(fileMessage)
            }
        }
    }

    private fun showImagePreview(fileMessage: FileMessage) {
        with(binding) {
            // Скрываем информацию о файле
            fileInfoLayout.visibility = View.GONE

            // Показываем ImageView для миниатюры
            thumbnailImage.visibility = View.VISIBLE
            videoThumbnail.visibility = View.GONE

            // Убираем отступы у корневого layout только для изображений
            rootLayout.setPadding(0, 0, 0, 0)

            // Убираем обводку карточки для изображений
            fileCard.strokeWidth = 0

            // Убираем фон у карточки для изображений
            fileCard.setCardBackgroundColor(
                ContextCompat.getColor(root.context, android.R.color.transparent)
            )

            // Скрываем другие элементы
            uploadProgress.visibility = View.GONE
            retryButton.visibility = View.GONE

            // Если есть локальный путь, загружаем из него
            if (fileMessage.localPath != null) {
                loadImageFromLocalPath(fileMessage.localPath!!)
            }
            // Если есть URL, скачиваем и показываем
            else if (fileMessage.fileUrl != null) {
                loadImageFromUrl(fileMessage)
            }
            // Если есть данные в base64
            else if (fileMessage.fileData != null) {
                loadImageFromBase64(fileMessage.fileData!!, fileMessage.isEncrypted)
            }
            // Если ничего нет, показываем старый вид
            else {
                fallbackToRegularView(fileMessage)
            }
        }
    }

    private fun loadImageFromUrl(fileMessage: FileMessage) {
        imageLoadJob = CoroutineScope(Dispatchers.IO).launch {
            var inputStream: InputStream? = null
            var fileBytes: ByteArray? = null
            var fileBase64: String? = null

            try {
                val imageUrl = fixImageUrl(fileMessage.fileUrl!!)
                Log.d("FileMessageViewHolder", "Загрузка изображения по URL: $imageUrl")

                val url = URL(imageUrl)
                val connection = url.openConnection()
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                inputStream = connection.getInputStream()
                fileBytes = inputStream.readBytes()

                // Сохраняем base64 для анализа
                fileBase64 = Base64.encodeToString(fileBytes, Base64.DEFAULT)
                Log.d("FileMessageViewHolder", "Получено байт: ${fileBytes.size}, base64 длина: ${fileBase64.length}")

                // Декодируем или дешифруем изображение
                val imageBytes = if (fileMessage.isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        // Попробуем дешифровать
                        Log.d("FileMessageViewHolder", "Попытка дешифрования изображения с ключом")
                        CryptoJSCompat.decryptFileFromBase64(fileBase64!!, encryptionKey)
                    } catch (e: Exception) {
                        Log.e("FileMessageViewHolder", "Ошибка дешифрования: ${e.message}")
                        // Если не удалось дешифровать, показываем как обычный файл
                        withContext(Dispatchers.Main) {
                            fallbackToRegularView(fileMessage)
                        }
                        return@launch
                    }
                } else {
                    fileBytes!!
                }

                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        // Устанавливаем ширину карточки
                        val maxWidth = binding.root.context.resources.displayMetrics.widthPixels * 0.7
                        val aspectRatio = bitmap.height.toFloat() / bitmap.width.toFloat()
                        val targetHeight = (maxWidth * aspectRatio).toInt()

                        // Устанавливаем параметры карточки
                        val layoutParams = binding.fileCard.layoutParams
                        layoutParams.width = maxWidth.toInt()
                        layoutParams.height = targetHeight
                        binding.fileCard.layoutParams = layoutParams
                        binding.fileCard.requestLayout()

                        // Загружаем изображение
                        Glide.with(binding.root.context)
                            .load(bitmap)
                            .apply(RequestOptions()
                                .fitCenter()
                                .override(maxWidth.toInt(), targetHeight))
                            .transition(DrawableTransitionOptions.withCrossFade(300))
                            .into(binding.thumbnailImage)
                    }
                } else {
                    Log.e("FileMessageViewHolder", "Не удалось декодировать изображение в Bitmap")
                    withContext(Dispatchers.Main) {
                        fallbackToRegularView(fileMessage)
                    }
                }
            } catch (e: Exception) {
                Log.e("FileMessageViewHolder", "Ошибка загрузки изображения: ${e.message}")
                withContext(Dispatchers.Main) {
                    fallbackToRegularView(fileMessage)
                }
            } finally {
                try {
                    inputStream?.close()
                } catch (e: IOException) {
                    Log.e("FileMessageViewHolder", "Ошибка закрытия потока: ${e.message}")
                }
            }
        }
    }

    private fun loadImageFromLocalPath(localPath: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val options = BitmapFactory.Options()
                options.inJustDecodeBounds = true
                BitmapFactory.decodeFile(localPath, options)

                val imageWidth = options.outWidth
                val imageHeight = options.outHeight

                withContext(Dispatchers.Main) {
                    if (imageWidth > 0 && imageHeight > 0) {
                        val maxWidth = binding.root.context.resources.displayMetrics.widthPixels * 0.7
                        val aspectRatio = imageHeight.toFloat() / imageWidth.toFloat()
                        val targetHeight = (maxWidth * aspectRatio).toInt()

                        // Устанавливаем параметры карточки
                        val layoutParams = binding.fileCard.layoutParams
                        layoutParams.width = maxWidth.toInt()
                        layoutParams.height = targetHeight
                        binding.fileCard.layoutParams = layoutParams
                        binding.fileCard.requestLayout()

                        // Загружаем изображение
                        Glide.with(binding.root.context)
                            .load(localPath)
                            .apply(RequestOptions()
                                .fitCenter()
                                .override(maxWidth.toInt(), targetHeight))
                            .transition(DrawableTransitionOptions.withCrossFade(300))
                            .into(binding.thumbnailImage)
                    }
                }
            } catch (e: Exception) {
                Log.e("FileMessageViewHolder", "Ошибка загрузки локального изображения: ${e.message}")
            }
        }
    }

    private fun loadImageFromBase64(base64Data: String, isEncrypted: Boolean) {
        imageLoadJob = CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d("FileMessageViewHolder", "Загрузка изображения из base64, зашифровано: $isEncrypted")

                val imageBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        Log.d("FileMessageViewHolder", "Попытка дешифрования изображения с ключом")
                        CryptoJSCompat.decryptFileFromBase64(base64Data, encryptionKey)
                    } catch (e: Exception) {
                        Log.e("FileMessageViewHolder", "Ошибка дешифрования: ${e.message}")
                        // Если не удалось дешифровать, показываем как обычный файл
                        withContext(Dispatchers.Main) {
                            fallbackToRegularView(FileMessage(
                                id = "temp",
                                messageId = "temp",
                                fileName = "image.jpg",
                                fileType = "image/jpeg",
                                fileSize = 0,
                                fileCategory = FileManager.FileType.IMAGE,
                                isEncrypted = isEncrypted
                            ))
                        }
                        return@launch
                    }
                } else {
                    Base64.decode(base64Data, Base64.DEFAULT)
                }

                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        val maxWidth = binding.root.context.resources.displayMetrics.widthPixels * 0.7
                        val aspectRatio = bitmap.height.toFloat() / bitmap.width.toFloat()
                        val targetHeight = (maxWidth * aspectRatio).toInt()

                        // Устанавливаем параметры карточки
                        val layoutParams = binding.fileCard.layoutParams
                        layoutParams.width = maxWidth.toInt()
                        layoutParams.height = targetHeight
                        binding.fileCard.layoutParams = layoutParams
                        binding.fileCard.requestLayout()

                        Glide.with(binding.root.context)
                            .load(bitmap)
                            .apply(RequestOptions()
                                .fitCenter()
                                .override(maxWidth.toInt(), targetHeight))
                            .transition(DrawableTransitionOptions.withCrossFade(300))
                            .into(binding.thumbnailImage)
                    }
                } else {
                    Log.e("FileMessageViewHolder", "Не удалось декодировать изображение")
                    withContext(Dispatchers.Main) {
                        fallbackToRegularView(FileMessage(
                            id = "temp",
                            messageId = "temp",
                            fileName = "image.jpg",
                            fileType = "image/jpeg",
                            fileSize = 0,
                            fileCategory = FileManager.FileType.IMAGE,
                            isEncrypted = isEncrypted
                        ))
                    }
                }
            } catch (e: Exception) {
                Log.e("FileMessageViewHolder", "Ошибка обработки base64: ${e.message}")
                withContext(Dispatchers.Main) {
                    fallbackToRegularView(FileMessage(
                        id = "temp",
                        messageId = "temp",
                        fileName = "image.jpg",
                        fileType = "image/jpeg",
                        fileSize = 0,
                        fileCategory = FileManager.FileType.IMAGE,
                        isEncrypted = isEncrypted
                    ))
                }
            }
        }
    }

    private fun fallbackToRegularView(fileMessage: FileMessage) {
        with(binding) {
            // Восстанавливаем отступы для обычных файлов
            restoreRegularLayout()

            // Скрываем миниатюру
            thumbnailImage.visibility = View.GONE
            videoThumbnail.visibility = View.GONE

            // Показываем обычную информацию о файле
            showRegularFileInfo(fileMessage)
        }
    }

    private fun openFullscreenImage(fileMessage: FileMessage) {
        val context = binding.root.context

        val intent = Intent(context, FullscreenImageActivity::class.java).apply {
            // Передаем данные для дешифровки
            if (fileMessage.fileUrl != null) {
                putExtra(FullscreenImageActivity.EXTRA_IMAGE_URL, fixImageUrl(fileMessage.fileUrl!!))
            } else if (fileMessage.fileData != null) {
                putExtra(FullscreenImageActivity.EXTRA_IMAGE_BASE64, fileMessage.fileData)
            }

            // Передаем данные для сохранения
            putExtra(FullscreenImageActivity.EXTRA_FILE_NAME, fileMessage.fileName)
            putExtra(FullscreenImageActivity.EXTRA_FILE_DATA, fileMessage.fileData)
            putExtra(FullscreenImageActivity.EXTRA_IS_ENCRYPTED, fileMessage.isEncrypted)
            putExtra(FullscreenImageActivity.EXTRA_ENCRYPTION_KEY, encryptionKey)
        }

        context.startActivity(intent)
    }

    private fun showRegularFileInfo(fileMessage: FileMessage) {
        with(binding) {
            // Восстанавливаем отступы и обводку
            restoreRegularLayout()

            // Показываем информацию о файле
            fileInfoLayout.visibility = View.VISIBLE

            // Скрываем миниатюры
            thumbnailImage.visibility = View.GONE
            videoThumbnail.visibility = View.GONE

            // Настраиваем основные поля
            fileName.text = fileMessage.fileName

            // Форматируем размер файла
            if (fileMessage.fileSize > 0) {
                fileSize.text = FileManager(root.context).formatFileSize(fileMessage.fileSize)
                fileSize.visibility = View.VISIBLE
            } else {
                fileSize.visibility = View.GONE
            }

            // Устанавливаем иконку и цвет
            val fileManager = FileManager(root.context)
            val fileType = fileMessage.fileCategory

            fileIcon.setImageResource(fileManager.getFileIcon(fileType))
            fileCard.setCardBackgroundColor(
                ContextCompat.getColor(root.context, fileManager.getFileBackgroundColor(fileType))
            )

            // Показываем статус
            statusText.text = when (fileType) {
                FileManager.FileType.IMAGE -> "📷 Изображение"
                FileManager.FileType.VIDEO -> "🎥 Видео"
                FileManager.FileType.AUDIO -> "🎵 Аудио"
                FileManager.FileType.DOCUMENT -> "📄 Файл"
            }
            statusText.visibility = View.VISIBLE

            // Показываем информацию о шифровании
            if (fileMessage.isEncrypted) {
                encryptionIndicator.visibility = View.VISIBLE
                statusText.text = "${statusText.text} (🔒)"
            } else {
                encryptionIndicator.visibility = View.GONE
            }

            // Скрываем кнопку "Повторить" и прогресс бар
            retryButton.visibility = View.GONE
            uploadProgress.visibility = View.GONE
        }
    }

    private fun restoreRegularLayout() {
        with(binding) {
            // Сбрасываем параметры карточки
            val layoutParams = fileCard.layoutParams
            layoutParams.width = ViewGroup.LayoutParams.WRAP_CONTENT
            layoutParams.height = ViewGroup.LayoutParams.WRAP_CONTENT
            fileCard.layoutParams = layoutParams
            fileCard.requestLayout()

            // Восстанавливаем отступы
            val padding = 12 // в пикселях
            rootLayout.setPadding(padding, padding, padding, padding)

            // Восстанавливаем обводку
            fileCard.strokeWidth = 1
        }
    }

    private fun fixImageUrl(imageUrl: String): String {
        // Если URL уже полный, возвращаем как есть
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            return imageUrl
        }

        // Иначе добавляем базовый URL сервера
        return if (imageUrl.startsWith("/")) {
            "$serverBaseUrl$imageUrl"
        } else {
            "$serverBaseUrl/$imageUrl"
        }
    }

    fun clear() {
        // Отменяем загрузку при переиспользовании ViewHolder
        imageLoadJob?.cancel()

        // Очищаем изображение
        Glide.with(binding.root.context).clear(binding.thumbnailImage)
        Glide.with(binding.root.context).clear(binding.videoThumbnail)
    }
}