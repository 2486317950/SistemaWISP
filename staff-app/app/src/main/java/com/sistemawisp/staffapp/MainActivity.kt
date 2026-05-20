package com.sistemawisp.staffapp

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging
import android.Manifest

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_OPEN_PATH = "open_path"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var fcmTokenCache: String = ""
    private var notificationPermissionAsked = false
    var pendingSessionRestore = false
        private set

    private val sessionPrefs by lazy {
        getSharedPreferences("staff_session", Context.MODE_PRIVATE)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (task.isSuccessful) task.result?.let { fcmTokenCache = it }
        })

        setupWebView()
        val openPath = intent?.getStringExtra(EXTRA_OPEN_PATH)
        if (!openPath.isNullOrEmpty()) {
            val baseUrl = BuildConfig.BASE_URL.trimEnd('/')
            progressBar.visibility = View.VISIBLE
            webView.loadUrl("$baseUrl$openPath")
        } else {
            loadStaffPanelOrRestoreSession()
        }

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
            userAgentString = "${userAgentString} SistemaWISP-StaffApp/${BuildConfig.VERSION_NAME}"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(StaffAppBridge(this@MainActivity), "Android")

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
                if (this@MainActivity.pendingSessionRestore && view != null) {
                    this@MainActivity.injectStoredSessionAndGoHome(view)
                }
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

        webView.webChromeClient = WebChromeClient()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(EXTRA_OPEN_PATH)?.let { path ->
            if (path.isNotEmpty()) {
                val baseUrl = BuildConfig.BASE_URL.trimEnd('/')
                progressBar.visibility = View.VISIBLE
                webView.loadUrl("$baseUrl$path")
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (!notificationPermissionAsked) {
            notificationPermissionAsked = true
            requestNotificationPermission()
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    100
                )
            }
        }
    }

    private fun loadStaffPanelOrRestoreSession() {
        val baseUrl = BuildConfig.BASE_URL.trimEnd('/')
        val storedToken = sessionPrefs.getString("token", null)
        if (!storedToken.isNullOrBlank()) {
            pendingSessionRestore = true
            progressBar.visibility = View.VISIBLE
            webView.loadUrl("$baseUrl/login")
        } else {
            loadStaffPanel()
        }
    }

    private fun loadStaffPanel() {
        val baseUrl = BuildConfig.BASE_URL.trimEnd('/')
        val loginUrl = "$baseUrl/login"
        progressBar.visibility = View.VISIBLE
        webView.loadUrl(loginUrl)
    }

    fun getFcmToken(): String = fcmTokenCache

    fun saveSessionToken(token: String?) {
        if (token.isNullOrBlank()) {
            sessionPrefs.edit().remove("token").apply()
        } else {
            sessionPrefs.edit().putString("token", token).apply()
        }
    }

    fun clearSessionToken() {
        sessionPrefs.edit().remove("token").apply()
    }

    fun getStoredSessionToken(): String? = sessionPrefs.getString("token", null)?.takeIf { it.isNotBlank() }

    fun injectStoredSessionAndGoHome(view: WebView) {
        pendingSessionRestore = false
        val token = getStoredSessionToken() ?: return
        val escaped = token.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "").replace("\n", "\\n")
        view.evaluateJavascript(
            "localStorage.setItem('token', '$escaped'); window.location.href = '/';",
            null
        )
    }
}

class StaffAppBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun isApp(): Boolean = true

    @JavascriptInterface
    fun getFCMToken(): String = activity.getFcmToken()

    @JavascriptInterface
    fun saveSessionToken(token: String?) {
        activity.saveSessionToken(token)
    }

    @JavascriptInterface
    fun clearSessionToken() {
        activity.clearSessionToken()
    }

    @JavascriptInterface
    fun hasStoredSession(): Boolean = activity.getStoredSessionToken() != null
}
