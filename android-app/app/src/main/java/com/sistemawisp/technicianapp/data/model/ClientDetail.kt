package com.sistemawisp.technicianapp.data.model

data class ClientDetail(
    val id: Int?,
    val client_number: String?,
    val name: String,
    val address: String,
    val phone: String?,
    val email: String?,
    val network_type: String?,
    val package_id: Int?,
    val package_name: String?,
    val package_speed: String?,
    val package_price: Double?,
    val package_description: String?,
    val notes: String?,
    val ip_address: String?,
    val created_at: String?,
    val payments: List<Payment>? = null,
    val installations: List<Installation>? = null,
    val folios: List<Folio>? = null
)










