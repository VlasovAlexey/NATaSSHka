package com.avlasov.natasshka;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final int IGNORE_BATTERY_OPTIMIZATION_REQUEST = 101;

    private WebView webView;
    private EditText serverIpInput;
    private Button connectButton;
    private Button startServiceButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupWebView();
        requestPermissions();
        setupClickListeners();
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        serverIpInput = findViewById(R.id.serverIpInput);
        connectButton = findViewById(R.id.connectButton);
        startServiceButton = findViewById(R.id.startServiceButton);

        // Установите 10.0.2.2 по умолчанию для удобства
        serverIpInput.setText("10.0.2.2");
    }

    // WebAppInterface класс для связи между JavaScript и Java
    public class WebAppInterface {
        private Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void onNewMessage(String message) {
            Log.d("WebAppInterface", "Новое сообщение из WebView: " + message);
            // Здесь можно отправить сообщение в сервис или показать уведомление
            showNotificationFromWebView(message);
        }

        @JavascriptInterface
        public void onSocketEvent(String event, String data) {
            Log.d("WebAppInterface", "Socket event: " + event + ", data: " + data);
        }
    }

    private void showNotificationFromWebView(String message) {
        try {
            // Показываем уведомление при получении сообщения из WebView
            NotificationManager notificationManager = (NotificationManager) getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                Intent intent = new Intent(this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                        PendingIntent.FLAG_IMMUTABLE);

                Notification notification = new NotificationCompat.Builder(this, "messenger_notifications")
                        .setContentTitle("Новое сообщение из чата")
                        .setContentText(message.length() > 100 ? message.substring(0, 100) + "..." : message)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentIntent(pendingIntent)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .build();

                int notificationId = (int) System.currentTimeMillis();
                notificationManager.notify(notificationId, notification);
                Log.d("WebAppInterface", "Уведомление показано из WebView");
            }
        } catch (Exception e) {
            Log.e("WebAppInterface", "Ошибка показа уведомления из WebView: " + e.getMessage());
        }
    }

    private void setupWebView() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

        // Разрешаем смешанный контент (HTTP в HTTPS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Включаем отладку WebView
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Добавляем JavaScript интерфейс
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("WebView", "Страница загружена: " + url);

                // Внедряем JavaScript для отслеживания сообщений ПОСЛЕ загрузки страницы
                injectMessageListener();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.e("WebView", "Ошибка загрузки: " + error.getDescription());
                Toast.makeText(MainActivity.this, "Ошибка загрузки: " + error.getDescription(), Toast.LENGTH_LONG).show();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e("WebView", "Ошибка " + errorCode + ": " + description);
                Toast.makeText(MainActivity.this, "Ошибка " + errorCode + ": " + description, Toast.LENGTH_LONG).show();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
    }

    private void injectMessageListener() {
        String jsCode =
                "// Ждем пока загрузится Socket.IO\n" +
                        "function waitForSocket() {\n" +
                        "    if (typeof io !== 'undefined' && window.socket) {\n" +
                        "        setupSocketListeners();\n" +
                        "    } else {\n" +
                        "        setTimeout(waitForSocket, 100);\n" +
                        "    }\n" +
                        "}\n" +
                        "\n" +
                        "function setupSocketListeners() {\n" +
                        "    // Слушаем входящие сообщения\n" +
                        "    window.socket.on('new-message', function(data) {\n" +
                        "        console.log('Получено сообщение через WebView:', data);\n" +
                        "        try {\n" +
                        "            let messageText = '';\n" +
                        "            if (data.text) {\n" +
                        "                messageText = data.text;\n" +
                        "            } else if (data.fileName) {\n" +
                        "                messageText = 'Файл: ' + data.fileName;\n" +
                        "            }\n" +
                        "            \n" +
                        "            if (messageText) {\n" +
                        "                Android.onNewMessage(messageText);\n" +
                        "            }\n" +
                        "        } catch (e) {\n" +
                        "            console.error('Ошибка обработки сообщения:', e);\n" +
                        "        }\n" +
                        "    });\n" +
                        "    \n" +
                        "    // Слушаем другие события\n" +
                        "    window.socket.on('user-joined', function(data) {\n" +
                        "        Android.onSocketEvent('user-joined', JSON.stringify(data));\n" +
                        "    });\n" +
                        "    \n" +
                        "    window.socket.on('user-left', function(data) {\n" +
                        "        Android.onSocketEvent('user-left', JSON.stringify(data));\n" +
                        "    });\n" +
                        "    \n" +
                        "    console.log('Socket listeners установлены в WebView');\n" +
                        "}\n" +
                        "\n" +
                        "// Также отслеживаем изменения в DOM (резервный метод)\n" +
                        "function observeMessages() {\n" +
                        "    const targetNode = document.getElementById('messagesContainer');\n" +
                        "    if (targetNode) {\n" +
                        "        const config = { childList: true, subtree: true };\n" +
                        "        const callback = function(mutationsList, observer) {\n" +
                        "            for(let mutation of mutationsList) {\n" +
                        "                if (mutation.type === 'childList') {\n" +
                        "                    const newMessages = targetNode.querySelectorAll('.message:not(.processed)');\n" +
                        "                    newMessages.forEach(message => {\n" +
                        "                        message.classList.add('processed');\n" +
                        "                        const textElement = message.querySelector('.message-text');\n" +
                        "                        if (textElement) {\n" +
                        "                            Android.onNewMessage(textElement.textContent);\n" +
                        "                        }\n" +
                        "                    });\n" +
                        "                }\n" +
                        "            }\n" +
                        "        };\n" +
                        "        const observer = new MutationObserver(callback);\n" +
                        "        observer.observe(targetNode, config);\n" +
                        "    }\n" +
                        "}\n" +
                        "\n" +
                        "// Запускаем оба метода\n" +
                        "waitForSocket();\n" +
                        "setTimeout(observeMessages, 2000);\n" +
                        "\n" +
                        "console.log('Message listener injected successfully');";

        // Выполняем JavaScript код после загрузки страницы
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webView.evaluateJavascript(jsCode, value -> {
                Log.d("WebView", "JavaScript код выполнен: " + value);
            });
        } else {
            webView.loadUrl("javascript:" + jsCode);
        }
    }

    private void requestPermissions() {
        String[] permissions = {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.POST_NOTIFICATIONS
        };

        boolean allPermissionsGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allPermissionsGranted = false;
                break;
            }
        }

        if (!allPermissionsGranted) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }

        // Запрос игнорирования оптимизации батареи
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            String packageName = getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
                startActivityForResult(intent, IGNORE_BATTERY_OPTIMIZATION_REQUEST);
            }
        }
    }

    private void setupClickListeners() {
        connectButton.setOnClickListener(v -> connectToServer());
        startServiceButton.setOnClickListener(v -> startMessengerService());
    }

    private void connectToServer() {
        String serverIp = serverIpInput.getText().toString().trim();
        if (serverIp.isEmpty()) {
            Toast.makeText(this, "Введите IP адрес сервера", Toast.LENGTH_SHORT).show();
            return;
        }

        String url;
        if ("localhost".equals(serverIp) || "127.0.0.1".equals(serverIp)) {
            url = "http://10.0.2.2:3000";
        } else {
            url = "http://" + serverIp + ":3000";
        }

        Log.d("MainActivity", "Loading URL: " + url);
        webView.loadUrl(url);
        Toast.makeText(this, "Подключаемся к серверу...", Toast.LENGTH_SHORT).show();
    }

    private void startMessengerService() {
        String serverIp = serverIpInput.getText().toString().trim();
        if (serverIp.isEmpty()) {
            Toast.makeText(this, "Введите IP адрес сервера", Toast.LENGTH_SHORT).show();
            return;
        }

        // Если localhost, используем 10.0.2.2 для сервиса
        if ("localhost".equals(serverIp) || "127.0.0.1".equals(serverIp)) {
            serverIp = "10.0.2.2";
        }

        try {
            Intent serviceIntent = new Intent(this, MessengerService.class);
            serviceIntent.putExtra("server_ip", serverIp);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }

            Toast.makeText(this, "Сервис уведомлений запущен", Toast.LENGTH_SHORT).show();
            Log.d("MainActivity", "Сервис запущен для IP: " + serverIp);
        } catch (Exception e) {
            Log.e("MainActivity", "Ошибка запуска сервиса: " + e.getMessage(), e);
            Toast.makeText(this, "Ошибка запуска сервиса: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            StringBuilder deniedPermissions = new StringBuilder();
            for (int i = 0; i < grantResults.length; i++) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    String permissionName = getPermissionName(permissions[i]);
                    deniedPermissions.append(permissionName).append("\n");
                }
            }
            if (deniedPermissions.length() > 0) {
                String message = "Следующие разрешения не предоставлены:\n" + deniedPermissions.toString() +
                        "\nПриложение может работать некорректно.";
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "Все разрешения предоставлены", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private String getPermissionName(String permission) {
        switch (permission) {
            case Manifest.permission.CAMERA:
                return "• Камера";
            case Manifest.permission.RECORD_AUDIO:
                return "• Микрофон";
            case Manifest.permission.WRITE_EXTERNAL_STORAGE:
                return "• Запись файлов";
            case Manifest.permission.READ_EXTERNAL_STORAGE:
                return "• Чтение файлов";
            case Manifest.permission.POST_NOTIFICATIONS:
                return "• Уведомления";
            default:
                return "• " + permission;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == IGNORE_BATTERY_OPTIMIZATION_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                if (pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Toast.makeText(this, "Оптимизация батареи отключена", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.d("MainActivity", "Активность возобновлена");
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d("MainActivity", "Активность приостановлена");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d("MainActivity", "Активность уничтожена");
    }
}