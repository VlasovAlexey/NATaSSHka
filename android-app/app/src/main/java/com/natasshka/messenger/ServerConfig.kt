package com.natasshka.messenger

/**
 * Конфигурация серверов для всего приложения
 */
object ServerConfig {
    // Список серверов для проверки подключения
    val SERVERS_TO_CHECK = listOf(
        "http://217.25.238.37:3000/",
        "http://217.25.238.69:3000",
        "http://10.0.2.2:3000"
    )

    // Основной сервер по умолчанию (первый из списка)
    fun getDefaultServer(): String {
        return SERVERS_TO_CHECK.firstOrNull() ?: "http://10.0.2.2:3000"
    }

    // Получить список серверов как массив строк
    fun getServerList(): Array<String> {
        return SERVERS_TO_CHECK.toTypedArray()
    }
}