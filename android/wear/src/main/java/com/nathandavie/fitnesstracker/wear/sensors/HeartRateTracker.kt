package com.nathandavie.fitnesstracker.wear.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

/**
 * Samples the heart-rate sensor while a workout session is active and the
 * screen is on (the session screen holds FLAG_KEEP_SCREEN_ON, so in practice
 * this covers the whole workout). Requires BODY_SENSORS at runtime; if the
 * sensor is missing or permission was denied, start() is a no-op and the
 * session simply logs without heart rate.
 */
class HeartRateTracker(context: Context, private val onSample: (Int) -> Unit) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_HEART_RATE)
    var latestBpm: Int? = null
        private set

    fun start() {
        sensor?.let {
            try {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
            } catch (_: SecurityException) {
                // Permission denied — proceed without HR
            }
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        val bpm = event.values.firstOrNull()?.toInt() ?: return
        if (bpm in 30..230) {
            latestBpm = bpm
            onSample(bpm)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
