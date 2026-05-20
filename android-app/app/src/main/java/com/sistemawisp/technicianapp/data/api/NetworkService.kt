package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Network
import retrofit2.Response
import retrofit2.http.*

interface NetworkService {
    @GET("/api/networks")
    suspend fun getNetworks(
        @Header("Authorization") token: String,
        @Query("active_only") activeOnly: Boolean? = null
    ): Response<List<Network>>
}










