package com.codexswitch.crypto

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Promise
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.UUID
import javax.crypto.Cipher

class ChatPacketCipherModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val sessions = mutableMapOf<String, PacketCipher>()
  private val packets = ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS, ArrayBlockingQueue<Runnable>(128))
  private var invalidated = false
  private val available = runCatching { Cipher.getInstance(PacketCipher.TRANSFORMATION) }.isSuccess

  override fun getName() = "ChatPacketCipher"
  override fun getConstants(): Map<String, Any> = mapOf("available" to available,
    "binaryPackets" to true, "compressedPackets" to true)

  // These calls do no I/O: each packet is at most 20 KB, with one synchronous bridge crossing.
  @ReactMethod(isBlockingSynchronousMethod = true)
  @Synchronized
  fun create(keyHex: String, contextHex: String): String? {
    if (!available || invalidated || sessions.size >= MAX_SESSIONS) return null
    if (keyHex.length != 64 || contextHex.length > MAX_CONTEXT_HEX) return null
    return runCatching {
      val context = PacketCipher.fromHex(contextHex)
      val key = PacketCipher.fromHex(keyHex)
      val handle = UUID.randomUUID().toString()
      sessions[handle] = PacketCipher(key, context)
      handle
    }.getOrNull()
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun encrypt(handle: String, input: ReadableMap, nonce: String): String? =
    runCatching { session(handle)?.encrypt(plaintext(input), nonce) }.getOrNull()

  private fun plaintext(input: ReadableMap): ByteArray {
    if (input.hasKey("utf8Hex")) return PacketCipher.fromHex(requireNotNull(input.getString("utf8Hex")))
    val text = requireNotNull(input.getString("text"))
    require(text.length <= PacketCipher.MAX_PACKET_HEX / 2)
    return text.toByteArray(Charsets.UTF_8)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun decrypt(handle: String, payload: String): WritableMap? = runCatching {
    val text = session(handle)?.decrypt(payload) ?: return null
    // RN's scalar return conversion truncates NULs; its native map return conversion preserves them.
    Arguments.createMap().apply { putString("text", text) }
  }.getOrNull()

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun decryptPacketHex(handle: String, payload: String): String? =
    runCatching { session(handle)?.decryptPacketHex(payload) }.getOrNull()

  @ReactMethod
  fun encryptWithCompression(handle: String, input: ReadableMap, nonce: String, promise: Promise) {
    submit(promise) { requireNotNull(session(handle)).encryptWithCompression(plaintext(input), nonce) }
  }

  @ReactMethod
  fun decryptWithDecompression(handle: String, payload: String, promise: Promise) {
    submit(promise) {
      val text = requireNotNull(session(handle)).decryptWithDecompression(payload)
      Arguments.createMap().apply { putString("text", text) }
    }
  }

  private fun submit(promise: Promise, action: () -> Any) {
    try {
      packets.execute {
        try { promise.resolve(action()) }
        catch (_: Exception) { promise.reject("INVALID_PACKET", "Invalid encrypted packet") }
      }
    } catch (_: RejectedExecutionException) { promise.reject("INVALID_PACKET", "Packet worker unavailable") }
  }

  @Synchronized
  private fun session(handle: String): PacketCipher? = sessions[handle]

  @ReactMethod(isBlockingSynchronousMethod = true)
  @Synchronized
  fun destroy(handle: String): Boolean {
    sessions.remove(handle)?.destroy()
    return true
  }

  @Synchronized
  override fun invalidate() {
    invalidated = true
    packets.shutdown()
    sessions.values.forEach { it.destroy() }
    sessions.clear()
    super.invalidate()
  }

  companion object {
    private const val MAX_SESSIONS = 16
    private const val MAX_CONTEXT_HEX = 2048
  }
}
