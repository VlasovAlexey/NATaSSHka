package com.natasshka.messenger

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.File

object CacheMonitor {
    private const val TAG = "CacheMonitor"
    private const val CHECK_INTERVAL = 300000L // 5 минут
    private const val MAX_CACHE_SIZE_MB = 50

    private lateinit var appContext: Context
    private var monitoringHandler: Handler? = null
    private var monitoringRunnable: Runnable? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
        startMonitoring()
    }

    private fun startMonitoring() {
        stopMonitoring() // Остановить предыдущий мониторинг

        monitoringHandler = Handler(Looper.getMainLooper())
        monitoringRunnable = object : Runnable {
            override fun run() {
                checkCacheSize()
                monitoringHandler?.postDelayed(this, CHECK_INTERVAL)
            }
        }

        monitoringHandler?.post(monitoringRunnable!!)
        Log.d(TAG, "Cache monitoring started")
    }

    fun stopMonitoring() {
        monitoringRunnable?.let { runnable ->
            monitoringHandler?.removeCallbacks(runnable)
        }
        monitoringHandler = null
        monitoringRunnable = null
        Log.d(TAG, "Cache monitoring stopped")
    }

    private fun checkCacheSize() {
        Thread {
            try {
                val cacheDir = appContext.cacheDir
                val sizeInMB = getDirectorySizeMB(cacheDir)

                Log.d(TAG, "Cache directory size: ${String.format("%.2f", sizeInMB)} MB")

                if (sizeInMB > MAX_CACHE_SIZE_MB) {
                    Log.w(TAG, "Cache size exceeded $MAX_CACHE_SIZE_MB MB, cleaning...")
                    cleanupCache()
                }

                // Проверка на наличие старых файлов
                cleanupOldFiles(cacheDir)
            } catch (e: Exception) {
                Log.e(TAG, "Error checking cache size", e)
            }
        }.start()
    }

    private fun getDirectorySizeMB(directory: File): Double {
        var size: Long = 0
        directory.listFiles()?.forEach { file ->
            size += if (file.isFile) file.length() else getDirectorySizeBytes(file)
        }
        return size / (1024.0 * 1024.0)
    }

    private fun getDirectorySizeBytes(directory: File): Long {
        var size: Long = 0
        directory.listFiles()?.forEach { file ->
            size += if (file.isFile) file.length() else getDirectorySizeBytes(file)
        }
        return size
    }

    private fun cleanupCache() {
        try {
            val cacheDir = appContext.cacheDir

            // 1. Удалить все временные файлы
            cacheDir.listFiles()?.forEach { file ->
                if (isCacheFile(file)) {
                    file.deleteRecursively()
                    Log.d(TAG, "Deleted cache file: ${file.name}")
                }
            }

            // 2. Очистить кэш Glide
            try {
                val glideDir = File(cacheDir, "image_manager_disk_cache")
                if (glideDir.exists()) {
                    glideDir.deleteRecursively()
                    Log.d(TAG, "Cleaned Glide cache")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error cleaning Glide cache", e)
            }

            // 3. Очистить media кэш
            try {
                val mediaDir = File(cacheDir, "media")
                if (mediaDir.exists()) {
                    mediaDir.deleteRecursively()
                    Log.d(TAG, "Cleaned media cache")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error cleaning media cache", e)
            }

            Log.d(TAG, "Cache cleanup completed")
        } catch (e: Exception) {
            Log.e(TAG, "Error during cache cleanup", e)
        }
    }

    private fun cleanupOldFiles(directory: File) {
        val oneHourAgo = System.currentTimeMillis() - 3600000
        directory.listFiles()?.forEach { file ->
            if (file.lastModified() < oneHourAgo) {
                file.deleteRecursively()
                Log.d(TAG, "Deleted old file: ${file.name}")
            }
        }
    }

    private fun isCacheFile(file: File): Boolean {
        val name = file.name
        return name.startsWith("temp_") ||
                name.startsWith("cache_") ||
                name.endsWith(".tmp") ||
                name.endsWith(".temp") ||
                name.contains("cache") ||
                file.isFile && file.length() > 10485760 // > 10MB
    }

    fun forceCleanup() {
        Thread {
            cleanupCache()
        }.start()
    }
}