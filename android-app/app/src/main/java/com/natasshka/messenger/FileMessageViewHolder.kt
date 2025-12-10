// [file name]: FileMessageViewHolder.kt
package com.natasshka.messenger

import android.view.View
import androidx.core.content.ContextCompat
import com.natasshka.messenger.databinding.ItemFileMessageBinding

class FileMessageViewHolder(
    private val binding: ItemFileMessageBinding,
    private val onFileClickListener: (FileMessage) -> Unit,
    private val onRetryClickListener: (FileMessage) -> Unit
) : androidx.recyclerview.widget.RecyclerView.ViewHolder(binding.root) {

    fun bind(fileMessage: FileMessage) {
        with(binding) {
            // Настраиваем основные поля
            fileName.text = fileMessage.fileName

            // Форматируем размер файла
            if (fileMessage.fileSize > 0) {
                fileSize.text = FileManager(root.context).formatFileSize(fileMessage.fileSize)
                fileSize.visibility = View.VISIBLE
            } else {
                fileSize.visibility = View.GONE
            }

            // Устанавливаем иконку и цвет в зависимости от типа файла
            val fileManager = FileManager(root.context)
            val fileType = fileMessage.fileCategory

            fileIcon.setImageResource(fileManager.getFileIcon(fileType))
            fileCard.setCardBackgroundColor(
                ContextCompat.getColor(root.context, fileManager.getFileBackgroundColor(fileType))
            )

            // Показываем статус - всегда только тип файла
            statusText.text = when (fileType) {
                FileManager.FileType.IMAGE -> "📷 Изображение"
                FileManager.FileType.VIDEO -> "🎥 Видео"
                FileManager.FileType.AUDIO -> "🎵 Аудио"
                FileManager.FileType.DOCUMENT -> "📄 Файл"
            }
            statusText.visibility = View.VISIBLE

            // Показываем информацию о шифровании
            if (fileMessage.isEncrypted) {
                encryptionIndicator.visibility = View.VISIBLE
                statusText.text = "${statusText.text} (🔒)"
            } else {
                encryptionIndicator.visibility = View.GONE
            }

            // Скрываем кнопку "Повторить" и прогресс бар (ЗАКОММЕНТИРОВАННЫЕ СТРОКИ)
                //retryButton.visibility = View.GONE
            //uploadProgress.visibility = View.GONE

            // Обработчик кликов на всю карточку файла
            fileCard.setOnClickListener {
                onFileClickListener(fileMessage)
            }
        }
    }
}