package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.LoginRequest
import com.sistemawisp.technicianapp.data.model.LoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthService {
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
}













