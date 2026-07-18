package com.nathandavie.fitnesstracker.wear.ui

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.api.VoiceApi
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository
import com.nathandavie.fitnesstracker.wear.speech.SpeechCapture
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand
import kotlinx.coroutines.delay
import org.json.JSONObject

private data class FoodItem(
    val name: String,
    val calories: Int,
    val protein: Int,
    val carbs: Int,
    val fat: Int,
)

private sealed interface VoiceState {
    data object Listening : VoiceState
    data class Processing(val transcript: String) : VoiceState
    data class Confirm(val items: List<FoodItem>) : VoiceState
    data class Logging(val items: List<FoodItem>) : VoiceState
    data class NotFood(val transcript: String) : VoiceState
    data object Done : VoiceState
    data class Failed(val message: String) : VoiceState
}

/**
 * Speak → AI parses and estimates macros → confirm card → log_food per item.
 * Capture happens in-app via SpeechRecognizer (pulsing indicator + live
 * transcript — no Google system speech activity); the system sheet remains
 * only as a fallback when no recognition service is available.
 */
@Composable
fun VoiceFoodScreen(keyStore: DeviceKeyStore, onDone: () -> Unit) {
    val context = LocalContext.current
    var state by remember { mutableStateOf<VoiceState>(VoiceState.Listening) }
    var attempt by remember { mutableIntStateOf(0) }
    var partial by remember { mutableStateOf("") }
    var level by remember { mutableFloatStateOf(0f) }

    val capture = remember {
        SpeechCapture(
            context,
            onPartial = { partial = it },
            onFinal = { state = VoiceState.Processing(it) },
            onLevel = { level = it },
            onError = { msg -> state = VoiceState.Failed(msg) },
        )
    }
    DisposableEffect(Unit) {
        onDispose { capture.destroy() }
    }

    // Fallback: the system speech sheet, only if no in-app recognition service exists
    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val spoken = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
        if (result.resultCode != Activity.RESULT_OK || spoken.isNullOrBlank()) {
            onDone()
        } else {
            state = VoiceState.Processing(spoken)
        }
    }

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) attempt++
        else state = VoiceState.Failed("Microphone permission needed")
    }

    LaunchedEffect(attempt) {
        partial = ""
        when {
            !SpeechCapture.isAvailable(context) -> {
                speechLauncher.launch(
                    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        .putExtra(RecognizerIntent.EXTRA_PROMPT, "What did you eat?"),
                )
            }
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED -> {
                state = VoiceState.Listening
                capture.start()
            }
            else -> micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    LaunchedEffect(state) {
        when (val s = state) {
            is VoiceState.Processing -> {
                val key = keyStore.apiKey ?: run { onDone(); return@LaunchedEffect }
                state = try {
                    val parsed = VoiceApi.parseTranscript(key, s.transcript)
                    val items = parseFoodItems(parsed)
                    if (items.isEmpty()) VoiceState.NotFood(s.transcript) else VoiceState.Confirm(items)
                } catch (e: Exception) {
                    VoiceState.Failed(e.message ?: "No connection")
                }
            }

            is VoiceState.Logging -> {
                val key = keyStore.apiKey ?: run { onDone(); return@LaunchedEffect }
                state = try {
                    val client = McpClient(key)
                    s.items.forEach { item ->
                        val args = JSONObject()
                            .put("name", item.name)
                            .put("calories", item.calories)
                            .put("date", FitnessRepository.today())
                        if (item.protein > 0) args.put("protein", item.protein)
                        if (item.carbs > 0) args.put("carbs", item.carbs)
                        if (item.fat > 0) args.put("fat", item.fat)
                        client.callToolObject("log_food", args)
                    }
                    VoiceState.Done
                } catch (e: Exception) {
                    VoiceState.Failed(e.message ?: "No connection")
                }
            }

            is VoiceState.Done -> {
                delay(900)
                onDone()
            }

            else -> Unit
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            is VoiceState.Listening -> {
                val pulse by animateFloatAsState(
                    targetValue = 1f + (level.coerceIn(0f, 10f) / 10f) * 0.4f,
                    animationSpec = tween(120),
                    label = "pulse",
                )
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable { capture.destroy(); onDone() }
                        .padding(horizontal = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .scale(pulse)
                            .clip(CircleShape)
                            .background(Brand.Gold.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(Brand.Gold),
                        )
                    }
                    Text(
                        text = partial.ifEmpty { "What did you eat?" },
                        style = MaterialTheme.typography.caption1,
                        color = if (partial.isEmpty()) Brand.TextMuted else MaterialTheme.colors.onSurface,
                        textAlign = TextAlign.Center,
                        maxLines = 3,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    Text(
                        text = "tap to cancel",
                        style = MaterialTheme.typography.caption3,
                        color = Brand.TextMuted,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }

            is VoiceState.Processing, is VoiceState.Logging -> {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                    if (s is VoiceState.Processing) {
                        Text(
                            text = "Estimating macros…",
                            style = MaterialTheme.typography.caption2,
                            color = Brand.TextMuted,
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }

            is VoiceState.Confirm -> {
                ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
                    item { ListHeader { Text("Log food?") } }
                    items(s.items) { item ->
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 3.dp),
                        ) {
                            Text(item.name, style = MaterialTheme.typography.caption1, fontWeight = FontWeight.Bold, maxLines = 2)
                            Text(
                                text = "${item.calories} kcal · ${item.protein}p ${item.carbs}c ${item.fat}f",
                                style = MaterialTheme.typography.caption2,
                                color = Brand.TextMuted,
                            )
                        }
                    }
                    item {
                        Text(
                            text = "${s.items.sumOf { it.calories }} kcal total",
                            style = MaterialTheme.typography.caption1,
                            color = Brand.Gold,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    item {
                        Chip(
                            onClick = { state = VoiceState.Logging(s.items) },
                            colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                            label = { Text("Log it", fontWeight = FontWeight.Bold) },
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                    item {
                        Text(
                            text = "retry",
                            style = MaterialTheme.typography.caption2,
                            color = Brand.TextMuted,
                            modifier = Modifier.padding(top = 6.dp, bottom = 12.dp).clickable { attempt++ },
                        )
                    }
                }
            }

            is VoiceState.NotFood -> {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(horizontal = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "Didn't catch a food in:\n“${s.transcript}”",
                        style = MaterialTheme.typography.caption2,
                        textAlign = TextAlign.Center,
                        maxLines = 4,
                    )
                    Chip(
                        onClick = { attempt++ },
                        colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                        label = { Text("Try again", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }

            is VoiceState.Done -> {
                Text(
                    text = "Logged",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Brand.Gold,
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            is VoiceState.Failed -> {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(text = s.message, style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, maxLines = 3)
                    Chip(
                        onClick = { attempt++ },
                        colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                        label = { Text("Retry", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }
    }
}

private fun parseFoodItems(parsed: JSONObject): List<FoodItem> {
    if (parsed.optString("intent") != "log_food") return emptyList()
    val itemsJson = parsed.optJSONObject("data")?.optJSONArray("items") ?: return emptyList()
    return (0 until itemsJson.length()).mapNotNull { i ->
        val o = itemsJson.getJSONObject(i)
        val name = o.optString("name").takeIf { it.isNotBlank() } ?: return@mapNotNull null
        FoodItem(
            name = name,
            calories = o.optInt("calories", 0),
            protein = o.optInt("protein", 0),
            carbs = o.optInt("carbs", 0),
            fat = o.optInt("fat", 0),
        )
    }
}
