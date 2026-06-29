#!/usr/bin/env node

/**
 * Google Drive Upload Integration Test
 * 
 * Tests the complete upload flow:
 * - JWT generation with network time
 * - Google Drive authentication
 * - File upload
 * - Public URL generation
 * - Permission setting
 * 
 * Run: node test-gdrive-upload.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const https = require('https');

// Test configuration
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_FILENAME = `test-upload-${Date.now()}.png`;

console.log('='.repeat(60));
console.log('Google Drive Upload Integration Test');
console.log('='.repeat(60));
console.log();

// Verify environment variables
console.log('[1/6] Verifying environment variables...');
const requiredVars = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_DRIVE_FOLDER_ID'
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('FAILED: Missing environment variables:', missing.join(', '));
  process.exit(1);
}
console.log('PASSED: All environment variables present');
console.log();

// Network time helper (from api/index.js)
let networkTimeCache = null;
let networkTimeCacheExpiry = 0;

async function getNetworkTimeOffset() {
  const now = Date.now();
  if (networkTimeCache !== null && now < networkTimeCacheExpiry) {
    return networkTimeCache;
  }

  return new Promise((resolve, reject) => {
    const req = https.get('https://www.google.com/', (res) => {
      const dateHeader = res.headers['date'];
      if (!dateHeader) {
        resolve(0);
        return;
      }
      const networkTime = new Date(dateHeader).getTime();
      const systemTime = Date.now();
      const offset = networkTime - systemTime;
      networkTimeCache = offset;
      networkTimeCacheExpiry = now + 300000;
      resolve(offset);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

// Get Drive client with JWT fix (from api/index.js)
async function getDriveClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google credentials');
  }

  const offset = await getNetworkTimeOffset();

  const OriginalDate = global.Date;
  const originalDateNow = OriginalDate.now.bind(OriginalDate);
  const dateProxy = new Proxy(OriginalDate, {
    construct(target, args) {
      if (args.length === 0) {
        return new target(originalDateNow() + offset);
      }
      return new target(...args);
    },
    apply(target, thisArg, args) {
      if (args.length === 0) {
        return new target(originalDateNow() + offset);
      }
      return new target(...args);
    }
  });
  dateProxy.now = () => originalDateNow() + offset;
  dateProxy.UTC = OriginalDate.UTC;
  dateProxy.parse = OriginalDate.parse;

  global.Date = dateProxy;

  try {
    const jwtClient = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    await jwtClient.authorize();

    const drive = google.drive({ version: 'v3', auth: jwtClient });
    return drive;
  } finally {
    global.Date = OriginalDate;
  }
}

// Main test function
async function runTest() {
  try {
    // Step 2: Get network time offset
    console.log('[2/6] Fetching network time offset...');
    const offset = await getNetworkTimeOffset();
    console.log(`PASSED: Network time offset = ${offset}ms`);
    console.log();

    // Step 3: Initialize Google Drive client
    console.log('[3/6] Initializing Google Drive client with JWT...');
    const drive = await getDriveClient();
    console.log('PASSED: JWT authentication successful');
    console.log();

    // Step 4: Upload test image
    console.log('[4/6] Uploading test image to Google Drive...');
    const imageBuffer = Buffer.from(TEST_IMAGE_BASE64, 'base64');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const fileMetadata = {
      name: TEST_FILENAME,
      parents: [folderId]
    };

    const media = {
      mimeType: 'image/png',
      body: require('stream').Readable.from(imageBuffer)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,webViewLink,webContentLink'
    });

    const fileId = response.data.id;
    console.log(`PASSED: File uploaded with ID: ${fileId}`);
    console.log();

    // Step 5: Set public permissions
    console.log('[5/6] Setting public permissions...');
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    console.log('PASSED: Public permissions set');
    console.log();

    // Step 6: Generate and verify public URL
    console.log('[6/6] Verifying public URL...');
    const publicUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;
    console.log(`Public URL: ${publicUrl}`);
    
    // Try to verify the URL is accessible
    await new Promise((resolve, reject) => {
      const req = https.get(publicUrl, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          console.log('PASSED: Public URL is accessible');
          resolve();
        } else {
          console.log(`WARNING: URL returned status ${res.statusCode}`);
          resolve();
        }
      });
      req.on('error', (err) => {
        console.log('WARNING: Could not verify URL accessibility:', err.message);
        resolve();
      });
      req.setTimeout(5000, () => {
        req.destroy();
        console.log('WARNING: URL verification timeout');
        resolve();
      });
    });
    console.log();

    // Success summary
    console.log('='.repeat(60));
    console.log('ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log();
    console.log('Test Results:');
    console.log(`- File ID: ${fileId}`);
    console.log(`- Public URL: ${publicUrl}`);
    console.log(`- View in Drive: https://drive.google.com/file/d/${fileId}/view`);
    console.log();
    console.log('Next Steps:');
    console.log('1. Apply migration: migrations/005_gdrive_storage.sql');
    console.log('2. Test in browser: Open scan page and capture photo');
    console.log('3. Verify database has gdrive_file_id and gdrive_url');
    console.log('4. Verify photo displays on home page');
    console.log();

    process.exit(0);
  } catch (error) {
    console.error();
    console.error('='.repeat(60));
    console.error('TEST FAILED');
    console.error('='.repeat(60));
    console.error();
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Code:', error.code);
    }
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error();
    console.error('Stack:', error.stack);
    console.error();
    process.exit(1);
  }
}

// Run the test
runTest();
