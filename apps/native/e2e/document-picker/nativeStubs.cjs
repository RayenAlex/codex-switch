// Host adapters execute the installed Kotlin module's real lifecycle and coroutine code.
module.exports = {
  'Activity.kt': `package android.app
import android.content.Intent
open class Activity {
  var launchFailure: Exception? = null
  fun startActivityForResult(intent: Intent, code: Int) { launchFailure?.let { throw it } }
  companion object { const val RESULT_OK = -1; const val RESULT_CANCELED = 0 }
}`,
  'Context.kt': `package android.content
import android.net.Uri
import java.io.File
class Context {
  val cacheDir = File(System.getProperty("java.io.tmpdir"))
  val contentResolver = ContentResolver()
}
class ContentResolver { fun openInputStream(uri: Uri) = uri.value.byteInputStream() }
class Intent(val action: String = "") {
  var data: Uri? = null
  var clipData: ClipData? = null
  var type: String = ""
  fun addCategory(value: String) {}
  fun putExtra(key: String, value: Any) {}
  companion object {
    const val ACTION_OPEN_DOCUMENT = "open"; const val CATEGORY_OPENABLE = "openable"
    const val EXTRA_ALLOW_MULTIPLE = "multiple"; const val EXTRA_MIME_TYPES = "types"
  }
}
class ClipData(val items: List<Item>) {
  val itemCount get() = items.size
  fun getItemAt(index: Int) = items[index]
  class Item(val uri: Uri?)
}`,
  'Uri.kt': `package android.net
import java.io.File
data class Uri(val value: String) { companion object { fun fromFile(file: File) = Uri(file.path) } }`,
  'FileUtilities.kt': `package expo.modules.core.utilities
import java.io.File
object FileUtilities {
  fun generateOutputPath(cache: File, directory: String, extension: String) =
    File.createTempFile("picker-test-", ".$extension", cache).apply { deleteOnExit() }.path
}`,
  'IOUtils.kt': `package org.apache.commons.io
import java.io.InputStream
import java.io.OutputStream
object FilenameUtils { fun getExtension(name: String) = name.substringAfterLast('.', "") }
object IOUtils { fun copy(input: InputStream?, output: OutputStream) = input!!.copyTo(output) }`,
  'Promise.kt': `package expo.modules.kotlin
import expo.modules.kotlin.exception.CodedException
interface Promise { fun resolve(value: Any?); fun reject(error: CodedException) }`,
  'Exceptions.kt': `package expo.modules.kotlin.exception
open class CodedException(message: String) : Exception(message)
object Exceptions { class ReactContextLost : CodedException("Context lost") }
fun Exception.toCodedException() = CodedException(message ?: "Failure")`,
  'Queues.kt': `package expo.modules.kotlin.functions
enum class Queues { MAIN, DEFAULT }`,
  'Module.kt': `package expo.modules.kotlin.modules
import android.app.Activity
import android.content.Context
import android.content.Intent
import expo.modules.documentpicker.DocumentPickerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import kotlinx.coroutines.CoroutineScope
class AppContext(val mainQueue: CoroutineScope) {
  val throwingActivity = Activity()
  val reactContext: Context? = Context()
}
abstract class Module {
  lateinit var appContext: AppContext
  abstract fun definition(): ModuleDefinitionData
}
data class Payload(val requestCode: Int, val resultCode: Int, val intent: Intent?)
class ModuleDefinitionData {
  lateinit var open: (DocumentPickerOptions, Promise) -> Unit
  lateinit var result: (Activity, Payload) -> Unit
  var queue = Queues.DEFAULT
  fun Name(name: String) {}
  fun AsyncFunction(name: String, body: (DocumentPickerOptions, Promise) -> Unit): ModuleDefinitionData {
    open = body; return this
  }
  fun runOnQueue(value: Queues) { queue = value }
  fun OnActivityResult(body: (Activity, Payload) -> Unit) { result = body }
}
fun Module.ModuleDefinition(body: ModuleDefinitionData.() -> Unit) = ModuleDefinitionData().apply(body)`,
  'Documents.kt': `package expo.modules.documentpicker
import android.content.Context
import android.net.Uri
data class DocumentPickerOptions(val copyToCacheDirectory: Boolean = false,
  val type: List<String> = listOf("*/*"), val multiple: Boolean = true)
data class DocumentPickerResult(val canceled: Boolean = false, val assets: List<DocumentInfo>? = null)
data class DocumentInfo(val uri: Uri, val name: String = "test.txt")
class DocumentDetailsReader(context: Context) {
  fun read(uri: Uri): DocumentInfo { onRead(); return DocumentInfo(uri) }
  companion object { var onRead: () -> Unit = {} }
}`,
};
