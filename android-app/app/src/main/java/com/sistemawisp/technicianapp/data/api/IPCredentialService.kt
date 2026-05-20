package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.IPCredential
import retrofit2.Response
import retrofit2.http.*

interface IPCredentialService {
    @GET("/api/ip-credentials")
    suspend fun getIPCredentials(
        @Header("Authorization") token: String
    ): Response<List<IPCredential>>
}










