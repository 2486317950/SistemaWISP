package com.sistemawisp.technicianapp.ui.navigation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sistemawisp.technicianapp.data.model.Installation
import com.sistemawisp.technicianapp.ui.admin.AdminPlaceholderScreen
import com.sistemawisp.technicianapp.ui.clients.ClientDetailScreen
import com.sistemawisp.technicianapp.ui.clients.ClientListScreen
import com.sistemawisp.technicianapp.ui.dashboard.DashboardScreen
import com.sistemawisp.technicianapp.ui.folios.NewFolioScreen
import com.sistemawisp.technicianapp.ui.payments.NewPaymentScreen
import com.sistemawisp.technicianapp.ui.viewer.DocumentViewerScreen
import com.sistemawisp.technicianapp.ui.components.AdminNavBar
import com.sistemawisp.technicianapp.ui.contracts.ContractListScreen
import com.sistemawisp.technicianapp.ui.employees.EmployeeListScreen
import com.sistemawisp.technicianapp.ui.expenses.ExpenseListScreen
import com.sistemawisp.technicianapp.ui.folios.FolioListScreen
import com.sistemawisp.technicianapp.ui.ipcredentials.IPCredentialListScreen
import com.sistemawisp.technicianapp.ui.installations.InstallationDetailScreen
import com.sistemawisp.technicianapp.ui.installations.InstallationListScreen
import com.sistemawisp.technicianapp.ui.installations.NewInstallationScreen
import com.sistemawisp.technicianapp.ui.login.LoginScreen
import com.sistemawisp.technicianapp.ui.networks.NetworkListScreen
import com.sistemawisp.technicianapp.ui.packages.PackageListScreen
import com.sistemawisp.technicianapp.ui.payments.PaymentListScreen
import com.sistemawisp.technicianapp.ui.providerpayments.ProviderPaymentListScreen
import com.sistemawisp.technicianapp.ui.quotations.QuotationListScreen
import com.sistemawisp.technicianapp.ui.receipts.ReceiptListScreen
import com.sistemawisp.technicianapp.ui.supplyinvoices.SupplyInvoiceListScreen
import com.sistemawisp.technicianapp.ui.traffic.TrafficListScreen
import com.sistemawisp.technicianapp.ui.transfers.TransferListScreen
import com.sistemawisp.technicianapp.ui.users.UserListScreen
import com.sistemawisp.technicianapp.utils.TokenManager
import com.sistemawisp.technicianapp.viewmodel.AuthViewModel
import com.sistemawisp.technicianapp.viewmodel.InstallationViewModel

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object InstallationList : Screen("installations")
    object NewInstallation : Screen("new_installation")
    object TrafficList : Screen("traffic")
    
    // Admin screens
    object Dashboard : Screen("dashboard")
    object Clients : Screen("clients")
    object ClientContract : Screen("client_contract")
    
    data class ClientDetail(val clientId: Int? = null) : Screen("client_detail/{id}") {
        companion object {
            const val routeWithArgs = "client_detail/{id}"
            fun createRoute(id: Int) = "client_detail/$id"
        }
    }
    
    data class NewPayment(val clientId: Int? = null) : Screen("new_payment/{clientId}") {
        companion object {
            const val routeWithArgs = "new_payment/{clientId}"
            fun createRoute(clientId: Int) = "new_payment/$clientId"
        }
    }
    
    data class NewFolio(val clientId: Int? = null) : Screen("new_folio/{clientId}") {
        companion object {
            const val routeWithArgs = "new_folio/{clientId}"
            fun createRoute(clientId: Int) = "new_folio/$clientId"
        }
    }
    
    data class ViewDocument(val documentType: String, val documentId: Int) : Screen("view_document/{type}/{id}") {
        companion object {
            const val routeWithArgs = "view_document/{type}/{id}"
            fun createRoute(type: String, id: Int) = "view_document/$type/$id"
        }
    }
    object Contracts : Screen("contracts")
    object Packages : Screen("packages")
    object Payments : Screen("payments")
    object ProviderPayments : Screen("provider_payments")
    object SupplyInvoices : Screen("supply_invoices")
    object Quotations : Screen("quotations")
    object Folios : Screen("folios")
    object Receipts : Screen("receipts")
    object Expenses : Screen("expenses")
    object Transfers : Screen("transfers")
    object Employees : Screen("employees")
    object IPCredentials : Screen("ip_credentials")
    object Networks : Screen("networks")
    object MonthlyReports : Screen("monthly_reports")
    object WhatsApp : Screen("whatsapp")
    object Settings : Screen("settings")
    object Users : Screen("users")
    
    data class InstallationDetail(val installationId: Int? = null) : Screen("installation_detail/{id}") {
        companion object {
            const val routeWithArgs = "installation_detail/{id}"
            fun createRoute(id: Int) = "installation_detail/$id"
        }
    }
}

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    tokenManager: TokenManager
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    var startDestination by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        startDestination = if (tokenManager.isLoggedIn()) {
            Screen.InstallationList.route
        } else {
            Screen.Login.route
        }
    }

    val handleLogout = {
        authViewModel.logout()
        navController.navigate(Screen.Login.route) {
            popUpTo(Screen.Login.route) { inclusive = true }
        }
    }

    val destination = startDestination
    if (destination == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
        return
    }

    NavHost(
        navController = navController,
        startDestination = destination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.InstallationList.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                savedUsername = tokenManager.getUsername()
            )
        }
        
        composable(Screen.InstallationList.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                InstallationListScreen(
                    onInstallationClick = { installation ->
                        val id = installation.id
                        if (id != null) {
                            try {
                                navController.navigate(Screen.InstallationDetail.createRoute(id))
                            } catch (e: Exception) {
                                // Log error if navigation fails
                                android.util.Log.e("NavGraph", "Error navigating to installation detail: ${e.message}")
                            }
                        } else {
                            android.util.Log.e("NavGraph", "Installation ID is null, cannot navigate")
                        }
                    },
                    onNewInstallationClick = {
                        navController.navigate(Screen.NewInstallation.route)
                    },
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.InstallationList.route) { inclusive = true }
                        }
                    }
                )
            }
        }
        
        composable(Screen.NewInstallation.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                NewInstallationScreen(
                    onBack = {
                        navController.popBackStack()
                    }
                )
            }
        }
        
        composable(Screen.TrafficList.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                TrafficListScreen(
                    onBack = {
                        navController.popBackStack()
                    }
                )
            }
        }
        
        composable(
            route = Screen.InstallationDetail.routeWithArgs,
            arguments = listOf(
                navArgument("id") {
                    type = NavType.IntType
                }
            )
        ) { backStackEntry ->
            val installationId = backStackEntry.arguments?.getInt("id")
            val installationViewModel: InstallationViewModel = hiltViewModel()
            val installations by installationViewModel.installations.collectAsState()
            val uiState by installationViewModel.uiState.collectAsState()
            
            // Recargar instalaciones si la lista está vacía o si no encontramos la instalación
            LaunchedEffect(installationId) {
                if (installations.isEmpty() || installations.none { it.id == installationId }) {
                    installationViewModel.loadInstallations()
                }
            }
            
            val installation = remember(installations, installationId) {
                installations.find { it.id == installationId }
            }
            
            when {
                installation != null -> {
                    InstallationDetailScreen(
                        installation = installation,
                        onBack = {
                            navController.popBackStack()
                        }
                    )
                }
                uiState is com.sistemawisp.technicianapp.viewmodel.InstallationUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                else -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Instalación no encontrada",
                                style = androidx.compose.material3.MaterialTheme.typography.bodyLarge
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { navController.popBackStack() }) {
                                Text("Volver")
                            }
                        }
                    }
                }
            }
        }
        
        // Admin screens
        composable(Screen.Dashboard.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                DashboardScreen()
            }
        }
        composable(Screen.Clients.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ClientListScreen(
                    onClientClick = { client ->
                        client.id?.let { id ->
                            navController.navigate(Screen.ClientDetail.createRoute(id))
                        }
                    }
                )
            }
        }
        
        composable(
            route = Screen.ClientDetail.routeWithArgs,
            arguments = listOf(
                navArgument("id") {
                    type = NavType.IntType
                }
            )
        ) { backStackEntry ->
            val clientId = backStackEntry.arguments?.getInt("id") ?: 0
            val clientViewModel: com.sistemawisp.technicianapp.viewmodel.ClientViewModel = hiltViewModel()
            val clientDetail by clientViewModel.clientDetail.collectAsState()
            
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ClientDetailScreen(
                    clientId = clientId,
                    onBack = {
                        navController.popBackStack()
                    },
                    onNewPayment = { id, name ->
                        navController.navigate(Screen.NewPayment.createRoute(id))
                    },
                    onNewFolio = { id, name ->
                        navController.navigate(Screen.NewFolio.createRoute(id))
                    },
                    viewModel = clientViewModel
                )
            }
        }
        
        composable(
            route = Screen.NewPayment.routeWithArgs,
            arguments = listOf(
                navArgument("clientId") {
                    type = NavType.IntType
                }
            )
        ) { backStackEntry ->
            val clientId = backStackEntry.arguments?.getInt("clientId") ?: 0
            val clientViewModel: com.sistemawisp.technicianapp.viewmodel.ClientViewModel = hiltViewModel()
            val clientDetail by clientViewModel.clientDetail.collectAsState()
            
            LaunchedEffect(clientId) {
                if (clientId > 0 && clientDetail == null) {
                    clientViewModel.loadClientDetail(clientId)
                }
            }
            
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                NewPaymentScreen(
                    clientId = if (clientId > 0) clientId else null,
                    clientName = clientDetail?.name,
                    clientNetworkType = clientDetail?.network_type,
                    onBack = {
                        navController.popBackStack()
                    },
                    onSuccess = {
                        navController.popBackStack()
                        // Recargar detalle del cliente si viene de ahí
                        if (clientId > 0) {
                            clientViewModel.loadClientDetail(clientId)
                        }
                    }
                )
            }
        }
        
        composable(
            route = Screen.NewFolio.routeWithArgs,
            arguments = listOf(
                navArgument("clientId") {
                    type = NavType.IntType
                }
            )
        ) { backStackEntry ->
            val clientId = backStackEntry.arguments?.getInt("clientId") ?: 0
            val clientViewModel: com.sistemawisp.technicianapp.viewmodel.ClientViewModel = hiltViewModel()
            val clientDetail by clientViewModel.clientDetail.collectAsState()
            
            LaunchedEffect(clientId) {
                if (clientId > 0 && clientDetail == null) {
                    clientViewModel.loadClientDetail(clientId)
                }
            }
            
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                NewFolioScreen(
                    clientId = if (clientId > 0) clientId else null,
                    clientName = clientDetail?.name,
                    onBack = {
                        navController.popBackStack()
                    },
                    onSuccess = {
                        navController.popBackStack()
                        // Recargar detalle del cliente si viene de ahí
                        if (clientId > 0) {
                            clientViewModel.loadClientDetail(clientId)
                        }
                    }
                )
            }
        }
        composable(Screen.ClientContract.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                AdminPlaceholderScreen("Contrato Cliente", "Generar contratos para clientes")
            }
        }
        composable(Screen.Contracts.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ContractListScreen(
                    onContractClick = { contract ->
                        contract.id?.let {
                            navController.navigate(Screen.ViewDocument.createRoute("contract", it))
                        }
                    }
                )
            }
        }
        composable(Screen.Packages.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                PackageListScreen()
            }
        }
        composable(Screen.Payments.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                PaymentListScreen(
                    onPaymentClick = { payment ->
                        payment.id?.let {
                            navController.navigate(Screen.ViewDocument.createRoute("payment", it))
                        }
                    },
                    onNewPayment = {
                        navController.navigate(Screen.NewPayment.createRoute(0))
                    }
                )
            }
        }
        composable(Screen.ProviderPayments.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ProviderPaymentListScreen()
            }
        }
        composable(Screen.SupplyInvoices.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                SupplyInvoiceListScreen()
            }
        }
        composable(Screen.Quotations.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                QuotationListScreen()
            }
        }
        composable(Screen.Folios.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                FolioListScreen(
                    onNewFolio = {
                        navController.navigate(Screen.NewFolio.createRoute(0))
                    }
                )
            }
        }
        composable(Screen.Receipts.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ReceiptListScreen(
                    onReceiptClick = { receipt ->
                        receipt.id?.let {
                            navController.navigate(Screen.ViewDocument.createRoute("receipt", it))
                        }
                    }
                )
            }
        }
        composable(Screen.Expenses.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                ExpenseListScreen()
            }
        }
        composable(Screen.Transfers.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                TransferListScreen()
            }
        }
        composable(Screen.Employees.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                EmployeeListScreen()
            }
        }
        composable(Screen.IPCredentials.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                IPCredentialListScreen()
            }
        }
        composable(Screen.Networks.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                NetworkListScreen()
            }
        }
        composable(Screen.MonthlyReports.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                AdminPlaceholderScreen("Reportes Mensuales", "Ver reportes mensuales")
            }
        }
        composable(Screen.WhatsApp.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                AdminPlaceholderScreen("WhatsApp", "Integración con WhatsApp")
            }
        }
        composable(Screen.Settings.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                AdminPlaceholderScreen("Configuración", "Configuración del sistema")
            }
        }
        composable(Screen.Users.route) {
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                UserListScreen()
            }
        }
        
        composable(
            route = Screen.ViewDocument.routeWithArgs,
            arguments = listOf(
                navArgument("type") { type = NavType.StringType },
                navArgument("id") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val documentType = backStackEntry.arguments?.getString("type") ?: ""
            val documentId = backStackEntry.arguments?.getInt("id") ?: 0
            
            val title = when (documentType) {
                "contract" -> "Contrato"
                "receipt" -> "Recibo"
                "payment" -> "Pago"
                else -> "Documento"
            }
            
            Column(modifier = Modifier.fillMaxSize()) {
                AdminNavBar(navController = navController, tokenManager = tokenManager, onLogout = handleLogout)
                DocumentViewerScreen(
                    documentType = documentType,
                    documentId = documentId,
                    title = title,
                    onBack = { navController.popBackStack() },
                    tokenManager = tokenManager
                )
            }
        }
    }
}

