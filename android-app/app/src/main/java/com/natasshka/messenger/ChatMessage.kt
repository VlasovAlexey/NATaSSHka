package com.natasshka.messenger

data class ChatMessage(
    val id: String,
    val username: String,
    val text: String,
    val timestamp: String,
    val isMyMessage: Boolean,
    val isSystem: Boolean = false,
    val isEncrypted: Boolean = false,
    val originalEncryptedText: String? = null,
    val attachedFile: FileMessage? = null,
    val hasAttachment: Boolean = false,
    val containsLinks: Boolean = false,
    val canDelete: Boolean = true
)