package com.natasshka.messenger
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
class ScreenStateReceiver : BroadcastReceiver() {
    companion object {
        private var isScreenOn = true
        private var isDeviceLocked = false
        fun isScreenOn(): Boolean = isScreenOn
        fun isDeviceLocked(): Boolean = isDeviceLocked
    }
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SCREEN_ON -> {
                Log.d("ScreenStateReceiver", "Screen ON")
                isScreenOn = true
                ChatForegroundService.startService(context)
                updateBackgroundState(context)
            }
            Intent.ACTION_SCREEN_OFF -> {
                Log.d("ScreenStateReceiver", "Screen OFF")
                isScreenOn = false
                isDeviceLocked = true
                updateBackgroundState(context)
            }
            Intent.ACTION_USER_PRESENT -> {
                Log.d("ScreenStateReceiver", "Device unlocked")
                isDeviceLocked = false
                updateBackgroundState(context)
            }
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.d("ScreenStateReceiver", "Boot completed")
                ChatForegroundService.startService(context)
            }
        }
    }
    private fun updateBackgroundState(context: Context) {
        val appState = when {
            !isScreenOn && isDeviceLocked -> "Экран выключен, устройство заблокировано"
            !isScreenOn -> "Экран выключен"
            isDeviceLocked -> "Устройство заблокировано"
            else -> "Устройство разблокировано"
        }
        val prefs = context.getSharedPreferences("ChatState", Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean("isScreenOn", isScreenOn)
            .putBoolean("isDeviceLocked", isDeviceLocked)
            .putString("appState", appState)
            .apply()
    }
}