package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.QuotationService
import com.sistemawisp.technicianapp.data.model.Quotation
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QuotationRepository @Inject constructor(
    private val quotationService: QuotationService
) {
    suspend fun getQuotations(token: String): Result<List<Quotation>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = quotationService.getQuotations(authToken)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Error al cargar cotizaciones"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}










