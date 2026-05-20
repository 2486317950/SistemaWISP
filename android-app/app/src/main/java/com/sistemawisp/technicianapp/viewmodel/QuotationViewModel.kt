package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Quotation
import com.sistemawisp.technicianapp.data.repository.QuotationRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class QuotationViewModel @Inject constructor(
    private val quotationRepository: QuotationRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<QuotationUiState>(QuotationUiState.Idle)
    val uiState: StateFlow<QuotationUiState> = _uiState.asStateFlow()
    
    private val _quotations = MutableStateFlow<List<Quotation>>(emptyList())
    val quotations: StateFlow<List<Quotation>> = _quotations.asStateFlow()
    
    fun loadQuotations() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = QuotationUiState.Loading
            quotationRepository.getQuotations(token)
                .onSuccess { quotationsList ->
                    _quotations.value = quotationsList
                    _uiState.value = QuotationUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = QuotationUiState.Error(error.message ?: "Error al cargar cotizaciones")
                }
        }
    }
}

sealed class QuotationUiState {
    object Idle : QuotationUiState()
    object Loading : QuotationUiState()
    object Success : QuotationUiState()
    data class Error(val message: String) : QuotationUiState()
}










