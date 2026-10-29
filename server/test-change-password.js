import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Isolated test JWT secret
process.env.JWT_SECRET = 'test_isolated_secret_key_for_change_password_32bytes!';

import User from './models/User.js';
import Student from './models/Student.js';
import { protect } from './middleware/authMiddleware.js';
import { changePassword, login } from './controllers/authController.js';

console.log('=== RUNNING ISOLATED CHANGE PASSWORD TEST SUITE ===\n');

// Valid MongoDB ObjectIds
const STUDENT_USER_ID = new mongoose.Types.ObjectId().toString();
const ADMIN_USER_ID = new mongoose.Types.ObjectId().toString();
const ATTACKER_TARGET_USER_ID = new mongoose.Types.ObjectId().toString();

// Generate real JWT tokens
const studentToken = jwt.sign({ id: STUDENT_USER_ID }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: ADMIN_USER_ID }, process.env.JWT_SECRET);

// Initial plaintext passwords
const STUDENT_INITIAL_PASS = 'StudentPass@2026';
const ADMIN_INITIAL_PASS = 'AdminSecurePass@2026';
const ATTACKER_TARGET_PASS = 'TargetSecretPass@2026';

// Helper to create an in-memory user document mimicking Mongoose behavior
async function createMockUserDoc(data, initialPlaintextPassword) {
  const hashedPassword = await bcrypt.hash(initialPlaintextPassword, 12);
  let currentPassword = hashedPassword;
  let isPasswordModified = false;

  const doc = {
    _id: data._id,
    name: data.name,
    email: data.email,
    college: data.college,
    branch: data.branch,
    year: data.year,
    role: data.role,

    get password() {
      return currentPassword;
    },
    set password(newVal) {
      currentPassword = newVal;
      isPasswordModified = true;
    },

    isModified(field) {
      if (field === 'password') return isPasswordModified;
      return false;
    },

    async matchPassword(enteredPassword) {
      return bcrypt.compare(enteredPassword, currentPassword);
    },

    async save() {
      // Replicate the exact Mongoose pre('save') hook from User.js:
      // if (!this.isModified('password')) return next();
      // this.password = await bcrypt.hash(this.password, 12);
      if (isPasswordModified) {
        currentPassword = await bcrypt.hash(currentPassword, 12);
        isPasswordModified = false;
      }
      return doc;
    },
  };

  return doc;
}

// In-process pipeline executor identical to Express middleware execution
function executePipeline(middlewares, { method = 'PUT', headers = {}, body = {}, params = {}, query = {} } = {}) {
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
  };

  let statusCode = 200;
  let jsonResult = null;
  let finished = false;

  return new Promise((resolvePipeline) => {
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        jsonResult = data;
        finished = true;
        resolvePipeline({ statusCode, data: jsonResult });
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
        jsonResult = { success: false, message: err.message };
        return resolvePipeline({ statusCode, data: jsonResult });
      }
      if (finished || idx >= middlewares.length) {
        return resolvePipeline({ statusCode, data: jsonResult });
      }
      const mw = middlewares[idx++];
      try {
        const result = mw(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch((asyncErr) => {
            if (!finished) {
              statusCode = 500;
              jsonResult = { success: false, message: asyncErr.message };
              resolvePipeline({ statusCode, data: jsonResult });
            }
          });
        }
      } catch (syncErr) {
        if (!finished) {
          statusCode = 500;
          jsonResult = { success: false, message: syncErr.message };
          resolvePipeline({ statusCode, data: jsonResult });
        }
      }
    }

    next();
  });
}

const changePasswordPipeline = [protect, changePassword];
const loginPipeline = [login];

