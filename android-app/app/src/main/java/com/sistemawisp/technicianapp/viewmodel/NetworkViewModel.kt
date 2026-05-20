package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Network
import com.sistemawisp.technicianapp.data.repository.NetworkRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NetworkViewModel @Inject constructor(
    private val networkRepository: NetworkRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<NetworkUiState>(NetworkUiState.Idle)
    val uiState: StateFlow<NetworkUiState> = _uiState.asStateFlow()
    
    private val _networks = MutableStateFlow<List<Network>>(emptyList())
    val networks: StateFlow<List<Network>> = _networks.asStateFlow()
    
    fun loadNetworks(activeOnly: Boolean? = null) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = NetworkUiState.Loading
            networkRepository.getNetworks(token, activeOnly)
                .onSuccess { networksList ->
                    _networks.value = networksList
                    _uiState.value = NetworkUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = NetworkUiState.Error(error.message ?: "Error al cargar redes")
                }
        }
    }
}

sealed class NetworkUiState {
    object Idle : NetworkUiState()
    object Loading : NetworkUiState()
    object Success : NetworkUiState()
    data class Error(val message: String) : NetworkUiState()
}










