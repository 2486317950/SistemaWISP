package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Folio
import com.sistemawisp.technicianapp.data.model.FolioRequest
import retrofit2.Response
import retrofit2.http.*

interface FolioService {
    @GET("/api/folios")
    suspend fun getFolios(
        @Header("Authorization") token: String
    ): Response<List<Folio>>
    
    @POST("/api/folios")
    suspend fun createFolio(
        @Header("Authorization") token: String,
        @Body request: FolioRequest
    ): Response<Map<String, Any>>
}

