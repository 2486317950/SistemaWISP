//
//  AdminNavBar.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct NavMenuItem: Identifiable {
    let id = UUID()
    let route: String
    let label: String
    let icon: String
}

struct AdminNavBar: View {
    @ObservedObject var tokenManager: TokenManager
    @Binding var selectedRoute: String?
    @State private var isExpanded = false
    
    var body: some View {
        let userRole = tokenManager.getRole()
        
        // Solo mostrar si es admin
        if userRole != "admin" {
            return AnyView(EmptyView())
        }
        
        let menuItems = [
            NavMenuItem(route: "dashboard", label: "Dashboard", icon: "chart.bar"),
            NavMenuItem(route: "clients", label: "Clientes", icon: "person.2"),
            NavMenuItem(route: "client_contract", label: "Contrato Cliente", icon: "doc.text"),
            NavMenuItem(route: "contracts", label: "Contratos Guardados", icon: "folder"),
            NavMenuItem(route: "packages", label: "Paquetes", icon: "cube.box"),
            NavMenuItem(route: "payments", label: "Pagos", icon: "creditcard"),
            NavMenuItem(route: "provider_payments", label: "Pago Proveedores", icon: "banknote"),
            NavMenuItem(route: "supply_invoices", label: "Facturas de Insumos", icon: "doc.text.magnifyingglass"),
            NavMenuItem(route: "quotations", label: "Cotizaciones", icon: "pencil.and.list.clipboard"),
            NavMenuItem(route: "installations", label: "Instalaciones", icon: "wrench.and.screwdriver"),
            NavMenuItem(route: "folios", label: "Folios", icon: "list.bullet"),
            NavMenuItem(route: "receipts", label: "Recibos", icon: "doc.text"),
            NavMenuItem(route: "expenses", label: "Gastos", icon: "arrow.down.circle"),
            NavMenuItem(route: "transfers", label: "Transferencias", icon: "arrow.left.arrow.right"),
            NavMenuItem(route: "employees", label: "Empleados", icon: "person.badge.key"),
            NavMenuItem(route: "ip_credentials", label: "IPs y Contraseñas", icon: "lock"),
            NavMenuItem(route: "networks", label: "Redes", icon: "network"),
            NavMenuItem(route: "traffic", label: "Tráfico", icon: "antenna.radiowaves.left.and.right"),
            NavMenuItem(route: "monthly_reports", label: "Reportes Mensuales", icon: "chart.line.uptrend.xyaxis"),
            NavMenuItem(route: "whatsapp", label: "WhatsApp", icon: "message"),
            NavMenuItem(route: "settings", label: "Configuración", icon: "gear"),
            NavMenuItem(route: "users", label: "Usuarios", icon: "person")
        ]
        
        return AnyView(
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("🌐 Sistema WISP")
                        .font(.headline)
                        .foregroundColor(.primary)
                    Spacer()
                    Button(action: {
                        withAnimation {
                            isExpanded.toggle()
                        }
                    }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(.primary)
                    }
                }
                .padding()
                .background(Color(.systemBackground))
                
                // Menu items
                if isExpanded {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(menuItems) { item in
                                Button(action: {
                                    selectedRoute = item.route
                                    withAnimation {
                                        isExpanded = false
                                    }
                                }) {
                                    HStack {
                                        Image(systemName: item.icon)
                                            .foregroundColor(.blue)
                                            .frame(width: 24)
                                        Text(item.label)
                                            .foregroundColor(.primary)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .background(Color(.systemBackground))
                                }
                                Divider()
                            }
                        }
                    }
                    .frame(maxHeight: 400)
                    .background(Color(.systemBackground))
                }
            }
            .background(Color(.systemBackground))
            .cornerRadius(8)
            .shadow(radius: 2)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        )
    }
}










