package com.nathandavie.fitnesstracker.wear.speech

data class SpokenSet(val reps: Int, val weightLbs: Double?) // null weight = keep current

/**
 * Local grammar for spoken sets, so the common phrasings don't need a network
 * round-trip: "185 for 8", "8 reps at 185", "8 at 185", bare "185 8", or just
 * "8" (reps at the current weight). The AI intent parser is the fallback for
 * anything fancier.
 */
object SetParser {

    private val WEIGHT_FOR_REPS =
        Regex("""(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)?\s*(?:for|by|times|x)\s*(\d+)""")
    private val REPS_AT_WEIGHT =
        Regex("""(\d+)\s*(?:reps?)?\s*(?:at|@|with)\s*(\d+(?:\.\d+)?)""")
    private val NUMBER = Regex("""\d+(?:\.\d+)?""")

    fun parse(raw: String): SpokenSet? {
        val text = raw.lowercase()

        WEIGHT_FOR_REPS.find(text)?.let {
            val weight = it.groupValues[1].toDouble()
            val reps = it.groupValues[2].toInt()
            if (reps in 1..100) return SpokenSet(reps, weight)
        }

        REPS_AT_WEIGHT.find(text)?.let {
            val reps = it.groupValues[1].toInt()
            val weight = it.groupValues[2].toDouble()
            if (reps in 1..100) return SpokenSet(reps, weight)
        }

        val numbers = NUMBER.findAll(text).map { it.value.toDouble() }.toList()
        if (numbers.size == 2) {
            // Bare pair: the smaller plausible count is reps, the other is weight
            val reps = numbers.min()
            val weight = numbers.max()
            if (reps in 1.0..50.0 && reps % 1.0 == 0.0 && weight > reps) {
                return SpokenSet(reps.toInt(), weight)
            }
        }
        if (numbers.size == 1 && numbers[0] in 1.0..50.0 && numbers[0] % 1.0 == 0.0) {
            return SpokenSet(numbers[0].toInt(), null) // reps at the current weight
        }
        return null
    }
}
