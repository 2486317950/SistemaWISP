//
//  TechnicianAppApp.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

@main
struct TechnicianAppApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
        }
    }
}












