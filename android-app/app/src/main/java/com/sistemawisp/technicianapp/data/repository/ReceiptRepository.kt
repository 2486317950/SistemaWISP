package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ReceiptService
import com.sistemawisp.technicianapp.data.model.Receipt
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReceiptRepository @Inject constructor(
    private val receiptService: ReceiptService
) {
    suspend fun getReceipts(token: String): Result<List<Receipt>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = receiptService.getReceipts(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar recibos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










