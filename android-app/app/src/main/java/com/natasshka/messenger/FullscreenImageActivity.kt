package com.natasshka.messenger

import android.graphics.BitmapFactory
import android.view.MotionEvent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.natasshka.messenger.databinding.ActivityFullscreenImageBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import android.graphics.Bitmap
import android.media.MediaScannerConnection
import android.os.Environment
import android.widget.ImageView
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.math.min

class FullscreenImageActivity : AppCompatActivity() {
    companion object {
        const val EXTRA_IMAGE_PATH = "image_path"
        const val EXTRA_IMAGE_URL = "image_url"
        const val EXTRA_IMAGE_BASE64 = "image_base64"
        const val EXTRA_FILE_NAME = "file_name"
        const val EXTRA_FILE_DATA = "file_data"
        const val EXTRA_IS_ENCRYPTED = "is_encrypted"
        const val EXTRA_ENCRYPTION_KEY = "encryption_key"
    }
    private lateinit var binding: ActivityFullscreenImageBinding
    private lateinit var fileManager: FileManager
    private var encryptionKey = ""
    private var fileName = ""
    private var fileData: String? = null
    private var isEncrypted = false
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFullscreenImageBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.decorView.setBackgroundColor(0x80000000.toInt())
        fileManager = FileManager(this)
        encryptionKey = intent.getStringExtra(EXTRA_ENCRYPTION_KEY) ?: ""
        fileName = intent.getStringExtra(EXTRA_FILE_NAME) ?: "image"
        fileData = intent.getStringExtra(EXTRA_FILE_DATA)
        isEncrypted = intent.getBooleanExtra(EXTRA_IS_ENCRYPTED, false)
        setupUI()
        loadImage()
    }
    private fun setupUI() {
        binding.closeButton.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }
        binding.saveButton.setOnClickListener {
            saveImage()
        }
        binding.rootLayout.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }
        binding.fullscreenImageView.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                toggleControls()
            }
            false
        }
    }
    private fun toggleControls() {
        val visibility = if (binding.closeButton.visibility == View.VISIBLE) {
            View.GONE
        } else {
            View.VISIBLE
        }
        binding.closeButton.visibility = visibility
        binding.saveButton.visibility = visibility
    }
    private fun loadImage() {
        when {
            intent.hasExtra(EXTRA_IMAGE_URL) -> {
                val imageUrl = intent.getStringExtra(EXTRA_IMAGE_URL)
                loadImageFromUrl(imageUrl)
            }
            intent.hasExtra(EXTRA_IMAGE_BASE64) -> {
                val imageBase64 = intent.getStringExtra(EXTRA_IMAGE_BASE64)
                loadImageFromBase64(imageBase64)
            }
            else -> {
                fileData?.let {
                    loadImageFromBase64(it)
                } ?: run {
                    Toast.makeText(this, "Не удалось загрузить изображение", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }
    private fun loadImageFromBase64(imageBase64: String?) {
        if (imageBase64.isNullOrEmpty()) {
            showError("Данные изображения отсутствуют")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val imageBytes = android.util.Base64.decode(imageBase64, android.util.Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                withContext(Dispatchers.Main) {
                    if (bitmap != null) {
                        binding.fullscreenImageView.setImageBitmap(bitmap)
                        hideProgress()
                    } else {
                        showError("Не удалось декодировать изображение")
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showError("Ошибка загрузки изображения: ${e.message}")
                }
            }
        }
    }
    private fun loadImageFromUrl(imageUrl: String?) {
        if (imageUrl.isNullOrEmpty()) {
            showError("URL изображения не указан")
            return
        }
        showProgress()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL(imageUrl)
                val connection = url.openConnection()
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                val inputStream = connection.getInputStream()
                val fileBytes = inputStream.readBytes()
                val fileBase64 = android.util.Base64.encodeToString(fileBytes, android.util.Base64.DEFAULT)
                val imageBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        CryptoJSCompat.decryptFileFromBase64(fileBase64, encryptionKey)
                    } catch (e: Exception) {
                        try {
                            val decryptedText = CryptoJSCompat.decryptText(fileBase64, encryptionKey)
                            try {
                                android.util.Base64.decode(decryptedText, android.util.Base64.NO_WRAP)
                            } catch (e2: Exception) {
                                decryptedText.toByteArray(StandardCharsets.UTF_8)
                            }
                        } catch (e2: Exception) {
                            withContext(Dispatchers.Main) {
                                hideProgress()
                                showError("Не удалось дешифровать изображение")
                            }
                            return@launch
                        }
                    }
                } else {
                    android.util.Base64.decode(fileBase64, android.util.Base64.DEFAULT)
                }
                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        scaleImageToFitScreen(bitmap)
                        hideProgress()
                    }
                } else {
                    throw Exception("Не удалось декодировать изображение")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    hideProgress()
                    showError("Ошибка загрузки: ${e.message}")
                }
            }
        }
    }
    private fun scaleImageToFitScreen(bitmap: Bitmap) {
        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels.toFloat()
        val screenHeight = displayMetrics.heightPixels.toFloat()
        val bitmapWidth = bitmap.width.toFloat()
        val bitmapHeight = bitmap.height.toFloat()
        val scaleX = screenWidth / bitmapWidth
        val scaleY = screenHeight / bitmapHeight
        val scale = min(scaleX, scaleY)
        val finalWidth = bitmapWidth * scale
        val finalHeight = bitmapHeight * scale
        val scaledBitmap = Bitmap.createScaledBitmap(
            bitmap,
            finalWidth.toInt(),
            finalHeight.toInt(),
            true
        )
        binding.fullscreenImageView.setImageBitmap(scaledBitmap)
        binding.fullscreenImageView.scaleType = ImageView.ScaleType.FIT_CENTER
    }
    private fun saveImage() {
        showProgress()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val drawable = binding.fullscreenImageView.drawable
                if (drawable == null) {
                    throw Exception("Нет изображения для сохранения")
                }
                val bitmap = if (drawable is android.graphics.drawable.BitmapDrawable) {
                    drawable.bitmap
                } else {
                    val bitmap = Bitmap.createBitmap(
                        drawable.intrinsicWidth,
                        drawable.intrinsicHeight,
                        Bitmap.Config.ARGB_8888
                    )
                    val canvas = android.graphics.Canvas(bitmap)
                    drawable.setBounds(0, 0, canvas.width, canvas.height)
                    drawable.draw(canvas)
                    bitmap
                }
                val savedFile = saveBitmapToDownloads(bitmap, fileName)
                withContext(Dispatchers.Main) {
                    hideProgress()
                    Toast.makeText(
                        this@FullscreenImageActivity,
                        "✅ Изображение сохранено: ${savedFile.name}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    hideProgress()
                    Toast.makeText(
                        this@FullscreenImageActivity,
                        "❌ Ошибка сохранения: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
    private fun saveBitmapToDownloads(bitmap: Bitmap, fileName: String): File {
        val fileManager = FileManager(this)
        val downloadsDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "NATaSSHka")
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }
        val fileExtension = if (fileName.contains(".")) {
            fileName.substringAfterLast(".", "png")
        } else {
            "png"
        }
        val cleanFileName = fileName.substringBeforeLast(".") + ".$fileExtension"
        var outputFile = File(downloadsDir, cleanFileName)
        var counter = 1
        while (outputFile.exists()) {
            val nameWithoutExt = cleanFileName.substringBeforeLast(".")
            val ext = cleanFileName.substringAfterLast(".", "png")
            outputFile = File(downloadsDir, "${nameWithoutExt}_$counter.$ext")
            counter++
        }
        val outputStream = java.io.FileOutputStream(outputFile)
        val format = when (fileExtension.lowercase()) {
            "jpg", "jpeg" -> Bitmap.CompressFormat.JPEG
            "webp" -> Bitmap.CompressFormat.WEBP
            else -> Bitmap.CompressFormat.PNG
        }
        bitmap.compress(format, 100, outputStream)
        outputStream.flush()
        outputStream.close()
        MediaScannerConnection.scanFile(
            this,
            arrayOf(outputFile.absolutePath),
            null,
            null
        )
        return outputFile
    }
    private fun showProgress() {
        binding.progressBar.visibility = View.VISIBLE
        binding.saveButton.isEnabled = false
    }
    private fun hideProgress() {
        binding.progressBar.visibility = View.GONE
        binding.saveButton.isEnabled = true
    }
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        finish()
    }
    override fun onBackPressed() {
        finish()
        overridePendingTransition(0, 0)
    }
}