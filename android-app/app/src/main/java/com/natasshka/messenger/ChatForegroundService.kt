package com.natasshka.messenger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class ChatForegroundService : Service() {

    companion object {
        private const val TAG = "ChatForegroundService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "chat_service_channel"
        private const val CHANNEL_NAME = "Фоновый сервис чата"

        private var isRunning = false

        fun isServiceRunning(): Boolean = isRunning

        fun startService(context: Context) {
            if (isRunning) {
                Log.d(TAG, "Service already running")
                return
            }

            Log.d(TAG, "Starting service...")

            try {
                val intent = Intent(context, ChatForegroundService::class.java)
                intent.action = "START_FOREGROUND"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Log.d(TAG, "Starting foreground service (API >= 26)")
                    context.startForegroundService(intent)
                } else {
                    Log.d(TAG, "Starting service (API < 26)")
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start service: ${e.message}")
                e.printStackTrace()
            }
        }

        fun stopService(context: Context) {
            if (!isRunning) {
                Log.d(TAG, "Service not running")
                return
            }

            Log.d(TAG, "Stopping service...")

            try {
                val intent = Intent(context, ChatForegroundService::class.java)
                intent.action = "STOP_FOREGROUND"
                context.stopService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop service: ${e.message}")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate()")
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service onStartCommand() with action: ${intent?.action}")

        when (intent?.action) {
            "START_FOREGROUND" -> {
                startForegroundService()
                // Отправляем broadcast о запуске сервиса
                sendServiceStatusBroadcast(true)
            }
            "STOP_FOREGROUND" -> {
                stopSelf()
            }
            else -> {
                startForegroundService()
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        Log.d(TAG, "Service onDestroy()")

        // Отправляем broadcast об остановке сервиса
        sendServiceStatusBroadcast(false)

        // Останавливаем все уведомления
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling notification: ${e.message}")
        }
    }

    private fun startForegroundService() {
        Log.d(TAG, "Starting foreground notification...")

        try {
            createNotificationChannel()

            val notificationIntent = Intent(this, MainActivity::class.java)
            notificationIntent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP

            val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.getActivity(
                    this,
                    0,
                    notificationIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
            } else {
                PendingIntent.getActivity(
                    this,
                    0,
                    notificationIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT
                )
            }

            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("NATaSSHka Chat")
                .setContentText("Чат активен в фоновом режиме")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setAutoCancel(false)
                .setWhen(System.currentTimeMillis())
                .build()

            startForeground(NOTIFICATION_ID, notification)
            Log.d(TAG, "Foreground service started successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}")
            e.printStackTrace()

            // Пытаемся остановить сервис в случае ошибки
            stopSelf()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Фоновый сервис для поддержания соединения с чатом"
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                    enableVibration(false)
                    enableLights(false)
                    setSound(null, null)
                }

                val notificationManager = getSystemService(NotificationManager::class.java)
                notificationManager.createNotificationChannel(channel)
                Log.d(TAG, "Notification channel created")
            } catch (e: Exception) {
                Log.e(TAG, "Error creating notification channel: ${e.message}")
            }
        }
    }

    private fun sendServiceStatusBroadcast(isRunning: Boolean) {
        try {
            val intent = Intent("com.natasshka.messenger.SERVICE_STATUS")
            intent.putExtra("isRunning", isRunning)
            intent.`package` = packageName
            sendBroadcast(intent)
            Log.d(TAG, "Service status broadcast sent: isRunning=$isRunning")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending broadcast: ${e.message}")
        }
    }
}