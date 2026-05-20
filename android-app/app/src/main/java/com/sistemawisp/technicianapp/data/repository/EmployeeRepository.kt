package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.EmployeeService
import com.sistemawisp.technicianapp.data.model.Employee
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EmployeeRepository @Inject constructor(
    private val employeeService: EmployeeService
) {
    suspend fun getEmployees(token: String): Result<List<Employee>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = employeeService.getEmployees(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar empleados"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










