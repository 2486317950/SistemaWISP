package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.repository.AuthRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    val isLoggedIn: Boolean
        get() = tokenManager.isLoggedIn()
    
    init {
        if (isLoggedIn) {
            _uiState.value = AuthUiState.Success
        }
    }
    
    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            authRepository.login(username, password)
                .onSuccess { response ->
                    if (response.token.isNotBlank()) {
                        tokenManager.saveTokenAndUser(
                            response.token,
                            response.user.username,
                            response.user.role
                        )
                    }
                    _uiState.value = AuthUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = AuthUiState.Error(error.message ?: "Error al iniciar sesión")
                }
        }
    }
    
    fun logout() {
        tokenManager.clearToken()
        _uiState.value = AuthUiState.Idle
    }

    fun getSavedUsername(): String? = tokenManager.getUsername()
}

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}













