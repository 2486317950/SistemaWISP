package com.sistemawisp.technicianapp.ui.expenses

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
import com.sistemawisp.technicianapp.data.model.Expense
import com.sistemawisp.technicianapp.viewmodel.ExpenseViewModel
import com.sistemawisp.technicianapp.viewmodel.ExpenseUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseListScreen(viewModel: ExpenseViewModel = hiltViewModel()) {
    val expenses by viewModel.expenses.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) { viewModel.loadExpenses() }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gastos") },
                actions = {
                    IconButton(onClick = { viewModel.loadExpenses() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is ExpenseUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is ExpenseUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = (uiState as ExpenseUiState.Error).message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadExpenses() }) { Text("Reintentar") }
                    }
                }
            }
            else -> {
                if (expenses.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        Text("No hay gastos")
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(expenses) { expense ->
                            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = expense.expense_date, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                        if (expense.category != null) {
                                            Text(text = expense.category, style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    Text(text = "$${String.format("%.2f", expense.amount)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}










