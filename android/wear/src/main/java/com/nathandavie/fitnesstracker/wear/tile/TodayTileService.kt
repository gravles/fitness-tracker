package com.nathandavie.fitnesstracker.wear.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.CircularProgressIndicator
import androidx.wear.protolayout.material.ProgressIndicatorColors
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.protolayout.material.layouts.EdgeContentLayout
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture
import com.nathandavie.fitnesstracker.wear.MainActivity
import com.nathandavie.fitnesstracker.wear.api.McpClient
import com.nathandavie.fitnesstracker.wear.data.DeviceKeyStore
import com.nathandavie.fitnesstracker.wear.data.FitnessRepository
import kotlinx.coroutines.Dispatchers

private const val GOLD = 0xFFE0B35A.toInt()
private const val BLUE = 0xFF5B9CF6.toInt()
private const val MUTED = 0xFF9AA3B2.toInt()
private const val GOLD_TRACK = 0x2EE0B35A.toInt()

/**
 * Glanceable tile: gold calories arc around the edge, kcal/protein remaining
 * in the middle, next workout underneath. Refreshes at most every 30 minutes;
 * tapping anywhere opens the app.
 */
class TodayTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture(Dispatchers.IO, launchUndispatched = false) {
            val layout = try {
                val key = DeviceKeyStore(this@TodayTileService).apiKey
                if (key == null) {
                    messageLayout("Open app to pair")
                } else {
                    val summary = FitnessRepository.todaySummary(McpClient(key))
                    summaryLayout(requestParams, summary)
                }
            } catch (e: Exception) {
                android.util.Log.e("TodayTile", "tile data fetch failed", e)
                messageLayout("Tap to open")
            }

            TileBuilders.Tile.Builder()
                .setResourcesVersion("1")
                .setFreshnessIntervalMillis(30 * 60 * 1000)
                .setTileTimeline(
                    TimelineBuilders.Timeline.Builder()
                        .addTimelineEntry(
                            TimelineBuilders.TimelineEntry.Builder()
                                .setLayout(
                                    LayoutElementBuilders.Layout.Builder()
                                        .setRoot(layout)
                                        .build(),
                                )
                                .build(),
                        )
                        .build(),
                )
                .build()
        }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture {
            ResourceBuilders.Resources.Builder().setVersion("1").build()
        }

    private fun openAppClickable(): ModifiersBuilders.Clickable =
        ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build(),
                    )
                    .build(),
            )
            .build()

    private fun summaryLayout(
        requestParams: RequestBuilders.TileRequest,
        summary: com.nathandavie.fitnesstracker.wear.data.TodaySummary,
    ): LayoutElementBuilders.LayoutElement {
        val calsLeft = summary.caloriesTarget - summary.caloriesEaten
        val proteinLeft = summary.proteinTarget - summary.proteinEaten
        val fraction = if (summary.caloriesTarget > 0) {
            (summary.caloriesEaten.toFloat() / summary.caloriesTarget).coerceIn(0f, 1f)
        } else 0f

        val center = LayoutElementBuilders.Column.Builder()
            .addContent(
                Text.Builder(this, "%,d".format(kotlin.math.abs(calsLeft)))
                    .setTypography(Typography.TYPOGRAPHY_DISPLAY2)
                    .setColor(argb(GOLD))
                    .build(),
            )
            .addContent(
                Text.Builder(this, if (calsLeft < 0) "kcal over" else "kcal left")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .setColor(argb(MUTED))
                    .build(),
            )
            .addContent(
                Text.Builder(this, if (proteinLeft <= 0) "protein done" else "${proteinLeft}g protein")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .setColor(argb(BLUE))
                    .build(),
            )
            .build()

        return EdgeContentLayout.Builder(requestParams.deviceConfiguration)
            .setEdgeContent(
                CircularProgressIndicator.Builder()
                    .setProgress(fraction)
                    .setCircularProgressIndicatorColors(ProgressIndicatorColors(argb(GOLD), argb(GOLD_TRACK)))
                    .build(),
            )
            .setContent(
                LayoutElementBuilders.Box.Builder()
                    .setModifiers(
                        ModifiersBuilders.Modifiers.Builder()
                            .setClickable(openAppClickable())
                            .build(),
                    )
                    .addContent(center)
                    .build(),
            )
            .setSecondaryLabelTextContent(
                Text.Builder(this, summary.nextWorkout?.title ?: "no workout planned")
                    .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                    .setColor(argb(MUTED))
                    .build(),
            )
            .build()
    }

    private fun messageLayout(message: String): LayoutElementBuilders.LayoutElement =
        LayoutElementBuilders.Box.Builder()
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(openAppClickable())
                    .build(),
            )
            .addContent(
                Text.Builder(this, message)
                    .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                    .setColor(argb(MUTED))
                    .build(),
            )
            .build()
}
