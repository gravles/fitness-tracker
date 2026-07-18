package com.nathandavie.fitnesstracker.wear.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.nathandavie.fitnesstracker.wear.MainActivity

/**
 * Static shortcut complications for watch-face slots: one tap goes straight
 * into voice food logging or the workout picker (same deep links as the tile
 * chips). No data, no updates — just launchers.
 */
abstract class ShortcutComplicationService(
    private val label: String,
    private val dest: String,
    private val description: String,
) : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? = build(type)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? =
        build(request.complicationType)

    private fun build(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        val tap = PendingIntent.getActivity(
            this,
            dest.hashCode(),
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra("dest", dest),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            PlainComplicationText.Builder(label).build(),
            PlainComplicationText.Builder(description).build(),
        )
            .setTapAction(tap)
            .build()
    }
}

class FoodShortcutComplicationService :
    ShortcutComplicationService("food", "voice", "Log food by voice")

class LiftShortcutComplicationService :
    ShortcutComplicationService("lift", "picker", "Start a workout")
