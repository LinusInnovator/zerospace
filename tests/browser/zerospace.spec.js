const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fixtureWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zerospace-browser-'));
  fs.mkdirSync(path.join(root, '__pycache__'));
  fs.writeFileSync(path.join(root, 'old-installer.iso'), Buffer.alloc(2 * 1024 * 1024, 65));
  const duplicate = Buffer.concat([Buffer.alloc(8192, 66), Buffer.alloc(16384, 67)]);
  fs.writeFileSync(path.join(root, 'duplicate-a.dat'), duplicate);
  fs.writeFileSync(path.join(root, 'duplicate-b.dat'), duplicate);
  fs.writeFileSync(path.join(root, '__pycache__', 'fixture.pyc'), Buffer.from('bytecode'));
  return root;
}

async function useFixtureDrive(page, workspace) {
  await page.route('**/api/drives', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ drives: [{ name: 'Fixture Workspace', path: workspace }] })
    });
  });
}

test.describe('ZeroSpace browser smoke', () => {
  let workspace;

  test.beforeEach(async ({ page }) => {
    workspace = fixtureWorkspace();
    await useFixtureDrive(page, workspace);
    page.on('console', message => {
      if (message.type() === 'error') throw new Error(`browser console error: ${message.text()}`);
    });
    page.on('requestfailed', request => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
        throw new Error(`network request failed: ${request.url()} (${request.failure()?.errorText})`);
      }
    });
  });

  test.afterEach(() => {
    if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('loads, auto-scans, shows real findings, and keeps tabs coherent', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scanPathInput')).toHaveValue(workspace);
    await expect(page.locator('#scanSnapshotStatus')).toContainText('Snapshot refreshed', { timeout: 30_000 });
    await expect(page.locator('#statTotalFiles')).not.toHaveText('0');
    await expect(page.locator('#archaeologistStoriesContainer')).not.toBeEmpty();

    const visibleTabs = await page.locator('.sidebar-item:not([hidden])').evaluateAll(items => items.map(item => item.dataset.tab));
    for (const tab of visibleTabs) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await expect(page.locator(`#${tab}`)).toHaveClass(/active/);
    }

    await page.locator('[data-tab="tabDuplicates"]').click();
    const duplicateText = await page.locator('#duplicatesListContainer').innerText();
    for (const name of ['duplicate-a.dat', 'duplicate-b.dat']) {
      expect(duplicateText.split(path.join(workspace, name)).length - 1).toBe(1);
    }
  });

  test('scan scope and workspace buttons provide progress and cancellation feedback', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scanSnapshotStatus')).toContainText('Snapshot refreshed', { timeout: 30_000 });

    await page.locator('#scanPathInput').fill(workspace);
    await page.route('**/api/scan?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 4_000));
      await route.continue();
    });
    await page.locator('#btnRealDiskScan').click();
    await expect(page.locator('#btnCancelScan')).toBeVisible();
    await expect(page.locator('.tab-scan-state').first()).toContainText('Updating inventory');
    await page.locator('#btnCancelScan').click();
    await expect(page.locator('#scanSnapshotStatus')).toContainText('Scan cancelled', { timeout: 10_000 });
    await expect(page.locator('#btnCancelScan')).toBeHidden();

    await page.locator('[data-tab="tabSmartCare"]').click();
    await page.locator('#btnSmartCareScan').click();
    await expect(page.locator('#scanSnapshotStatus')).toContainText('Snapshot refreshed', { timeout: 30_000 });
  });

  test('settings persist and exports are produced', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#scanSnapshotStatus')).toContainText('Snapshot refreshed', { timeout: 30_000 });

    await page.locator('#btnSettings').click();
    await page.locator('#settingCompressionConfidence').fill('88');
    await page.locator('#settingCompressionConfidence').press('Tab');
    await page.reload();
    await page.locator('#btnSettings').click();
    await expect(page.locator('#settingCompressionConfidence')).toHaveValue('88');
    await page.locator('#modalSettingsManager .modal-header button').click();

    await page.locator('#btnExportJson').click();
    await expect(page.locator('#toastContainer')).toContainText('Exported JSON scan report');
    await page.locator('#btnExportCsv').click();
    await expect(page.locator('#toastContainer')).toContainText('Exported CSV top space hogs report');
  });
});
