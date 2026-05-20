package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.UserService
import com.sistemawisp.technicianapp.data.model.AppUser
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val userService: UserService
) {
    suspend fun getUsers(token: String): Result<List<AppUser>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = userService.getUsers(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar usuarios"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










