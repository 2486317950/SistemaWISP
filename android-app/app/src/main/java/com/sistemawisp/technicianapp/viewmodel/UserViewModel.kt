package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.AppUser
import com.sistemawisp.technicianapp.data.repository.UserRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<UserUiState>(UserUiState.Idle)
    val uiState: StateFlow<UserUiState> = _uiState.asStateFlow()
    
    private val _users = MutableStateFlow<List<AppUser>>(emptyList())
    val users: StateFlow<List<AppUser>> = _users.asStateFlow()
    
    fun loadUsers() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = UserUiState.Loading
            userRepository.getUsers(token)
                .onSuccess { usersList ->
                    _users.value = usersList
                    _uiState.value = UserUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = UserUiState.Error(error.message ?: "Error al cargar usuarios")
                }
        }
    }
}

sealed class UserUiState {
    object Idle : UserUiState()
    object Loading : UserUiState()
    object Success : UserUiState()
    data class Error(val message: String) : UserUiState()
}










