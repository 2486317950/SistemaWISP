package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Transfer
import com.sistemawisp.technicianapp.data.repository.TransferRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TransferViewModel @Inject constructor(
    private val transferRepository: TransferRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<TransferUiState>(TransferUiState.Idle)
    val uiState: StateFlow<TransferUiState> = _uiState.asStateFlow()
    
    private val _transfers = MutableStateFlow<List<Transfer>>(emptyList())
    val transfers: StateFlow<List<Transfer>> = _transfers.asStateFlow()
    
    fun loadTransfers() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = TransferUiState.Loading
            transferRepository.getTransfers(token)
                .onSuccess { transfersList ->
                    _transfers.value = transfersList
                    _uiState.value = TransferUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = TransferUiState.Error(error.message ?: "Error al cargar transferencias")
                }
        }
    }
}

sealed class TransferUiState {
    object Idle : TransferUiState()
    object Loading : TransferUiState()
    object Success : TransferUiState()
    data class Error(val message: String) : TransferUiState()
}










