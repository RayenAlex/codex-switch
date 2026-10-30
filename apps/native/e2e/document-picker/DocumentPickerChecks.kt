package expo.modules.documentpicker

import android.app.Activity
import android.content.Intent
import android.content.ClipData
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.AppContext
import expo.modules.kotlin.modules.Payload
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.*

private class ResultPromise : Promise {
  val done = CompletableDeferred<Unit>()
  var result: DocumentPickerResult? = null
  var error: CodedException? = null
  var failResolve = false
  var settlements = 0
  override fun resolve(value: Any?) {
    if (failResolve) throw IllegalStateException("Runtime conversion failed")
    check(++settlements == 1) { "Promise settled twice" }
    result = value as DocumentPickerResult
    done.complete(Unit)
  }
  override fun reject(error: CodedException) {
    check(++settlements == 1) { "Promise settled twice" }
    this.error = error
    done.complete(Unit)
  }
  suspend fun await() = withTimeout(5_000) { done.await() }
}

private class Fixture(val dispatcher: CoroutineDispatcher) {
  val scope = CoroutineScope(dispatcher + SupervisorJob())
  val module = DocumentPickerModule().apply { appContext = AppContext(scope) }
  val definition = module.definition()
  val activity = module.appContext.throwingActivity
  suspend fun open(promise: ResultPromise, copy: Boolean = false) = withContext(dispatcher) {
    definition.open(DocumentPickerOptions(copyToCacheDirectory = copy), promise)
  }
  suspend fun result(code: Int, intent: Intent? = null) = withContext(dispatcher) {
    definition.result(activity, Payload(4137, code, intent))
  }
}

private suspend fun cancelConversionFailure(fixture: Fixture) {
  val promise = ResultPromise().apply { failResolve = true }
  fixture.open(promise)
  // The original module lets this escape the Android activity callback and crash the process.
  fixture.result(Activity.RESULT_CANCELED)
  promise.await()
  check(promise.error != null)
  val next = ResultPromise()
  fixture.open(next)
  fixture.result(Activity.RESULT_CANCELED)
  next.await()
  check(next.result?.canceled == true)
}

private suspend fun launchFailureAndDuplicates(fixture: Fixture) {
  val failed = ResultPromise()
  fixture.activity.launchFailure = IllegalStateException("No foreground activity")
  check(runCatching { fixture.open(failed) }.isFailure)
  failed.reject(CodedException("Launch failed")) // Expo rejects a failed AsyncFunction call.
  fixture.activity.launchFailure = null
  fixture.result(Activity.RESULT_CANCELED) // A late result must not settle the rejected request.
  val next = ResultPromise()
  fixture.open(next)
  withContext(fixture.dispatcher) {
    repeat(2) { fixture.definition.result(fixture.activity, Payload(4137, Activity.RESULT_CANCELED, null)) }
  }
  next.await()
  check(failed.settlements == 1 && next.settlements == 1)
}

private suspend fun providerDoesNotBlockActivity(fixture: Fixture) {
  val reading = CountDownLatch(1)
  val release = CountDownLatch(1)
  DocumentDetailsReader.onRead = {
    check(!Thread.currentThread().name.contains("picker-main")) { "Provider I/O blocked the UI thread" }
    reading.countDown()
    check(release.await(5, TimeUnit.SECONDS))
  }
  try {
    val promise = ResultPromise()
    fixture.open(promise, copy = true)
    fixture.result(Activity.RESULT_OK, Intent().apply { data = Uri("hello") })
    check(reading.await(5, TimeUnit.SECONDS))
    // This must complete while the provider is blocked, and overlapping launches must be refused.
    check(runCatching { fixture.open(ResultPromise()) }.exceptionOrNull() is PickingInProgressException)
    fixture.result(Activity.RESULT_CANCELED)
    check(!promise.done.isCompleted)
    release.countDown()
    promise.await()
    check(promise.result?.assets?.size == 1 && promise.settlements == 1)
  } finally {
    release.countDown()
    DocumentDetailsReader.onRead = {}
  }
}

private suspend fun malformedResultAndRecovery(fixture: Fixture) {
  val promise = ResultPromise()
  fixture.open(promise)
  fixture.result(Activity.RESULT_OK)
  promise.await()
  check(promise.error != null)
  repeat(20) {
    val next = ResultPromise()
    fixture.open(next)
    fixture.result(Activity.RESULT_CANCELED)
    next.await()
    check(next.result?.canceled == true)
  }
}

private suspend fun multipleFiles(fixture: Fixture) {
  val promise = ResultPromise()
  fixture.open(promise)
  fixture.result(Activity.RESULT_OK, Intent().apply {
    clipData = ClipData(listOf(ClipData.Item(Uri("one")), ClipData.Item(Uri("two"))))
  })
  promise.await()
  check(promise.result?.assets?.map { it.uri.value } == listOf("one", "two"))
}

private suspend fun disposedRuntime(fixture: Fixture) {
  val reading = CountDownLatch(1)
  val release = CountDownLatch(1)
  DocumentDetailsReader.onRead = { reading.countDown(); check(release.await(5, TimeUnit.SECONDS)) }
  try {
    val promise = ResultPromise()
    fixture.open(promise)
    fixture.result(Activity.RESULT_OK, Intent().apply { data = Uri("pending") })
    check(reading.await(5, TimeUnit.SECONDS))
    fixture.scope.cancel()
    release.countDown()
    withTimeout(5_000) { fixture.scope.coroutineContext[Job]!!.join() }
    check(promise.settlements == 0) { "Disposed runtime received a callback" }
  } finally { release.countDown(); DocumentDetailsReader.onRead = {} }
}

// A dedicated dispatcher models Android's serial UI thread and is closed after every run.
@OptIn(ObsoleteCoroutinesApi::class, DelicateCoroutinesApi::class)
fun main() = newSingleThreadContext("picker-main").use { dispatcher -> runBlocking {
  val fixture = Fixture(dispatcher)
  try {
    cancelConversionFailure(fixture)
    launchFailureAndDuplicates(fixture)
    providerDoesNotBlockActivity(fixture)
    malformedResultAndRecovery(fixture)
    multipleFiles(fixture)
    check(fixture.definition.queue == Queues.MAIN)
    disposedRuntime(fixture)
    println("PASS: cancellation errors, failed launches, duplicate callbacks, background I/O, retry and teardown")
  } finally { fixture.scope.cancel() }
} }
