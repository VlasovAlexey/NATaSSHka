package com.natasshka.messenger

import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.util.Log

object DeviceUtils {

    private const val TAG = "DeviceUtils"

    fun logDeviceInfo() {
        Log.d(TAG, "Device Info:")
        Log.d(TAG, "Manufacturer: ${Build.MANUFACTURER}")
        Log.d(TAG, "Brand: ${Build.BRAND}")
        Log.d(TAG, "Model: ${Build.MODEL}")
        Log.d(TAG, "Device: ${Build.DEVICE}")
        Log.d(TAG, "SDK: ${Build.VERSION.SDK_INT}")
        Log.d(TAG, "Release: ${Build.VERSION.RELEASE}")
    }

    fun checkBatteryOptimization(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            false
        }
    }

    fun isXiaomiDevice(): Boolean {
        return Build.MANUFACTURER.equals("xiaomi", ignoreCase = true) ||
                Build.MANUFACTURER.equals("redmi", ignoreCase = true)
    }

    fun isHyperOS(): Boolean {
        return try {
            val properties = System.getProperties()
            properties.getProperty("ro.miui.ui.version.name", "").contains("hyper", ignoreCase = true)
        } catch (e: Exception) {
            false
        }
    }
}