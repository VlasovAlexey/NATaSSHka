package com.natasshka.messenger
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.*
import java.util.concurrent.TimeUnit
class LoginActivity : AppCompatActivity() {
    private companion object {
        const val PREFS_NAME = "NATaSSHkaPrefs"
        const val KEY_SERVER = "server"
        const val KEY_USERNAME = "username"
        const val KEY_ROOM = "room"
        const val KEY_SERVER_CHECKED = "server_checked"
        const val KEY_AUTO_SERVER = "auto_server"
    }
    private lateinit var serverLayout: TextInputLayout
    private lateinit var serverInput: TextInputEditText
    private lateinit var usernameLayout: TextInputLayout
    private lateinit var usernameInput: TextInputEditText
    private lateinit var roomLayout: TextInputLayout
    private lateinit var roomInput: TextInputEditText
    private lateinit var passwordLayout: TextInputLayout
    private lateinit var passwordInput: TextInputEditText
    private lateinit var loginButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var statusText: TextView
    private val coroutineScope = MainScope()
    private var serverCheckJob: Job? = null
    private var autoDetectedServer: String? = null
    private var isServerChecked = false
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, "Некоторые разрешения не предоставлены", Toast.LENGTH_LONG).show()
        }
        enableLoginButtonIfReady()
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_NATaSSHka)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        findViews()
        initializeUI()
        loadSavedData()
        checkSavedServer()
        requestPermissions()
    }

    private fun findViews() {
        serverLayout = findViewById(R.id.serverLayout)
        serverInput = findViewById(R.id.serverInput)
        usernameLayout = findViewById(R.id.usernameLayout)
        usernameInput = findViewById(R.id.usernameInput)
        roomLayout = findViewById(R.id.roomLayout)
        roomInput = findViewById(R.id.roomInput)
        passwordLayout = findViewById(R.id.passwordLayout)
        passwordInput = findViewById(R.id.passwordInput)
        loginButton = findViewById(R.id.loginButton)
        progressBar = findViewById(R.id.progressBar)
        statusText = findViewById(R.id.statusText)
    }
    private fun initializeUI() {
        serverLayout.visibility = android.view.View.GONE
        usernameLayout.visibility = android.view.View.GONE
        roomLayout.visibility = android.view.View.GONE
        passwordLayout.visibility = android.view.View.GONE
        loginButton.visibility = android.view.View.GONE
        progressBar.visibility = android.view.View.VISIBLE
        statusText.visibility = android.view.View.VISIBLE
        statusText.text = "Проверка доступности серверов..."
        loginButton.isEnabled = false
    }
    private fun loadSavedData() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        serverInput.setText(prefs.getString(KEY_SERVER, ""))
        usernameInput.setText(prefs.getString(KEY_USERNAME, ""))
        roomInput.setText(prefs.getString(KEY_ROOM, "Room_01"))
        autoDetectedServer = prefs.getString(KEY_AUTO_SERVER, null)
    }
    private fun checkSavedServer() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val serverChecked = prefs.getBoolean(KEY_SERVER_CHECKED, false)
        val savedServer = prefs.getString(KEY_SERVER, "")
        if (serverChecked && !savedServer.isNullOrEmpty()) {
            coroutineScope.launch {
                checkSingleServer(savedServer)
            }
        } else {
            checkAllServers()
        }
    }
    private fun checkAllServers() {
        serverCheckJob = coroutineScope.launch {
            try {
                withTimeout(TimeUnit.SECONDS.toMillis(10)) {
                    val availableServers = ServerChecker.getAllAvailableServers()
                    withContext(Dispatchers.Main) {
                        handleServerCheckResults(availableServers)
                    }
                }
            } catch (e: TimeoutCancellationException) {
                withContext(Dispatchers.Main) {
                    handleServerCheckFailed("Таймаут проверки серверов")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    handleServerCheckFailed("Ошибка проверки серверов")
                }
            }
        }
    }
    private suspend fun checkSingleServer(serverUrl: String) {
        try {
            val isAvailable = ServerChecker.checkSpecificServer(serverUrl)
            withContext(Dispatchers.Main) {
                if (isAvailable) {
                    autoDetectedServer = serverUrl
                    hideServerField()
                    showLoginFields()
                    saveServerInfo(serverUrl, true)
                    isServerChecked = true
                    enableLoginButtonIfReady()
                } else {
                    checkAllServers()
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                checkAllServers()
            }
        }
    }
    private fun handleServerCheckResults(availableServers: List<String>) {
        progressBar.visibility = android.view.View.GONE
        when {
            availableServers.isEmpty() -> {
                statusText.text = "Серверы недоступны. Введите адрес вручную."
                showAllFields()
            }
            availableServers.size == 1 -> {
                val serverUrl = availableServers.first()
                autoDetectedServer = serverUrl
                hideServerField()
                showLoginFields()
                saveServerInfo(serverUrl, true)
                isServerChecked = true
                enableLoginButtonIfReady()
            }
            else -> {
                val serverUrl = availableServers.first()
                autoDetectedServer = serverUrl
                hideServerField()
                showLoginFields()
                saveServerInfo(serverUrl, true)
                isServerChecked = true
                enableLoginButtonIfReady()
                if (availableServers.size > 1) {
                    showServerSelectionDialog(availableServers)
                }
            }
        }
    }
    private fun handleServerCheckFailed(errorMessage: String) {
        progressBar.visibility = android.view.View.GONE
        statusText.text = errorMessage
        showAllFields()
        isServerChecked = true
        enableLoginButtonIfReady()
    }
    private fun hideStatusMessage() {
        statusText.visibility = android.view.View.GONE
    }
    private fun getServerName(serverUrl: String): String {
        return when {
            serverUrl.contains("10.0.2.2") -> "Локальный сервер"
            serverUrl.contains("217.25.238.69") -> "Публичный сервер"
            else -> "Сервер ${serverUrl.substringAfter("://").substringBefore(":")}"
        }
    }
    private fun showServerSelectionDialog(availableServers: List<String>) {
        val serverNames = availableServers.map { getServerName(it) }
        AlertDialog.Builder(this)
            .setTitle("Выбор сервера")
            .setMessage("Доступно несколько серверов. Выберите предпочтительный:")
            .setItems(serverNames.toTypedArray()) { dialog, which ->
                val selectedServer = availableServers[which]
                autoDetectedServer = selectedServer
                saveServerInfo(selectedServer, true)
                dialog.dismiss()
            }
            .setNegativeButton("Оставить текущий") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
    private fun showAllFields() {
        progressBar.visibility = android.view.View.GONE
        hideStatusMessage()
        serverLayout.visibility = android.view.View.VISIBLE
        usernameLayout.visibility = android.view.View.VISIBLE
        roomLayout.visibility = android.view.View.VISIBLE
        passwordLayout.visibility = android.view.View.VISIBLE
        loginButton.visibility = android.view.View.VISIBLE
        isServerChecked = true
        enableLoginButtonIfReady()
    }
    private fun hideServerField() {
        serverLayout.visibility = android.view.View.GONE
        hideStatusMessage()
    }
    private fun showLoginFields() {
        progressBar.visibility = android.view.View.GONE
        hideStatusMessage()
        usernameLayout.visibility = android.view.View.VISIBLE
        roomLayout.visibility = android.view.View.VISIBLE
        passwordLayout.visibility = android.view.View.VISIBLE
        loginButton.visibility = android.view.View.VISIBLE
        isServerChecked = true
        enableLoginButtonIfReady()
    }
    private fun enableLoginButtonIfReady() {
        val hasPermissions = checkIfPermissionsGranted()
        val shouldEnable = isServerChecked && hasPermissions
        loginButton.isEnabled = shouldEnable
        Log.d("LoginActivity", "isServerChecked: $isServerChecked, hasPermissions: $hasPermissions, shouldEnable: $shouldEnable")
    }
    private fun checkIfPermissionsGranted(): Boolean {
        val requiredPermissions = mutableListOf<String>().apply {
            add(Manifest.permission.INTERNET)
            add(Manifest.permission.ACCESS_NETWORK_STATE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.toTypedArray()
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }
    private fun saveServerInfo(serverUrl: String, isChecked: Boolean) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        editor.putString(KEY_SERVER, serverUrl)
        editor.putBoolean(KEY_SERVER_CHECKED, isChecked)
        editor.putString(KEY_AUTO_SERVER, serverUrl)
        editor.apply()
    }
    private fun requestPermissions() {
        val requiredPermissions = mutableListOf<String>().apply {
            add(Manifest.permission.INTERNET)
            add(Manifest.permission.ACCESS_NETWORK_STATE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }.toTypedArray()
        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()
        if (missingPermissions.isNotEmpty()) {
            permissionLauncher.launch(missingPermissions)
        } else {
            enableLoginButtonIfReady()
        }
    }
    private fun performLogin() {
        if (!loginButton.isEnabled) {
            Toast.makeText(this, "Подождите завершения инициализации", Toast.LENGTH_SHORT).show()
            return
        }
        val server = if (serverLayout.visibility == android.view.View.VISIBLE) {
            serverInput.text.toString().trim()
        } else {
            autoDetectedServer ?: ""
        }
        val username = usernameInput.text.toString().trim()
        val room = roomInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()
        if (serverLayout.visibility == android.view.View.VISIBLE) {
            if (server.isEmpty()) {
                serverInput.error = "Введите адрес сервера"
                return
            }
            if (!server.startsWith("http://") && !server.startsWith("https://")) {
                serverInput.error = "URL должен начинаться с http:// или https://"
                return
            }
        } else if (autoDetectedServer.isNullOrEmpty()) {
            Toast.makeText(this, "Сервер не найден", Toast.LENGTH_SHORT).show()
            return
        }
        if (username.isEmpty()) {
            usernameInput.error = "Введите имя пользователя"
            return
        }
        if (username.length > 16) {
            usernameInput.error = "Имя не должно превышать 16 символов"
            return
        }
        val usernameRegex = "^[a-zA-Z0-9_]+$".toRegex()
        if (!username.matches(usernameRegex)) {
            usernameInput.error = "Только латинские буквы, цифры и _ (без пробелов)"
            return
        }
        if (room.isEmpty()) {
            roomInput.error = "Введите название комнаты"
            return
        }
        if (room.length > 16) {
            roomInput.error = "Название комнаты не должно превышать 16 символов"
            return
        }
        val roomRegex = "^[a-zA-Z0-9_]+$".toRegex()
        if (!room.matches(roomRegex)) {
            roomInput.error = "Только латинские буквы, цифры и _ (без пробелов)"
            return
        }
        if (password.isEmpty()) {
            passwordInput.error = "Введите пароль"
            return
        }
        serverInput.error = null
        usernameInput.error = null
        roomInput.error = null
        passwordInput.error = null
        saveData(server, username, room)
        loginButton.isEnabled = false
        loginButton.text = "Подключение..."
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("server", server)
            putExtra("username", username)
            putExtra("room", room)
            putExtra("password", password)
        }
        startActivity(intent)
        finish()
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
    override fun onResume() {
        super.onResume()
        loginButton.setOnClickListener {
            performLogin()
        }
        passwordInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                performLogin()
                true
            } else {
                false
            }
        }
        if (usernameLayout.visibility == android.view.View.VISIBLE) {
            usernameInput.requestFocus()
        }
    }
    override fun onDestroy() {
        super.onDestroy()
        serverCheckJob?.cancel()
        coroutineScope.cancel()
    }
}