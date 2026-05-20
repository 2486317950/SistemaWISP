package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.data.model.InstallationRequest
import retrofit2.Response
import retrofit2.http.*

interface InstallationService {
    @GET("/api/installations")
    suspend fun getInstallations(
        @Header("Authorization") token: String
    ): Response<List<Installation>>
    
    @POST("/api/installations")
    suspend fun createInstallation(
        @Header("Authorization") token: String,
        @Body request: InstallationRequest
    ): Response<Installation>
    
    @PUT("/api/installations/{id}")
    suspend fun updateInstallation(
        @Header("Authorization") token: String,
        @Path("id") id: Int,
        @Body request: InstallationRequest
    ): Response<Map<String, Any>>
    
    @DELETE("/api/installations/{id}")
    suspend fun deleteInstallation(
        @Header("Authorization") token: String,
        @Path("id") id: Int
    ): Response<Map<String, String>>
}













