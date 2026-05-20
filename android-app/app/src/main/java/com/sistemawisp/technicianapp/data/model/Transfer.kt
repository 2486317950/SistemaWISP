package com.sistemawisp.technicianapp.data.model

data class Transfer(
    val id: Int?,
    val transfer_number: String?,
    val transfer_date: String,
    val amount: Double,
    val account_id: Int?,
    val account_name: String?,
    val account_number: String?,
    val bank_name: String?,
    val employee_id: Int?,
    val employee_name_from_table: String?,
    val employee_payroll_account: String?,
    val description: String?,
    val notes: String?,
    val created_at: String?
)










