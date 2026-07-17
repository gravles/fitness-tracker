package com.nathandavie.fitnesstracker.wear.api

import com.nathandavie.fitnesstracker.wear.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class UnauthorizedException : Exception("API key rejected")
class McpToolException(message: String) : Exception(message)

/**
 * Minimal client for the app's MCP JSON-RPC endpoint (POST /api/mcp).
 * Tool results come back as JSON text inside result.content[0].text.
 */
class McpClient(private val apiKey: String) {

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun callTool(name: String, arguments: JSONObject = JSONObject()): String =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("jsonrpc", "2.0")
                .put("id", 1)
                .put("method", "tools/call")
                .put("params", JSONObject().put("name", name).put("arguments", arguments))

            val request = Request.Builder()
                .url("${BuildConfig.BASE_URL}/api/mcp")
                .header("Authorization", "Bearer $apiKey")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            http.newCall(request).execute().use { response ->
                if (response.code == 401) throw UnauthorizedException()
                val json = JSONObject(response.body!!.string())
                if (json.has("error")) {
                    val err = json.getJSONObject("error")
                    if (err.optInt("code") == -32001) throw UnauthorizedException()
                    throw McpToolException(err.optString("message", "RPC error"))
                }
                val result = json.getJSONObject("result")
                val text = result.getJSONArray("content").getJSONObject(0).getString("text")
                if (result.optBoolean("isError")) throw McpToolException(text)
                text
            }
        }

    suspend fun callToolObject(name: String, arguments: JSONObject = JSONObject()): JSONObject =
        JSONObject(callTool(name, arguments))

    suspend fun callToolArray(name: String, arguments: JSONObject = JSONObject()): JSONArray =
        JSONArray(callTool(name, arguments))
}
