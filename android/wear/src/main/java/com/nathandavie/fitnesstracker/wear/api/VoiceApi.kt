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

/** Sends a speech transcript to the AI intent parser. */
object VoiceApi {

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun parseTranscript(apiKey: String, transcript: String): JSONObject =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("${BuildConfig.BASE_URL}/api/ai/process-intent")
                .header("Authorization", "Bearer $apiKey")
                .post(
                    JSONObject().put("transcript", transcript).toString()
                        .toRequestBody("application/json".toMediaType()),
                )
                .build()
            http.newCall(request).execute().use { response ->
                if (response.code == 401) throw UnauthorizedException()
                val json = JSONObject(response.body!!.string())
                if (json.has("error")) throw McpToolException(json.optString("error", "Parse failed"))
                json
            }
        }
}
