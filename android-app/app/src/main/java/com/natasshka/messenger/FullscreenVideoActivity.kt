package com.natasshka.messenger

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.natasshka.messenger.databinding.ActivityFullscreenVideoBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URL

class FullscreenVideoActivity : AppCompatActivity() {
    private lateinit var binding: ActivityFullscreenVideoBinding
    private lateinit var fileManager: FileManager
    private lateinit var currentVideoUri: Uri
    private var isEncrypted = false
    private var encryptionKey = ""
    private var fileName = ""
    private var fileData: String? = null
    private var tempVideoFile: File? = null

    // Флаг для отслеживания ошибки дешифрации
    private var decryptionError = false

    // Параметры для зума
    private var scaleFactor = 1.0f
    private val minScale = 1.0f
    private val maxScale = 3.0f  // Максимальное приближение в 3 раза

    // Параметры для перемещения
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isDragging = false
    private var isScaling = false
    private var translateX = 0f
    private var translateY = 0f

    // Оригинальные размеры видео
    private var originalVideoWidth = 0
    private var originalVideoHeight = 0
    private var videoAspectRatio = 1f

    // Детекторы жестов
    private lateinit var scaleGestureDetector: ScaleGestureDetector
    private lateinit var gestureDetector: GestureDetector

    companion object {
        const val EXTRA_VIDEO_PATH = "video_path"
        const val EXTRA_VIDEO_URL = "video_url"
        const val EXTRA_VIDEO_BASE64 = "video_base64"
        const val EXTRA_FILE_NAME = "file_name"
        const val EXTRA_IS_ENCRYPTED = "is_encrypted"
        const val EXTRA_ENCRYPTION_KEY = "encryption_key"
        const val EXTRA_FILE_DATA = "file_data"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Полноэкранный режим
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                )

        binding = ActivityFullscreenVideoBinding.inflate(layoutInflater)
        setContentView(binding.root)

        fileManager = FileManager(this)

