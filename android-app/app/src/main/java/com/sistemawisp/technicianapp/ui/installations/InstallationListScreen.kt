package com.sistemawisp.technicianapp.ui.installations

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.viewmodel.AuthViewModel
import com.sistemawisp.technicianapp.viewmodel.InstallationViewModel
import com.sistemawisp.technicianapp.viewmodel.InstallationUiState
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallationListScreen(
    onInstallationClick: (Installation) -> Unit,
    onNewInstallationClick: () -> Unit,
    onLogout: () -> Unit,
    viewModel: InstallationViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val installations by viewModel.installations.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        viewModel.loadInstallations()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Instalaciones") },
                actions = {
                    IconButton(onClick = { viewModel.loadInstallations() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                    IconButton(onClick = { showLogoutDialog = true }) {
                        Icon(Icons.Default.Logout, contentDescription = "Cerrar Sesión")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNewInstallationClick) {
                Icon(Icons.Default.Add, contentDescription = "Nueva Instalación")
            }
        }
    ) { padding ->
        when (uiState) {
            is InstallationUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is InstallationUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = (uiState as InstallationUiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadInstallations() }) {
                            Text("Reintentar")
                        }
                    }
                }
            }
            else -> {
                if (installations.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No hay instalaciones")
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(installations) { installation ->
                            InstallationCard(
                                installation = installation,
                                onClick = { onInstallationClick(installation) }
                            )
                        }
                    }
                }
            }
        }
    }
    
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Cerrar Sesión") },
            text = { Text("¿Estás seguro de que deseas cerrar sesión?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        authViewModel.logout()
                        showLogoutDialog = false
                        onLogout()
                    }
                ) {
                    Text("Cerrar Sesión")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallationCard(
    installation: Installation,
    onClick: () -> Unit
) {
    val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val displayDate = try {
        dateFormat.parse(installation.installation_date)?.let {
            SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(it)
        } ?: installation.installation_date
    } catch (e: Exception) {
        installation.installation_date
    }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = installation.display_name ?: installation.custom_name ?: "Sin nombre",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = installation.display_address ?: installation.address ?: "Sin dirección",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Fecha: $displayDate",
                    style = MaterialTheme.typography.bodySmall
                )
                StatusChip(status = installation.status)
            }
        }
    }
}

@Composable
fun StatusChip(status: String) {
    val (text, color) = when (status.lowercase()) {
        "completado", "completada" -> "Completada" to MaterialTheme.colorScheme.primary
        "en proceso", "en_proceso" -> "En Proceso" to MaterialTheme.colorScheme.secondary
        "cancelada", "cancelado" -> "Cancelada" to MaterialTheme.colorScheme.error
        else -> "Pendiente" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    
    Surface(
        color = color.copy(alpha = 0.2f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}


