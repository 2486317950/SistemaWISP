package com.sistemawisp.technicianapp.data.model

data class Traffic(
    val id: Int? = null,
    val client_id: Int? = null,
    val installation_id: Int? = null,
    val connection_status: String = "desconectado",
    val download_speed: Double? = null,
    val upload_speed: Double? = null,
    val latency: Double? = null,
    val packet_loss: Double? = null,
    val bandwidth_usage: Double? = null,
    val last_seen: String? = null,
    val ip_address: String? = null,
    val mac_address: String? = null,
    val device_type: String? = null,
    val signal_strength: Int? = null,
    val notes: String? = null,
    // Campos adicionales de la respuesta del servidor
    val client_name: String? = null,
    val client_number: String? = null,
    val client_address: String? = null,
    val installation_folio: String? = null,
    val installation_status: String? = null,
    val package_name: String? = null,
    val package_speed: String? = null
)

data class TrafficRequest(
    val client_id: Int? = null,
    val installation_id: Int? = null,
    val connection_status: String = "desconectado",
    val download_speed: Double? = null,
    val upload_speed: Double? = null,
    val latency: Double? = null,
    val packet_loss: Double? = null,
    val bandwidth_usage: Double? = null,
    val ip_address: String? = null,
    val mac_address: String? = null,
    val device_type: String? = null,
    val signal_strength: Int? = null,
    val notes: String? = null
)

data class TrafficStats(
    val total_clients: Int = 0,
    val connected: Int = 0,
    val disconnected: Int = 0,
    val problems: Int = 0,
    val avg_download: Double? = null,
    val avg_upload: Double? = null,
    val avg_latency: Double? = null
)










