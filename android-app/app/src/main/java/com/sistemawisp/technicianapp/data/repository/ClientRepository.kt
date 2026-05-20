package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ClientService
import com.sistemawisp.technicianapp.data.model.Client
import com.sistemawisp.technicianapp.data.model.ClientDetail
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ClientRepository @Inject constructor(
    private val clientService: ClientService
) {
    suspend fun getClients(token: String): Result<List<Client>> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = clientService.getClients(authToken)
            if (response.isSuccessful && response.body() != null) {
                android.util.Log.d("ClientRepository", "Clientes cargados exitosamente: ${response.body()!!.size} registros")
                Result.success(response.body()!!)
            } else {
                val errorMessage = try {
                    response.errorBody()?.string() ?: response.message() ?: "Error desconocido"
                } catch (e: Exception) {
                    response.message() ?: "Error al cargar clientes"
                }
                android.util.Log.e("ClientRepository", "Error al cargar clientes: ${response.code()} - $errorMessage")
                Result.failure(Exception("Error ${response.code()}: $errorMessage"))
            }
        } catch (e: Exception) {
            android.util.Log.e("ClientRepository", "Excepción al cargar clientes", e)
            Result.failure(e)
        }
    }
    
    suspend fun getClientById(token: String, id: Int): Result<ClientDetail> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val response = clientService.getClientById(authToken, id)
            if (response.isSuccessful && response.body() != null) {
                android.util.Log.d("ClientRepository", "Cliente cargado exitosamente: ${response.body()!!.name}")
                Result.success(response.body()!!)
            } else {
                val errorMessage = response.errorBody()?.string() ?: response.message() ?: "Error desconocido"
                android.util.Log.e("ClientRepository", "Error al cargar cliente: ${response.code()} - $errorMessage")
                Result.failure(Exception("Error ${response.code()}: $errorMessage"))
            }
        } catch (e: Exception) {
            android.util.Log.e("ClientRepository", "Excepción al cargar cliente", e)
            Result.failure(e)
        }
    }
}

