//
//  TrafficService.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

class TrafficService {
    static let shared = TrafficService()
    
    private let apiService = ApiService.shared
    
    func getTraffic(
        token: String,
        clientId: Int? = nil,
        installationId: Int? = nil,
        status: String? = nil
    ) async throws -> [Traffic] {
        var endpoint = "/api/traffic"
        var queryItems: [String] = []
        
        if let clientId = clientId {
            queryItems.append("client_id=\(clientId)")
        }
        if let installationId = installationId {
            queryItems.append("installation_id=\(installationId)")
        }
        if let status = status {
            queryItems.append("status=\(status)")
        }
        
        if !queryItems.isEmpty {
            endpoint += "?" + queryItems.joined(separator: "&")
        }
        
        return try await apiService.request(endpoint: endpoint, token: token)
    }
    
    func getTrafficByClient(token: String, clientId: Int) async throws -> [Traffic] {
        let endpoint = "/api/traffic/client/\(clientId)"
        return try await apiService.request(endpoint: endpoint, token: token)
    }
    
    func getTrafficStats(token: String) async throws -> TrafficStats {
        let endpoint = "/api/traffic/stats/summary"
        return try await apiService.request(endpoint: endpoint, token: token)
    }
    
    func createOrUpdateTraffic(token: String, request: TrafficRequest) async throws -> [String: Any] {
        let endpoint = "/api/traffic"
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)
        return try await apiService.request(endpoint: endpoint, method: "POST", body: body, token: token)
    }
}










