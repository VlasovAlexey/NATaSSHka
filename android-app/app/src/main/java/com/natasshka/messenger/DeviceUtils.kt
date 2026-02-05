package com.natasshka.messenger

import android.content.Context
import android.os.Build
import android.os.PowerManager

object DeviceUtils {
    fun logDeviceInfo() {
    }
    fun checkBatteryOptimization(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            false
        }
    }
}