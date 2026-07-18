package com.nathandavie.fitnesstracker.wear.data

import com.nathandavie.fitnesstracker.wear.api.McpClient
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class TodaySummary(
    val caloriesEaten: Int,
    val caloriesTarget: Int,
    val proteinEaten: Int,
    val proteinTarget: Int,
    val nextWorkout: WorkoutOption?,
)

object FitnessRepository {

    private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    suspend fun todaySummary(client: McpClient): TodaySummary {
        val today = today()
        val profile = client.callToolObject("get_user_profile")
        val logs = client.callToolArray(
            "get_daily_logs",
            JSONObject().put("start_date", today).put("end_date", today),
        )
        val schedule = client.callToolArray("get_schedule")

        val todayLog: JSONObject? = (0 until logs.length())
            .map { logs.getJSONObject(it) }
            .firstOrNull { it.optString("date") == today }

        val next = (0 until schedule.length())
            .map { schedule.getJSONObject(it) }
            .firstOrNull { it.optString("status") == "planned" }
            ?.let { scheduleEntryToOption(it) }

        return TodaySummary(
            caloriesEaten = todayLog?.optInt("calories", 0) ?: 0,
            caloriesTarget = profile.optInt("target_calories", 0),
            proteinEaten = todayLog?.optInt("protein_grams", 0) ?: 0,
            proteinTarget = profile.optInt("target_protein", 0),
            nextWorkout = next,
        )
    }

    /** Today's still-planned scheduled workouts first, then all templates. */
    suspend fun workoutOptions(client: McpClient): List<WorkoutOption> {
        val options = mutableListOf<WorkoutOption>()

        val schedule = client.callToolArray("get_schedule")
        (0 until schedule.length())
            .map { schedule.getJSONObject(it) }
            .filter { it.optString("status") == "planned" }
            .forEach { options.add(scheduleEntryToOption(it)) }

        val templates = client.callToolArray("get_workout_templates")
        (0 until templates.length())
            .map { templates.getJSONObject(it) }
            .forEach { t ->
                val exercises = PlannedExercise.listFromJson(t.optJSONArray("exercises") ?: JSONArray())
                if (exercises.isNotEmpty()) {
                    options.add(
                        WorkoutOption(
                            title = t.optString("name", "Workout"),
                            exercises = exercises,
                            scheduledWorkoutId = null,
                            subtitle = "${exercises.size} exercises",
                        ),
                    )
                }
            }
        return options
    }

    private fun scheduleEntryToOption(entry: JSONObject): WorkoutOption {
        val exercises = PlannedExercise.listFromJson(entry.optJSONArray("exercises") ?: JSONArray())
        val time = entry.optString("time").takeIf { it.isNotEmpty() && it != "null" }
        return WorkoutOption(
            title = entry.optString("title", "Scheduled workout"),
            exercises = exercises,
            scheduledWorkoutId = entry.optString("id").takeIf { it.isNotEmpty() },
            subtitle = listOfNotNull(entry.optString("date").takeIf { it != today() }, time)
                .joinToString(" · ")
                .ifEmpty { "Today" },
        )
    }

    suspend fun logWorkout(client: McpClient, session: WorkoutSession, intensity: String): JSONObject {
        val args = JSONObject()
            .put("activity_type", "Strength Training")
            .put("duration_mins", session.elapsedMinutes())
            .put("intensity", intensity)

        session.scheduledWorkoutId?.let { args.put("scheduled_workout_id", it) }

        val exercises = JSONArray()
        session.exercises.filter { it.sets.isNotEmpty() }.forEach { ex ->
            val sets = JSONArray()
            ex.sets.forEach { s ->
                val set = JSONObject().put("reps", s.reps)
                if (s.weightLbs > 0) set.put("weight_lbs", s.weightLbs)
                sets.put(set)
            }
            exercises.put(JSONObject().put("exercise_name", ex.planned.name).put("sets", sets))
        }
        if (exercises.length() > 0) args.put("exercises", exercises)

        if (session.heartRateSamples.isNotEmpty()) {
            args.put("average_heartrate", session.heartRateSamples.average().toInt())
            args.put("max_heartrate", session.heartRateSamples.max())
        }

        return client.callToolObject("log_workout", args)
    }
}
