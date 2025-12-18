package com.natasshka.messenger

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class AudioRecorder(private val activity: Activity) {

    companion object {
        const val REQUEST_AUDIO_PERMISSION = 201
        const val REQUEST_AUDIO_CAPTURE = 202
    }

    private var mediaRecorder: MediaRecorder? = null
    var currentAudioUri: Uri? = null
        private set
    private var isRecording = false

    // Поля для отслеживания времени записи
    private var recordingStartTime: Long = 0
    var recordedDuration: Long = 0
        private set

    // ========== ЗАПИСЬ АУДИО В ФОРМАТЕ WEBM ==========

    fun startNativeRecording(): Boolean {
        Log.d("AudioRecorder", "=== startNativeRecording() ===")

        // Если уже идет запись, выходим
        if (isRecording) {
            Log.w("AudioRecorder", "Уже идет запись, игнорируем")
            return false
        }

        try {
            // 1. Создаем файл в формате webm
            val audioFile = createAudioFile()
            Log.d("AudioRecorder", "Файл создан: ${audioFile.absolutePath}")

            // 2. Создаем URI для доступа к файлу
            currentAudioUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                audioFile
            )
            Log.d("AudioRecorder", "URI файла: $currentAudioUri")

            // Сбрасываем таймер длительности
            recordingStartTime = System.currentTimeMillis()
            recordedDuration = 0

            // 3. Настраиваем MediaRecorder для записи в формате webm
            mediaRecorder = MediaRecorder().apply {
                // Источник звука - микрофон
                setAudioSource(MediaRecorder.AudioSource.MIC)

                // Формат вывода - WEBM для лучшей совместимости
                setOutputFormat(MediaRecorder.OutputFormat.WEBM)

                // Кодек - OPUS для webm (хорошая совместимость с браузерами)
                setAudioEncoder(MediaRecorder.AudioEncoder.OPUS)

                // Путь к файлу
                setOutputFile(audioFile.absolutePath)

                // Качество записи для голосовых сообщений
                setAudioSamplingRate(16000)      // 16 kHz - достаточно для голоса
                setAudioEncodingBitRate(96000)   // 96 kbps - хорошее качество
                setAudioChannels(1)              // Моно - достаточно для голоса

                // Дополнительные настройки для Android 10+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        // Можно попробовать более высокое качество
                        setAudioEncodingBitRate(128000)
                        setAudioSamplingRate(44100)
                        Log.d("AudioRecorder", "Установлены расширенные настройки для Android 10+")
                    } catch (e: Exception) {
                        Log.w("AudioRecorder", "Не удалось установить расширенные настройки", e)
                    }
                }
            }

            Log.d("AudioRecorder", "MediaRecorder настроен для формата webm")

            // 4. Пытаемся подготовить и запустить запись
            try {
                mediaRecorder?.prepare()
                mediaRecorder?.start()

                isRecording = true

                Log.d("AudioRecorder", "✅ Запись успешно начата в формате webm!")
                Log.d("AudioRecorder", "Состояние: isRecording=$isRecording, mediaRecorder=${mediaRecorder != null}")

                return true

            } catch (e: IllegalStateException) {
                Log.e("AudioRecorder", "❌ IllegalStateException при запуске записи: ${e.message}")
                resetRecorder()
                Toast.makeText(activity, "Ошибка состояния записи", Toast.LENGTH_SHORT).show()
                return false
            } catch (e: IOException) {
                Log.e("AudioRecorder", "❌ IOException при запуске записи: ${e.message}")
                resetRecorder()
                Toast.makeText(activity, "Ошибка ввода/вывода при записи", Toast.LENGTH_SHORT).show()
                return false
            } catch (e: RuntimeException) {
                Log.e("AudioRecorder", "❌ RuntimeException при запуске записи: ${e.message}")
                resetRecorder()
                Toast.makeText(activity, "Ошибка выполнения при записи", Toast.LENGTH_SHORT).show()
                return false
            }

        } catch (e: Exception) {
            Log.e("AudioRecorder", "❌ Общая ошибка при создании записи: ${e.message}")
            resetRecorder()
            Toast.makeText(activity, "Ошибка инициализации записи", Toast.LENGTH_SHORT).show()
            return false
        }
    }

    fun stopNativeRecording(): Boolean {
        Log.d("AudioRecorder", "=== stopNativeRecording() ===")
        Log.d("AudioRecorder", "Состояние: isRecording=$isRecording, mediaRecorder=${mediaRecorder != null}")

        if (isRecording && mediaRecorder != null) {
            // Рассчитываем длительность записи
            recordedDuration = System.currentTimeMillis() - recordingStartTime

            try {
                // Останавливаем запись
                mediaRecorder?.stop()
                Log.d("AudioRecorder", "✅ MediaRecorder остановлен")

                // Освобождаем ресурсы
                mediaRecorder?.release()
                Log.d("AudioRecorder", "✅ MediaRecorder освобожден")

                // Сбрасываем состояние
                mediaRecorder = null
                isRecording = false

                Log.d("AudioRecorder", "✅ Запись успешно завершена")
                Log.d("AudioRecorder", "Длительность записи: $recordedDuration мс")

                // Проверяем файл
                currentAudioUri?.let { uri ->
                    try {
                        val filePath = uri.path?.substringAfter("external_app_files/") ?: ""
                        val file = File("/storage/emulated/0/Android/data/${activity.packageName}/files/Music/$filePath")
                        if (file.exists()) {
                            val fileSize = file.length()
                            Log.d("AudioRecorder", "Файл создан: ${file.absolutePath}")
                            Log.d("AudioRecorder", "Размер файла: $fileSize байт")
                        }
                    } catch (e: Exception) {
                        Log.w("AudioRecorder", "Не удалось проверить файл: ${e.message}")
                    }
                }

                return true

            } catch (e: IllegalStateException) {
                Log.e("AudioRecorder", "❌ Ошибка при остановке (IllegalStateException): ${e.message}")
                resetRecorder()
                return false
            } catch (e: RuntimeException) {
                Log.e("AudioRecorder", "❌ Ошибка при остановке (RuntimeException): ${e.message}")
                resetRecorder()
                return false
            } catch (e: Exception) {
                Log.e("AudioRecorder", "❌ Общая ошибка при остановке: ${e.message}")
                resetRecorder()
                return false
            }
        } else {
            Log.w("AudioRecorder", "⚠️ Нечего останавливать: isRecording=$isRecording, mediaRecorder=${mediaRecorder != null}")
            resetRecorder() // Все равно сбрасываем состояние
            return false
        }
    }

    // Сброс состояния MediaRecorder
    private fun resetRecorder() {
        try {
            if (mediaRecorder != null) {
                try {
                    mediaRecorder?.stop()
                } catch (e: Exception) {
                    // Игнорируем ошибки остановки
                }

                try {
                    mediaRecorder?.release()
                } catch (e: Exception) {
                    // Игнорируем ошибки освобождения
                }
            }
        } catch (e: Exception) {
            // Игнорируем все ошибки при сбросе
        } finally {
            mediaRecorder = null
            isRecording = false
        }
    }

    // Создание аудиофайла в формате webm
    private fun createAudioFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_MUSIC)

        // Создаем директорию если ее нет
        storageDir?.mkdirs()

        // Используем .webm расширение для совместимости с браузерами
        return File.createTempFile(
            "audio_message_${timeStamp}_",
            ".webm",
            storageDir
        )
    }

    // Получение длительности в секундах с плавающей точкой (для сервера)
    fun getDurationInSeconds(): Double {
        return if (recordedDuration > 0) {
            recordedDuration / 1000.0
        } else {
            0.0
        }
    }

    // Проверка, идет ли запись
    fun isRecording(): Boolean {
        return isRecording
    }

    // ========== СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ==========

    // Старый метод с диалогом выбора (оставляем для совместимости)
    fun recordAudio(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        if (ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ),
                REQUEST_AUDIO_PERMISSION
            )
        } else {
            // Создаем диалог выбора способа записи
            showRecordingDialog(launcher)
        }
    }

    private fun showRecordingDialog(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        androidx.appcompat.app.AlertDialog.Builder(activity)
            .setTitle("Запись аудио")
            .setMessage("Выберите способ записи аудио:")
            .setPositiveButton("Использовать системное приложение") { _, _ ->
                startSystemAudioRecording(launcher)
            }
            .setNegativeButton("Записать в приложении") { _, _ ->
                startNativeRecording() // Используем новую логику
            }
            .setNeutralButton("Отмена", null)
            .show()
    }

    private fun startSystemAudioRecording(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        val audioFile = createAudioFile()
        currentAudioUri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            audioFile
        )

        // Используем ACTION_RECORD_SOUND для системного приложения записи звука
        val intent = Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, currentAudioUri)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        }

        if (intent.resolveActivity(activity.packageManager) != null) {
            launcher.launch(intent)
        } else {
            // Если нет системного приложения, используем нативную запись
            Toast.makeText(activity, "Используем встроенную запись", Toast.LENGTH_SHORT).show()
            startNativeRecording() // Используем новую логику
        }
    }

    // Обработка результата системной записи
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Uri? {
        if (requestCode == REQUEST_AUDIO_CAPTURE && resultCode == Activity.RESULT_OK) {
            return currentAudioUri ?: data?.data
        }
        return null
    }

    // Очистка ресурсов (вызывать при уничтожении активности)
    fun cleanup() {
        if (isRecording) {
            stopNativeRecording()
        }
        resetRecorder()
    }
}