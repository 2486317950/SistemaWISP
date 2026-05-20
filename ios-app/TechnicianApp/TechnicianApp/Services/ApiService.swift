//
//  ApiService.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

enum ApiError: Error {
    case invalidURL
    case noData
    case decodingError
    case serverError(Int, String)
    case networkError(Error)
}

class ApiService {
    static let shared = ApiService()
    
    private let session: URLSession
    private let baseURL: String
    
    init() {
        self.baseURL = ApiConfig.baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
    }
    
    func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        token: String? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw ApiError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw ApiError.noData
            }
            
            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                do {
                    let decoder = JSONDecoder()
                    return try decoder.decode(T.self, from: data)
                } catch {
                    print("Decoding error: \(error)")
                    throw ApiError.decodingError
                }
            } else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Error desconocido"
                throw ApiError.serverError(httpResponse.statusCode, errorMessage)
            }
        } catch let error as ApiError {
            throw error
        } catch {
            throw ApiError.networkError(error)
        }
    }
}












