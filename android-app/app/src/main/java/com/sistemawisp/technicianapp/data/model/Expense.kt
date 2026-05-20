package com.sistemawisp.technicianapp.data.model

data class Expense(
    val id: Int?,
    val expense_date: String,
    val amount: Double,
    val category: String?,
    val description: String?,
    val supply_invoice_id: Int?,
    val supply_invoice_number: String?,
    val supply_invoice_company: String?,
    val supply_invoice_amount: Double?,
    val supply_invoice_date: String?,
    val provider_payment_id: Int?,
    val provider_payment_network_type: String?,
    val provider_payment_total_amount: Double?,
    val provider_payment_paid_amount: Double?,
    val provider_payment_date: String?,
    val notes: String?,
    val created_at: String?
)










