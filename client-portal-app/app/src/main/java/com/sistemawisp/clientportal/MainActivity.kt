package com.sistemawisp.clientportal

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.webkit.CookieManager
import android.webkit.WebStorage
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var fcmToken: String? = null

    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        val resultCode = result.resultCode
        val uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        requestNotificationPermission()
        setupFCM()
        setupWebView()
        loadPortal()
        handleNotificationIntent(intent)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.addJavascriptInterface(WebAppInterface(), "Android")
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            userAgentString = "${userAgentString} SistemaWISP-ClientPortal/${BuildConfig.VERSION_NAME}"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    view?.loadUrl(url)
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@MainActivity,
                        "Error de conexión. Verifica tu internet y la URL del servidor.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: run {
                    Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "application/pdf"))
                    }
                }
                try {
                    fileChooserLauncher.launch(intent)
                    return true
                } catch (e: Exception) {
                    Log.e("PortalApp", "Error al abrir selector de archivos", e)
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    Toast.makeText(
                        this@MainActivity,
                        "No se pudo abrir el selector de archivos.",
                        Toast.LENGTH_SHORT
                    ).show()
                    return false
                }
            }
        }
    }

    private fun loadPortal() {
        val baseUrl = BuildConfig.PORTAL_URL.trimEnd('/')
        var portalUrl = "$baseUrl/portal"
        val openLink = intent?.getStringExtra("open_link")
        val portalToken = intent?.getStringExtra("portal_token")
        if (!openLink.isNullOrBlank()) {
            portalUrl = if (openLink.startsWith("http")) openLink else "$baseUrl$openLink"
        }
        if (!portalToken.isNullOrBlank()) {
            val tokenEncoded = java.net.URLEncoder.encode(portalToken, "UTF-8")
            portalUrl = if (portalUrl.contains("?")) "$portalUrl#token=$tokenEncoded" else "$portalUrl#token=$tokenEncoded"
        }
        progressBar.visibility = View.VISIBLE
        webView.loadUrl(portalUrl)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(intent: android.content.Intent?) {
        val link = intent?.getStringExtra("open_link")
        val portalToken = intent?.getStringExtra("portal_token")
        if ((!link.isNullOrBlank() || !portalToken.isNullOrBlank()) && ::webView.isInitialized) {
            val baseUrl = BuildConfig.PORTAL_URL.trimEnd('/')
            var url = if (!link.isNullOrBlank()) {
                if (link.startsWith("http")) link else "$baseUrl$link"
            } else {
                "$baseUrl/portal"
            }
            if (!portalToken.isNullOrBlank()) {
                val tokenEncoded = java.net.URLEncoder.encode(portalToken, "UTF-8")
                url = if (url.contains("?")) "$url#token=$tokenEncoded" else "$url#token=$tokenEncoded"
            }
            progressBar.visibility = View.VISIBLE
            webView.loadUrl(url)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    100
                )
            }
        }
    }

    private fun setupFCM() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                fcmToken = task.result
                Log.d("PortalApp", "FCM token: ${fcmToken?.take(20)}...")
            }
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun getFCMToken(): String = fcmToken ?: ""

        @JavascriptInterface
        fun isApp(): Boolean = true

        @JavascriptInterface
        fun getAppVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface
        fun closeApp() {
            runOnUiThread {
                try {
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript("(function(){try{localStorage.clear();sessionStorage.clear();}catch(e){}})()") { _ ->
                            runOnUiThread { doCloseApp() }
                        }
                    } else {
                        doCloseApp()
                    }
                } catch (e: Exception) {
                    Log.e("PortalApp", "Error en closeApp", e)
                    doCloseApp()
                }
            }
        }

        private fun doCloseApp() {
            clearWebViewStorage()
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    finishAndRemoveTask()
                } else {
                    finish()
                }
            } catch (e: Exception) {
                finish()
            }
        }

        private fun clearWebViewStorage() {
            try {
                webView.clearCache(true)
                webView.clearFormData()
                webView.clearHistory()
                webView.clearSslPreferences()
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
                WebStorage.getInstance().deleteAllData()
            } catch (e: Exception) {
                Log.e("PortalApp", "Error clearing WebView storage", e)
            }
        }
    }
}
