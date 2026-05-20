package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Expense
import retrofit2.Response
import retrofit2.http.*

interface ExpenseService {
    @GET("/api/expenses")
    suspend fun getExpenses(
        @Header("Authorization") token: String
    ): Response<List<Expense>>
}










