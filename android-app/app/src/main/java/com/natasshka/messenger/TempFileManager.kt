package com.natasshka.messenger

import android.content.Context
import android.util.Log
import java.io.File

object TempFileManager {
    private lateinit var appContext: Context

    fun initialize(context: Context) {
        appContext = context.applicationContext
        cleanupOldTempFiles()
    }

    /**
     * Очистка всех временных файлов
     */
    fun cleanupAllTempFiles() {
        Thread {
            try {
                val cacheDir = appContext.cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    if (isTempFile(file)) {
                        file.deleteRecursively()
                    }
                }
                Log.d("TempFileManager", "All temp files cleaned up")
            } catch (e: Exception) {
                Log.e("TempFileManager", "Error cleaning temp files", e)
            }
        }.start()
    }

    /**
     * Очистка старых временных файлов (старше 1 часа)
     */
    private fun cleanupOldTempFiles() {
        Thread {
            try {
                val cacheDir = appContext.cacheDir
                val oneHourAgo = System.currentTimeMillis() - 3600000

                cacheDir.listFiles()?.forEach { file ->
                    if (isTempFile(file) && file.lastModified() < oneHourAgo) {
                        file.deleteRecursively()
                    }
                }
            } catch (e: Exception) {
                Log.e("TempFileManager", "Error cleaning old temp files", e)
            }
        }.start()
    }

    /**
     * Проверка, является ли файл временным
     */
    private fun isTempFile(file: File): Boolean {
        val name = file.name
        return name.startsWith("temp_") ||
                name.startsWith("VID_") ||
                name.startsWith("audio_message_") ||
                name.startsWith("temp_video_") ||
                name.startsWith("temp_thumb_") ||
                (name.contains("temp") && (name.endsWith(".webm") ||
                        name.endsWith(".mp4") ||
                        name.endsWith(".jpg") ||
                        name.endsWith(".png")))
    }

    /**
     * Очистка временных файлов определенного типа
     */
    fun cleanupTempFilesByType(type: String) {
        Thread {
            try {
                val cacheDir = appContext.cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    if (file.name.contains(type)) {
                        file.deleteRecursively()
                    }
                }
            } catch (e: Exception) {
                Log.e("TempFileManager", "Error cleaning $type temp files", e)
            }
        }.start()
    }
}