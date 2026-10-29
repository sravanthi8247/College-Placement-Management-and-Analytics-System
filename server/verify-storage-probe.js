import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// ----------------------------------------------------------------------------
// 1. ENVIRONMENT LOADING
// Load server/.env FIRST before any module reads process.env.
// No environment variables, secrets, or API keys are printed.
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// ----------------------------------------------------------------------------
// 2. SANITIZED STATUS EXTRACTOR
// Extracts only numeric status or error code names.
// Raw error messages, stack traces, URLs, and headers are completely suppressed.
// ----------------------------------------------------------------------------
function getSanitizedStatus(error) {
  if (!error) return 'UNKNOWN_ERROR';
  if (typeof error.status === 'number' || typeof error.status === 'string') {
    return String(error.status);
  }
  if (typeof error.statusCode === 'number' || typeof error.statusCode === 'string') {
    return String(error.statusCode);
  }
  if (error.name && typeof error.name === 'string') {
    return error.name;
  }
  return 'GENERIC_ERROR';
}

// ----------------------------------------------------------------------------
// 3. TIMEOUT LIMITATION EXPLANATION
// The shared helper functions in ./config/supabase.js wrap @supabase/supabase-js
// and do not accept an AbortSignal or cancellation token for the underlying fetch.
// Wrapping calls in Promise.race with a client-side timer would NOT cancel an in-flight
// remote HTTP request, creating a false impression of abort safety.
// To avoid misleading cancellation claims, calls are awaited directly, relying on
// Node.js TCP/socket timeout defaults.
// ----------------------------------------------------------------------------

