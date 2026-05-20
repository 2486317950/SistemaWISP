package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Receipt
import com.sistemawisp.technicianapp.data.repository.ReceiptRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReceiptViewModel @Inject constructor(
    private val receiptRepository: ReceiptRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ReceiptUiState>(ReceiptUiState.Idle)
    val uiState: StateFlow<ReceiptUiState> = _uiState.asStateFlow()
    
    private val _receipts = MutableStateFlow<List<Receipt>>(emptyList())
    val receipts: StateFlow<List<Receipt>> = _receipts.asStateFlow()
    
    fun loadReceipts() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = ReceiptUiState.Loading
            receiptRepository.getReceipts(token)
                .onSuccess { receiptsList ->
                    _receipts.value = receiptsList
                    _uiState.value = ReceiptUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = ReceiptUiState.Error(error.message ?: "Error al cargar recibos")
                }
        }
    }
}

sealed class ReceiptUiState {
    object Idle : ReceiptUiState()
    object Loading : ReceiptUiState()
    object Success : ReceiptUiState()
    data class Error(val message: String) : ReceiptUiState()
}










