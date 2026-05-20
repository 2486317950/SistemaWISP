package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Contract
import com.sistemawisp.technicianapp.data.repository.ContractRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ContractViewModel @Inject constructor(
    private val contractRepository: ContractRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ContractUiState>(ContractUiState.Idle)
    val uiState: StateFlow<ContractUiState> = _uiState.asStateFlow()
    
    private val _contracts = MutableStateFlow<List<Contract>>(emptyList())
    val contracts: StateFlow<List<Contract>> = _contracts.asStateFlow()
    
    fun loadContracts() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = ContractUiState.Loading
            contractRepository.getContracts(token)
                .onSuccess { contractsList ->
                    _contracts.value = contractsList
                    _uiState.value = ContractUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = ContractUiState.Error(error.message ?: "Error al cargar contratos")
                }
        }
    }
}

sealed class ContractUiState {
    object Idle : ContractUiState()
    object Loading : ContractUiState()
    object Success : ContractUiState()
    data class Error(val message: String) : ContractUiState()
}










