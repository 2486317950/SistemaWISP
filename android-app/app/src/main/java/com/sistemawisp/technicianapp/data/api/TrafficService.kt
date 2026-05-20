package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Traffic
import com.sistemawisp.technicianapp.data.model.TrafficRequest
import com.sistemawisp.technicianapp.data.model.TrafficStats
import retrofit2.Response
import retrofit2.http.*

interface TrafficService {
    @GET("/api/traffic")
    suspend fun getTraffic(
        @Header("Authorization") token: String,
        @Query("client_id") clientId: Int? = null,
        @Query("installation_id") installationId: Int? = null,
        @Query("status") status: String? = null
    ): Response<List<Traffic>>

    @GET("/api/traffic/client/{clientId}")
    suspend fun getTrafficByClient(
        @Header("Authorization") token: String,
        @Path("clientId") clientId: Int
    ): Response<List<Traffic>>

    @GET("/api/traffic/{id}")
    suspend fun getTrafficById(
        @Header("Authorization") token: String,
        @Path("id") id: Int
    ): Response<Traffic>

    @POST("/api/traffic")
    suspend fun createOrUpdateTraffic(
        @Header("Authorization") token: String,
        @Body request: TrafficRequest
    ): Response<Map<String, Any>>

    @GET("/api/traffic/stats/summary")
    suspend fun getTrafficStats(
        @Header("Authorization") token: String
    ): Response<TrafficStats>
}

