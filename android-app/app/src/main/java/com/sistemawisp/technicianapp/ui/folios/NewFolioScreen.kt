package com.sistemawisp.technicianapp.ui.folios

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
import com.sistemawisp.technicianapp.data.model.FolioRequest
import com.sistemawisp.technicianapp.viewmodel.FolioViewModel
import com.sistemawisp.technicianapp.viewmodel.FolioUiState
import com.sistemawisp.technicianapp.viewmodel.ClientViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewFolioScreen(
    clientId: Int? = null,
    clientName: String? = null,
    onBack: () -> Unit,
    onSuccess: () -> Unit = {},
    folioViewModel: FolioViewModel = hiltViewModel(),
    clientViewModel: ClientViewModel = hiltViewModel()
) {
    val uiState by folioViewModel.uiState.collectAsState()
    val clients by clientViewModel.clients.collectAsState()
    val clientsUiState by clientViewModel.uiState.collectAsState()
    
    var selectedClientId by remember { mutableStateOf<Int?>(clientId) }
    var selectedClientName by remember { mutableStateOf<String?>(clientName) }
    var showClientSelector by remember { mutableStateOf(false) }
    
    var visitDate by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }
    var visitType by remember { mutableStateOf("") }
    var technicianName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    
    val visitTypes = listOf("Instalación", "Mantenimiento", "Reparación", "Revisión", "Otro")
    
    // Cargar clientes si no hay uno preseleccionado
    LaunchedEffect(Unit) {
        if (selectedClientId == null && clients.isEmpty() && clientsUiState !is com.sistemawisp.technicianapp.viewmodel.ClientUiState.Loading) {
            clientViewModel.loadClients()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Generar Folio") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                }
            )
        }
    ) { padding ->
        when (uiState) {
            is FolioUiState.Loading -> {
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
                        value = visitDate,
                        onValueChange = { visitDate = it },
                        label = { Text("Fecha de Visita *") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                        placeholder = { Text("YYYY-MM-DD") },
                        singleLine = true
                    )
                    
                    var expandedType by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = expandedType,
                        onExpandedChange = { expandedType = !expandedType }
                    ) {
                        OutlinedTextField(
                            value = visitType,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Tipo de Visita") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            leadingIcon = { Icon(Icons.Default.Build, contentDescription = null) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedType) }
                        )
                        ExposedDropdownMenu(
                            expanded = expandedType,
                            onDismissRequest = { expandedType = false }
                        ) {
                            visitTypes.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type) },
                                    onClick = {
                                        visitType = type
                                        expandedType = false
                                    }
                                )
                            }
                        }
                    }
                    
                    OutlinedTextField(
                        value = technicianName,
                        onValueChange = { technicianName = it },
                        label = { Text("Nombre del Técnico") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notas / Descripción") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Note, contentDescription = null) },
                        maxLines = 5
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Button(
                        onClick = {
                            if (visitDate.isNotEmpty()) {
                                val request = FolioRequest(
                                    client_id = selectedClientId,
                                    custom_name = null,
                                    custom_address = null,
                                    visit_date = visitDate,
                                    visit_type = visitType.ifEmpty { null },
                                    technician_name = technicianName.ifEmpty { null },
                                    installation_id = null,
                                    notes = notes.ifEmpty { null }
                                )
                                folioViewModel.createFolio(request)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = visitDate.isNotEmpty() && uiState !is FolioUiState.Loading
                    ) {
                        Text("Generar Folio")
                    }
                    
                    if (uiState is FolioUiState.Error) {
                        val errorState = uiState as FolioUiState.Error
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
                    
                    if (uiState is FolioUiState.Success) {
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

