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
import com.nathandavie.fitnesstracker.wear.data.SessionManager
import com.nathandavie.fitnesstracker.wear.data.SessionStore
import com.nathandavie.fitnesstracker.wear.ui.ActiveWorkoutScreen
import com.nathandavie.fitnesstracker.wear.ui.CheckInScreen
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

            // A live or drafted workout always resumes first — sets must never be lost
            val hasSession = remember {
                SessionManager.session != null || SessionStore.load(applicationContext)?.let {
                    SessionManager.session = it
                    true
                } == true
            }
            val start = when {
                keyStore.apiKey == null -> "pairing"
                hasSession -> "session"
                else -> "today"
            }

            androidx.compose.runtime.LaunchedEffect(Unit) {
                if (keyStore.apiKey != null && !hasSession && (deepLink == "voice" || deepLink == "picker")) {
                    navController.navigate(deepLink)
                }
                if (keyStore.apiKey != null && hasSession && deepLink == "voice") {
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
                            onCheckIn = { navController.navigate("checkin") },
                        )
                    }
                    composable("checkin") {
                        CheckInScreen(
                            keyStore = keyStore,
                            onDone = {
                                navController.navigate("today") {
                                    popUpTo("today") { inclusive = true }
                                }
                            },
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
