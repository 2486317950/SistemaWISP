//
//  InstallationListView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct InstallationListView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = InstallationViewModel()
    @State private var showingNewInstallation = false
    @State private var selectedInstallation: Installation?
    @State private var showingLogoutAlert = false
    @State private var showingTraffic = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                AdminNavBar(
                    tokenManager: TokenManager.shared,
                    selectedRoute: .constant(nil)
                )
                
                Group {
                switch viewModel.uiState {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    
                case .error(let message):
                    VStack(spacing: 16) {
                        Text(message)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                        
                        Button("Reintentar") {
                            viewModel.loadInstallations()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                    
                default:
                    if viewModel.installations.isEmpty {
                        Text("No hay instalaciones")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        List(viewModel.installations) { installation in
                            InstallationCard(installation: installation)
                                .onTapGesture {
                                    selectedInstallation = installation
                                }
                        }
                        .listStyle(.plain)
                    }
                }
                }
            }
            .navigationTitle("Instalaciones")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: {
                            showingTraffic = true
                        }) {
                            Image(systemName: "chart.bar")
                        }
                        
                        Button(action: {
                            viewModel.loadInstallations()
                        }) {
                            Image(systemName: "arrow.clockwise")
                        }
                        
                        Button(action: {
                            showingLogoutAlert = true
                        }) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
            }
            .sheet(item: $selectedInstallation) { installation in
                InstallationDetailView(installation: installation, viewModel: viewModel)
            }
            .sheet(isPresented: $showingNewInstallation) {
                NewInstallationView(viewModel: viewModel)
            }
            .sheet(isPresented: $showingTraffic) {
                TrafficListView()
            }
            .alert("Cerrar Sesión", isPresented: $showingLogoutAlert) {
                Button("Cancelar", role: .cancel) {}
                Button("Cerrar Sesión", role: .destructive) {
                    authViewModel.logout()
                }
            } message: {
                Text("¿Estás seguro de que deseas cerrar sesión?")
            }
            .onAppear {
                viewModel.loadInstallations()
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: {
                showingNewInstallation = true
            }) {
                Image(systemName: "plus")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.accentColor)
                    .clipShape(Circle())
                    .shadow(radius: 4)
            }
            .padding()
        }
    }
}

struct InstallationCard: View {
    let installation: Installation
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(installation.display_name ?? installation.custom_name ?? "Sin nombre")
                .font(.headline)
            
            Text(installation.display_address ?? installation.address ?? "Sin dirección")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack {
                Text(formatDate(installation.installation_date))
                    .font(.caption)
                
                Spacer()
                
                StatusChip(status: installation.status)
            }
        }
        .padding(.vertical, 8)
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: dateString) {
            formatter.dateFormat = "dd/MM/yyyy"
            return formatter.string(from: date)
        }
        return dateString
    }
}

struct StatusChip: View {
    let status: String
    
    var body: some View {
        let (text, color) = statusInfo(for: status)
        
        Text(text)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(8)
    }
    
    private func statusInfo(for status: String) -> (String, Color) {
        switch status.lowercased() {
        case "completado", "completada":
            return ("Completada", .blue)
        case "en proceso", "en_proceso":
            return ("En Proceso", .orange)
        case "cancelada", "cancelado":
            return ("Cancelada", .red)
        default:
            return ("Pendiente", .gray)
        }
    }
}

#Preview {
    InstallationListView()
        .environmentObject(AuthViewModel())
}



