package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.ClientService
import com.sistemawisp.technicianapp.data.api.DashboardService
import com.sistemawisp.technicianapp.data.api.InstallationService
import com.sistemawisp.technicianapp.data.api.PaymentService
import com.sistemawisp.technicianapp.data.model.DashboardStats
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DashboardRepository @Inject constructor(
    private val dashboardService: DashboardService,
    private val clientService: ClientService,
    private val installationService: InstallationService,
    private val paymentService: PaymentService
) {
    suspend fun getDashboardStats(token: String): Result<DashboardStats> {
        return try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            
            // Obtener estadísticas de múltiples fuentes
            val clientsResponse = clientService.getClients(authToken)
            val installationsResponse = installationService.getInstallations(authToken)
            val paymentsResponse = paymentService.getPayments(authToken)
            val trafficResponse = dashboardService.getTrafficStats(authToken)
            
            if (clientsResponse.isSuccessful && installationsResponse.isSuccessful && paymentsResponse.isSuccessful) {
                val clients = clientsResponse.body() ?: emptyList()
                val installations = installationsResponse.body() ?: emptyList()
                val payments = paymentsResponse.body() ?: emptyList()
                
                // Calcular estadísticas
                val totalClients = clients.size
                val totalInstallations = installations.size
                val totalPayments = payments.sumOf { it.amount }
                
                // Estadísticas de tráfico
                var connectedClients = 0
                var disconnectedClients = 0
                if (trafficResponse.isSuccessful && trafficResponse.body() != null) {
                    val trafficStats = trafficResponse.body()!!
                    android.util.Log.d("DashboardRepository", "Traffic stats: $trafficStats")
                    // El servidor devuelve "connected" y "disconnected", no "connected_clients"
                    connectedClients = when (val connected = trafficStats["connected"]) {
                        is Number -> connected.toInt()
                        is String -> connected.toIntOrNull() ?: 0
                        else -> 0
                    }
                    disconnectedClients = when (val disconnected = trafficStats["disconnected"]) {
                        is Number -> disconnected.toInt()
                        is String -> disconnected.toIntOrNull() ?: 0
                        else -> 0
                    }
                    android.util.Log.d("DashboardRepository", "Connected: $connectedClients, Disconnected: $disconnectedClients")
                } else {
                    android.util.Log.e("DashboardRepository", "Error al obtener estadísticas de tráfico: ${trafficResponse.code()}")
                }
                
                val stats = DashboardStats(
                    total_clients = totalClients,
                    total_installations = totalInstallations,
                    total_payments = totalPayments,
                    total_revenue = totalPayments, // Por ahora igual a pagos
                    total_expenses = null,
                    connected_clients = connectedClients,
                    disconnected_clients = disconnectedClients,
                    total_packages = null,
                    total_employees = null
                )
                
                Result.success(stats)
            } else {
                Result.failure(Exception("Error al cargar estadísticas"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

