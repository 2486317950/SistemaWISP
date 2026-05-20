package com.sistemawisp.technicianapp.ui.traffic

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.Traffic
import com.sistemawisp.technicianapp.viewmodel.TrafficViewModel
import com.sistemawisp.technicianapp.viewmodel.TrafficUiState
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrafficListScreen(
    onBack: () -> Unit = {},
    viewModel: TrafficViewModel = hiltViewModel()
) {
    val traffic by viewModel.traffic.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    var autoRefresh by remember { mutableStateOf(true) }
    var refreshInterval by remember { mutableStateOf(30) } // segundos
    
    // Cargar datos iniciales
    LaunchedEffect(Unit) {
        viewModel.loadTraffic()
        viewModel.loadStats()
    }
    
    // Auto-refresh
    LaunchedEffect(autoRefresh, refreshInterval) {
        if (autoRefresh) {
            while (true) {
                delay(refreshInterval * 1000L)
                viewModel.refresh()
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Monitoreo de Tráfico") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text("←")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Text("↻")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Controles
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = autoRefresh,
                        onCheckedChange = { autoRefresh = it }
                    )
                    Text("Auto-actualizar")
                }
                if (autoRefresh) {
                    var expanded by remember { mutableStateOf(false) }
                    Box {
                        TextButton(onClick = { expanded = true }) {
                            Text("${refreshInterval}s")
                        }
                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("10 seg") },
                                onClick = { refreshInterval = 10; expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("30 seg") },
                                onClick = { refreshInterval = 30; expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("1 min") },
                                onClick = { refreshInterval = 60; expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("2 min") },
                                onClick = { refreshInterval = 120; expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("5 min") },
                                onClick = { refreshInterval = 300; expanded = false }
                            )
                        }
                    }
                }
            }
            
            // Estadísticas
            val currentStats = stats
            if (currentStats != null) {
                StatsCards(stats = currentStats)
            } else {
                // Mostrar placeholder si no hay estadísticas aún
                if (uiState is TrafficUiState.Success) {
                    Text(
                        text = "No hay estadísticas disponibles",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            }
            
            // Lista de tráfico
            when (uiState) {
                is TrafficUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is TrafficUiState.Error -> {
                    val errorState = uiState as TrafficUiState.Error
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Error: ${errorState.message}",
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.refresh() }) {
                                Text("Reintentar")
                            }
                        }
                    }
                }
                else -> {
                    if (traffic.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(32.dp)
                            ) {
                                Text(
                                    text = "📊",
                                    style = MaterialTheme.typography.displayMedium
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "No hay registros de tráfico",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Los datos de tráfico aparecerán aquí cuando se registren",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                    modifier = Modifier.padding(horizontal = 32.dp)
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(traffic) { item ->
                                TrafficCard(traffic = item)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatsCards(stats: com.sistemawisp.technicianapp.data.model.TrafficStats) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatCard(
            title = "Total",
            value = stats.total_clients.toString(),
            modifier = Modifier.weight(1f)
        )
        StatCard(
            title = "Conectados",
            value = stats.connected.toString(),
            modifier = Modifier.weight(1f),
            color = androidx.compose.ui.graphics.Color(0xFF27AE60)
        )
        StatCard(
            title = "Desconectados",
            value = stats.disconnected.toString(),
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.error
        )
        if (stats.problems > 0) {
            StatCard(
                title = "Problemas",
                value = stats.problems.toString(),
                modifier = Modifier.weight(1f),
                color = androidx.compose.ui.graphics.Color(0xFFF39C12)
            )
        }
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.secondary
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
fun TrafficCard(traffic: Traffic) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = traffic.client_name ?: "Cliente no asignado",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    traffic.client_number?.let {
                        Text(
                            text = "#$it",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }
                StatusBadge(status = traffic.connection_status)
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TrafficInfo(label = "Descarga", value = formatSpeed(traffic.download_speed))
                TrafficInfo(label = "Subida", value = formatSpeed(traffic.upload_speed))
                TrafficInfo(label = "Latencia", value = formatLatency(traffic.latency))
            }
            
            traffic.ip_address?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "IP: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            
            traffic.last_seen?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Última vez visto: ${formatDate(it)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val color = when (status) {
        "conectado" -> MaterialTheme.colorScheme.primary
        "desconectado" -> MaterialTheme.colorScheme.error
        "problema" -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
    }
    
    Surface(
        color = color.copy(alpha = 0.2f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = status.uppercase(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun TrafficInfo(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
    }
}

fun formatSpeed(speed: Double?): String {
    if (speed == null) return "N/A"
    return if (speed >= 1000) {
        String.format("%.2f Gbps", speed / 1000)
    } else {
        String.format("%.2f Mbps", speed)
    }
}

fun formatLatency(latency: Double?): String {
    if (latency == null) return "N/A"
    return "${latency.toInt()} ms"
}

fun formatDate(dateString: String): String {
    return try {
        val date = java.time.Instant.parse(dateString)
        val now = java.time.Instant.now()
        val diff = java.time.Duration.between(date, now)
        
        when {
            diff.seconds < 60 -> "Hace ${diff.seconds} segundos"
            diff.toMinutes() < 60 -> "Hace ${diff.toMinutes()} minutos"
            diff.toHours() < 24 -> "Hace ${diff.toHours()} horas"
            else -> date.atZone(java.time.ZoneId.systemDefault())
                .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
        }
    } catch (e: Exception) {
        dateString
    }
}

