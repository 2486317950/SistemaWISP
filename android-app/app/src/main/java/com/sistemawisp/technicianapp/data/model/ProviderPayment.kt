package com.sistemawisp.technicianapp.data.model

data class ProviderPayment(
    val id: Int?,
    val network_type: String?,
    val total_amount: Double,
    val paid_amount: Double,
    val remaining_amount: Double?,
    val payment_date: String?,
    val notes: String?,
    val created_at: String?
)










