package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Receipt
import retrofit2.Response
import retrofit2.http.*

interface ReceiptService {
    @GET("/api/receipts")
    suspend fun getReceipts(
        @Header("Authorization") token: String
    ): Response<List<Receipt>>
}










