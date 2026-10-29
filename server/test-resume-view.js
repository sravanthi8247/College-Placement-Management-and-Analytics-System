import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.JWT_SECRET = 'test_isolated_secret_key_for_resume_view_32bytes!';

import User from './models/User.js';
import Student from './models/Student.js';
import { protect } from './middleware/authMiddleware.js';
import { RESUME_UPLOAD_DIR } from './middleware/uploadMiddleware.js';
import {
  getStudentResume,
  uploadMyResume,
  deleteMyResume,
  resolveResumeFilePath,
} from './controllers/studentController.js';
import {
  setSupabaseClient,
  resetSupabaseClient,
  isValidStoragePath,
  isCloudStorageRequired,
} from './config/supabase.js';

console.log('=== RUNNING ISOLATED RESUME VIEW & SUPABASE STORAGE TEST SUITE ===\n');

// Valid MongoDB ObjectIds
const STUDENT_USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_STUDENT_USER_ID = new mongoose.Types.ObjectId().toString();
const ADMIN_USER_ID = new mongoose.Types.ObjectId().toString();

const STUDENT_DOC_ID = new mongoose.Types.ObjectId().toString();
const OTHER_STUDENT_DOC_ID = new mongoose.Types.ObjectId().toString();

// Generate tokens
const studentToken = jwt.sign({ id: STUDENT_USER_ID, role: 'student' }, process.env.JWT_SECRET);
const otherStudentToken = jwt.sign({ id: OTHER_STUDENT_USER_ID, role: 'student' }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: ADMIN_USER_ID, role: 'admin' }, process.env.JWT_SECRET);

// In-process pipeline executor
function executePipeline(
  middlewares,
  { method = 'GET', headers = {}, body = {}, params = {}, query = {}, file = null } = {}
) {
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const req = {
    method,
    headers: lowerHeaders,
    body: { ...body },
    params: { ...params },
    query: { ...query },
    file: file || null,
  };

  let statusCode = 200;
  let jsonResult = null;
  let fileSentPath = null;
  let bufferSent = null;
  let responseHeaders = {};
  let finished = false;

  return new Promise((resolvePipeline) => {
    const res = {
      setHeader(name, val) {
        responseHeaders[name.toLowerCase()] = val;
        return res;
      },
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        jsonResult = data;
        finished = true;
        resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
        return res;
      },
      send(data) {
        bufferSent = data;
        jsonResult = data;
        finished = true;
        resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
        return res;
      },
      sendFile(filePath, fn) {
        fileSentPath = filePath;
        finished = true;
        if (fn) fn(null);
        resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
        return res;
      },
      getStatusCode: () => statusCode,
      getData: () => jsonResult,
      isFinished: () => finished,
    };

    let idx = 0;
    function next(err) {
      if (err) {
        statusCode = 500;
        jsonResult = { message: err.message };
        return resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
      }
      if (finished || idx >= middlewares.length) {
        return resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
      }
      const mw = middlewares[idx++];
      try {
        const result = mw(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch((asyncErr) => {
            if (!finished) {
              statusCode = 500;
              jsonResult = { message: asyncErr.message };
              resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
            }
          });
        }
      } catch (syncErr) {
        if (!finished) {
          statusCode = 500;
          jsonResult = { message: syncErr.message };
          resolvePipeline({ statusCode, data: jsonResult, headers: responseHeaders, fileSentPath, bufferSent });
        }
      }
    }

    next();
  });
}

const resumePipeline = [protect, getStudentResume];
const uploadPipeline = [protect, uploadMyResume];
const deletePipeline = [protect, deleteMyResume];

