package com.sistemawisp.technicianapp.utils

object ApiConfig {
    // URL del servidor usando ngrok
    // Para desarrollo local con emulador: "http://10.0.2.2:5000/"
    // Para dispositivo físico: usa el dominio ngrok o tu IP local
    const val BASE_URL = "https://sistemacdcom.ngrok.dev/"
    
    // Endpoints
    const val LOGIN = "/api/auth/login"
    const val INSTALLATIONS = "/api/installations"
    
    // Socket.IO endpoint (para tiempo real)
    const val SOCKET_URL = BASE_URL
}

