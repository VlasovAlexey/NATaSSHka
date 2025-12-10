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
                startNativeRecording()
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
            startNativeRecording()
        }
    }

    fun startNativeRecording() {
        try {
            val audioFile = createAudioFile()
            currentAudioUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                audioFile
            )

            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(audioFile.absolutePath)

                // Настройки качества
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)

                try {
                    prepare()
                    start()
                    isRecording = true

                    Toast.makeText(activity, "Начата запись аудио", Toast.LENGTH_SHORT).show()

                } catch (e: IOException) {
                    e.printStackTrace()
                    stopNativeRecording()
                    Toast.makeText(activity, "Ошибка записи аудио", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(activity, "Ошибка инициализации записи", Toast.LENGTH_SHORT).show()
        }
    }

    fun stopNativeRecording() {
        if (isRecording) {
            mediaRecorder?.apply {
                try {
                    stop()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                release()
            }
            mediaRecorder = null
            isRecording = false

            Toast.makeText(activity, "Запись завершена", Toast.LENGTH_SHORT).show()
        }
    }

    private fun createAudioFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_MUSIC)

        return File.createTempFile(
            "AUD_${timeStamp}_",
            ".mp3",
            storageDir
        )
    }

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Uri? {
        if (requestCode == REQUEST_AUDIO_CAPTURE && resultCode == Activity.RESULT_OK) {
            return currentAudioUri ?: data?.data
        }
        return null
    }
}