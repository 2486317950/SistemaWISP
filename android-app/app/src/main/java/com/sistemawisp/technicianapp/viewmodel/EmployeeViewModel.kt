package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Employee
import com.sistemawisp.technicianapp.data.repository.EmployeeRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EmployeeViewModel @Inject constructor(
    private val employeeRepository: EmployeeRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<EmployeeUiState>(EmployeeUiState.Idle)
    val uiState: StateFlow<EmployeeUiState> = _uiState.asStateFlow()
    
    private val _employees = MutableStateFlow<List<Employee>>(emptyList())
    val employees: StateFlow<List<Employee>> = _employees.asStateFlow()
    
    fun loadEmployees() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = EmployeeUiState.Loading
            employeeRepository.getEmployees(token)
                .onSuccess { employeesList ->
                    _employees.value = employeesList
                    _uiState.value = EmployeeUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = EmployeeUiState.Error(error.message ?: "Error al cargar empleados")
                }
        }
    }
}

sealed class EmployeeUiState {
    object Idle : EmployeeUiState()
    object Loading : EmployeeUiState()
    object Success : EmployeeUiState()
    data class Error(val message: String) : EmployeeUiState()
}










