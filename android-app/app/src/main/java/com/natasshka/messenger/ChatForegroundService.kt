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
import androidx.core.app.NotificationCompat

class ChatForegroundService : Service() {
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "chat_service_channel"
        private const val CHANNEL_NAME = "Фоновый сервис чата"
        private var isRunning = false
        fun isServiceRunning(): Boolean = isRunning
        fun startService(context: Context) {
            if (isRunning) {
                return
            }
            try {
                val intent = Intent(context, ChatForegroundService::class.java)
                intent.action = "START_FOREGROUND"
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
            }
        }
        fun stopService(context: Context) {
            if (!isRunning) {
                return
            }
            try {
                val intent = Intent(context, ChatForegroundService::class.java)
                intent.action = "STOP_FOREGROUND"
                context.stopService(intent)
            } catch (e: Exception) {
            }
        }
    }
    override fun onCreate() {
        super.onCreate()
        isRunning = true
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START_FOREGOUND" -> {
                startForegroundService()
                sendServiceStatusBroadcast(true)
            }
            "STOP_FOREGOUND" -> {
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
        sendServiceStatusBroadcast(false)
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
        }
    }
    private fun startForegroundService() {
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
        } catch (e: Exception) {
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
            } catch (e: Exception) {
            }
        }
    }
    private fun sendServiceStatusBroadcast(isRunning: Boolean) {
        try {
            val intent = Intent("com.natasshka.messenger.SERVICE_STATUS")
            intent.putExtra("isRunning", isRunning)
            intent.`package` = packageName
            sendBroadcast(intent)
        } catch (e: Exception) {
        }
    }
}