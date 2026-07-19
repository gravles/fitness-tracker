package com.nathandavie.fitnesstracker

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

/**
 * Minimal Health Connect bridge for the WebView app: availability check,
 * sleep-read permission flow, and sleep-session reads. Samsung Health syncs
 * the watch's sleep tracking into Health Connect, which is what makes this
 * the path to automatic sleep data without any extra wearable.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val permissions = setOf(HealthPermission.getReadPermission(SleepSessionRecord::class))
    private val scope = CoroutineScope(Dispatchers.IO)

    private fun available(): Boolean =
        HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(JSObject().put("available", available()))
    }

    @PluginMethod
    fun hasPermissions(call: PluginCall) {
        if (!available()) {
            call.resolve(JSObject().put("granted", false))
            return
        }
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context)
                    .permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(permissions)))
            } catch (e: Exception) {
                call.resolve(JSObject().put("granted", false))
            }
        }
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        if (!available()) {
            call.reject("Health Connect is not available on this device")
            return
        }
        val contract = PermissionController.createRequestPermissionResultContract()
        val intent: Intent = contract.createIntent(context, permissions)
        startActivityForResult(call, intent, "permissionsCallback")
    }

    @ActivityCallback
    private fun permissionsCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        // The contract's parseResult needs the raw intent; fall back to re-checking
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context)
                    .permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(permissions)))
            } catch (e: Exception) {
                call.resolve(JSObject().put("granted", false))
            }
        }
    }

    @PluginMethod
    fun readSleepSessions(call: PluginCall) {
        if (!available()) {
            call.reject("Health Connect is not available")
            return
        }
        val sinceIso = call.getString("since")
        val since = try {
            if (sinceIso != null) Instant.parse(sinceIso) else Instant.now().minus(Duration.ofDays(14))
        } catch (e: Exception) {
            Instant.now().minus(Duration.ofDays(14))
        }

        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(since),
                    ),
                )
                val sessions = JSArray()
                response.records.forEach { r ->
                    fun stageMinutes(vararg types: Int): Long = r.stages
                        .filter { it.stage in types }
                        .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }

                    sessions.put(
                        JSObject()
                            .put("id", r.metadata.id)
                            .put("start", r.startTime.toString())
                            .put("end", r.endTime.toString())
                            .put("durationMinutes", Duration.between(r.startTime, r.endTime).toMinutes())
                            .put("deepMinutes", stageMinutes(SleepSessionRecord.STAGE_TYPE_DEEP))
                            .put("remMinutes", stageMinutes(SleepSessionRecord.STAGE_TYPE_REM))
                            .put("lightMinutes", stageMinutes(SleepSessionRecord.STAGE_TYPE_LIGHT))
                            .put(
                                "awakeMinutes",
                                stageMinutes(
                                    SleepSessionRecord.STAGE_TYPE_AWAKE,
                                    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
                                    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
                                ),
                            ),
                    )
                }
                call.resolve(JSObject().put("sessions", sessions))
            } catch (e: SecurityException) {
                call.reject("Sleep read permission not granted")
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect read failed")
            }
        }
    }
}
