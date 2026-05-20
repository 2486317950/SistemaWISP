//
//  NewInstallationView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct NewInstallationView: View {
    @ObservedObject var viewModel: InstallationViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var customName = ""
    @State private var address = ""
    @State private var installationDate = Date()
    @State private var installationType = "Nueva Instalación"
    @State private var phone = ""
    @State private var notes = ""
    
    let installationTypes = ["Nueva Instalación", "Reinstalación", "Mantenimiento"]
    
    var body: some View {
        NavigationView {
            Form {
                Section("Información del Cliente") {
                    TextField("Nombre", text: $customName)
                    TextField("Dirección", text: $address, axis: .vertical)
                        .lineLimit(3)
                    TextField("Teléfono", text: $phone)
                        .keyboardType(.phonePad)
                }
                
                Section("Detalles de Instalación") {
                    DatePicker("Fecha de Instalación", selection: $installationDate, displayedComponents: .date)
                    
                    Picker("Tipo", selection: $installationType) {
                        ForEach(installationTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    
                    TextField("Notas", text: $notes, axis: .vertical)
                        .lineLimit(5)
                }
            }
            .navigationTitle("Nueva Instalación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancelar") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Guardar") {
                        saveInstallation()
                    }
                    .disabled(customName.isEmpty || address.isEmpty)
                }
            }
            .onChange(of: viewModel.uiState) { newState in
                if case .success = newState {
                    dismiss()
                }
            }
        }
    }
    
    private func saveInstallation() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        
        let request = InstallationRequest(
            client_id: nil,
            custom_name: customName,
            address: address,
            installation_date: formatter.string(from: installationDate),
            installation_type: installationType,
            status: "pendiente",
            notes: notes.isEmpty ? nil : notes,
            installation_fee: nil,
            is_paid: false,
            technician_name: nil,
            equipment_used: nil,
            completion_date: nil,
            installation_time: nil,
            package_id: nil,
            phone: phone.isEmpty ? nil : phone
        )
        
        viewModel.createInstallation(request)
    }
}

#Preview {
    NewInstallationView(viewModel: InstallationViewModel())
}












