package com.nathandavie.fitnesstracker.wear.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository
import com.nathandavie.fitnesstracker.wear.data.LoggedSet
import com.nathandavie.fitnesstracker.wear.data.SessionManager
import com.nathandavie.fitnesstracker.wear.sensors.HeartRateTracker
import com.nathandavie.fitnesstracker.wear.ui.components.CountdownRing
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand
import kotlinx.coroutines.delay

private enum class Field { REPS, WEIGHT }

private sealed interface Phase {
    data object Logging : Phase
    data class Resting(val totalSeconds: Int) : Phase
    data object Summary : Phase
    data object Saving : Phase
    data class SaveFailed(val message: String) : Phase
}

/**
 * The live session: one screen per set. Crown/bezel adjusts the highlighted
 * value (tap reps or weight to select it), the big button completes the set,
 * a full-screen gold countdown ring runs the rest with a strong buzz at zero.
 */
@Composable
fun ActiveWorkoutScreen(keyStore: DeviceKeyStore, onDone: () -> Unit) {
    val session = SessionManager.session
    if (session == null) {
        onDone()
        return
    }

    val context = LocalContext.current
    var phase by remember { mutableStateOf<Phase>(Phase.Logging) }
    var exerciseIndex by remember { mutableIntStateOf(0) }
    var reps by remember { mutableIntStateOf(session.exercises.first().planned.suggestedReps) }
    var weight by remember { mutableIntStateOf(session.exercises.first().planned.suggestedWeightLbs ?: 0) }
    var selectedField by remember { mutableStateOf(Field.REPS) }
    var restRemaining by remember { mutableIntStateOf(0) }
    var intensity by remember { mutableStateOf("Moderate") }
    var hrNow by remember { mutableStateOf<Int?>(null) }

    val tracker = remember {
        HeartRateTracker(context) { bpm ->
            session.heartRateSamples.add(bpm)
            hrNow = bpm
        }
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) tracker.start() }

    // Keep the screen on for the whole session; start/stop HR with the screen's lifecycle
    DisposableEffect(Unit) {
        val window = (context as? Activity)?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        permissionLauncher.launch(Manifest.permission.BODY_SENSORS)
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            tracker.stop()
        }
    }

    val exercise = session.exercises[exerciseIndex]
    val setNumber = exercise.sets.size + 1

    fun buzz(pattern: LongArray) {
        val vibrator = if (Build.VERSION.SDK_INT >= 31) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    }

    fun completeSet() {
        exercise.sets.add(LoggedSet(reps = reps, weightLbs = weight))
        buzz(longArrayOf(0, 40))

        val lastSetOfExercise = exercise.sets.size >= exercise.planned.targetSets
        val lastExercise = exerciseIndex == session.exercises.lastIndex
        if (lastSetOfExercise && lastExercise) {
            phase = Phase.Summary
            return
        }
        if (lastSetOfExercise) {
            exerciseIndex++
            val next = session.exercises[exerciseIndex].planned
            reps = next.suggestedReps
            weight = next.suggestedWeightLbs ?: 0
        }
        restRemaining = exercise.planned.restSeconds
        phase = Phase.Resting(exercise.planned.restSeconds)
    }

    when (val p = phase) {
        is Phase.Resting -> {
            LaunchedEffect(p) {
                while (restRemaining > 0) {
                    delay(1_000)
                    restRemaining--
                }
                buzz(longArrayOf(0, 250, 120, 250, 120, 400))
                phase = Phase.Logging
            }
            Box(modifier = Modifier.fillMaxSize().clickable { phase = Phase.Logging }) {
                CountdownRing(
                    fraction = restRemaining.toFloat() / p.totalSeconds,
                    color = Brand.Gold,
                )
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("REST", style = MaterialTheme.typography.caption2, color = Brand.TextMuted)
                    Text(
                        text = "$restRemaining",
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold,
                        color = Brand.Gold,
                    )
                    Text(
                        text = "next: ${session.exercises[exerciseIndex].planned.name}",
                        style = MaterialTheme.typography.caption2,
                        color = Brand.TextMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp),
                    )
                    hrNow?.let {
                        Text("$it bpm", style = MaterialTheme.typography.caption1, color = Brand.Blue)
                    }
                    Text(
                        text = "tap to skip",
                        style = MaterialTheme.typography.caption3,
                        color = Brand.TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }

        is Phase.Logging -> {
            val focusRequester = remember { FocusRequester() }
            LaunchedEffect(Unit) { focusRequester.requestFocus() }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .onRotaryScrollEvent { event ->
                        val step = if (event.verticalScrollPixels > 0) 1 else -1
                        when (selectedField) {
                            Field.REPS -> reps = (reps + step).coerceIn(0, 100)
                            Field.WEIGHT -> weight = (weight + step * 5).coerceIn(0, 1500)
                        }
                        true
                    }
                    .focusRequester(focusRequester)
                    .focusable()
                    .padding(horizontal = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = exercise.planned.name,
                    style = MaterialTheme.typography.caption1,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "set $setNumber/${exercise.planned.targetSets}",
                        style = MaterialTheme.typography.caption2,
                        color = Brand.TextMuted,
                    )
                    exercise.planned.repRange?.let {
                        Text(
                            text = "  ·  $it reps",
                            style = MaterialTheme.typography.caption2,
                            color = Brand.TextMuted,
                        )
                    }
                    hrNow?.let {
                        Text(
                            text = "  ·  $it bpm",
                            style = MaterialTheme.typography.caption2,
                            color = Brand.Blue,
                        )
                    }
                }

                exercise.planned.lastWeightLbs?.let { lw ->
                    val increase = exercise.planned.progression == "increase"
                    Text(
                        text = if (increase) {
                            "$lw → ${exercise.planned.suggestedWeightLbs} lbs, you earned it"
                        } else {
                            "last: $lw × ${exercise.planned.lastReps.joinToString("·")}"
                        },
                        style = MaterialTheme.typography.caption2,
                        color = if (increase) Brand.Gold else Brand.TextMuted,
                        maxLines = 1,
                    )
                }

                ValueRow(
                    label = "reps",
                    value = "$reps",
                    selected = selectedField == Field.REPS,
                    accent = Brand.Gold,
                    onSelect = { selectedField = Field.REPS },
                    onMinus = { reps = (reps - 1).coerceAtLeast(0) },
                    onPlus = { reps = (reps + 1).coerceAtMost(100) },
                )
                ValueRow(
                    label = "lbs",
                    value = if (weight == 0) "BW" else "$weight",
                    selected = selectedField == Field.WEIGHT,
                    accent = Brand.Blue,
                    onSelect = { selectedField = Field.WEIGHT },
                    onMinus = { weight = (weight - 5).coerceAtLeast(0) },
                    onPlus = { weight = (weight + 5).coerceAtMost(1500) },
                )

                Button(
                    onClick = { completeSet() },
                    colors = ButtonDefaults.buttonColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                    modifier = Modifier.padding(top = 8.dp).size(44.dp),
                ) {
                    Text("✓", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }

                Text(
                    text = "finish workout",
                    style = MaterialTheme.typography.caption3,
                    color = Brand.TextMuted,
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .clickable { if (session.totalSetsLogged > 0) phase = Phase.Summary },
                )
            }
        }

        is Phase.Summary -> {
            Column(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(session.title, style = MaterialTheme.typography.caption1, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(
                    text = "${session.totalSetsLogged} sets · ${session.elapsedMinutes()} min" +
                        (session.heartRateSamples.maxOrNull()?.let { " · $it bpm max" } ?: ""),
                    style = MaterialTheme.typography.caption2,
                    color = Brand.TextMuted,
                )
                Row(
                    modifier = Modifier.padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    listOf("Light", "Moderate", "Hard").forEach { level ->
                        Chip(
                            onClick = { intensity = level },
                            colors = ChipDefaults.chipColors(
                                backgroundColor = if (intensity == level) Brand.Gold else Brand.Surface,
                                contentColor = if (intensity == level) Brand.Navy else Brand.TextMuted,
                            ),
                            label = { Text(level.take(3), style = MaterialTheme.typography.caption2) },
                        )
                    }
                }
                Button(
                    onClick = { phase = Phase.Saving },
                    colors = ButtonDefaults.buttonColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                ) {
                    Text("Save", fontWeight = FontWeight.Bold)
                }
            }
        }

        is Phase.Saving -> {
            LaunchedEffect(Unit) {
                val key = keyStore.apiKey
                if (key == null) {
                    onDone()
                    return@LaunchedEffect
                }
                try {
                    FitnessRepository.logWorkout(McpClient(key), session, intensity)
                    buzz(longArrayOf(0, 60, 60, 60))
                    SessionManager.clear()
                    onDone()
                } catch (e: Exception) {
                    phase = Phase.SaveFailed(e.message ?: "No connection")
                }
            }
            Box(modifier = Modifier.fillMaxSize()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
        }

        is Phase.SaveFailed -> {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = "Save failed: ${p.message}",
                    style = MaterialTheme.typography.caption2,
                    textAlign = TextAlign.Center,
                    maxLines = 3,
                )
                Chip(
                    onClick = { phase = Phase.Saving },
                    colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                    label = { Text("Retry", fontWeight = FontWeight.Bold) },
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
        }
    }
}

@Composable
private fun ValueRow(
    label: String,
    value: String,
    selected: Boolean,
    accent: Color,
    onSelect: () -> Unit,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundIconButton("−", onMinus)
        Column(
            modifier = Modifier
                .padding(horizontal = 10.dp)
                .clickable { onSelect() }
                .then(
                    if (selected) Modifier.border(1.5.dp, accent, CircleShape).padding(horizontal = 14.dp, vertical = 2.dp)
                    else Modifier.padding(horizontal = 14.dp, vertical = 2.dp),
                ),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = value, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = if (selected) accent else MaterialTheme.colors.onSurface)
            Text(text = label, style = MaterialTheme.typography.caption3, color = Brand.TextMuted)
        }
        RoundIconButton("+", onPlus)
    }
}

@Composable
private fun RoundIconButton(symbol: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(backgroundColor = Brand.Surface, contentColor = MaterialTheme.colors.onSurface),
        modifier = Modifier.size(38.dp),
    ) {
        Text(symbol, fontSize = 20.sp)
    }
}
