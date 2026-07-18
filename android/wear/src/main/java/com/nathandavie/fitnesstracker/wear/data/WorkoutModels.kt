package com.nathandavie.fitnesstracker.wear.data

import org.json.JSONArray
import org.json.JSONObject

data class PlannedExercise(
    val name: String,
    val targetSets: Int,
    val repRange: String?,   // e.g. "8-12"
    val restSeconds: Int,
    val lastWeightLbs: Int? = null,
    val lastReps: List<Int> = emptyList(),
    val suggestedWeightLbs: Int? = null,
    val progression: String? = null, // "increase" | "repeat"
) {
    /** Lower bound of the rep range as the starting suggestion. */
    val suggestedReps: Int
        get() = repRange?.takeWhile { it.isDigit() }?.toIntOrNull() ?: 10

    companion object {
        fun fromJson(o: JSONObject) = PlannedExercise(
            name = o.optString("exercise_name", "Exercise"),
            targetSets = o.optInt("sets", 3).coerceAtLeast(1),
            repRange = o.optString("rep_range").takeIf { it.isNotEmpty() && it != "null" },
            restSeconds = o.optInt("rest_seconds", 60).let { if (it <= 0) 60 else it },
            lastWeightLbs = o.optInt("last_weight_lbs", 0).takeIf { it > 0 },
            lastReps = o.optJSONArray("last_reps")?.let { arr ->
                (0 until arr.length()).map { arr.optInt(it) }
            } ?: emptyList(),
            suggestedWeightLbs = o.optInt("suggested_weight_lbs", 0).takeIf { it > 0 },
            progression = o.optString("progression").takeIf { it == "increase" || it == "repeat" },
        )

        fun listFromJson(arr: JSONArray): List<PlannedExercise> =
            (0 until arr.length()).map { fromJson(arr.getJSONObject(it)) }
                .filter { it.name.isNotBlank() }
    }
}

/** A startable workout: today's scheduled entry or a saved template. */
data class WorkoutOption(
    val title: String,
    val exercises: List<PlannedExercise>,
    val scheduledWorkoutId: String?, // present when starting from the schedule
    val subtitle: String?,
)

data class LoggedSet(val reps: Int, val weightLbs: Int)

data class ExerciseLog(
    val planned: PlannedExercise,
    val sets: MutableList<LoggedSet> = mutableListOf(),
)

class WorkoutSession(
    val title: String,
    val scheduledWorkoutId: String?,
    val exercises: List<ExerciseLog>,
    val startedAtMs: Long = System.currentTimeMillis(),
) {
    val heartRateSamples = mutableListOf<Int>()

    val totalSetsLogged: Int get() = exercises.sumOf { it.sets.size }
    fun elapsedMinutes(): Int =
        (((System.currentTimeMillis() - startedAtMs) / 60_000).toInt()).coerceAtLeast(1)
}

/** Holds the in-progress session across navigation. */
object SessionManager {
    var session: WorkoutSession? = null

    fun start(option: WorkoutOption): WorkoutSession {
        val s = WorkoutSession(
            title = option.title,
            scheduledWorkoutId = option.scheduledWorkoutId,
            exercises = option.exercises.map { ExerciseLog(it) },
        )
        session = s
        return s
    }

    fun clear() {
        session = null
    }
}
