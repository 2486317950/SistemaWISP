package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Traffic
import com.sistemawisp.technicianapp.data.model.TrafficRequest
import com.sistemawisp.technicianapp.data.model.TrafficStats
import com.sistemawisp.technicianapp.data.repository.TrafficRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TrafficViewModel @Inject constructor(
    private val trafficRepository: TrafficRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<TrafficUiState>(TrafficUiState.Idle)
    val uiState: StateFlow<TrafficUiState> = _uiState.asStateFlow()
    
    private val _traffic = MutableStateFlow<List<Traffic>>(emptyList())
    val traffic: StateFlow<List<Traffic>> = _traffic.asStateFlow()
    
    private val _stats = MutableStateFlow<TrafficStats?>(null)
    val stats: StateFlow<TrafficStats?> = _stats.asStateFlow()
    
    fun loadTraffic(clientId: Int? = null, installationId: Int? = null, status: String? = null) {
        viewModelScope.launch {
            val token = tokenManager.getToken()
            if (token == null) {
                android.util.Log.e("TrafficViewModel", "No hay token disponible")
                _uiState.value = TrafficUiState.Error("No hay sesión activa")
                return@launch
            }
            _uiState.value = TrafficUiState.Loading
            android.util.Log.d("TrafficViewModel", "Cargando tráfico...")
            trafficRepository.getTraffic(token, clientId, installationId, status)
                .onSuccess { trafficList ->
                    android.util.Log.d("TrafficViewModel", "Tráfico cargado: ${trafficList.size} registros")
                    _traffic.value = trafficList
                    _uiState.value = TrafficUiState.Success
                }
                .onFailure { error ->
                    android.util.Log.e("TrafficViewModel", "Error al cargar tráfico", error)
                    _uiState.value = TrafficUiState.Error(error.message ?: "Error al cargar tráfico")
                }
        }
    }
    
    fun loadStats() {
        viewModelScope.launch {
            val token = tokenManager.getToken()
            if (token == null) {
                android.util.Log.e("TrafficViewModel", "No hay token disponible para estadísticas")
                return@launch
            }
            android.util.Log.d("TrafficViewModel", "Cargando estadísticas...")
            trafficRepository.getTrafficStats(token)
                .onSuccess { statsData ->
                    android.util.Log.d("TrafficViewModel", "Estadísticas cargadas: ${statsData.total_clients} clientes")
                    _stats.value = statsData
                }
                .onFailure { error ->
                    android.util.Log.e("TrafficViewModel", "Error al cargar estadísticas", error)
                }
        }
    }
    
    fun refresh() {
        loadTraffic()
        loadStats()
    }
}

sealed class TrafficUiState {
    object Idle : TrafficUiState()
    object Loading : TrafficUiState()
    object Success : TrafficUiState()
    data class Error(val message: String) : TrafficUiState()
}

