//
//  TrafficListView.swift
//  TechnicianApp
//
//  Created on iOS
//

import SwiftUI

struct TrafficListView: View {
    @StateObject private var viewModel = TrafficViewModel()
    @State private var autoRefresh = true
    @State private var refreshInterval = 30
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Controles
                HStack {
                    Toggle("Auto-actualizar", isOn: $autoRefresh)
                    if autoRefresh {
                        Picker("Intervalo", selection: $refreshInterval) {
                            Text("10 seg").tag(10)
                            Text("30 seg").tag(30)
                            Text("1 min").tag(60)
                            Text("2 min").tag(120)
                            Text("5 min").tag(300)
                        }
                        .pickerStyle(.menu)
                    }
                    Spacer()
                    Button(action: { viewModel.refresh() }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .padding()
                
                // Estadísticas
                if let stats = viewModel.stats {
                    StatsView(stats: stats)
                }
                
                // Lista de tráfico
                Group {
                    switch viewModel.uiState {
                    case .loading:
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .error(let message):
                        VStack {
                            Text("Error: \(message)")
                                .foregroundColor(.red)
                            Button("Reintentar") {
                                viewModel.refresh()
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .success:
                        if viewModel.traffic.isEmpty {
                            Text("No hay registros de tráfico")
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            List(viewModel.traffic) { item in
                                TrafficCard(traffic: item)
                            }
                        }
                    case .idle:
                        EmptyView()
                    }
                }
            }
            .navigationTitle("Monitoreo de Tráfico")
            .onAppear {
                viewModel.loadTraffic()
                viewModel.loadStats()
            }
            .onChange(of: autoRefresh) { newValue in
                if newValue {
                    startAutoRefresh()
                }
            }
            .onChange(of: refreshInterval) { _ in
                if autoRefresh {
                    startAutoRefresh()
                }
            }
        }
    }
    
    private func startAutoRefresh() {
        Task {
            while autoRefresh {
                try? await Task.sleep(nanoseconds: UInt64(refreshInterval) * 1_000_000_000)
                if autoRefresh {
                    viewModel.refresh()
                }
            }
        }
    }
}

struct StatsView: View {
    let stats: TrafficStats
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                StatCard(title: "Total", value: "\(stats.total_clients)", color: .blue)
                StatCard(title: "Conectados", value: "\(stats.connected)", color: .green)
                StatCard(title: "Desconectados", value: "\(stats.disconnected)", color: .red)
                StatCard(title: "Problemas", value: "\(stats.problems)", color: .orange)
                if let avgDownload = stats.avg_download {
                    StatCard(title: "Desc. Prom.", value: formatSpeed(avgDownload), color: .blue)
                }
                if let avgUpload = stats.avg_upload {
                    StatCard(title: "Sub. Prom.", value: formatSpeed(avgUpload), color: .blue)
                }
                if let avgLatency = stats.avg_latency {
                    StatCard(title: "Latencia Prom.", value: formatLatency(avgLatency), color: .purple)
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(minWidth: 100)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct TrafficCard: View {
    let traffic: Traffic
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text(traffic.client_name ?? "Cliente no asignado")
                        .font(.headline)
                    if let clientNumber = traffic.client_number {
                        Text("#\(clientNumber)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
                StatusBadge(status: traffic.connection_status)
            }
            
            HStack {
                TrafficInfo(label: "Descarga", value: formatSpeed(traffic.download_speed))
                Spacer()
                TrafficInfo(label: "Subida", value: formatSpeed(traffic.upload_speed))
                Spacer()
                TrafficInfo(label: "Latencia", value: formatLatency(traffic.latency))
            }
            
            if let ipAddress = traffic.ip_address {
                Text("IP: \(ipAddress)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if let lastSeen = traffic.last_seen {
                Text("Última vez visto: \(formatDate(lastSeen))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}

struct StatusBadge: View {
    let status: String
    
    var body: some View {
        let color = statusColor(for: status)
        Text(status.uppercased())
            .font(.caption)
            .fontWeight(.bold)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .cornerRadius(8)
    }
    
    private func statusColor(for status: String) -> Color {
        switch status {
        case "conectado":
            return .green
        case "desconectado":
            return .red
        case "problema":
            return .orange
        default:
            return .gray
        }
    }
}

struct TrafficInfo: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }
}

func formatSpeed(_ speed: Double?) -> String {
    guard let speed = speed else { return "N/A" }
    if speed >= 1000 {
        return String(format: "%.2f Gbps", speed / 1000)
    }
    return String(format: "%.2f Mbps", speed)
}

func formatLatency(_ latency: Double?) -> String {
    guard let latency = latency else { return "N/A" }
    return String(format: "%.0f ms", latency)
}

func formatDate(_ dateString: String) -> String {
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: dateString) else {
        return dateString
    }
    
    let now = Date()
    let diff = now.timeIntervalSince(date)
    
    if diff < 60 {
        return "Hace \(Int(diff)) segundos"
    } else if diff < 3600 {
        return "Hace \(Int(diff / 60)) minutos"
    } else if diff < 86400 {
        return "Hace \(Int(diff / 3600)) horas"
    } else {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .short
        dateFormatter.timeStyle = .short
        return dateFormatter.string(from: date)
    }
}

#Preview {
    TrafficListView()
}










