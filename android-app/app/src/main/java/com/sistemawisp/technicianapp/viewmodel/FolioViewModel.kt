package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Folio
import com.sistemawisp.technicianapp.data.model.FolioRequest
import com.sistemawisp.technicianapp.data.repository.FolioRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FolioViewModel @Inject constructor(
    private val folioRepository: FolioRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<FolioUiState>(FolioUiState.Idle)
    val uiState: StateFlow<FolioUiState> = _uiState.asStateFlow()
    
    private val _folios = MutableStateFlow<List<Folio>>(emptyList())
    val folios: StateFlow<List<Folio>> = _folios.asStateFlow()
    
    fun loadFolios() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = FolioUiState.Loading
            folioRepository.getFolios(token)
                .onSuccess { foliosList ->
                    _folios.value = foliosList
                    _uiState.value = FolioUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = FolioUiState.Error(error.message ?: "Error al cargar folios")
                }
        }
    }
    
    fun createFolio(request: FolioRequest) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = FolioUiState.Loading
            folioRepository.createFolio(token, request)
                .onSuccess {
                    _uiState.value = FolioUiState.Success
                    loadFolios() // Recargar lista
                }
                .onFailure { error ->
                    _uiState.value = FolioUiState.Error(error.message ?: "Error al crear folio")
                }
        }
    }
}

sealed class FolioUiState {
    object Idle : FolioUiState()
    object Loading : FolioUiState()
    object Success : FolioUiState()
    data class Error(val message: String) : FolioUiState()
}

