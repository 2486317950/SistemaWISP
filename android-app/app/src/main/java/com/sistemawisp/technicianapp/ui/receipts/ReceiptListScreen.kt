package com.sistemawisp.technicianapp.ui.receipts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.Receipt
import com.sistemawisp.technicianapp.viewmodel.ReceiptViewModel
import com.sistemawisp.technicianapp.viewmodel.ReceiptUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptListScreen(
    onReceiptClick: (Receipt) -> Unit = {},
    viewModel: ReceiptViewModel = hiltViewModel()
) {
    val receipts by viewModel.receipts.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadReceipts() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recibos") },
                actions = {
                    IconButton(onClick = { viewModel.loadReceipts() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is ReceiptUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is ReceiptUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as ReceiptUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadReceipts() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (receipts.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay recibos")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(receipts) { receipt ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { 
                                        receipt.id?.let { onReceiptClick(receipt) }
                                    },
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                            ) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = receipt.client_name ?: "Sin nombre", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        Text(text = receipt.receipt_date, style = MaterialTheme.typography.bodySmall)
                                        if (receipt.receipt_number != null) {
                                            Text(text = "Recibo: ${receipt.receipt_number}", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(text = "$${String.format("%.2f", receipt.amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                        Icon(
                                            imageVector = Icons.Default.Visibility,
                                            contentDescription = "Ver",
                                            tint = MaterialTheme.colorScheme.primary
                                        )
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

