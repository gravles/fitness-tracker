package com.nathandavie.fitnesstracker.wear.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.nathandavie.fitnesstracker.wear.ui.theme.Brand

/**
 * Two concentric full-circle progress rings hugging the round bezel:
 * outer gold = calories eaten vs target, inner blue = protein.
 * Fill grows clockwise from 12 o'clock; when over target the ring
 * completes and switches to the danger color.
 */
@Composable
fun MacroRings(
    caloriesFraction: Float,
    proteinFraction: Float,
    modifier: Modifier = Modifier,
) {
    val calsAnim by animateFloatAsState(
        targetValue = caloriesFraction.coerceIn(0f, 1.25f),
        animationSpec = tween(700),
        label = "cals",
    )
    val proteinAnim by animateFloatAsState(
        targetValue = proteinFraction.coerceIn(0f, 1.25f),
        animationSpec = tween(700),
        label = "protein",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        val stroke = 9.dp.toPx()
        val gap = 4.dp.toPx()
        val edge = 3.dp.toPx()

        ring(radiusInset = edge + stroke / 2, stroke = stroke, fraction = calsAnim, color = Brand.Gold)
        ring(radiusInset = edge + stroke + gap + stroke / 2, stroke = stroke, fraction = proteinAnim, color = Brand.Blue)
    }
}

private fun DrawScope.ring(radiusInset: Float, stroke: Float, fraction: Float, color: Color) {
    val diameter = size.minDimension - radiusInset * 2
    val topLeft = Offset((size.width - diameter) / 2, (size.height - diameter) / 2)
    val arcSize = Size(diameter, diameter)
    val over = fraction > 1f
    val sweep = (if (over) 1f else fraction) * 360f

    // Track
    drawArc(
        color = color.copy(alpha = 0.18f),
        startAngle = 0f, sweepAngle = 360f, useCenter = false,
        topLeft = topLeft, size = arcSize,
        style = Stroke(width = stroke, cap = StrokeCap.Round),
    )
    // Progress
    if (sweep > 0f) {
        drawArc(
            color = if (over) Brand.Danger else color,
            startAngle = -90f, sweepAngle = sweep, useCenter = false,
            topLeft = topLeft, size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

/** Single countdown ring used by the rest timer (full at start, empties clockwise). */
@Composable
fun CountdownRing(fraction: Float, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val stroke = 10.dp.toPx()
        val inset = 3.dp.toPx() + stroke / 2
        val diameter = size.minDimension - inset * 2
        val topLeft = Offset((size.width - diameter) / 2, (size.height - diameter) / 2)
        val arcSize = Size(diameter, diameter)

        drawArc(
            color = color.copy(alpha = 0.18f),
            startAngle = 0f, sweepAngle = 360f, useCenter = false,
            topLeft = topLeft, size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
        if (fraction > 0f) {
            drawArc(
                color = color,
                startAngle = -90f, sweepAngle = fraction.coerceIn(0f, 1f) * 360f, useCenter = false,
                topLeft = topLeft, size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }
    }
}
