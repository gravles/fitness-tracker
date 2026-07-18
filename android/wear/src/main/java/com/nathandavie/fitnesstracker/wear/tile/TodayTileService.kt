package com.nathandavie.fitnesstracker.wear.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.ChipColors
import androidx.wear.protolayout.material.CircularProgressIndicator
import androidx.wear.protolayout.material.CompactChip
import androidx.wear.protolayout.material.ProgressIndicatorColors
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
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
private const val SURFACE = 0xFF111827.toInt()
private const val GOLD_TRACK = 0x2EE0B35A.toInt()
private const val BLUE_TRACK = 0x2E5B9CF6.toInt()

/**
 * Glanceable + actionable tile mirroring the app's ring design: outer gold
 * calories ring, inner blue protein ring, remaining values in the center, and
 * two one-tap actions — "food" (voice logging) and "lift" (workout picker) —
 * that deep-link into the app. Refreshes at most every 30 minutes.
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

    /** Launch the app, optionally deep-linked (dest = "voice" | "picker"). */
    private fun openApp(id: String, dest: String? = null): ModifiersBuilders.Clickable {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName(MainActivity::class.java.name)
        dest?.let { activity.addKeyToExtraMapping("dest", ActionBuilders.stringExtra(it)) }
        return ModifiersBuilders.Clickable.Builder()
            .setId(id)
            .setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity.build()).build())
            .build()
    }

    private fun ring(progress: Float, colorArgb: Int, trackArgb: Int, inset: Float): LayoutElementBuilders.LayoutElement {
        val indicator = CircularProgressIndicator.Builder()
            .setProgress(progress)
            .setStartAngle(0f)
            .setEndAngle(360f)
            .setCircularProgressIndicatorColors(ProgressIndicatorColors(argb(colorArgb), argb(trackArgb)))
            .build()
        if (inset == 0f) return indicator
        return LayoutElementBuilders.Box.Builder()
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setPadding(ModifiersBuilders.Padding.Builder().setAll(dp(inset)).build())
                    .build(),
            )
            .addContent(indicator)
            .build()
    }

    private fun summaryLayout(
        requestParams: RequestBuilders.TileRequest,
        summary: com.nathandavie.fitnesstracker.wear.data.TodaySummary,
    ): LayoutElementBuilders.LayoutElement {
        val calsLeft = summary.caloriesTarget - summary.caloriesEaten
        val proteinLeft = summary.proteinTarget - summary.proteinEaten
        val calsFraction = if (summary.caloriesTarget > 0) {
            (summary.caloriesEaten.toFloat() / summary.caloriesTarget).coerceIn(0f, 1f)
        } else 0f
        val proteinFraction = if (summary.proteinTarget > 0) {
            (summary.proteinEaten.toFloat() / summary.proteinTarget).coerceIn(0f, 1f)
        } else 0f

        val chipRow = LayoutElementBuilders.Row.Builder()
            .addContent(
                CompactChip.Builder(this, "food", openApp("log-food", "voice"), requestParams.deviceConfiguration)
                    .setChipColors(ChipColors(argb(SURFACE), argb(BLUE)))
                    .build(),
            )
            .addContent(LayoutElementBuilders.Spacer.Builder().setWidth(dp(6f)).build())
            .addContent(
                CompactChip.Builder(this, "lift", openApp("start-workout", "picker"), requestParams.deviceConfiguration)
                    .setChipColors(ChipColors(argb(SURFACE), argb(GOLD)))
                    .build(),
            )
            .build()

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
            .addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(8f)).build())
            .addContent(chipRow)
            .build()

        return LayoutElementBuilders.Box.Builder()
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(openApp("open"))
                    .build(),
            )
            .addContent(ring(calsFraction, GOLD, GOLD_TRACK, inset = 0f))
            .addContent(ring(proteinFraction, BLUE, BLUE_TRACK, inset = 12f))
            .addContent(center)
            .build()
    }

    private fun messageLayout(message: String): LayoutElementBuilders.LayoutElement =
        LayoutElementBuilders.Box.Builder()
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(openApp("open"))
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
