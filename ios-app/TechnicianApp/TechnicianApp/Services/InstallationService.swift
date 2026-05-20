//
//  InstallationService.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

class InstallationService {
    static let shared = InstallationService()
    private let apiService = ApiService.shared
    
    private init() {}
    
    func getInstallations(token: String) async throws -> [Installation] {
        return try await apiService.request(
            endpoint: ApiConfig.installations,
            method: "GET",
            token: token
        )
    }
    
    func createInstallation(token: String, request: InstallationRequest) async throws -> Installation {
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)
        
        return try await apiService.request(
            endpoint: ApiConfig.installations,
            method: "POST",
            body: body,
            token: token
        )
    }
    
    func updateInstallation(token: String, id: Int, request: InstallationRequest) async throws -> Installation {
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)
        
        return try await apiService.request(
            endpoint: "\(ApiConfig.installations)/\(id)",
            method: "PUT",
            body: body,
            token: token
        )
    }
}












