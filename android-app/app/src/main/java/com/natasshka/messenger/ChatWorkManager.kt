package com.natasshka.messenger

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.delay
import java.util.concurrent.TimeUnit

class ChatWorkManager(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            // Проверяем состояние чата и переподключаемся если нужно
            checkChatConnection()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private suspend fun checkChatConnection() {
        // Здесь можно добавить логику проверки соединения
        // и переподключения к серверу
        delay(5000) // Имитация работы
    }

    companion object {
        private const val WORK_NAME = "chat_background_work"

        fun isWorkScheduled(context: Context): Boolean {
            val workManager = WorkManager.getInstance(context)
            val workInfos = workManager.getWorkInfosForUniqueWork(WORK_NAME).get()

            return workInfos.any { workInfo ->
                workInfo.state == WorkInfo.State.RUNNING ||
                        workInfo.state == WorkInfo.State.ENQUEUED
            }
        }

        fun start(context: Context) {
            if (isWorkScheduled(context)) {
                Log.d("ChatWorkManager", "Work already scheduled, skipping...")
                return
            }

            val workRequest = PeriodicWorkRequestBuilder<ChatWorkManager>(
                15, TimeUnit.MINUTES // Каждые 15 минут
            )
                .addTag("chat_maintenance")
                .setInitialDelay(1, TimeUnit.MINUTES) // Задержка перед первым запуском
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP, // Сохраняем существующую работу
                workRequest
            )

            Log.d("ChatWorkManager", "Background work scheduled")
        }

        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d("ChatWorkManager", "Background work cancelled")
        }
    }
}