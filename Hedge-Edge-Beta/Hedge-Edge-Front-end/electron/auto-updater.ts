import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { app, ipcMain, BrowserWindow } from 'electron';

// Configure updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

export function initAutoUpdater(mainWindow: BrowserWindow): void {
    const isDev = !app.isPackaged;
    const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

    if (isDev) {
        console.log('[Updater] Running in dev mode — auto-update checks use GitHub releases only');
        // In dev, force the provider to check GitHub releases even when not packaged
        autoUpdater.forceDevUpdateConfig = true;
    }

    // Initial check (delayed to not slow startup)
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            console.log('[Updater] Initial check skipped:', err?.message);
        });
    }, 30_000);

    // Periodic check
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, CHECK_INTERVAL);

    // Event handlers — forward to renderer
    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Update available:', info.version);
        mainWindow.webContents.send('update:available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
        });
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[Updater] No update available');
        mainWindow.webContents.send('update:not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
        mainWindow.webContents.send('update:progress', {
            percent: progress.percent,
            bytesPerSecond: progress.bytesPerSecond,
            total: progress.total,
            transferred: progress.transferred,
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Update downloaded:', info.version);
        mainWindow.webContents.send('update:downloaded', {
            version: info.version,
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err.message);
        mainWindow.webContents.send('update:error', { message: err.message });
    });

    // IPC handlers for renderer control
    ipcMain.handle('update:check', async () => {
        try {
            const result = await autoUpdater.checkForUpdates();
            // Result comes via events (update:available / update:not-available / update:error)
            return { checking: true, currentVersion: app.getVersion() };
        } catch (err: any) {
            const msg = err?.message || 'Check failed';
            // Forward error to renderer via event as well
            mainWindow.webContents.send('update:error', { message: msg });
            return { checking: false, error: msg };
        }
    });

    ipcMain.handle('update:download', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch {
            return { success: false, error: 'Download failed' };
        }
    });

    ipcMain.handle('update:install', () => {
        autoUpdater.quitAndInstall(false, true);
    });

    ipcMain.handle('update:getVersion', () => {
        return app.getVersion();
    });
}
