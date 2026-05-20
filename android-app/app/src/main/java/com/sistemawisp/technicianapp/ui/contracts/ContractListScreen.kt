package com.sistemawisp.technicianapp.ui.contracts

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
import com.sistemawisp.technicianapp.data.model.Contract
import com.sistemawisp.technicianapp.viewmodel.ContractViewModel
import com.sistemawisp.technicianapp.viewmodel.ContractUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContractListScreen(
    onContractClick: (Contract) -> Unit = {},
    viewModel: ContractViewModel = hiltViewModel()
) {
    val contracts by viewModel.contracts.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadContracts() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Contratos") },
                actions = {
                    IconButton(onClick = { viewModel.loadContracts() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is ContractUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is ContractUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as ContractUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadContracts() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (contracts.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay contratos")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(contracts) { contract ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { 
                                        contract.id?.let { onContractClick(contract) }
                                    },
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = contract.client_name ?: "Sin nombre", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        if (contract.contract_number != null) {
                                            Text(text = "Contrato: ${contract.contract_number}", style = MaterialTheme.typography.bodySmall)
                                        }
                                        if (contract.package_name != null) {
                                            Text(text = "Paquete: ${contract.package_name}", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
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

