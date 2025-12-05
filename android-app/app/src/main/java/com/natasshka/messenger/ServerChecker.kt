package com.natasshka.messenger

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

object ServerChecker {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .build()

    suspend fun getAllAvailableServers(): List<String> = withContext(Dispatchers.IO) {
        val serversToCheck = listOf(
            "http://10.0.2.2:3000",
            "http://217.25.238.69:3000"
        )

        val availableServers = mutableListOf<String>()

        serversToCheck.forEach { serverUrl ->
            if (checkServer(serverUrl)) {
                availableServers.add(serverUrl)
            }
        }

        return@withContext availableServers
    }

    suspend fun checkSpecificServer(serverUrl: String): Boolean = withContext(Dispatchers.IO) {
        return@withContext checkServer(serverUrl)
    }

    private fun checkServer(serverUrl: String): Boolean {
        return try {
            val request = Request.Builder()
                .url("$serverUrl")
                .get()
                .build()

            val response = client.newCall(request).execute()
            response.isSuccessful || response.code in 200..399
        } catch (e: Exception) {
            false
        }
    }
}