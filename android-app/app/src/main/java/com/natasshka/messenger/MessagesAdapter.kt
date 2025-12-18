package com.natasshka.messenger

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.recyclerview.widget.RecyclerView
import com.natasshka.messenger.databinding.ItemFileMessageBinding
import com.natasshka.messenger.databinding.ItemMessageBinding

class MessagesAdapter(
    private val onFileClickListener: (FileMessage) -> Unit = {},
    private val onFileRetryClickListener: (FileMessage) -> Unit = {},
    private val serverBaseUrl: String = "http://10.0.2.2:3000",
    private var encryptionKey: String = "" // Добавляем поле для ключа шифрования
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val VIEW_TYPE_MESSAGE = 1
        private const val VIEW_TYPE_FILE = 2
        private const val VIEW_TYPE_SYSTEM = 3
    }

    private val messages = mutableListOf<ChatMessage>()

    fun addMessage(message: ChatMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }

    fun clearMessages() {
        messages.clear()
        notifyDataSetChanged()
    }

    fun reDecryptMessages(newKey: String) {
        encryptionKey = newKey

        for (i in messages.indices) {
            val message = messages[i]

            // Перешифровка текстовых сообщений
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

            // Для файловых сообщений с изображениями, если изменился ключ, нужно перерисовать
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
                    serverBaseUrl, // Передаем serverBaseUrl
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
                MessageViewHolder(binding)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = messages[position]

        when (holder) {
            is MessageViewHolder -> holder.bind(message)
            is FileMessageViewHolder -> {
                // Обновляем ключ шифрования в ViewHolder
                holder.updateEncryptionKey(encryptionKey)
                message.attachedFile?.let { fileMessage ->
                    holder.bind(fileMessage)
                }
            }
            is SystemMessageViewHolder -> holder.bind(message)
        }
    }

    override fun getItemCount(): Int = messages.size

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        super.onViewRecycled(holder)

        // Очищаем ресурсы при переиспользовании ViewHolder для изображений
        if (holder is FileMessageViewHolder) {
            holder.clear()
        }
    }

    inner class MessageViewHolder(private val binding: ItemMessageBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(message: ChatMessage) {
            with(binding) {
                if (message.isMyMessage) {
                    messageCard.setCardBackgroundColor(
                        root.context.getColor(R.color.my_message)
                    )
                    messageUsername.text = "Вы"
                    messageUsername.visibility = View.VISIBLE

                    val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                    layoutParams?.let {
                        it.marginStart = 80
                        it.marginEnd = 8
                        it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                    }
                    val innerLayout = messageCard.getChildAt(0)
                    if (innerLayout is ConstraintLayout) {
                        val params = innerLayout.layoutParams as ConstraintLayout.LayoutParams
                        params.endToEnd = ConstraintLayout.LayoutParams.PARENT_ID
                        params.startToStart = ConstraintLayout.LayoutParams.UNSET
                        innerLayout.layoutParams = params
                    }
                    messageCard.requestLayout()
                } else {
                    messageCard.setCardBackgroundColor(
                        root.context.getColor(R.color.other_message)
                    )
                    messageUsername.text = message.username
                    messageUsername.visibility = View.VISIBLE

                    val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                    layoutParams?.let {
                        it.marginStart = 8
                        it.marginEnd = 80
                        it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                    }
                    val innerLayout = messageCard.getChildAt(0)
                    if (innerLayout is ConstraintLayout) {
                        val params = innerLayout.layoutParams as ConstraintLayout.LayoutParams
                        params.startToStart = ConstraintLayout.LayoutParams.PARENT_ID
                        params.endToEnd = ConstraintLayout.LayoutParams.UNSET
                        innerLayout.layoutParams = params
                    }
                    messageCard.requestLayout()
                }

                messageText.text = message.text
                messageTime.text = message.timestamp

                if (message.isEncrypted) {
                    if (message.text.contains("🔒")) {
                        messageText.setTextColor(
                            root.context.getColor(android.R.color.holo_red_dark)
                        )
                        messageText.textSize = 14f
                    } else {
                        messageText.setTextColor(
                            root.context.getColor(R.color.dark_gray)
                        )
                        messageText.textSize = 16f
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

        fun bind(message: ChatMessage) {
            with(binding) {
                messageCard.setCardBackgroundColor(
                    root.context.getColor(R.color.system_message)
                )
                messageUsername.text = "Система"
                messageUsername.visibility = View.VISIBLE

                val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                layoutParams?.let {
                    it.marginStart = 0
                    it.marginEnd = 0
                    it.width = ViewGroup.LayoutParams.MATCH_PARENT
                }
                messageCard.requestLayout()

                messageText.text = message.text
                messageTime.text = message.timestamp
                messageText.setTextColor(root.context.getColor(R.color.black))
                messageText.textSize = 14f
                messageTime.gravity = android.view.Gravity.CENTER
            }
        }
    }

    // Метод для получения текста файлового сообщения (используется в MainActivity)
    fun getFileMessageText(fileMessage: FileMessage): String {
        // Форматируем имя файла
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

    fun updateFileLocalPath(fileId: String, localPath: String) {
        for (i in messages.indices) {
            val message = messages[i]
            if (message.attachedFile?.id == fileId) {
                // Создаем обновленное сообщение с новым путем
                val updatedFileMessage = message.attachedFile.copy(localPath = localPath)
                val updatedMessage = message.copy(attachedFile = updatedFileMessage)
                messages[i] = updatedMessage
                notifyItemChanged(i)
                break
            }
        }
    }

    // Метод для получения сообщения по индексу (опционально)
    fun getMessage(position: Int): ChatMessage {
        return messages[position]
    }
}