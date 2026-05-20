package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Contract
import retrofit2.Response
import retrofit2.http.*

interface ContractService {
    @GET("/api/contracts")
    suspend fun getContracts(
        @Header("Authorization") token: String
    ): Response<List<Contract>>
}










