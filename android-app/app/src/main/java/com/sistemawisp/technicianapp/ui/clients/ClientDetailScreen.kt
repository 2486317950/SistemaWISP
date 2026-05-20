package com.sistemawisp.technicianapp.ui.clients

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.ClientDetail
import com.sistemawisp.technicianapp.data.model.Payment
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.data.model.Folio
import com.sistemawisp.technicianapp.viewmodel.ClientViewModel
import com.sistemawisp.technicianapp.viewmodel.ClientDetailUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientDetailScreen(
    clientId: Int,
    onBack: () -> Unit,
    onNewPayment: (Int, String) -> Unit = { _, _ -> },
    onNewFolio: (Int, String) -> Unit = { _, _ -> },
    viewModel: ClientViewModel = hiltViewModel()
) {
    val clientDetail by viewModel.clientDetail.collectAsState()
    val uiState by viewModel.detailUiState.collectAsState()
    
    LaunchedEffect(clientId) {
        viewModel.loadClientDetail(clientId)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalle del Cliente") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    IconButton(onClick = { 
                        onNewPayment(clientId, clientDetail?.name ?: "")
                    }) {
                        Icon(Icons.Default.Payment, contentDescription = "Registrar Pago")
                    }
                    IconButton(onClick = { 
                        onNewFolio(clientId, clientDetail?.name ?: "")
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "Generar Folio")
                    }
                }
            )
        },
        floatingActionButton = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FloatingActionButton(
                    onClick = { onNewPayment(clientId, clientDetail?.name ?: "") },
                    containerColor = MaterialTheme.colorScheme.secondary
                ) {
                    Icon(Icons.Default.Payment, contentDescription = "Registrar Pago")
                }
                FloatingActionButton(
                    onClick = { onNewFolio(clientId, clientDetail?.name ?: "") },
                    containerColor = MaterialTheme.colorScheme.tertiary
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Generar Folio")
                }
            }
        }
    ) { padding ->
        when (uiState) {
            is ClientDetailUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is ClientDetailUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = (uiState as ClientDetailUiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadClientDetail(clientId) }) {
                            Text("Reintentar")
                        }
                    }
                }
            }
            else -> {
                val client = clientDetail
                if (client == null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Cliente no encontrado")
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Información Principal
                        item {
                            val context = LocalContext.current
                            InfoCard(
                                title = "Información Personal",
                                icon = Icons.Default.Person
                            ) {
                                InfoRow("Nombre", client.name)
                                if (client.client_number != null) {
                                    InfoRow("Número de Cliente", client.client_number)
                                }
                                InfoRow("Dirección", client.address)
                                if (client.phone != null) {
                                    InfoRow(
                                        "Teléfono", 
                                        client.phone,
                                        onClick = {
                                            val intent = Intent(Intent.ACTION_DIAL).apply {
                                                data = Uri.parse("tel:${client.phone}")
                                            }
                                            context.startActivity(intent)
                                        }
                                    )
                                }
                                if (client.email != null) {
                                    InfoRow("Email", client.email)
                                }
                                if (client.network_type != null) {
                                    InfoRow("Tipo de Red", client.network_type)
                                }
                                if (client.ip_address != null) {
                                    InfoRow("Dirección IP", client.ip_address)
                                }
                            }
                        }
                        
                        // Paquete
                        if (client.package_name != null) {
                            item {
                                InfoCard(
                                    title = "Paquete",
                                    icon = Icons.Default.Inventory
                                ) {
                                    InfoRow("Nombre", client.package_name)
                                    if (client.package_speed != null) {
                                        InfoRow("Velocidad", client.package_speed)
                                    }
                                    if (client.package_price != null) {
                                        InfoRow("Precio", "$${String.format("%.2f", client.package_price)}")
                                    }
                                    if (client.package_description != null) {
                                        InfoRow("Descripción", client.package_description)
                                    }
                                }
                            }
                        }
                        
                        // Historial de Pagos
                        if (!client.payments.isNullOrEmpty()) {
                            item {
                                Text(
                                    text = "Historial de Pagos (${client.payments.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                            items(client.payments) { payment ->
                                PaymentRow(payment)
                            }
                        }
                        
                        // Instalaciones
                        if (!client.installations.isNullOrEmpty()) {
                            item {
                                Text(
                                    text = "Instalaciones (${client.installations.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                            items(client.installations) { installation ->
                                InstallationRow(installation)
                            }
                        }
                        
                        // Historial de Folios
                        if (!client.folios.isNullOrEmpty()) {
                            item {
                                Text(
                                    text = "Historial de Folios (${client.folios.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }
                            items(client.folios) { folio ->
                                FolioRow(folio)
                            }
                        }
                        
                        // Notas
                        if (!client.notes.isNullOrEmpty()) {
                            item {
                                InfoCard(
                                    title = "Notas",
                                    icon = Icons.Default.Note
                                ) {
                                    Text(
                                        text = client.notes,
                                        style = MaterialTheme.typography.bodyMedium
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

@Composable
fun InfoCard(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Divider()
            content()
        }
    }
}

@Composable
fun InfoRow(label: String, value: String, onClick: (() -> Unit)? = null) {
    val context = LocalContext.current
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) {
                    Modifier.clickable { onClick() }
                } else {
                    Modifier
                }
            ),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            if (onClick != null && label.contains("Teléfono", ignoreCase = true)) {
                Spacer(modifier = Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.Default.Phone,
                    contentDescription = "Llamar",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
fun PaymentRow(payment: Payment) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = payment.payment_date,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                    if (payment.payment_method != null) {
                        Text(
                            text = "Método: ${payment.payment_method}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (payment.payment_type != null) {
                        Text(
                            text = "Tipo: ${payment.payment_type}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$${String.format("%.2f", payment.amount)}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    if (payment.is_free_month == true) {
                        Surface(
                            color = MaterialTheme.colorScheme.tertiaryContainer,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "Mes Gratis",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
            if (payment.receipt_number != null) {
                Text(
                    text = "Recibo: ${payment.receipt_number}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (!payment.notes.isNullOrEmpty()) {
                Text(
                    text = payment.notes,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
fun InstallationRow(installation: Installation) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = installation.installation_date ?: "Sin fecha",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            if (installation.status != null) {
                Surface(
                    color = when (installation.status) {
                        "completado" -> MaterialTheme.colorScheme.primaryContainer
                        "pendiente" -> MaterialTheme.colorScheme.tertiaryContainer
                        else -> MaterialTheme.colorScheme.errorContainer
                    },
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = installation.status,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}

@Composable
fun FolioRow(folio: Folio) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = folio.visit_date,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                if (folio.visit_type != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.tertiaryContainer,
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = folio.visit_type,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
            if (folio.folio_number != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Description,
                        contentDescription = "Folio",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Folio: ${folio.folio_number}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (folio.technician_name != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Técnico",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Técnico: ${folio.technician_name}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (!folio.notes.isNullOrEmpty()) {
                Text(
                    text = folio.notes,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

