package com.sistemawisp.technicianapp.utils

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private const val PREFS_NAME = "sistemawisp_technician_auth"
private const val KEY_AUTH_TOKEN = "auth_token"
private const val KEY_USERNAME = "username"
private const val KEY_ROLE = "role"

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    fun saveToken(token: String) {
        if (token.isBlank()) return
        prefs.edit().putString(KEY_AUTH_TOKEN, token).commit()
    }

    fun saveTokenAndUser(token: String, username: String, role: String) {
        if (token.isBlank()) return
        prefs.edit()
            .putString(KEY_AUTH_TOKEN, token)
            .putString(KEY_USERNAME, username)
            .putString(KEY_ROLE, role)
            .commit()
    }

    fun getToken(): String? {
        return prefs.getString(KEY_AUTH_TOKEN, null)?.takeIf { it.isNotBlank() }
    }

    fun clearToken() {
        prefs.edit().remove(KEY_AUTH_TOKEN).commit()
    }

    fun saveUser(username: String, role: String) {
        prefs.edit()
            .putString(KEY_USERNAME, username)
            .putString(KEY_ROLE, role)
            .commit()
    }

    fun getUsername(): String? {
        return prefs.getString(KEY_USERNAME, null)
    }

    fun getRole(): String? {
        return prefs.getString(KEY_ROLE, null)
    }

    fun clearUser() {
        prefs.edit()
            .remove(KEY_USERNAME)
            .remove(KEY_ROLE)
            .commit()
    }

    fun isLoggedIn(): Boolean {
        return getToken()?.isNotBlank() == true
    }
}













