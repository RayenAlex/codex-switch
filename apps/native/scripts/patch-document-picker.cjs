const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_VERSION = '13.1.6';
const ORIGINAL_LIFECYCLE = `      appContext.throwingActivity.startActivityForResult(intent, OPEN_DOCUMENT_CODE)
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != OPEN_DOCUMENT_CODE || pendingPromise == null) {
        return@OnActivityResult
      }

      val promise = pendingPromise!!

      if (resultCode == Activity.RESULT_OK) {
        try {
          if (intent?.clipData != null) {
            handleMultipleSelection(intent)
          } else {
            handleSingleSelection(intent)
          }
        } catch (e: Exception) {
          promise.reject(e.toCodedException())
        }
      } else {
        promise.resolve(
          DocumentPickerResult(canceled = true)
        )
      }

      pendingPromise = null
    }`;

const SAFE_LIFECYCLE = `      try {
        appContext.throwingActivity.startActivityForResult(intent, OPEN_DOCUMENT_CODE)
      } catch (e: Exception) {
        pendingPromise = null
        throw e
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != OPEN_DOCUMENT_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      // Consume the callback before settling or yielding: a duplicate result must not settle it twice.
      pendingPromise = null
      processingResult = true
      appContext.mainQueue.launch {
        try {
          val result = if (resultCode != Activity.RESULT_OK) {
            DocumentPickerResult(canceled = true)
          } else {
            // Document providers can block on disk or network I/O, including while copying to cache.
            withContext(Dispatchers.IO) {
              if (intent?.clipData != null) handleMultipleSelection(intent) else handleSingleSelection(intent)
            }
          }
          processingResult = false
          promise.resolve(result)
        } catch (e: CancellationException) {
          // The owning React context was destroyed; do not call back into its disposed runtime.
          throw e
        } catch (e: Exception) {
          promise.reject(e.toCodedException())
        } finally {
          processingResult = false
        }
      }
    }`;

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) {
    throw new Error('Document picker source changed; review the Android lifecycle fix before rebuilding.');
  }
  return source.replace(before, after);
}

/** Keep all request ownership on the main queue and move provider I/O off the Android activity callback. */
function patchDocumentPicker(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let result = source.replace(/\r\n/g, '\n');
  if (result.includes(SAFE_LIFECYCLE)) return source;
  const edits = [
    ['import expo.modules.kotlin.Promise', `import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext`],
    ['  private var pendingPromise: Promise? = null',
      '  private var pendingPromise: Promise? = null\n  private var processingResult = false'],
    ['if (pendingPromise != null)', 'if (pendingPromise != null || processingResult)'],
    // Validate before claiming the request so a failed launch cannot leave a rejected promise behind.
    ['      pendingPromise = promise\n', ''],
    [ORIGINAL_LIFECYCLE, '      pendingPromise = promise\n' + SAFE_LIFECYCLE],
    ['private fun handleSingleSelection(intent: Intent?) {\n    intent?.data?.let',
      'private fun handleSingleSelection(intent: Intent?): DocumentPickerResult {\n    return intent?.data?.let'],
    ['      pendingPromise?.resolve(result)', '      result'],
    ['private fun handleMultipleSelection(intent: Intent?) {',
      'private fun handleMultipleSelection(intent: Intent?): DocumentPickerResult {'],
    ['    pendingPromise?.resolve(DocumentPickerResult(assets = assets))',
      '    return DocumentPickerResult(assets = assets)'],
  ];
  for (const [before, after] of edits) result = replaceOnce(result, before, after);
  return result.replace(/\n/g, newline);
}

function applyDocumentPickerPatch() {
  const manifestPath = require.resolve('expo-document-picker/package.json', { paths: [path.resolve(__dirname, '..')] });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== PACKAGE_VERSION) {
    throw new Error(`Review the Android document picker fix before using expo-document-picker ${manifest.version}.`);
  }
  const sourcePath = path.join(path.dirname(manifestPath),
    'android/src/main/java/expo/modules/documentpicker/DocumentPickerModule.kt');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const patched = patchDocumentPicker(source);
  if (source !== patched) fs.writeFileSync(sourcePath, patched);
}

if (require.main === module) applyDocumentPickerPatch();
module.exports = { applyDocumentPickerPatch, patchDocumentPicker };
