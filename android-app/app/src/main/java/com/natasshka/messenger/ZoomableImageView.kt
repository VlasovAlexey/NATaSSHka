package com.natasshka.messenger

import android.content.Context
import android.graphics.Matrix
import android.graphics.PointF
import android.util.AttributeSet
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.widget.ImageView
import kotlin.math.max
import kotlin.math.min

class ZoomableImageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ImageView(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "ZoomableImageView"
    }

    // Масштабирование
    private val matrix = Matrix()
    private var scaleFactor = 1.0f
    private val minScale = 1.0f
    private val maxScale = 5.0f // Увеличил максимальный зум

    // Жесты
    private lateinit var scaleGestureDetector: ScaleGestureDetector
    private lateinit var gestureDetector: GestureDetector

    // Перемещение
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var posX = 0f
    private var posY = 0f

    // Размеры изображения и view
    private var imageWidth = 0
    private var imageHeight = 0
    private var viewWidth = 0
    private var viewHeight = 0

    init {
        scaleType = ScaleType.MATRIX
        setupGestureDetectors()
    }

    private fun setupGestureDetectors() {
        scaleGestureDetector = ScaleGestureDetector(context,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScale(detector: ScaleGestureDetector): Boolean {
                    val oldScale = scaleFactor
                    scaleFactor *= detector.scaleFactor
                    scaleFactor = max(minScale, min(maxScale, scaleFactor))

                    // Ограничиваем перемещение при масштабировании
                    val focusX = detector.focusX
                    val focusY = detector.focusY

                    val scaleChange = scaleFactor / oldScale
                    posX = focusX - (focusX - posX) * scaleChange
                    posY = focusY - (focusY - posY) * scaleChange

                    updateImageMatrix()
                    return true
                }
            })

        gestureDetector = GestureDetector(context,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    // Двойной тап переключает между исходным размером и увеличенным
                    if (scaleFactor > minScale) {
                        scaleFactor = minScale
                        posX = 0f
                        posY = 0f
                    } else {
                        scaleFactor = maxScale
                    }
                    updateImageMatrix()
                    return true
                }

                override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                    performClick()
                    return true
                }
            })
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        viewWidth = w
        viewHeight = h
        updateInitialMatrix()
    }

    override fun setImageResource(resId: Int) {
        super.setImageResource(resId)
        post {
            updateImageDimensions()
            updateInitialMatrix()
        }
    }

    private fun updateImageDimensions() {
        val drawable = drawable ?: return
        imageWidth = drawable.intrinsicWidth
        imageHeight = drawable.intrinsicHeight
        Log.d(TAG, "Image dimensions: ${imageWidth}x${imageHeight}, View: ${viewWidth}x${viewHeight}")
    }

    private fun updateInitialMatrix() {
        if (imageWidth == 0 || imageHeight == 0 || viewWidth == 0 || viewHeight == 0) {
            return
        }

        matrix.reset()

        // Рассчитываем начальный масштаб чтобы изображение вписалось в view
        val imageRatio = imageWidth.toFloat() / imageHeight.toFloat()
        val viewRatio = viewWidth.toFloat() / viewHeight.toFloat()

        val scale = if (imageRatio > viewRatio) {
            // Изображение шире view - масштабируем по ширине
            viewWidth.toFloat() / imageWidth.toFloat()
        } else {
            // Изображение выше view - масштабируем по высоте
            viewHeight.toFloat() / imageHeight.toFloat()
        }

        matrix.postScale(scale, scale)

        // Центрируем
        val scaledWidth = imageWidth * scale
        val scaledHeight = imageHeight * scale

        if (imageRatio > viewRatio) {
            val translateY = (viewHeight - scaledHeight) / 2
            matrix.postTranslate(0f, translateY)
        } else {
            val translateX = (viewWidth - scaledWidth) / 2
            matrix.postTranslate(translateX, 0f)
        }

        imageMatrix = matrix
        scaleFactor = 1.0f
        posX = 0f
        posY = 0f
    }

    private fun updateImageMatrix() {
        if (imageWidth == 0 || imageHeight == 0 || viewWidth == 0 || viewHeight == 0) {
            return
        }

        matrix.reset()

        // Рассчитываем базовый масштаб для вписывания
        val imageRatio = imageWidth.toFloat() / imageHeight.toFloat()
        val viewRatio = viewWidth.toFloat() / viewHeight.toFloat()

        val baseScale = if (imageRatio > viewRatio) {
            viewWidth.toFloat() / imageWidth.toFloat()
        } else {
            viewHeight.toFloat() / imageHeight.toFloat()
        }

        // Применяем базовый масштаб и центрирование
        matrix.postScale(baseScale, baseScale)

        val scaledWidth = imageWidth * baseScale
        val scaledHeight = imageHeight * baseScale

        if (imageRatio > viewRatio) {
            val translateY = (viewHeight - scaledHeight) / 2
            matrix.postTranslate(0f, translateY)
        } else {
            val translateX = (viewWidth - scaledWidth) / 2
            matrix.postTranslate(translateX, 0f)
        }

        // Применяем зум и перемещение
        matrix.postScale(scaleFactor, scaleFactor, viewWidth / 2f, viewHeight / 2f)
        matrix.postTranslate(posX, posY)

        // Ограничиваем перемещение чтобы изображение не уходило за границы
        limitTranslation()

        imageMatrix = matrix
    }

    private fun limitTranslation() {
        val drawable = drawable ?: return

        // Получаем текущие границы изображения
        val values = FloatArray(9)
        matrix.getValues(values)
        val currentScale = values[Matrix.MSCALE_X]

        // Рассчитываем максимальное перемещение
        val scaledWidth = drawable.intrinsicWidth * currentScale
        val scaledHeight = drawable.intrinsicHeight * currentScale

        if (scaledWidth <= viewWidth) {
            posX = 0f
        } else {
            val maxX = (scaledWidth - viewWidth) / 2
            posX = max(-maxX, min(maxX, posX))
        }

        if (scaledHeight <= viewHeight) {
            posY = 0f
        } else {
            val maxY = (scaledHeight - viewHeight) / 2
            posY = max(-maxY, min(maxY, posY))
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleGestureDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x
                lastTouchY = event.y
            }
            MotionEvent.ACTION_MOVE -> {
                if (event.pointerCount == 1 && scaleFactor > minScale) {
                    val dx = event.x - lastTouchX
                    val dy = event.y - lastTouchY

                    posX += dx
                    posY += dy

                    updateImageMatrix()
                }

                lastTouchX = event.x
                lastTouchY = event.y
            }
        }

        return true
    }

    override fun performClick(): Boolean {
        return super.performClick()
    }
}