package com.natasshka.messenger
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import com.natasshka.messenger.databinding.ItemMessageBinding
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
                holder.updateEncryptionKey(encryptionKey)
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
        fun bind(fileMessage: FileMessage, message: ChatMessage) {
            currentFileMessage = fileMessage
            currentMessageId = message.id
            with(binding) {
                val canDelete = message.isMyMessage &&
                        !message.isSystem &&
                        message.canDelete
                deleteFileButton.visibility = if (canDelete) View.VISIBLE else View.GONE
                deleteFileButton.setOnClickListener {
                    if (canDelete && currentMessageId != null) {
                        onDeleteMessageClickListener(currentMessageId!!)
                    }
                }
                when (fileMessage.fileCategory) {
                    FileManager.FileType.IMAGE -> {
                        thumbnailImage.visibility = View.VISIBLE
                        videoThumbnailContainer.visibility = View.GONE
                    }
                    FileManager.FileType.VIDEO -> {
                        thumbnailImage.visibility = View.GONE
                        videoThumbnailContainer.visibility = View.VISIBLE
                    }
                    else -> {
                        thumbnailImage.visibility = View.GONE
                        videoThumbnailContainer.visibility = View.GONE
                    }
                }
                fileName.text = fileMessage.fileName
                val fileSizeText = when {
                    fileMessage.fileSize >= 1024 * 1024 -> {
                        String.format("%.1f МБ", fileMessage.fileSize / (1024.0 * 1024.0))
                    }
                    fileMessage.fileSize >= 1024 -> {
                        String.format("%.1f КБ", fileMessage.fileSize / 1024.0)
                    }
                    else -> {
                        "${fileMessage.fileSize} Б"
                    }
                }
                fileSize.text = fileSizeText
                val fileManager = FileManager(root.context)
                fileIcon.setImageResource(fileManager.getFileIcon(fileMessage.fileCategory))
                rootLayout.setBackgroundColor(
                    root.context.getColor(fileManager.getFileBackgroundColor(fileMessage.fileCategory))
                )
                if (fileMessage.duration > 0 &&
                    (fileMessage.fileCategory == FileManager.FileType.AUDIO ||
                            fileMessage.fileCategory == FileManager.FileType.VIDEO)) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    durationText.text = String.format("%02d:%02d", minutes, seconds)
                    durationText.visibility = View.VISIBLE
                } else {
                    durationText.visibility = View.GONE
                }
                encryptionIndicator.visibility = if (fileMessage.isEncrypted) {
                    View.VISIBLE
                } else {
                    View.GONE
                }
                statusText.text = when {
                    fileMessage.localPath != null -> "✓ Сохранено"
                    fileMessage.isDownloading -> "⏬ Скачивается..."
                    fileMessage.isUploading -> "⏫ Загружается..."
                    else -> "Нажмите для скачивания"
                }
                if (fileMessage.isUploading || fileMessage.isDownloading) {
                    uploadProgress.visibility = View.VISIBLE
                    uploadProgress.progress = fileMessage.uploadProgress
                } else {
                    uploadProgress.visibility = View.GONE
                }
                retryButton.visibility = if (fileMessage.localPath == null &&
                    !fileMessage.isDownloading &&
                    !fileMessage.isUploading) {
                    View.VISIBLE
                } else {
                    View.GONE
                }
                rootLayout.setOnClickListener {
                    currentFileMessage?.let { msg ->
                        onFileClickListener(msg)
                    }
                }
                retryButton.setOnClickListener {
                    currentFileMessage?.let { msg ->
                        onFileRetryClickListener(msg)
                    }
                }
                videoPlayOverlay?.setOnClickListener {
                    currentFileMessage?.let { msg ->
                        onFileClickListener(msg)
                    }
                }
            }
        }
        fun updateEncryptionKey(newKey: String) {
            encryptionKey = newKey
            currentFileMessage?.let {
                binding.encryptionIndicator.visibility = if (it.isEncrypted) View.VISIBLE else View.GONE
            }
        }
        fun clear() {
            binding.thumbnailImage.setImageDrawable(null)
            binding.videoThumbnail.setImageDrawable(null)
            currentFileMessage = null
            currentMessageId = null
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