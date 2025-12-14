package com.natasshka.messenger


import android.graphics.BitmapFactory
import android.graphics.drawable.Drawable
import android.view.MotionEvent
import android.os.Bundle
import android.transition.Transition
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.natasshka.messenger.ZoomableImageView
import com.natasshka.messenger.databinding.ActivityFullscreenImageBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import javax.sql.DataSource
import android.graphics.Bitmap
import android.media.MediaScannerConnection
import android.os.Environment
import android.widget.ImageView
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.FileOutputStream
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.math.min


class FullscreenImageActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "FullscreenImageActivity"
        const val EXTRA_IMAGE_PATH = "image_path"
        const val EXTRA_IMAGE_URL = "image_url"
        const val EXTRA_IMAGE_BASE64 = "image_base64"

        // Отдельные поля вместо целого объекта
        const val EXTRA_FILE_NAME = "file_name"
        const val EXTRA_FILE_DATA = "file_data"
        const val EXTRA_IS_ENCRYPTED = "is_encrypted"
        const val EXTRA_ENCRYPTION_KEY = "encryption_key"
    }

    private lateinit var binding: ActivityFullscreenImageBinding
    private lateinit var fileManager: FileManager
    private var encryptionKey = ""
    private var fileMessage: FileMessage? = null

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

        // Получаем данные по отдельности
        fileName = intent.getStringExtra(EXTRA_FILE_NAME) ?: "image"
        fileData = intent.getStringExtra(EXTRA_FILE_DATA)
        isEncrypted = intent.getBooleanExtra(EXTRA_IS_ENCRYPTED, false)

        setupUI()
        loadImage()
    }

    private fun setupUI() {
        // Кнопка закрытия
        binding.closeButton.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }

        // Кнопка сохранения
        binding.saveButton.setOnClickListener {
            saveImage()
        }

        // Клик на фон для закрытия
        binding.rootLayout.setOnClickListener {
            finish()
            overridePendingTransition(0, 0)
        }

        // Убираем неправильный вызов - ZoomableImageView не имеет setOnClickListener
        // binding.fullscreenImageView.setOnClickListener {
        //     toggleControls()
        // }

        // Вместо этого добавляем OnClickListener на само изображение
        binding.fullscreenImageView.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                // При клике на изображение переключаем видимость контролов
                toggleControls()
            }
            false // Возвращаем false чтобы ZoomableImageView мог обрабатывать жесты масштабирования
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
        // Проверяем разные источники изображения по приоритету
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
                // Пробуем получить данные из fileData
                fileData?.let {
                    loadImageFromBase64(it)
                } ?: run {
                    Toast.makeText(this, "Не удалось загрузить изображение", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
        }
    }


    private fun loadImageFromPath(imagePath: String?) {
        if (imagePath.isNullOrEmpty()) {
            showError("Путь к изображению не указан")
            return
        }

        val imageFile = File(imagePath)
        if (!imageFile.exists()) {
            showError("Файл не найден: $imagePath")
            return
        }

        Glide.with(this)
            .load(imageFile)
            .transition(DrawableTransitionOptions.withCrossFade(300))
            .into(binding.fullscreenImageView)

        hideProgress()
    }

    private fun loadImageFromBase64(imageBase64: String?) {
        if (imageBase64.isNullOrEmpty()) {
            showError("Данные изображения отсутствуют")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Декодируем base64
                val imageBytes = Base64.decode(imageBase64, Base64.DEFAULT)
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
                Log.d(TAG, "Загрузка изображения по URL: $imageUrl")

                // Скачиваем данные с сервера
                val url = URL(imageUrl)
                val connection = url.openConnection()
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                val inputStream = connection.getInputStream()
                val fileBytes = inputStream.readBytes()
                val fileBase64 = Base64.encodeToString(fileBytes, Base64.DEFAULT)

                // Проверяем, нужно ли дешифровать
                val imageBytes = if (isEncrypted && encryptionKey.isNotEmpty()) {
                    try {
                        Log.d(TAG, "Попытка дешифрования файла")
                        CryptoJSCompat.decryptFileFromBase64(fileBase64, encryptionKey)
                    } catch (e: Exception) {
                        Log.e(TAG, "Ошибка дешифрования файла: ${e.message}")

                        // Пробуем дешифровать как текст (для обратной совместимости)
                        try {
                            Log.d(TAG, "Попытка дешифрования как текст")
                            val decryptedText = CryptoJSCompat.decryptText(fileBase64, encryptionKey)

                            // Пробуем декодировать как base64
                            try {
                                Base64.decode(decryptedText, Base64.NO_WRAP)
                            } catch (e2: Exception) {
                                // Если не base64, используем как есть
                                decryptedText.toByteArray(StandardCharsets.UTF_8)
                            }
                        } catch (e2: Exception) {
                            Log.e(TAG, "Все методы дешифрования не сработали: ${e2.message}")
                            // Показываем ошибку
                            withContext(Dispatchers.Main) {
                                hideProgress()
                                showError("Не удалось дешифровать изображение")
                            }
                            return@launch
                        }
                    }
                } else {
                    // Не зашифровано, декодируем как есть
                    Base64.decode(fileBase64, Base64.DEFAULT)
                }

                // Декодируем в Bitmap
                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        // Масштабируем изображение под размер экрана
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

        // Рассчитываем коэффициенты масштабирования
        val scaleX = screenWidth / bitmapWidth
        val scaleY = screenHeight / bitmapHeight

        // Используем минимальный коэффициент, чтобы изображение полностью помещалось на экран
        // и сохраняло пропорции
        val scale = min(scaleX, scaleY)

        // Рассчитываем конечные размеры
        val finalWidth = bitmapWidth * scale
        val finalHeight = bitmapHeight * scale

        // Создаем масштабированный Bitmap
        val scaledBitmap = Bitmap.createScaledBitmap(
            bitmap,
            finalWidth.toInt(),
            finalHeight.toInt(),
            true
        )

        // Устанавливаем изображение
        binding.fullscreenImageView.setImageBitmap(scaledBitmap)

        // Центрируем изображение
        binding.fullscreenImageView.scaleType = ImageView.ScaleType.FIT_CENTER

        Log.d(TAG, "Изображение масштабировано: ${bitmapWidth}x${bitmapHeight} -> ${finalWidth}x${finalHeight}")
    }

    private fun saveImage() {
        showProgress()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d(TAG, "Сохранение изображения: $fileName")

                // Получаем текущее изображение из ImageView
                val drawable = binding.fullscreenImageView.drawable
                if (drawable == null) {
                    throw Exception("Нет изображения для сохранения")
                }

                // Конвертируем Drawable в Bitmap
                val bitmap = if (drawable is android.graphics.drawable.BitmapDrawable) {
                    drawable.bitmap
                } else {
                    // Создаем Bitmap из Drawable
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

                // Сохраняем Bitmap в файл
                val savedFile = saveBitmapToDownloads(bitmap, fileName)

                withContext(Dispatchers.Main) {
                    hideProgress()
                    Toast.makeText(
                        this@FullscreenImageActivity,
                        "✅ Изображение сохранено: ${savedFile.name}",
                        Toast.LENGTH_LONG
                    ).show()
                    Log.d(TAG, "Изображение сохранено по пути: ${savedFile.absolutePath}")
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    hideProgress()
                    Toast.makeText(
                        this@FullscreenImageActivity,
                        "❌ Ошибка сохранения: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                    Log.e(TAG, "Ошибка сохранения: ${e.message}", e)
                }
            }
        }
    }
    private fun saveBitmapToDownloads(bitmap: Bitmap, fileName: String): File {
        val fileManager = FileManager(this)
        val downloadsDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "NATaSSHka")

        // Создаем папку если не существует
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        // Генерируем уникальное имя файла
        val fileExtension = if (fileName.contains(".")) {
            fileName.substringAfterLast(".", "png")
        } else {
            "png"
        }

        val cleanFileName = fileName.substringBeforeLast(".") + ".$fileExtension"
        var outputFile = File(downloadsDir, cleanFileName)

        // Если файл существует, добавляем суффикс
        var counter = 1
        while (outputFile.exists()) {
            val nameWithoutExt = cleanFileName.substringBeforeLast(".")
            val ext = cleanFileName.substringAfterLast(".", "png")
            outputFile = File(downloadsDir, "${nameWithoutExt}_$counter.$ext")
            counter++
        }

        // Сохраняем Bitmap в файл
        val outputStream = FileOutputStream(outputFile)

        // Выбираем формат на основе расширения
        val format = when (fileExtension.lowercase()) {
            "jpg", "jpeg" -> Bitmap.CompressFormat.JPEG
            "webp" -> Bitmap.CompressFormat.WEBP
            else -> Bitmap.CompressFormat.PNG
        }

        bitmap.compress(format, 100, outputStream)
        outputStream.flush()
        outputStream.close()

        // Сканируем файл для добавления в галерею (опционально)
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