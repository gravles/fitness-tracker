package com.nathandavie.fitnesstracker.wear.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Crash/kill-proof draft of the in-progress workout. Saved on session start
 * and after every completed set; cleared when the workout is saved to the
 * server or explicitly discarded. Restored by MainActivity on launch.
 */
object SessionStore {

    private const val PREFS = "session_draft"
    private const val KEY = "draft"

    fun save(context: Context, session: WorkoutSession) {
        val json = JSONObject()
            .put("title", session.title)
            .put("scheduled_workout_id", session.scheduledWorkoutId ?: JSONObject.NULL)
            .put("started_at", session.startedAtMs)
            .put("hr", JSONArray(session.heartRateSamples))
            .put(
                "exercises",
                JSONArray().apply {
                    session.exercises.forEach { ex ->
                        put(
                            JSONObject()
                                .put("name", ex.planned.name)
                                .put("target_sets", ex.planned.targetSets)
                                .put("rep_range", ex.planned.repRange ?: JSONObject.NULL)
                                .put("rest_seconds", ex.planned.restSeconds)
                                .put("suggested_weight_lbs", ex.planned.suggestedWeightLbs ?: JSONObject.NULL)
                                .put(
                                    "logged",
                                    JSONArray().apply {
                                        ex.sets.forEach { s ->
                                            put(JSONObject().put("reps", s.reps).put("weight", s.weightLbs))
                                        }
                                    },
                                ),
                        )
                    }
                },
            )
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, json.toString()).apply()
    }

    fun load(context: Context): WorkoutSession? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        return try {
            val json = JSONObject(raw)
            val exercises = json.getJSONArray("exercises").let { arr ->
                (0 until arr.length()).map { i ->
                    val e = arr.getJSONObject(i)
                    ExerciseLog(
                        planned = PlannedExercise(
                            name = e.getString("name"),
                            targetSets = e.optInt("target_sets", 3),
                            repRange = e.optString("rep_range").takeIf { it.isNotEmpty() && it != "null" },
                            restSeconds = e.optInt("rest_seconds", 60),
                            suggestedWeightLbs = e.optDouble("suggested_weight_lbs", 0.0).takeIf { it > 0 },
                        ),
                        sets = e.getJSONArray("logged").let { sets ->
                            (0 until sets.length()).map { j ->
                                val s = sets.getJSONObject(j)
                                LoggedSet(reps = s.getInt("reps"), weightLbs = s.getDouble("weight"))
                            }.toMutableList()
                        },
                    )
                }
            }
            if (exercises.isEmpty()) return null
            WorkoutSession(
                title = json.optString("title", "Workout"),
                scheduledWorkoutId = json.optString("scheduled_workout_id").takeIf { it.isNotEmpty() && it != "null" },
                exercises = exercises,
                startedAtMs = json.optLong("started_at", System.currentTimeMillis()),
            ).also { restored ->
                val hr = json.optJSONArray("hr")
                if (hr != null) (0 until hr.length()).forEach { restored.heartRateSamples.add(hr.optInt(it)) }
            }
        } catch (e: Exception) {
            null
        }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }
}
