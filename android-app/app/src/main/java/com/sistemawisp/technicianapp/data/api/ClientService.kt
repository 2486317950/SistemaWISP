package com.sistemawisp.technicianapp.data.api

import com.sistemawisp.technicianapp.data.model.Client
import com.sistemawisp.technicianapp.data.model.ClientDetail
import retrofit2.Response
import retrofit2.http.*

interface ClientService {
    @GET("/api/clients")
    suspend fun getClients(
        @Header("Authorization") token: String
    ): Response<List<Client>>
    
    @GET("/api/clients/{id}")
    suspend fun getClientById(
        @Header("Authorization") token: String,
        @Path("id") id: Int
    ): Response<ClientDetail>
}

