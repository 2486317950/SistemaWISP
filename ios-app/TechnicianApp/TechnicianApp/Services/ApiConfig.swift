//
//  ApiConfig.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

struct ApiConfig {
    // URL del servidor usando ngrok
    // Para desarrollo local con simulador: "http://localhost:5000"
    // Para dispositivo físico: usa el dominio ngrok o tu IP local
    static let baseURL = "https://sistemacdcom.ngrok.dev"
    
    // Endpoints
    static let login = "/api/auth/login"
    static let installations = "/api/installations"
    
    // Socket.IO endpoint (para tiempo real)
    static let socketURL = baseURL
}












