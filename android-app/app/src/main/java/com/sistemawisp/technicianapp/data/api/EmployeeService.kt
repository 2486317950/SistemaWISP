package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Employee
import retrofit2.Response
import retrofit2.http.*

interface EmployeeService {
    @GET("/api/employees")
    suspend fun getEmployees(
        @Header("Authorization") token: String
    ): Response<List<Employee>>
}










