package com.natasshka.messenger

import java.io.Serializable

data class FileMessage(
    val id: String,
    val messageId: String,
    val fileName: String,
    val fileType: String,
    val fileSize: Long,
    val fileUrl: String? = null,
    val fileData: String? = null,
    val localPath: String? = null,
    val isEncrypted: Boolean = false,
    val fileCategory: FileManager.FileType,
    val duration: Long = 0,
    val thumbnailPath: String? = null,
    val uploadProgress: Int = 0,
    val isDownloading: Boolean = false,
    val isUploading: Boolean = false
) : Serializable