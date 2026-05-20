package com.sistemawisp.technicianapp.ui.installations

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.InstallationRequest
import com.sistemawisp.technicianapp.viewmodel.InstallationViewModel
import com.sistemawisp.technicianapp.viewmodel.InstallationUiState
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewInstallationScreen(
    onBack: () -> Unit,
    viewModel: InstallationViewModel = hiltViewModel()
) {
    var customName by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var installationDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var installationType by remember { mutableStateOf("nueva") }
    var notes by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(uiState) {
        if (uiState is InstallationUiState.Success) {
            onBack()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nueva Instalación") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = customName,
                onValueChange = { customName = it },
                label = { Text("Nombre del Cliente") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            
            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                label = { Text("Dirección") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Teléfono") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            
            OutlinedTextField(
                value = installationDate,
                onValueChange = { installationDate = it },
                label = { Text("Fecha de Instalación (YYYY-MM-DD)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            
            var expanded by remember { mutableStateOf(false) }
            val types = listOf("nueva", "reubicación", "mantenimiento", "reparación")
            
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = installationType,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Tipo de Instalación") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    types.forEach { type ->
                        DropdownMenuItem(
                            text = { Text(type.capitalize()) },
                            onClick = {
                                installationType = type
                                expanded = false
                            }
                        )
                    }
                }
            }
            
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notas") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 5
            )
            
            if (uiState is InstallationUiState.Error) {
                Text(
                    text = (uiState as InstallationUiState.Error).message,
                    color = MaterialTheme.colorScheme.error
                )
            }
            
            Button(
                onClick = {
                    val request = InstallationRequest(
                        custom_name = customName,
                        address = address,
                        installation_date = installationDate,
                        installation_type = installationType,
                        notes = notes.ifBlank { null },
                        phone = phone.ifBlank { null },
                        status = "pendiente"
                    )
                    viewModel.createInstallation(request)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = customName.isNotBlank() && address.isNotBlank() && 
                         installationDate.isNotBlank() && installationType.isNotBlank() &&
                         uiState !is InstallationUiState.Loading
            ) {
                if (uiState is InstallationUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Guardar Instalación")
                }
            }
        }
    }
}


