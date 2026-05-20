package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.InstallationService
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.data.model.InstallationRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InstallationRepository @Inject constructor(
    private val installationService: InstallationService
) {
    suspend fun getInstallations(token: String): Result<List<Installation>> {
        return try {
            val response = installationService.getInstallations("Bearer $token")
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar instalaciones"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createInstallation(token: String, request: InstallationRequest): Result<Installation> {
        return try {
            val response = installationService.createInstallation("Bearer $token", request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al crear instalación"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateInstallation(
        token: String,
        id: Int,
        request: InstallationRequest
    ): Result<Unit> {
        return try {
            val response = installationService.updateInstallation("Bearer $token", id, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.message() ?: "Error al actualizar instalación"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}













