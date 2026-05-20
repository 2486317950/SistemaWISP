//
//  Traffic.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

struct Traffic: Codable, Identifiable {
    let id: Int?
    let client_id: Int?
    let installation_id: Int?
    let connection_status: String
    let download_speed: Double?
    let upload_speed: Double?
    let latency: Double?
    let packet_loss: Double?
    let bandwidth_usage: Double?
    let last_seen: String?
    let ip_address: String?
    let mac_address: String?
    let device_type: String?
    let signal_strength: Int?
    let notes: String?
    
    // Campos adicionales de la respuesta del servidor
    let client_name: String?
    let client_number: String?
    let client_address: String?
    let installation_folio: String?
    let installation_status: String?
    let package_name: String?
    let package_speed: String?
    
    enum CodingKeys: String, CodingKey {
        case id, client_id, installation_id, connection_status
        case download_speed, upload_speed, latency, packet_loss, bandwidth_usage
        case last_seen, ip_address, mac_address, device_type, signal_strength, notes
        case client_name, client_number, client_address, installation_folio
        case installation_status, package_name, package_speed
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(Int.self, forKey: .id)
        client_id = try container.decodeIfPresent(Int.self, forKey: .client_id)
        installation_id = try container.decodeIfPresent(Int.self, forKey: .installation_id)
        connection_status = try container.decodeIfPresent(String.self, forKey: .connection_status) ?? "desconectado"
        download_speed = try container.decodeIfPresent(Double.self, forKey: .download_speed)
        upload_speed = try container.decodeIfPresent(Double.self, forKey: .upload_speed)
        latency = try container.decodeIfPresent(Double.self, forKey: .latency)
        packet_loss = try container.decodeIfPresent(Double.self, forKey: .packet_loss)
        bandwidth_usage = try container.decodeIfPresent(Double.self, forKey: .bandwidth_usage)
        last_seen = try container.decodeIfPresent(String.self, forKey: .last_seen)
        ip_address = try container.decodeIfPresent(String.self, forKey: .ip_address)
        mac_address = try container.decodeIfPresent(String.self, forKey: .mac_address)
        device_type = try container.decodeIfPresent(String.self, forKey: .device_type)
        signal_strength = try container.decodeIfPresent(Int.self, forKey: .signal_strength)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        client_name = try container.decodeIfPresent(String.self, forKey: .client_name)
        client_number = try container.decodeIfPresent(String.self, forKey: .client_number)
        client_address = try container.decodeIfPresent(String.self, forKey: .client_address)
        installation_folio = try container.decodeIfPresent(String.self, forKey: .installation_folio)
        installation_status = try container.decodeIfPresent(String.self, forKey: .installation_status)
        package_name = try container.decodeIfPresent(String.self, forKey: .package_name)
        package_speed = try container.decodeIfPresent(String.self, forKey: .package_speed)
    }
}

struct TrafficRequest: Codable {
    let client_id: Int?
    let installation_id: Int?
    let connection_status: String
    let download_speed: Double?
    let upload_speed: Double?
    let latency: Double?
    let packet_loss: Double?
    let bandwidth_usage: Double?
    let ip_address: String?
    let mac_address: String?
    let device_type: String?
    let signal_strength: Int?
    let notes: String?
}

struct TrafficStats: Codable {
    let total_clients: Int
    let connected: Int
    let disconnected: Int
    let problems: Int
    let avg_download: Double?
    let avg_upload: Double?
    let avg_latency: Double?
    
    enum CodingKeys: String, CodingKey {
        case total_clients, connected, disconnected, problems
        case avg_download, avg_upload, avg_latency
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        total_clients = try container.decodeIfPresent(Int.self, forKey: .total_clients) ?? 0
        connected = try container.decodeIfPresent(Int.self, forKey: .connected) ?? 0
        disconnected = try container.decodeIfPresent(Int.self, forKey: .disconnected) ?? 0
        problems = try container.decodeIfPresent(Int.self, forKey: .problems) ?? 0
        avg_download = try container.decodeIfPresent(Double.self, forKey: .avg_download)
        avg_upload = try container.decodeIfPresent(Double.self, forKey: .avg_upload)
        avg_latency = try container.decodeIfPresent(Double.self, forKey: .avg_latency)
    }
}










