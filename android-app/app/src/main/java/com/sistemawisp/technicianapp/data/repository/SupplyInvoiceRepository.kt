package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.SupplyInvoiceService
import com.sistemawisp.technicianapp.data.model.SupplyInvoice
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SupplyInvoiceRepository @Inject constructor(
    private val supplyInvoiceService: SupplyInvoiceService
) {
    suspend fun getSupplyInvoices(token: String): Result<List<SupplyInvoice>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = supplyInvoiceService.getSupplyInvoices(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar facturas de insumos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










