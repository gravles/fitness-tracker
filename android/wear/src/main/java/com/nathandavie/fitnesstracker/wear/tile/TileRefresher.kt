package com.nathandavie.fitnesstracker.wear.tile

import android.content.Context
import androidx.wear.tiles.TileService

/** Ask the system to re-render the Today tile now (e.g. right after logging). */
object TileRefresher {
    fun refresh(context: Context) {
        try {
            TileService.getUpdater(context).requestUpdate(TodayTileService::class.java)
        } catch (_: Exception) {
            // Tile not added or updater unavailable — nothing to do
        }
    }
}
