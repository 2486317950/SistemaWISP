package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.NetworkService
import com.sistemawisp.technicianapp.data.model.Network
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NetworkRepository @Inject constructor(
    private val networkService: NetworkService
) {
    suspend fun getNetworks(token: String, activeOnly: Boolean? = null): Result<List<Network>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = networkService.getNetworks(authToken, activeOnly)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar redes"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










