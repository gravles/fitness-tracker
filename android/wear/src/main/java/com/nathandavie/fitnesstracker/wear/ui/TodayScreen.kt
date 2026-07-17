package com.nathandavie.fitnesstracker.wear.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.api.UnauthorizedException
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class TodaySummary(
    val caloriesRemaining: Int?,
    val proteinRemaining: Int?,
    val nextWorkout: String?,
    val nextWorkoutTime: String?,
)

private sealed interface TodayState {
    data object Loading : TodayState
    data class Loaded(val summary: TodaySummary) : TodayState
    data class Failed(val message: String) : TodayState
}

/** Glanceable summary: calories/protein remaining + next planned workout. */
@Composable
fun TodayScreen(keyStore: DeviceKeyStore, onUnpaired: () -> Unit) {
    var state by remember { mutableStateOf<TodayState>(TodayState.Loading) }
    var refresh by remember { mutableStateOf(0) }

    LaunchedEffect(refresh) {
        state = TodayState.Loading
        val key = keyStore.apiKey
        if (key == null) {
            onUnpaired()
            return@LaunchedEffect
        }
        val client = McpClient(key)
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        try {
            val profile = client.callToolObject("get_user_profile")
            val logs = client.callToolArray(
                "get_daily_logs",
                JSONObject().put("start_date", today).put("end_date", today),
            )
            val schedule = client.callToolArray("get_schedule")

            val todayLog: JSONObject? = (0 until logs.length())
                .map { logs.getJSONObject(it) }
                .firstOrNull { it.optString("date") == today }

            val targetCalories = profile.optInt("target_calories", 0)
            val targetProtein = profile.optInt("target_protein", 0)
            val eatenCalories = todayLog?.optInt("calories", 0) ?: 0
            val eatenProtein = todayLog?.optInt("protein_grams", 0) ?: 0

            val next: JSONObject? = (0 until schedule.length())
                .map { schedule.getJSONObject(it) }
                .firstOrNull { it.optString("status") == "planned" }

            state = TodayState.Loaded(
                TodaySummary(
                    caloriesRemaining = if (targetCalories > 0) targetCalories - eatenCalories else null,
                    proteinRemaining = if (targetProtein > 0) targetProtein - eatenProtein else null,
                    nextWorkout = next?.optString("title")?.ifEmpty { null },
                    nextWorkoutTime = next?.let {
                        listOf(it.optString("date"), it.optString("time"))
                            .filter { part -> part.isNotEmpty() && part != "null" }
                            .joinToString(" ")
                            .ifEmpty { null }
                    },
                ),
            )
        } catch (e: UnauthorizedException) {
            keyStore.clear()
            onUnpaired()
        } catch (e: Exception) {
            state = TodayState.Failed(e.message ?: "No connection")
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (val s = state) {
            is TodayState.Loading -> CircularProgressIndicator()

            is TodayState.Loaded -> {
                MetricRow(label = "Cals left", value = s.summary.caloriesRemaining?.toString() ?: "—")
                MetricRow(label = "Protein left", value = s.summary.proteinRemaining?.let { "${it}g" } ?: "—")

                Text(
                    text = s.summary.nextWorkout?.let { title ->
                        val time = s.summary.nextWorkoutTime
                        if (time != null) "$title\n$time" else title
                    } ?: "No workout planned",
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colors.secondary,
                    modifier = Modifier.padding(top = 10.dp),
                )
                Text(
                    text = "Tap to refresh",
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp).clickable { refresh++ },
                )
            }

            is TodayState.Failed -> {
                Text(text = s.message, style = MaterialTheme.typography.caption1, textAlign = TextAlign.Center)
                Text(
                    text = "Tap to retry",
                    style = MaterialTheme.typography.button,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.padding(top = 12.dp).clickable { refresh++ },
                )
            }
        }
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = MaterialTheme.typography.caption1)
        Text(text = value, fontSize = 20.sp, color = MaterialTheme.colors.primary)
    }
}
