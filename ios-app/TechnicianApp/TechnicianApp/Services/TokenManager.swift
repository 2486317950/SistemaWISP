//
//  TokenManager.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation
import Combine

class TokenManager: ObservableObject {
    static let shared = TokenManager()
    
    private let tokenKey = "auth_token"
    private let usernameKey = "username"
    private let roleKey = "role"
    
    @Published var currentRole: String?
    
    private init() {
        currentRole = getRole()
    }
    
    func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
    }
    
    func getToken() -> String? {
        return UserDefaults.standard.string(forKey: tokenKey)
    }
    
    func clearToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
    
    func saveUser(username: String, role: String) {
        UserDefaults.standard.set(username, forKey: usernameKey)
        UserDefaults.standard.set(role, forKey: roleKey)
        currentRole = role
    }
    
    func getUsername() -> String? {
        return UserDefaults.standard.string(forKey: usernameKey)
    }
    
    func getRole() -> String? {
        return UserDefaults.standard.string(forKey: roleKey)
    }
    
    func clearUser() {
        UserDefaults.standard.removeObject(forKey: usernameKey)
        UserDefaults.standard.removeObject(forKey: roleKey)
        currentRole = nil
    }
    
    func isLoggedIn() -> Bool {
        return getToken() != nil
    }
}



