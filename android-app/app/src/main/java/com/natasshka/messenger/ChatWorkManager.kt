package com.natasshka.messenger

import android.content.Context
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
            checkChatConnection()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
    private suspend fun checkChatConnection() {
        delay(5000)
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
                return
            }
            val workRequest = PeriodicWorkRequestBuilder<ChatWorkManager>(
                15, TimeUnit.MINUTES
            )
                .addTag("chat_maintenance")
                .setInitialDelay(1, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        }
        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}