        // Инициализируем детекторы жестов
        setupGestureDetectors()
        setupUI()
        parseIntentDataAndLoad()
    }

    private fun setupGestureDetectors() {
        // Детектор масштабирования двумя пальцами
        scaleGestureDetector = ScaleGestureDetector(this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
                    isScaling = true
                    return true
                }

                override fun onScale(detector: ScaleGestureDetector): Boolean {
                    val newScaleFactor = scaleFactor * detector.scaleFactor
                    scaleFactor = newScaleFactor.coerceIn(minScale, maxScale)

                    // Обновляем размер видео с учетом зума
                    updateVideoLayout()
                    return true
                }

                override fun onScaleEnd(detector: ScaleGestureDetector) {
                    isScaling = false
                    // Корректируем позицию после зума
                    limitTranslation()
                }
            })

        // Детектор жестов для перетаскивания и двойного тапа
        gestureDetector = GestureDetector(this,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    // Двойной тап сбрасывает зум и позицию
                    resetZoomAndPosition()
                    return true
                }

                override fun onScroll(
                    e1: MotionEvent?,
                    e2: MotionEvent,
                    distanceX: Float,
                    distanceY: Float
                ): Boolean {
                    // Прокрутка для перетаскивания при зуме
                    if (scaleFactor > 1.0f && !isScaling) {
                        isDragging = true

                        // Перемещаем видео
                        translateX -= distanceX
                        translateY -= distanceY

                        // Ограничиваем перемещение
                        limitTranslation()

                        // Обновляем позицию видео
                        updateVideoLayout()
                        return true
                    }
                    return false
                }
            })

        // Обработчик касаний для VideoView
        binding.videoView.setOnTouchListener { _, event ->
            scaleGestureDetector.onTouchEvent(event)
            gestureDetector.onTouchEvent(event)

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastTouchX = event.x
                    lastTouchY = event.y
                    isDragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    // Прямое перетаскивание пальцем (без жеста скролла)
                    if (scaleFactor > 1.0f && !isScaling) {
                        val deltaX = event.x - lastTouchX
                        val deltaY = event.y - lastTouchY

                        translateX += deltaX
                        translateY += deltaY

                        lastTouchX = event.x
                        lastTouchY = event.y

                        limitTranslation()
                        updateVideoLayout()
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (!isScaling && !isDragging) {
                        // Одиночное касание - переключаем видимость кнопок
                        toggleControls()
                    }
                    isDragging = false
                }
            }
            true
        }
    }

    private fun setupUI() {
        // Настраиваем VideoView для сохранения пропорций
        binding.videoView.setOnPreparedListener { mp ->
            // Получаем размеры видео
            originalVideoWidth = mp.videoWidth
            originalVideoHeight = mp.videoHeight

            if (originalVideoWidth > 0 && originalVideoHeight > 0) {
                videoAspectRatio = originalVideoWidth.toFloat() / originalVideoHeight.toFloat()

                // Рассчитываем исходные размеры с сохранением пропорций
                calculateInitialVideoSize()

                // Запускаем воспроизведение
                mp.start()
            }

            // Скрываем прогресс-бар
            hideLoading()
        }

        binding.videoView.setOnErrorListener { _, what, extra ->
            Log.e("FullscreenVideoActivity", "VideoView error: what=$what, extra=$extra")

            // Определяем тип ошибки
            val errorMessage = if (decryptionError) {
                "❌ Ошибка дешифрации видео"
            } else {
                "❌ Ошибка воспроизведения видео"
            }

            showToast(errorMessage)
            hideLoading()

            Handler(Looper.getMainLooper()).postDelayed({
                cleanupTempFiles()
                finish()
            }, 2000)
            true
        }

        binding.videoView.setOnCompletionListener {
            // При завершении видео возвращаемся к началу
            it.seekTo(0)
            it.start()
        }

        binding.closeButton.setOnClickListener {
            cleanupTempFiles()
            finish()
        }

        binding.saveButton.setOnClickListener {
            saveVideoToStorage()
        }

        showLoading()
    }

    private fun calculateInitialVideoSize() {
        val screenWidth = resources.displayMetrics.widthPixels
        val screenHeight = resources.displayMetrics.heightPixels

        // Рассчитываем размер видео с сохранением пропорций
        var videoWidth = screenWidth
        var videoHeight = (screenWidth / videoAspectRatio).toInt()

        // Если видео слишком высокое, подгоняем по высоте
        if (videoHeight > screenHeight) {
            videoHeight = screenHeight
            videoWidth = (screenHeight * videoAspectRatio).toInt()
        }

        // Устанавливаем размеры VideoView
        val layoutParams = binding.videoView.layoutParams as FrameLayout.LayoutParams
        layoutParams.width = videoWidth
        layoutParams.height = videoHeight
        layoutParams.gravity = android.view.Gravity.CENTER

        binding.videoView.layoutParams = layoutParams

        // Сбрасываем параметры зума и позиции
        scaleFactor = 1.0f
        translateX = 0f
        translateY = 0f
    }

    private fun updateVideoLayout() {
        val layoutParams = binding.videoView.layoutParams as FrameLayout.LayoutParams

        // Вычисляем размер видео с учетом зума
        val screenWidth = resources.displayMetrics.widthPixels
        val screenHeight = resources.displayMetrics.heightPixels

        var videoWidth = (screenWidth * scaleFactor).toInt()
        var videoHeight = (videoWidth / videoAspectRatio).toInt()

        // Если видео слишком высокое, подгоняем по высоте
        if (videoHeight > screenHeight * scaleFactor) {
            videoHeight = (screenHeight * scaleFactor).toInt()
            videoWidth = (videoHeight * videoAspectRatio).toInt()
        }

        // Устанавливаем размеры
        layoutParams.width = videoWidth
        layoutParams.height = videoHeight

        // Вычисляем позицию с учетом перемещения
        val gravity = android.view.Gravity.CENTER

        // Применяем смещение от центра
        layoutParams.gravity = gravity
        layoutParams.leftMargin = translateX.toInt()
        layoutParams.topMargin = translateY.toInt()

        binding.videoView.layoutParams = layoutParams
        binding.videoView.requestLayout()
    }

    private fun limitTranslation() {
        val layoutParams = binding.videoView.layoutParams as FrameLayout.LayoutParams
        val screenWidth = resources.displayMetrics.widthPixels
        val screenHeight = resources.displayMetrics.heightPixels

        val videoWidth = layoutParams.width
        val videoHeight = layoutParams.height

        if (videoWidth <= 0 || videoHeight <= 0) return

        // Максимальное смещение влево/вправо
        val maxTranslateX = if (videoWidth > screenWidth) {
            (videoWidth - screenWidth) / 2f
        } else {
            0f
        }

        // Максимальное смещение вверх/вниз
        val maxTranslateY = if (videoHeight > screenHeight) {
            (videoHeight - screenHeight) / 2f
        } else {
            0f
        }

        // Ограничиваем смещение
        translateX = translateX.coerceIn(-maxTranslateX, maxTranslateX)
        translateY = translateY.coerceIn(-maxTranslateY, maxTranslateY)
    }

    private fun resetZoomAndPosition() {
        scaleFactor = 1.0f
        translateX = 0f
        translateY = 0f
        updateVideoLayout()
    }

    private fun toggleControls() {
        val isVisible = binding.closeButton.visibility == View.VISIBLE
        if (isVisible) {
            binding.closeButton.visibility = View.GONE
            binding.saveButton.visibility = View.GONE
        } else {
            binding.closeButton.visibility = View.VISIBLE
            binding.saveButton.visibility = View.VISIBLE
        }
    }

    private fun parseIntentDataAndLoad() {
        fileName = intent.getStringExtra(EXTRA_FILE_NAME) ?: "video.webm"
        isEncrypted = intent.getBooleanExtra(EXTRA_IS_ENCRYPTED, false)
        encryptionKey = intent.getStringExtra(EXTRA_ENCRYPTION_KEY) ?: ""
        fileData = intent.getStringExtra(EXTRA_FILE_DATA)

        when {
            intent.hasExtra(EXTRA_VIDEO_PATH) -> {
                val path = intent.getStringExtra(EXTRA_VIDEO_PATH)!!
                currentVideoUri = Uri.fromFile(File(path))
                loadVideo()
            }
            intent.hasExtra(EXTRA_VIDEO_URL) -> {
                val url = intent.getStringExtra(EXTRA_VIDEO_URL)!!
                if (isEncrypted && encryptionKey.isNotEmpty()) {
                    loadAndDecryptVideoFromUrl(url)
                } else {
                    currentVideoUri = Uri.parse(url)
                    loadVideo()
                }
            }
            intent.hasExtra(EXTRA_VIDEO_BASE64) || fileData != null -> {
                createTempVideoFile()
            }
            else -> {
                showToast("Нет данных для загрузки видео")
                finish()
            }
        }
    }

    private fun createTempVideoFile() {
        showLoading()
        decryptionError = false // Сбрасываем флаг ошибки дешифрации

        // Проверяем: если видео зашифровано, но ключ пустой - сразу ошибка дешифрации
        if (isEncrypted && encryptionKey.isEmpty()) {
            decryptionError = true
            runOnUiThread {
                showToast("❌ Ошибка дешифрации: неверный ключ или поврежденные данные")
                hideLoading()
                Handler(Looper.getMainLooper()).postDelayed({
                    cleanupTempFiles()
                    finish()
                }, 2000)
            }
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val base64Data = fileData ?: intent.getStringExtra(EXTRA_VIDEO_BASE64) ?: ""
                if (base64Data.isEmpty()) {
                    runOnUiThread {
                        showToast("Пустые данные видео")
                        finish()
                    }
                    return@launch
                }

                val videoBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        // Пробуем расшифровать видео
                        CryptoJSCompat.decryptFileCompatibleJS(base64Data, encryptionKey)
                    } catch (e: Exception) {
                        // Если произошла ошибка при дешифрации
                        decryptionError = true
                        Log.e("FullscreenVideoActivity", "Ошибка дешифрации: ${e.message}")

                        runOnUiThread {
                            showToast("❌ Ошибка дешифрации: неверный ключ или поврежденные данные")
                            Handler(Looper.getMainLooper()).postDelayed({
                                cleanupTempFiles()
                                finish()
                            }, 2000)
                        }
                        return@launch
                    }
                } else {
                    // Если не зашифровано или ключ пустой (но мы уже проверили выше)
                    try {
                        android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    } catch (e: Exception) {
                        // Если не удалось декодировать Base64, возможно это зашифрованные данные
                        if (isEncrypted) {
                            decryptionError = true
                            runOnUiThread {
                                showToast("❌ Ошибка дешифрации: неверный ключ или поврежденные данные")
                                Handler(Looper.getMainLooper()).postDelayed({
                                    cleanupTempFiles()
                                    finish()
                                }, 2000)
                            }
                            return@launch
                        } else {
                            runOnUiThread {
                                showToast("Ошибка декодирования Base64: ${e.message}")
                                finish()
                            }
                            return@launch
                        }
                    }
                }

                // Проверяем, что данные не пустые после дешифрации/декодирования
                if (videoBytes.isEmpty()) {
                    decryptionError = true
                    runOnUiThread {
                        showToast("❌ Ошибка дешифрации: получены пустые данные")
                        Handler(Looper.getMainLooper()).postDelayed({
                            cleanupTempFiles()
                            finish()
                        }, 2000)
                    }
                    return@launch
                }

                // Создаем временный файл
                tempVideoFile = File(cacheDir, "temp_video_${System.currentTimeMillis()}.webm")
                tempVideoFile!!.outputStream().use { it.write(videoBytes) }
                currentVideoUri = Uri.fromFile(tempVideoFile!!)

                runOnUiThread {
                    hideLoading()
                    loadVideo()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    hideLoading()
                    // Проверяем, была ли это ошибка дешифрации
                    val errorMessage = if (decryptionError) {
                        "❌ Ошибка дешифрации видео"
                    } else {
                        "Ошибка создания временного файла: ${e.message}"
                    }
                    showToast(errorMessage)
                    finish()
                }
            }
        }
    }

    private fun loadAndDecryptVideoFromUrl(url: String) {
        showLoading()
        decryptionError = false // Сбрасываем флаг ошибки дешифрации

        // Проверяем: если видео зашифровано, но ключ пустой - сразу ошибка дешифрации
        if (isEncrypted && encryptionKey.isEmpty()) {
            decryptionError = true
            runOnUiThread {
                showToast("❌ Ошибка дешифрации: неверный ключ или поврежденные данные")
                hideLoading()
                Handler(Looper.getMainLooper()).postDelayed({
                    cleanupTempFiles()
                    finish()
                }, 2000)
            }
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val urlConnection = URL(url).openConnection()
                urlConnection.connectTimeout = 10000
                urlConnection.readTimeout = 10000
                val inputStream = urlConnection.getInputStream()
                val encryptedBytes = inputStream.readBytes()
                val encryptedBase64 = android.util.Base64.encodeToString(encryptedBytes, android.util.Base64.NO_WRAP)

                val decryptedBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        // Пробуем расшифровать видео
                        CryptoJSCompat.decryptFileCompatibleJS(encryptedBase64, encryptionKey)
                    } catch (e: Exception) {
                        // Если произошла ошибка при дешифрации
                        decryptionError = true
                        Log.e("FullscreenVideoActivity", "Ошибка дешифрации из URL: ${e.message}")

                        runOnUiThread {
                            showToast("❌ Ошибка дешифрации: неверный ключ или поврежденные данные")
                            Handler(Looper.getMainLooper()).postDelayed({
                                cleanupTempFiles()
                                finish()
                            }, 2000)
                        }
                        return@launch
                    }
                } else {
                    encryptedBytes
                }

                // Проверяем, что данные не пустые после дешифрации
                if (decryptedBytes.isEmpty()) {
                    decryptionError = true
                    runOnUiThread {
                        showToast("❌ Ошибка дешифрации: получены пустые данные")
                        Handler(Looper.getMainLooper()).postDelayed({
                            cleanupTempFiles()
                            finish()
                        }, 2000)
                    }
                    return@launch
                }

                val extension = if (fileName.contains(".")) {
                    fileName.substringAfterLast(".")
                } else {
                    "mp4"
                }

                tempVideoFile = File(cacheDir, "temp_video_${System.currentTimeMillis()}.$extension")
                tempVideoFile!!.outputStream().use { it.write(decryptedBytes) }
                currentVideoUri = Uri.fromFile(tempVideoFile!!)

                runOnUiThread {
                    hideLoading()
                    loadVideo()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    hideLoading()
                    // Проверяем, была ли это ошибка дешифрации
                    val errorMessage = if (decryptionError) {
                        "❌ Ошибка дешифрации видео"
                    } else {
                        "Ошибка загрузки видео: ${e.message}"
                    }
                    showToast(errorMessage)
                    finish()
                }
            }
        }
    }

    private fun loadVideo() {
        if (::currentVideoUri.isInitialized) {
            binding.videoView.setVideoURI(currentVideoUri)
            binding.videoView.visibility = View.VISIBLE
        } else {
            showToast("URI видео не инициализирован")
            finish()
        }
    }

    private fun saveVideoToStorage() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                runOnUiThread {
                    showLoading()
                }

                // Получаем видео данные
                val videoBytes = when {
                    // 1. Используем уже созданный временный файл
                    tempVideoFile != null && tempVideoFile!!.exists() -> {
                        tempVideoFile!!.readBytes()
                    }

                    // 2. Если это файловый URI
                    currentVideoUri.scheme == "file" -> {
                        File(currentVideoUri.path).readBytes()
                    }

                    // 3. Если это content URI (локальный файл через FileProvider)
                    currentVideoUri.scheme == "content" -> {
                        contentResolver.openInputStream(currentVideoUri)?.readBytes() ?: byteArrayOf()
                    }

                    // 4. Если это HTTP/HTTPS URL - скачиваем заново
                    currentVideoUri.scheme == "http" || currentVideoUri.scheme == "https" -> {
                        downloadVideoFromUrl(currentVideoUri.toString())
                    }

                    else -> {
                        // Пытаемся открыть как поток
                        try {
                            contentResolver.openInputStream(currentVideoUri)?.readBytes() ?: byteArrayOf()
                        } catch (e: Exception) {
                            byteArrayOf()
                        }
                    }
                }

                if (videoBytes.isEmpty()) {
                    throw Exception("Не удалось прочитать данные видео")
                }

                // Сохраняем файл
                val savedFile = saveVideoBytesToFile(videoBytes, fileName)

                runOnUiThread {
                    hideLoading()
                    showToast("✅ Видео сохранено: ${savedFile.name}")
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    hideLoading()
                    showToast("❌ Ошибка сохранения: ${e.message}")
                }
            }
        }
    }

    /**
     * Скачивает видео по HTTP/HTTPS URL
     */
    private suspend fun downloadVideoFromUrl(url: String): ByteArray = withContext(Dispatchers.IO) {
        try {
            Log.d("FullscreenVideoActivity", "Скачивание видео по URL: $url")

            val connection = URL(url).openConnection()
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            connection.connect()

            val inputStream = connection.getInputStream()
            val buffer = ByteArray(8192)
            val outputStream = ByteArrayOutputStream()

            var bytesRead: Int
            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
            }

            inputStream.close()
            val videoBytes = outputStream.toByteArray()
            outputStream.close()

            Log.d("FullscreenVideoActivity", "✅ Видео скачано успешно, размер: ${videoBytes.size} байт")
            return@withContext videoBytes
        } catch (e: Exception) {
            Log.e("FullscreenVideoActivity", "❌ Ошибка скачивания видео по URL: $url", e)
            throw Exception("Ошибка скачивания видео: ${e.message}")
        }
    }

    /**
     * Сохраняет байты видео в файл (уже расшифрованные)
     */
    private fun saveVideoBytesToFile(videoBytes: ByteArray, fileName: String): File {
        val fileManager = FileManager(this)
        val downloadsDir = fileManager.getDownloadsPath()

        val extension = if (fileName.contains(".")) {
            fileName.substringAfterLast(".")
        } else {
            "mp4"
        }

        val cleanFileName = if (fileName.contains(".")) {
            fileName
        } else {
            "$fileName.$extension"
        }

        var outputFile = File(downloadsDir, cleanFileName)
        var counter = 1
        while (outputFile.exists()) {
            val nameWithoutExt = cleanFileName.substringBeforeLast(".")
            val ext = cleanFileName.substringAfterLast(".", "mp4")
            outputFile = File(downloadsDir, "${nameWithoutExt}_$counter.$ext")
            counter++
        }

        outputFile.outputStream().use { output ->
            output.write(videoBytes)
            output.flush()
        }

        // Сканируем файл для отображения в галерее
        MediaScannerConnection.scanFile(
            this,
            arrayOf(outputFile.absolutePath),
            null,
            null
        )

        return outputFile
    }

    private fun cleanupTempFiles() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                tempVideoFile?.let { file ->
                    if (file.exists()) {
                        file.delete()
                    }
                }
            } catch (e: Exception) {
                // Игнорируем ошибки очистки
            }
        }
    }

    override fun onBackPressed() {
        cleanupTempFiles()
        super.onBackPressed()
    }

    override fun onPause() {
        super.onPause()
        binding.videoView.pause()
    }

    override fun onResume() {
        super.onResume()
        if (!binding.videoView.isPlaying) {
            binding.videoView.start()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        binding.videoView.stopPlayback()
        cleanupTempFiles()
    }

    private fun showLoading() {
        runOnUiThread {
            binding.progressBar.isVisible = true
            binding.videoView.visibility = View.GONE
            binding.closeButton.visibility = View.VISIBLE
            binding.saveButton.visibility = View.VISIBLE
        }
    }

    private fun hideLoading() {
        runOnUiThread {
            binding.progressBar.isVisible = false
            binding.videoView.visibility = View.VISIBLE
            binding.closeButton.visibility = View.VISIBLE
            binding.saveButton.visibility = View.VISIBLE
        }
    }

    private fun showToast(message: String) {
        runOnUiThread {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
        }
    }
}