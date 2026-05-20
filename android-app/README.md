# App Android para Técnicos - Sistema WISP

Aplicación Android desarrollada en Kotlin para que los técnicos puedan gestionar instalaciones en tiempo real.

## Características

- ✅ Login con autenticación JWT
- ✅ Ver instalaciones existentes
- ✅ Programar nuevas instalaciones
- ✅ Marcar instalaciones como completadas
- ✅ Agregar notas a instalaciones
- ✅ Sincronización en tiempo real con el servidor

## Requisitos

- Android Studio Hedgehog (2023.1.1) o superior
- Android SDK 24 (Android 7.0) o superior
- Kotlin 1.9.0 o superior
- Gradle 8.0 o superior

## Configuración

1. Abre el proyecto en Android Studio
2. La URL del servidor ya está configurada con ngrok: `https://sistemacdcom.ngrok.dev`
   - Si necesitas cambiar la URL, edita `app/src/main/java/com/sistemawisp/technicianapp/utils/ApiConfig.kt`
3. Sincroniza las dependencias (Gradle)
4. Compila y ejecuta la aplicación

## Estructura del Proyecto

```
android-app/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/sistemawisp/technicianapp/
│   │   │   │   ├── data/
│   │   │   │   │   ├── api/          # Servicios API
│   │   │   │   │   ├── database/     # Base de datos local (Room)
│   │   │   │   │   └── repository/   # Repositorios
│   │   │   │   ├── ui/
│   │   │   │   │   ├── login/        # Pantalla de login
│   │   │   │   │   ├── installations/ # Pantallas de instalaciones
│   │   │   │   │   └── common/        # Componentes comunes
│   │   │   │   ├── viewmodel/        # ViewModels
│   │   │   │   └── utils/            # Utilidades
│   │   │   └── res/                  # Recursos (layouts, strings, etc.)
│   │   └── test/                     # Tests
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

## API Endpoints Utilizados

- `POST /api/auth/login` - Iniciar sesión
- `GET /api/installations` - Obtener instalaciones
- `POST /api/installations` - Crear instalación
- `PUT /api/installations/:id` - Actualizar instalación

## Tecnologías Utilizadas

- **Kotlin** - Lenguaje de programación
- **Jetpack Compose** - UI moderna
- **Retrofit** - Cliente HTTP
- **Room** - Base de datos local
- **Coroutines** - Programación asíncrona
- **Material Design 3** - Diseño de UI
- **Hilt** - Inyección de dependencias
- **Socket.IO** - Sincronización en tiempo real

