package com.sistemawisp.technicianapp.data.model

data class Quotation(
    val id: Int?,
    val quotation_number: String?,
    val quotation_date: String,
    val client_name: String?,
    val client_address: String?,
    val client_phone: String?,
    val client_email: String?,
    val total_amount: Double?,
    val items_count: Int?,
    val notes: String?,
    val created_at: String?
)










