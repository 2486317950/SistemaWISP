# TechnicianApp iOS

Aplicación iOS para técnicos del Sistema WISP, desarrollada en SwiftUI.

## Requisitos

- Xcode 15.0 o superior
- iOS 17.0 o superior
- Swift 5.9 o superior

## Estructura del Proyecto

```
TechnicianApp/
├── TechnicianAppApp.swift      # Punto de entrada de la aplicación
├── ContentView.swift           # Vista principal con navegación
├── Models/                      # Modelos de datos
│   ├── User.swift
│   └── Installation.swift
├── Services/                   # Servicios de red y almacenamiento
│   ├── ApiConfig.swift
│   ├── ApiService.swift
│   ├── AuthService.swift
│   ├── InstallationService.swift
│   └── TokenManager.swift
├── ViewModels/                 # ViewModels (lógica de negocio)
│   ├── AuthViewModel.swift
│   └── InstallationViewModel.swift
└── Views/                      # Pantallas (SwiftUI Views)
    ├── LoginView.swift
    ├── InstallationListView.swift
    ├── InstallationDetailView.swift
    └── NewInstallationView.swift
```

## Configuración

1. Abre el proyecto en Xcode:
   ```bash
   open ios-app/TechnicianApp/TechnicianApp.xcodeproj
   ```

2. Configura la URL del servidor en `ApiConfig.swift`:
   ```swift
   static let baseURL = "https://sistemacdcom.ngrok.dev"
   ```

3. Para desarrollo local con simulador, cambia a:
   ```swift
   static let baseURL = "http://localhost:5000"
   ```

4. Para dispositivo físico, usa tu IP local o el dominio ngrok:
   ```swift
   static let baseURL = "http://192.168.1.X:5000"  // Tu IP local
   // o
   static let baseURL = "https://sistemacdcom.ngrok.dev"
   ```

## Funcionalidades

- ✅ Inicio de sesión
- ✅ Lista de instalaciones
- ✅ Detalles de instalación
- ✅ Crear nueva instalación
- ✅ Marcar instalación como completada
- ✅ Agregar notas a instalaciones
- ✅ Cerrar sesión

## Características

- **SwiftUI**: Interfaz moderna y declarativa
- **Async/Await**: Manejo asíncrono moderno
- **MVVM**: Arquitectura Model-View-ViewModel
- **UserDefaults**: Almacenamiento local de tokens
- **Manejo de errores**: Mensajes de error claros y específicos

## Compilar y Ejecutar

1. Selecciona un simulador o dispositivo físico en Xcode
2. Presiona `Cmd + R` para compilar y ejecutar
3. O usa el botón "Play" en Xcode

## Notas

- La app requiere conexión a internet para funcionar
- El token de autenticación se guarda localmente usando UserDefaults
- Las instalaciones se cargan automáticamente al iniciar la app
- La app se actualiza automáticamente después de crear o actualizar instalaciones

## Solución de Problemas

### Error de conexión
- Verifica que la URL del servidor sea correcta
- Asegúrate de que el servidor esté corriendo
- Para simulador, usa `localhost:5000`
- Para dispositivo físico, usa tu IP local o ngrok

### Error de autenticación
- Verifica que las credenciales sean correctas
- Asegúrate de que el usuario tenga rol "technician" en el servidor

### Error al cargar instalaciones
- Verifica que el token sea válido
- Revisa los logs del servidor para más detalles












