package com.natasshka.messenger
import android.media.MediaMetadataRetriever
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import com.natasshka.messenger.databinding.ItemMessageBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class MessagesAdapter(
    private val onFileClickListener: (FileMessage) -> Unit = {},
    private val onFileRetryClickListener: (FileMessage) -> Unit = {},
    private val onDeleteMessageClickListener: (String) -> Unit = {},
    private val serverBaseUrl: String = "http://10.0.2.2:3000",
    private var encryptionKey: String = "",
    private val context: android.content.Context
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    companion object {
        private const val VIEW_TYPE_MESSAGE = 1
        private const val VIEW_TYPE_FILE = 2
        private const val VIEW_TYPE_SYSTEM = 3
    }
    private val messages = mutableListOf<ChatMessage>()
    private val linkParser = LinkParser(context)
    fun addMessage(message: ChatMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }
    val messagesList: List<ChatMessage>
        get() = messages.toList()
    fun getMessages(): List<ChatMessage> {
        return messages.toList()
    }
    fun removeMessage(messageId: String): Boolean {
        val position = messages.indexOfFirst { it.id == messageId }
        if (position != -1) {
            Log.d("MessagesAdapter", "Найдено сообщение для удаления: ID=$messageId, позиция=$position, текст=${messages[position].text}")
            messages.removeAt(position)
            notifyItemRemoved(position)
            Log.d("MessagesAdapter", "✅ Сообщение удалено. Всего сообщений: ${messages.size}")
            return true
        }
        Log.d("MessagesAdapter", "⚠️ Сообщение с ID $messageId не найдено. Всего сообщений: ${messages.size}")
        for (i in messages.indices) {
            val msg = messages[i]
            if (msg.attachedFile?.id == messageId || msg.attachedFile?.messageId == messageId) {
                Log.d("MessagesAdapter", "Найдено файловое сообщение для удаления: позиция=$i")
                messages.removeAt(i)
                notifyItemRemoved(i)
                return true
            }
        }
        return false
    }
    fun clearMessages() {
        messages.clear()
        notifyDataSetChanged()
    }
    fun reDecryptMessages(newKey: String) {
        encryptionKey = newKey
        for (i in messages.indices) {
            val message = messages[i]
            if (message.isEncrypted) {
                val newText = if (encryptionKey.isNotEmpty() && message.originalEncryptedText != null) {
                    try {
                        CryptoJSCompat.decryptText(message.originalEncryptedText, encryptionKey)
                    } catch (e: Exception) {
                        "🔒 Неверный ключ шифрования"
                    }
                } else if (message.isEncrypted) {
                    "🔒 Зашифрованное сообщение"
                } else {
                    message.text
                }
                val updatedMessage = message.copy(text = newText)
                messages[i] = updatedMessage
                notifyItemChanged(i)
            }
            if (message.attachedFile != null &&
                message.attachedFile.isEncrypted &&
                message.attachedFile.fileCategory == FileManager.FileType.IMAGE) {
                notifyItemChanged(i)
            }
        }
    }
    override fun getItemViewType(position: Int): Int {
        val message = messages[position]
        return when {
            message.isSystem -> VIEW_TYPE_SYSTEM
            message.attachedFile != null -> VIEW_TYPE_FILE
            else -> VIEW_TYPE_MESSAGE
        }
    }
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            VIEW_TYPE_FILE -> {
                val binding = ItemFileMessageBinding.inflate(
                    LayoutInflater.from(parent.context),
                    parent,
                    false
                )
                FileMessageViewHolder(
                    binding,
                    onFileClickListener,
                    onFileRetryClickListener,
                    onDeleteMessageClickListener,
                    serverBaseUrl,
                    encryptionKey
                )
            }
            VIEW_TYPE_SYSTEM -> {
                val binding = ItemMessageBinding.inflate(
                    LayoutInflater.from(parent.context),
                    parent,
                    false
                )
                SystemMessageViewHolder(binding)
            }
            else -> {
                val binding = ItemMessageBinding.inflate(
                    LayoutInflater.from(parent.context),
                    parent,
                    false
                )
                MessageViewHolder(binding, onDeleteMessageClickListener)
            }
        }
    }
    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = messages[position]
        when (holder) {
            is MessageViewHolder -> holder.bind(message, linkParser)
            is FileMessageViewHolder -> {
                message.attachedFile?.let { fileMessage ->
                    holder.bind(fileMessage, message)
                }
            }
            is SystemMessageViewHolder -> holder.bind(message, linkParser)
        }
    }
    override fun getItemCount(): Int = messages.size
    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        super.onViewRecycled(holder)
        if (holder is FileMessageViewHolder) {
            holder.clear()
        }
    }
    fun findMessageById(messageId: String): ChatMessage? {
        return messages.find { it.id == messageId }
    }
    fun getMessagePosition(messageId: String): Int {
        return messages.indexOfFirst { it.id == messageId }
    }
    inner class MessageViewHolder(
        private val binding: ItemMessageBinding,
        private val onDeleteMessageClickListener: (String) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(message: ChatMessage, linkParser: LinkParser) {
            with(binding) {
                val canDelete = message.isMyMessage &&
                        !message.isSystem &&
                        message.canDelete &&
                        !message.hasAttachment
                deleteButton.visibility = if (canDelete) View.VISIBLE else View.GONE
                deleteButton.setOnClickListener {
                    if (canDelete) {
                        onDeleteMessageClickListener(message.id)
                    }
                }
                if (message.isMyMessage) {
                    messageCard.setCardBackgroundColor(
                        root.context.getColor(R.color.my_message)
                    )
                    messageUsername.text = "Вы"
                    messageUsername.visibility = View.VISIBLE
                    contentContainer.setPadding(0, 0, 20, 0)
                } else {
                    messageCard.setCardBackgroundColor(
                        root.context.getColor(R.color.other_message)
                    )
                    messageUsername.text = message.username
                    messageUsername.visibility = View.VISIBLE
                    contentContainer.setPadding(0, 0, 0, 0)
                }
                linkParser.parseAndSetLinks(
                    messageText,
                    message.text,
                    message.isEncrypted
                )
                messageTime.text = message.timestamp
                if (message.isEncrypted) {
                    if (message.text.contains("🔒") || message.text.contains("Неверный ключ")) {
                        messageText.setTextColor(
                            root.context.getColor(android.R.color.holo_red_dark)
                        )
                        messageText.textSize = 14f
                    } else {
                        messageText.setTextColor(
                            root.context.getColor(R.color.dark_gray)
                        )
                        messageText.textSize = 16f
                        linkParser.parseAndSetLinks(
                            messageText,
                            message.text,
                            false
                        )
                    }
                } else {
                    messageText.setTextColor(
                        root.context.getColor(R.color.black)
                    )
                    messageText.textSize = 16f
                }
                if (message.isMyMessage) {
                    messageTime.gravity = android.view.Gravity.END
                } else {
                    messageTime.gravity = android.view.Gravity.START
                }
            }
        }
    }
    inner class SystemMessageViewHolder(private val binding: ItemMessageBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(message: ChatMessage, linkParser: LinkParser) {
            with(binding) {
                deleteButton.visibility = View.GONE
                messageCard.setCardBackgroundColor(
                    root.context.getColor(R.color.system_message)
                )
                messageUsername.text = "Система"
                messageUsername.visibility = View.VISIBLE
                linkParser.parseAndSetLinks(
                    messageText,
                    message.text,
                    false
                )
                messageTime.text = message.timestamp
                messageText.setTextColor(root.context.getColor(R.color.black))
                messageText.textSize = 14f
                messageTime.gravity = android.view.Gravity.CENTER
            }
        }
    }
    inner class FileMessageViewHolder(
        private val binding: ItemFileMessageBinding,
        private val onFileClickListener: (FileMessage) -> Unit,
        private val onFileRetryClickListener: (FileMessage) -> Unit,
        private val onDeleteMessageClickListener: (String) -> Unit,
        private val serverBaseUrl: String,
        private var encryptionKey: String
    ) : RecyclerView.ViewHolder(binding.root) {

        private var currentFileMessage: FileMessage? = null
        private var currentMessageId: String? = null

        init {
            binding.rootLayout.setOnClickListener {
                currentFileMessage?.let { fileMessage ->
                    onFileClickListener(fileMessage)
                }
            }

            binding.videoPlayOverlay?.setOnClickListener {
                currentFileMessage?.let { fileMessage ->
                    onFileClickListener(fileMessage)
                }
            }

            // УДАЛЕНО: обработчик кнопки Повторить
            // binding.retryButton.setOnClickListener {
            //     currentFileMessage?.let { fileMessage ->
            //         onFileRetryClickListener(fileMessage)
            //     }
            // }

            binding.deleteFileButton.setOnClickListener {
                currentMessageId?.let { messageId ->
                    onDeleteMessageClickListener(messageId)
                }
            }
        }

        fun bind(fileMessage: FileMessage, message: ChatMessage) {
            currentFileMessage = fileMessage
            currentMessageId = message.id

            with(binding) {
                val canDelete = message.isMyMessage &&
                        !message.isSystem &&
                        message.canDelete

                deleteFileButton.visibility = if (canDelete) View.VISIBLE else View.GONE

                // Определяем тип файла
                val fileManager = FileManager(root.context)
                val fileType = fileMessage.fileCategory

                // Настраиваем отображение в зависимости от типа файла
                when (fileType) {
                    FileManager.FileType.IMAGE -> {
                        thumbnailImage.visibility = View.VISIBLE
                        videoThumbnailContainer.visibility = View.GONE
                    }
                    FileManager.FileType.VIDEO -> {
                        thumbnailImage.visibility = View.GONE
                        videoThumbnailContainer.visibility = View.VISIBLE
                        videoPlayOverlay?.visibility = View.VISIBLE
                    }
                    else -> {
                        thumbnailImage.visibility = View.GONE
                        videoThumbnailContainer.visibility = View.GONE
                    }
                }

                // Форматируем имя файла
                fileName.text = formatFileName(fileMessage.fileName)

                // Форматируем размер файла
                fileSize.text = formatFileSize(fileMessage.fileSize)

                // Устанавливаем иконку типа файла
                fileIcon.setImageResource(fileManager.getFileIcon(fileType))

                // Устанавливаем цвет фона
                val backgroundColor = fileManager.getFileBackgroundColor(fileType)
                rootLayout.setBackgroundColor(root.context.getColor(backgroundColor))

                // Отображаем длительность для видео и аудио
                if (fileMessage.duration > 0 &&
                    (fileType == FileManager.FileType.VIDEO || fileType == FileManager.FileType.AUDIO)) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    durationText.text = String.format("%02d:%02d", minutes, seconds)
                    durationText.visibility = View.VISIBLE
                } else {
                    durationText.visibility = View.GONE
                }

                // Показываем индикатор шифрования
                encryptionIndicator.visibility = if (fileMessage.isEncrypted) View.VISIBLE else View.GONE

                // ОБНОВЛЕНО: Упрощенный статус файла без "Нажмите для скачивания"
                statusText.text = when {
                    fileMessage.isDownloading -> "⏬ Скачивается..."
                    fileMessage.isUploading -> "⏫ Отправляется..."
                    fileMessage.localPath != null -> "✓ Сохранено"
                    fileMessage.fileData != null -> "✓ Доступно"
                    fileMessage.fileUrl != null -> "" // УДАЛЕНО: "Нажмите для скачивания"
                    else -> "" // УДАЛЕНО: "Недоступно"
                }

                // Скрываем статус, если он пустой
                statusText.visibility = if (statusText.text.isNotEmpty()) View.VISIBLE else View.GONE

                // Показываем прогресс загрузки/скачивания
                if (fileMessage.isDownloading || fileMessage.isUploading) {
                    uploadProgress.visibility = View.VISIBLE
                    uploadProgress.progress = fileMessage.uploadProgress
                } else {
                    uploadProgress.visibility = View.GONE
                }

                // УДАЛЕНО: Показываем кнопку повтора если файл не скачан
                // retryButton.visibility = if (fileMessage.localPath == null &&
                //     !fileMessage.isDownloading &&
                //     !fileMessage.isUploading &&
                //     (fileMessage.fileData != null || fileMessage.fileUrl != null)) {
                //     View.VISIBLE
                // } else {
                //     View.GONE
                // }

                // Скрываем кнопку Повторить полностью
                retryButton.visibility = View.GONE

                // Загружаем миниатюру в зависимости от типа файла
                when (fileType) {
                    FileManager.FileType.IMAGE -> {
                        loadImageThumbnail(fileMessage)
                    }
                    FileManager.FileType.VIDEO -> {
                        loadVideoThumbnail(fileMessage)
                    }
                    else -> {
                        // Для аудио и документов не показываем миниатюру
                    }
                }
            }
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
                            .centerCrop()
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
                                android.util.Base64.decode(fileData, android.util.Base64.DEFAULT)
                            }

                            Glide.with(binding.root.context)
                                .load(imageBytes)
                                .apply(GlideCacheManager.getNoCacheOptions())
                                .override(150, 150)
                                .centerCrop()
                                .into(binding.thumbnailImage)
                            return
                        } catch (e: Exception) {
                            // Если не удалось декодировать как Base64
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
                        .centerCrop()
                        .into(binding.thumbnailImage)
                    return
                }

                // 4. Если ничего не сработало, показываем иконку
                binding.thumbnailImage.setImageResource(R.drawable.ic_image)

            } catch (e: Exception) {
                binding.thumbnailImage.setImageResource(R.drawable.ic_image)
            }
        }

        private fun loadVideoThumbnail(fileMessage: FileMessage) {
            try {
                // Сначала показываем placeholder
                binding.videoThumbnail.setImageResource(R.drawable.ic_video)

                // Загружаем миниатюру в фоне с использованием Thread вместо CoroutineScope
                Thread {
                    try {
                        val thumbnail = extractVideoThumbnail(fileMessage)

                        // Используем Handler для обновления UI из фонового потока
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            if (thumbnail != null) {
                                binding.videoThumbnail.setImageBitmap(thumbnail)
                            } else {
                                binding.videoThumbnail.setImageResource(R.drawable.ic_video)
                            }
                        }
                    } catch (e: Exception) {
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            binding.videoThumbnail.setImageResource(R.drawable.ic_video)
                        }
                    }
                }.start()
            } catch (e: Exception) {
                binding.videoThumbnail.setImageResource(R.drawable.ic_video)
            }
        }

        private fun extractVideoThumbnail(fileMessage: FileMessage): android.graphics.Bitmap? {
            return try {
                val retriever = MediaMetadataRetriever()

                when {
                    fileMessage.localPath != null -> {
                        val file = File(fileMessage.localPath!!)
                        if (file.exists()) {
                            retriever.setDataSource(file.absolutePath)
                        } else {
                            return null
                        }
                    }

                    fileMessage.fileData != null -> {
                        val videoBytes = if (fileMessage.isEncrypted && encryptionKey.isNotEmpty()) {
                            CryptoJSCompat.decryptFileCompatibleJS(fileMessage.fileData!!, encryptionKey)
                        } else {
                            android.util.Base64.decode(fileMessage.fileData!!, android.util.Base64.DEFAULT)
                        }

                        val tempFile = File(binding.root.context.cacheDir,
                            "temp_thumb_${System.currentTimeMillis()}.webm")
                        tempFile.outputStream().use { it.write(videoBytes) }
                        retriever.setDataSource(tempFile.absolutePath)
                        tempFile.delete()
                    }

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

                    else -> return null
                }

                val thumbnail = retriever.getFrameAtTime(1000000,
                    MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                retriever.release()
                thumbnail
            } catch (e: Exception) {
                null
            }
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
            currentMessageId = null
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
    }
    fun getFileMessageText(fileMessage: FileMessage): String {
        val formattedName = formatFileName(fileMessage.fileName)
        return when (fileMessage.fileCategory) {
            FileManager.FileType.IMAGE -> "📷 Изображение: $formattedName"
            FileManager.FileType.VIDEO -> {
                if (fileMessage.duration > 0) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    "🎥 Видео (${minutes}:${String.format("%02d", seconds)}): $formattedName"
                } else {
                    "🎥 Видео: $formattedName"
                }
            }
            FileManager.FileType.AUDIO -> {
                if (fileMessage.duration > 0) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    "🎵 Аудио (${minutes}:${String.format("%02d", seconds)}): $formattedName"
                } else {
                    "🎵 Аудио: $formattedName"
                }
            }
            FileManager.FileType.DOCUMENT -> "📄 Файл: $formattedName"
        }
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
    fun updateFileLocalPath(fileId: String, localPath: String) {
        for (i in messages.indices) {
            val message = messages[i]
            if (message.attachedFile?.id == fileId) {
                val updatedFileMessage = message.attachedFile.copy(localPath = localPath)
                val updatedMessage = message.copy(attachedFile = updatedFileMessage)
                messages[i] = updatedMessage
                notifyItemChanged(i)
                break
            }
        }
    }
    fun getMessage(position: Int): ChatMessage {
        return messages[position]
    }
}