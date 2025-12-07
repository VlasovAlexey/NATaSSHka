// app/src/main/java/com/natasshka/messenger/MessagesAdapter.kt
package com.natasshka.messenger

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.recyclerview.widget.RecyclerView
import com.natasshka.messenger.databinding.ItemMessageBinding

class MessagesAdapter : RecyclerView.Adapter<MessagesAdapter.MessageViewHolder>() {

    private val messages = mutableListOf<ChatMessage>()
    private var encryptionKey = ""

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
            if (message.isEncrypted) {
                // Обновляем текст сообщения в зависимости от наличия ключа
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

                // Создаем обновленное сообщение
                val updatedMessage = message.copy(text = newText)
                messages[i] = updatedMessage
                notifyItemChanged(i)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val binding = ItemMessageBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return MessageViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        holder.bind(messages[position])
    }

    override fun getItemCount(): Int = messages.size

    inner class MessageViewHolder(private val binding: ItemMessageBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(message: ChatMessage) {
            with(binding) {
                // Настройка внешнего вида в зависимости от типа сообщения
                when {
                    message.isSystem -> {
                        messageCard.setCardBackgroundColor(
                            root.context.getColor(R.color.system_message)
                        )
                        messageUsername.text = "Система"
                        messageUsername.visibility = View.VISIBLE

                        // Системные сообщения по центру
                        val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                        layoutParams?.let {
                            it.marginStart = 0
                            it.marginEnd = 0
                            it.width = ViewGroup.LayoutParams.MATCH_PARENT
                        }
                        messageCard.requestLayout()
                    }
                    message.isMyMessage -> {
                        messageCard.setCardBackgroundColor(
                            root.context.getColor(R.color.my_message)
                        )
                        messageUsername.text = "Вы"
                        messageUsername.visibility = View.VISIBLE

                        // Сообщения текущего пользователя выравниваем справа
                        val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                        layoutParams?.let {
                            it.marginStart = 80
                            it.marginEnd = 8
                            it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                        // Выравниваем содержимое внутри карточки
                        val innerLayout = messageCard.getChildAt(0)
                        if (innerLayout is ConstraintLayout) {
                            val params = innerLayout.layoutParams as ConstraintLayout.LayoutParams
                            params.endToEnd = ConstraintLayout.LayoutParams.PARENT_ID
                            params.startToStart = ConstraintLayout.LayoutParams.UNSET
                            innerLayout.layoutParams = params
                        }
                        messageCard.requestLayout()
                    }
                    else -> {
                        messageCard.setCardBackgroundColor(
                            root.context.getColor(R.color.other_message)
                        )
                        messageUsername.text = message.username
                        messageUsername.visibility = View.VISIBLE

                        // Сообщения других пользователей выравниваем слева
                        val layoutParams = messageCard.layoutParams as? ViewGroup.MarginLayoutParams
                        layoutParams?.let {
                            it.marginStart = 8
                            it.marginEnd = 80
                            it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                        // Выравниваем содержимое внутри карточки
                        val innerLayout = messageCard.getChildAt(0)
                        if (innerLayout is ConstraintLayout) {
                            val params = innerLayout.layoutParams as ConstraintLayout.LayoutParams
                            params.startToStart = ConstraintLayout.LayoutParams.PARENT_ID
                            params.endToEnd = ConstraintLayout.LayoutParams.UNSET
                            innerLayout.layoutParams = params
                        }
                        messageCard.requestLayout()
                    }
                }

                messageText.text = message.text
                messageTime.text = message.timestamp

                // Для зашифрованных сообщений меняем цвет и стиль текста
                if (message.isEncrypted) {
                    if (message.text.contains("🔒")) {
                        // Если не можем расшифровать - красный текст
                        messageText.setTextColor(
                            root.context.getColor(android.R.color.holo_red_dark)
                        )
                        messageText.textSize = 14f
                    } else {
                        // Если успешно расшифровали - темно-серый
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

                // Выравниваем время в зависимости от типа сообщения
                if (message.isMyMessage) {
                    messageTime.gravity = android.view.Gravity.END
                } else {
                    messageTime.gravity = android.view.Gravity.START
                }
            }
        }
    }
}