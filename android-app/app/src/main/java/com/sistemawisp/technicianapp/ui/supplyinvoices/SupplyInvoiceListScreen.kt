package com.sistemawisp.technicianapp.ui.supplyinvoices

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
import com.sistemawisp.technicianapp.data.model.SupplyInvoice
import com.sistemawisp.technicianapp.viewmodel.SupplyInvoiceViewModel
import com.sistemawisp.technicianapp.viewmodel.SupplyInvoiceUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplyInvoiceListScreen(viewModel: SupplyInvoiceViewModel = hiltViewModel()) {
    val invoices by viewModel.supplyInvoices.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadSupplyInvoices() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Facturas de Insumos") },
                actions = {
                    IconButton(onClick = { viewModel.loadSupplyInvoices() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is SupplyInvoiceUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is SupplyInvoiceUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as SupplyInvoiceUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadSupplyInvoices() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (invoices.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay facturas de insumos")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(invoices) { invoice ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = invoice.company ?: "Sin empresa", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        if (invoice.invoice_number != null) {
                                            Text(text = "Factura: ${invoice.invoice_number}", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    Text(text = "$${String.format("%.2f", invoice.amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}










