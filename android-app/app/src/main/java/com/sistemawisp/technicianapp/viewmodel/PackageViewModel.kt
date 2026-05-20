package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Package
import com.sistemawisp.technicianapp.data.repository.PackageRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PackageViewModel @Inject constructor(
    private val packageRepository: PackageRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<PackageUiState>(PackageUiState.Idle)
    val uiState: StateFlow<PackageUiState> = _uiState.asStateFlow()
    
    private val _packages = MutableStateFlow<List<Package>>(emptyList())
    val packages: StateFlow<List<Package>> = _packages.asStateFlow()
    
    fun loadPackages(activeOnly: Boolean? = null) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = PackageUiState.Loading
            packageRepository.getPackages(token, activeOnly)
                .onSuccess { packagesList ->
                    _packages.value = packagesList
                    _uiState.value = PackageUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = PackageUiState.Error(error.message ?: "Error al cargar paquetes")
                }
        }
    }
}

sealed class PackageUiState {
    object Idle : PackageUiState()
    object Loading : PackageUiState()
    object Success : PackageUiState()
    data class Error(val message: String) : PackageUiState()
}










