plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.sistemawisp.clientportal"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sistemawisp.clientportal"
        minSdk = 24
        targetSdk = 35
        versionCode = 6
        versionName = "1.2.5"

        // URL del portal
        buildConfigField("String", "PORTAL_URL", "\"http://52.14.80.92:5000\"")
        buildConfigField("String", "APPLICATION_ID", "\"$applicationId\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Para producción, define PORTAL_URL en tu CI o descomenta y ajusta:
            // buildConfigField("String", "PORTAL_URL", "\"https://tudominio.com\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.9.0")
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
