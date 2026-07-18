package com.nathandavie.fitnesstracker.wear.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository
import com.nathandavie.fitnesstracker.wear.data.SessionManager
import com.nathandavie.fitnesstracker.wear.data.WorkoutOption
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand

private sealed interface PickerState {
    data object Loading : PickerState
    data class Loaded(val options: List<WorkoutOption>) : PickerState
    data class Failed(val message: String) : PickerState
}

/** Today's planned workouts first (gold), then saved templates. */
@Composable
fun WorkoutPickerScreen(keyStore: DeviceKeyStore, onStarted: () -> Unit) {
    var state by remember { mutableStateOf<PickerState>(PickerState.Loading) }
    var refresh by remember { mutableStateOf(0) }

    LaunchedEffect(refresh) {
        state = PickerState.Loading
        val key = keyStore.apiKey ?: return@LaunchedEffect
        try {
            state = PickerState.Loaded(FitnessRepository.workoutOptions(McpClient(key)))
        } catch (e: Exception) {
            state = PickerState.Failed(e.message ?: "No connection")
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            is PickerState.Loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))

            is PickerState.Loaded -> {
                if (s.options.isEmpty()) {
                    Text(
                        text = "No workouts or templates yet — create one in the app",
                        style = MaterialTheme.typography.caption1,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    )
                } else {
                    ScalingLazyColumn(modifier = Modifier.fillMaxSize()) {
                        item { ListHeader { Text("Start workout") } }
                        items(s.options) { option ->
                            val scheduled = option.scheduledWorkoutId != null
                            Chip(
                                onClick = {
                                    SessionManager.start(option)
                                    onStarted()
                                },
                                colors = ChipDefaults.chipColors(
                                    backgroundColor = if (scheduled) Brand.Gold.copy(alpha = 0.16f) else Brand.Surface,
                                    contentColor = if (scheduled) Brand.Gold else MaterialTheme.colors.onSurface,
                                ),
                                label = {
                                    Text(option.title, fontWeight = FontWeight.Bold, maxLines = 1)
                                },
                                secondaryLabel = option.subtitle?.let { sub ->
                                    { Text(sub, color = Brand.TextMuted, maxLines = 1) }
                                },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }

            is PickerState.Failed -> {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(text = s.message, style = MaterialTheme.typography.caption1, textAlign = TextAlign.Center)
                    Text(
                        text = "Tap to retry",
                        style = MaterialTheme.typography.button,
                        color = Brand.Gold,
                        modifier = Modifier.padding(top = 12.dp).clickable { refresh++ },
                    )
                }
            }
        }
    }
}
