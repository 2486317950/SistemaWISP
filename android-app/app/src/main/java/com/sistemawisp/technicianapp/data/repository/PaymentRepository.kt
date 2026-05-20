package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.PaymentService
import com.sistemawisp.technicianapp.data.model.Payment
import com.sistemawisp.technicianapp.data.model.PaymentRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PaymentRepository @Inject constructor(
    private val paymentService: PaymentService
) {
    suspend fun getPayments(token: String): Result<List<Payment>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = paymentService.getPayments(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar pagos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createPayment(token: String, request: PaymentRequest): Result<Map<String, Any>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = paymentService.createPayment(authToken, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val errorMessage = response.errorBody()?.string() ?: response.message() ?: "Error desconocido"
                Result.failure(Exception("Error ${response.code()}: $errorMessage"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

