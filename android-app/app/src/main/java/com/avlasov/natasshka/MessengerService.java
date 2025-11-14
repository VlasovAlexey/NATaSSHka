package com.avlasov.natasshka;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.concurrent.TimeUnit;

public class MessengerService extends Service {
    private static final String TAG = "MessengerService";
    private static final String CHANNEL_ID = "messenger_notifications";
    private static final int NOTIFICATION_ID = 1;

    private WebSocketManager webSocketManager;
    private String serverIp;
    private Handler handler = new Handler();
    private boolean isConnected = false;
    private boolean isServiceRunning = false;

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        MessengerService getService() {
            return MessengerService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "MessengerService создан");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand вызван");

        if (intent != null) {
            serverIp = intent.getStringExtra("server_ip");
            if (serverIp != null) {
                try {
                    createNotificationChannel();
                    Notification notification = createNotification("Сервис запущен", "Подключение к серверу...");
                    if (notification != null) {
                        startForeground(NOTIFICATION_ID, notification);
                        connectToWebSocket();
                        isServiceRunning = true;
                        Log.d(TAG, "Сервис успешно запущен");
                    } else {
                        Log.e(TAG, "Не удалось создать уведомление");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Ошибка запуска сервиса: " + e.getMessage(), e);
                }
            } else {
                Log.e(TAG, "server_ip не передан в сервис");
            }
        } else {
            Log.e(TAG, "Intent равен null");
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    private void createNotificationChannel() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Уведомления мессенджера",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Уведомления о новых сообщениях");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setShowBadge(true);
                channel.enableVibration(true);
                channel.enableLights(true);

                NotificationManager manager = (NotificationManager) getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                    Log.d(TAG, "Канал уведомлений создан");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Ошибка создания канала уведомлений: " + e.getMessage(), e);
        }
    }

    private Notification createNotification(String title, String message) {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                    PendingIntent.FLAG_IMMUTABLE);

            return new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentIntent(pendingIntent)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .build();
        } catch (Exception e) {
            Log.e(TAG, "Ошибка создания уведомления: " + e.getMessage(), e);
            return null;
        }
    }

    private void connectToWebSocket() {
        try {
            Log.d(TAG, "Подключение к WebSocket...");
            String webSocketUrl = "ws://" + serverIp + ":3000";

            webSocketManager = new WebSocketManager(webSocketUrl);
            webSocketManager.setMessageListener(new WebSocketManager.MessageListener() {
                @Override
                public void onMessage(String message) {
                    Log.d(TAG, "Получено сообщение: " + message);
                    handleNewMessage(message);
                }

                @Override
                public void onConnected() {
                    Log.d(TAG, "WebSocket подключен");
                    isConnected = true;
                    updateNotification("Подключено", "Ожидание сообщений...");
                }

                @Override
                public void onDisconnected() {
                    Log.d(TAG, "WebSocket отключен");
                    isConnected = false;
                    updateNotification("Отключено", "Попытка переподключения...");
                    scheduleReconnection();
                }

                @Override
                public void onError(String error) {
                    Log.e(TAG, "WebSocket ошибка: " + error);
                    updateNotification("Ошибка", "Проверьте подключение");
                    scheduleReconnection();
                }
            });
            webSocketManager.connect();
        } catch (Exception e) {
            Log.e(TAG, "Ошибка подключения WebSocket: " + e.getMessage(), e);
            scheduleReconnection();
        }
    }

    private void handleNewMessage(String message) {
        try {
            Log.d(TAG, "Обработка сообщения: " + message);

            // Пытаемся распарсить как JSON
            JSONObject messageObj = new JSONObject(message);

            // Пропускаем системные сообщения
            boolean isSystem = messageObj.optBoolean("isSystem", false);
            boolean isKillAll = messageObj.optBoolean("isKillAll", false);

            if (isSystem || isKillAll) {
                Log.d(TAG, "Пропущено системное сообщение");
                return;
            }

            String username = messageObj.optString("username", "Неизвестный");
            String text = messageObj.optString("text", "");
            boolean isFile = messageObj.optBoolean("isFile", false);
            boolean isEncrypted = messageObj.optBoolean("isEncrypted", false);
            boolean isAudio = messageObj.optBoolean("isAudio", false);

            String notificationTitle = "Новое сообщение от " + username;
            String notificationText;

            if (isEncrypted) {
                notificationText = "🔒 Зашифрованное сообщение";
            } else if (isFile) {
                if (isAudio) {
                    String duration = messageObj.optString("duration", "0");
                    notificationText = "🎤 Голосовое сообщение (" + duration + " сек)";
                } else {
                    String fileName = messageObj.optString("fileName", "Файл");
                    notificationText = "📎 " + fileName;
                }
            } else {
                if (text.length() > 100) {
                    notificationText = text.substring(0, 100) + "...";
                } else {
                    notificationText = text;
                }
            }

            // Показываем уведомление
            showNotification(notificationTitle, notificationText);
            Log.d(TAG, "Уведомление показано: " + notificationTitle);

        } catch (JSONException e) {
            Log.e(TAG, "Ошибка парсинга JSON: " + e.getMessage());
            // Если не JSON, показываем как обычный текст
            showNotification("Новое сообщение", message.length() > 100 ? message.substring(0, 100) + "..." : message);
        } catch (Exception e) {
            Log.e(TAG, "Ошибка обработки сообщения: " + e.getMessage(), e);
        }
    }

    private void showNotification(String title, String message) {
        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(NotificationManager.class);
            if (notificationManager == null) {
                Log.e(TAG, "NotificationManager is null");
                return;
            }

            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                    PendingIntent.FLAG_IMMUTABLE);

            // Создаем уведомление с высоким приоритетом
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentIntent(pendingIntent)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setOnlyAlertOnce(false)
                    .setDefaults(Notification.DEFAULT_ALL); // Звук, вибрация, светодиод

            // Для Android 8.0+ устанавливаем важность
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                builder.setChannelId(CHANNEL_ID);
            }

            Notification notification = builder.build();

            // Используем уникальный ID для каждого уведомления
            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, notification);

            Log.d(TAG, "Уведомление отправлено: " + title);
        } catch (Exception e) {
            Log.e(TAG, "Ошибка показа уведомления: " + e.getMessage(), e);
        }
    }

    private void updateNotification(String title, String message) {
        try {
            Notification notification = createNotification(title, message);
            if (notification != null) {
                NotificationManager manager = (NotificationManager) getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.notify(NOTIFICATION_ID, notification);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Ошибка обновления уведомления: " + e.getMessage(), e);
        }
    }

    private void scheduleReconnection() {
        handler.postDelayed(() -> {
            if (!isConnected && isServiceRunning) {
                Log.d(TAG, "Попытка переподключения...");
                connectToWebSocket();
            }
        }, 5000); // 5 секунд
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "MessengerService уничтожается");
        isServiceRunning = false;

        if (webSocketManager != null) {
            webSocketManager.disconnect();
        }
        handler.removeCallbacksAndMessages(null);

        // Убираем уведомление
        NotificationManager manager = (NotificationManager) getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.cancel(NOTIFICATION_ID);
        }

        Log.d(TAG, "MessengerService уничтожен");
    }
}