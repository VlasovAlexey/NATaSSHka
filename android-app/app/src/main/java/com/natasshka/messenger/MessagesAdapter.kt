package com.natasshka.messenger

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.recyclerview.widget.RecyclerView
import com.natasshka.messenger.databinding.ItemMessageBinding

class MessagesAdapter : RecyclerView.Adapter<MessagesAdapter.MessageViewHolder>() {

    private val messages = mutableListOf<ChatMessage>()

    fun addMessage(message: ChatMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }

    fun clearMessages() {
        messages.clear()
        notifyDataSetChanged()
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
                            it.marginStart = 80 // Отступ слева для выравнивания справа
                            it.marginEnd = 8    // Стандартный отступ справа
                            it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                        // Выравниваем содержимое внутри карточки
                        val innerLayout = messageCard.getChildAt(0)
                        if (innerLayout is androidx.constraintlayout.widget.ConstraintLayout) {
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
                            it.marginStart = 8  // Стандартный отступ слева
                            it.marginEnd = 80   // Отступ справа для выравнивания слева
                            it.width = ViewGroup.LayoutParams.WRAP_CONTENT
                        }
                        // Выравниваем содержимое внутри карточки
                        val innerLayout = messageCard.getChildAt(0)
                        if (innerLayout is androidx.constraintlayout.widget.ConstraintLayout) {
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

                // Для зашифрованных сообщений меняем цвет текста
                if (message.isEncrypted) {
                    messageText.setTextColor(
                        root.context.getColor(R.color.dark_gray)
                    )
                } else {
                    messageText.setTextColor(
                        root.context.getColor(R.color.black)
                    )
                }

                // Выравниваем время в зависимости от типа сообщения
                if (message.isMyMessage) {
                    // Для своих сообщений - время справа
                    messageTime.gravity = android.view.Gravity.END
                } else {
                    // Для сообщений других - время слева
                    messageTime.gravity = android.view.Gravity.START
                }
            }
        }
    }
}