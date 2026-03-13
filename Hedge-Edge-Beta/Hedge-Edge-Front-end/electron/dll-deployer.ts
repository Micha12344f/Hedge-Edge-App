/**
 * DLL Deployer Module for HedgeEdge
 * 
 * Automatically copies libzmq.dll and libsodium.dll from the bundled
 * app resources into each detected MT5 terminal's MQL5/Libraries/ folder.
 * 
 * This eliminates the need for clients to manually copy DLLs.
 * 
 * Flow:
 *   1. App starts → scans %APPDATA%\MetaQuotes\Terminal\ for GUID folders
 *   2. For each terminal, checks MQL5/Libraries/ for missing/outdated DLLs
 *   3. Copies from bundled agents/mt5/lib/ into each terminal's Libraries
 *   4. Also copies to Common/Files/HedgeEdge/lib/ as fallback for SetDllDirectoryW
 */

import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const REQUIRED_DLLS = ['libzmq.dll', 'libsodium.dll'] as const;
const METAQUOTES_TERMINAL_PATH = path.join(
  process.env.APPDATA || '',
  'MetaQuotes',
  'Terminal'
);
const COMMON_HEDGELEDGE_LIB = path.join(
  METAQUOTES_TERMINAL_PATH,
  'Common',
  'Files',
  'HedgeEdge',
  'lib'
);

// ============================================================================
// Types
// ============================================================================

export interface DllDeployResult {
  /** Total number of DLL copy operations performed */
  deployed: number;
  /** Number of terminals that already had up-to-date DLLs */
  skipped: number;
  /** Errors encountered (non-fatal — partial deployment is fine) */
  errors: string[];
  /** Terminal IDs that received DLLs */
  terminalIds: string[];
}

// ============================================================================
// Helpers
// ============================================================================

/** Resolve the bundled agents/mt5/lib directory */
function getBundledDllDir(): string {
  if (app.isPackaged) {
    if (process.platform === 'darwin') {
      return path.join(app.getAppPath(), '..', 'agents', 'mt5', 'lib');
    }
    return path.join(path.dirname(app.getPath('exe')), 'agents', 'mt5', 'lib');
  }
  // Development: project root
  return path.join(app.getAppPath(), 'agents', 'mt5', 'lib');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return -1;
  }
}

/**
 * Copy a DLL if the target is missing or has a different size.
 * Returns true if a copy was made, false if skipped.
 */
async function copyIfNeeded(src: string, dst: string): Promise<boolean> {
  const srcSize = await getFileSize(src);
  const dstSize = await getFileSize(dst);

  if (srcSize < 0) return false; // Source doesn't exist

  if (dstSize === srcSize) return false; // Already up-to-date

  await fs.copyFile(src, dst);
  return true;
}

// ============================================================================
// Main Deploy Function
// ============================================================================

/**
 * Deploy bundled DLLs to all detected MT5 terminal Libraries folders
 * and to Common/Files/HedgeEdge/lib/ as a fallback.
 * 
 * Safe to call multiple times — only copies when files are missing or outdated.
 * All errors are caught and reported, never thrown.
 */
export async function deployDllsToTerminals(): Promise<DllDeployResult> {
  const result: DllDeployResult = {
    deployed: 0,
    skipped: 0,
    errors: [],
    terminalIds: [],
  };

  const bundledDir = getBundledDllDir();

  // Verify bundled DLLs exist
  const bundledDlls: string[] = [];
  for (const dll of REQUIRED_DLLS) {
    const src = path.join(bundledDir, dll);
    if (await fileExists(src)) {
      bundledDlls.push(dll);
    } else {
      result.errors.push(`Bundled ${dll} not found at ${src}`);
    }
  }

  if (bundledDlls.length === 0) {
    result.errors.push('No bundled DLLs found — skipping deployment');
    console.warn('[DLL Deployer]', result.errors[result.errors.length - 1]);
    return result;
  }

  console.log(`[DLL Deployer] Found ${bundledDlls.length} bundled DLLs in ${bundledDir}`);

  // ── Deploy to Common/Files/HedgeEdge/lib/ (SetDllDirectoryW fallback) ───
  try {
    await fs.mkdir(COMMON_HEDGELEDGE_LIB, { recursive: true });
    for (const dll of bundledDlls) {
      const src = path.join(bundledDir, dll);
      const dst = path.join(COMMON_HEDGELEDGE_LIB, dll);
      if (await copyIfNeeded(src, dst)) {
        console.log(`[DLL Deployer] Deployed ${dll} → Common/Files/HedgeEdge/lib/`);
        result.deployed++;
      } else {
        result.skipped++;
      }
    }
  } catch (err) {
    const msg = `Common path deploy failed: ${err instanceof Error ? err.message : err}`;
    result.errors.push(msg);
    console.warn('[DLL Deployer]', msg);
  }

  // ── Deploy to each terminal's MQL5/Libraries/ ──────────────────────────
  if (!(await dirExists(METAQUOTES_TERMINAL_PATH))) {
    result.errors.push('MetaQuotes Terminal folder not found — no MT5 installed?');
    console.warn('[DLL Deployer]', result.errors[result.errors.length - 1]);
    return result;
  }

  let entries: string[];
  try {
    entries = await fs.readdir(METAQUOTES_TERMINAL_PATH);
  } catch (err) {
    result.errors.push(`Cannot read Terminal folder: ${err instanceof Error ? err.message : err}`);
    return result;
  }

  for (const entry of entries) {
    // GUID folders are 32-char hex strings
    if (!/^[A-F0-9]{32}$/i.test(entry)) continue;

    const librariesDir = path.join(METAQUOTES_TERMINAL_PATH, entry, 'MQL5', 'Libraries');

    // Only deploy to terminals that have a MQL5/Libraries folder
    if (!(await dirExists(librariesDir))) continue;

    let terminalDeployed = false;

    for (const dll of bundledDlls) {
      const src = path.join(bundledDir, dll);
      const dst = path.join(librariesDir, dll);

      try {
        if (await copyIfNeeded(src, dst)) {
          console.log(`[DLL Deployer] Deployed ${dll} → ${entry.substring(0, 8)}…/MQL5/Libraries/`);
          result.deployed++;
          terminalDeployed = true;
        } else {
          result.skipped++;
        }
      } catch (err) {
        const msg = `${entry.substring(0, 8)}…/${dll}: ${err instanceof Error ? err.message : err}`;
        result.errors.push(msg);
        console.warn('[DLL Deployer]', msg);
      }
    }

    if (terminalDeployed) {
      result.terminalIds.push(entry);
    }
  }

  // Summary
  const summary = `Deployed: ${result.deployed}, Skipped (up-to-date): ${result.skipped}, Errors: ${result.errors.length}`;
  console.log(`[DLL Deployer] Complete — ${summary}`);

  return result;
}
