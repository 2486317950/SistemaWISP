package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.TrafficService
import com.sistemawisp.technicianapp.data.model.Traffic
import com.sistemawisp.technicianapp.data.model.TrafficRequest
import com.sistemawisp.technicianapp.data.model.TrafficStats
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrafficRepository @Inject constructor(
    private val trafficService: TrafficService
) {
    suspend fun getTraffic(
        token: String,
        clientId: Int? = null,
        installationId: Int? = null,
        status: String? = null
    ): Result<List<Traffic>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = trafficService.getTraffic(authToken, clientId, installationId, status)
            if (response.isSuccessful && response.body() != null) {
                android.util.Log.d("TrafficRepository", "Tráfico cargado exitosamente: ${response.body()!!.size} registros")
                Result.success(response.body()!!)
            } else {
                val errorMessage = try {
                    response.errorBody()?.string() ?: response.message() ?: "Error desconocido"
                } catch (e: Exception) {
                    response.message() ?: "Error al cargar tráfico"
                }
                android.util.Log.e("TrafficRepository", "Error al cargar tráfico: ${response.code()} - $errorMessage")
                Result.failure(Exception("Error ${response.code()}: $errorMessage"))
            }
        } catch (e: Exception) {
            android.util.Log.e("TrafficRepository", "Excepción al cargar tráfico", e)
            Result.failure(e)
        }
    }
    
    suspend fun getTrafficByClient(token: String, clientId: Int): Result<List<Traffic>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = trafficService.getTrafficByClient(authToken, clientId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar tráfico del cliente"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getTrafficStats(token: String): Result<TrafficStats> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = trafficService.getTrafficStats(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar estadísticas"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createOrUpdateTraffic(token: String, request: TrafficRequest): Result<Map<String, Any>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = trafficService.createOrUpdateTraffic(authToken, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al guardar tráfico"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

