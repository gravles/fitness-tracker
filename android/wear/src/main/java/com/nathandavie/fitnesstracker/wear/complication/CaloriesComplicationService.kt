package com.nathandavie.fitnesstracker.wear.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.nathandavie.fitnesstracker.wear.MainActivity
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository

/**
 * Watch-face complication: calories remaining today. RANGED_VALUE renders as
 * a small progress arc on faces that support it; SHORT_TEXT shows "925 kcal".
 * Updates every 30 minutes (manifest UPDATE_PERIOD_SECONDS); tap opens the app.
 */
class CaloriesComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        buildData(type, remaining = 925, eaten = 1275, target = 2200)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        return try {
            val key = DeviceKeyStore(this).apiKey ?: return buildData(request.complicationType, null, 0, 0)
            val summary = FitnessRepository.todaySummary(McpClient(key))
            buildData(
                request.complicationType,
                remaining = summary.caloriesTarget - summary.caloriesEaten,
                eaten = summary.caloriesEaten,
                target = summary.caloriesTarget,
            )
        } catch (e: Exception) {
            android.util.Log.e("CalsComplication", "update failed", e)
            buildData(request.complicationType, null, 0, 0)
        }
    }

    private fun tapAction(): PendingIntent =
        PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    private fun buildData(type: ComplicationType, remaining: Int?, eaten: Int, target: Int): ComplicationData? {
        val valueText = remaining?.let { "%,d".format(it) } ?: "--"
        val text = PlainComplicationText.Builder(valueText).build()
        val title = PlainComplicationText.Builder("kcal").build()
        val description = PlainComplicationText.Builder("Calories remaining today").build()

        return when (type) {
            ComplicationType.SHORT_TEXT ->
                ShortTextComplicationData.Builder(text, description)
                    .setTitle(title)
                    .setTapAction(tapAction())
                    .build()

            ComplicationType.RANGED_VALUE -> {
                val max = if (target > 0) target.toFloat() else 1f
                RangedValueComplicationData.Builder(
                    value = eaten.toFloat().coerceIn(0f, max),
                    min = 0f,
                    max = max,
                    contentDescription = description,
                )
                    .setText(text)
                    .setTitle(title)
                    .setTapAction(tapAction())
                    .build()
            }

            else -> null
        }
    }
}
