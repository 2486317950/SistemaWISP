package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.SupplyInvoice
import retrofit2.Response
import retrofit2.http.*

interface SupplyInvoiceService {
    @GET("/api/supply-invoices")
    suspend fun getSupplyInvoices(
        @Header("Authorization") token: String
    ): Response<List<SupplyInvoice>>
}










