package com.natasshka.messenger

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
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
        setupUI()
        parseIntentDataAndLoad()
    }

    private fun setupUI() {
        binding.zoomableVideoView.onErrorCallback = { errorMessage ->
            runOnUiThread {
                showToast("❌ $errorMessage")
                Handler(Looper.getMainLooper()).postDelayed({
                    cleanupTempFiles()
                    finish()
                }, 2000)
            }
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
                        CryptoJSCompat.decryptFileCompatibleJS(base64Data, encryptionKey)
                    } catch (e: Exception) {
                        runOnUiThread {
                            showToast("❌ Ошибка дешифрования: неверный ключ или поврежденные данные")
                            Handler(Looper.getMainLooper()).postDelayed({
                                cleanupTempFiles()
                                finish()
                            }, 2000)
                        }
                        return@launch
                    }
                } else {
                    try {
                        android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    } catch (e: Exception) {
                        runOnUiThread {
                            showToast("Ошибка декодирования Base64: ${e.message}")
                            finish()
                        }
                        return@launch
                    }
                }
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
                    showToast("Ошибка создания временного файла: ${e.message}")
                    finish()
                }
            }
        }
    }

    private fun loadAndDecryptVideoFromUrl(url: String) {
        showLoading()
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
                        CryptoJSCompat.decryptFileCompatibleJS(encryptedBase64, encryptionKey)
                    } catch (e: Exception) {
                        runOnUiThread {
                            showToast("❌ Ошибка дешифрования: неверный ключ или поврежденные данные")
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
                    showToast("Ошибка загрузки видео: ${e.message}")
                    finish()
                }
            }
        }
    }

    private fun loadVideo() {
        if (::currentVideoUri.isInitialized) {
            setupVideoPlayer()
        } else {
            showToast("URI видео не инициализирован")
            finish()
        }
    }

    private fun setupVideoPlayer() {
        binding.zoomableVideoView.isVisible = true
        binding.zoomableVideoView.setVideoUri(currentVideoUri, isEncrypted, encryptionKey)
        binding.zoomableVideoView.setLooping(true)
        Handler(Looper.getMainLooper()).postDelayed({
            binding.zoomableVideoView.play()
            hideLoading()
        }, 500)
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
        binding.zoomableVideoView.pause()
    }

    override fun onResume() {
        super.onResume()
        binding.zoomableVideoView.play()
    }

    override fun onDestroy() {
        super.onDestroy()
        binding.zoomableVideoView.releaseMediaPlayer()
        cleanupTempFiles()
    }

    private fun showLoading() {
        runOnUiThread {
            binding.progressBar.isVisible = true
        }
    }

    private fun hideLoading() {
        runOnUiThread {
            binding.progressBar.isVisible = false
        }
    }

    private fun showToast(message: String) {
        runOnUiThread {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
        }
    }
}