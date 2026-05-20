package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Transfer
import retrofit2.Response
import retrofit2.http.*

interface TransferService {
    @GET("/api/transfers")
    suspend fun getTransfers(
        @Header("Authorization") token: String
    ): Response<List<Transfer>>
}










