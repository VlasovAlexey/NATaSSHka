package com.natasshka.messenger

import android.Manifest
import android.app.Activity
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import android.provider.OpenableColumns
import android.provider.Settings
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Log
import android.view.MotionEvent
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
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.natasshka.messenger.databinding.ActivityMainBinding
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URISyntaxException
import java.text.SimpleDateFormat
import java.util.*
import java.util.Timer
import java.util.TimerTask
import android.content.ClipData
import android.content.ClipboardManager
import com.natasshka.messenger.FullscreenVideoActivity
import android.content.ActivityNotFoundException
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import androidx.core.app.ActivityCompat
import java.net.URL

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.OnLifecycleEvent

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var messagesAdapter: MessagesAdapter
    private var socket: Socket? = null
    private var currentUser: String = ""
    private var currentRoom: String = "Room_01"
    private var isConnected = false
    private var pendingLoginData: Triple<String, String, String>? = null
    private var isAppInBackground = false
    private var isDeviceLocked = false
    private lateinit var serviceStatusReceiver: BroadcastReceiver
    private var connectionAttempts = 0
    private val MAX_CONNECTION_ATTEMPTS = 3
    private val RECONNECT_DELAY = 1000L
    private var encryptionKey = ""
    private var debounceTimer: Timer? = null
    private val encryptionDebounceDelay = 500L
    private lateinit var fileManager: FileManager
    private lateinit var videoRecorder: VideoRecorder
    private lateinit var audioRecorder: AudioRecorder
    private var isRecordingAudio = false
    private var recordingStartTime: Long = 0
    private var recordingTimer: Timer? = null
    private val recordingUpdateInterval = 100L
    private var recordedAudioUri: Uri? = null
    private val temporarilyRemovedMessages = mutableMapOf<String, ChatMessage>()

    private lateinit var usersAdapter: UsersAdapter

    private val directoryPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                handleDirectorySelection(uri)
            }
        }
    }
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                handleFileSelection(uri)
            }
        }
    }
    private val videoRecordLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                handleFileSelection(uri)
            } ?: run {
                videoRecorder.currentVideoUri?.let { uri ->
                    handleFileSelection(uri)
                }
            }
        }
    }
    companion object {
        const val PERMISSION_REQUEST_STORAGE = 1001
        const val PERMISSION_REQUEST_ANDROID_13 = 1002
        const val PERMISSION_REQUEST_RECORD_AUDIO = 1003
    }
    private val audioRecordLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                handleFileSelection(uri)
            } ?: run {
                audioRecorder.currentAudioUri?.let { uri ->
                    handleFileSelection(uri)
                }
            }
        }
    }
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, "Некоторые разрешения не предоставлены", Toast.LENGTH_LONG).show()
        }
        pendingLoginData?.let { (username, room, password) ->
            connectToServer(username, room, password)
        }
    }
    private lateinit var clipboardManager: ClipboardManager
    private lateinit var linkParser: LinkParser
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setupSocketListeners()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        fileManager = FileManager(this)
        videoRecorder = VideoRecorder(this)
        audioRecorder = AudioRecorder(this)
        connectionAttempts = 0
        logDeviceInfo()
        val server = intent.getStringExtra("server") ?: ""
        val username = intent.getStringExtra("username") ?: ""
        val room = intent.getStringExtra("room") ?: "Room_01"
        val password = intent.getStringExtra("password") ?: ""
        if (server.isEmpty() || username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Данные для входа не получены", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        currentUser = username
        currentRoom = room
        pendingLoginData = Triple(username, room, password)
        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        linkParser = LinkParser(this)
        setupUI()
        setupSocketListeners()
        setupFileHandling()
        setupEncryptionKeyHandler()
        setupKeyboardBehavior()
        setupServiceMonitoring()
        setupBackgroundMonitoring()
        checkBatteryOptimization()
        requestPermissions()
        setupDataCleanup()
    }

    private fun setupDataCleanup() {
        // Очистка при запуске
        cleanupOldTempData()

        // Мониторинг жизненного цикла через простой LifecycleObserver
        lifecycle.addObserver(object : LifecycleObserver {
            @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
            fun onDestroy() {
                cleanupTempData()
            }

            @OnLifecycleEvent(Lifecycle.Event.ON_STOP)
            fun onStop() {
                // Частичная очистка при уходе в фон
                cleanupPartialTempData()
            }
        })
    }

    private fun cleanupOldTempData() {
        // Удаление старых временных файлов (старше 24 часов)
        Thread {
            try {
                val cacheDir = cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    if (System.currentTimeMillis() - file.lastModified() > 24 * 3600000) {
                        file.deleteRecursively()
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Error cleaning old temp data", e)
            }
        }.start()
    }

    // В onDestroy:
    override fun onDestroy() {
        super.onDestroy()
        // Гарантированная очистка
        cleanupTempData()

        // Остановить мониторинг кэша
        CacheMonitor.stopMonitoring()
        // Форсированная очистка кэша
        CacheMonitor.forceCleanup()

        // Очистка временных файлов записей
        audioRecorder.cleanup()
        videoRecorder.cleanup()
        fileManager.cleanupTempFiles()

        Log.d("MainActivity", "Temporary data cleaned up")
    }

    private fun cleanupTempData() {
        Thread {
            // Очистка временных файлов
            try {
                val cacheDir = cacheDir
                cacheDir.listFiles()?.forEach { file ->
                    if (file.name.startsWith("temp_") ||
                        file.name.startsWith("VID_") ||
                        file.name.startsWith("audio_message_")) {
                        file.deleteRecursively()
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Error cleaning temp data", e)
            }

            // Очистка кэша Glide (в главном потоке)
            Handler(Looper.getMainLooper()).post {
                try {
                    // Используем рефлексию для доступа к Glide если нет прямой зависимости
                    val glideClass = Class.forName("com.bumptech.glide.Glide")
                    val getMethod = glideClass.getMethod("get", Context::class.java)
                    val glideInstance = getMethod.invoke(null, this@MainActivity)
                    val clearMemoryMethod = glideClass.getMethod("clearMemory")
                    clearMemoryMethod.invoke(glideInstance)
                } catch (e: Exception) {
                    Log.e("MainActivity", "Error clearing Glide cache", e)
                }
            }
        }.start()
    }

    private fun cleanupPartialTempData() {
        // Быстрая очистка только памяти
        Handler(Looper.getMainLooper()).post {
            try {
                val glideClass = Class.forName("com.bumptech.glide.Glide")
                val getMethod = glideClass.getMethod("get", Context::class.java)
                val glideInstance = getMethod.invoke(null, this@MainActivity)
                val clearMemoryMethod = glideClass.getMethod("clearMemory")
                clearMemoryMethod.invoke(glideInstance)
            } catch (e: Exception) {
                Log.e("MainActivity", "Error clearing Glide memory cache", e)
            }
        }
    }

    private fun checkClipboardForLinks(text: String): String {
        if (clipboardManager.hasPrimaryClip()) {
            val clipData: ClipData? = clipboardManager.primaryClip
            if (clipData != null && clipData.itemCount > 0) {
                val clipboardText = clipData.getItemAt(0).text?.toString() ?: ""
                if (linkParser.containsLinks(clipboardText)) {
                    Log.d("MainActivity", "Буфер обмена содержит ссылки: $clipboardText")
                    if (text.isEmpty()) {
                        return clipboardText
                    }
                }
            }
        }
        return text
    }
    private fun setupFileHandling() {
        binding.attachFileBtn.setOnClickListener {
            openFilePicker()
        }
        binding.recordVideoBtn.setOnClickListener {
            recordVideo()
        }
        binding.recordAudioBtn.setOnTouchListener { v, event ->
            Log.d("AudioRecording", "OnTouch event: ${event.action}")
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    Log.d("AudioRecording", "Кнопка зажата (ACTION_DOWN)")
                    startAudioRecording()
                    true
                }
                MotionEvent.ACTION_UP -> {
                    Log.d("AudioRecording", "Кнопка отпущена (ACTION_UP)")
                    stopAudioRecording()
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    Log.d("AudioRecording", "Кнопка отменена (ACTION_CANCEL)")
                    stopAudioRecording()
                    true
                }
                else -> {
                    Log.d("AudioRecording", "Другое событие: ${event.action}")
                    false
                }
            }
        }
    }
    private fun openFilePicker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            checkAndRequestAndroid13Permissions()
        } else {
            openFilePickerLegacy()
        }
    }
    private fun openFilePickerForAndroid13() {
        val mimeTypes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                "*/*",
                "application/octet-stream",
                "text/*",
                "text/html",
                "text/javascript",
                "application/javascript",
                "application/x-javascript",
                "text/css",
                "text/xml",
                "application/xml",
                "application/json",
                "application/pdf",
                "application/msword",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/zip",
                "application/x-rar-compressed",
                "application/x-7z-compressed"
            )
        } else {
            arrayOf("*/*")
        }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            putExtra("android.content.extra.SHOW_ADVANCED", true)
            putExtra("android.content.extra.FANCY", true)
        }
        try {
            val chooser = Intent.createChooser(intent, "Выберите файл")
            filePickerLauncher.launch(chooser)
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка открытия файлового менеджера", Toast.LENGTH_SHORT).show()
        }
    }
    private fun openFilePickerLegacy() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("*/*"))
        }
        try {
            val chooser = Intent.createChooser(intent, "Выберите файл")
            filePickerLauncher.launch(chooser)
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    private fun checkAndRequestAndroid13Permissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_IMAGES)
            }
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_VIDEO)
            }
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_AUDIO)
            }
        }
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_ANDROID_13
            )
        } else {
            openFilePickerForAndroid13()
        }
    }
    private fun handleDirectorySelection(uri: Uri) {
        contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
        )
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "*/*"
            putExtra(DocumentsContract.EXTRA_INITIAL_URI, uri)
        }
        try {
            filePickerLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка выбора файла", Toast.LENGTH_SHORT).show()
        }
    }
    private fun openFilePickerSimple() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("*/*"))
        }
        try {
            filePickerLauncher.launch(Intent.createChooser(intent, "Выберите файл"))
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    private fun handleFileSelection(uri: Uri) {
        try {
            val contentResolver = contentResolver
            var fileName: String? = null
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val displayNameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (displayNameIndex != -1) {
                        fileName = cursor.getString(displayNameIndex)
                    }
                }
            }
            if (fileName == null || fileName.isNullOrEmpty()) {
                fileName = uri.lastPathSegment?.substringAfterLast("/")
            }
            val cleanFileName = when {
                fileName == null || fileName.isNullOrEmpty() -> {
                    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                    "audio_message_${timeStamp}.webm"
                }
                fileName!!.endsWith(".3gp") -> {
                    fileName!!.replace(".3gp", ".webm")
                }
                !fileName!!.endsWith(".webm") && !fileName!!.contains(".") -> {
                    "$fileName.webm"
                }
                else -> fileName!!
            }
            val mimeType = if (cleanFileName.endsWith(".webm")) {
                "audio/webm"
            } else {
                contentResolver.getType(uri) ?: "audio/webm"
            }
            val fileSize: Long = try {
                contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                    pfd.statSize
                } ?: 0L
            } catch (e: Exception) {
                0L
            }
            val maxSize = 50 * 1024 * 1024
            if (fileSize > maxSize) {
                Toast.makeText(this, "Файл слишком большой. Максимальный размер: 50 МБ", Toast.LENGTH_LONG).show()
                return
            }
            showFileUploadIndicator(cleanFileName)
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    var duration = 0.0
                    if (mimeType.startsWith("audio/")) {
                        try {
                            val durationMs = fileManager.getMediaDuration(uri, mimeType)
                            duration = durationMs / 1000.0
                            Log.d("MainActivity", "Длительность аудиофайла: $duration секунд")
                        } catch (e: Exception) {
                            Log.w("MainActivity", "Не удалось получить длительность аудио: ${e.message}")
                        }
                    }
                    val fileJson = fileManager.prepareFileForSending(
                        uri = uri,
                        fileName = cleanFileName,
                        mimeType = mimeType,
                        encryptionKey = encryptionKey,
                        duration = duration
                    )
                    if (mimeType.startsWith("audio/")) {
                        fileJson.put("isAudio", true)
                    }
                    fileJson.put("room", currentRoom)
                    fileJson.put("isFile", true)
                    socket?.emit("send-file", fileJson, io.socket.client.Ack { args ->
                        runOnUiThread {
                            hideFileUploadIndicator()
                            if (args.isNotEmpty() && args[0] is JSONObject) {
                                val response = args[0] as JSONObject
                                if (response.has("error")) {
                                    Toast.makeText(
                                        this@MainActivity,
                                        "Ошибка отправки файла: ${response.getString("error")}",
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else {
                                    Toast.makeText(
                                        this@MainActivity,
                                        "Файл отправлен",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            }
                        }
                    })
                } catch (e: Exception) {
                    runOnUiThread {
                        hideFileUploadIndicator()
                        Toast.makeText(
                            this@MainActivity,
                            "Ошибка подготовки файла: ${e.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка обработки файла: ${e.message}", Toast.LENGTH_LONG).show()
            Log.e("MainActivity", "Ошибка обработки файла", e)
        }
    }
    private fun showFileUploadIndicator(fileName: String) {
        runOnUiThread {
            binding.progressContainer.visibility = View.VISIBLE
            binding.progressText.text = "Подготовка файла: $fileName"
            binding.progressBar.isIndeterminate = true
        }
    }
    private fun hideFileUploadIndicator() {
        runOnUiThread {
            binding.progressContainer.visibility = View.GONE
        }
    }
    private fun showFileDownloadProgress(fileName: String, progress: Int) {
        runOnUiThread {
            binding.progressContainer.visibility = View.VISIBLE
            binding.progressText.text = "Скачивание: $fileName ($progress%)"
            binding.progressBar.isIndeterminate = false
            binding.progressBar.progress = progress
        }
    }
    private fun hideFileDownloadProgress() {
        runOnUiThread {
            binding.progressContainer.visibility = View.GONE
        }
    }
    private fun recordVideo() {
        videoRecorder.recordVideo(videoRecordLauncher)
    }
    private fun startAudioRecording() {
        Log.d("AudioRecording", "Начинаем запись аудио")
        if (isRecordingAudio) {
            Log.d("AudioRecording", "Уже идет запись")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            Log.d("AudioRecording", "Нет разрешения на запись аудио")
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                PERMISSION_REQUEST_RECORD_AUDIO
            )
            return
        }
        val started = audioRecorder.startNativeRecording()
        Log.d("AudioRecording", "Запись начата: $started")
        if (started) {
            isRecordingAudio = true
            recordingStartTime = System.currentTimeMillis()
            showRecordingIndicator()
            startRecordingTimer()
        }
    }
    private fun stopAudioRecording() {
        Log.d("AudioRecording", "Останавливаем запись аудио")
        if (!isRecordingAudio) {
            Log.d("AudioRecording", "Запись не активна")
            return
        }
        isRecordingAudio = false
        stopRecordingTimer()
        hideRecordingIndicator()
        val stopped = audioRecorder.stopNativeRecording()
        Log.d("AudioRecording", "Запись остановлена: $stopped")
        if (stopped) {
            Handler(Looper.getMainLooper()).postDelayed({
                audioRecorder.currentAudioUri?.let { uri ->
                    Log.d("AudioRecording", "Отправляем аудиофайл webm: $uri")
                    sendAudioFileWithMetadata(uri)
                } ?: run {
                    Log.e("AudioRecording", "URI файла null")
                    Toast.makeText(this, "Ошибка: файл записи не создан", Toast.LENGTH_SHORT).show()
                }
            }, 300)
        }
    }
    private fun sendAudioFileWithMetadata(audioUri: Uri) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val contentResolver = applicationContext.contentResolver
                var fileName: String? = null
                contentResolver.query(audioUri, null, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val displayNameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        if (displayNameIndex != -1) {
                            fileName = cursor.getString(displayNameIndex)
                        }
                    }
                }
                if (fileName == null || fileName!!.endsWith(".3gp")) {
                    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                    fileName = "audio_message_${timeStamp}.webm"
                }
                val cleanFileName = if (fileName!!.endsWith(".webm")) {
                    fileName!!
                } else {
                    val nameWithoutExt = fileName!!.substringBeforeLast(".")
                    "$nameWithoutExt.webm"
                }
                val mimeType = "audio/webm"
                val durationSeconds = audioRecorder.getDurationInSeconds()
                Log.d("AudioDebug", "Длительность аудио: $durationSeconds секунд")
                Log.d("AudioDebug", "Имя файла: $cleanFileName")
                Log.d("AudioDebug", "MIME тип: $mimeType")
                Log.d("AudioDebug", "Ключ шифрования: ${encryptionKey.isNotEmpty()}")
                val fileJson = fileManager.prepareFileForSending(
                    uri = audioUri,
                    fileName = cleanFileName,
                    mimeType = mimeType,
                    encryptionKey = encryptionKey
                )
                Log.d("AudioDebug", "Отправляемые данные:")
                Log.d("AudioDebug", "fileName: ${fileJson.optString("fileName")}")
                Log.d("AudioDebug", "fileType: ${fileJson.optString("fileType")}")
                Log.d("AudioDebug", "fileSize: ${fileJson.optString("fileSize")}")
                Log.d("AudioDebug", "isEncrypted: ${fileJson.optBoolean("isEncrypted")}")
                Log.d("AudioDebug", "isAudio: ${fileJson.optBoolean("isAudio")}")
                Log.d("AudioDebug", "isFile: ${fileJson.optBoolean("isFile")}")
                Log.d("AudioDebug", "duration: ${fileJson.optString("duration")}")
                val fileData = fileJson.optString("fileData", "")
                Log.d("AudioDebug", "fileData длина: ${fileData.length}")
                Log.d("AudioDebug", "fileData первые 200 символов: ${fileData.take(200)}")
                Log.d("AudioDebug", "fileData последние 200 символов: ${fileData.takeLast(200)}")
                if (encryptionKey.isNotEmpty()) {
                    val isCryptoJSFormat = CryptoJSCompat.isCryptoJSEncrypted(fileData)
                    Log.d("AudioDebug", "CryptoJS формат: $isCryptoJSFormat")
                }
                fileJson.put("room", currentRoom)
                fileJson.put("isFile", true)
                fileJson.put("isAudio", true)
                Log.d("AudioDebug", "Финальный JSON для отправки: ${fileJson.toString()}")
                socket?.emit("send-file", fileJson, io.socket.client.Ack { args ->
                    runOnUiThread {
                        hideFileUploadIndicator()
                        if (args.isNotEmpty() && args[0] is JSONObject) {
                            val response = args[0] as JSONObject
                            if (response.has("error")) {
                                Log.e("AudioDebug", "Ошибка отправки: ${response.getString("error")}")
                                Toast.makeText(
                                    this@MainActivity,
                                    "Ошибка отправки аудиофайла: ${response.getString("error")}",
                                    Toast.LENGTH_LONG
                                ).show()
                            } else {
                                Log.d("AudioDebug", "✅ Аудио успешно отправлено")
                                Toast.makeText(
                                    this@MainActivity,
                                    "Аудиосообщение отправлено (${String.format("%.1f", durationSeconds)} сек)",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e("AudioDebug", "Ошибка отправки аудио", e)
                runOnUiThread {
                    hideFileUploadIndicator()
                    Toast.makeText(
                        this@MainActivity,
                        "Ошибка подготовки аудиофайла: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
    private fun showRecordingIndicator() {
        binding.recordingOverlay.visibility = View.VISIBLE
        binding.recordingOverlay.animate()
            .alpha(1f)
            .setDuration(200)
            .start()
    }
    private fun hideRecordingIndicator() {
        binding.recordingOverlay.animate()
            .alpha(0f)
            .setDuration(200)
            .withEndAction {
                binding.recordingOverlay.visibility = View.GONE
                binding.recordingCircle.scaleX = 1.0f
                binding.recordingCircle.scaleY = 1.0f
            }
            .start()
    }
    private fun startRecordingTimer() {
        recordingTimer = Timer()
        recordingTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                runOnUiThread {
                    updateRecordingUI()
                }
            }
        }, 0, recordingUpdateInterval)
    }
    private fun stopRecordingTimer() {
        recordingTimer?.cancel()
        recordingTimer = null
    }
    private fun updateRecordingUI() {
        if (isRecordingAudio) {
            val elapsedTime = System.currentTimeMillis() - recordingStartTime
            val seconds = (elapsedTime / 1000) % 60
            val minutes = (elapsedTime / (1000 * 60)) % 60
            val milliseconds = (elapsedTime % 1000) / 10
            binding.recordingTime.text = String.format("%02d:%02d:%02d", minutes, seconds, milliseconds)
            val baseSize = 1.0f
            val pulseSize = 1.1f + (Math.sin(System.currentTimeMillis() / 200.0) * 0.1).toFloat()
            binding.recordingCircle.scaleX = pulseSize
            binding.recordingCircle.scaleY = pulseSize
        }
    }
    private fun onFileClicked(fileMessage: FileMessage) {
        when (fileMessage.fileCategory) {
            FileManager.FileType.IMAGE -> {
                openImageFullscreen(fileMessage)
            }
            FileManager.FileType.VIDEO -> {
                openVideoFullscreen(fileMessage)
            }
            else -> {
                if (fileMessage.localPath != null) {
                    openLocalFile(fileMessage)
                } else {
                    Toast.makeText(this, "Файл не скачан. Скачиваем...", Toast.LENGTH_SHORT).show()
                    downloadFile(fileMessage)
                }
            }
        }
    }
    private fun openFile(fileMessage: FileMessage) {
        val isImage = fileMessage.fileCategory == FileManager.FileType.IMAGE
        if (isImage) {
            openImageFullscreen(fileMessage)
        } else if (fileMessage.localPath != null) {
            openLocalFile(fileMessage)
        } else {
            Toast.makeText(this, "Файл не скачан. Скачиваем...", Toast.LENGTH_SHORT).show()
            downloadFile(fileMessage)
        }
    }
    private fun openImageFullscreen(fileMessage: FileMessage) {
        val intent = Intent(this, FullscreenImageActivity::class.java).apply {
            val server = getIntent().getStringExtra("server") ?: ServerConfig.getDefaultServer()
            when {
                fileMessage.localPath != null -> {
                    putExtra(FullscreenImageActivity.EXTRA_IMAGE_PATH, fileMessage.localPath)
                }
                fileMessage.fileUrl != null -> {
                    val fullUrl = if (fileMessage.fileUrl!!.startsWith("http")) {
                        fileMessage.fileUrl
                    } else {
                        if (fileMessage.fileUrl!!.startsWith("/")) {
                            "$server${fileMessage.fileUrl}"
                        } else {
                            "$server/${fileMessage.fileUrl}"
                        }
                    }
                    putExtra(FullscreenImageActivity.EXTRA_IMAGE_URL, fullUrl)
                }
                fileMessage.fileData != null -> {
                    putExtra(FullscreenImageActivity.EXTRA_IMAGE_BASE64, fileMessage.fileData)
                }
            }
            putExtra(FullscreenImageActivity.EXTRA_FILE_NAME, fileMessage.fileName)
            putExtra(FullscreenImageActivity.EXTRA_IS_ENCRYPTED, fileMessage.isEncrypted)
            putExtra(FullscreenImageActivity.EXTRA_ENCRYPTION_KEY, encryptionKey)
            if (fileMessage.fileData != null) {
                putExtra(FullscreenImageActivity.EXTRA_FILE_DATA, fileMessage.fileData)
            }
        }
        startActivity(intent)
    }
    private fun openVideoFullscreen(fileMessage: FileMessage) {
        val intent = Intent(this, FullscreenVideoActivity::class.java).apply {
            val server = getIntent().getStringExtra("server") ?: ServerConfig.getDefaultServer()
            when {
                fileMessage.localPath != null -> {
                    putExtra(FullscreenVideoActivity.EXTRA_VIDEO_PATH, fileMessage.localPath)
                }
                fileMessage.fileUrl != null -> {
                    val fullUrl = if (fileMessage.fileUrl!!.startsWith("http")) {
                        fileMessage.fileUrl
                    } else {
                        if (fileMessage.fileUrl!!.startsWith("/")) {
                            "$server${fileMessage.fileUrl}"
                        } else {
                            "$server/${fileMessage.fileUrl}"
                        }
                    }
                    putExtra(FullscreenVideoActivity.EXTRA_VIDEO_URL, fullUrl)
                }
                fileMessage.fileData != null -> {
                    putExtra(FullscreenVideoActivity.EXTRA_VIDEO_BASE64, fileMessage.fileData)
                }
            }
            putExtra(FullscreenVideoActivity.EXTRA_FILE_NAME, fileMessage.fileName)
            putExtra(FullscreenVideoActivity.EXTRA_IS_ENCRYPTED, fileMessage.isEncrypted)
            putExtra(FullscreenVideoActivity.EXTRA_ENCRYPTION_KEY, encryptionKey)
            if (fileMessage.fileData != null) {
                putExtra(FullscreenVideoActivity.EXTRA_FILE_DATA, fileMessage.fileData)
            }
        }
        startActivity(intent)
    }
    private fun openLocalFile(fileMessage: FileMessage) {
        val file = File(fileMessage.localPath!!)
        if (!file.exists()) {
            Toast.makeText(this, "Файл не найден", Toast.LENGTH_SHORT).show()
            Log.e("MainActivity", "Файл не существует: ${fileMessage.localPath}")
            return
        }
        Log.d("MainActivity", "Открытие файла: ${fileMessage.fileName}, путь: ${fileMessage.localPath}")
        val uri = FileProvider.getUriForFile(
            this,
            "${packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, fileMessage.fileType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(intent)
            Log.d("MainActivity", "Файл успешно открыт")
        } catch (e: ActivityNotFoundException) {
            Log.e("MainActivity", "Не найдено приложение для открытия файла: ${fileMessage.fileType}")
            Toast.makeText(this, "Не найдено приложение для открытия файла", Toast.LENGTH_SHORT).show()
            val downloadIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "*/*")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            try {
                startActivity(downloadIntent)
            } catch (e2: ActivityNotFoundException) {
                Toast.makeText(this, "Не найдено приложение для работы с файлами", Toast.LENGTH_SHORT).show()
            }
        }
    }
    private fun downloadFile(fileMessage: FileMessage) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d("MainActivity", "Скачивание файла: ${fileMessage.fileName}")
                if (fileMessage.fileData != null && fileMessage.fileData.isNotEmpty()) {
                    Log.d("MainActivity", "Используем fileData для сохранения")
                    saveFileFromData(fileMessage)
                }
                else if (fileMessage.fileUrl != null && fileMessage.fileUrl.isNotEmpty()) {
                    Log.d("MainActivity", "Скачивание по URL: ${fileMessage.fileUrl}")
                    downloadFileFromUrl(fileMessage)
                } else {
                    Log.w("MainActivity", "Нет данных для скачивания файла")
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "Нет данных для загрузки файла",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Ошибка скачивания файла: ${e.message}")
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Ошибка загрузки файла: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
    private var pendingFileDownload: FileMessage? = null
    private fun startFileDownload(fileMessage: FileMessage) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d("MainActivity", "Скачивание файла: ${fileMessage.fileName}")
                if (fileMessage.fileData != null && fileMessage.fileData.isNotEmpty()) {
                    Log.d("MainActivity", "Используем fileData для сохранения")
                    saveFileFromData(fileMessage)
                }
                else if (fileMessage.fileUrl != null && fileMessage.fileUrl.isNotEmpty()) {
                    Log.d("MainActivity", "Скачивание по URL: ${fileMessage.fileUrl}")
                    downloadFileFromUrl(fileMessage)
                } else {
                    Log.w("MainActivity", "Нет данных для скачивания файла")
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            "Нет данных для загрузки файла",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Ошибка скачивания файла: ${e.message}")
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Ошибка загрузки файла: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
    private suspend fun saveFileFromData(fileMessage: FileMessage) {
        try {
            Log.d("MainActivity", "Сохранение файла из данных: ${fileMessage.fileName}")
            val savedFile = fileManager.saveToDownloads(
                fileMessage.fileData!!,
                fileMessage.fileName,
                fileMessage.isEncrypted,
                encryptionKey
            )
            runOnUiThread {
                messagesAdapter.updateFileLocalPath(fileMessage.id, savedFile.absolutePath)
                val path = savedFile.absolutePath
                val fileName = savedFile.name
                addSystemMessage("Файл сохранен: $path")
                Toast.makeText(this, "Файл сохранен: $fileName", Toast.LENGTH_SHORT).show()
                Log.d("MainActivity", "✅ Файл сохранен по пути: $path")
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Ошибка сохранения файла из данных: ${e.message}")
            runOnUiThread {
                Toast.makeText(this, "Ошибка сохранения файла: ${e.message}", Toast.LENGTH_LONG).show()
            }
            throw e
        }
    }
    private fun updateFileMessageInAdapter(fileId: String, localPath: String) {
        messagesAdapter.notifyDataSetChanged()
        Log.d("MainActivity", "Файл сохранен по пути: $localPath для fileId: $fileId")
    }
    private suspend fun downloadFileFromUrl(fileMessage: FileMessage) {
        try {
            var fileUrl = fileMessage.fileUrl
            Log.d("MainActivity", "Скачивание файла: ${fileMessage.fileName}, зашифрован: ${fileMessage.isEncrypted}")
            if (fileUrl != null && !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
                val server = intent.getStringExtra("server") ?: ServerConfig.getDefaultServer()
                if (fileUrl.startsWith("/")) {
                    fileUrl = server + fileUrl
                } else {
                    fileUrl = "$server/$fileUrl"
                }
                Log.d("MainActivity", "Исправленный URL файла: $fileUrl")
            }
            if (fileUrl == null) {
                throw Exception("URL файла отсутствует")
            }
            val url = URL(fileUrl)
            val connection = url.openConnection()
            connection.connect()
            val inputStream = connection.getInputStream()
            val fileBytes = inputStream.readBytes()
            val fileBase64 = android.util.Base64.encodeToString(fileBytes, android.util.Base64.DEFAULT)
            val savedFile = fileManager.saveToDownloads(
                fileBase64,
                fileMessage.fileName,
                fileMessage.isEncrypted,
                encryptionKey
            )
            runOnUiThread {
                messagesAdapter.notifyDataSetChanged()
                val path = savedFile.absolutePath
                addSystemMessage("Файл сохранен: $path")
                Toast.makeText(this, "Файл сохранен: ${savedFile.name}", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Ошибка скачивания файла по URL: ${e.message}")
            throw e
        }
    }

    private fun setupEncryptionKeyField() {
        binding.encryptionKeyInput.setOnTouchListener { v, event ->
            val drawableEnd = 2
            if (event.action == MotionEvent.ACTION_UP) {
                if (event.rawX >= (binding.encryptionKeyInput.right - binding.encryptionKeyInput.compoundDrawables[drawableEnd].bounds.width())) {
                    binding.encryptionKeyInput.text?.clear()
                    return@setOnTouchListener true
                }
            }
            false
        }
    }
    private fun setupEncryptionKeyHandler() {
        binding.encryptionKeyInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val newKey = s?.toString() ?: ""
                encryptionKey = newKey
                updateEncryptionKeyClearButton()
                debounceTimer?.cancel()
                debounceTimer = Timer()
                debounceTimer?.schedule(object : TimerTask() {
                    override fun run() {
                        runOnUiThread {
                            reDecryptAllMessages()
                        }
                    }
                }, encryptionDebounceDelay)
            }
        })
        binding.encryptionKeyInput.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                val drawableRight = binding.encryptionKeyInput.compoundDrawables[2]
                if (drawableRight != null) {
                    val touchX = event.x
                    val touchY = event.y
                    val rightBoundary = binding.encryptionKeyInput.width -
                            binding.encryptionKeyInput.paddingRight
                    val iconLeftBoundary = rightBoundary - drawableRight.intrinsicWidth
                    if (touchX >= iconLeftBoundary && touchX <= rightBoundary &&
                        touchY >= 0 && touchY <= binding.encryptionKeyInput.height) {
                        binding.encryptionKeyInput.text?.clear()
                        encryptionKey = ""
                        updateEncryptionKeyClearButton()
                        reDecryptAllMessages()
                        return@setOnTouchListener true
                    }
                }
            }
            false
        }
        updateEncryptionKeyClearButton()
    }
    private fun updateEncryptionKeyClearButton() {
        val hasText = binding.encryptionKeyInput.text?.isNotEmpty() == true
        val drawable = if (hasText) {
            ContextCompat.getDrawable(this, R.drawable.ic_clear)
        } else {
            null
        }
        binding.encryptionKeyInput.setCompoundDrawablesWithIntrinsicBounds(
            null, null, drawable, null
        )
    }
    private fun reDecryptAllMessages() {
        messagesAdapter.reDecryptMessages(encryptionKey)
        scrollToBottom()
    }
    private fun setupUI() {
        val serverUrl = intent.getStringExtra("server") ?: ServerConfig.getDefaultServer()
        messagesAdapter = MessagesAdapter(
            onFileClickListener = { fileMessage ->
                onFileClicked(fileMessage)
            },
            onFileRetryClickListener = { fileMessage ->
                downloadFile(fileMessage)
            },
            onDeleteMessageClickListener = { messageId ->
                showDeleteConfirmationDialog(messageId)
            },
            serverBaseUrl = serverUrl,
            context = this

        )

        usersAdapter = UsersAdapter()
        binding.usersRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = usersAdapter
        }

        binding.messagesRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = messagesAdapter
        }

        setupMessageInput()
        // Инициализация адаптера пользователей
        usersAdapter = UsersAdapter()
        binding.usersRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = usersAdapter
        }

        binding.messagesRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = messagesAdapter
        }
        setupMessageInput()
        setupEncryptionKeyField()
        binding.sidebarToggleBtn.setOnClickListener {
            toggleSidebar()
        }
        binding.root.setOnClickListener {
            if (binding.sidebar.visibility == View.VISIBLE) {
                toggleSidebar()
            }
        }
        binding.sidebar.setOnClickListener {
            // Ничего не делаем - предотвращаем всплытие клика
        }
        // Также добавьте обработку для messagesRecyclerView
        binding.messagesRecyclerView.setOnClickListener {
            if (binding.sidebar.visibility == View.VISIBLE) {
                toggleSidebar()
            }
        }
        binding.sendMessageBtn.setOnClickListener {
            sendMessage()
        }
        binding.attachFileBtn.setOnClickListener {
            openFilePicker()
        }
        binding.recordAudioBtn.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startAudioRecording()
                    true
                }
                MotionEvent.ACTION_UP -> {
                    stopAudioRecording()
                    true
                }
                else -> false
            }
        }
        binding.recordVideoBtn.setOnClickListener {
            recordVideo()
        }
        binding.audioCallBtn.setOnClickListener {
            Toast.makeText(this, "Аудиозвонки будут добавлены позже", Toast.LENGTH_SHORT).show()
        }
        binding.videoCallBtn.setOnClickListener {
            Toast.makeText(this, "Видеозвонки будут добавлены позже", Toast.LENGTH_SHORT).show()
        }
    }
    private fun setupKeyboardBehavior() {
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        binding.root.setOnClickListener {
            hideKeyboard()
        }
        binding.messageInput.setOnClickListener {
        }
    }
    private fun setupSocketListeners() {
        socket?.on("message-deleted") { args ->
            runOnUiThread {
                try {
                    Log.d("MainActivity", "Получено событие message-deleted от сервера")
                    if (args.isNotEmpty() && args[0] is JSONObject) {
                        val data = args[0] as JSONObject
                        val messageId = data.getString("messageId")
                        Log.d("MainActivity", "Удаляем сообщение с ID: $messageId")
                        val removed = messagesAdapter.removeMessage(messageId)
                        if (removed) {
                            Log.d("MainActivity", "✅ Сообщение успешно удалено из чата: $messageId")
                        } else {
                            Log.w("MainActivity", "⚠️ Сообщение с ID $messageId не найдено в локальном чате")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("MainActivity", "Ошибка обработки message-deleted: ${e.message}")
                }
            }
        }
    }
    private fun showDeleteConfirmationDialog(messageId: String) {
        AlertDialog.Builder(this)
            .setTitle("Удаление сообщения")
            .setMessage("Вы уверены, что хотите удалить это сообщение?")
            .setPositiveButton("Удалить") { dialog, _ ->
                dialog.dismiss()
                deleteMessage(messageId)
            }
            .setNegativeButton("Отмена") { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }
    private fun deleteMessage(messageId: String) {
        if (!isConnected) {
            Toast.makeText(this, "Нет подключения к серверу", Toast.LENGTH_SHORT).show()
            return
        }
        val deleteData = JSONObject().apply {
            put("messageId", messageId)
        }
        val messageToRemove = messagesAdapter.messagesList.find { it.id == messageId }
        if (messageToRemove == null) {
            Toast.makeText(this, "Сообщение не найдено", Toast.LENGTH_SHORT).show()
            return
        }
        temporarilyRemovedMessages[messageId] = messageToRemove
        val removed = messagesAdapter.removeMessage(messageId)
        if (!removed) {
            Toast.makeText(this, "Не удалось удалить сообщение", Toast.LENGTH_SHORT).show()
            return
        }
        Log.d("MainActivity", "Сообщение удалено локально: $messageId")
        socket?.emit("delete-message", deleteData, io.socket.client.Ack { args ->
            runOnUiThread {
                try {
                    if (args.isNotEmpty() && args[0] is JSONObject) {
                        val response = args[0] as JSONObject
                        if (response.has("error")) {
                            val error = response.getString("error")
                            Toast.makeText(
                                this@MainActivity,
                                "Ошибка: $error",
                                Toast.LENGTH_LONG
                            ).show()
                            restoreMessage(messageId)
                        } else {
                            temporarilyRemovedMessages.remove(messageId)
                            Toast.makeText(
                                this@MainActivity,
                                "Сообщение удалено",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                } catch (e: Exception) {
                    Log.e("MainActivity", "Ошибка обработки ответа удаления: ${e.message}")
                    restoreMessage(messageId)
                    Toast.makeText(
                        this@MainActivity,
                        "Ошибка соединения",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        })
    }
    private fun restoreMessage(messageId: String) {
        temporarilyRemovedMessages[messageId]?.let { message ->
            messagesAdapter.addMessage(message)
            temporarilyRemovedMessages.remove(messageId)
            Log.d("MainActivity", "Сообщение восстановлено: $messageId")
        }
    }
    private fun setupServiceMonitoring() {
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
                        Log.d("MainActivity", "Service status: $statusText")
                    }
                    val prefs = getSharedPreferences("ServiceStatus", Context.MODE_PRIVATE)
                    prefs.edit().putBoolean("isServiceRunning", isRunning).apply()
                }
            }
        }
        val filter = IntentFilter("com.natasshka.messenger.SERVICE_STATUS")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            registerReceiver(serviceStatusReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(serviceStatusReceiver, filter)
        }
    }
    private fun setupBackgroundMonitoring() {
        Log.d("MainActivity", "Setting up background monitoring...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                addSystemMessage("⚠️ Для работы фонового сервиса отключите оптимизацию батареи")
            }
        }
        android.os.Handler(mainLooper).postDelayed({
            ChatForegroundService.startService(this)
            android.os.Handler(mainLooper).postDelayed({
                checkServiceStatus()
            }, 3000)
        }, 1000)
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
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
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
    }
    private fun checkServiceStatus() {
        val prefs = getSharedPreferences("ServiceStatus", Context.MODE_PRIVATE)
        val isServiceRunning = prefs.getBoolean("isServiceRunning", false)
        if (!isServiceRunning) {
            Log.w("MainActivity", "Service not running, attempting restart...")
            android.os.Handler(mainLooper).postDelayed({
                ChatForegroundService.startService(this)
                android.os.Handler(mainLooper).postDelayed({
                    val currentStatus = prefs.getBoolean("isServiceRunning", false)
                    if (!currentStatus) {
                    }
                }, 2000)
            }, 1000)
        } else {
            Log.d("MainActivity", "Service is running")
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(packageName)
            if (!isIgnoringBatteryOptimizations) {
                android.os.Handler(mainLooper).postDelayed({
                    showBatteryOptimizationDialog()
                }, 3000)
            }
        }
    }
    private fun showBatteryOptimizationDialog() {
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
        } else if (isDeviceLocked) {
            addSystemMessage("Приложение работает на заблокированном экране")
        }
    }
    private fun updateBackgroundStatusMessage() {
        val state = when {
            isDeviceLocked && !isAppInBackground -> "Экран заблокирован, приложение активное"
            isDeviceLocked && isAppInBackground -> "Экран заблокирован, приложение в фоне"
            !isDeviceLocked && isAppInBackground -> "Приложение работает в фоновом режиме"
            else -> "Приложение активное на переднем плане"
        }
        runOnUiThread {
            Log.d("MainActivity", "App state: $state")
        }
    }
    private fun setupMessageInput() {
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
        binding.messageInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendMessage()
                hideKeyboard()
                true
            } else {
                false
            }
        }
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
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.READ_MEDIA_VIDEO)
                add(Manifest.permission.READ_MEDIA_AUDIO)
            }
        }.toTypedArray()
        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()
        if (missingPermissions.isNotEmpty()) {
            permissionLauncher.launch(missingPermissions)
        } else {
            pendingLoginData?.let { (username, room, password) ->
                connectToServer(username, room, password)
            }
        }
    }
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            PERMISSION_REQUEST_STORAGE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingFileDownload?.let { fileMessage ->
                        Toast.makeText(this, "Разрешение предоставлено. Сохраняю файл...", Toast.LENGTH_SHORT).show()
                        startFileDownload(fileMessage)
                        pendingFileDownload = null
                    }
                } else {
                    Toast.makeText(this, "Разрешение отклонено. Файл не будет сохранен", Toast.LENGTH_SHORT).show()
                    pendingFileDownload = null
                }
            }
            PERMISSION_REQUEST_RECORD_AUDIO -> {
                Log.d("AudioRecording", "onRequestPermissionsResult for RECORD_AUDIO")
                Log.d("AudioRecording", "Разрешения: ${permissions.joinToString()}")
                Log.d("AudioRecording", "Результаты: ${grantResults.joinToString()}")
                val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
                Log.d("AudioRecording", "Все разрешения предоставлены: $allGranted")
                if (allGranted) {
                    Log.d("AudioRecording", "Разрешения предоставлены, можно начинать запись")
                    Toast.makeText(this, "Разрешения предоставлены. Нажмите кнопку записи снова.", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Для записи аудио нужны все разрешения", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    private suspend fun saveFileViaMediaStore(fileMessage: FileMessage, fileData: ByteArray): Uri? {
        return withContext(Dispatchers.IO) {
            try {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileMessage.fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, fileMessage.fileType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/NATaSSHka")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }
                }
                val resolver = applicationContext.contentResolver
                val uri = resolver.insert(MediaStore.Files.getContentUri("external"), contentValues)
                uri?.let {
                    resolver.openOutputStream(it)?.use { outputStream ->
                        outputStream.write(fileData)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        contentValues.clear()
                        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                        resolver.update(uri, contentValues, null, null)
                    }
                    return@withContext uri
                }
                null
            } catch (e: Exception) {
                Log.e("MainActivity", "Ошибка сохранения через MediaStore: ${e.message}")
                null
            }
        }
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            VideoRecorder.REQUEST_VIDEO_CAPTURE -> {
                val videoUri = videoRecorder.onActivityResult(requestCode, resultCode, data)
                videoUri?.let {
                    handleFileSelection(it)
                }
            }
            AudioRecorder.REQUEST_AUDIO_CAPTURE -> {
                val audioUri = audioRecorder.onActivityResult(requestCode, resultCode, data)
                audioUri?.let {
                    handleFileSelection(it)
                }
            }
        }
    }
    private fun handleFileMessage(message: JSONObject) {
        try {
            Log.d("MainActivity", "Обработка файлового сообщения: ${message.toString()}")
            val username = message.optString("username", "unknown")
            val isSystem = message.optBoolean("isSystem", false)
            val isKillAll = message.optBoolean("isKillAll", false)
            val isWarning = message.optBoolean("isWarning", false)
            val canDelete = !isSystem && !isKillAll && !isWarning &&
                    username == currentUser
            val hasFile = message.has("isFile") && message.getBoolean("isFile")
            val hasFileData = message.has("fileData") && !message.isNull("fileData")
            val hasFileName = message.has("fileName") && !message.isNull("fileName")
            if (hasFile || hasFileData || hasFileName) {
                Log.d("MainActivity", "Это файловое сообщение")
                val fileMessage = parseFileMessageFromServer(message)
                // Убедитесь, что fileCategory определяется правильно
                Log.d("MainActivity", "File category: ${fileMessage.fileCategory}")
                Log.d("MainActivity", "File type: ${fileMessage.fileType}")
                Log.d("MainActivity", "File name: ${fileMessage.fileName}")
                val chatMessage = ChatMessage(
                    id = message.optString("id", System.currentTimeMillis().toString()),
                    username = username,
                    text = getFileMessageText(fileMessage),
                    timestamp = parseTimestamp(message.optString("timestamp")),
                    isMyMessage = username == currentUser,
                    isSystem = isSystem,
                    isEncrypted = message.optBoolean("isEncrypted", false),
                    originalEncryptedText = if (message.optBoolean("isEncrypted", false)) {
                        message.optString("text", "")
                    } else null,
                    attachedFile = fileMessage,
                    hasAttachment = true,
                    containsLinks = false,
                    canDelete = canDelete
                )
                Log.d("MainActivity", "Добавление файлового сообщения в адаптер: ${fileMessage.fileName}")
                messagesAdapter.addMessage(chatMessage)
                scrollToBottom()
            } else {
                Log.d("MainActivity", "Это обычное текстовое сообщение")
                addMessageFromServer(message)
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Ошибка обработки файлового сообщения: ${e.message}")
            e.printStackTrace()
            try {
                addMessageFromServer(message)
            } catch (e2: Exception) {
                Log.e("MainActivity", "Не удалось обработать сообщение вообще: ${e2.message}")
                addSystemMessage("Ошибка обработки сообщения: ${e.message}")
            }
        }
    }
    private fun connectToServer(username: String, room: String, password: String) {
        try {
            Log.d("MainActivity", "Connecting to server...")
            val server = intent.getStringExtra("server") ?: ServerConfig.getDefaultServer()
            Log.d("MainActivity", "Server URL: $server")
            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                reconnectionAttempts = Int.MAX_VALUE
                timeout = 10000
            }
            socket = IO.socket(server, options)
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("MainActivity", "Socket connected")
                runOnUiThread {
                    connectionAttempts = 0
                    Toast.makeText(this@MainActivity, "✅ Подключено к серверу", Toast.LENGTH_SHORT).show()
                    isConnected = true
                    joinRoom(username, room, password)
                }
            }
            socket?.on("message-deleted") { args ->
                runOnUiThread {
                    try {
                        Log.d("MainActivity", "Получено событие message-deleted от сервера")
                        if (args.isNotEmpty() && args[0] is JSONObject) {
                            val data = args[0] as JSONObject
                            val messageId = data.getString("messageId")
                            Log.d("MainActivity", "Удаляем сообщение с ID: $messageId")
                            val removed = messagesAdapter.removeMessage(messageId)
                            if (removed) {
                                Log.d("MainActivity", "✅ Сообщение успешно удалено из чата: $messageId")
                            } else {
                                Log.w("MainActivity", "⚠️ Сообщение с ID $messageId не найдено в локальном чате")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Ошибка обработки message-deleted: ${e.message}")
                    }
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
                        runOnUiThread {
                            AlertDialog.Builder(this@MainActivity)
                                .setTitle("Ошибка подключения")
                                .setMessage("Не удалось подключиться к серверу. Проверьте адрес сервера и подключение к сети.")
                                .setPositiveButton("Вернуться к входу") { dialog, _ ->
                                    dialog.dismiss()
                                    val intent = Intent(this@MainActivity, LoginActivity::class.java)
                                    intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                                    startActivity(intent)
                                    finish()
                                }
                                .setCancelable(false)
                                .show()
                        }
                    } else {
                        Toast.makeText(
                            this@MainActivity,
                            "❌ Ошибка подключения. Попытка ${connectionAttempts + 1}/$MAX_CONNECTION_ATTEMPTS через 3 секунды...",
                            Toast.LENGTH_LONG
                        ).show()
                        addSystemMessage("Попытка подключения $connectionAttempts/$MAX_CONNECTION_ATTEMPTS не удалась")
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
                        binding.sidebarHeader.text = "Комната: $joinedRoom"
                        binding.userInfo.text = "✪ $username"

                        if (data.has("users")) {
                            updateUsersList(data.getJSONArray("users"))
                        }

                        if (data.has("messageHistory")) {
                            val messageHistory = data.getJSONArray("messageHistory")
                            Log.d("MainActivity", "Загружаем историю сообщений: ${messageHistory.length()} сообщений")
                            for (i in 0 until messageHistory.length()) {
                                val message = messageHistory.getJSONObject(i)
                                Log.d("MainActivity", "Сообщение из истории: ${message.toString()}")
                                val hasFile = message.has("isFile") && message.getBoolean("isFile")
                                val hasFileData = message.has("fileData") && !message.isNull("fileData")
                                val hasFileName = message.has("fileName") && !message.isNull("fileName")
                                if (hasFile || hasFileData || hasFileName) {
                                    Log.d("MainActivity", "Обработка файлового сообщения из истории")
                                    handleFileMessage(message)
                                } else {
                                    Log.d("MainActivity", "Обработка текстового сообщения из истории")
                                    addMessageFromServer(message)
                                }
                            }
                        }
                        if (data.has("users")) {
                            updateUsersList(data.getJSONArray("users"))
                        }
                        addSystemMessage("Вы вошли в комнату $joinedRoom как $joinedUser")
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing user-joined: ${e.message}")
                        e.printStackTrace()
                    }
                }
            }
            socket?.on("new-message") { args ->
                Log.d("MainActivity", "new-message event received, args count: ${args.size}")
                runOnUiThread {
                    try {
                        if (args.isNotEmpty() && args[0] is JSONObject) {
                            val message = args[0] as JSONObject
                            Log.d("MainActivity", "Получено сообщение от: ${message.optString("username", "unknown")}")
                            Log.d("MainActivity", "Тип сообщения: isFile=${message.optBoolean("isFile", false)}, hasFileData=${message.has("fileData")}")
                            val hasFile = message.has("isFile") && message.getBoolean("isFile")
                            val hasFileData = message.has("fileData") && !message.isNull("fileData")
                            val hasFileName = message.has("fileName") && !message.isNull("fileName")
                            if (hasFile || hasFileData || hasFileName) {
                                Log.d("MainActivity", "Обработка как файловое сообщение")
                                handleFileMessage(message)
                            } else {
                                Log.d("MainActivity", "Обработка как текстовое сообщение")
                                handleBackgroundMessage(message)
                            }
                            if (isAppInBackground || isDeviceLocked) {
                                showNotification(message)
                            }
                        } else {
                            Log.w("MainActivity", "Пустой или неверный аргумент в new-message")
                        }
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing new-message: ${e.message}")
                        e.printStackTrace()
                    }
                }
            }
            socket?.on("file-message") { args ->
                Log.d("MainActivity", "file-message event received")
                runOnUiThread {
                    try {
                        val message = args[0] as JSONObject
                        handleFileMessage(message)
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing file-message: ${e.message}")
                    }
                }
            }
            socket?.on("file-upload-progress") { args ->
                runOnUiThread {
                    try {
                        val data = args[0] as JSONObject
                        val progress = data.getInt("progress")
                        val fileName = data.getString("fileName")
                        showFileUploadIndicator("$fileName ($progress%)")
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing file-upload-progress: ${e.message}")
                    }
                }
            }
            socket?.on("file-download-progress") { args ->
                runOnUiThread {
                    try {
                        val data = args[0] as JSONObject
                        val progress = data.getInt("progress")
                        val fileName = data.getString("fileName")
                        showFileDownloadProgress(fileName, progress)
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Error processing file-download-progress: ${e.message}")
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
                    if (error.contains("password", ignoreCase = true) ||
                        error.contains("парол", ignoreCase = true)) {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("Ошибка входа")
                            .setMessage("Неправильный пароль. Попробуйте снова.")
                            .setPositiveButton("OK") { dialog, _ ->
                                dialog.dismiss()
                                val intent = Intent(this@MainActivity, LoginActivity::class.java)
                                intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                                startActivity(intent)
                                finish()
                            }
                            .setCancelable(false)
                            .show()
                    } else {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("Ошибка входа")
                            .setMessage(error)
                            .setPositiveButton("OK") { dialog, _ ->
                                dialog.dismiss()
                                val intent = Intent(this@MainActivity, LoginActivity::class.java)
                                intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                                startActivity(intent)
                                finish()
                            }
                            .setCancelable(false)
                            .show()
                    }
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
                    AlertDialog.Builder(this)
                        .setTitle("Превышено количество попыток")
                        .setMessage("Не удалось подключиться после $MAX_CONNECTION_ATTEMPTS попыток")
                        .setPositiveButton("Вернуться к входу") { d, _ ->
                            d.dismiss()
                            val intent = Intent(this, LoginActivity::class.java)
                            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                            startActivity(intent)
                            finish()
                        }
                        .setCancelable(false)
                        .show()
                } else {
                    addSystemMessage("Попытка повторного подключения $connectionAttempts/$MAX_CONNECTION_ATTEMPTS...")
                    socket?.disconnect()
                    socket?.off()
                    socket = null
                    android.os.Handler(mainLooper).postDelayed({
                        connectToServer(username, room, password)
                    }, RECONNECT_DELAY)
                }
            }
            .setNegativeButton("Выйти") { dialog, _ ->
                dialog.dismiss()
                val intent = Intent(this, LoginActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(intent)
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
        var text = binding.messageInput.text.toString().trim()
        text = checkClipboardForLinks(text)
        if (text.isEmpty()) {
            Toast.makeText(this, "Введите сообщение", Toast.LENGTH_SHORT).show()
            return
        }
        if (!isConnected) {
            Toast.makeText(this, "Нет подключения к серверу", Toast.LENGTH_SHORT).show()
            return
        }
        val encryptedText = if (encryptionKey.isNotEmpty()) {
            CryptoJSCompat.encryptText(text, encryptionKey)
        } else {
            text
        }
        val isEncrypted = encryptionKey.isNotEmpty()
        val messageData = JSONObject().apply {
            put("text", encryptedText)
            put("isEncrypted", isEncrypted)
        }
        socket?.emit("send-message", messageData)
        binding.messageInput.text?.clear()
        hideKeyboard()
        scrollToBottom()
    }
    private fun parseReceivedMessage(text: String, isEncrypted: Boolean): String {
        return text
    }
    private fun handleBackgroundMessage(message: JSONObject) {
        runOnUiThread {
            addMessageFromServer(message)
            if (isAppInBackground || isDeviceLocked) {
                showNotification(message)
            }
        }
    }
    private fun getFileMessageText(fileMessage: FileMessage): String {
        return when (fileMessage.fileCategory) {
            FileManager.FileType.IMAGE -> "📷 Изображение: ${fileMessage.fileName}"
            FileManager.FileType.VIDEO -> {
                if (fileMessage.duration > 0) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    "🎥 Видео (${minutes}:${String.format("%02d", seconds)}): ${fileMessage.fileName}"
                } else {
                    "🎥 Видео: ${fileMessage.fileName}"
                }
            }
            FileManager.FileType.AUDIO -> {
                if (fileMessage.duration > 0) {
                    val minutes = fileMessage.duration / 1000 / 60
                    val seconds = (fileMessage.duration / 1000) % 60
                    "🎵 Аудио (${minutes}:${String.format("%02d", seconds)}): ${fileMessage.fileName}"
                } else {
                    "🎵 Аудио: ${fileMessage.fileName}"
                }
            }
            FileManager.FileType.DOCUMENT -> "📄 Файл: ${fileMessage.fileName}"
        }
    }
    private fun parseFileMessageFromServer(message: JSONObject): FileMessage {
        val fileManager = FileManager(this)
        try {
            val fileName = message.optString("fileName", "unknown_file")
            val fileType = message.optString("fileType", "*/*")
            var fileSize: Long = 0L
            try {
                val fileSizeStr = message.optString("fileSize", "0")
                if (fileSizeStr.contains("МБ") || fileSizeStr.contains("KB") || fileSizeStr.contains("MB")) {
                    fileSize = parseFileSizeString(fileSizeStr)
                } else {
                    fileSize = fileSizeStr.toLongOrNull() ?: 0L
                }
            } catch (e: Exception) {
                Log.w("MainActivity", "Ошибка парсинга fileSize: ${e.message}")
                fileSize = 0L
            }
            val isEncrypted = message.optBoolean("isEncrypted", false)
            var fileUrl: String? = null
            if (message.has("fileUrl")) {
                fileUrl = message.optString("fileUrl", null)
            }
            var fileData: String? = null
            if (message.has("fileData")) {
                fileData = message.optString("fileData", null)
            }
            Log.d("MainActivity", "Парсинг файла: name=$fileName, type=$fileType, size=$fileSize")
            return FileMessage(
                id = message.optString("fileId", message.optString("id", System.currentTimeMillis().toString())),
                messageId = message.optString("id", System.currentTimeMillis().toString()),
                fileName = fileName,
                fileType = fileType,
                fileSize = fileSize,
                fileUrl = fileUrl,
                fileData = fileData,
                localPath = null,
                isEncrypted = isEncrypted,
                fileCategory = fileManager.getFileType(fileType, fileName),
                duration = message.optLong("duration", 0),
                uploadProgress = 0,
                isDownloading = false,
                isUploading = false
            )
        } catch (e: Exception) {
            Log.e("MainActivity", "Ошибка парсинга файлового сообщения: ${e.message}")
            return FileMessage(
                id = System.currentTimeMillis().toString(),
                messageId = message.optString("id", System.currentTimeMillis().toString()),
                fileName = "error_file",
                fileType = "*/*",
                fileSize = 0L,
                fileUrl = null,
                fileData = null,
                localPath = null,
                isEncrypted = false,
                fileCategory = FileManager.FileType.DOCUMENT,
                duration = 0,
                uploadProgress = 0,
                isDownloading = false,
                isUploading = false
            )
        }
    }
    private fun parseFileSizeString(sizeStr: String): Long {
        return try {
            val cleaned = sizeStr.replace("МБ", "")
                .replace("MB", "")
                .replace("KB", "")
                .replace("КБ", "")
                .replace(" ", "")
                .trim()
            val size = cleaned.toDoubleOrNull() ?: 0.0
            when {
                sizeStr.contains("МБ") || sizeStr.contains("MB") -> (size * 1024 * 1024).toLong()
                sizeStr.contains("КБ") || sizeStr.contains("KB") -> (size * 1024).toLong()
                else -> size.toLong()
            }
        } catch (e: Exception) {
            0L
        }
    }
    private fun showNotification(message: JSONObject) {
        try {
            val username = message.getString("username")
            val text = message.getString("text")
            val isSystem = message.optBoolean("isSystem", false)
            val isEncrypted = message.optBoolean("isEncrypted", false)
            if (isSystem) return
            if (username == currentUser) return
            val displayText = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    CryptoJSCompat.decryptText(text, encryptionKey)
                } catch (e: Exception) {
                    "🔒 Зашифрованное сообщение"
                }
            } else if (isEncrypted) {
                "🔒 Зашифрованное сообщение"
            } else {
                text
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
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
                .setContentText(displayText)
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
            val text = message.optString("text", "")
            val isSystem = message.optBoolean("isSystem", false)
            val isKillAll = message.optBoolean("isKillAll", false)
            val isWarning = message.optBoolean("isWarning", false)
            val timestamp = message.optString("timestamp", Date().toString())
            val isEncrypted = message.optBoolean("isEncrypted", false) ||
                    CryptoJSCompat.isCryptoJSEncrypted(text)
            val displayText = if (isEncrypted && encryptionKey.isNotEmpty()) {
                try {
                    CryptoJSCompat.decryptText(text, encryptionKey)
                } catch (e: Exception) {
                    "🔒 Неверный ключ шифрования"
                }
            } else if (isEncrypted) {
                "🔒 Зашифрованное сообщение"
            } else {
                text
            }
            val canDelete = !isSystem && !isKillAll && !isWarning &&
                    username == currentUser
            val chatMessage = ChatMessage(
                id = message.optString("id", System.currentTimeMillis().toString()),
                username = username,
                text = displayText,
                timestamp = parseTimestamp(timestamp),
                isMyMessage = username == currentUser,
                isSystem = isSystem,
                isEncrypted = isEncrypted,
                originalEncryptedText = if (isEncrypted) text else null,
                attachedFile = null,
                hasAttachment = false,
                containsLinks = linkParser.containsLinks(displayText),
                canDelete = canDelete
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
            isEncrypted = false,
            originalEncryptedText = null,
            attachedFile = null,
            hasAttachment = false
        )
        messagesAdapter.addMessage(systemMessage)
    }
    private fun updateUsersList(users: JSONArray) {
        val usersList = mutableListOf<String>()
        for (i in 0 until users.length()) {
            val user = users.getJSONObject(i)
            usersList.add(user.getString("username"))
        }

        val usersCount = usersList.size
        binding.userInfo.text = "✪ $currentUser (всего: $usersCount)"

        // Обновляем список пользователей в адаптере
        usersAdapter.updateUsers(usersList)
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
        val toggleBtn = binding.sidebarToggleBtn

        if (sidebar.visibility == View.VISIBLE) {
            // Закрываем боковую панель (движение влево за пределы экрана)
            sidebar.animate()
                .translationX(-sidebar.width.toFloat())
                .setDuration(300)
                .setInterpolator(AccelerateInterpolator())
                .withEndAction {
                    sidebar.visibility = View.GONE
                }
                .start()

            // Возвращаем стрелку вправо
            toggleBtn.rotationY = 0f
        } else {
            // Открываем боковую панель (движение справа налево)
            sidebar.translationX = -sidebar.width.toFloat()
            sidebar.visibility = View.VISIBLE
            sidebar.animate()
                .translationX(0f)
                .setDuration(300)
                .setInterpolator(DecelerateInterpolator())
                .start()

            // Отражаем стрелку влево (зеркально)
            toggleBtn.rotationY = 180f
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
}