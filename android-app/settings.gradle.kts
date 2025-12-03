pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }

    // Добавляем версии плагинов для совместимости
    plugins {
        id("com.android.application") version "8.13.1"
        id("org.jetbrains.kotlin.android") version "1.9.22"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven(url = "https://jitpack.io")
    }
}

rootProject.name = "NATaSSHka"
include(":app")