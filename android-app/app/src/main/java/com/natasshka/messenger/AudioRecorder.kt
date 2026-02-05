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
    private var recordingStartTime: Long = 0
    var recordedDuration: Long = 0
        private set
    fun startNativeRecording(): Boolean {
        if (isRecording) {
            return false
        }
        try {
            val audioFile = createAudioFile()
            currentAudioUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                audioFile
            )
            recordingStartTime = System.currentTimeMillis()
            recordedDuration = 0
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.WEBM)
                setAudioEncoder(MediaRecorder.AudioEncoder.OPUS)
                setOutputFile(audioFile.absolutePath)
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(96000)
                setAudioChannels(1)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        setAudioEncodingBitRate(128000)
                        setAudioSamplingRate(44100)
                    } catch (e: Exception) {
                    }
                }
            }
            try {
                mediaRecorder?.prepare()
                mediaRecorder?.start()
                isRecording = true
                return true
            } catch (e: IllegalStateException) {
                resetRecorder()
                Toast.makeText(activity, "Ошибка состояния записи", Toast.LENGTH_SHORT).show()
                return false
            } catch (e: IOException) {
                resetRecorder()
                Toast.makeText(activity, "Ошибка ввода/вывода при записи", Toast.LENGTH_SHORT).show()
                return false
            } catch (e: RuntimeException) {
                resetRecorder()
                Toast.makeText(activity, "Ошибка выполнения при записи", Toast.LENGTH_SHORT).show()
                return false
            }
        } catch (e: Exception) {
            resetRecorder()
            Toast.makeText(activity, "Ошибка инициализации записи", Toast.LENGTH_SHORT).show()
            return false
        }
    }
    fun stopNativeRecording(): Boolean {
        if (isRecording && mediaRecorder != null) {
            recordedDuration = System.currentTimeMillis() - recordingStartTime
            try {
                mediaRecorder?.stop()
                mediaRecorder?.release()
                mediaRecorder = null
                isRecording = false
                return true
            } catch (e: IllegalStateException) {
                resetRecorder()
                return false
            } catch (e: RuntimeException) {
                resetRecorder()
                return false
            } catch (e: Exception) {
                resetRecorder()
                return false
            }
        } else {
            resetRecorder()
            return false
        }
    }
    private fun resetRecorder() {
        try {
            if (mediaRecorder != null) {
                try {
                    mediaRecorder?.stop()
                } catch (e: Exception) {
                }
                try {
                    mediaRecorder?.release()
                } catch (e: Exception) {
                }
            }
        } catch (e: Exception) {
        } finally {
            mediaRecorder = null
            isRecording = false
        }
    }
    private fun createAudioFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
        storageDir?.mkdirs()
        return File.createTempFile(
            "audio_message_${timeStamp}_",
            ".webm",
            storageDir
        )
    }
    fun getDurationInSeconds(): Double {
        return if (recordedDuration > 0) {
            recordedDuration / 1000.0
        } else {
            0.0
        }
    }
    fun isRecording(): Boolean {
        return isRecording
    }
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
            Toast.makeText(activity, "Используем встроенную запись", Toast.LENGTH_SHORT).show()
            startNativeRecording()
        }
    }
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Uri? {
        if (requestCode == REQUEST_AUDIO_CAPTURE && resultCode == Activity.RESULT_OK) {
            return currentAudioUri ?: data?.data
        }
        return null
    }
    fun cleanup() {
        if (isRecording) {
            stopNativeRecording()
        }
        resetRecorder()
    }
}