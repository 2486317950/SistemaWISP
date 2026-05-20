package com.sistemawisp.technicianapp.data.api

import com.google.gson.TypeAdapter
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.stream.JsonWriter

class BooleanTypeAdapter : TypeAdapter<Boolean>() {
    override fun write(out: JsonWriter, value: Boolean?) {
        if (value == null) {
            out.nullValue()
        } else {
            out.value(if (value) 1 else 0)
        }
    }

    override fun read(`in`: JsonReader): Boolean? {
        return when (`in`.peek()) {
            JsonToken.NULL -> {
                `in`.nextNull()
                null
            }
            JsonToken.BOOLEAN -> `in`.nextBoolean()
            JsonToken.NUMBER -> {
                val value = `in`.nextInt()
                value != 0
            }
            JsonToken.STRING -> {
                val stringValue = `in`.nextString()
                when {
                    stringValue.equals("true", ignoreCase = true) -> true
                    stringValue.equals("1", ignoreCase = true) -> true
                    stringValue.equals("false", ignoreCase = true) -> false
                    stringValue.equals("0", ignoreCase = true) -> false
                    else -> false
                }
            }
            else -> {
                `in`.skipValue()
                null
            }
        }
    }
}












