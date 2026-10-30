package com.codexswitch.crypto

import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import com.codexswitch.connectivity.NativeConnectivity
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** The existing nonce + ChaCha20-Poly1305 packet format; replay policy remains in SessionCipher. */
internal class PacketCipher(private val key: ByteArray, private val context: ByteArray) {
  companion object {
    const val TRANSFORMATION = "ChaCha20/Poly1305/NoPadding"
    const val MAX_PACKET_HEX = 40_000
    private const val NONCE_BYTES = 12
    private const val TAG_BYTES = 16
    private const val MAX_PLAIN_BYTES = MAX_PACKET_HEX / 2 - NONCE_BYTES - TAG_BYTES
    private const val HEX = "0123456789abcdef"

    fun fromHex(value: String): ByteArray {
      require(value.length % 2 == 0 && value.length <= MAX_PACKET_HEX)
      return ByteArray(value.length / 2) { index ->
        val high = HEX.indexOf(value[index * 2])
        val low = HEX.indexOf(value[index * 2 + 1])
        require(high >= 0 && low >= 0)
        ((high shl 4) or low).toByte()
      }
    }

    private fun toHex(value: ByteArray): String {
      val result = CharArray(value.size * 2)
      for (index in value.indices) {
        val byte = value[index].toInt() and 255
        result[index * 2] = HEX[byte ushr 4]
        result[index * 2 + 1] = HEX[byte and 15]
      }
      return String(result)
    }
  }

  private var closed = false

  init { require(key.size == 32) }

  @Synchronized
  fun encrypt(plain: ByteArray, nonceHex: String): String {
    try {
      check(!closed)
      require(plain.size <= MAX_PLAIN_BYTES && nonceHex.length == NONCE_BYTES * 2)
      val nonce = fromHex(nonceHex)
      return nonceHex + toHex(cipher(Cipher.ENCRYPT_MODE, nonce).doFinal(plain))
    } finally { plain.fill(0) }
  }

  @Synchronized
  fun decrypt(payload: String): String {
    val plain = decryptPacket(payload)
    try { return String(plain, Charsets.UTF_8) } finally { plain.fill(0) }
  }

  @Synchronized
  fun decryptPacketHex(payload: String): String {
    val plain = decryptPacket(payload)
    try { return toHex(plain) } finally { plain.fill(0) }
  }

  /** Compression and UTF-8 stay on the same bounded native worker as encryption. */
  @Synchronized
  fun encryptWithCompression(plain: ByteArray, nonceHex: String): String {
    var packed: ByteArray? = null
    try {
      check(!closed)
      require(nonceHex.length == NONCE_BYTES * 2 && nonceHex.substring(8, 16) == "00000000")
      packed = requireNotNull(NativeConnectivity.encodeChatPacket(plain))
      val nonce = if (packed.size < plain.size) nonceHex.replaceRange(8, 16, "00000001") else nonceHex
      return encrypt(packed, nonce)
    } finally { plain.fill(0); packed?.fill(0) }
  }

  @Synchronized
  fun decryptWithDecompression(payload: String): String {
    require(payload.length >= NONCE_BYTES * 2 && payload.substring(8, 16) == "00000001")
    val packed = decryptPacket(payload)
    var plain: ByteArray? = null
    try {
      plain = requireNotNull(NativeConnectivity.decodeChatPacket(packed))
      // Match the portable decoder's fatal UTF-8 policy, including preservation of a leading BOM.
      return Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(plain)).toString()
    } finally { packed.fill(0); plain?.fill(0) }
  }

  private fun decryptPacket(payload: String): ByteArray {
    check(!closed)
    require(payload.length in (NONCE_BYTES + TAG_BYTES) * 2..MAX_PACKET_HEX)
    val packet = fromHex(payload)
    val nonce = packet.copyOfRange(0, NONCE_BYTES)
    return cipher(Cipher.DECRYPT_MODE, nonce).doFinal(packet, NONCE_BYTES, packet.size - NONCE_BYTES)
  }

  private fun cipher(mode: Int, nonce: ByteArray): Cipher = Cipher.getInstance(TRANSFORMATION).apply {
    init(mode, SecretKeySpec(key, "ChaCha20"), IvParameterSpec(nonce))
    updateAAD(context)
  }

  @Synchronized
  fun destroy() {
    closed = true
    key.fill(0)
    context.fill(0)
  }

  /** File records stay binary on the native side, with their complete header authenticated as AAD. */
  @Synchronized
  fun decryptBytes(encrypted: ByteArray, nonce: ByteArray, aad: ByteArray): ByteArray {
    check(!closed)
    require(nonce.size == NONCE_BYTES && aad.size <= 256)
    require(encrypted.size in TAG_BYTES..MAX_PLAIN_BYTES + TAG_BYTES)
    return cipher(Cipher.DECRYPT_MODE, nonce).apply { updateAAD(aad) }.doFinal(encrypted)
  }
}
