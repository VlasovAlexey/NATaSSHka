package com.natasshka.messenger

data class ChatMessage(
    val id: String,
    val username: String,
    val text: String,
    val timestamp: String,
    val isMyMessage: Boolean,
    val isSystem: Boolean = false,
    val isEncrypted: Boolean = false,
    val originalEncryptedText: String? = null, // Для перешифровки
    val attachedFile: FileMessage? = null, // Прикрепленный файл
    val hasAttachment: Boolean = false, // Флаг наличия вложения
    val containsLinks: Boolean = false // Новое поле: содержит ли сообщение ссылки
)