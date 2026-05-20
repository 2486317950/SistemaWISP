package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.IPCredentialService
import com.sistemawisp.technicianapp.data.model.IPCredential
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IPCredentialRepository @Inject constructor(
    private val ipCredentialService: IPCredentialService
) {
    suspend fun getIPCredentials(token: String): Result<List<IPCredential>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = ipCredentialService.getIPCredentials(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar IPs y contraseñas"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










