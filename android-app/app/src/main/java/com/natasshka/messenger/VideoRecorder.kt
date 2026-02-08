package com.natasshka.messenger
import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
class VideoRecorder(private val activity: Activity) {
    companion object {
        const val REQUEST_VIDEO_CAPTURE = 101
        const val REQUEST_CAMERA_PERMISSION = 102
    }
    var currentVideoUri: Uri? = null
        private set
    fun recordVideo(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        if (ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.RECORD_AUDIO
                ),
                REQUEST_CAMERA_PERMISSION
            )
        } else {
            startVideoRecording(launcher)
        }
    }
    private fun startVideoRecording(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        val videoFile = createVideoFile()
        currentVideoUri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            videoFile
        )
        val intent = Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, currentVideoUri)
            putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        }
        if (intent.resolveActivity(activity.packageManager) != null) {
            launcher.launch(intent)
        } else {
            Toast.makeText(activity, "Не найдено приложение для записи видео", Toast.LENGTH_SHORT).show()
        }
    }
    private fun createVideoFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_MOVIES)
        return File.createTempFile(
            "VID_${timeStamp}_",
            ".mp4",
            storageDir
        )
    }
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Uri? {
        if (requestCode == REQUEST_VIDEO_CAPTURE && resultCode == Activity.RESULT_OK) {
            return currentVideoUri ?: data?.data
        }
        return null
    }

    fun cleanup() {
        currentVideoUri?.path?.let { path ->
            val file = File(path)
            if (file.exists()) {
                file.delete()
            }
        }
        currentVideoUri = null
    }
}