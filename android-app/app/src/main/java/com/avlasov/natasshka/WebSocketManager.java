package com.avlasov.natasshka;

import android.util.Log;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class WebSocketManager {
    private static final String TAG = "WebSocketManager";
    private WebSocket webSocket;
    private OkHttpClient client;
    private String serverUrl;
    private MessageListener messageListener;

    public interface MessageListener {
        void onMessage(String message);
        void onConnected();
        void onDisconnected();
        void onError(String error);
    }

    public WebSocketManager(String serverUrl) {
        this.serverUrl = serverUrl;
        setupHttpClient();
    }

    public void setMessageListener(MessageListener listener) {
        this.messageListener = listener;
    }

    private void setupHttpClient() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override public void checkClientTrusted(
                                java.security.cert.X509Certificate[] chain, String authType) {
                        }

                        @Override public void checkServerTrusted(
                                java.security.cert.X509Certificate[] chain, String authType) {
                        }

                        @Override public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                            return new java.security.cert.X509Certificate[]{};
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            client = new OkHttpClient.Builder()
                    .sslSocketFactory(sslSocketFactory, (X509TrustManager)trustAllCerts[0])
                    .hostnameVerifier((hostname, session) -> true)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .build();

        } catch (Exception e) {
            client = new OkHttpClient.Builder()
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .build();
        }
    }

    public void connect() {
        try {
            Request request = new Request.Builder()
                    .url(serverUrl)
                    .build();

            webSocket = client.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket webSocket, Response response) {
                    Log.d(TAG, "WebSocket connected");
                    if (messageListener != null) {
                        messageListener.onConnected();
                    }
                }

                @Override
                public void onMessage(WebSocket webSocket, String text) {
                    Log.d(TAG, "Received message: " + text);
                    if (messageListener != null) {
                        messageListener.onMessage(text);
                    }
                }

                @Override
                public void onMessage(WebSocket webSocket, ByteString bytes) {
                    Log.d(TAG, "Received bytes: " + bytes.hex());
                }

                @Override
                public void onClosing(WebSocket webSocket, int code, String reason) {
                    Log.d(TAG, "WebSocket closing: " + code + " " + reason);
                }

                @Override
                public void onClosed(WebSocket webSocket, int code, String reason) {
                    Log.d(TAG, "WebSocket closed: " + code + " " + reason);
                    if (messageListener != null) {
                        messageListener.onDisconnected();
                    }
                }

                @Override
                public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                    Log.e(TAG, "WebSocket error: " + t.getMessage());
                    if (messageListener != null) {
                        messageListener.onError(t.getMessage());
                    }
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "WebSocket connection error: " + e.getMessage());
            if (messageListener != null) {
                messageListener.onError(e.getMessage());
            }
        }
    }

    public void sendMessage(String message) {
        if (webSocket != null) {
            webSocket.send(message);
        }
    }

    public void disconnect() {
        if (webSocket != null) {
            webSocket.close(1000, "Normal closure");
        }
        if (client != null) {
            client.dispatcher().executorService().shutdown();
        }
    }
}