package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.PackageService
import com.sistemawisp.technicianapp.data.model.Package
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PackageRepository @Inject constructor(
    private val packageService: PackageService
) {
    suspend fun getPackages(token: String, activeOnly: Boolean? = null): Result<List<Package>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = packageService.getPackages(authToken, activeOnly)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar paquetes"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










