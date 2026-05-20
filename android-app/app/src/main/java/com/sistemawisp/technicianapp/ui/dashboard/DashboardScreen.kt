package com.sistemawisp.technicianapp.ui.dashboard

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sistemawisp.technicianapp.data.model.DashboardStats
import com.sistemawisp.technicianapp.viewmodel.DashboardViewModel
import com.sistemawisp.technicianapp.viewmodel.DashboardUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val stats by viewModel.stats.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.loadStats()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Dashboard", 
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge
                    ) 
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                ),
                actions = {
                    IconButton(onClick = { viewModel.loadStats() }) {
                        Icon(
                            Icons.Default.Refresh, 
                            contentDescription = "Actualizar",
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        when (uiState) {
            is DashboardUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is DashboardUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = (uiState as DashboardUiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadStats() }) {
                            Text("Reintentar")
                        }
                    }
                }
            }
            else -> {
                val currentStats = stats
                if (currentStats == null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No hay datos disponibles")
                    }
                } else {
                    val statCards = getStatCards(currentStats)
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(statCards) { statCard ->
                            StatCard(statCard)
                        }
                    }
                }
            }
        }
    }
}

data class StatCardData(
    val title: String,
    val value: String,
    val icon: ImageVector,
    val color: Color
)

@Composable
fun getStatCards(stats: DashboardStats): List<StatCardData> {
    val colorScheme = MaterialTheme.colorScheme
    return listOf(
        StatCardData(
            title = "Total Clientes",
            value = stats.total_clients?.toString() ?: "0",
            icon = Icons.Default.People,
            color = Color(0xFF6366F1) // Indigo
        ),
        StatCardData(
            title = "Instalaciones",
            value = stats.total_installations?.toString() ?: "0",
            icon = Icons.Default.Build,
            color = Color(0xFF10B981) // Verde esmeralda
        ),
        StatCardData(
            title = "Ingresos Totales",
            value = "$${String.format("%.2f", stats.total_payments ?: 0.0)}",
            icon = Icons.Default.AttachMoney,
            color = Color(0xFFF59E0B) // Ámbar
        ),
        StatCardData(
            title = "Clientes Conectados",
            value = stats.connected_clients?.toString() ?: "0",
            icon = Icons.Default.NetworkCheck,
            color = Color(0xFF10B981) // Verde éxito
        ),
        StatCardData(
            title = "Clientes Desconectados",
            value = stats.disconnected_clients?.toString() ?: "0",
            icon = Icons.Default.Warning,
            color = Color(0xFFEF4444) // Rojo
        ),
        StatCardData(
            title = "Total Pagos",
            value = stats.total_payments?.let { "$${String.format("%.2f", it)}" } ?: "$0.00",
            icon = Icons.Default.Payment,
            color = Color(0xFF3B82F6) // Azul
        )
    )
}

@Composable
fun StatCard(statCard: StatCardData) {
    // Animación sutil de escala
    val infiniteTransition = rememberInfiniteTransition(label = "card_animation")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.02f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .scale(scale),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 8.dp,
            pressedElevation = 12.dp
        ),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            statCard.color.copy(alpha = 0.15f),
                            statCard.color.copy(alpha = 0.05f)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = statCard.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(statCard.color.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = statCard.icon,
                            contentDescription = statCard.title,
                            tint = statCard.color,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
                Text(
                    text = statCard.value,
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = statCard.color
                )
            }
        }
    }
}

