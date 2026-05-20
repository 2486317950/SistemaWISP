package com.sistemawisp.technicianapp.data.model

data class LoginResponse(
    val token: String,
    val user: LoginUser
)

data class LoginUser(
    val id: Int,
    val username: String,
    val role: String
)










