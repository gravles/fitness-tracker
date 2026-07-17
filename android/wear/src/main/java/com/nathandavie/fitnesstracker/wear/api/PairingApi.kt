package com.nathandavie.fitnesstracker.wear.api

import com.nathandavie.fitnesstracker.wear.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object PairingApi {

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private suspend fun post(path: String, body: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("${BuildConfig.BASE_URL}$path")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(request).execute().use { response ->
                JSONObject(response.body!!.string())
            }
        }

    /** Register the device's key hash; returns the 6-char code to show the user. */
    suspend fun start(keyHash: String, deviceName: String): String {
        val json = post(
            "/api/pair/start",
            JSONObject().put("key_hash", keyHash).put("device_name", deviceName),
        )
        return json.optString("code").ifEmpty {
            throw Exception(json.optString("error", "Pairing failed"))
        }
    }

    /** One of: pending | claimed | expired */
    suspend fun poll(code: String): String =
        post("/api/pair/poll", JSONObject().put("code", code)).optString("status", "expired")
}
