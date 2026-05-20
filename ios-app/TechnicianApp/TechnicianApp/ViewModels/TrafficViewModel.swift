//
//  TrafficViewModel.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation
import SwiftUI

enum TrafficUiState {
    case idle
    case loading
    case success
    case error(String)
}

@MainActor
class TrafficViewModel: ObservableObject {
    @Published var uiState: TrafficUiState = .idle
    @Published var traffic: [Traffic] = []
    @Published var stats: TrafficStats?
    
    private let trafficService = TrafficService.shared
    private let tokenManager = TokenManager.shared
    
    func loadTraffic(clientId: Int? = nil, installationId: Int? = nil, status: String? = nil) {
        Task {
            guard let token = tokenManager.getToken() else {
                uiState = .error("No hay sesión activa")
                return
            }
            
            uiState = .loading
            do {
                traffic = try await trafficService.getTraffic(
                    token: token,
                    clientId: clientId,
                    installationId: installationId,
                    status: status
                )
                uiState = .success
            } catch let error as ApiError {
                let message = errorMessage(for: error)
                uiState = .error(message)
            } catch {
                uiState = .error("Error inesperado: \(error.localizedDescription)")
            }
        }
    }
    
    func loadStats() {
        Task {
            guard let token = tokenManager.getToken() else {
                return
            }
            
            do {
                stats = try await trafficService.getTrafficStats(token: token)
            } catch {
                print("Error al cargar estadísticas: \(error.localizedDescription)")
            }
        }
    }
    
    func refresh() {
        loadTraffic()
        loadStats()
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
            return message.isEmpty ? "Error del servidor (Código: \(code))" : message
        case .networkError(let error):
            return "Error de conexión: \(error.localizedDescription)"
        }
    }
}










