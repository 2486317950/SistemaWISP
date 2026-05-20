//
//  InstallationDetailView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct InstallationDetailView: View {
    let installation: Installation
    @ObservedObject var viewModel: InstallationViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var showCompleteDialog = false
    @State private var showNoteDialog = false
    @State private var noteText = ""
    @State private var pendingAction: PendingAction?
    
    enum PendingAction {
        case complete, addNote
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    DetailCard {
                        DetailItem(label: "Cliente", value: installation.display_name ?? installation.custom_name ?? "N/A")
                        
                        if let address = installation.display_address ?? installation.address {
                            Divider()
                            DetailItem(label: "Dirección", value: address)
                        }
                        
                        if let phone = installation.phone {
                            Divider()
                            DetailItem(label: "Teléfono", value: phone)
                        }
                        
                        Divider()
                        DetailItem(label: "Fecha de Instalación", value: formatDate(installation.installation_date))
                        
                        Divider()
                        DetailItem(label: "Tipo", value: installation.installation_type)
                        
                        Divider()
                        DetailItem(label: "Estado", value: installation.status)
                        
                        if let fee = installation.installation_fee, fee > 0 {
                            Divider()
                            DetailItem(label: "Costo de Instalación", value: String(format: "$%.2f", fee))
                        }
                        
                        if installation.is_paid {
                            Divider()
                            DetailItem(label: "Estado de Pago", value: "Pagado")
                        }
                        
                        if let packageName = installation.package_name {
                            Divider()
                            DetailItem(label: "Paquete", value: packageName)
                            if let speed = installation.package_speed {
                                DetailItem(label: "Velocidad", value: speed)
                            }
                        }
                        
                        if let technician = installation.technician_name {
                            Divider()
                            DetailItem(label: "Técnico", value: technician)
                        }
                        
                        if let equipment = installation.equipment_used {
                            Divider()
                            DetailItem(label: "Equipo Usado", value: equipment)
                        }
                        
                        if let time = installation.installation_time {
                            Divider()
                            DetailItem(label: "Tiempo de Instalación", value: "\(time) minutos")
                        }
                        
                        if let completionDate = installation.completion_date {
                            Divider()
                            DetailItem(label: "Fecha de Completado", value: formatDate(completionDate))
                        }
                        
                        if let folio = installation.installation_folio {
                            Divider()
                            DetailItem(label: "Folio de Instalación", value: folio)
                        }
                        
                        if let completionFolio = installation.completion_folio {
                            Divider()
                            DetailItem(label: "Folio de Completado", value: completionFolio)
                        }
                        
                        if let notes = installation.notes, !notes.isEmpty {
                            Divider()
                            DetailItem(label: "Notas", value: notes)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Detalles de Instalación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cerrar") {
                        dismiss()
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 16) {
                    if installation.status.lowercased() != "completado" && installation.status.lowercased() != "completada" {
                        Button(action: {
                            showCompleteDialog = true
                        }) {
                            Image(systemName: "checkmark")
                                .font(.title2)
                                .foregroundColor(.white)
                                .frame(width: 56, height: 56)
                                .background(Color.green)
                                .clipShape(Circle())
                        }
                    }
                    
                    Button(action: {
                        showNoteDialog = true
                    }) {
                        Image(systemName: "note.text")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 56, height: 56)
                            .background(Color.blue)
                            .clipShape(Circle())
                    }
                }
                .padding()
            }
            .alert("Marcar como Completada", isPresented: $showCompleteDialog) {
                Button("Cancelar", role: .cancel) {}
                Button("Confirmar") {
                    pendingAction = .complete
                    viewModel.markAsCompleted(installation)
                }
            } message: {
                Text("¿Estás seguro de marcar esta instalación como completada?")
            }
            .alert("Agregar Nota", isPresented: $showNoteDialog) {
                TextField("Nota", text: $noteText, axis: .vertical)
                    .lineLimit(5)
                Button("Cancelar", role: .cancel) {
                    noteText = ""
                }
                Button("Guardar") {
                    if !noteText.isEmpty {
                        pendingAction = .addNote
                        viewModel.addNote(installation, note: noteText)
                        noteText = ""
                    }
                }
            }
            .onChange(of: viewModel.uiState) { newState in
                if case .success = newState, pendingAction != nil {
                    pendingAction = nil
                    dismiss()
                }
            }
        }
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

struct DetailCard<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

struct DetailItem: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.body)
        }
    }
}

#Preview {
    InstallationDetailView(
        installation: Installation(
            id: 1,
            client_id: 1,
            custom_name: "Cliente de Prueba",
            address: "Dirección de Prueba",
            installation_date: "2024-01-15",
            installation_type: "Nueva Instalación",
            status: "pendiente",
            notes: nil,
            installation_fee: 500.0,
            is_paid: false,
            technician_name: nil,
            equipment_used: nil,
            completion_date: nil,
            installation_time: nil,
            package_id: nil,
            phone: nil,
            installation_folio: nil,
            completion_folio: nil,
            display_name: nil,
            display_address: nil,
            client_number: nil,
            package_name: nil,
            package_speed: nil,
            package_price: nil
        ),
        viewModel: InstallationViewModel()
    )
}












