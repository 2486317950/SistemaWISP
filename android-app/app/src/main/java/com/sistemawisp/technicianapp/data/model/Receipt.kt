package com.sistemawisp.technicianapp.data.model

data class Receipt(
    val id: Int?,
    val receipt_number: String?,
    val client_id: Int?,
    val client_name: String?,
    val client_number: String?,
    val client_address: String?,
    val client_phone: String?,
    val client_email: String?,
    val receipt_date: String,
    val amount: Double,
    val payment_method: String?,
    val notes: String?,
    val created_at: String?
)










