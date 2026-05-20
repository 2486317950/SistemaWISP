package com.sistemawisp.clientportal

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Verifica si hay actualizaciones disponibles y redirige a la Play Store para actualizar.
 * Las actualizaciones se publican en Play Store; no se descargan ni instalan APK desde la app.
 */
class AppUpdateManager(private val activity: Activity) {

    private val executor = Executors.newSingleThreadExecutor()

    private val playStorePackageUri = "market://details?id=${BuildConfig.APPLICATION_ID}"
    private val playStoreWebUri = "https://play.google.com/store/apps/details?id=${BuildConfig.APPLICATION_ID}"

    fun checkForUpdate() {
        executor.execute {
            try {
                val baseUrl = BuildConfig.PORTAL_URL.trimEnd('/')
                val url = URL("$baseUrl/api/app-versions/latest")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                conn.connect()

                if (conn.responseCode != 200) return@execute
                val body = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val json = JSONObject(body)
                if (!json.optBoolean("hasUpdate", false)) return@execute

                val serverVersionCode = json.optInt("version_code", 0)
                val currentVersionCode = BuildConfig.VERSION_CODE
                if (serverVersionCode <= currentVersionCode) return@execute

                val versionName = json.optString("version_name", "")
                val releaseNotes = json.optString("release_notes", "")

                activity.runOnUiThread {
                    showUpdateDialog(versionName, releaseNotes)
                }
            } catch (e: Exception) {
                Log.e("AppUpdate", "Error checking update", e)
            }
        }
    }

    private fun showUpdateDialog(versionName: String, releaseNotes: String) {
        val message = buildString {
            append("Nueva versión disponible: $versionName\n\n")
            if (releaseNotes.isNotBlank()) append("$releaseNotes\n\n")
            append("Actualiza desde la Play Store para obtener la última versión.")
        }

        android.app.AlertDialog.Builder(activity)
            .setTitle("Actualización disponible")
            .setMessage(message)
            .setPositiveButton("Ir a Play Store") { _, _ ->
                openPlayStore()
            }
            .setNegativeButton("Ahora no", null)
            .show()
    }

    private fun openPlayStore() {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(playStorePackageUri)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
        } catch (_: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse(playStoreWebUri)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                Log.e("AppUpdate", "No se pudo abrir Play Store", e)
            }
        }
    }
}
