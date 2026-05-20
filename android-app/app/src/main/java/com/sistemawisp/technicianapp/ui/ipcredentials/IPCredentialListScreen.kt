package com.sistemawisp.technicianapp.ui.ipcredentials

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.IPCredential
import com.sistemawisp.technicianapp.viewmodel.IPCredentialViewModel
import com.sistemawisp.technicianapp.viewmodel.IPCredentialUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IPCredentialListScreen(viewModel: IPCredentialViewModel = hiltViewModel()) {
    val credentials by viewModel.ipCredentials.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadIPCredentials() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("IPs y Contraseñas") },
                actions = {
                    IconButton(onClick = { viewModel.loadIPCredentials() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is IPCredentialUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is IPCredentialUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as IPCredentialUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadIPCredentials() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (credentials.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay IPs y contraseñas")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(credentials) { cred ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                                    Text(text = cred.display_name ?: cred.client_name ?: "Sin nombre", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(text = "IP: ${cred.ip_address}", style = MaterialTheme.typography.bodyMedium)
                                    if (cred.device_type != null) {
                                        Text(text = "Tipo: ${cred.device_type}", style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}










