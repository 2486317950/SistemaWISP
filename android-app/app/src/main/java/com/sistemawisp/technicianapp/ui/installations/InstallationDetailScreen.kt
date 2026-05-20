package com.sistemawisp.technicianapp.ui.installations

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.viewmodel.InstallationViewModel
import com.sistemawisp.technicianapp.viewmodel.InstallationUiState
import java.text.SimpleDateFormat
import java.util.*

private enum class PendingAction {
    COMPLETE, ADD_NOTE
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallationDetailScreen(
    installation: Installation,
    onBack: () -> Unit,
    viewModel: InstallationViewModel = hiltViewModel()
) {
    var showCompleteDialog by remember { mutableStateOf(false) }
    var showNoteDialog by remember { mutableStateOf(false) }
    var noteText by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()
    var pendingAction by remember { mutableStateOf<PendingAction?>(null) }
    
    LaunchedEffect(uiState) {
        if (uiState is InstallationUiState.Success && pendingAction != null) {
            // Solo regresar si hay una acción pendiente que se completó
            pendingAction = null
            onBack()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalles de Instalación") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Atrás")
                    }
                }
            )
        },
        floatingActionButton = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (installation.status.lowercase() != "completado" && installation.status.lowercase() != "completada") {
                    FloatingActionButton(
                        onClick = { showCompleteDialog = true },
                        modifier = Modifier.size(56.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = "Completar")
                    }
                }
                FloatingActionButton(
                    onClick = { showNoteDialog = true },
                    modifier = Modifier.size(56.dp)
                ) {
                    Icon(Icons.Default.Edit, contentDescription = "Agregar Nota")
                }
            }
        }
    ) { padding ->
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val displayDateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        
        val formattedInstallationDate = try {
            dateFormat.parse(installation.installation_date)?.let {
                displayDateFormat.format(it)
            } ?: installation.installation_date
        } catch (e: Exception) {
            installation.installation_date
        }
        
        val formattedCompletionDate = installation.completion_date?.let { date ->
            try {
                dateFormat.parse(date)?.let {
                    displayDateFormat.format(it)
                } ?: date
            } catch (e: Exception) {
                date
            }
        }
        
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    DetailItem("Cliente", installation.display_name ?: installation.custom_name ?: "N/A")
                    Divider()
                    DetailItem("Dirección", installation.display_address ?: installation.address ?: "N/A")
                    if (installation.phone != null) {
                        Divider()
                        DetailItem("Teléfono", installation.phone)
                    }
                    Divider()
                    DetailItem("Fecha de Instalación", formattedInstallationDate)
                    Divider()
                    DetailItem("Tipo", installation.installation_type)
                    Divider()
                    DetailItem("Estado", installation.status)
                    if (installation.installation_fee != null && installation.installation_fee > 0) {
                        Divider()
                        DetailItem("Costo de Instalación", "$${String.format("%.2f", installation.installation_fee)}")
                    }
                    if (installation.is_paid) {
                        Divider()
                        DetailItem("Estado de Pago", "Pagado")
                    }
                    if (installation.package_name != null) {
                        Divider()
                        DetailItem("Paquete", installation.package_name)
                        if (installation.package_speed != null) {
                            DetailItem("Velocidad", installation.package_speed)
                        }
                    }
                    if (installation.technician_name != null) {
                        Divider()
                        DetailItem("Técnico", installation.technician_name)
                    }
                    if (installation.equipment_used != null) {
                        Divider()
                        DetailItem("Equipo Usado", installation.equipment_used)
                    }
                    if (installation.installation_time != null) {
                        Divider()
                        DetailItem("Tiempo de Instalación", "${installation.installation_time} minutos")
                    }
                    if (formattedCompletionDate != null) {
                        Divider()
                        DetailItem("Fecha de Completado", formattedCompletionDate)
                    }
                    if (installation.installation_folio != null) {
                        Divider()
                        DetailItem("Folio de Instalación", installation.installation_folio)
                    }
                    if (installation.completion_folio != null) {
                        Divider()
                        DetailItem("Folio de Completado", installation.completion_folio)
                    }
                    if (!installation.notes.isNullOrEmpty()) {
                        Divider()
                        DetailItem("Notas", installation.notes)
                    }
                }
            }
        }
    }
    
    if (showCompleteDialog) {
        AlertDialog(
            onDismissRequest = { showCompleteDialog = false },
            title = { Text("Marcar como Completada") },
            text = { Text("¿Estás seguro de marcar esta instalación como completada?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        pendingAction = PendingAction.COMPLETE
                        viewModel.markAsCompleted(installation)
                        showCompleteDialog = false
                    }
                ) {
                    Text("Confirmar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCompleteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
    
    if (showNoteDialog) {
        AlertDialog(
            onDismissRequest = { showNoteDialog = false },
            title = { Text("Agregar Nota") },
            text = {
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Nota") },
                    maxLines = 5
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (noteText.isNotBlank()) {
                            pendingAction = PendingAction.ADD_NOTE
                            viewModel.addNote(installation, noteText)
                            noteText = ""
                            showNoteDialog = false
                        }
                    }
                ) {
                    Text("Guardar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNoteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
fun DetailItem(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}

