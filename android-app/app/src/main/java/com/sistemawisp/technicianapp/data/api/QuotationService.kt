package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Quotation
import retrofit2.Response
import retrofit2.http.*

interface QuotationService {
    @GET("/api/quotations")
    suspend fun getQuotations(
        @Header("Authorization") token: String
    ): Response<List<Quotation>>
}










