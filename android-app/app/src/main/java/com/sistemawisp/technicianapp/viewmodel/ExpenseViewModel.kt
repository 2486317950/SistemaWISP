package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Expense
import com.sistemawisp.technicianapp.data.repository.ExpenseRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ExpenseViewModel @Inject constructor(
    private val expenseRepository: ExpenseRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<ExpenseUiState>(ExpenseUiState.Idle)
    val uiState: StateFlow<ExpenseUiState> = _uiState.asStateFlow()
    
    private val _expenses = MutableStateFlow<List<Expense>>(emptyList())
    val expenses: StateFlow<List<Expense>> = _expenses.asStateFlow()
    
    fun loadExpenses() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = ExpenseUiState.Loading
            expenseRepository.getExpenses(token)
                .onSuccess { expensesList ->
                    _expenses.value = expensesList
                    _uiState.value = ExpenseUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = ExpenseUiState.Error(error.message ?: "Error al cargar gastos")
                }
        }
    }
}

sealed class ExpenseUiState {
    object Idle : ExpenseUiState()
    object Loading : ExpenseUiState()
    object Success : ExpenseUiState()
    data class Error(val message: String) : ExpenseUiState()
}










