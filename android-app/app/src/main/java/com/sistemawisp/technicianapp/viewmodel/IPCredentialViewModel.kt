package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.IPCredential
import com.sistemawisp.technicianapp.data.repository.IPCredentialRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class IPCredentialViewModel @Inject constructor(
    private val ipCredentialRepository: IPCredentialRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<IPCredentialUiState>(IPCredentialUiState.Idle)
    val uiState: StateFlow<IPCredentialUiState> = _uiState.asStateFlow()
    
    private val _ipCredentials = MutableStateFlow<List<IPCredential>>(emptyList())
    val ipCredentials: StateFlow<List<IPCredential>> = _ipCredentials.asStateFlow()
    
    fun loadIPCredentials() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = IPCredentialUiState.Loading
            ipCredentialRepository.getIPCredentials(token)
                .onSuccess { credentialsList ->
                    _ipCredentials.value = credentialsList
                    _uiState.value = IPCredentialUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = IPCredentialUiState.Error(error.message ?: "Error al cargar IPs y contraseñas")
                }
        }
    }
}

sealed class IPCredentialUiState {
    object Idle : IPCredentialUiState()
    object Loading : IPCredentialUiState()
    object Success : IPCredentialUiState()
    data class Error(val message: String) : IPCredentialUiState()
}










