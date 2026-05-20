package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ProviderPaymentService
import com.sistemawisp.technicianapp.data.model.ProviderPayment
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProviderPaymentRepository @Inject constructor(
    private val providerPaymentService: ProviderPaymentService
) {
    suspend fun getProviderPayments(token: String): Result<List<ProviderPayment>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = providerPaymentService.getProviderPayments(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar pagos a proveedores"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










