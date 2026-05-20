package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Package
import retrofit2.Response
import retrofit2.http.*

interface PackageService {
    @GET("/api/packages")
    suspend fun getPackages(
        @Header("Authorization") token: String,
        @Query("active_only") activeOnly: Boolean? = null
    ): Response<List<Package>>
}










