package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.TransferService
import com.sistemawisp.technicianapp.data.model.Transfer
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TransferRepository @Inject constructor(
    private val transferService: TransferService
) {
    suspend fun getTransfers(token: String): Result<List<Transfer>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = transferService.getTransfers(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar transferencias"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










