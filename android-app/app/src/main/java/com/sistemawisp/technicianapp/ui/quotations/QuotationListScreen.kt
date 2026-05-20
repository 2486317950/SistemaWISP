package com.sistemawisp.technicianapp.ui.quotations

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
import com.sistemawisp.technicianapp.data.model.Quotation
import com.sistemawisp.technicianapp.viewmodel.QuotationViewModel
import com.sistemawisp.technicianapp.viewmodel.QuotationUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuotationListScreen(viewModel: QuotationViewModel = hiltViewModel()) {
    val quotations by viewModel.quotations.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadQuotations() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cotizaciones") },
                actions = {
                    IconButton(onClick = { viewModel.loadQuotations() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is QuotationUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is QuotationUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as QuotationUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadQuotations() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (quotations.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay cotizaciones")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(quotations) { quotation ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = quotation.client_name ?: "Sin nombre", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        Text(text = quotation.quotation_date, style = MaterialTheme.typography.bodySmall)
                                    }
                                    if (quotation.total_amount != null) {
                                        Text(text = "$${String.format("%.2f", quotation.total_amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
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










