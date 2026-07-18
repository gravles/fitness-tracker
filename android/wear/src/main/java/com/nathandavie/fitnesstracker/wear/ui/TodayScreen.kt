package com.nathandavie.fitnesstracker.wear.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.api.UnauthorizedException
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository
import com.nathandavie.fitnesstracker.wear.data.TodaySummary
import com.nathandavie.fitnesstracker.wear.ui.components.MacroRings
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand

private sealed interface TodayState {
    data object Loading : TodayState
    data class Loaded(val summary: TodaySummary) : TodayState
    data class Failed(val message: String) : TodayState
}

/**
 * Glanceable home: gold calories ring (outer) + blue protein ring (inner),
 * remaining values in the center, start-workout chip at the bottom.
 * Tapping the center refreshes.
 */
@Composable
fun TodayScreen(
    keyStore: DeviceKeyStore,
    onUnpaired: () -> Unit,
    onStartWorkout: () -> Unit,
) {
    var state by remember { mutableStateOf<TodayState>(TodayState.Loading) }
    var refresh by remember { mutableStateOf(0) }

    LaunchedEffect(refresh) {
        state = TodayState.Loading
        val key = keyStore.apiKey
        if (key == null) {
            onUnpaired()
            return@LaunchedEffect
        }
        try {
            state = TodayState.Loaded(FitnessRepository.todaySummary(McpClient(key)))
        } catch (e: UnauthorizedException) {
            keyStore.clear()
            onUnpaired()
        } catch (e: Exception) {
            state = TodayState.Failed(e.message ?: "No connection")
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            is TodayState.Loading -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }

            is TodayState.Loaded -> {
                val sum = s.summary
                MacroRings(
                    caloriesFraction = fraction(sum.caloriesEaten, sum.caloriesTarget),
                    proteinFraction = fraction(sum.proteinEaten, sum.proteinTarget),
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .clickable { refresh++ }
                        .padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    val calsLeft = sum.caloriesTarget - sum.caloriesEaten
                    Text(
                        text = formatSigned(calsLeft),
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (calsLeft < 0) Brand.Danger else Brand.Gold,
                    )
                    Text(
                        text = if (calsLeft < 0) "kcal over" else "kcal left",
                        style = MaterialTheme.typography.caption2,
                        color = Brand.TextMuted,
                    )

                    val proteinLeft = sum.proteinTarget - sum.proteinEaten
                    Text(
                        text = if (proteinLeft < 0) "protein done ✓"
                               else "${proteinLeft}g protein left",
                        style = MaterialTheme.typography.caption1,
                        color = Brand.Blue,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }

                CompactChip(
                    onClick = onStartWorkout,
                    colors = ChipDefaults.chipColors(
                        backgroundColor = Brand.Surface,
                        contentColor = Brand.Gold,
                    ),
                    label = {
                        Text(
                            text = sum.nextWorkout?.title ?: "Start workout",
                            style = MaterialTheme.typography.caption2,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                        )
                    },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 34.dp),
                )
            }

            is TodayState.Failed -> {
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

private fun fraction(value: Int, target: Int): Float =
    if (target <= 0) 0f else value.toFloat() / target

private fun formatSigned(value: Int): String {
    val abs = kotlin.math.abs(value)
    return "%,d".format(abs)
}
