package com.natasshka.messenger

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.textfield.TextInputEditText

class LoginActivity : AppCompatActivity() {

    // Ключи для SharedPreferences
    private companion object {
        const val PREFS_NAME = "NATaSSHkaPrefs"
        const val KEY_SERVER = "server"
        const val KEY_USERNAME = "username"
        const val KEY_ROOM = "room"
    }

    // Счетчик неудачных попыток подключения
    private var connectionAttempts = 0
    private val MAX_CONNECTION_ATTEMPTS = 3

    // Регистрируем запрос разрешений
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, "Некоторые разрешения не предоставлены", Toast.LENGTH_LONG).show()
        }

        // После получения разрешений продолжаем работу
        findViewById<Button>(R.id.loginButton).isEnabled = true
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // Находим View через findViewById
        val serverInput = findViewById<TextInputEditText>(R.id.serverInput)
        val usernameInput = findViewById<TextInputEditText>(R.id.usernameInput)
        val roomInput = findViewById<TextInputEditText>(R.id.roomInput)
        val passwordInput = findViewById<TextInputEditText>(R.id.passwordInput)
        val loginButton = findViewById<Button>(R.id.loginButton)

        // Загружаем сохраненные данные
        loadSavedData(serverInput, usernameInput, roomInput)

        // Временно отключаем кнопку входа до получения разрешений
        loginButton.isEnabled = false

        // Запрашиваем разрешения
        requestPermissions()

        // Кнопка входа
        loginButton.setOnClickListener {
            performLogin(serverInput, usernameInput, roomInput, passwordInput)
        }

        // Обработка нажатия Enter в поле пароля
        passwordInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                performLogin(serverInput, usernameInput, roomInput, passwordInput)
                true
            } else {
                false
            }
        }

        // Фокус на поле сервера
        serverInput.requestFocus()

        // Показываем информационное сообщение о настройках
        showBatteryInfo()
    }

    private fun loadSavedData(
        serverInput: TextInputEditText,
        usernameInput: TextInputEditText,
        roomInput: TextInputEditText
    ) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        serverInput.setText(prefs.getString(KEY_SERVER, "http://10.0.2.2:3000"))
        usernameInput.setText(prefs.getString(KEY_USERNAME, ""))
        roomInput.setText(prefs.getString(KEY_ROOM, "Room_01"))
    }

    private fun saveData(
        server: String,
        username: String,
        room: String
    ) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()

        editor.putString(KEY_SERVER, server)
        editor.putString(KEY_USERNAME, username)
        editor.putString(KEY_ROOM, room)

        editor.apply()
    }

    private fun requestPermissions() {
        val requiredPermissions = mutableListOf<String>().apply {
            add(Manifest.permission.INTERNET)
            add(Manifest.permission.ACCESS_NETWORK_STATE)
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
            add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.RECORD_AUDIO)
            add(Manifest.permission.WAKE_LOCK)
            add(Manifest.permission.FOREGROUND_SERVICE)
            add(Manifest.permission.FOREGROUND_SERVICE_MICROPHONE)
            add(Manifest.permission.FOREGROUND_SERVICE_CAMERA)
            add(Manifest.permission.FOREGROUND_SERVICE_DATA_SYNC)
            add(Manifest.permission.RECEIVE_BOOT_COMPLETED)
            add(Manifest.permission.SCHEDULE_EXACT_ALARM)
            add(Manifest.permission.USE_EXACT_ALARM)
            add(Manifest.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.toTypedArray()

        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()

        if (missingPermissions.isNotEmpty()) {
            // Запрашиваем разрешения
            permissionLauncher.launch(missingPermissions)
        } else {
            // Разрешения уже есть, включаем кнопку
            findViewById<Button>(R.id.loginButton).isEnabled = true
        }
    }

    private fun showBatteryInfo() {
        // Показываем только один раз
        val prefs = getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val alreadyShown = prefs.getBoolean("battery_info_shown", false)

        if (!alreadyShown) {
            android.os.Handler(mainLooper).postDelayed({
                AlertDialog.Builder(this)
                    .setTitle("Для корректной работы уведомлений")
                    .setMessage(
                        """
                        Для получения уведомлений о новых сообщениях в фоновом режиме:
                        
                        1. Разрешите уведомления для этого приложения
                        2. Отключите оптимизацию батареи (если предложат)
                        3. Добавьте приложение в список исключений батареи
                        
                        Эти настройки можно изменить в настройках устройства.
                        """.trimIndent()
                    )
                    .setPositiveButton("Понятно") { dialog, _ ->
                        dialog.dismiss()
                        // Сохраняем, что показали
                        prefs.edit().putBoolean("battery_info_shown", true).apply()
                    }
                    .show()
            }, 2000)
        }
    }

    private fun performLogin(
        serverInput: TextInputEditText,
        usernameInput: TextInputEditText,
        roomInput: TextInputEditText,
        passwordInput: TextInputEditText
    ) {
        val server = serverInput.text.toString().trim()
        val username = usernameInput.text.toString().trim()
        val room = roomInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()

        // Валидация сервера
        if (server.isEmpty()) {
            serverInput.error = "Введите адрес сервера"
            return
        }

        // Валидация имени пользователя
        if (username.isEmpty()) {
            usernameInput.error = "Введите имя пользователя"
            return
        }

        // Проверка длины имени
        if (username.length > 16) {
            usernameInput.error = "Имя не должно превышать 16 символов"
            return
        }

        // Проверка на латинские символы, цифры и нижнее подчеркивание
        val usernameRegex = "^[a-zA-Z0-9_]+$".toRegex()
        if (!username.matches(usernameRegex)) {
            usernameInput.error = "Только латинские буквы, цифры и _ (без пробелов)"
            return
        }

        // Проверка пароля
        if (password.isEmpty()) {
            passwordInput.error = "Введите пароль"
            return
        }

        // Проверяем формат URL
        if (!server.startsWith("http://") && !server.startsWith("https://")) {
            serverInput.error = "URL должен начинаться с http:// или https://"
            return
        }

        // Очищаем ошибки
        serverInput.error = null
        usernameInput.error = null
        passwordInput.error = null

        // Сохраняем данные (кроме пароля)
        saveData(server, username, room)

        // Сбрасываем счетчик попыток
        connectionAttempts = 0

        // Передаем данные в MainActivity
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("server", server)
            putExtra("username", username)
            putExtra("room", if (room.isEmpty()) "Room_01" else room)
            putExtra("password", password)
        }
        startActivity(intent)
        finish()
    }

    // Метод для возврата из MainActivity при неудачном подключении
    fun handleConnectionFailure() {
        runOnUiThread {
            connectionAttempts++

            if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
                AlertDialog.Builder(this)
                    .setTitle("Ошибка подключения")
                    .setMessage("Не удалось подключиться к серверу после $MAX_CONNECTION_ATTEMPTS попыток.\nПроверьте адрес сервера и подключение к сети.")
                    .setPositiveButton("ОК") { dialog, _ ->
                        dialog.dismiss()
                        // Остаемся на этом экране
                    }
                    .show()
            }
        }
    }
}