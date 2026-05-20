package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ExpenseService
import com.sistemawisp.technicianapp.data.model.Expense
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExpenseRepository @Inject constructor(
    private val expenseService: ExpenseService
) {
    suspend fun getExpenses(token: String): Result<List<Expense>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = expenseService.getExpenses(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar gastos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










