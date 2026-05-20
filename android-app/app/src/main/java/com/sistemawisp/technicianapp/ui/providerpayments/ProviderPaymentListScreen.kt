package com.sistemawisp.technicianapp.ui.providerpayments

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
import com.sistemawisp.technicianapp.data.model.ProviderPayment
import com.sistemawisp.technicianapp.viewmodel.ProviderPaymentViewModel
import com.sistemawisp.technicianapp.viewmodel.ProviderPaymentUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProviderPaymentListScreen(viewModel: ProviderPaymentViewModel = hiltViewModel()) {
    val payments by viewModel.providerPayments.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadProviderPayments() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pagos a Proveedores") },
                actions = {
                    IconButton(onClick = { viewModel.loadProviderPayments() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is ProviderPaymentUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is ProviderPaymentUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as ProviderPaymentUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadProviderPayments() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (payments.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay pagos a proveedores")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(payments) { payment ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = payment.network_type ?: "Sin tipo", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        Text(text = "Pagado: $${String.format("%.2f", payment.paid_amount)} / Total: $${String.format("%.2f", payment.total_amount)}", style = MaterialTheme.typography.bodySmall)
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










