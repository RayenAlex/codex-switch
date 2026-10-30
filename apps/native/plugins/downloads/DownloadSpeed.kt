package com.codexswitch.downloads

import java.util.ArrayDeque

private const val SPEED_WINDOW_MS = 2_000L
private const val SECOND_MS = 1_000.0

/** Worker-owned samples count newly stored bytes, never a restored checkpoint. */
internal class DownloadSpeed(private var received: Long, private val startedAt: Long) {
  private data class Sample(val at: Long, var bytes: Long)
  private val samples = ArrayDeque<Sample>()
  private var recentBytes = 0L

  fun sample(received: Long, now: Long): Double {
    val bytes = maxOf(0L, received - this.received)
    this.received = received
    if (bytes > 0) {
      val last = samples.peekLast()
      if (last?.at == now) last.bytes += bytes else samples.addLast(Sample(now, bytes))
      recentBytes += bytes
    }
    while (samples.isNotEmpty() && samples.first.at <= now - SPEED_WINDOW_MS) {
      recentBytes -= samples.removeFirst().bytes
    }
    val elapsed = minOf(SPEED_WINDOW_MS, now - startedAt)
    return if (elapsed > 0) recentBytes * SECOND_MS / elapsed else 0.0
  }
}
