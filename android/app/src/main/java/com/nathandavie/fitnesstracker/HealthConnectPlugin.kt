package com.nathandavie.fitnesstracker

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
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
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId

/**
 * Minimal Health Connect bridge for the WebView app: availability check,
 * sleep-read permission flow, and sleep-session reads. Samsung Health syncs
 * the watch's sleep tracking into Health Connect, which is what makes this
 * the path to automatic sleep data without any extra wearable.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val permissions = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
    )
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

    /** Per-day steps (aggregated across sources) + resting heart rate. */
    @PluginMethod
    fun readDailyMetrics(call: PluginCall) {
        if (!available()) {
            call.reject("Health Connect is not available")
            return
        }
        val days = (call.getInt("days") ?: 14).coerceIn(1, 30)

        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val end = LocalDateTime.now()
                val start = end.minusDays(days.toLong()).toLocalDate().atStartOfDay()
                val byDate = LinkedHashMap<String, JSObject>()

                val buckets = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                        timeRangeSlicer = Period.ofDays(1),
                    ),
                )
                buckets.forEach { bucket ->
                    val steps = bucket.result[StepsRecord.COUNT_TOTAL] ?: return@forEach
                    val date = bucket.startTime.toLocalDate().toString()
                    byDate.getOrPut(date) { JSObject().put("date", date) }.put("steps", steps)
                }

                val rhr = client.readRecords(
                    ReadRecordsRequest(
                        recordType = RestingHeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(
                            start.atZone(ZoneId.systemDefault()).toInstant(),
                        ),
                    ),
                )
                rhr.records.forEach { r ->
                    val date = r.time.atZone(ZoneId.systemDefault()).toLocalDate().toString()
                    byDate.getOrPut(date) { JSObject().put("date", date) }
                        .put("restingHeartrate", r.beatsPerMinute)
                }

                val daysArr = JSArray()
                byDate.values.forEach { daysArr.put(it) }
                call.resolve(JSObject().put("days", daysArr))
            } catch (e: SecurityException) {
                call.reject("Steps/heart-rate read permission not granted")
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect read failed")
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
