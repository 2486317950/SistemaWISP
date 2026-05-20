package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.ProviderPayment
import retrofit2.Response
import retrofit2.http.*

interface ProviderPaymentService {
    @GET("/api/provider-payments")
    suspend fun getProviderPayments(
        @Header("Authorization") token: String
    ): Response<List<ProviderPayment>>
}










