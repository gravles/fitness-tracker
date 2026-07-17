package com.nathandavie.fitnesstracker.wear.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.nathandavie.fitnesstracker.wear.api.PairingApi
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import kotlinx.coroutines.delay

private sealed interface PairingState {
    data object Starting : PairingState
    data class ShowingCode(val code: String) : PairingState
    data class Failed(val message: String) : PairingState
}

/**
 * Generates the device key, registers its hash, and shows the short code the
 * user types into Settings -> Pair a Device on the phone/web app.
 */
@Composable
fun PairingScreen(keyStore: DeviceKeyStore, onPaired: () -> Unit) {
    var state by remember { mutableStateOf<PairingState>(PairingState.Starting) }
    var attempt by remember { mutableStateOf(0) }

    LaunchedEffect(attempt) {
        state = PairingState.Starting
        try {
            val key = keyStore.pendingKey ?: DeviceKeyStore.generateKey().also { keyStore.pendingKey = it }
            val code = PairingApi.start(DeviceKeyStore.sha256(key), "Galaxy Watch")
            state = PairingState.ShowingCode(code)

            while (true) {
                delay(3_000)
                when (PairingApi.poll(code)) {
                    "claimed" -> {
                        keyStore.promotePendingKey()
                        onPaired()
                        return@LaunchedEffect
                    }
                    "expired" -> {
                        state = PairingState.Failed("Code expired")
                        return@LaunchedEffect
                    }
                    // "pending" -> keep waiting
                }
            }
        } catch (e: Exception) {
            state = PairingState.Failed(e.message ?: "No connection")
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (val s = state) {
            is PairingState.Starting -> {
                CircularProgressIndicator()
            }
            is PairingState.ShowingCode -> {
                Text(
                    text = "Enter this code in\nSettings › Pair a Device",
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = s.code,
                    fontSize = 32.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            is PairingState.Failed -> {
                Text(
                    text = s.message,
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Tap to retry",
                    style = MaterialTheme.typography.button,
                    color = MaterialTheme.colors.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(top = 12.dp)
                        .clickable { attempt++ },
                )
            }
        }
    }
}
