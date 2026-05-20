package com.sistemawisp.technicianapp.data.model

data class PaymentRequest(
    val client_id: Int?,
    val payment_type: String?,
    val network_type: String?,
    val payment_method: String?,
    val custom_name: String?,
    val custom_address: String?,
    val amount: Double,
    val payment_date: String,
    val receipt_number: String?,
    val is_free_month: Boolean?,
    val notes: String?
)










