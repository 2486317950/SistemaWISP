package com.sistemawisp.technicianapp.ui.transfers

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
import com.sistemawisp.technicianapp.data.model.Transfer
import com.sistemawisp.technicianapp.viewmodel.TransferViewModel
import com.sistemawisp.technicianapp.viewmodel.TransferUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransferListScreen(viewModel: TransferViewModel = hiltViewModel()) {
    val transfers by viewModel.transfers.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadTransfers() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Transferencias") },
                actions = {
                    IconButton(onClick = { viewModel.loadTransfers() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is TransferUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is TransferUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as TransferUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadTransfers() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (transfers.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay transferencias")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(transfers) { transfer ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = transfer.transfer_date, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        if (transfer.employee_name_from_table != null) {
                                            Text(text = transfer.employee_name_from_table, style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    Text(text = "$${String.format("%.2f", transfer.amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}










