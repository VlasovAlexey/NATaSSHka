// app/src/main/java/com/natasshka/messenger/ChatMessage.kt
package com.natasshka.messenger

data class ChatMessage(
    val id: String,
    val username: String,
    val text: String,
    val timestamp: String,
    val isMyMessage: Boolean,
    val isSystem: Boolean = false,
    val isEncrypted: Boolean = false,
    val originalEncryptedText: String? = null // Для перешифровки
)