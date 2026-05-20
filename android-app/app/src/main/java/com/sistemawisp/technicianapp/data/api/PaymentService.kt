package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Payment
import com.sistemawisp.technicianapp.data.model.PaymentRequest
import retrofit2.Response
import retrofit2.http.*

interface PaymentService {
    @GET("/api/payments")
    suspend fun getPayments(
        @Header("Authorization") token: String
    ): Response<List<Payment>>
    
    @POST("/api/payments")
    suspend fun createPayment(
        @Header("Authorization") token: String,
        @Body request: PaymentRequest
    ): Response<Map<String, Any>>
}

