package com.sistemawisp.technicianapp.data.model

data class Payment(
    val id: Int?,
    val client_id: Int?,
    val client_name: String?,
    val client_number: String?,
    val client_address: String?,
    val display_name: String?,
    val display_address: String?,
    val amount: Double,
    val payment_date: String,
    val payment_method: String?,
    val payment_type: String?,
    val receipt_number: String?,
    val is_free_month: Boolean?,
    val notes: String?,
    val created_at: String?
)










