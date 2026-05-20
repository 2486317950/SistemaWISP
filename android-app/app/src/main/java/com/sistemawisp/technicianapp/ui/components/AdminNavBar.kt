package com.sistemawisp.technicianapp.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.sistemawisp.technicianapp.utils.TokenManager

data class NavMenuItem(
    val route: String,
    val label: String,
    val icon: ImageVector
)

@Composable
fun AdminNavBar(
    navController: NavController,
    tokenManager: TokenManager,
    onLogout: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val userRole = remember { tokenManager.getRole() }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    
    // Solo mostrar si es admin
    if (userRole != "admin") {
        return
    }
    
    var showLogoutDialog by remember { mutableStateOf(false) }
    
    var expanded by remember { mutableStateOf(false) }
    
    // Organizar menú por categorías para mejor UX
    val menuCategories = mapOf(
        "Principal" to listOf(
            NavMenuItem("dashboard", "Dashboard", Icons.Default.Dashboard),
            NavMenuItem("clients", "Clientes", Icons.Default.People),
            NavMenuItem("installations", "Instalaciones", Icons.Default.Build),
            NavMenuItem("traffic", "Tráfico", Icons.Default.NetworkCheck)
        ),
        "Contratos y Documentos" to listOf(
            NavMenuItem("client_contract", "Contrato Cliente", Icons.Default.Description),
            NavMenuItem("contracts", "Contratos Guardados", Icons.Default.Folder),
            NavMenuItem("quotations", "Cotizaciones", Icons.Default.EditNote),
            NavMenuItem("folios", "Folios", Icons.Default.List)
        ),
        "Finanzas" to listOf(
            NavMenuItem("payments", "Pagos", Icons.Default.Payment),
            NavMenuItem("provider_payments", "Pago Proveedores", Icons.Default.AccountBalance),
            NavMenuItem("supply_invoices", "Facturas de Insumos", Icons.Default.Receipt),
            NavMenuItem("receipts", "Recibos", Icons.Default.ReceiptLong),
            NavMenuItem("expenses", "Gastos", Icons.Default.TrendingDown),
            NavMenuItem("transfers", "Transferencias", Icons.Default.SwapHoriz)
        ),
        "Configuración" to listOf(
            NavMenuItem("packages", "Paquetes", Icons.Default.Inventory),
            NavMenuItem("networks", "Redes", Icons.Default.Router),
            NavMenuItem("ip_credentials", "IPs y Contraseñas", Icons.Default.Lock),
            NavMenuItem("employees", "Empleados", Icons.Default.Badge),
            NavMenuItem("users", "Usuarios", Icons.Default.Person),
            NavMenuItem("settings", "Configuración", Icons.Default.Settings)
        ),
        "Reportes y Comunicación" to listOf(
            NavMenuItem("monthly_reports", "Reportes Mensuales", Icons.Default.Assessment),
            NavMenuItem("whatsapp", "WhatsApp", Icons.Default.Chat)
        )
    )
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column {
            // Header mejorado con gradiente
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.secondary
                            )
                        )
                    )
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "🌐 Sistema WISP",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Text(
                            text = "Menú de Administración",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f)
                        )
                    }
                    Icon(
                        imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (expanded) "Colapsar" else "Expandir",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            // Botón de cerrar sesión en el header (siempre visible)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Cerrar Sesión",
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Cerrar Sesión")
                }
            }
            
            // Diálogo de confirmación de logout
            if (showLogoutDialog) {
                AlertDialog(
                    onDismissRequest = { showLogoutDialog = false },
                    title = { Text("Cerrar Sesión") },
                    text = { Text("¿Estás seguro de que deseas cerrar sesión?") },
                    confirmButton = {
                        TextButton(
                            onClick = {
                                showLogoutDialog = false
                                onLogout()
                            },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            )
                        ) {
                            Text("Cerrar Sesión")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showLogoutDialog = false }) {
                            Text("Cancelar")
                        }
                    }
                )
            }
            
            // Menú expandible con animación suave
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 500.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 8.dp)
                ) {
                    menuCategories.forEach { (category, items) ->
                        // Título de categoría con mejor estilo
                        Text(
                            text = category,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                        
                        // Items de la categoría
                        items.forEach { item ->
                            NavigationMenuItem(
                                item = item,
                                isSelected = currentRoute == item.route,
                                onClick = {
                                    try {
                                        android.util.Log.d("AdminNavBar", "Navegando a: ${item.route}")
                                        navController.navigate(item.route) {
                                            launchSingleTop = true
                                        }
                                        expanded = false
                                    } catch (e: Exception) {
                                        android.util.Log.e("AdminNavBar", "Error navegando a ${item.route}: ${e.message}", e)
                                    }
                                }
                            )
                        }
                        
                        // Separador entre categorías
                        if (category != menuCategories.keys.last()) {
                            Divider(
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                thickness = 1.dp,
                                color = MaterialTheme.colorScheme.outlineVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NavigationMenuItem(
    item: NavMenuItem,
    isSelected: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = if (isSelected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surface
    }
    
    val contentColor = if (isSelected) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    
    Surface(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp)),
        color = backgroundColor,
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = item.label,
                modifier = Modifier.size(26.dp),
                tint = if (isSelected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                }
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = item.label,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                color = contentColor,
                modifier = Modifier.weight(1f)
            )
            if (isSelected) {
                Spacer(modifier = Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Seleccionado",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
