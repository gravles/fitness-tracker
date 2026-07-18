package com.nathandavie.fitnesstracker.wear.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
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
import com.nathandavie.fitnesstracker.wear.tile.TileRefresher
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand

private enum class CheckInField { SLEEP, ENERGY, DRINKS }

private sealed interface CheckInState {
    data object Loading : CheckInState
    data object Editing : CheckInState
    data object Saving : CheckInState
    data class Failed(val message: String) : CheckInState
}

/**
 * Morning check-in: sleep quality and energy (1–5, today) plus drinks last
 * night (yesterday's log — only written if touched, so an evening entry is
 * never clobbered). These are exactly the readiness inputs.
 */
@Composable
fun CheckInScreen(keyStore: DeviceKeyStore, onDone: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var state by remember { mutableStateOf<CheckInState>(CheckInState.Loading) }
    var sleep by remember { mutableIntStateOf(3) }
    var energy by remember { mutableIntStateOf(3) }
    var drinks by remember { mutableIntStateOf(0) }
    var drinksTouched by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(CheckInField.SLEEP) }
    var saveAttempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        val key = keyStore.apiKey ?: run { onDone(); return@LaunchedEffect }
        try {
            val prefill = FitnessRepository.checkInPrefill(McpClient(key))
            prefill.sleep?.let { sleep = it }
            prefill.energy?.let { energy = it }
            prefill.yesterdayDrinks?.let { drinks = it }
        } catch (_: Exception) {
            // Defaults are fine — check-in must work offline-ish
        }
        state = CheckInState.Editing
    }

    LaunchedEffect(saveAttempt) {
        if (saveAttempt == 0) return@LaunchedEffect
        state = CheckInState.Saving
        val key = keyStore.apiKey ?: run { onDone(); return@LaunchedEffect }
        try {
            FitnessRepository.saveCheckIn(McpClient(key), sleep, energy, if (drinksTouched) drinks else null)
            TileRefresher.refresh(context)
            onDone()
        } catch (e: Exception) {
            state = CheckInState.Failed(e.message ?: "No connection")
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            is CheckInState.Loading, is CheckInState.Saving ->
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))

            is CheckInState.Editing -> {
                val focusRequester = remember { FocusRequester() }
                LaunchedEffect(Unit) { focusRequester.requestFocus() }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .onRotaryScrollEvent { event ->
                            val step = if (event.verticalScrollPixels > 0) 1 else -1
                            when (selected) {
                                CheckInField.SLEEP -> sleep = (sleep + step).coerceIn(1, 5)
                                CheckInField.ENERGY -> energy = (energy + step).coerceIn(1, 5)
                                CheckInField.DRINKS -> {
                                    drinks = (drinks + step).coerceIn(0, 15)
                                    drinksTouched = true
                                }
                            }
                            true
                        }
                        .focusRequester(focusRequester)
                        .focusable()
                        .padding(horizontal = 18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = "Morning check-in",
                        style = MaterialTheme.typography.caption1,
                        fontWeight = FontWeight.Bold,
                    )

                    CheckInRow("sleep", "$sleep/5", selected == CheckInField.SLEEP, Brand.Gold,
                        onSelect = { selected = CheckInField.SLEEP },
                        onMinus = { sleep = (sleep - 1).coerceAtLeast(1) },
                        onPlus = { sleep = (sleep + 1).coerceAtMost(5) })
                    CheckInRow("energy", "$energy/5", selected == CheckInField.ENERGY, Brand.Blue,
                        onSelect = { selected = CheckInField.ENERGY },
                        onMinus = { energy = (energy - 1).coerceAtLeast(1) },
                        onPlus = { energy = (energy + 1).coerceAtMost(5) })
                    CheckInRow("drinks last night", "$drinks", selected == CheckInField.DRINKS, Brand.TextMuted,
                        onSelect = { selected = CheckInField.DRINKS },
                        onMinus = { drinks = (drinks - 1).coerceAtLeast(0); drinksTouched = true },
                        onPlus = { drinks = (drinks + 1).coerceAtMost(15); drinksTouched = true })

                    Chip(
                        onClick = { saveAttempt++ },
                        colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                        label = { Text("Save", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }

            is CheckInState.Failed -> {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(text = s.message, style = MaterialTheme.typography.caption2, textAlign = TextAlign.Center, maxLines = 3)
                    Chip(
                        onClick = { saveAttempt++ },
                        colors = ChipDefaults.primaryChipColors(backgroundColor = Brand.Gold, contentColor = Brand.Navy),
                        label = { Text("Retry", fontWeight = FontWeight.Bold) },
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CheckInRow(
    label: String,
    value: String,
    isSelected: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    onSelect: () -> Unit,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Button(
            onClick = onMinus,
            colors = ButtonDefaults.buttonColors(backgroundColor = Brand.Surface, contentColor = MaterialTheme.colors.onSurface),
            modifier = Modifier.size(30.dp),
        ) { Text("−", fontSize = 16.sp) }
        Column(
            modifier = Modifier
                .padding(horizontal = 8.dp)
                .clickable { onSelect() }
                .then(
                    if (isSelected) Modifier.border(1.5.dp, accent, CircleShape).padding(horizontal = 12.dp, vertical = 1.dp)
                    else Modifier.padding(horizontal = 12.dp, vertical = 1.dp),
                ),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (isSelected) accent else MaterialTheme.colors.onSurface)
            Text(text = label, style = MaterialTheme.typography.caption3, color = Brand.TextMuted, maxLines = 1)
        }
        Button(
            onClick = onPlus,
            colors = ButtonDefaults.buttonColors(backgroundColor = Brand.Surface, contentColor = MaterialTheme.colors.onSurface),
            modifier = Modifier.size(30.dp),
        ) { Text("+", fontSize = 16.sp) }
    }
}
