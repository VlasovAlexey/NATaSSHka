plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.natasshka.messenger"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.natasshka.messenger"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Для Android 10+ Scoped Storage
        manifestPlaceholders["usesCleartextTraffic"] = "true"
    }
// Для работы с файлами на Android 10+
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    // Для работы с изображениями
    implementation("com.github.bumptech.glide:glide:4.14.2")
        //kapt("com.github.bumptech.glide:compiler:4.14.2")

    // Для работы с видео
    implementation("com.google.android.exoplayer:exoplayer:2.18.7")

    // Для работы с файлами
    implementation("commons-io:commons-io:2.11.0")
    // Для обработки MIME типов
    implementation("org.apache.tika:tika-core:2.9.1")

    // Для работы с URI и файлами
    implementation("androidx.documentfile:documentfile:1.0.1")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Socket.IO
    implementation("io.socket:socket.io-client:2.1.0")

    // WorkManager с совместимой версией
    implementation("androidx.work:work-runtime-ktx:2.8.1")
    implementation("androidx.startup:startup-runtime:1.1.1")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")

    // OkHttp для проверки серверов
    implementation("com.squareup.okhttp3:okhttp:4.9.3")
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4")

    // Для шифрования совместимого с CryptoJS
    implementation("org.bouncycastle:bcprov-jdk15to18:1.73")
    implementation("commons-codec:commons-codec:1.16.0")

    // Base64 для Android
    implementation("androidx.core:core-ktx:1.12.0")

    // Для PBKDF2 (генерирует ключ как CryptoJS)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    
}