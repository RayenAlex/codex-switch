@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** Publication retries and restored history retain the transfer's original timing. */
class DownloadTimingTest : InstrumentationTestCase() {
  private lateinit var storage: DownloadStorage
  private var engine: DownloadEngine? = null
  private lateinit var task: DownloadTask

  override fun setUp() {
    super.setUp()
    storage = DownloadStorage(instrumentation.targetContext)
    task = DownloadTask.create(JSONObject().put("owner", "timing-test").put("deviceId", "pc")
      .put("scope", "computer").put("path", "timing-test.txt"))
    task.data.put("createdAt", 1_700_000_000_000L).put("mimeType", "text/plain")
  }

  override fun tearDown() {
    try {
      engine?.let { active -> run { active.delete(task.id) }; active.shutdown() }
        ?: storage.delete(task)
    } finally { super.tearDown() }
  }

  private fun run(action: () -> Any?): Any? {
    val done = CompletableFuture<Any?>()
    requireNotNull(engine).submit(action, { done.complete(it) }, { done.completeExceptionally(it) })
    return done.get(10, TimeUnit.SECONDS)
  }

  private fun snapshot(): JSONObject = JSONObject(run {
    JSONArray(requireNotNull(engine).snapshot()).getJSONObject(0).toString()
  } as String)

  private fun retryPublication(): JSONObject {
    task.status = "failed"
    task.data.put("readyToSave", true)
    storage.prepare(task)
    storage.save(listOf(task))
    engine = DownloadEngine(storage, { _, _ -> })
    run { requireNotNull(engine).resume(task.id) }
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
    while (System.nanoTime() < deadline) {
      val value = snapshot()
      if (value.getString("status") == "completed") return value
      assertFalse(value.getString("status") == "failed")
      Thread.sleep(10)
    }
    throw AssertionError("Publication retry did not finish")
  }

  fun testPublicationRetryRetainsPersistedCompletionTime() {
    val completedAt = 1_700_000_125_000L
    task.data.put("completedAt", completedAt)
    val result = retryPublication()
    assertEquals(completedAt, result.getLong("completedAt"))
    assertEquals(125_000L, result.getLong("completedAt") - result.getLong("createdAt"))
    assertEquals(completedAt, storage.load().getValue(task.id).data.getLong("completedAt"))
  }

  fun testLegacyPublicationRetryDoesNotInventCompletionTime() {
    assertFalse(retryPublication().has("completedAt"))
    assertFalse(storage.load().getValue(task.id).data.has("completedAt"))
  }

  fun testLegacyCompletedHistoryKeepsUnknownCompletionTime() {
    task.status = "completed"
    storage.save(listOf(task))
    engine = DownloadEngine(storage, { _, _ -> })
    assertFalse(snapshot().has("completedAt"))
    assertEquals(1_700_000_000_000L, snapshot().getLong("createdAt"))
  }
}
