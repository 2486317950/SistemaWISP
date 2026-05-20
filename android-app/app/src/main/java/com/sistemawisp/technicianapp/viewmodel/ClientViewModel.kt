package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Client
import com.sistemawisp.technicianapp.data.model.ClientDetail
import com.sistemawisp.technicianapp.data.repository.ClientRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ClientViewModel @Inject constructor(
    private val clientRepository: ClientRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ClientUiState>(ClientUiState.Idle)
    val uiState: StateFlow<ClientUiState> = _uiState.asStateFlow()
    
    private val _clients = MutableStateFlow<List<Client>>(emptyList())
    val clients: StateFlow<List<Client>> = _clients.asStateFlow()
    
    private val _clientDetail = MutableStateFlow<ClientDetail?>(null)
    val clientDetail: StateFlow<ClientDetail?> = _clientDetail.asStateFlow()
    
    private val _detailUiState = MutableStateFlow<ClientDetailUiState>(ClientDetailUiState.Idle)
    val detailUiState: StateFlow<ClientDetailUiState> = _detailUiState.asStateFlow()
    
    fun loadClients() {
        viewModelScope.launch {
            val token = tokenManager.getToken()
            if (token == null) {
                android.util.Log.e("ClientViewModel", "No hay token disponible")
                _uiState.value = ClientUiState.Error("No hay sesión activa")
                return@launch
            }
            _uiState.value = ClientUiState.Loading
            android.util.Log.d("ClientViewModel", "Cargando clientes...")
            clientRepository.getClients(token)
                .onSuccess { clientsList ->
                    android.util.Log.d("ClientViewModel", "Clientes cargados: ${clientsList.size} registros")
                    _clients.value = clientsList
                    _uiState.value = ClientUiState.Success
                }
                .onFailure { error ->
                    android.util.Log.e("ClientViewModel", "Error al cargar clientes", error)
                    _uiState.value = ClientUiState.Error(error.message ?: "Error al cargar clientes")
                }
        }
    }
    
    fun loadClientDetail(clientId: Int) {
        viewModelScope.launch {
            val token = tokenManager.getToken()
            if (token == null) {
                _detailUiState.value = ClientDetailUiState.Error("No hay sesión activa")
                return@launch
            }
            _detailUiState.value = ClientDetailUiState.Loading
            clientRepository.getClientById(token, clientId)
                .onSuccess { clientDetail ->
                    _clientDetail.value = clientDetail
                    _detailUiState.value = ClientDetailUiState.Success
                }
                .onFailure { error ->
                    _detailUiState.value = ClientDetailUiState.Error(error.message ?: "Error al cargar cliente")
                }
        }
    }
    
    fun refresh() {
        loadClients()
    }
}

sealed class ClientDetailUiState {
    object Idle : ClientDetailUiState()
    object Loading : ClientDetailUiState()
    object Success : ClientDetailUiState()
    data class Error(val message: String) : ClientDetailUiState()
}

sealed class ClientUiState {
    object Idle : ClientUiState()
    object Loading : ClientUiState()
    object Success : ClientUiState()
    data class Error(val message: String) : ClientUiState()
}

