package com.natasshka.messenger

import android.content.Context
import android.graphics.Matrix
import android.media.MediaPlayer
import android.net.Uri
import android.util.AttributeSet
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.TextureView
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.os.Handler
import android.os.Looper
import android.view.ScaleGestureDetector
import kotlin.math.max
import kotlin.math.min

class ZoomableVideoView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "ZoomableVideoView"
    }

    private lateinit var textureView: TextureView
    private var mediaPlayer: MediaPlayer? = null
    private var isPlaying: Boolean = false
    private var isLooping: Boolean = true
    private var isPrepared: Boolean = false
    private var hasVideo: Boolean = true

    // Placeholder для аудио
    private lateinit var audioPlaceholder: ImageView

    // Размеры видео
    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    private var surfaceWidth: Int = 0
    private var surfaceHeight: Int = 0

    // Масштабирование
    private val matrix = Matrix()
    private var scaleFactor = 1.0f
    private val minScale = 1.0f
    private val maxScale = 3.0f

    // Для жестов
    private lateinit var scaleGestureDetector: ScaleGestureDetector
    private lateinit var gestureDetector: GestureDetector

    // Флаг для отслеживания ошибок
    private var hasError = false

    init {
        setupView()
        setupGestureDetectors()
    }

    private fun setupView() {
        // TextureView с прозрачным фоном
        textureView = TextureView(context).apply {
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
            background = null
            isOpaque = false
        }
        addView(textureView)

        // Placeholder для аудио
        audioPlaceholder = ImageView(context).apply {
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT,
                LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER
            }
            setImageResource(R.drawable.ic_mic)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            visibility = View.GONE
            adjustViewBounds = true
        }
        addView(audioPlaceholder)
    }

    private fun setupGestureDetectors() {
        scaleGestureDetector = ScaleGestureDetector(context,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScale(detector: ScaleGestureDetector): Boolean {
                    if (!hasVideo || hasError) return false
                    scaleFactor *= detector.scaleFactor
                    scaleFactor = max(minScale, min(maxScale, scaleFactor))
                    updateVideoTransform()
                    return true
                }
            })

        gestureDetector = GestureDetector(context,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    if (!hasVideo || hasError) return false
                    if (scaleFactor > minScale) {
                        scaleFactor = minScale
                    } else {
                        scaleFactor = maxScale
                    }
                    updateVideoTransform()
                    return true
                }

                override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                    togglePlayPause()
                    return true
                }
            })
    }

    fun setVideoUri(uri: Uri, isEncrypted: Boolean = false, encryptionKey: String = "") {
        Log.d(TAG, "Setting video URI: $uri, isEncrypted: $isEncrypted")

        releaseMediaPlayer()
        isPrepared = false
        hasError = false
        videoWidth = 0
        videoHeight = 0
        hasVideo = true

        prepareMediaPlayer(uri)
    }

    private fun prepareMediaPlayer(uri: Uri) {
        try {
            mediaPlayer = MediaPlayer().apply {
                setOnPreparedListener { mp ->
                    Log.d(TAG, "✅ Media prepared successfully, duration: ${mp.duration}ms")
                    this@ZoomableVideoView.isPrepared = true
                    hasError = false

                    this@ZoomableVideoView.hasVideo = mp.videoWidth > 0 && mp.videoHeight > 0

                    if (this@ZoomableVideoView.hasVideo) {
                        this@ZoomableVideoView.videoWidth = mp.videoWidth
                        this@ZoomableVideoView.videoHeight = mp.videoHeight
                        Log.d(TAG, "Video dimensions: ${mp.videoWidth}x${mp.videoHeight}")

                        textureView.visibility = View.VISIBLE
                        audioPlaceholder.visibility = View.GONE

                        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                            override fun onSurfaceTextureAvailable(surface: android.graphics.SurfaceTexture, width: Int, height: Int) {
                                Log.d(TAG, "✅ Surface texture available: ${width}x${height}")
                                this@ZoomableVideoView.surfaceWidth = width
                                this@ZoomableVideoView.surfaceHeight = height

                                mp.setSurface(android.view.Surface(surface))

                                // Правильное масштабирование с сохранением пропорций
                                this@ZoomableVideoView.updateVideoTransform()

                                try {
                                    if (this@ZoomableVideoView.isPrepared) {
                                        mp.start()
                                        this@ZoomableVideoView.isPlaying = true
                                        Log.d(TAG, "✅ Video started playing")
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "❌ Error starting video: ${e.message}", e)
                                }
                            }

                            override fun onSurfaceTextureSizeChanged(surface: android.graphics.SurfaceTexture, width: Int, height: Int) {
                                Log.d(TAG, "Surface texture size changed: $width x $height")
                                this@ZoomableVideoView.surfaceWidth = width
                                this@ZoomableVideoView.surfaceHeight = height
                                this@ZoomableVideoView.updateVideoTransform()
                            }

                            override fun onSurfaceTextureDestroyed(surface: android.graphics.SurfaceTexture): Boolean {
                                Log.d(TAG, "Surface texture destroyed")
                                return true
                            }

                            override fun onSurfaceTextureUpdated(surface: android.graphics.SurfaceTexture) {
                            }
                        }

                        if (textureView.isAvailable) {
                            Log.d(TAG, "TextureView already available, setting surface...")
                            this@ZoomableVideoView.surfaceWidth = textureView.width
                            this@ZoomableVideoView.surfaceHeight = textureView.height

                            mp.setSurface(android.view.Surface(textureView.surfaceTexture))

                            this@ZoomableVideoView.updateVideoTransform()

                            Handler(Looper.getMainLooper()).postDelayed({
                                try {
                                    mp.start()
                                    this@ZoomableVideoView.isPlaying = true
                                    Log.d(TAG, "✅ Video started playing (delayed)")
                                } catch (e: Exception) {
                                    Log.e(TAG, "❌ Error starting delayed video: ${e.message}", e)
                                }
                            }, 100)
                        }
                    } else {
                        Log.d(TAG, "⚠️ No video track, showing audio placeholder")
                        textureView.visibility = View.GONE
                        audioPlaceholder.visibility = View.VISIBLE

                        updateAudioPlaceholderSize()

                        Handler(Looper.getMainLooper()).postDelayed({
                            try {
                                mp.start()
                                this@ZoomableVideoView.isPlaying = true
                                Log.d(TAG, "✅ Audio started playing")
                            } catch (e: Exception) {
                                Log.e(TAG, "❌ Error starting audio: ${e.message}", e)
                            }
                        }, 100)
                    }
                }

                setOnCompletionListener {
                    Log.d(TAG, "Media completed")
                    if (this@ZoomableVideoView.isLooping && this@ZoomableVideoView.isPrepared) {
                        try {
                            it.seekTo(0)
                            it.start()
                            Log.d(TAG, "Media restarted (looping)")
                        } catch (e: Exception) {
                            Log.e(TAG, "❌ Error restarting media: ${e.message}", e)
                        }
                    } else {
                        this@ZoomableVideoView.isPlaying = false
                        Log.d(TAG, "Media stopped (not looping)")
                    }
                }

                setOnErrorListener { mp, what, extra ->
                    Log.e(TAG, "❌ MediaPlayer error: what=$what, extra=$extra")
                    this@ZoomableVideoView.isPrepared = false
                    this@ZoomableVideoView.hasError = true
                    // Вызываем коллбэк для обработки ошибки
                    this@ZoomableVideoView.onErrorCallback?.invoke("Ошибка воспроизведения видео")
                    true
                }

                setOnInfoListener { mp, what, extra ->
                    when (what) {
                        MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START -> {
                            Log.d(TAG, "✅ Video rendering started")
                        }
                        MediaPlayer.MEDIA_INFO_BUFFERING_START -> {
                            Log.d(TAG, "Buffering started")
                        }
                        MediaPlayer.MEDIA_INFO_BUFFERING_END -> {
                            Log.d(TAG, "Buffering ended")
                        }
                    }
                    true
                }

                try {
                    Log.d(TAG, "Setting data source...")
                    setDataSource(context, uri)

                    Log.d(TAG, "Preparing media player async...")
                    prepareAsync()
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error setting data source: ${e.message}", e)
                    this@ZoomableVideoView.isPrepared = false
                    this@ZoomableVideoView.hasError = true
                    this@ZoomableVideoView.onErrorCallback?.invoke("Не удалось загрузить видео: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error creating media player: ${e.message}", e)
            this@ZoomableVideoView.isPrepared = false
            hasError = true
            onErrorCallback?.invoke("Ошибка создания медиаплеера: ${e.message}")
        }
    }

    private fun updateAudioPlaceholderSize() {
        val halfWidth = (context.resources.displayMetrics.widthPixels * 0.5).toInt()
        val halfHeight = (context.resources.displayMetrics.heightPixels * 0.5).toInt()

        val size = min(halfWidth, halfHeight)

        audioPlaceholder.layoutParams = LayoutParams(
            size,
            size
        ).apply {
            gravity = android.view.Gravity.CENTER
        }

        audioPlaceholder.requestLayout()
    }

    private fun updateVideoTransform() {
        if (!hasVideo || videoWidth == 0 || videoHeight == 0 || surfaceWidth == 0 || surfaceHeight == 0) {
            Log.w(TAG, "⚠️ Cannot update transform - missing dimensions")
            return
        }

        Log.d(TAG, "Updating transform: video=${videoWidth}x${videoHeight}, surface=${surfaceWidth}x${surfaceHeight}")

        val videoRatio = videoWidth.toFloat() / videoHeight.toFloat()
        val surfaceRatio = surfaceWidth.toFloat() / surfaceHeight.toFloat()

        Log.d(TAG, "Ratios: video=$videoRatio, surface=$surfaceRatio")

        matrix.reset()

        // Рассчитываем масштаб для вписывания с сохранением пропорций
        val scaleX = surfaceWidth.toFloat() / videoWidth.toFloat()
        val scaleY = surfaceHeight.toFloat() / videoHeight.toFloat()

        // Используем минимальный масштаб чтобы видео полностью поместилось
        val scale = min(scaleX, scaleY)

        // Применяем масштабирование
        matrix.postScale(scale, scale)

        // Центрируем
        val scaledWidth = videoWidth * scale
        val scaledHeight = videoHeight * scale
        val translateX = (surfaceWidth - scaledWidth) / 2f
        val translateY = (surfaceHeight - scaledHeight) / 2f

        matrix.postTranslate(translateX, translateY)

        // Применяем дополнительный масштаб для жестов
        matrix.postScale(scaleFactor, scaleFactor, surfaceWidth / 2f, surfaceHeight / 2f)

        textureView.setTransform(matrix)

        Log.d(TAG, "Transform: scale=$scale, translate=($translateX, $translateY), scaleFactor=$scaleFactor")
    }

    // Коллбэк для ошибок
    var onErrorCallback: ((String) -> Unit)? = null

    fun togglePlayPause() {
        if (!isPrepared || hasError) {
            Log.w(TAG, "⚠️ MediaPlayer not prepared or has error, cannot toggle")
            return
        }

        mediaPlayer?.let { mp ->
            try {
                if (isPlaying) {
                    mp.pause()
                    isPlaying = false
                    Log.d(TAG, "Media paused")
                } else {
                    mp.start()
                    isPlaying = true
                    Log.d(TAG, "Media resumed")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error toggling play/pause: ${e.message}", e)
            }
        }
    }

    fun play() {
        if (!isPrepared || hasError) {
            Log.w(TAG, "⚠️ MediaPlayer not prepared or has error, cannot play")
            return
        }

        if (!isPlaying) {
            try {
                mediaPlayer?.start()
                isPlaying = true
                Log.d(TAG, "Media play() called")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error playing media: ${e.message}", e)
            }
        }
    }

    fun pause() {
        if (isPlaying) {
            try {
                mediaPlayer?.pause()
                isPlaying = false
                Log.d(TAG, "Media pause() called")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error pausing media: ${e.message}", e)
            }
        }
    }

    fun setLooping(looping: Boolean) {
        isLooping = looping
        mediaPlayer?.isLooping = looping
        Log.d(TAG, "Looping set to: $looping")
    }

    fun getCurrentPosition(): Int {
        return if (isPrepared) mediaPlayer?.currentPosition ?: 0 else 0
    }

    fun getDuration(): Int {
        return if (isPrepared) mediaPlayer?.duration ?: 0 else 0
    }

    fun seekTo(position: Int) {
        if (isPrepared) {
            try {
                mediaPlayer?.seekTo(position)
                Log.d(TAG, "Seek to position: $position")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error seeking: ${e.message}", e)
            }
        }
    }

    fun releaseMediaPlayer() {
        mediaPlayer?.let { mp ->
            try {
                if (isPrepared && isPlaying) {
                    mp.stop()
                }
                mp.release()
                Log.d(TAG, "Media player released")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error releasing media player: ${e.message}", e)
            }
        }
        mediaPlayer = null
        isPlaying = false
        isPrepared = false
        videoWidth = 0
        videoHeight = 0
        surfaceWidth = 0
        surfaceHeight = 0
        scaleFactor = 1.0f
        hasVideo = true
        hasError = false
        Log.d(TAG, "Media player state reset")
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!hasVideo || hasError) {
            gestureDetector.onTouchEvent(event)
            return true
        }

        scaleGestureDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        return true
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        releaseMediaPlayer()
        Log.d(TAG, "Detached from window")
    }
}