package com.sistemawisp.technicianapp.data.model

import com.google.gson.*
import com.google.gson.reflect.TypeToken
import java.lang.reflect.Type

class PaymentDeserializer : JsonDeserializer<Payment> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): Payment {
        val jsonObject = json?.asJsonObject ?: throw JsonParseException("Payment JSON is null")
        
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
        
        fun getBooleanOrNull(key: String): Boolean? {
            val element = jsonObject.get(key) ?: return null
            if (element.isJsonNull) return null
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
                        else -> null
                    }
                }
                else -> null
            }
        }
        
        return Payment(
            id = getIntOrNull("id"),
            client_id = getIntOrNull("client_id"),
            client_name = getStringOrNull("client_name"),
            client_number = getStringOrNull("client_number"),
            client_address = getStringOrNull("client_address"),
            display_name = getStringOrNull("display_name"),
            display_address = getStringOrNull("display_address"),
            amount = getDoubleOrNull("amount") ?: 0.0,
            payment_date = getStringOrNull("payment_date") ?: "",
            payment_method = getStringOrNull("payment_method"),
            payment_type = getStringOrNull("payment_type"),
            receipt_number = getStringOrNull("receipt_number"),
            is_free_month = getBooleanOrNull("is_free_month"),
            notes = getStringOrNull("notes"),
            created_at = getStringOrNull("created_at")
        )
    }
}

