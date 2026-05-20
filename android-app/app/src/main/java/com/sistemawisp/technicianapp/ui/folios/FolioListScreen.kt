package com.sistemawisp.technicianapp.ui.folios

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.Folio
import com.sistemawisp.technicianapp.viewmodel.FolioViewModel
import com.sistemawisp.technicianapp.viewmodel.FolioUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FolioListScreen(
    onNewFolio: () -> Unit = {},
    viewModel: FolioViewModel = hiltViewModel()
) {
    val folios by viewModel.folios.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadFolios() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Folios") },
                actions = {
                    IconButton(onClick = { viewModel.loadFolios() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNewFolio) {
                Icon(Icons.Default.Add, contentDescription = "Nuevo Folio")
            }
        }
    ) { padding ->
        when (uiState) {
            is FolioUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is FolioUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as FolioUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadFolios() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (folios.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay folios")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(folios) { folio ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                                    Text(text = folio.display_name ?: folio.client_name ?: "Sin nombre", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(text = folio.visit_date, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    if (folio.folio_number != null) {
                                        Text(text = "Folio: ${folio.folio_number}", style = MaterialTheme.typography.bodySmall)
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

