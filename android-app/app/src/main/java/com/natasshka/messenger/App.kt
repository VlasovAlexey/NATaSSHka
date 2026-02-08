package com.natasshka.messenger

import android.app.Application
import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.util.Log
import java.io.File

class App : Application() {

    companion object {
        private var instance: App? = null

        fun getInstance(): App {
            return instance ?: throw IllegalStateException("Application not initialized")
        }

        fun getAppContext(): Context {
            return getInstance().applicationContext
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Инициализация менеджеров кэша
        GlideCacheManager.initialize(applicationContext)
        TempFileManager.initialize(applicationContext)

        // Инициализация монитора кэша
        CacheMonitor.initialize(applicationContext)

        // Установка обработчика необработанных исключений
        setupCrashHandler()

        Log.d("App", "Application initialized")
    }

    private fun setupCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            // Быстрая очистка перед крашем
            cleanupBeforeCrash()

            // Даем время на очистку
            Handler(Looper.getMainLooper()).postDelayed({
                defaultHandler?.uncaughtException(thread, throwable)
            }, 100)
        }
    }

    private fun cleanupBeforeCrash() {
        try {
            GlideCacheManager.clearMemoryCache()
            // Используем новый поток вместо CoroutineScope для простоты
            Thread {
                try {
                    GlideCacheManager.clearDiskCache()
                    TempFileManager.cleanupAllTempFiles()

                    // Дополнительная очистка cacheDir при краше
                    cleanupCacheDir()
                } catch (e: Exception) {
                    Log.e("App", "Error during crash cleanup", e)
                }
            }.start()
        } catch (e: Exception) {
            // Игнорируем ошибки при краше
        }
    }

    override fun onLowMemory() {
        super.onLowMemory()
        GlideCacheManager.clearMemoryCache()
        Log.d("App", "Low memory - cache cleared")
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        when (level) {
            TRIM_MEMORY_RUNNING_MODERATE,
            TRIM_MEMORY_RUNNING_LOW,
            TRIM_MEMORY_RUNNING_CRITICAL,
            TRIM_MEMORY_UI_HIDDEN -> {
                GlideCacheManager.clearMemoryCache()
                Log.d("App", "Trim memory level $level - cache cleared")
            }
        }
    }

    override fun onTerminate() {
        // Очистка при завершении (вызывается только в эмуляторах)
        cleanupOnExit()

        // ДОПОЛНЕНИЕ: Гарантированная очистка всех временных данных
        cleanupAllData()

        super.onTerminate()
    }

    /**
     * Очистка всех временных данных при выходе
     * ИЗМЕНЕНО: Переименовано с cleanupOnAppExit() на cleanupOnExit()
     */
    fun cleanupOnExit() {
        Log.d("App", "Cleaning up on exit")

        // Очистка кэша Glide
        GlideCacheManager.clearAllCache()

        // Очистка временных файлов
        TempFileManager.cleanupAllTempFiles()

        // Остановка монитора кэша
        CacheMonitor.stopMonitoring()

        // Форсированная очистка кэша
        CacheMonitor.forceCleanup()
    }

    /**
     * Финальная очистка всех данных перед завершением
     */
    private fun cleanupAllData() {
        Log.d("App", "Final cleanup before termination")

        // Очистка всех временных файлов
        TempFileManager.cleanupAllTempFiles()

        // Принудительная очистка cacheDir
        Thread {
            try {
                val cacheDir = cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    if (isTempFile(file)) {
                        file.deleteRecursively()
                        Log.d("App", "Deleted temp file: ${file.name}")
                    }
                }

                // Очистка кэша медиаплееров
                cleanMediaCache()
            } catch (e: Exception) {
                Log.e("App", "Error in final cleanup", e)
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
                name.contains("temp") ||
                name.endsWith(".webm") ||
                name.endsWith(".mp4") ||
                name.endsWith(".jpg") ||
                name.endsWith(".png")
    }

    /**
     * Очистка кэша MediaPlayer и других медиаресурсов
     */
    private fun cleanMediaCache() {
        try {
            // Очистка системных медиа кэшей
            deleteDirectoryContents(File(cacheDir, "media"))

            // Дополнительная очистка возможных медиа директорий
            val possibleMediaDirs = listOf(
                "video_cache",
                "audio_cache",
                "exoplayer",
                "media_cache"
            )

            possibleMediaDirs.forEach { dirName ->
                val dir = File(cacheDir, dirName)
                if (dir.exists()) {
                    deleteDirectoryContents(dir)
                    Log.d("App", "Cleaned media directory: $dirName")
                }
            }
        } catch (e: Exception) {
            Log.e("App", "Error cleaning media cache", e)
        }
    }

    /**
     * Удаление содержимого директории
     */
    private fun deleteDirectoryContents(directory: File) {
        directory.listFiles()?.forEach {
            it.deleteRecursively()
            Log.d("App", "Deleted directory content: ${it.name}")
        }
    }

    /**
     * Быстрая очистка cacheDir
     */
    private fun cleanupCacheDir() {
        Thread {
            try {
                val cacheDir = cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    // Удаляем только временные файлы, не трогаем настройки
                    if (isTempFile(file) && !file.name.contains("pref") && !file.name.contains("settings")) {
                        file.deleteRecursively()
                    }
                }
            } catch (e: Exception) {
                Log.e("App", "Error cleaning cache directory", e)
            }
        }.start()
    }
}