package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ContractService
import com.sistemawisp.technicianapp.data.model.Contract
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ContractRepository @Inject constructor(
    private val contractService: ContractService
) {
    suspend fun getContracts(token: String): Result<List<Contract>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = contractService.getContracts(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar contratos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










