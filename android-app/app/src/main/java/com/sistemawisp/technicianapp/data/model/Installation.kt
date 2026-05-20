package com.sistemawisp.technicianapp.data.model

data class Installation(
    val id: Int? = null,
    val client_id: Int? = null,
    val custom_name: String? = null,
    val address: String? = null,
    val installation_date: String,
    val installation_type: String,
    val status: String = "pendiente",
    val notes: String? = null,
    val installation_fee: Double? = null,
    val is_paid: Boolean = false,
    val technician_name: String? = null,
    val equipment_used: String? = null,
    val completion_date: String? = null,
    val installation_time: Int? = null,
    val package_id: Int? = null,
    val phone: String? = null,
    val installation_folio: String? = null,
    val completion_folio: String? = null,
    // Campos adicionales de la respuesta del servidor
    val display_name: String? = null,
    val display_address: String? = null,
    val client_number: String? = null,
    val package_name: String? = null,
    val package_speed: String? = null,
    val package_price: Double? = null
)

data class InstallationRequest(
    val client_id: Int? = null,
    val custom_name: String? = null,
    val address: String? = null,
    val installation_date: String,
    val installation_type: String,
    val status: String = "pendiente",
    val notes: String? = null,
    val installation_fee: Double? = null,
    val is_paid: Boolean = false,
    val technician_name: String? = null,
    val equipment_used: String? = null,
    val completion_date: String? = null,
    val installation_time: Int? = null,
    val package_id: Int? = null,
    val phone: String? = null
)













