package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Payment
import com.sistemawisp.technicianapp.data.model.PaymentRequest
import com.sistemawisp.technicianapp.data.repository.PaymentRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val paymentRepository: PaymentRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<PaymentUiState>(PaymentUiState.Idle)
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()
    
    private val _payments = MutableStateFlow<List<Payment>>(emptyList())
    val payments: StateFlow<List<Payment>> = _payments.asStateFlow()
    
    fun loadPayments() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = PaymentUiState.Loading
            paymentRepository.getPayments(token)
                .onSuccess { paymentsList ->
                    _payments.value = paymentsList
                    _uiState.value = PaymentUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = PaymentUiState.Error(error.message ?: "Error al cargar pagos")
                }
        }
    }
    
    fun createPayment(request: PaymentRequest) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = PaymentUiState.Loading
            paymentRepository.createPayment(token, request)
                .onSuccess {
                    _uiState.value = PaymentUiState.Success
                    loadPayments() // Recargar lista
                }
                .onFailure { error ->
                    _uiState.value = PaymentUiState.Error(error.message ?: "Error al crear pago")
                }
        }
    }
}

sealed class PaymentUiState {
    object Idle : PaymentUiState()
    object Loading : PaymentUiState()
    object Success : PaymentUiState()
    data class Error(val message: String) : PaymentUiState()
}