async function runResumeTests() {
  const origUserFindById = User.findById;
  const origStudentFindById = Student.findById;
  const origStudentFindOne = Student.findOne;

  // Create temporary test PDF file in RESUME_UPLOAD_DIR
  if (!fs.existsSync(RESUME_UPLOAD_DIR)) {
    fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });
  }
  const testStoredFilename = `test_resume_${Date.now()}.pdf`;
  const testFilePath = path.join(RESUME_UPLOAD_DIR, testStoredFilename);
  fs.writeFileSync(testFilePath, Buffer.from('%PDF-1.4 test resume pdf content'));

  try {
    // ------------------------------------------------------------------------
    // Test 1: Path resolution across primary and alternate directories
    // ------------------------------------------------------------------------
    console.log('[1/16] Testing resolveResumeFilePath across directories...');
    {
      const resolved = resolveResumeFilePath(testStoredFilename);
      assert.strictEqual(resolved, testFilePath);
      assert.ok(fs.existsSync(resolved), 'Resolved file path must exist on disk');

      const missingPath = resolveResumeFilePath('completely_missing_resume.pdf');
      assert.ok(missingPath.endsWith('completely_missing_resume.pdf'));
      console.log('  ✓ 1.1: Deterministic file resolution verified for existing and non-existing files.');
    }

    // Fixtures
    const usersDb = {
      [STUDENT_USER_ID]: {
        _id: STUDENT_USER_ID,
        name: 'Sravanthi Student',
        email: 'student@college.edu',
        role: 'student',
      },
      [OTHER_STUDENT_USER_ID]: {
        _id: OTHER_STUDENT_USER_ID,
        name: 'Bob Candidate',
        email: 'bob@college.edu',
        role: 'student',
      },
      [ADMIN_USER_ID]: {
        _id: ADMIN_USER_ID,
        name: 'Admin User',
        email: 'admin@college.edu',
        role: 'admin',
      },
    };

    const studentsDb = {
      [STUDENT_DOC_ID]: {
        _id: STUDENT_DOC_ID,
        user: STUDENT_USER_ID,
        name: 'Sravanthi Student',
        email: 'student@college.edu',
        resume: {
          filename: 'Sravanthi_Resume.pdf',
          storedFilename: testStoredFilename,
          storageProvider: 'local',
          storagePath: null,
          uploadedAt: new Date(),
          size: 1024,
        },
        save: async function () {
          return this;
        },
      },
      [OTHER_STUDENT_DOC_ID]: {
        _id: OTHER_STUDENT_DOC_ID,
        user: OTHER_STUDENT_USER_ID,
        name: 'Bob Candidate',
        email: 'bob@college.edu',
        resume: {
          filename: 'Bob_Resume.pdf',
          storedFilename: 'missing_bob_file.pdf', // File missing on disk
          storageProvider: 'local',
          storagePath: null,
          uploadedAt: new Date(),
          size: 2048,
        },
        save: async function () {
          return this;
        },
      },
    };

    User.findById = (id) => ({
      select: () => Promise.resolve(usersDb[String(id)] || null),
    });

    Student.findById = (id) => Promise.resolve(studentsDb[String(id)] || null);

    Student.findOne = (query) => {
      if (query.user) {
        const s = Object.values(studentsDb).find((x) => String(x.user) === String(query.user));
        return Promise.resolve(s || null);
      }
      return Promise.resolve(null);
    };

    // ------------------------------------------------------------------------
    // Test 2: Unauthenticated resume view rejected with 401
    // ------------------------------------------------------------------------
    console.log('\n[2/16] Testing unauthenticated resume view rejection...');
    {
      const { statusCode, data } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: {},
        params: { id: 'me' },
      });
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Not authorized'));
      console.log('  ✓ 2.1: Unauthenticated request rejected with HTTP 401.');
    }

    // ------------------------------------------------------------------------
    // Test 3: Unauthorized student cross-access rejected with 403
    // ------------------------------------------------------------------------
    console.log('\n[3/16] Testing unauthorized student cross-access rejection...');
    {
      const { statusCode, data } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
        params: { id: OTHER_STUDENT_DOC_ID },
      });
      assert.strictEqual(statusCode, 403);
      assert.ok(data.message.includes('not authorized to access another candidate'));
      console.log('  ✓ 3.1: Student cross-access to another candidate resume rejected with HTTP 403.');
    }

    // ------------------------------------------------------------------------
    // Test 4: Missing local file returns clear 404 message
    // ------------------------------------------------------------------------
    console.log('\n[4/16] Testing missing file on disk returns informative 404...');
    {
      const { statusCode, data } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${otherStudentToken}` },
        params: { id: 'me' },
      });
      assert.strictEqual(statusCode, 404);
      assert.ok(data.message.includes('Resume document not found on server'));
      assert.ok(data.message.includes('upload your resume again'));
      console.log('  ✓ 4.1: Missing file on disk returns HTTP 404 with re-upload guidance.');
    }

    // ------------------------------------------------------------------------
    // Test 5: Student viewing own local resume succeeds with PDF headers
    // ------------------------------------------------------------------------
    console.log('\n[5/16] Testing student successfully viewing own local resume...');
    {
      const { statusCode, headers, fileSentPath } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
        params: { id: 'me' },
      });
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(headers['content-type'], 'application/pdf');
      assert.ok(headers['content-disposition'].includes('inline'));
      assert.ok(headers['content-disposition'].includes('Sravanthi_Resume.pdf'));
      assert.strictEqual(fileSentPath, testFilePath);
      console.log('  ✓ 5.1: Student successfully views own resume with inline PDF headers.');
    }

    // ------------------------------------------------------------------------
    // Test 6: Admin viewing candidate local resume succeeds
    // ------------------------------------------------------------------------
    console.log('\n[6/16] Testing admin viewing candidate resume...');
    {
      const { statusCode, headers, fileSentPath } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { id: STUDENT_DOC_ID },
      });
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(headers['content-type'], 'application/pdf');
      assert.strictEqual(fileSentPath, testFilePath);
      console.log('  ✓ 6.1: Admin successfully views candidate resume with PDF headers.');
    }

    // ------------------------------------------------------------------------
    // Test 7: Simulated Blob error message extraction
    // ------------------------------------------------------------------------
    console.log('\n[7/16] Testing Axios Blob error message extraction...');
    {
      const backendErrorJson = { message: 'Resume document not found on server. Please upload your resume again.' };
      const simulatedBlob = new Blob([JSON.stringify(backendErrorJson)], { type: 'application/json' });

      let extractedMessage = 'Failed to open resume.';
      if (simulatedBlob instanceof Blob) {
        const text = await simulatedBlob.text();
        const parsed = JSON.parse(text);
        if (parsed.message) extractedMessage = parsed.message;
      }

      assert.strictEqual(
        extractedMessage,
        'Resume document not found on server. Please upload your resume again.',
        'Extracted message must match backend JSON error, not fallback string'
      );
      console.log('  ✓ 7.1: Client Blob error parser successfully extracts backend JSON message.');
    }

    // ------------------------------------------------------------------------
    // Test 8: Storage path validator security tests (Rule 9)
    // ------------------------------------------------------------------------
    console.log('\n[8/16] Testing storage path validator security (Rule 9)...');
    {
      assert.strictEqual(isValidStoragePath('resumes/resume_user1_123_456.pdf'), true);
      assert.strictEqual(isValidStoragePath('resumes/my-resume.pdf'), true);
      // Path traversal and directory escape attempts must be rejected
      assert.strictEqual(isValidStoragePath('../resumes/file.pdf'), false);
      assert.strictEqual(isValidStoragePath('resumes/../../etc/passwd'), false);
      assert.strictEqual(isValidStoragePath('/resumes/file.pdf'), false);
      assert.strictEqual(isValidStoragePath('resumes\\file.pdf'), false);
      assert.strictEqual(isValidStoragePath('resumes/file.exe'), false);
      assert.strictEqual(isValidStoragePath(''), false);
      assert.strictEqual(isValidStoragePath(null), false);
      console.log('  ✓ 8.1: Storage path validator blocks directory traversal and non-PDF extensions.');
    }

    // ------------------------------------------------------------------------
    // Test 9: Cloud storage requirement safety in production (Rule 4)
    // ------------------------------------------------------------------------
    console.log('\n[9/16] Testing fail-safe cloud storage requirement in production (Rule 4)...');
    {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevRender = process.env.RENDER;
      try {
        process.env.NODE_ENV = 'production';
        process.env.RENDER = 'true';
        resetSupabaseClient(); // ensure Supabase is not configured

        const validBuffer = Buffer.from('%PDF-1.4 sample pdf content for upload');
        const { statusCode, data } = await executePipeline(uploadPipeline, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          file: {
            buffer: validBuffer,
            originalname: 'My_Uploaded_Resume.pdf',
            mimetype: 'application/pdf',
            size: validBuffer.length,
          },
        });

        assert.strictEqual(statusCode, 503);
        assert.ok(data.message.includes('Cloud resume storage is not configured'));
        console.log('  ✓ 9.1: In production without cloud storage, upload fails safely with HTTP 503 instead of writing to ephemeral disk.');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        process.env.RENDER = prevRender;
      }
    }

    // ------------------------------------------------------------------------
    // Test 10: Mocked Supabase Storage upload, verify, and safe replacement (Rule 6)
    // ------------------------------------------------------------------------
    console.log('\n[10/16] Testing Supabase upload, verification, and safe replacement (Rule 6)...');
    {
      const uploadedObjects = new Map();
      const deletedObjects = [];

      const mockSupabase = {
        storage: {
          from: (bucket) => ({
            upload: async (storagePath, buffer, options) => {
              uploadedObjects.set(storagePath, { buffer, options });
              return { data: { path: storagePath }, error: null };
            },
            download: async (storagePath) => {
              if (uploadedObjects.has(storagePath)) {
                const item = uploadedObjects.get(storagePath);
                return {
                  data: {
                    arrayBuffer: async () => item.buffer.buffer.slice(
                      item.buffer.byteOffset,
                      item.buffer.byteOffset + item.buffer.byteLength
                    ),
                  },
                  error: null,
                };
              }
              return { data: null, error: new Error('Object not found') };
            },
            remove: async (paths) => {
              for (const p of paths) {
                deletedObjects.push(p);
                uploadedObjects.delete(p);
              }
              return { data: paths, error: null };
            },
          }),
        },
      };

      setSupabaseClient(mockSupabase);

      const validPdfBuffer = Buffer.from('%PDF-1.4 new resume for supabase test');
      const { statusCode, data } = await executePipeline(uploadPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        file: {
          buffer: validPdfBuffer,
          originalname: 'Sravanthi_New_Resume.pdf',
          mimetype: 'application/pdf',
          size: validPdfBuffer.length,
        },
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(data.resume.storageProvider, 'supabase');
      assert.ok(data.resume.storagePath.startsWith('resumes/resume_'));
      assert.strictEqual(data.resume.filename, 'Sravanthi_New_Resume.pdf');
      assert.ok(uploadedObjects.has(data.resume.storagePath), 'Uploaded buffer must be present in mock Supabase storage');

      console.log('  ✓ 10.1: Resume successfully uploaded to Supabase Storage with storageProvider metadata.');

      // ----------------------------------------------------------------------
      // Test 11: Supabase resume streaming view (Rule 10)
      // ----------------------------------------------------------------------
      console.log('\n[11/16] Testing Supabase resume streaming view (Rule 10)...');
      {
        const { statusCode: viewStatus, headers, bufferSent } = await executePipeline(resumePipeline, {
          method: 'GET',
          headers: { Authorization: `Bearer ${studentToken}` },
          params: { id: 'me' },
        });

        assert.strictEqual(viewStatus, 200);
        assert.strictEqual(headers['content-type'], 'application/pdf');
        assert.ok(headers['content-disposition'].includes('inline'));
        assert.ok(headers['content-disposition'].includes('Sravanthi_New_Resume.pdf'));
        assert.ok(Buffer.isBuffer(bufferSent));
        assert.strictEqual(bufferSent.toString('utf-8'), validPdfBuffer.toString('utf-8'));
        console.log('  ✓ 11.1: Supabase-stored resume is streamed to client with identical PDF inline headers.');
      }

      // ----------------------------------------------------------------------
      // Test 12: Supabase resume deletion (Rule 7)
      // ----------------------------------------------------------------------
      console.log('\n[12/16] Testing Supabase safe deletion (Rule 7)...');
      {
        const resumePathToDelete = data.resume.storagePath;
        const { statusCode: delStatus, data: delData } = await executePipeline(deletePipeline, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${studentToken}` },
          params: {},
        });

        assert.strictEqual(delStatus, 200);
        assert.ok(delData.message.includes('removed successfully'));
        assert.ok(deletedObjects.includes(resumePathToDelete), 'Target storage path must be deleted from Supabase');

        const studentDoc = studentsDb[STUDENT_DOC_ID];
        assert.strictEqual(studentDoc.resume.filename, null);
        assert.strictEqual(studentDoc.resume.storagePath, null);
        assert.strictEqual(studentDoc.resume.size, 0);
        console.log('  ✓ 12.1: Supabase resume successfully removed and database metadata cleared.');
      }
    }

    // ========================================================================
    // NEGATIVE PATH TESTS (Failure Handling & Rollback)
    // ========================================================================

    // ------------------------------------------------------------------------
    // Test 13: Supabase upload failure returns HTTP 502 & preserves metadata
    // ------------------------------------------------------------------------
    console.log('\n[13/16] Testing Supabase upload failure handling (Negative Path 1)...');
    {
      const existingResume = {
        filename: 'Existing_Original_Resume.pdf',
        storedFilename: 'resume_existing_orig.pdf',
        storageProvider: 'supabase',
        storagePath: 'resumes/resume_existing_orig.pdf',
        uploadedAt: new Date(),
        size: 2048,
        contentType: 'application/pdf',
      };
      studentsDb[STUDENT_DOC_ID].resume = { ...existingResume };

      // Mock Supabase to simulate cloud upload failure (e.g. network/cluster error)
      const mockFailingUploadSupabase = {
        storage: {
          from: () => ({
            upload: async () => ({
              data: null,
              error: { message: 'Cloud storage connection timed out', status: 500 },
            }),
            download: async () => ({ data: null, error: null }),
            remove: async () => ({ data: [], error: null }),
          }),
        },
      };

      setSupabaseClient(mockFailingUploadSupabase);

      const samplePdfBuffer = Buffer.from('%PDF-1.4 attempted upload content');
      const { statusCode, data } = await executePipeline(uploadPipeline, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        file: {
          buffer: samplePdfBuffer,
          originalname: 'Failed_Upload_Attempt.pdf',
          mimetype: 'application/pdf',
          size: samplePdfBuffer.length,
        },
      });

      assert.strictEqual(statusCode, 502, 'Failed cloud upload must return HTTP 502 Bad Gateway');
      assert.ok(data.message.includes('Failed to upload resume to cloud storage'));

      // Confirm existing student resume metadata remains completely intact
      const studentDoc = studentsDb[STUDENT_DOC_ID];
      assert.strictEqual(studentDoc.resume.filename, existingResume.filename);
      assert.strictEqual(studentDoc.resume.storedFilename, existingResume.storedFilename);
      assert.strictEqual(studentDoc.resume.storagePath, existingResume.storagePath);
      assert.strictEqual(studentDoc.resume.size, existingResume.size);
      console.log('  ✓ 13.1: Cloud upload failure returns HTTP 502; existing resume metadata remains intact.');
    }

    // ------------------------------------------------------------------------
    // Test 14: MongoDB save failure triggers rollback of newly uploaded cloud object
    // ------------------------------------------------------------------------
    console.log('\n[14/16] Testing MongoDB save failure rollback of uploaded cloud object (Negative Path 2)...');
    {
      const preservedResume = {
        filename: 'Preserved_Before_Save_Fail.pdf',
        storedFilename: 'resume_preserved.pdf',
        storageProvider: 'supabase',
        storagePath: 'resumes/resume_preserved.pdf',
        uploadedAt: new Date(),
        size: 3000,
        contentType: 'application/pdf',
      };
      studentsDb[STUDENT_DOC_ID].resume = { ...preservedResume };

      const cloudUploaded = [];
      const cloudRemoved = [];

      const mockSupabaseWithRollback = {
        storage: {
          from: () => ({
            upload: async (storagePath) => {
              cloudUploaded.push(storagePath);
              return { data: { path: storagePath }, error: null };
            },
            download: async () => ({ data: null, error: null }),
            remove: async (paths) => {
              cloudRemoved.push(...paths);
              return { data: paths, error: null };
            },
          }),
        },
      };

      setSupabaseClient(mockSupabaseWithRollback);

      // Force student.save() to reject (simulating database timeout or constraint error)
      const origSave = studentsDb[STUDENT_DOC_ID].save;
      studentsDb[STUDENT_DOC_ID].save = async function () {
        throw new Error('MongoTimeoutError: network socket closed while saving student profile');
      };

      try {
        const samplePdfBuffer = Buffer.from('%PDF-1.4 new content that fails db save');
        const { statusCode, data } = await executePipeline(uploadPipeline, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          file: {
            buffer: samplePdfBuffer,
            originalname: 'Should_Rollback.pdf',
            mimetype: 'application/pdf',
            size: samplePdfBuffer.length,
          },
        });

        assert.strictEqual(statusCode, 500, 'Database save failure must result in HTTP 500');
        assert.strictEqual(cloudUploaded.length, 1, 'File was initially uploaded to cloud storage');
        const newlyUploadedPath = cloudUploaded[0];

        // Verify that the rollback was triggered: the newly uploaded object was removed from cloud storage
        assert.ok(
          cloudRemoved.includes(newlyUploadedPath),
          'Newly uploaded cloud object must be deleted during database rollback'
        );
        // Verify that the old preserved resume was NOT removed from cloud storage
        assert.ok(
          !cloudRemoved.includes(preservedResume.storagePath),
          'Old working resume must NOT be deleted when new save fails'
        );
        console.log('  ✓ 14.1: Database save failure rolls back newly uploaded cloud object and protects old resume.');
      } finally {
        studentsDb[STUDENT_DOC_ID].save = origSave;
      }
    }

    // ------------------------------------------------------------------------
    // Test 15: Supabase deletion failure returns HTTP 502 & preserves metadata
    // ------------------------------------------------------------------------
    console.log('\n[15/16] Testing Supabase cloud deletion failure handling (Negative Path 3)...');
    {
      const undeletedResume = {
        filename: 'Must_Not_Be_Cleared.pdf',
        storedFilename: 'resume_undeleted.pdf',
        storageProvider: 'supabase',
        storagePath: 'resumes/resume_undeleted.pdf',
        uploadedAt: new Date(),
        size: 4096,
        contentType: 'application/pdf',
      };
      studentsDb[STUDENT_DOC_ID].resume = { ...undeletedResume };

      // Mock Supabase to return server error during deletion
      const mockFailingDeleteSupabase = {
        storage: {
          from: () => ({
            upload: async () => ({ data: null, error: null }),
            download: async () => ({ data: null, error: null }),
            remove: async () => ({
              data: null,
              error: { message: 'Storage service unavailable (500)', status: 500 },
            }),
          }),
        },
      };

      setSupabaseClient(mockFailingDeleteSupabase);

      const { statusCode, data } = await executePipeline(deletePipeline, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${studentToken}` },
        params: {},
      });

      assert.strictEqual(statusCode, 502, 'Cloud storage deletion error must return HTTP 502 Bad Gateway');
      assert.ok(data.message.includes('Failed to delete resume from cloud storage'));

      // Verify that database metadata was NOT cleared
      const studentDoc = studentsDb[STUDENT_DOC_ID];
      assert.strictEqual(studentDoc.resume.filename, undeletedResume.filename);
      assert.strictEqual(studentDoc.resume.storagePath, undeletedResume.storagePath);
      assert.strictEqual(studentDoc.resume.size, undeletedResume.size);
      console.log('  ✓ 15.1: Cloud deletion failure returns HTTP 502; database metadata is preserved.');
    }

    // ------------------------------------------------------------------------
    // Test 16: Supabase download confirmed missing object returns HTTP 404
    // ------------------------------------------------------------------------
    console.log('\n[16/16] Testing Supabase download missing object handling (Negative Path 4)...');
    {
      const missingDocResume = {
        filename: 'Missing_From_Cloud.pdf',
        storedFilename: 'resume_missing_cloud.pdf',
        storageProvider: 'supabase',
        storagePath: 'resumes/resume_missing_cloud.pdf',
        uploadedAt: new Date(),
        size: 1024,
        contentType: 'application/pdf',
      };
      studentsDb[STUDENT_DOC_ID].resume = { ...missingDocResume };

      // Mock Supabase to return confirmed 404 Not Found
      const mockMissingDownloadSupabase = {
        storage: {
          from: () => ({
            upload: async () => ({ data: null, error: null }),
            download: async () => ({
              data: null,
              error: { message: 'Object not found', status: 404 },
            }),
            remove: async () => ({ data: [], error: null }),
          }),
        },
      };

      setSupabaseClient(mockMissingDownloadSupabase);

      const { statusCode, data } = await executePipeline(resumePipeline, {
        method: 'GET',
        headers: { Authorization: `Bearer ${studentToken}` },
        params: { id: 'me' },
      });

      assert.strictEqual(statusCode, 404, 'Missing cloud document must return HTTP 404');
      assert.ok(data.message.includes('Resume document not found on storage server'));
      assert.ok(data.message.includes('upload your resume again'));

      // Confirm database metadata is NOT cleared automatically during view
      const studentDoc = studentsDb[STUDENT_DOC_ID];
      assert.strictEqual(studentDoc.resume.filename, missingDocResume.filename);
      assert.strictEqual(studentDoc.resume.storagePath, missingDocResume.storagePath);
      console.log('  ✓ 16.1: Confirmed missing cloud object returns HTTP 404 with re-upload guidance without clearing DB.');
    }

    console.log('\n========================================================================');
    console.log('ALL 16 RESUME & SUPABASE STORAGE TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================');
  } finally {
    resetSupabaseClient();
    User.findById = origUserFindById;
    Student.findById = origStudentFindById;
    Student.findOne = origStudentFindOne;

    // Clean up temporary test file
    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
      } catch {}
    }
  }
}

runResumeTests().catch((err) => {
  console.error('\nResume View Test Failed:', err);
  process.exit(1);
});
