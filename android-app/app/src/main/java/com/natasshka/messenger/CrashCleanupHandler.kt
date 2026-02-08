package com.natasshka.messenger

import android.app.Application
import android.os.Handler
import android.os.Looper
import com.bumptech.glide.Glide
import java.lang.Thread.UncaughtExceptionHandler

class CrashCleanupHandler(
    private val originalHandler: UncaughtExceptionHandler?,
    private val application: Application
) : UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        // Быстрая очистка перед крашем
        cleanupBeforeCrash()

        // Даем время на очистку
        Handler(Looper.getMainLooper()).postDelayed({
            originalHandler?.uncaughtException(thread, throwable)
        }, 500)
    }

    private fun cleanupBeforeCrash() {
        try {
            // Быстрая очистка временных файлов
            val cacheDir = application.cacheDir
            Thread {
                cacheDir.listFiles()?.forEach { file ->
                    if (file.name.startsWith("temp_")) {
                        file.delete()
                    }
                }
            }.start()

            // Очистка памяти Glide
            Glide.get(application).clearMemory()
        } catch (e: Exception) {
            // Игнорируем ошибки при очистке во время краша
        }
    }

    companion object {
        fun setup(application: Application) {
            val originalHandler = Thread.getDefaultUncaughtExceptionHandler()
            if (originalHandler !is CrashCleanupHandler) {
                Thread.setDefaultUncaughtExceptionHandler(
                    CrashCleanupHandler(originalHandler, application)
                )
            }
        }
    }
}