async function runStorageProbe() {
  console.log('=== STANDALONE SUPABASE STORAGE PROBE ===\n');

  // Operation state tracking (Ensures final summary always prints)
  let currentOperation = 'IMPORT';
  let importStatus = 'NOT_RUN';
  let initStatus = 'NOT_RUN';
  let uploadStatus = 'NOT_RUN';
  let downloadStatus = 'NOT_RUN';
  let integrityStatus = 'NOT_RUN';
  let cleanupStatus = 'NOT_RUN';
  let uploadAttempted = false;
  let primaryErrorStatus = null;
  let cleanupErrorStatus = null;
  let summaryPrinted = false;

  let bucketName = 'unknown-bucket';
  let testStoragePath = null;
  let deleteResumeFromSupabase = null;

  try {
    try {
      // ------------------------------------------------------------------------
      // Step A: Dynamic Import of Supabase Helpers (Inside protected flow)
      // ------------------------------------------------------------------------
      currentOperation = 'IMPORT';
      let supabaseHelpers;
      try {
        supabaseHelpers = await import('./config/supabase.js');
        importStatus = 'SUCCESS';
      } catch (importErr) {
        importStatus = 'FAILED';
        primaryErrorStatus = getSanitizedStatus(importErr);
        console.log(`Module import check: FAILED (Status: ${primaryErrorStatus})`);
        return;
      }

      const {
        getBucketName,
        isValidStoragePath,
        uploadResumeToSupabase,
        downloadResumeFromSupabase,
      } = supabaseHelpers;
      deleteResumeFromSupabase = supabaseHelpers.deleteResumeFromSupabase;

      // ------------------------------------------------------------------------
      // Step B: Initialization & Path Validation
      // ------------------------------------------------------------------------
      currentOperation = 'INITIALIZATION';
      bucketName = getBucketName();

      const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      testStoragePath = `resumes/storage_probe_${uniqueId}.pdf`;

      if (!isValidStoragePath(testStoragePath)) {
        initStatus = 'FAILED';
        primaryErrorStatus = 'INVALID_FORMAT';
        console.log('Initialization check: FAILED (Status: INVALID_FORMAT)');
        return;
      }

      initStatus = 'SUCCESS';
      console.log('Initialization check: SUCCESS');
      console.log(`Target Bucket: ${bucketName}`);
      console.log(`Target Object: ${testStoragePath}`);

      // Minimal valid PDF structure with dynamically calculated byte length
      const dummyPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
      );
      const expectedByteLength = dummyPdfBuffer.length;

      // ------------------------------------------------------------------------
      // Step C: Upload Probe PDF (application/pdf)
      // ------------------------------------------------------------------------
      currentOperation = 'UPLOAD';
      console.log('\n[1/3] Executing upload probe...');
      uploadAttempted = true;

      const uploadResult = await uploadResumeToSupabase(
        testStoragePath,
        dummyPdfBuffer,
        'application/pdf'
      );

      if (uploadResult?.success) {
        uploadStatus = 'SUCCESS';
        console.log('  ✓ Upload check: SUCCESS');

        // ----------------------------------------------------------------------
        // Step D: Download Probe PDF & Binary Verification (Only if upload succeeded)
        // ----------------------------------------------------------------------
        currentOperation = 'DOWNLOAD';
        console.log('\n[2/3] Executing download probe & binary verification...');
        const downloadResult = await downloadResumeFromSupabase(testStoragePath);

        if (downloadResult?.success && Buffer.isBuffer(downloadResult?.buffer)) {
          downloadStatus = 'SUCCESS';
          console.log('  ✓ Download check: SUCCESS');

          currentOperation = 'BYTE_VERIFICATION';
          const actualByteLength = downloadResult.buffer.length;
          const lengthMatches = actualByteLength === expectedByteLength;
          const bytesMatch = Buffer.compare(downloadResult.buffer, dummyPdfBuffer) === 0;

          if (lengthMatches && bytesMatch) {
            integrityStatus = 'SUCCESS';
            console.log(`  ✓ Byte integrity check: SUCCESS (Bytes matched: ${actualByteLength}/${expectedByteLength})`);
          } else {
            integrityStatus = 'FAILED';
            primaryErrorStatus = 'BYTE_MISMATCH';
            console.log(`  ✗ Byte integrity check: FAILED (Status: MISMATCH, Expected: ${expectedByteLength}, Received: ${actualByteLength})`);
          }
        } else {
          downloadStatus = 'FAILED';
          integrityStatus = 'SKIPPED';
          primaryErrorStatus = getSanitizedStatus(downloadResult?.error);
          console.log(`  ✗ Download check: FAILED (Status: ${primaryErrorStatus})`);
        }
      } else {
        uploadStatus = 'FAILED';
        downloadStatus = 'SKIPPED';
        integrityStatus = 'SKIPPED';
        primaryErrorStatus = getSanitizedStatus(uploadResult?.error);
        console.log(`  ✗ Upload check: FAILED (Status: ${primaryErrorStatus})`);
      }
    } catch (innerErr) {
      primaryErrorStatus = primaryErrorStatus || getSanitizedStatus(innerErr);
      if (currentOperation === 'IMPORT') {
        importStatus = 'FAILED';
        console.log(`Module import check: FAILED (Status: ${primaryErrorStatus})`);
      } else if (currentOperation === 'INITIALIZATION') {
        initStatus = 'FAILED';
        console.log(`Initialization check: FAILED (Status: ${primaryErrorStatus})`);
      } else if (currentOperation === 'UPLOAD') {
        uploadStatus = 'FAILED';
        downloadStatus = 'SKIPPED';
        integrityStatus = 'SKIPPED';
        console.log(`  ✗ Upload exception: FAILED (Status: ${primaryErrorStatus})`);
      } else if (currentOperation === 'DOWNLOAD') {
        downloadStatus = 'FAILED';
        integrityStatus = 'SKIPPED';
        console.log(`  ✗ Download exception: FAILED (Status: ${primaryErrorStatus})`);
      } else if (currentOperation === 'BYTE_VERIFICATION') {
        integrityStatus = 'FAILED';
        console.log(`  ✗ Byte verification exception: FAILED (Status: ${primaryErrorStatus})`);
      } else {
        console.log(`  ✗ ${currentOperation} exception: FAILED (Status: ${primaryErrorStatus})`);
      }
    } finally {
      // ------------------------------------------------------------------------
      // Step E: Unconditional Cleanup Attempt in finally
      // ------------------------------------------------------------------------
      if (uploadAttempted && typeof deleteResumeFromSupabase === 'function') {
        currentOperation = 'CLEANUP';
        console.log('\n[3/3] Executing cleanup probe...');

        const isSafeProbePath =
          typeof testStoragePath === 'string' &&
          testStoragePath.startsWith('resumes/storage_probe_') &&
          testStoragePath.endsWith('.pdf');

        if (!isSafeProbePath) {
          cleanupStatus = 'ABORTED_INVALID_PATH';
          cleanupErrorStatus = 'INVARIANT_VIOLATION';
          console.log('  ✗ Cleanup check: ABORTED (Status: INVARIANT_VIOLATION)');
        } else {
          try {
            const deleteResult = await deleteResumeFromSupabase(testStoragePath);
            if (deleteResult?.success) {
              // In @supabase/storage-js, remove() returns data as an array of deleted entries.
              // data.length > 0 confirms an existing object was actually removed.
              // data.length === 0 means the object was already missing in Supabase.
              const removedEntries = Array.isArray(deleteResult?.data) ? deleteResult.data : [];
              const confirmedRemoved = removedEntries.length > 0;

              if (uploadStatus === 'SUCCESS') {
                if (confirmedRemoved) {
                  cleanupStatus = 'CONFIRMED_DELETED';
                  console.log('  ✓ Cleanup check: SUCCESS (Confirmed removed from bucket)');
                } else {
                  cleanupStatus = 'OBJECT_MISSING_UNEXPECTEDLY';
                  cleanupErrorStatus = 'OBJECT_ALREADY_MISSING';
                  console.log('  ✗ Cleanup check: FAILED (Status: OBJECT_ALREADY_MISSING)');
                }
              } else {
                if (confirmedRemoved) {
                  cleanupStatus = 'CONFIRMED_DELETED';
                  console.log('  ✓ Cleanup check: SUCCESS (Defensively removed partially uploaded object)');
                } else {
                  cleanupStatus = 'CONFIRMED_MISSING_POST_UPLOAD_FAILURE';
                  console.log('  ℹ Cleanup check: NOTED (Object confirmed missing after upload failure)');
                }
              }
            } else {
              cleanupStatus = 'FAILED';
              cleanupErrorStatus = getSanitizedStatus(deleteResult?.error);
              console.log(`  ✗ Cleanup check: FAILED (Status: ${cleanupErrorStatus})`);
            }
          } catch (cleanupErr) {
            cleanupStatus = 'FAILED';
            cleanupErrorStatus = getSanitizedStatus(cleanupErr);
            console.log(`  ✗ Cleanup check: FAILED (Status: ${cleanupErrorStatus})`);
          }
        }
      } else if (uploadAttempted) {
        cleanupStatus = 'FAILED_NO_CLEANUP_HELPER';
        cleanupErrorStatus = 'HELPER_UNAVAILABLE';
        console.log('\n[3/3] Cleanup check: FAILED (Status: HELPER_UNAVAILABLE)');
      } else {
        cleanupStatus = 'SKIPPED_NOT_UPLOADED';
      }
    }
  } catch (outerErr) {
    if (!primaryErrorStatus) {
      primaryErrorStatus = getSanitizedStatus(outerErr);
    }
  } finally {
    // ------------------------------------------------------------------------
    // Step F: Outermost Finally Summary (Guaranteed to run, avoid duplicates)
    // ------------------------------------------------------------------------
    if (!summaryPrinted) {
      summaryPrinted = true;

      const isPassed =
        importStatus === 'SUCCESS' &&
        initStatus === 'SUCCESS' &&
        uploadStatus === 'SUCCESS' &&
        downloadStatus === 'SUCCESS' &&
        integrityStatus === 'SUCCESS' &&
        cleanupStatus === 'CONFIRMED_DELETED';

      console.log('\n======================================================');
      console.log('FINAL SUMMARY');
      console.log('======================================================');
      console.log(`Module Import Status:  ${importStatus}`);
      console.log(`Initialization Status: ${initStatus}`);
      console.log(`Upload Status:         ${uploadStatus}`);
      console.log(`Download Status:       ${downloadStatus}`);
      console.log(`Byte Integrity Status: ${integrityStatus}`);
      console.log(`Cleanup Status:        ${cleanupStatus}`);
      console.log('------------------------------------------------------');

      if (isPassed) {
        console.log('RESULT: PROBE PASSED (All operations verified)');
        process.exitCode = 0;
      } else {
        console.log('RESULT: PROBE FAILED');
        process.exitCode = 1;

        if (primaryErrorStatus) {
          console.log(`Primary Failure Status: ${primaryErrorStatus}`);
        }

        if (cleanupStatus === 'CONFIRMED_MISSING_POST_UPLOAD_FAILURE') {
          console.log('Note: Object confirmed missing after upload failure (No orphaned object left).');
        } else if (cleanupStatus === 'OBJECT_MISSING_UNEXPECTEDLY') {
          console.log('Warning: Upload succeeded, but cleanup reported 0 objects removed.');
        } else if (uploadAttempted && cleanupStatus !== 'CONFIRMED_DELETED') {
          console.log(`\n⚠ WARNING: Cleanup status unknown or failed (Status: ${cleanupErrorStatus || 'FAILED'}).`);
          console.log(`Temporary object may remain in bucket: ${testStoragePath}`);
          console.log(`ACTION REQUIRED: Verify bucket "${bucketName}" manually for probe object.`);
        }
      }
      console.log('======================================================');
    }
  }
}

// Properly awaited top-level execution handling unexpected rejections
try {
  await runStorageProbe();
} catch (topLevelErr) {
  process.exitCode = 1;
  const status = getSanitizedStatus(topLevelErr);
  console.log(`\nFATAL: Unhandled probe error (Status: ${status})`);
  console.log('RESULT: PROBE FAILED');
}
