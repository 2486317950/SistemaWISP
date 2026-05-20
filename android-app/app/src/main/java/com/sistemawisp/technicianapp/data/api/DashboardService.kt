package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.DashboardStats
import retrofit2.Response
import retrofit2.http.*

interface DashboardService {
    @GET("/api/traffic/stats/summary")
    suspend fun getTrafficStats(
        @Header("Authorization") token: String
    ): Response<Map<String, Any>>
}










