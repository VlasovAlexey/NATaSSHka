package com.natasshka.messenger

import android.Manifest
import android.app.Activity
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.natasshka.messenger.databinding.ActivityMainBinding
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONArray
import org.json.JSONObject
import java.net.URISyntaxException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var messagesAdapter: MessagesAdapter
    private var socket: Socket? = null
    private var currentUser: String = ""
    private var currentRoom: String = "Room_01"
    private var isConnected = false
    private var pendingLoginData: Triple<String, String, String>? = null // username, room, password

    private var isAppInBackground = false
    private var isDeviceLocked = false

    private lateinit var serviceStatusReceiver: BroadcastReceiver

    private var connectionAttempts = 0
    private val MAX_CONNECTION_ATTEMPTS = 3
    private val RECONNECT_DELAY = 1000L // 1 секунда

    // Регистрируем запрос разрешений
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, "Некоторые разрешения не предоставлены", Toast.LENGTH_LONG).show()
        }

        // После получения разрешений выполняем отложенный вход
        pendingLoginData?.let { (username, room, password) ->
            connectToServer(username, room, password)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Сбрасываем счетчик попыток
        connectionAttempts = 0

        // Логируем информацию об устройстве
        logDeviceInfo()

        // Получаем данные из LoginActivity
        val server = intent.getStringExtra("server") ?: ""
        val username = intent.getStringExtra("username") ?: ""
        val room = intent.getStringExtra("room") ?: "Room_01"
        val password = intent.getStringExtra("password") ?: ""

        if (server.isEmpty() || username.isEmpty() || password.isEmpty()) {
            // Если данные не переданы, возвращаемся к LoginActivity
            Toast.makeText(this, "Данные для входа не получены", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        currentUser = username
        currentRoom = room
        pendingLoginData = Triple(username, room, password)

        setupUI()
        setupKeyboardBehavior()
        setupServiceMonitoring()
        setupBackgroundMonitoring()
        checkBatteryOptimization()
        requestPermissions()
    }

    private fun setupUI() {
        // Настройка RecyclerView для сообщений
        messagesAdapter = MessagesAdapter()
        binding.messagesRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = messagesAdapter
        }

        // Настройка поля ввода сообщения
        setupMessageInput()

        // Обработчики кнопок
        binding.sidebarToggleBtn.setOnClickListener {
            toggleSidebar()
        }

        binding.sendMessageBtn.setOnClickListener {
            sendMessage()
        }

        binding.attachFileBtn.setOnClickListener {
            Toast.makeText(this, "Отправка файлов будет добавлена позже", Toast.LENGTH_SHORT).show()
        }

        binding.recordAudioBtn.setOnClickListener {
            Toast.makeText(this, "Запись аудио будет добавлена позже", Toast.LENGTH_SHORT).show()
        }

        binding.recordVideoBtn.setOnClickListener {
            Toast.makeText(this, "Запись видео будет добавлена позже", Toast.LENGTH_SHORT).show()
        }

        binding.audioCallBtn.setOnClickListener {
            Toast.makeText(this, "Аудиозвонки будут добавлены позже", Toast.LENGTH_SHORT).show()
        }

        binding.videoCallBtn.setOnClickListener {
            Toast.makeText(this, "Видеозвонки будут добавлены позже", Toast.LENGTH_SHORT).show()
        }

        // Очистка поля ключа шифрования
        binding.encryptionKeyLayout.setEndIconOnClickListener {
            binding.encryptionKeyInput.text?.clear()
        }

        // Показываем системное сообщение о запуске
        addSystemMessage("Приложение запущено. Подключаемся к серверу...")
    }

    private fun setupKeyboardBehavior() {
        // Настраиваем поведение клавиатуры как в Telegram
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        // Скрываем клавиатуру при клике вне поля ввода
        binding.root.setOnClickListener {
            hideKeyboard()
        }

        // Но не скрываем при клике на само поле ввода
        binding.messageInput.setOnClickListener {
            // Ничего не делаем - клавиатура должна остаться
        }
    }

    private fun setupServiceMonitoring() {
        // Создаем BroadcastReceiver для отслеживания статуса сервиса
        serviceStatusReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == "com.natasshka.messenger.SERVICE_STATUS") {
                    val isRunning = intent.getBooleanExtra("isRunning", false)

                    runOnUiThread {
                        val statusText = if (isRunning) {
                            "✅ Фоновый сервис успешно запущен"
                        } else {
                            "❌ Фоновый сервис остановлен"
                        }
                        addSystemMessage(statusText)
                        Log.d("MainActivity", "Service status: $statusText")
                    }

                    // Сохраняем статус в SharedPreferences
                    val prefs = getSharedPreferences("ServiceStatus", Context.MODE_PRIVATE)
                    prefs.edit().putBoolean("isServiceRunning", isRunning).apply()
                }
            }
        }

        // Регистрируем receiver
        val filter = IntentFilter("com.natasshka.messenger.SERVICE_STATUS")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            registerReceiver(serviceStatusReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(serviceStatusReceiver, filter)
        }
    }

    private fun setupBackgroundMonitoring() {
        Log.d("MainActivity", "Setting up background monitoring...")

        // Проверяем настройки устройства
        if (isXiaomiDevice()) {
            addSystemMessage("⚠️ Обнаружено устройство Xiaomi")
            addSystemMessage("Для работы в фоне может потребоваться дополнительная настройка")
        }

        // Проверяем оптимизацию батареи
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                addSystemMessage("⚠️ Для работы фонового сервиса отключите оптимизацию батареи")
            }
        }

        // Запускаем foreground service с задержкой
        android.os.Handler(mainLooper).postDelayed({
            //addSystemMessage("Запуск фонового сервиса...")
            ChatForegroundService.startService(this)

            // Проверяем статус через 3 секунды
            android.os.Handler(mainLooper).postDelayed({
                checkServiceStatus()
            }, 3000)
        }, 1000)

        // Регистрируем слушатель изменений видимости приложения
        registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                isAppInBackground = false
                updateBackgroundStatusMessage()
                Log.d("MainActivity", "App in foreground")
            }

            override fun onActivityPaused(activity: Activity) {
                isAppInBackground = true
                updateBackgroundStatusMessage()
                Log.d("MainActivity", "App in background")
            }

            // Остальные методы можно оставить пустыми
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })

        // Проверяем текущее состояние экрана
        checkScreenState()
    }

    private fun logDeviceInfo() {
        Log.d("MainActivity", "=== Device Information ===")
        Log.d("MainActivity", "Manufacturer: ${Build.MANUFACTURER}")
        Log.d("MainActivity", "Brand: ${Build.BRAND}")
        Log.d("MainActivity", "Model: ${Build.MODEL}")
        Log.d("MainActivity", "Device: ${Build.DEVICE}")
        Log.d("MainActivity", "SDK: ${Build.VERSION.SDK_INT}")
        Log.d("MainActivity", "Release: ${Build.VERSION.RELEASE}")

        // Проверяем HyperOS
        try {
            val properties = System.getProperties()
            val miuiVersion = properties.getProperty("ro.miui.ui.version.name", "")
            Log.d("MainActivity", "MIUI Version: $miuiVersion")
            if (miuiVersion.contains("hyper", ignoreCase = true)) {
                Log.d("MainActivity", "HyperOS detected")
                addSystemMessage("Обнаружен HyperOS ${Build.VERSION.RELEASE}")
            }
        } catch (e: Exception) {
            Log.d("MainActivity", "Cannot get MIUI version: ${e.message}")
        }
    }

    private fun isXiaomiDevice(): Boolean {
        return Build.MANUFACTURER.equals("xiaomi", ignoreCase = true) ||
                Build.MANUFACTURER.equals("redmi", ignoreCase = true) ||
                Build.BRAND.equals("xiaomi", ignoreCase = true) ||
                Build.BRAND.equals("redmi", ignoreCase = true)
    }

    private fun checkServiceStatus() {
        // Проверяем статус сервиса через SharedPreferences
        val prefs = getSharedPreferences("ServiceStatus", Context.MODE_PRIVATE)
        val isServiceRunning = prefs.getBoolean("isServiceRunning", false)

        if (!isServiceRunning) {
            Log.w("MainActivity", "Service not running, attempting restart...")
            addSystemMessage("⚠️ Фоновый сервис не запущен. Пытаемся перезапустить...")

            // Пробуем перезапустить сервис
            android.os.Handler(mainLooper).postDelayed({
                ChatForegroundService.startService(this)

                // Проверяем еще раз через 2 секунды
                android.os.Handler(mainLooper).postDelayed({
                    val currentStatus = prefs.getBoolean("isServiceRunning", false)
                    if (!currentStatus) {
                        addSystemMessage("❌ Не удалось запустить фоновый сервис")
                        showServiceErrorDialog()
                    }
                }, 2000)
            }, 1000)
        } else {
            Log.d("MainActivity", "Service is running")
            //addSystemMessage("✅ Фоновый сервис активен")
        }
    }

    private fun showServiceErrorDialog() {
        AlertDialog.Builder(this)
            .setTitle("Проблема с фоновым сервисом")
            .setMessage(
                """
                Не удалось запустить фоновый сервис. Возможные причины:
                
                1. Агрессивная оптимизация батареи
                2. Ограничения производителя устройства
                3. Отсутствие необходимых разрешений
                
                Рекомендуемые действия:
                1. Откройте настройки батареи
                2. Найдите "NATaSSHka" в списке приложений
                3. Выберите "Без ограничений" или "Не оптимизировать"
                
                Открыть настройки батареи сейчас?
                """.trimIndent()
            )
            .setPositiveButton("Открыть настройки") { dialog, _ ->
                dialog.dismiss()
                openBatteryOptimizationSettings()
            }
            .setNegativeButton("Пропустить") { dialog, _ ->
                dialog.dismiss()
                addSystemMessage("Фоновый сервис отключен. Уведомления могут не работать.")
            }
            .setNeutralButton("Перезапустить") { dialog, _ ->
                dialog.dismiss()
                addSystemMessage("Попытка повторного запуска сервиса...")
                ChatForegroundService.startService(this)
                android.os.Handler(mainLooper).postDelayed({
                    checkServiceStatus()
                }, 2000)
            }
            .show()
    }

    private fun checkBatteryOptimization() {
        // Проверяем оптимизацию батареи для Android 6.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(packageName)

            if (!isIgnoringBatteryOptimizations) {
                // Показываем информационное сообщение
                android.os.Handler(mainLooper).postDelayed({
                    showBatteryOptimizationDialog()
                }, 3000)
            }
        }
    }

    private fun showBatteryOptimizationDialog() {
        // Показываем только если не показывали ранее
        val prefs = getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val alreadyShown = prefs.getBoolean("battery_warning_shown", false)

        if (!alreadyShown) {
            AlertDialog.Builder(this)
                .setTitle("Оптимизация батареи")
                .setMessage(
                    """
                    Для корректной работы уведомлений в фоновом режиме рекомендуется отключить оптимизацию батареи для этого приложения.
                    
                    Это позволит:
                    • Получать уведомления о новых сообщениях
                    • Поддерживать соединение с сервером
                    • Работать в фоновом режиме
                    
                    Хотите открыть настройки сейчас?
                    """.trimIndent()
                )
                .setPositiveButton("Открыть настройки") { dialog, _ ->
                    dialog.dismiss()
                    openBatteryOptimizationSettings()
                    prefs.edit().putBoolean("battery_warning_shown", true).apply()
                }
                .setNegativeButton("Позже") { dialog, _ ->
                    dialog.dismiss()
                    addSystemMessage("Рекомендуем отключить оптимизацию батареи для корректной работы")
                }
                .setNeutralButton("Больше не показывать") { dialog, _ ->
                    dialog.dismiss()
                    prefs.edit().putBoolean("battery_warning_shown", true).apply()
                }
                .show()
        }
    }

    private fun openBatteryOptimizationSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } catch (e: Exception) {
                try {
                    // Альтернативный способ
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    intent.data = Uri.parse("package:$packageName")
                    startActivity(intent)
                } catch (e2: Exception) {
                    Toast.makeText(this, "Откройте настройки приложения вручную", Toast.LENGTH_LONG).show()
                    addSystemMessage("Откройте: Настройки → Приложения → NATaSSHka → Батарея → Без ограничений")
                }
            }
        } else {
            Toast.makeText(this, "Откройте настройки приложения вручную", Toast.LENGTH_LONG).show()
        }
    }

    private fun checkScreenState() {
        val prefs = getSharedPreferences("ChatState", Context.MODE_PRIVATE)
        isDeviceLocked = prefs.getBoolean("isDeviceLocked", false)
        val isScreenOn = prefs.getBoolean("isScreenOn", true)

        if (!isScreenOn) {
            //addSystemMessage("Приложение работает в фоновом режиме (экран выключен)")
        } else if (isDeviceLocked) {
            addSystemMessage("Приложение работает на заблокированном экране")
        }
    }

    private fun updateBackgroundStatusMessage() {
        val state = when {
            isDeviceLocked && !isAppInBackground -> "Экран заблокирован, приложение активно"
            isDeviceLocked && isAppInBackground -> "Экран заблокирован, приложение в фоне"
            !isDeviceLocked && isAppInBackground -> "Приложение работает в фоновом режиме"
            else -> "Приложение активно на переднем плане"
        }

        // Обновляем информацию в UI если нужно
        runOnUiThread {
            Log.d("MainActivity", "App state: $state")
        }
    }

    private fun setupMessageInput() {
        // Делаем поле ввода однострочным
        binding.messageInput.maxLines = 1
        binding.messageInput.isSingleLine = true
        binding.messageInput.imeOptions = EditorInfo.IME_ACTION_SEND
        binding.messageInput.setRawInputType(InputType.TYPE_CLASS_TEXT)

        binding.messageInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val hasText = s?.isNotEmpty() == true
                binding.sendMessageBtn.visibility = if (hasText) View.VISIBLE else View.GONE
                binding.recordButtonsContainer.visibility = if (hasText) View.GONE else View.VISIBLE
            }
        })

        // Отправка по Enter/нажатию кнопки отправки на клавиатуре
        binding.messageInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendMessage()
                hideKeyboard()
                true
            } else {
                false
            }
        }

        // Автоматически показываем клавиатуру при фокусе
        binding.messageInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                showKeyboard()
            }
        }
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
            // Разрешения уже есть, выполняем отложенный вход
            pendingLoginData?.let { (username, room, password) ->
                connectToServer(username, room, password)
            }
        }
    }

    private fun connectToServer(username: String, room: String, password: String) {
        try {
            Log.d("MainActivity", "Connecting to server...")

            // Получаем server из intent
            val server = intent.getStringExtra("server") ?: "http://10.0.2.2:3000"
            Log.d("MainActivity", "Server URL: $server")

            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                reconnectionAttempts = Int.MAX_VALUE
                // Добавляем таймауты
                timeout = 10000 // Увеличиваем таймаут до 10 секунд
            }

            socket = IO.socket(server, options)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("MainActivity", "Socket connected")
                runOnUiThread {
                    // Сбрасываем счетчик при успешном подключении
                    connectionAttempts = 0
                    Toast.makeText(this@MainActivity, "✅ Подключено к серверу", Toast.LENGTH_SHORT).show()
                    isConnected = true
                    joinRoom(username, room, password)
                }
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e("MainActivity", "Socket connection error: ${args.joinToString()}")
                runOnUiThread {
                    connectionAttempts++

                    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
                        Toast.makeText(
                            this@MainActivity,
                            "❌ Не удалось подключиться после $MAX_CONNECTION_ATTEMPTS попыток",
                            Toast.LENGTH_LONG
                        ).show()

                        // Возвращаемся на экран входа
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("Ошибка подключения")
                            .setMessage("Не удалось подключиться к серверу. Проверьте адрес сервера и подключение к сети.")
                            .setPositiveButton("Вернуться") { dialog, _ ->
                                dialog.dismiss()
                                finish() // Возвращаемся на LoginActivity
                            }
                            .setCancelable(false)
                            .show()
                    } else {
                        Toast.makeText(
                            this@MainActivity,
                            "❌ Ошибка подключения. Попытка ${connectionAttempts + 1}/$MAX_CONNECTION_ATTEMPTS через 3 секунды...",
                            Toast.LENGTH_LONG
                        ).show()

                        addSystemMessage("Попытка подключения $connectionAttempts/$MAX_CONNECTION_ATTEMPTS не удалась")

                        // Пытаемся переподключиться через 3 секунды
                        android.os.Handler(mainLooper).postDelayed({
                            socket?.connect()
                        }, RECONNECT_DELAY)
                    }
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                Log.d("MainActivity", "Socket disconnected: ${args.joinToString()}")
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "📴 Отключено от сервера", Toast.LENGTH_SHORT).show()
                    isConnected = false

                    // Попытка переподключения только если приложение активно
                    if (!isFinishing && isAppInForeground()) {
                        addSystemMessage("Потеряно соединение с сервером. Пытаемся переподключиться...")
                        android.os.Handler(mainLooper).postDelayed({
                            socket?.connect()
                        }, 3000)
                    }
                }
            }

            socket?.on("user-joined") { args ->
                Log.d("MainActivity", "user-joined event received")
                runOnUiThread {
                    try {
                        val data = args[0] as JSONObject
                        val joinedUser = data.getString("username")
                        val joinedRoom = data.getString("room")

                        Log.d("MainActivity", "User $joinedUser joined room $joinedRoom")

                        // Обновляем информацию о комнате
                        binding.sidebarHeader.text = "Комната: $joinedRoom"
                        binding.userInfo.text = "✪ $username"

                        // Загружаем историю сообщений
                        if (data.has("messageHistory")) {
                            val messageHistory = data.getJSONArray("messageHistory")
                            for (i in 0 until messageHistory.length()) {
                                val message = messageHistory.getJSONObject(i)
                                addMessageFromServer(message)
                            }
                        }

                        // Обновляем список пользователей
                        if (data.has("users")) {
                            updateUsersList(data.getJSONArray("users"))
                        }

                        addSystemMessage("Вы вошли в комнату $joinedRoom как $joinedUser")

                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing user-joined: ${e.message}")
                    }
                }
            }

            socket?.on("new-message") { args ->
                Log.d("MainActivity", "new-message event received")
                runOnUiThread {
                    try {
                        val message = args[0] as JSONObject
                        handleBackgroundMessage(message)
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing new-message: ${e.message}")
                    }
                }
            }

            socket?.on("users-list") { args ->
                runOnUiThread {
                    try {
                        val users = args[0] as JSONArray
                        updateUsersList(users)
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing users-list: ${e.message}")
                    }
                }
            }

            socket?.on("join-error") { args ->
                Log.d("MainActivity", "join-error event received")
                runOnUiThread {
                    val error = args[0] as String
                    Toast.makeText(this@MainActivity, "❌ Ошибка входа: $error", Toast.LENGTH_LONG).show()
                    socket?.disconnect()
                    addSystemMessage("Ошибка входа: $error")
                    // Возвращаемся к LoginActivity
                    finish()
                }
            }

            socket?.on("killall-message") { args ->
                runOnUiThread {
                    val message = args[0] as JSONObject
                    addSystemMessage("The tower has fallen!")
                    Toast.makeText(this@MainActivity, "Сервер завершил работу", Toast.LENGTH_LONG).show()
                    socket?.disconnect()
                }
            }

            socket?.on("clear-chat") {
                runOnUiThread {
                    messagesAdapter.clearMessages()
                    addSystemMessage("История чата была очищена")
                }
            }

            socket?.on("message-deleted") { args ->
                runOnUiThread {
                    try {
                        val data = args[0] as JSONObject
                        val messageId = data.getString("messageId")
                        // TODO: Реализовать удаление сообщения из списка
                        Toast.makeText(this@MainActivity, "Сообщение удалено", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing message-deleted: ${e.message}")
                    }
                }
            }

            Log.d("MainActivity", "Attempting to connect socket...")
            socket?.connect()

        } catch (e: URISyntaxException) {
            Log.e("MainActivity", "URISyntaxException: ${e.message}")
            runOnUiThread {
                Toast.makeText(this, "❌ Ошибка в адресе сервера", Toast.LENGTH_LONG).show()
                addSystemMessage("Некорректный адрес сервера. Проверьте формат URL.")
                showReconnectDialog(
                    intent.getStringExtra("server") ?: "http://10.0.2.2:3000",
                    username, room, password
                )
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Exception: ${e.message}")
            runOnUiThread {
                Toast.makeText(this, "❌ Ошибка подключения", Toast.LENGTH_LONG).show()
                addSystemMessage("Ошибка подключения к серверу")
                showReconnectDialog(
                    intent.getStringExtra("server") ?: "http://10.0.2.2:3000",
                    username, room, password
                )
            }
        }
    }

    private fun isAppInForeground(): Boolean {
        return !isAppInBackground && !isDeviceLocked
    }

    private fun showReconnectDialog(server: String, username: String, room: String, password: String) {
        AlertDialog.Builder(this)
            .setTitle("Ошибка подключения")
            .setMessage("Не удалось подключиться к серверу $server\nПопытка ${connectionAttempts + 1}/$MAX_CONNECTION_ATTEMPTS\nХотите попробовать снова?")
            .setPositiveButton("Повторить") { dialog, _ ->
                dialog.dismiss()
                connectionAttempts++

                if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
                    // Возвращаемся на экран входа
                    AlertDialog.Builder(this)
                        .setTitle("Превышено количество попыток")
                        .setMessage("Не удалось подключиться после $MAX_CONNECTION_ATTEMPTS попыток")
                        .setPositiveButton("Вернуться") { d, _ ->
                            d.dismiss()
                            finish()
                        }
                        .setCancelable(false)
                        .show()
                } else {
                    addSystemMessage("Попытка повторного подключения $connectionAttempts/$MAX_CONNECTION_ATTEMPTS...")
                    // Очищаем старый сокет
                    socket?.disconnect()
                    socket?.off()
                    socket = null

                    // Пробуем подключиться заново через 3 секунды
                    android.os.Handler(mainLooper).postDelayed({
                        connectToServer(username, room, password)
                    }, RECONNECT_DELAY)
                }
            }
            .setNegativeButton("Выйти") { dialog, _ ->
                dialog.dismiss()
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun joinRoom(username: String, room: String, password: String) {
        Log.d("MainActivity", "Joining room: user=$username, room=$room")

        val joinData = JSONObject().apply {
            put("username", username)
            put("room", room)
            put("password", password)
        }

        socket?.emit("user-join-attempt", joinData)
    }

    private fun sendMessage() {
        val text = binding.messageInput.text.toString().trim()
        if (text.isEmpty()) {
            Toast.makeText(this, "Введите сообщение", Toast.LENGTH_SHORT).show()
            return
        }

        if (!isConnected) {
            Toast.makeText(this, "Нет подключения к серверу", Toast.LENGTH_SHORT).show()
            return
        }

        // Проверка на системные команды
        if (text == "kill" || text == "killall") {
            Toast.makeText(this, "Системные команды не поддерживаются в клиенте", Toast.LENGTH_SHORT).show()
            binding.messageInput.text?.clear()
            hideKeyboard()
            return
        }

        val messageData = JSONObject().apply {
            put("text", text)
            put("isEncrypted", false)
        }

        socket?.emit("send-message", messageData)
        binding.messageInput.text?.clear()
        hideKeyboard() // Скрываем клавиатуру после отправки

        // Прокрутка к последнему сообщению
        scrollToBottom()
    }

    private fun handleBackgroundMessage(message: JSONObject) {
        runOnUiThread {
            addMessageFromServer(message)

            // Если приложение в фоне - показываем уведомление
            if (isAppInBackground || isDeviceLocked) {
                showNotification(message)
            }
        }
    }

    private fun showNotification(message: JSONObject) {
        try {
            val username = message.getString("username")
            val text = message.getString("text")
            val isSystem = message.optBoolean("isSystem", false)

            // Не показываем уведомления для системных сообщений
            if (isSystem) return

            // Не показываем уведомления для собственных сообщений
            if (username == currentUser) return

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Создаем канал уведомлений для Android Oreo и выше
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    "chat_messages",
                    "Сообщения чата",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Уведомления о новых сообщениях в чате"
                    setShowBadge(true)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    enableVibration(true)
                    enableLights(true)
                    lightColor = android.graphics.Color.GREEN
                }
                notificationManager.createNotificationChannel(channel)
            }

            val intent = Intent(this, MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val notification = NotificationCompat.Builder(this, "chat_messages")
                .setContentTitle("💬 $username")
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .build()

            val notificationId = System.currentTimeMillis().toInt()
            notificationManager.notify(notificationId, notification)

            Log.d("MainActivity", "Notification shown for message from $username")

        } catch (e: Exception) {
            Log.e("MainActivity", "Error showing notification: ${e.message}")
        }
    }

    private fun addMessageFromServer(message: JSONObject) {
        try {
            val username = message.getString("username")
            val text = message.getString("text")
            val isSystem = message.optBoolean("isSystem", false)
            val isEncrypted = message.optBoolean("isEncrypted", false)
            val timestamp = message.optString("timestamp", Date().toString())

            val chatMessage = ChatMessage(
                id = message.optString("id", System.currentTimeMillis().toString()),
                username = username,
                text = if (isEncrypted) "🔒 Зашифрованное сообщение" else text,
                timestamp = parseTimestamp(timestamp),
                isMyMessage = username == currentUser,
                isSystem = isSystem,
                isEncrypted = isEncrypted
            )

            messagesAdapter.addMessage(chatMessage)
            scrollToBottom()

        } catch (e: Exception) {
            Log.e("MainActivity", "Error parsing message: ${e.message}")
        }
    }

    private fun addSystemMessage(text: String) {
        val systemMessage = ChatMessage(
            id = System.currentTimeMillis().toString(),
            username = "system",
            text = text,
            timestamp = getCurrentTime(),
            isMyMessage = false,
            isSystem = true,
            isEncrypted = false
        )
        messagesAdapter.addMessage(systemMessage)
        scrollToBottom()
    }

    private fun updateUsersList(users: JSONArray) {
        val usersList = mutableListOf<String>()
        for (i in 0 until users.length()) {
            val user = users.getJSONObject(i)
            usersList.add(user.getString("username"))
        }

        // TODO: Обновить RecyclerView со списком пользователей
        // Пока просто показываем количество
        val usersCount = usersList.size
        binding.userInfo.text = "✪ $currentUser (всего: $usersCount)"
    }

    private fun parseTimestamp(timestamp: String): String {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            val date = inputFormat.parse(timestamp)
            val outputFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            outputFormat.format(date ?: Date())
        } catch (e: Exception) {
            getCurrentTime()
        }
    }

    private fun getCurrentTime(): String {
        val format = SimpleDateFormat("HH:mm", Locale.getDefault())
        return format.format(Date())
    }

    private fun scrollToBottom() {
        binding.messagesRecyclerView.postDelayed({
            if (messagesAdapter.itemCount > 0) {
                binding.messagesRecyclerView.scrollToPosition(messagesAdapter.itemCount - 1)
            }
        }, 100)
    }

    private fun toggleSidebar() {
        val sidebar = binding.sidebar
        if (sidebar.visibility == View.VISIBLE) {
            sidebar.visibility = View.GONE
        } else {
            sidebar.visibility = View.VISIBLE
        }
    }

    private fun showKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        binding.messageInput.postDelayed({
            binding.messageInput.requestFocus()
            imm.showSoftInput(binding.messageInput, InputMethodManager.SHOW_IMPLICIT)
        }, 100)
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(binding.messageInput.windowToken, 0)
        binding.messageInput.clearFocus()
    }

    override fun onDestroy() {
        super.onDestroy()

        // Отменяем регистрацию receiver
        try {
            unregisterReceiver(serviceStatusReceiver)
        } catch (e: Exception) {
            Log.e("MainActivity", "Error unregistering receiver: ${e.message}")
        }

        // Отключаем сокет
        socket?.disconnect()
        socket?.off()

        // Останавливаем сервисы только если выходим из приложения
        if (isFinishing) {
            ChatForegroundService.stopService(this)
        }
    }
}