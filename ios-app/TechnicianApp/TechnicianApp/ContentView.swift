//
//  ContentView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        Group {
            if authViewModel.isLoggedIn {
                InstallationListView()
                    .environmentObject(authViewModel)
            } else {
                LoginView()
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
}












