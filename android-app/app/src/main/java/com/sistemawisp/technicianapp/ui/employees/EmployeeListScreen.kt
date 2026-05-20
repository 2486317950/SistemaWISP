package com.sistemawisp.technicianapp.ui.employees

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
import com.sistemawisp.technicianapp.data.model.Employee
import com.sistemawisp.technicianapp.viewmodel.EmployeeViewModel
import com.sistemawisp.technicianapp.viewmodel.EmployeeUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeeListScreen(
    viewModel: EmployeeViewModel = hiltViewModel()
) {
    val employees by viewModel.employees.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.loadEmployees()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Empleados") },
                actions = {
                    IconButton(onClick = { viewModel.loadEmployees() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is EmployeeUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is EmployeeUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = (uiState as EmployeeUiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadEmployees() }) {
                            Text("Reintentar")
                        }
                    }
                }
            }
            else -> {
                if (employees.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No hay empleados")
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(employees) { employee ->
                            EmployeeCard(employee = employee)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmployeeCard(employee: Employee) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = employee.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                if (employee.is_active == false) {
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = MaterialTheme.shapes.small
                    ) {
                        Text(
                            text = "Inactivo",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (employee.payroll_account != null) {
                Text(
                    text = "Cuenta: ${employee.payroll_account}",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (employee.phone != null) {
                    Text(
                        text = "📞 ${employee.phone}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                if (employee.email != null) {
                    Text(
                        text = "📧 ${employee.email}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}










