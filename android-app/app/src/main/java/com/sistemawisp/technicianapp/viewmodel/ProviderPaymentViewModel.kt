package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.ProviderPayment
import com.sistemawisp.technicianapp.data.repository.ProviderPaymentRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProviderPaymentViewModel @Inject constructor(
    private val providerPaymentRepository: ProviderPaymentRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ProviderPaymentUiState>(ProviderPaymentUiState.Idle)
    val uiState: StateFlow<ProviderPaymentUiState> = _uiState.asStateFlow()
    
    private val _providerPayments = MutableStateFlow<List<ProviderPayment>>(emptyList())
    val providerPayments: StateFlow<List<ProviderPayment>> = _providerPayments.asStateFlow()
    
    fun loadProviderPayments() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = ProviderPaymentUiState.Loading
            providerPaymentRepository.getProviderPayments(token)
                .onSuccess { paymentsList ->
                    _providerPayments.value = paymentsList
                    _uiState.value = ProviderPaymentUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = ProviderPaymentUiState.Error(error.message ?: "Error al cargar pagos a proveedores")
                }
        }
    }
}

sealed class ProviderPaymentUiState {
    object Idle : ProviderPaymentUiState()
    object Loading : ProviderPaymentUiState()
    object Success : ProviderPaymentUiState()
    data class Error(val message: String) : ProviderPaymentUiState()
}










