package com.sistemawisp.technicianapp.data.model

import com.google.gson.*
import java.lang.reflect.Type

class InstallationDeserializer : JsonDeserializer<Installation> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): Installation {
        val jsonObject = json?.asJsonObject ?: throw JsonParseException("Installation JSON is null")
        
        fun getIntOrNull(key: String): Int? {
            val element = jsonObject.get(key) ?: return null
            return if (element.isJsonNull) null else element.asInt
        }
        
        fun getStringOrNull(key: String): String? {
            val element = jsonObject.get(key) ?: return null
            return if (element.isJsonNull) null else element.asString
        }
        
        fun getDoubleOrNull(key: String): Double? {
            val element = jsonObject.get(key) ?: return null
            return if (element.isJsonNull) null else element.asDouble
        }
        
        fun getBoolean(key: String, default: Boolean = false): Boolean {
            val element = jsonObject.get(key) ?: return default
            if (element.isJsonNull) return default
            return when {
                element.isJsonPrimitive -> {
                    val primitive = element.asJsonPrimitive
                    when {
                        primitive.isBoolean -> primitive.asBoolean
                        primitive.isNumber -> primitive.asInt != 0
                        primitive.isString -> {
                            val str = primitive.asString
                            str.equals("true", ignoreCase = true) || str == "1"
                        }
                        else -> default
                    }
                }
                else -> default
            }
        }
        
        return Installation(
            id = getIntOrNull("id"),
            client_id = getIntOrNull("client_id"),
            custom_name = getStringOrNull("custom_name"),
            address = getStringOrNull("address"),
            installation_date = getStringOrNull("installation_date") ?: "",
            installation_type = getStringOrNull("installation_type") ?: "",
            status = getStringOrNull("status") ?: "pendiente",
            notes = getStringOrNull("notes"),
            installation_fee = getDoubleOrNull("installation_fee"),
            is_paid = getBoolean("is_paid", false),
            technician_name = getStringOrNull("technician_name"),
            equipment_used = getStringOrNull("equipment_used"),
            completion_date = getStringOrNull("completion_date"),
            installation_time = getIntOrNull("installation_time"),
            package_id = getIntOrNull("package_id"),
            phone = getStringOrNull("phone"),
            installation_folio = getStringOrNull("installation_folio"),
            completion_folio = getStringOrNull("completion_folio"),
            display_name = getStringOrNull("display_name"),
            display_address = getStringOrNull("display_address"),
            client_number = getStringOrNull("client_number"),
            package_name = getStringOrNull("package_name"),
            package_speed = getStringOrNull("package_speed"),
            package_price = getDoubleOrNull("package_price")
        )
    }
}

