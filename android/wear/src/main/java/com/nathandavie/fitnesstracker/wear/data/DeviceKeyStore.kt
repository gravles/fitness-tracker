package com.nathandavie.fitnesstracker.wear.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Holds the device's ftk_ API key in encrypted storage. The key is generated
 * on-device during pairing; only its SHA-256 hash is ever sent to the server.
 */
class DeviceKeyStore(context: Context) {

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "device_key",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var apiKey: String?
        get() = prefs.getString(KEY_API, null)
        set(value) = prefs.edit().putString(KEY_API, value).apply()

    /** Key generated but not yet claimed — kept so pairing survives process death. */
    var pendingKey: String?
        get() = prefs.getString(KEY_PENDING, null)
        set(value) = prefs.edit().putString(KEY_PENDING, value).apply()

    fun promotePendingKey() {
        apiKey = pendingKey
        pendingKey = null
    }

    fun clear() = prefs.edit().clear().apply()

    companion object {
        private const val KEY_API = "api_key"
        private const val KEY_PENDING = "pending_key"

        fun generateKey(): String {
            val bytes = ByteArray(20)
            SecureRandom().nextBytes(bytes)
            return "ftk_" + bytes.joinToString("") { "%02x".format(it) }
        }

        fun sha256(text: String): String =
            MessageDigest.getInstance("SHA-256")
                .digest(text.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
    }
}
