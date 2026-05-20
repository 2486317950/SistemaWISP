//
//  AuthViewModel.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation
import SwiftUI

enum AuthUiState {
    case idle
    case loading
    case success
    case error(String)
}

@MainActor
class AuthViewModel: ObservableObject {
    @Published var uiState: AuthUiState = .idle
    @Published var isLoggedIn: Bool = false
    
    private let authService = AuthService.shared
    private let tokenManager = TokenManager.shared
    
    init() {
        isLoggedIn = tokenManager.isLoggedIn()
        if isLoggedIn {
            uiState = .success
        }
    }
    
    func login(username: String, password: String) {
        Task {
            uiState = .loading
            do {
                let response = try await authService.login(username: username, password: password)
                tokenManager.saveToken(response.token)
                tokenManager.saveUser(username: response.user.username, role: response.user.role)
                isLoggedIn = true
                uiState = .success
            } catch let error as ApiError {
                let message = errorMessage(for: error)
                uiState = .error(message)
            } catch {
                uiState = .error("Error inesperado: \(error.localizedDescription)")
            }
        }
    }
    
    func logout() {
        tokenManager.clearToken()
        tokenManager.clearUser()
        isLoggedIn = false
        uiState = .idle
    }
    
    private func errorMessage(for error: ApiError) -> String {
        switch error {
        case .invalidURL:
            return "URL inválida"
        case .noData:
            return "No se recibieron datos del servidor"
        case .decodingError:
            return "Error al procesar la respuesta del servidor"
        case .serverError(let code, let message):
            switch code {
            case 401:
                return "Usuario o contraseña incorrectos"
            case 403:
                return "Acceso denegado"
            case 404:
                return "Servicio no encontrado"
            case 500:
                return "Error del servidor"
            default:
                return message.isEmpty ? "Error del servidor (Código: \(code))" : message
            }
        case .networkError(let error):
            if let urlError = error as? URLError {
                switch urlError.code {
                case .notConnectedToInternet:
                    return "No se puede conectar al servidor. Verifica tu conexión a internet."
                case .timedOut:
                    return "Tiempo de espera agotado. El servidor no responde."
                default:
                    return "Error de conexión: \(error.localizedDescription)"
                }
            }
            return "Error de conexión: \(error.localizedDescription)"
        }
    }
}












