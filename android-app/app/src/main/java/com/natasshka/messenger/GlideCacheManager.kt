package com.natasshka.messenger

import android.content.Context
import android.util.Log
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.load.resource.bitmap.RoundedCorners
import com.bumptech.glide.request.RequestOptions
import java.io.File

object GlideCacheManager {
    private lateinit var appContext: Context

    fun initialize(context: Context) {
        appContext = context.applicationContext
        clearOldCacheOnStartup()
    }

    /**
     * Опции для загрузки без кэширования
     */
    fun getNoCacheOptions(): RequestOptions {
        return RequestOptions()
            .skipMemoryCache(true)          // Не кэшировать в памяти
            .diskCacheStrategy(DiskCacheStrategy.NONE)  // Не кэшировать на диске
            .dontTransform()                // Не применять трансформации
    }

    /**
     * Опции для загрузки миниатюр (маленький размер, без кэша)
     */
    fun getThumbnailOptions(): RequestOptions {
        return RequestOptions()
            .skipMemoryCache(true)
            .diskCacheStrategy(DiskCacheStrategy.NONE)
            .override(150, 150)
            .centerCrop()
            .transform(RoundedCorners(8))
            //.placeholder(R.drawable.ic_image_placeholder)
            //.error(R.drawable.ic_error_placeholder)

    }

    /**
     * Опции для загрузки видео миниатюр
     */
    fun getVideoThumbnailOptions(): RequestOptions {
        return RequestOptions()
            .skipMemoryCache(true)
            .diskCacheStrategy(DiskCacheStrategy.NONE)
            .override(150, 150)
            .centerCrop()
            .transform(RoundedCorners(8))
            .placeholder(R.drawable.ic_video_placeholder)
            //.error(R.drawable.ic_error_placeholder)
    }

    /**
     * Опции для полноэкранных изображений (без кэша, максимальное качество)
     */
    fun getFullscreenOptions(): RequestOptions {
        return RequestOptions()
            .skipMemoryCache(true)
            .diskCacheStrategy(DiskCacheStrategy.NONE)
            .dontTransform()

    }

    /**
     * Очистка кэша памяти
     */
    fun clearMemoryCache() {
        try {
            Glide.get(appContext).clearMemory()
        } catch (e: Exception) {
            Log.e("GlideCacheManager", "Error clearing memory cache", e)
        }
    }

    /**
     * Очистка кэша на диске
     */
    fun clearDiskCache() {
        Thread {
            try {
                Glide.get(appContext).clearDiskCache()
            } catch (e: Exception) {
                Log.e("GlideCacheManager", "Error clearing disk cache", e)
            }
        }.start()
    }

    /**
     * Полная очистка кэша
     */
    fun clearAllCache() {
        clearMemoryCache()
        clearDiskCache()
    }

    /**
     * Очистка старых кэш-файлов Glide при запуске приложения
     */
    private fun clearOldCacheOnStartup() {
        Thread {
            try {
                // Папка кэша Glide
                val cacheDir = File(appContext.cacheDir, "image_manager_disk_cache")
                if (cacheDir.exists() && cacheDir.isDirectory) {
                    cacheDir.listFiles()?.forEach { file ->
                        // Удаляем файлы старше 1 часа
                        if (System.currentTimeMillis() - file.lastModified() > 3600000) {
                            file.delete()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("GlideCacheManager", "Error clearing old cache", e)
            }
        }.start()
    }

    /**
     * Очистка при выходе из приложения
     * ИСПРАВЛЕНО: Используем appContext который уже инициализирован
     */
    fun cleanupOnAppExit() {
        clearAllCache()
        deleteGlideCacheDirectory()
        Log.d("GlideCacheManager", "Cleanup on app exit completed")
    }

    /**
     * Принудительное удаление директории кэша Glide
     */
    private fun deleteGlideCacheDirectory() {
        Thread {
            try {
                // ИСПРАВЛЕНО: Используем appContext вместо обращения к контексту
                val cacheDir = File(appContext.cacheDir, "image_manager_disk_cache")
                if (cacheDir.exists()) {
                    cacheDir.deleteRecursively()
                    Log.d("GlideCacheManager", "Glide cache directory deleted")
                }
            } catch (e: Exception) {
                Log.e("GlideCacheManager", "Error deleting cache directory", e)
            }
        }.start()
    }
}