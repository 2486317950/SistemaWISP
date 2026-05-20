//
//  InstallationViewModel.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation
import SwiftUI

enum InstallationUiState {
    case idle
    case loading
    case success
    case error(String)
}

@MainActor
class InstallationViewModel: ObservableObject {
    @Published var uiState: InstallationUiState = .idle
    @Published var installations: [Installation] = []
    
    private let installationService = InstallationService.shared
    private let tokenManager = TokenManager.shared
    
    func loadInstallations() {
        Task {
            guard let token = tokenManager.getToken() else {
                uiState = .error("No hay sesión activa")
                return
            }
            
            uiState = .loading
            do {
                installations = try await installationService.getInstallations(token: token)
                uiState = .success
            } catch let error as ApiError {
                let message = errorMessage(for: error)
                uiState = .error(message)
            } catch {
                uiState = .error("Error inesperado: \(error.localizedDescription)")
            }
        }
    }
    
    func createInstallation(_ request: InstallationRequest) {
        Task {
            guard let token = tokenManager.getToken() else {
                uiState = .error("No hay sesión activa")
                return
            }
            
            uiState = .loading
            do {
                let newInstallation = try await installationService.createInstallation(token: token, request: request)
                await loadInstallations()
                uiState = .success
            } catch let error as ApiError {
                let message = errorMessage(for: error)
                uiState = .error(message)
            } catch {
                uiState = .error("Error inesperado: \(error.localizedDescription)")
            }
        }
    }
    
    func updateInstallation(id: Int, request: InstallationRequest) {
        Task {
            guard let token = tokenManager.getToken() else {
                uiState = .error("No hay sesión activa")
                return
            }
            
            uiState = .loading
            do {
                _ = try await installationService.updateInstallation(token: token, id: id, request: request)
                await loadInstallations()
                uiState = .success
            } catch let error as ApiError {
                let message = errorMessage(for: error)
                uiState = .error(message)
            } catch {
                uiState = .error("Error inesperado: \(error.localizedDescription)")
            }
        }
    }
    
    func markAsCompleted(_ installation: Installation) {
        let request = InstallationRequest(
            client_id: installation.client_id,
            custom_name: installation.custom_name,
            address: installation.address,
            installation_date: installation.installation_date,
            installation_type: installation.installation_type,
            status: "completado",
            notes: installation.notes,
            installation_fee: installation.installation_fee,
            is_paid: installation.is_paid,
            technician_name: installation.technician_name,
            equipment_used: installation.equipment_used,
            completion_date: ISO8601DateFormatter().string(from: Date()),
            installation_time: installation.installation_time,
            package_id: installation.package_id,
            phone: installation.phone
        )
        
        if let id = installation.id {
            updateInstallation(id: id, request: request)
        }
    }
    
    func addNote(_ installation: Installation, note: String) {
        let updatedNotes = (installation.notes ?? "") + (installation.notes?.isEmpty == false ? "\n\n" : "") + note
        let request = InstallationRequest(
            client_id: installation.client_id,
            custom_name: installation.custom_name,
            address: installation.address,
            installation_date: installation.installation_date,
            installation_type: installation.installation_type,
            status: installation.status,
            notes: updatedNotes,
            installation_fee: installation.installation_fee,
            is_paid: installation.is_paid,
            technician_name: installation.technician_name,
            equipment_used: installation.equipment_used,
            completion_date: installation.completion_date,
            installation_time: installation.installation_time,
            package_id: installation.package_id,
            phone: installation.phone
        )
        
        if let id = installation.id {
            updateInstallation(id: id, request: request)
        }
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












