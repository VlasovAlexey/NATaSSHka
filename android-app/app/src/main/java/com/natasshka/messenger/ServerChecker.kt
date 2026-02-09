package com.natasshka.messenger

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

object ServerChecker {
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    suspend fun getAllAvailableServers(): List<String> {
        return withContext(Dispatchers.IO) {
            val availableServers = mutableListOf<String>()

            // Используем статический список из ServerConfig
            ServerConfig.SERVERS_TO_CHECK.forEach { serverUrl ->
                try {
                    val request = Request.Builder()
                        .url("$serverUrl/health")
                        .get()
                        .build()

                    val response = client.newCall(request).execute()
                    if (response.isSuccessful) {
                        availableServers.add(serverUrl)
                        Log.d("ServerChecker", "Server $serverUrl is available")
                    }
                    response.close()
                } catch (e: Exception) {
                    Log.d("ServerChecker", "Server $serverUrl is not available: ${e.message}")
                }
            }

            // Если нет доступных серверов, проверяем основной endpoint
            if (availableServers.isEmpty()) {
                ServerConfig.SERVERS_TO_CHECK.forEach { serverUrl ->
                    try {
                        val request = Request.Builder()
                            .url(serverUrl)
                            .get()
                            .build()

                        val response = client.newCall(request).execute()
                        if (response.isSuccessful) {
                            availableServers.add(serverUrl)
                            Log.d("ServerChecker", "Server $serverUrl is available (root)")
                        }
                        response.close()
                    } catch (e: Exception) {
                        Log.d("ServerChecker", "Server $serverUrl is not available (root): ${e.message}")
                    }
                }
            }

            availableServers
        }
    }

    suspend fun checkSpecificServer(serverUrl: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/health")
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                val isAvailable = response.isSuccessful
                response.close()

                if (!isAvailable) {
                    // Попробуем корневой endpoint
                    val rootRequest = Request.Builder()
                        .url(serverUrl)
                        .get()
                        .build()

                    val rootResponse = client.newCall(rootRequest).execute()
                    val rootAvailable = rootResponse.isSuccessful
                    rootResponse.close()

                    return@withContext rootAvailable
                }

                isAvailable
            } catch (e: Exception) {
                false
            }
        }
    }
}