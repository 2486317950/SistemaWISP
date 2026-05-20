package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.SupplyInvoice
import com.sistemawisp.technicianapp.data.repository.SupplyInvoiceRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SupplyInvoiceViewModel @Inject constructor(
    private val supplyInvoiceRepository: SupplyInvoiceRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<SupplyInvoiceUiState>(SupplyInvoiceUiState.Idle)
    val uiState: StateFlow<SupplyInvoiceUiState> = _uiState.asStateFlow()
    
    private val _supplyInvoices = MutableStateFlow<List<SupplyInvoice>>(emptyList())
    val supplyInvoices: StateFlow<List<SupplyInvoice>> = _supplyInvoices.asStateFlow()
    
    fun loadSupplyInvoices() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = SupplyInvoiceUiState.Loading
            supplyInvoiceRepository.getSupplyInvoices(token)
                .onSuccess { invoicesList ->
                    _supplyInvoices.value = invoicesList
                    _uiState.value = SupplyInvoiceUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = SupplyInvoiceUiState.Error(error.message ?: "Error al cargar facturas de insumos")
                }
        }
    }
}

sealed class SupplyInvoiceUiState {
    object Idle : SupplyInvoiceUiState()
    object Loading : SupplyInvoiceUiState()
    object Success : SupplyInvoiceUiState()
    data class Error(val message: String) : SupplyInvoiceUiState()
}










