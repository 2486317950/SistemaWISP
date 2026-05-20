package com.sistemawisp.technicianapp.ui.payments

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.PaymentRequest
import com.sistemawisp.technicianapp.viewmodel.PaymentViewModel
import com.sistemawisp.technicianapp.viewmodel.PaymentUiState
import com.sistemawisp.technicianapp.viewmodel.ClientViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewPaymentScreen(
    clientId: Int? = null,
    clientName: String? = null,
    clientNetworkType: String? = null,
    onBack: () -> Unit,
    onSuccess: () -> Unit = {},
    paymentViewModel: PaymentViewModel = hiltViewModel(),
    clientViewModel: ClientViewModel = hiltViewModel()
) {
    val uiState by paymentViewModel.uiState.collectAsState()
    val clients by clientViewModel.clients.collectAsState()
    val clientsUiState by clientViewModel.uiState.collectAsState()
    
    var selectedClientId by remember { mutableStateOf<Int?>(clientId) }
    var selectedClientName by remember { mutableStateOf<String?>(clientName) }
    var selectedClientNetworkType by remember { mutableStateOf<String?>(clientNetworkType) }
    var showClientSelector by remember { mutableStateOf(false) }
    
    var amount by remember { mutableStateOf("") }
    var paymentDate by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }
    var paymentMethod by remember { mutableStateOf("") }
    var paymentType by remember { mutableStateOf(if (selectedClientId != null) "mensualidad" else "instalacion") }
    var isFreeMonth by remember { mutableStateOf(false) }
    var notes by remember { mutableStateOf("") }
    
    val paymentMethods = listOf("Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro")
    
    // Cargar clientes si no hay uno preseleccionado
    LaunchedEffect(Unit) {
        if (selectedClientId == null && clients.isEmpty() && clientsUiState !is com.sistemawisp.technicianapp.viewmodel.ClientUiState.Loading) {
            clientViewModel.loadClients()
        }
    }
    
    // Actualizar paymentType cuando cambia el cliente seleccionado
    LaunchedEffect(selectedClientId) {
        paymentType = if (selectedClientId != null) "mensualidad" else "instalacion"
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Registrar Pago") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is PaymentUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Selector de Cliente
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Cliente",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            if (selectedClientName != null) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = selectedClientName ?: "Sin nombre",
                                        style = MaterialTheme.typography.bodyLarge,
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(onClick = { 
                                        selectedClientId = null
                                        selectedClientName = null
                                        selectedClientNetworkType = null
                                    }) {
                                        Icon(Icons.Default.Close, contentDescription = "Quitar cliente")
                                    }
                                }
                            } else {
                                Button(
                                    onClick = { showClientSelector = true },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Person, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Seleccionar Cliente")
                                }
                            }
                        }
                    }
                    
                    // Diálogo de selección de cliente
                    if (showClientSelector) {
                        AlertDialog(
                            onDismissRequest = { showClientSelector = false },
                            title = { Text("Seleccionar Cliente") },
                            text = {
                                when (clientsUiState) {
                                    is com.sistemawisp.technicianapp.viewmodel.ClientUiState.Loading -> {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            CircularProgressIndicator()
                                        }
                                    }
                                    is com.sistemawisp.technicianapp.viewmodel.ClientUiState.Error -> {
                                        Text(
                                            text = (clientsUiState as com.sistemawisp.technicianapp.viewmodel.ClientUiState.Error).message,
                                            color = MaterialTheme.colorScheme.error
                                        )
                                    }
                                    else -> {
                                        LazyColumn(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .heightIn(max = 400.dp)
                                        ) {
                                            items(clients) { client ->
                                                Card(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .padding(vertical = 4.dp)
                                                        .clickable {
                                                            selectedClientId = client.id
                                                            selectedClientName = client.name
                                                            selectedClientNetworkType = client.network_type
                                                            showClientSelector = false
                                                        },
                                                    colors = CardDefaults.cardColors(
                                                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                                                    )
                                                ) {
                                                    Column(
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .padding(12.dp)
                                                    ) {
                                                        Text(
                                                            text = client.name,
                                                            style = MaterialTheme.typography.bodyLarge,
                                                            fontWeight = FontWeight.SemiBold
                                                        )
                                                        if (client.client_number != null) {
                                                            Text(
                                                                text = "Número: ${client.client_number}",
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                                            )
                                                        }
                                                        if (client.address.isNotEmpty()) {
                                                            Text(
                                                                text = client.address,
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            confirmButton = {
                                TextButton(onClick = { showClientSelector = false }) {
                                    Text("Cerrar")
                                }
                            }
                        )
                    }
                    
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it },
                        label = { Text("Monto *") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.AttachMoney, contentDescription = null) },
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = paymentDate,
                        onValueChange = { paymentDate = it },
                        label = { Text("Fecha de Pago *") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                        placeholder = { Text("YYYY-MM-DD") },
                        singleLine = true
                    )
                    
                    var expandedMethod by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expandedMethod,
                        onExpandedChange = { expandedMethod = !expandedMethod }
                    ) {
                        OutlinedTextField(
                            value = paymentMethod,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Método de Pago") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            leadingIcon = { Icon(Icons.Default.Payment, contentDescription = null) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedMethod) }
                        )
                        ExposedDropdownMenu(
                            expanded = expandedMethod,
                            onDismissRequest = { expandedMethod = false }
                        ) {
                            paymentMethods.forEach { method ->
                                DropdownMenuItem(
                                    text = { Text(method) },
                                    onClick = {
                                        paymentMethod = method
                                        expandedMethod = false
                                    }
                                )
                            }
                        }
                    }
                    
                    OutlinedTextField(
                        value = paymentType,
                        onValueChange = { paymentType = it },
                        label = { Text("Tipo de Pago") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Category, contentDescription = null) },
                        placeholder = { Text("mensualidad, instalación, etc.") },
                        singleLine = true
                    )
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = isFreeMonth,
                            onCheckedChange = { isFreeMonth = it }
                        )
                        Text(
                            text = "Mes Gratis",
                            modifier = Modifier.padding(start = 8.dp)
                        )
                    }
                    
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notas") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Note, contentDescription = null) },
                        maxLines = 3
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Button(
                        onClick = {
                            if (amount.isNotEmpty() && paymentDate.isNotEmpty()) {
                                val finalPaymentType = paymentType.ifEmpty { if (selectedClientId != null) "mensualidad" else "instalacion" }
                                
                                // Si es mensualidad, usar network_type del cliente o un valor por defecto
                                val networkType = if (finalPaymentType == "mensualidad") {
                                    selectedClientNetworkType ?: "wifi" // Usar el network_type del cliente o "wifi" por defecto
                                } else {
                                    null
                                }
                                
                                val request = PaymentRequest(
                                    client_id = selectedClientId,
                                    payment_type = finalPaymentType,
                                    network_type = networkType,
                                    payment_method = paymentMethod.ifEmpty { null },
                                    custom_name = null,
                                    custom_address = null,
                                    amount = amount.toDoubleOrNull() ?: 0.0,
                                    payment_date = paymentDate,
                                    receipt_number = null,
                                    is_free_month = if (isFreeMonth) true else null,
                                    notes = notes.ifEmpty { null }
                                )
                                paymentViewModel.createPayment(request)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = amount.isNotEmpty() && paymentDate.isNotEmpty() && uiState !is PaymentUiState.Loading
                    ) {
                        Text("Registrar Pago")
                    }
                    
                    if (uiState is PaymentUiState.Error) {
                        val errorState = uiState as PaymentUiState.Error
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            )
                        ) {
                            Text(
                                text = errorState.message,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                    
                    if (uiState is PaymentUiState.Success) {
                        LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(500) // Pequeño delay para mostrar éxito
                            onSuccess()
                        }
                    }
                }
            }
        }
    }
}

