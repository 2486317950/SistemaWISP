package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.AppUser
import retrofit2.Response
import retrofit2.http.*

interface UserService {
    @GET("/api/users")
    suspend fun getUsers(
        @Header("Authorization") token: String
    ): Response<List<AppUser>>
}










