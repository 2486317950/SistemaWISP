package com.sistemawisp.technicianapp.ui.viewer

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.sistemawisp.technicianapp.utils.TokenManager
import com.sistemawisp.technicianapp.utils.ApiConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentViewerScreen(
    documentType: String, // "contract", "receipt", "payment"
    documentId: Int,
    title: String,
    onBack: () -> Unit,
    tokenManager: TokenManager
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var htmlContent by remember { mutableStateOf<String?>(null) }
    
    val token = remember { tokenManager.getToken() ?: "" }
    val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
    
    // Obtener la URL base sin la barra final
    val baseUrl = remember { 
        ApiConfig.BASE_URL.trimEnd('/')
    }
    
    val url = remember(documentType, documentId, baseUrl) {
        "$baseUrl/api/viewer/$documentType/$documentId"
    }
    
    // Cargar el HTML con autenticación
    LaunchedEffect(url, authToken) {
        try {
            isLoading = true
            errorMessage = null
            htmlContent = null
            
            // Ejecutar la llamada de red en un hilo de fondo
            val responseBody = withContext(Dispatchers.IO) {
                val client = okhttp3.OkHttpClient()
                val request = okhttp3.Request.Builder()
                    .url(url)
                    .addHeader("Authorization", authToken)
                    .build()
                
                val response = client.newCall(request).execute()
                response.body?.string()
            }
            
            if (!responseBody.isNullOrEmpty()) {
                htmlContent = responseBody
                isLoading = false
            } else {
                errorMessage = "Error: Respuesta vacía del servidor"
                isLoading = false
            }
        } catch (e: Exception) {
            val errorMsg = e.message ?: e.javaClass.simpleName
            errorMessage = "Error al cargar: $errorMsg"
            isLoading = false
            android.util.Log.e("DocumentViewer", "Error loading document", e)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .size(24.dp)
                                .padding(16.dp)
                        )
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                errorMessage != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = "Error",
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = errorMessage ?: "Error desconocido",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { 
                            errorMessage = null
                            isLoading = true
                            htmlContent = null
                        }) {
                            Text("Reintentar")
                        }
                    }
                }
                htmlContent != null -> {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.loadWithOverviewMode = true
                                settings.useWideViewPort = true
                                settings.builtInZoomControls = true
                                settings.displayZoomControls = false
                                settings.setSupportZoom(true)
                                
                                webViewClient = object : WebViewClient() {
                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        super.onPageFinished(view, url)
                                        isLoading = false
                                    }
                                }
                                
                                // Cargar el HTML directamente
                                loadDataWithBaseURL(
                                    baseUrl,
                                    htmlContent!!,
                                    "text/html",
                                    "UTF-8",
                                    null
                                )
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}

