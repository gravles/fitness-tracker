package com.nathandavie.fitnesstracker.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.remember
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.ui.PairingScreen
import com.nathandavie.fitnesstracker.wear.ui.TodayScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val keyStore = remember { DeviceKeyStore(applicationContext) }
            val navController = rememberSwipeDismissableNavController()
            val start = if (keyStore.apiKey != null) "today" else "pairing"

            MaterialTheme {
                SwipeDismissableNavHost(navController = navController, startDestination = start) {
                    composable("pairing") {
                        PairingScreen(
                            keyStore = keyStore,
                            onPaired = {
                                navController.navigate("today") {
                                    popUpTo("pairing") { inclusive = true }
                                }
                            },
                        )
                    }
                    composable("today") {
                        TodayScreen(
                            keyStore = keyStore,
                            onUnpaired = {
                                navController.navigate("pairing") {
                                    popUpTo("today") { inclusive = true }
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}
