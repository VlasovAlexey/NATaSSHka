package com.natasshka.messenger

import android.content.Context
import android.graphics.Matrix
import android.graphics.PointF
import android.util.AttributeSet
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

    private val matrix = Matrix()
    private var scaleFactor = 1f

    // Детекторы жестов
    private val scaleDetector: ScaleGestureDetector
    private val gestureDetector: GestureDetector

    // Состояние жестов
    private var mode = NONE
    private var last = PointF()
    private var start = PointF()
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var activePointerId = INVALID_POINTER_ID

    companion object {
        private const val NONE = 0
        private const val DRAG = 1
        private const val ZOOM = 2
        private const val MIN_SCALE = 1f
        private const val MAX_SCALE = 4f
        private const val INVALID_POINTER_ID = -1
    }

    init {
        scaleType = ScaleType.MATRIX
        scaleDetector = ScaleGestureDetector(context, ScaleListener())
        gestureDetector = GestureDetector(context, GestureListener())

        matrix.setScale(scaleFactor, scaleFactor)
        imageMatrix = matrix
    }

    private inner class ScaleListener : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            scaleFactor *= detector.scaleFactor
            scaleFactor = max(MIN_SCALE, min(scaleFactor, MAX_SCALE))

            matrix.setScale(scaleFactor, scaleFactor, detector.focusX, detector.focusY)
            fixTrans()
            imageMatrix = matrix

            return true
        }

        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            mode = ZOOM
            return true
        }
    }

    private inner class GestureListener : GestureDetector.SimpleOnGestureListener() {
        override fun onDoubleTap(e: MotionEvent): Boolean {
            // Сброс масштаба при двойном тапе
            if (scaleFactor > MIN_SCALE) {
                scaleFactor = MIN_SCALE
            } else {
                scaleFactor = MIN_SCALE * 2f
            }

            matrix.setScale(scaleFactor, scaleFactor, e.x, e.y)
            fixTrans()
            imageMatrix = matrix

            return true
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // Передаем события детекторам жестов
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)

        val action = event.actionMasked

        when (action) {
            MotionEvent.ACTION_DOWN -> {
                val x = event.x
                val y = event.y

                lastTouchX = x
                lastTouchY = y
                activePointerId = event.getPointerId(0)
                mode = DRAG
            }

            MotionEvent.ACTION_MOVE -> {
                if (mode == DRAG && activePointerId != INVALID_POINTER_ID) {
                    val pointerIndex = event.findPointerIndex(activePointerId)
                    if (pointerIndex != -1) {
                        val x = event.getX(pointerIndex)
                        val y = event.getY(pointerIndex)

                        if (!scaleDetector.isInProgress) {
                            val dx = x - lastTouchX
                            val dy = y - lastTouchY

                            matrix.postTranslate(dx, dy)
                            fixTrans()
                            imageMatrix = matrix
                        }

                        lastTouchX = x
                        lastTouchY = y
                    }
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                activePointerId = INVALID_POINTER_ID
                mode = NONE
            }

            MotionEvent.ACTION_POINTER_UP -> {
                val pointerIndex = event.actionIndex
                val pointerId = event.getPointerId(pointerIndex)

                if (pointerId == activePointerId) {
                    val newPointerIndex = if (pointerIndex == 0) 1 else 0
                    lastTouchX = event.getX(newPointerIndex)
                    lastTouchY = event.getY(newPointerIndex)
                    activePointerId = event.getPointerId(newPointerIndex)
                }
            }
        }

        return true
    }

    private fun fixTrans() {
        matrix.getValues(values)
        val transX = values[Matrix.MTRANS_X]
        val transY = values[Matrix.MTRANS_Y]

        val fixTransX = getFixTrans(transX, viewWidth.toFloat(), imageWidth.toFloat(), scaleFactor)
        val fixTransY = getFixTrans(transY, viewHeight.toFloat(), imageHeight.toFloat(), scaleFactor)

        if (fixTransX != 0f || fixTransY != 0f) {
            matrix.postTranslate(fixTransX, fixTransY)
        }
    }

    private fun getFixTrans(trans: Float, viewSize: Float, contentSize: Float, scale: Float): Float {
        val minTrans: Float
        val maxTrans: Float

        if (contentSize <= viewSize) {
            minTrans = 0f
            maxTrans = viewSize - contentSize
        } else {
            minTrans = viewSize - contentSize
            maxTrans = 0f
        }

        if (trans < minTrans) return -trans + minTrans
        if (trans > maxTrans) return -trans + maxTrans

        return 0f
    }

    private val values = FloatArray(9)
    private val viewWidth get() = width
    private val viewHeight get() = height
    private val imageWidth get() = drawable?.intrinsicWidth ?: 0
    private val imageHeight get() = drawable?.intrinsicHeight ?: 0
}