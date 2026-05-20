/**
 * Stage 0: Upload the Amharic Bible PDF to Gemini Files API.
 * Run this ONCE. The file URI is valid for 48 hours and reused by all other stages.
 *
 * Usage: npx tsx scripts/bible-upload.ts
 * Output: extraction_output/file_handle.json
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

import { requireEnv, PDF_PATH, OUTPUT_DIR, HANDLE_PATH } from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');

import { RAW_DIR } from './bible-shared';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

interface FileHandle {
  fileUri: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  expiresAt: string;
}

function isHandleValid(handle: FileHandle): boolean {
  return new Date(handle.expiresAt) > new Date();
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Reuse existing handle if still valid
  if (fs.existsSync(HANDLE_PATH)) {
    const existing: FileHandle = JSON.parse(fs.readFileSync(HANDLE_PATH, 'utf-8'));
    if (isHandleValid(existing)) {
      const hoursLeft = Math.round((new Date(existing.expiresAt).getTime() - Date.now()) / 3_600_000);
      console.log(`✅ Existing file handle is valid (${hoursLeft}h remaining)`);
      console.log(`   URI: ${existing.fileUri}`);
      return;
    }
    console.log('⚠️  Existing handle expired — re-uploading...');
  }

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  const stats = fs.statSync(PDF_PATH);
  const sizeMB = (stats.size / 1_048_576).toFixed(1);
  console.log(`📄 Uploading PDF (${sizeMB} MB)...`);

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

  const uploaded = await ai.files.upload({
    file: fileBlob,
    config: { displayName: 'amharic_bible.pdf' },
  });

  console.log(`⏳ Processing file (${uploaded.name})...`);

  // Poll until ACTIVE
  let fileInfo = await ai.files.get({ name: uploaded.name! });
  while (fileInfo.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 4000));
    fileInfo = await ai.files.get({ name: uploaded.name! });
    process.stdout.write('.');
  }
  console.log('');

  if (fileInfo.state === 'FAILED') {
    console.error('❌ File processing failed');
    process.exit(1);
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 47 * 3_600_000); // 47h (1h buffer before 48h expiry)

  const handle: FileHandle = {
    fileUri: uploaded.uri!,
    fileName: uploaded.name!,
    mimeType: 'application/pdf',
    uploadedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  fs.writeFileSync(HANDLE_PATH, JSON.stringify(handle, null, 2));
  console.log(`✅ Uploaded successfully!`);
  console.log(`   URI: ${handle.fileUri}`);
  console.log(`   Expires: ${expires.toLocaleString()}`);
  console.log(`   Saved to: ${HANDLE_PATH}`);
}

main().catch(console.error);
