//
//  User.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let username: String
    let role: String
}

struct LoginRequest: Codable {
    let username: String
    let password: String
}

struct LoginResponse: Codable {
    let token: String
    let user: User
}












