package com.avlasov.natasshka;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Получено событие загрузки системы");

            // Проверяем, был ли сервис запущен до перезагрузки
            SharedPreferences prefs = context.getSharedPreferences("messenger_prefs", Context.MODE_PRIVATE);
            boolean serviceEnabled = prefs.getBoolean("service_enabled", false);
            String serverIp = prefs.getString("server_ip", "");

            if (serviceEnabled && !serverIp.isEmpty()) {
                Intent serviceIntent = new Intent(context, MessengerService.class);
                serviceIntent.putExtra("server_ip", serverIp);

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }

                Log.d(TAG, "Сервис автоматически запущен после перезагрузки");
            }
        }
    }
}