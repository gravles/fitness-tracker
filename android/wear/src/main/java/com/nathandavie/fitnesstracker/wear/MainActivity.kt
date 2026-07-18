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
import com.nathandavie.fitnesstracker.wear.ui.ActiveWorkoutScreen
import com.nathandavie.fitnesstracker.wear.ui.PairingScreen
import com.nathandavie.fitnesstracker.wear.ui.TodayScreen
import com.nathandavie.fitnesstracker.wear.ui.VoiceFoodScreen
import com.nathandavie.fitnesstracker.wear.ui.WorkoutPickerScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Tile chips deep-link straight to a screen ("voice" | "picker")
        val deepLink = intent.getStringExtra("dest")

        setContent {
            val keyStore = remember { DeviceKeyStore(applicationContext) }
            val navController = rememberSwipeDismissableNavController()
            val start = if (keyStore.apiKey != null) "today" else "pairing"

            androidx.compose.runtime.LaunchedEffect(Unit) {
                if (keyStore.apiKey != null && (deepLink == "voice" || deepLink == "picker")) {
                    navController.navigate(deepLink)
                }
            }

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
                            onStartWorkout = { navController.navigate("picker") },
                            onLogFood = { navController.navigate("voice") },
                        )
                    }
                    composable("voice") {
                        VoiceFoodScreen(
                            keyStore = keyStore,
                            onDone = {
                                navController.navigate("today") {
                                    popUpTo("today") { inclusive = true }
                                }
                            },
                        )
                    }
                    composable("picker") {
                        WorkoutPickerScreen(
                            keyStore = keyStore,
                            onStarted = {
                                navController.navigate("session") {
                                    popUpTo("picker") { inclusive = true }
                                }
                            },
                        )
                    }
                    composable("session") {
                        ActiveWorkoutScreen(
                            keyStore = keyStore,
                            onDone = {
                                navController.navigate("today") {
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
