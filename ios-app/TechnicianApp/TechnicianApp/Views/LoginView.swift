//
//  LoginView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var username = ""
    @State private var password = ""
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("Sistema WISP")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Técnico")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .padding(.bottom, 48)
                
                VStack(spacing: 16) {
                    TextField("Usuario", text: $username)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    
                    SecureField("Contraseña", text: $password)
                        .textFieldStyle(.roundedBorder)
                    
                    if case .error(let message) = authViewModel.uiState {
                        Text(message)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                    
                    Button(action: {
                        authViewModel.login(username: username, password: password)
                    }) {
                        if case .loading = authViewModel.uiState {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                        } else {
                            Text("Iniciar Sesión")
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(authViewModel.uiState == .loading || username.isEmpty || password.isEmpty)
                }
                .padding(.horizontal, 24)
                
                Spacer()
            }
            .padding()
            .navigationBarHidden(true)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}












