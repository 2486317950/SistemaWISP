package com.sistemawisp.technicianapp.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.data.model.InstallationRequest
import com.sistemawisp.technicianapp.data.repository.InstallationRepository
import com.sistemawisp.technicianapp.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class InstallationViewModel @Inject constructor(
    private val installationRepository: InstallationRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<InstallationUiState>(InstallationUiState.Idle)
    val uiState: StateFlow<InstallationUiState> = _uiState.asStateFlow()
    
    private val _installations = MutableStateFlow<List<Installation>>(emptyList())
    val installations: StateFlow<List<Installation>> = _installations.asStateFlow()
    
    fun loadInstallations() {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = InstallationUiState.Loading
            installationRepository.getInstallations(token)
                .onSuccess { installations ->
                    _installations.value = installations
                    _uiState.value = InstallationUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = InstallationUiState.Error(error.message ?: "Error al cargar instalaciones")
                }
        }
    }
    
    fun createInstallation(request: InstallationRequest) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = InstallationUiState.Loading
            installationRepository.createInstallation(token, request)
                .onSuccess {
                    loadInstallations()
                    _uiState.value = InstallationUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = InstallationUiState.Error(error.message ?: "Error al crear instalación")
                }
        }
    }
    
    fun updateInstallation(id: Int, request: InstallationRequest) {
        viewModelScope.launch {
            val token = tokenManager.getToken() ?: return@launch
            _uiState.value = InstallationUiState.Loading
            installationRepository.updateInstallation(token, id, request)
                .onSuccess {
                    loadInstallations()
                    _uiState.value = InstallationUiState.Success
                }
                .onFailure { error ->
                    _uiState.value = InstallationUiState.Error(error.message ?: "Error al actualizar instalación")
                }
        }
    }
    
    fun markAsCompleted(installation: Installation, notes: String? = null) {
        val request = InstallationRequest(
            client_id = installation.client_id,
            custom_name = installation.custom_name,
            address = installation.address,
            installation_date = installation.installation_date,
            installation_type = installation.installation_type,
            status = "completado",
            notes = notes ?: installation.notes,
            installation_fee = installation.installation_fee,
            is_paid = installation.is_paid,
            technician_name = installation.technician_name,
            equipment_used = installation.equipment_used,
            completion_date = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_DATE),
            installation_time = installation.installation_time,
            package_id = installation.package_id,
            phone = installation.phone
        )
        installation.id?.let { updateInstallation(it, request) }
    }
    
    fun addNote(installation: Installation, note: String) {
        val updatedNotes = if (installation.notes.isNullOrEmpty()) {
            note
        } else {
            "${installation.notes}\n\n$note"
        }
        val request = InstallationRequest(
            client_id = installation.client_id,
            custom_name = installation.custom_name,
            address = installation.address,
            installation_date = installation.installation_date,
            installation_type = installation.installation_type,
            status = installation.status,
            notes = updatedNotes,
            installation_fee = installation.installation_fee,
            is_paid = installation.is_paid,
            technician_name = installation.technician_name,
            equipment_used = installation.equipment_used,
            completion_date = installation.completion_date,
            installation_time = installation.installation_time,
            package_id = installation.package_id,
            phone = installation.phone
        )
        installation.id?.let { updateInstallation(it, request) }
    }
}

sealed class InstallationUiState {
    object Idle : InstallationUiState()
    object Loading : InstallationUiState()
    object Success : InstallationUiState()
    data class Error(val message: String) : InstallationUiState()
}

