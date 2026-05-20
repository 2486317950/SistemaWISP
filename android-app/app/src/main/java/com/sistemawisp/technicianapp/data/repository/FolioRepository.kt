package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.FolioService
import com.sistemawisp.technicianapp.data.model.Folio
import com.sistemawisp.technicianapp.data.model.FolioRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FolioRepository @Inject constructor(
    private val folioService: FolioService
) {
    suspend fun getFolios(token: String): Result<List<Folio>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = folioService.getFolios(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar folios"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createFolio(token: String, request: FolioRequest): Result<Map<String, Any>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = folioService.createFolio(authToken, request)
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

