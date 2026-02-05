package com.natasshka.messenger

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.natasshka.messenger.databinding.ActivityFullscreenVideoBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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
                val savedFile = if (fileData != null && fileData!!.isNotEmpty()) {
                    fileManager.saveToDownloads(
                        fileData!!,
                        fileName,
                        isEncrypted,
                        encryptionKey
                    )
                } else {
                    val videoBytes = when {
                        currentVideoUri.scheme == "http" || currentVideoUri.scheme == "https" -> {
                            val url = URL(currentVideoUri.toString())
                            val connection = url.openConnection()
                            connection.connect()
                            connection.getInputStream().readBytes()
                        }
                        currentVideoUri.scheme == "content" -> {
                            contentResolver.openInputStream(currentVideoUri)?.readBytes() ?: byteArrayOf()
                        }
                        currentVideoUri.scheme == "file" -> {
                            File(currentVideoUri.path).readBytes()
                        }
                        else -> {
                            contentResolver.openInputStream(currentVideoUri)?.readBytes() ?: byteArrayOf()
                        }
                    }
                    if (videoBytes.isEmpty()) {
                        throw Exception("Не удалось прочитать данные видео")
                    }
                    val base64Data = android.util.Base64.encodeToString(videoBytes, android.util.Base64.NO_WRAP)
                    fileManager.saveToDownloads(
                        base64Data,
                        fileName,
                        isEncrypted,
                        encryptionKey
                    )
                }
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
    private fun cleanupTempFiles() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                tempVideoFile?.let { file ->
                    if (file.exists()) {
                        file.delete()
                    }
                }
            } catch (e: Exception) {
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