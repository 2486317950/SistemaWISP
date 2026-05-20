package com.sistemawisp.technicianapp.data.model

data class Contract(
    val id: Int?,
    val contract_number: String?,
    val client_id: Int?,
    val client_name: String?,
    val client_number: String?,
    val client_address: String?,
    val client_phone: String?,
    val client_email: String?,
    val package_name: String?,
    val package_speed: String?,
    val package_price: Double?,
    val contract_date: String?,
    val start_date: String?,
    val end_date: String?,
    val payment_methods: List<String>?,
    val notes: String?,
    val created_at: String?
)










