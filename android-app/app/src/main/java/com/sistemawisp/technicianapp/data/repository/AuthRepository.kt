package com.sistemawisp.technicianapp.data.repository

import com.sistemawisp.technicianapp.data.api.AuthService
import com.sistemawisp.technicianapp.data.model.LoginRequest
import com.sistemawisp.technicianapp.data.model.LoginResponse
import com.sistemawisp.technicianapp.utils.TokenManager
import okhttp3.ResponseBody
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authService: AuthService,
    private val tokenManager: TokenManager
) {
    suspend fun login(username: String, password: String): Result<LoginResponse> {
        return try {
            val response = authService.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.token.isNotBlank()) {
                    tokenManager.saveTokenAndUser(
                        body.token,
                        body.user.username,
                        body.user.role
                    )
                }
                Result.success(body)
            } else {
                val errorMessage = when (response.code()) {
                    400 -> "Usuario y contraseña requeridos"
                    401 -> "Usuario o contraseña incorrectos"
                    403 -> "Acceso denegado"
                    404 -> "Servicio no encontrado"
                    500 -> "Error del servidor"
                    else -> {
                        try {
                            val errorBody: ResponseBody? = response.errorBody()
                            errorBody?.string() ?: "Error al iniciar sesión (Código: ${response.code()})"
                        } catch (e: IOException) {
                            "Error al iniciar sesión (Código: ${response.code()})"
                        }
                    }
                }
                Result.failure(Exception(errorMessage))
            }
        } catch (e: HttpException) {
            val errorMessage = when (e.code()) {
                400 -> "Usuario y contraseña requeridos"
                401 -> "Usuario o contraseña incorrectos"
                403 -> "Acceso denegado"
                404 -> "Servicio no encontrado"
                500 -> "Error del servidor"
                else -> "Error del servidor (Código: ${e.code()})"
            }
            Result.failure(Exception(errorMessage))
        } catch (e: java.net.UnknownHostException) {
            Result.failure(Exception("No se puede conectar al servidor. Verifica tu conexión a internet y la URL: ${com.sistemawisp.technicianapp.utils.ApiConfig.BASE_URL}"))
        } catch (e: java.net.SocketTimeoutException) {
            Result.failure(Exception("Tiempo de espera agotado. El servidor no responde."))
        } catch (e: javax.net.ssl.SSLHandshakeException) {
            Result.failure(Exception("Error de conexión segura. Verifica la URL del servidor."))
        } catch (e: IOException) {
            Result.failure(Exception("Error de conexión: ${e.message ?: "Error desconocido"}"))
        } catch (e: Exception) {
            Result.failure(Exception("Error inesperado: ${e.message ?: "Error desconocido"}"))
        }
    }
}