async function runTests() {
  // Save original User and Student model methods
  const origFindById = User.findById;
  const origFindOne = User.findOne;
  const origStudentFindOne = Student.findOne;

  // Stub Student.findOne to return mock student profile so ensureStudentProfile does not trigger un-connected DB insert
  Student.findOne = (query) => Promise.resolve({ _id: new mongoose.Types.ObjectId().toString(), user: query?.user || STUDENT_USER_ID });

  try {
    // Setup in-memory users
    const studentDoc = await createMockUserDoc(
      {
        _id: STUDENT_USER_ID,
        name: 'Sravanthi Student',
        email: 'student@college.edu',
        college: 'College of Engineering',
        branch: 'CSE',
        year: 4,
        role: 'student',
      },
      STUDENT_INITIAL_PASS
    );

    const adminDoc = await createMockUserDoc(
      {
        _id: ADMIN_USER_ID,
        name: 'Placement Admin',
        email: 'admin@college.edu',
        college: 'College of Engineering',
        role: 'admin',
      },
      ADMIN_INITIAL_PASS
    );

    const targetDoc = await createMockUserDoc(
      {
        _id: ATTACKER_TARGET_USER_ID,
        name: 'Target Account',
        email: 'target@college.edu',
        college: 'College of Engineering',
        branch: 'IT',
        year: 3,
        role: 'student',
      },
      ATTACKER_TARGET_PASS
    );

    const usersDb = {
      [STUDENT_USER_ID]: studentDoc,
      [ADMIN_USER_ID]: adminDoc,
      [ATTACKER_TARGET_USER_ID]: targetDoc,
    };

    // Stub User.findById
    User.findById = (id) => {
      const u = usersDb[String(id)];
      return {
        select: (fields) => {
          if (!u) return Promise.resolve(null);
          if (fields === '-password') {
            const { password, ...withoutPassword } = u;
            return Promise.resolve(withoutPassword);
          }
          return Promise.resolve(u);
        },
      };
    };

    // Stub User.findOne
    User.findOne = (query) => {
      const email = query.email?.toLowerCase?.();
      const u = Object.values(usersDb).find((x) => x.email.toLowerCase() === email);
      return {
        select: (fields) => {
          if (!u) return Promise.resolve(null);
          return Promise.resolve(u);
        },
      };
    };

    // ------------------------------------------------------------------------
    // Test 1: Unauthenticated request rejected with HTTP 401
    // ------------------------------------------------------------------------
    console.log('[1/11] Testing unauthenticated change password request rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: {}, // No token
        body: {
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: 'NewPassword123',
          confirmPassword: 'NewPassword123',
        },
      });
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Not authorized'));
      console.log('  ✓ 1.1: Unauthenticated request rejected with HTTP 401.');
    }

    // ------------------------------------------------------------------------
    // Test 2: Missing current password rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[2/11] Testing missing current password rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: '',
          newPassword: 'NewPassword123',
          confirmPassword: 'NewPassword123',
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Current password is required'));
      console.log('  ✓ 2.1: Missing current password rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 3: Missing new password rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[3/11] Testing missing new password rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: '',
          confirmPassword: '',
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('New password is required'));
      console.log('  ✓ 3.1: Missing new password rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 4: New password shorter than 6 characters rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[4/11] Testing short new password (< 6 characters) rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: '12345',
          confirmPassword: '12345',
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('at least 6 characters'));
      console.log('  ✓ 4.1: Short new password rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 5: Mismatched confirm password rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[5/11] Testing mismatched confirm password rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: 'NewValidPassword123',
          confirmPassword: 'DifferentPassword456',
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('do not match'));
      console.log('  ✓ 5.1: Mismatched confirm password rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 6: New password identical to current password rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[6/11] Testing same password reuse rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: STUDENT_INITIAL_PASS,
          confirmPassword: STUDENT_INITIAL_PASS,
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('different from current password'));
      console.log('  ✓ 6.1: Same password reuse rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 7: Incorrect current password rejected with HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n[7/11] Testing incorrect current password rejection...');
    {
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: 'WrongPassword999!',
          newPassword: 'BrandNewPassword123',
          confirmPassword: 'BrandNewPassword123',
        },
      });
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Current password is incorrect'));
      console.log('  ✓ 7.1: Incorrect current password rejected with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // Test 8: Client-supplied userId spoofing ignored
    // ------------------------------------------------------------------------
    console.log('\n[8/11] Testing client-supplied userId spoofing immunity...');
    {
      const targetBeforeHash = targetDoc.password;

      // Student attempts to pass target student's ID in request body
      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          userId: ATTACKER_TARGET_USER_ID,
          _id: ATTACKER_TARGET_USER_ID,
          id: ATTACKER_TARGET_USER_ID,
          currentPassword: STUDENT_INITIAL_PASS,
          newPassword: 'HijackedPassword999',
          confirmPassword: 'HijackedPassword999',
        },
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(data.success, true);

      // Verify target account was NOT modified
      assert.strictEqual(targetDoc.password, targetBeforeHash, 'Target user password must remain untouched');
      const targetMatch = await targetDoc.matchPassword(ATTACKER_TARGET_PASS);
      assert.strictEqual(targetMatch, true, 'Target account must still verify with original password');
      console.log('  ✓ 8.1: Client-supplied userId ignored; target account was unaffected.');
    }

    // ------------------------------------------------------------------------
    // Test 9: Student password change and single-hash verification
    // ------------------------------------------------------------------------
    console.log('\n[9/11] Testing successful student password update & single-hash...');
    {
      const NEW_STUDENT_PASS = 'StudentBrandNewPass#2026';

      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: {
          currentPassword: 'HijackedPassword999', // Set in Test 8 for student
          newPassword: NEW_STUDENT_PASS,
          confirmPassword: NEW_STUDENT_PASS,
        },
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.message, 'Password changed successfully');

      // Verify no passwords or hashes were leaked in response
      assert.strictEqual(data.password, undefined);
      assert.strictEqual(data.user, undefined);

      // Verify the stored hash
      const storedHash = studentDoc.password;
      assert.ok(storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'), 'Must be valid bcrypt hash');

      // Verify password matches plaintext once
      const isPlaintextMatch = await bcrypt.compare(NEW_STUDENT_PASS, storedHash);
      assert.strictEqual(isPlaintextMatch, true, 'Password must verify against single-hash');

      // Verify it was NOT double-hashed (i.e. not hashed before passing to hook)
      const isDoubleHashed = await bcrypt.compare(
        await bcrypt.hash(NEW_STUDENT_PASS, 12),
        storedHash
      );
      assert.strictEqual(isDoubleHashed, false, 'Password must not be double-hashed');
      console.log('  ✓ 9.1: Student password changed successfully with exactly one bcrypt hash.');
    }

    // ------------------------------------------------------------------------
    // Test 10: Admin password change verification
    // ------------------------------------------------------------------------
    console.log('\n[10/11] Testing successful admin password update...');
    {
      const NEW_ADMIN_PASS = 'AdminBrandNewPass#2026';

      const { statusCode, data } = await executePipeline(changePasswordPipeline, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          currentPassword: ADMIN_INITIAL_PASS,
          newPassword: NEW_ADMIN_PASS,
          confirmPassword: NEW_ADMIN_PASS,
        },
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.message, 'Password changed successfully');

      const adminMatch = await adminDoc.matchPassword(NEW_ADMIN_PASS);
      assert.strictEqual(adminMatch, true, 'Admin password must match new password');
      console.log('  ✓ 10.1: Admin password changed successfully.');
    }

    // ------------------------------------------------------------------------
    // Test 11: Subsequent login behavior (New password succeeds, old fails)
    // ------------------------------------------------------------------------
    console.log('\n[11/11] Testing subsequent login behavior...');
    {
      // Login with old student password fails
      const rOldLogin = await executePipeline(loginPipeline, {
        method: 'POST',
        body: {
          email: 'student@college.edu',
          password: STUDENT_INITIAL_PASS,
        },
      });
      assert.strictEqual(rOldLogin.statusCode, 401);
      assert.strictEqual(rOldLogin.data.success, false);
      assert.ok(rOldLogin.data.message.includes('Invalid email or password'));

      // Login with new student password succeeds
      const rNewLogin = await executePipeline(loginPipeline, {
        method: 'POST',
        body: {
          email: 'student@college.edu',
          password: 'StudentBrandNewPass#2026',
        },
      });
      assert.strictEqual(rNewLogin.statusCode, 200);
      assert.strictEqual(rNewLogin.data.success, true);
      assert.ok(rNewLogin.data.data.token, 'Token must be issued upon login with new password');
      console.log('  ✓ 11.1: Subsequent login succeeds with new password and fails with old password.');
    }

    console.log('\n========================================================================');
    console.log('ALL 11 CHANGE PASSWORD TEST SUITES PASSED SUCCESSFULLY!');
    console.log('========================================================================');
  } finally {
    User.findById = origFindById;
    User.findOne = origFindOne;
    Student.findOne = origStudentFindOne;
  }
}

runTests().catch((err) => {
  console.error('\nChange Password Test Failed:', err);
  process.exit(1);
});
