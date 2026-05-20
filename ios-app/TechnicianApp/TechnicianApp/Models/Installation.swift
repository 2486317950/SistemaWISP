//
//  Installation.swift
//  TechnicianApp
//
//  Created on iOS
//

import Foundation

struct Installation: Codable, Identifiable {
    let id: Int?
    let client_id: Int?
    let custom_name: String?
    let address: String?
    let installation_date: String
    let installation_type: String
    let status: String
    let notes: String?
    let installation_fee: Double?
    let is_paid: Bool
    let technician_name: String?
    let equipment_used: String?
    let completion_date: String?
    let installation_time: Int?
    let package_id: Int?
    let phone: String?
    let installation_folio: String?
    let completion_folio: String?
    
    // Campos adicionales de la respuesta del servidor
    let display_name: String?
    let display_address: String?
    let client_number: String?
    let package_name: String?
    let package_speed: String?
    let package_price: Double?
    
    enum CodingKeys: String, CodingKey {
        case id, client_id, custom_name, address, installation_date, installation_type
        case status, notes, installation_fee, is_paid, technician_name, equipment_used
        case completion_date, installation_time, package_id, phone
        case installation_folio, completion_folio, display_name, display_address
        case client_number, package_name, package_speed, package_price
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(Int.self, forKey: .id)
        client_id = try container.decodeIfPresent(Int.self, forKey: .client_id)
        custom_name = try container.decodeIfPresent(String.self, forKey: .custom_name)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        installation_date = try container.decode(String.self, forKey: .installation_date)
        installation_type = try container.decode(String.self, forKey: .installation_type)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pendiente"
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        installation_fee = try container.decodeIfPresent(Double.self, forKey: .installation_fee)
        
        // Manejar is_paid como número (0/1) o booleano
        if let paidInt = try? container.decode(Int.self, forKey: .is_paid) {
            is_paid = paidInt != 0
        } else {
            is_paid = try container.decodeIfPresent(Bool.self, forKey: .is_paid) ?? false
        }
        
        technician_name = try container.decodeIfPresent(String.self, forKey: .technician_name)
        equipment_used = try container.decodeIfPresent(String.self, forKey: .equipment_used)
        completion_date = try container.decodeIfPresent(String.self, forKey: .completion_date)
        installation_time = try container.decodeIfPresent(Int.self, forKey: .installation_time)
        package_id = try container.decodeIfPresent(Int.self, forKey: .package_id)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        installation_folio = try container.decodeIfPresent(String.self, forKey: .installation_folio)
        completion_folio = try container.decodeIfPresent(String.self, forKey: .completion_folio)
        display_name = try container.decodeIfPresent(String.self, forKey: .display_name)
        display_address = try container.decodeIfPresent(String.self, forKey: .display_address)
        client_number = try container.decodeIfPresent(String.self, forKey: .client_number)
        package_name = try container.decodeIfPresent(String.self, forKey: .package_name)
        package_speed = try container.decodeIfPresent(String.self, forKey: .package_speed)
        package_price = try container.decodeIfPresent(Double.self, forKey: .package_price)
    }
}

struct InstallationRequest: Codable {
    let client_id: Int?
    let custom_name: String?
    let address: String?
    let installation_date: String
    let installation_type: String
    let status: String
    let notes: String?
    let installation_fee: Double?
    let is_paid: Bool
    let technician_name: String?
    let equipment_used: String?
    let completion_date: String?
    let installation_time: Int?
    let package_id: Int?
    let phone: String?
}












