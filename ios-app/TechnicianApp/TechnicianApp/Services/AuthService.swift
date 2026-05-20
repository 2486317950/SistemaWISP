//
//  AuthService.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

class AuthService {
    static let shared = AuthService()
    private let apiService = ApiService.shared
    
    private init() {}
    
    func login(username: String, password: String) async throws -> LoginResponse {
        let request = LoginRequest(username: username, password: password)
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)
        
        return try await apiService.request(
            endpoint: ApiConfig.login,
            method: "POST",
            body: body
        )
    }
}












