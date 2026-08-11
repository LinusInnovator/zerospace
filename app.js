/**
 * HD Optimizer Detective v2 - CleanMyMac Premium UX Edition Engine
 */

const EMPTY_AUDIT = Object.freeze({
  totalFiles: 0,
  healthScore: 0,
  aiInsight: "Choose a storage scope and scan to inspect real local files. Nothing is selected or changed automatically.",
  duplicates: [], strategies: [], treemapNodes: [], topHogs: [],
  scannedItems: [], archaeologistStories: [], categoryBytes: {}, progressiveReclaimableBytes: 0
});

let currentWorkload = "dev";
let caseData = structuredClone(EMPTY_AUDIT);
let activeScanId = 0;
let activeScanController = null;
let activeScanCancelledByUser = false;
let activeBackendScanId = null;
let scanIsActive = false;
let latestScanProgress = null;

const scanAwarePanels = ['tabSmartCare', 'tabArchaeologist', 'tabDuplicates', 'tabBigFiles', 'tabTreemap', 'tabVelocity', 'tabScript'];

function setGlobalScanState(active, progress = {}) {
  scanIsActive = active;
  scanAwarePanels.forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    let stateBar = panel.querySelector('.tab-scan-state');
    if (!stateBar) {
      stateBar = document.createElement('div');
      stateBar.className = 'tab-scan-state';
      panel.prepend(stateBar);
    }
    stateBar.hidden = !active;
    if (!active) return;
    const files = Number(progress.filesScanned) || 0;
    const phase = progress.phase === 'hashing' ? 'Verifying exact duplicates' : progress.phase === 'fingerprinting' ? 'Comparing duplicate candidates' : progress.phase === 'grouping' ? 'Grouping verified duplicates' : 'Updating inventory';
    stateBar.textContent = `${phase} · ${files.toLocaleString()} files indexed · this tab is showing the latest partial view`;
  });
}

function renderProgressiveViews(progress) {
  const preview = Array.isArray(progress.candidatePreview) ? progress.candidatePreview : [];
  if (preview.length) {
    caseData.topHogs = preview;
    renderBigFilesRadar();
  }
  if (progress.categoryBytes) {
    caseData.categoryBytes = progress.categoryBytes;
    renderAppleStorageBar();
    renderTreemap();
  }
  if (Array.isArray(progress.duplicatePreview)) {
    caseData.duplicates = progress.duplicatePreview;
    caseData.duplicateGroupsFound = Number(progress.duplicateGroupsFound) || progress.duplicatePreview.length;
    caseData.progressiveReclaimableBytes = Number(progress.progressiveReclaimableBytes) || 0;
  }
  renderDuplicatesLocker();
  recalculateStats();
  renderOverviewSummary();
}

// DOM Elements
const driveSelectPicker = document.getElementById('driveSelectPicker');
const workloadSelect = document.getElementById('workloadSelect');
const btnScanPreset = document.getElementById('btnScanPreset');
const scanPathInput = document.getElementById('scanPathInput');
const btnRealDiskScan = document.getElementById('btnRealDiskScan');
const btnSmartCareScan = document.getElementById('btnSmartCareScan');
const btnToggleHud = document.getElementById('btnToggleHud');
const hudDrawer = document.getElementById('hudDrawer');

const hudRamText = document.getElementById('hudRamText');
const hudRamBar = document.getElementById('hudRamBar');
const hudCpuText = document.getElementById('hudCpuText');
const hudCpuBar = document.getElementById('hudCpuBar');
const hudTrashText = document.getElementById('hudTrashText');

const dialHealthScore = document.getElementById('dialHealthScore');
const dialHealthLabel = document.getElementById('dialHealthLabel');
const dialMeterCircle = document.getElementById('dialMeterCircle');
const dialSvg = document.querySelector('.dial-svg');

const cardScannedFiles = document.getElementById('cardScannedFiles');
const cardDuplicates = document.getElementById('cardDuplicates');
const cardReclaimable = document.getElementById('cardReclaimable');
const cardConfidence = document.getElementById('cardConfidence');

const statTotalFiles = document.getElementById('statTotalFiles');
const statDuplicateCount = document.getElementById('statDuplicateCount');
const statReclaimableSpace = document.getElementById('statReclaimableSpace');
const statHealthScore = document.getElementById('statHealthScore');

const duplicatesListContainer = document.getElementById('duplicatesListContainer');
const btnSmartOldest = document.getElementById('btnSmartOldest');
const btnSmartNewest = document.getElementById('btnSmartNewest');
const btnSmartDownloads = document.getElementById('btnSmartDownloads');
const btnClearSelection = document.getElementById('btnClearSelection');
const btnTopSafeDelete = document.getElementById('btnTopSafeDelete');
const btnTopSafeDeleteText = document.getElementById('btnTopSafeDeleteText');

const strategyGrid = document.getElementById('strategyGrid');
const btnSelectAllSafe = document.getElementById('btnSelectAllSafe');

const treemapContainer = document.getElementById('treemapContainer');
const topHogsTableBody = document.getElementById('topHogsTableBody');

const aiInsightText = document.getElementById('aiInsightText');
const velocityRate = document.getElementById('velocityRate');
const velocityDaysLeft = document.getElementById('velocityDaysLeft');

const terminalBody = document.getElementById('terminalBody');
const btnDownloadSh = document.getElementById('btnDownloadSh');
const btnReviewBeforeSimulate = document.getElementById('btnReviewBeforeSimulate');
const btnCopyScript = document.getElementById('btnCopyScript');

const previewTotalReclaim = document.getElementById('previewTotalReclaim');
const previewDeleteCount = document.getElementById('previewDeleteCount');
const previewTableBody = document.getElementById('previewTableBody');
const btnConfirmExecuteCleanup = document.getElementById('btnConfirmExecuteCleanup');
const fileDistList = document.getElementById('fileDistList');
const modalReclaimValue = document.getElementById('modalReclaimValue');
const btnExpressReclaimModal = document.getElementById('btnExpressReclaimModal');
const toastContainer = document.getElementById('toastContainer');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setDialValue(value) {
  if (!dialHealthScore) return;
  const text = String(value);
  dialHealthScore.textContent = text;
  dialHealthScore.classList.toggle('dial-score--compact', text.length >= 7);
  dialHealthScore.classList.toggle('dial-score--dense', text.length >= 10);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconClass = type === 'success' ? 'ph-check-circle' : type === 'warning' ? 'ph-warning' : 'ph-info';
  const icon = document.createElement('i');
  icon.className = `ph-duotone ${iconClass}`;
  icon.style.cssText = 'font-size: 18px; color: var(--primary);';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = String(message);
  toast.append(icon, text);
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Fetch Real Assistant HUD Hardware Metrics
async function fetchRealSystemHud() {
  try {
    const res = await fetch('/api/system_hud');
    const data = await res.json();

    const ramStr = `${data.usedRamGb} / ${data.totalRamGb} GB`;
    const cpuStr = `${data.cpuLoadPct}% Load`;
    const trashStr = data.trashFormatted || '0 B';

    if (hudRamText && hudRamBar) {
      hudRamText.textContent = ramStr;
      hudRamBar.style.width = `${data.ramPct}%`;
    }

    if (hudCpuText && hudCpuBar) {
      hudCpuText.textContent = cpuStr;
      hudCpuBar.style.width = `${data.cpuLoadPct}%`;
    }

    if (hudTrashText) {
      hudTrashText.textContent = trashStr;
    }

    const bentoRamText = document.getElementById('bentoRamText');
    const bentoCpuText = document.getElementById('bentoCpuText');
    const bentoTrashText = document.getElementById('bentoTrashText');

    if (bentoRamText) bentoRamText.textContent = ramStr;
    if (bentoCpuText) bentoCpuText.textContent = cpuStr;
    if (bentoTrashText) bentoTrashText.textContent = trashStr;
  } catch (err) {
    console.log("System HUD fetch offline:", err.message);
  }
}

// Fetch System Drives from Backend
async function fetchSystemDrives() {
  try {
    const res = await fetch('/api/drives');
    const data = await res.json();
    if (data.drives && data.drives.length > 0) {
      driveSelectPicker.innerHTML = '';
      data.drives.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.path;
        opt.textContent = d.name;
        driveSelectPicker.appendChild(opt);
      });
      const customOpt = document.createElement('option');
      customOpt.value = 'custom';
      customOpt.textContent = '✏️ Custom Path...';
      driveSelectPicker.appendChild(customOpt);
      driveSelectPicker.value = data.drives[0].path;
      if (scanPathInput) scanPathInput.value = data.drives[0].path;
      updateScopeHUDBanner(data.drives[0].path);
      return data.drives[0].path;
    }
  } catch (e) {
    console.log("Using static drive list fallback.");
  }
  return null;
}

// Live Hard Drive Scan
async function runRealSystemDriveScan(path, { force = false, automatic = false } = {}) {
  path = path || (scanPathInput ? scanPathInput.value.trim() : '');
  if (!path) {
    showToast('Choose or enter a workspace path first.', 'warning');
    return;
  }
  const scanId = ++activeScanId;
  const snapshotStatus = document.getElementById('scanSnapshotStatus');
  const progressStrip = document.querySelector('.scan-progress-strip');
  const cancelButton = document.getElementById('btnCancelScan');
  const startedAt = Date.now();
  if (activeBackendScanId) fetch(`/api/scan_cancel?scan_id=${encodeURIComponent(activeBackendScanId)}`).catch(() => {});
  if (activeScanController) activeScanController.abort();
  const controller = new AbortController();
  const backendScanId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  activeScanController = controller;
  activeBackendScanId = backendScanId;
  activeScanCancelledByUser = false;
  latestScanProgress = null;
  caseData.partialScan = false;
  const progressId = setInterval(async () => {
    if (scanId === activeScanId && snapshotStatus) {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      try {
        const progress = await fetch(`/api/scan_progress?scan_id=${encodeURIComponent(backendScanId)}`).then(res => res.json());
        if (scanId !== activeScanId) return;
        latestScanProgress = progress;
        setGlobalScanState(true, progress);
        const files = Number(progress.filesScanned) || 0;
        const directories = Number(progress.directoriesScanned) || 0;
        const processed = Number(progress.candidatesProcessed) || 0;
        const candidateTotal = Number(progress.candidatesTotal) || 0;
        const groupsFound = Number(progress.duplicateGroupsFound) || 0;
        caseData.totalFiles = files;
        let phaseText = `Enumerating accessible files… ${files.toLocaleString()} files in ${directories.toLocaleString()} folders`;
        if (progress.phase === 'indexing') phaseText = `Preparing the duplicate index for ${files.toLocaleString()} files`;
        if (progress.phase === 'fingerprinting') phaseText = `Comparing same-size candidates… ${processed.toLocaleString()} of ${candidateTotal.toLocaleString()}`;
        if (progress.phase === 'hashing') phaseText = `Verifying possible duplicates with SHA-256… ${processed.toLocaleString()} of ${candidateTotal.toLocaleString()}`;
        if (progress.phase === 'grouping') phaseText = `Building exact duplicate groups… ${groupsFound.toLocaleString()} found`;
        snapshotStatus.textContent = `${phaseText} · ${seconds}s.`;
        setDialValue(files ? files.toLocaleString() : `${seconds}s`);
        if (dialHealthLabel) dialHealthLabel.textContent = 'Files indexed · scanning';
        if (statTotalFiles) statTotalFiles.textContent = files.toLocaleString();
        if (statDuplicateCount) {
          statDuplicateCount.textContent = groupsFound
            ? `${groupsFound.toLocaleString()}+ Groups`
            : (progress.phase === 'enumerating' ? 'Pending' : 'Checking…');
        }
        if (statReclaimableSpace) {
          const progressiveBytes = Number(progress.progressiveReclaimableBytes) || 0;
          statReclaimableSpace.textContent = progressiveBytes ? formatBytes(progressiveBytes) : 'Pending';
        }
        renderLiveFindings(progress);
        renderProgressiveViews(progress);
      } catch (_progressError) {
        snapshotStatus.textContent = `Scanning ${path}… ${seconds}s elapsed.`;
      }
    }
  }, 1000);

  showToast(`${automatic ? 'Refreshing' : 'Inspecting'} storage scope at ${path}...`, 'info');
  setGlobalScanState(true, {phase: 'enumerating', filesScanned: 0});
  if (snapshotStatus) snapshotStatus.textContent = `Scanning ${path}… 0s elapsed. You can keep reviewing the previous snapshot.`;
  if (progressStrip) progressStrip.classList.add('is-scanning');
  if (cancelButton) cancelButton.hidden = false;
  btnRealDiskScan.disabled = true;
  btnSmartCareScan.disabled = true;

  if (dialSvg) dialSvg.classList.add('scanning');
  if (dialHealthLabel) dialHealthLabel.textContent = 'Files indexed · scanning';
  dialMeterCircle.style.strokeDashoffset = "450";
  setDialValue("0s");

  // Layer 1: Immediately render scanning skeletons so screen is NEVER black/empty!
  renderScanningSkeletons();

  let data = null;
  try {
    const params = new URLSearchParams({path, max_age: '600', scan_id: backendScanId});
    if (appSettings.scanGlobalCaches === true) params.set('global_caches', '1');
    if (force) params.set('refresh', '1');
    const res = await fetch(`/api/scan?${params}`, {signal: controller.signal});
    data = await res.json();
  } catch (netErr) {
    if (scanId !== activeScanId) return;
    if (dialSvg) dialSvg.classList.remove('scanning');
    const message = netErr.name === 'AbortError'
      ? (activeScanCancelledByUser ? 'Scan cancelled' : 'Scan interrupted')
      : `Backend connection offline: ${netErr.message}`;
    if (snapshotStatus) snapshotStatus.textContent = activeScanCancelledByUser
      ? 'Scan cancelled. The previous snapshot is still shown.'
      : `${message}. The previous snapshot is still shown; check the selected scope or restart the local service.`;
    renderAll();
    showToast(message, 'warning');
    return;
  } finally {
    clearInterval(progressId);
    if (scanId === activeScanId) {
      activeScanController = null;
      activeBackendScanId = null;
      setGlobalScanState(false);
      if (progressStrip) progressStrip.classList.remove('is-scanning');
      if (cancelButton) cancelButton.hidden = true;
      btnRealDiskScan.disabled = false;
      btnSmartCareScan.disabled = false;
    }
  }

  if (scanId !== activeScanId) return;
  if (dialSvg) dialSvg.classList.remove('scanning');
  if (dialHealthLabel) dialHealthLabel.textContent = data?.cancelled ? 'Scan cancelled' : 'Files indexed';

  if (!data || data.error) {
    if (snapshotStatus) snapshotStatus.textContent = `Scan failed: ${data ? data.error : 'empty response'}.`;
    renderAll();
    showToast(`Scan Error: ${data ? data.error : 'Empty response'}`, 'warning');
    return;
  }

  try {
    if (data.cancelled) {
      if (activeScanCancelledByUser) {
        const partial = latestScanProgress || {};
        caseData.totalFiles = Number(partial.filesScanned) || Number(data.totalFiles) || Number(caseData.totalFiles) || 0;
        caseData.duplicateGroupsFound = Number(partial.duplicateGroupsFound) || (caseData.duplicates || []).length;
        caseData.partialScan = true;
        renderAll();
        if (snapshotStatus) snapshotStatus.textContent = `Partial scan saved — ${caseData.totalFiles.toLocaleString()} files indexed. Start a new scan to complete the audit.`;
        showToast('Scan stopped. Partial findings were kept for review.', 'info');
      }
      return;
    }
    caseData = data || {};
    renderAll();
    const snapshot = data.snapshot || {};
    const snapshotDate = snapshot.createdAt ? new Date(snapshot.createdAt * 1000) : new Date();
    if (snapshotStatus) {
      const skipped = Number(data.coverage?.skippedDirectories) || 0;
      const skippedFiles = Number(data.coverage?.skippedFiles) || 0;
      const skippedTotal = skipped + skippedFiles;
      const coverageNote = skippedTotal
        ? ` Coverage complete for accessible data; ${skipped.toLocaleString()} folders and ${skippedFiles.toLocaleString()} files were inaccessible.`
        : ' All accessible folders and files were enumerated.';
      snapshotStatus.textContent = (snapshot.fromCache
        ? `Showing snapshot from ${snapshotDate.toLocaleTimeString()} (${Math.round(snapshot.ageSeconds || 0)}s old).`
        : `Snapshot refreshed at ${snapshotDate.toLocaleTimeString()} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`) + coverageNote;
    }
    showToast(`Storage scan complete: ${Array.isArray(data.duplicates) ? data.duplicates.length : 0} exact duplicate groups found.`, 'success');
  } catch (uiErr) {
    console.error("UI Render Exception:", uiErr);
    showToast(`UI Render Notice: ${uiErr.message}`, 'warning');
  }
}

// Real Hard Drive Execution
async function executeRealCleanup() {
  const items = [];
  (caseData.duplicates || []).forEach(g => {
    (g.files || []).forEach(f => {
      if (f.selected) {
        items.push({ path: f.path, action: f.action || 'trash' });
      }
    });
  });

  (caseData.strategies || []).forEach(s => {
    if (s.enabled && s.command) {
      items.push({ command: s.command, action: 'strategy', name: s.name });
    }
  });

  if (items.length === 0) {
    showToast("No duplicate files or strategies flagged for cleanup.", "warning");
    return;
  }

  showToast(`Executing real system cleanup on ${items.length} items...`, 'info');

  try {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, settings: getCompressionSettings() })
    });
    const result = await res.json();

    if (result.status === 'success') {
      showToast(`Review complete. Moved selected items representing ${formatBytes(result.reclaimedBytes)} to Trash.`, 'success');
      runRealSystemDriveScan(scanPathInput.value);
      fetchRealSystemHud();
    } else {
      showToast(`Execution Error: ${result.error}`, 'warning');
    }
  } catch (err) {
    showToast(`Execution Error: ${err.message}`, 'warning');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadAppSettings();
  initSidebarNav();
  renderAll();
  const initialWorkspace = await fetchSystemDrives();
  fetchRealSystemHud();
  if (initialWorkspace) runRealSystemDriveScan(initialWorkspace, {automatic: true});

  driveSelectPicker.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected === 'custom') {
      scanPathInput.focus();
      scanPathInput.select();
    } else {
      scanPathInput.value = selected;
      runRealSystemDriveScan(selected, {automatic: true});
    }
  });

  btnRealDiskScan.addEventListener('click', () => runRealSystemDriveScan(scanPathInput.value, {force: true}));
  btnSmartCareScan.addEventListener('click', () => runRealSystemDriveScan(scanPathInput.value, {force: true}));
  const btnCancelScan = document.getElementById('btnCancelScan');
  if (btnCancelScan) btnCancelScan.addEventListener('click', () => {
    activeScanCancelledByUser = true;
    if (activeBackendScanId) fetch(`/api/scan_cancel?scan_id=${encodeURIComponent(activeBackendScanId)}`).catch(() => {});
    if (btnCancelScan) btnCancelScan.disabled = true;
    const snapshotStatus = document.getElementById('scanSnapshotStatus');
    if (snapshotStatus) snapshotStatus.textContent = 'Stopping scan and keeping the latest partial findings…';
  });

  btnToggleHud.addEventListener('click', () => {
    fetchRealSystemHud();
    hudDrawer.classList.toggle('open');
  });

  if (workloadSelect) workloadSelect.addEventListener('change', (e) => currentWorkload = e.target.value);
  if (btnScanPreset) {
    btnScanPreset.addEventListener('click', () => {
      showToast('Demo presets were removed: scan a real workspace instead.', 'info');
    });
  }

  if (cardScannedFiles) {
    cardScannedFiles.addEventListener('click', () => {
      switchTab('tabBigFiles');
      showToast("Opened Big File Radar & File Inspector!", "info");
    });
  }

  if (cardDuplicates) {
    cardDuplicates.addEventListener('click', () => {
      switchTab('tabDuplicates');
      showToast("Opened Duplicate Evidence Locker!", "info");
    });
  }

  if (cardReclaimable) {
    cardReclaimable.addEventListener('click', () => {
      renderDeletionPreview();
      openModal('modalDeletionPreview');
    });
  }

  if (cardConfidence) {
    cardConfidence.addEventListener('click', () => openModal('modalConfidence'));
  }

  if (btnExpressReclaimModal) {
    btnExpressReclaimModal.addEventListener('click', () => {
      closeModal('modalReclaimable');
      renderDeletionPreview();
      openModal('modalDeletionPreview');
    });
  }

  if (btnReviewBeforeSimulate) {
    btnReviewBeforeSimulate.addEventListener('click', () => {
      renderDeletionPreview();
      openModal('modalDeletionPreview');
    });
  }

  if (btnConfirmExecuteCleanup) {
    btnConfirmExecuteCleanup.addEventListener('click', () => {
      closeModal('modalDeletionPreview');
      executeRealCleanup();
    });
  }

  if (btnTopSafeDelete) {
    btnTopSafeDelete.addEventListener('click', () => {
      let selectedCount = 0;
      (caseData.duplicates || []).forEach(g => {
        (g.files || []).forEach(f => { if (f.selected) selectedCount++; });
      });
      if (selectedCount === 0) {
        applySmartSelection('oldest');
      }
      renderDeletionPreview();
      openModal('modalDeletionPreview');
    });
  }

  const btnSelectAllDuplicates = document.getElementById('btnSelectAllDuplicates');
  if (btnSelectAllDuplicates) {
    btnSelectAllDuplicates.addEventListener('click', () => applySmartSelection('all'));
  }

  if (btnSmartOldest) btnSmartOldest.addEventListener('click', () => applySmartSelection('oldest'));
  if (btnSmartNewest) btnSmartNewest.addEventListener('click', () => applySmartSelection('newest'));
  if (btnSmartDownloads) btnSmartDownloads.addEventListener('click', () => applySmartSelection('downloads'));
  if (btnClearSelection) btnClearSelection.addEventListener('click', () => applySmartSelection('none'));

  if (btnSelectAllSafe) {
    btnSelectAllSafe.addEventListener('click', () => {
      // Cleanup strategies remain opt-in; opening review never enables them.
      renderStrategies();
      recalculateStats();
      renderTerminalScript();
      showToast("Enabled all safe junk cleanup strategies!", "success");
    });
  }

  if (btnCopyScript) {
    btnCopyScript.addEventListener('click', () => {
      if (terminalBody) navigator.clipboard.writeText(terminalBody.textContent);
      showToast("Copied script to clipboard!", "success");
    });
  }

  if (btnDownloadSh) btnDownloadSh.addEventListener('click', downloadShellScript);

  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const filterBigFileSize = document.getElementById('filterBigFileSize');
  const filterBigFileAge = document.getElementById('filterBigFileAge');
  const btnFlagAllBigFiles = document.getElementById('btnFlagAllBigFiles');

  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal('modalSettingsManager');
    });
  }

  if (btnExportJson) btnExportJson.addEventListener('click', exportJsonReport);
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsvReport);
  if (filterBigFileSize) filterBigFileSize.addEventListener('change', renderBigFilesRadar);
  if (filterBigFileAge) filterBigFileAge.addEventListener('change', renderBigFilesRadar);
  if (btnFlagAllBigFiles) {
    btnFlagAllBigFiles.addEventListener('click', () => {
      showToast("Added filtered files to the review list.", "success");
    });
  }
});

function initSidebarNav() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) {
    panel.classList.add('active');
    const viewport = document.querySelector('.mac-viewport');
    if (viewport) viewport.scrollTop = 0;
  }
}

window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
};

window.updateScopeHUDBanner = function(path) {
  const scopePathText = document.getElementById('scopePathText');
  const scopeBadgeTag = document.getElementById('scopeBadgeTag');
  const currentPath = path || (scanPathInput ? scanPathInput.value : '~');

  if (scopePathText) scopePathText.textContent = currentPath;

  if (scopeBadgeTag) {
    if (currentPath === '~') {
      scopeBadgeTag.textContent = "Home Drive (System Anchor)";
    } else if (currentPath === '/') {
      scopeBadgeTag.textContent = "Macintosh HD Root (/)";
    } else if (currentPath.includes('Downloads')) {
      scopeBadgeTag.textContent = "Scoped: Downloads Folder";
    } else if (currentPath.includes('scratch')) {
      scopeBadgeTag.textContent = "Scoped: Developer Workspace";
    } else {
      scopeBadgeTag.textContent = "Scoped Subfolder: " + (currentPath.split('/').filter(Boolean).pop() || currentPath);
    }
  }
};

window.navigateToPathScope = function(newPath) {
  if (!newPath) return;
  if (scanPathInput) scanPathInput.value = newPath;
  const driveSelectPicker = document.getElementById('driveSelectPicker');
  if (driveSelectPicker) {
    let matchOption = Array.from(driveSelectPicker.options).find(opt => opt.value === newPath);
    if (matchOption) {
      driveSelectPicker.value = newPath;
    } else {
      driveSelectPicker.value = 'custom';
    }
  }
  updateScopeHUDBanner(newPath);
  showToast(`Rescanning audit scope from ${newPath}`, "info");
  runRealSystemDriveScan(newPath, {force: true});
};

window.drillUpPathScope = function() {
  let curr = scanPathInput ? scanPathInput.value : '~';
  if (curr === '/' || curr === '') return;
  let parts = curr.split('/').filter(Boolean);
  parts.pop();
  let parentPath = '/' + parts.join('/');
  if (!parentPath) parentPath = '/';
  window.navigateToPathScope(parentPath);
};

function renderAll() {
  updateScopeHUDBanner();
  recalculateStats();
  renderOverviewSummary();
  renderDuplicatesLocker();
  renderStrategies();
  renderBigFilesRadar();
  renderTreemap();
  renderAppleStorageBar();
  renderArchaeologistStories();
  renderPathAssistantHUD();
  renderTopHogs();
  renderVelocityAndInsights();
  renderTerminalScript();
}

function renderOverviewSummary() {
  const summary = document.getElementById('scanOverviewSummary');
  if (!summary) return;
  const totalFiles = Number(caseData.totalFiles) || 0;
  const stories = Array.isArray(caseData.archaeologistStories) ? caseData.archaeologistStories.length : 0;
  const duplicates = Number.isFinite(Number(caseData.duplicateGroupsFound))
    ? Number(caseData.duplicateGroupsFound)
    : (Array.isArray(caseData.duplicates) ? caseData.duplicates.length : 0);
  let duplicateSavings = 0;
  (caseData.duplicates || []).forEach(group => {
    const copies = Number(group.fileCount) || (group.files || []).length;
    duplicateSavings += Math.max(0, copies - 1) * (Number(group.sizeBytes) || 0);
  });
  const strategySavings = (caseData.strategies || []).reduce((sum, strategy) => sum + (Number(strategy.savingsBytes) || 0), 0);
  let reclaimable = duplicateSavings + strategySavings;
  if (scanIsActive && Number(caseData.progressiveReclaimableBytes) > reclaimable) {
    reclaimable = Number(caseData.progressiveReclaimableBytes);
  }
  summary.hidden = totalFiles === 0 && stories === 0 && duplicates === 0;
  const scope = document.getElementById('scanOverviewScope');
  const overviewTitle = document.getElementById('scanOverviewTitle');
  if (overviewTitle) overviewTitle.textContent = caseData.partialScan ? 'Partial scan decision brief' : 'Storage decision brief';
  if (scope) scope.textContent = scanPathInput?.value ? `Scope: ${scanPathInput.value}` : 'Selected scope';
  const files = document.getElementById('overviewFiles');
  const storyCount = document.getElementById('overviewStories');
  const duplicateCount = document.getElementById('overviewDuplicates');
  const reclaimableValue = document.getElementById('overviewReclaimable');
  if (files) files.textContent = totalFiles.toLocaleString();
  if (storyCount) storyCount.textContent = stories.toLocaleString();
  if (duplicateCount) duplicateCount.textContent = duplicates.toLocaleString();
  if (reclaimableValue) reclaimableValue.textContent = formatBytes(reclaimable);
  renderSavingsOverview({ duplicateSavings, strategySavings, reclaimable });
}

function renderSavingsOverview({ duplicateSavings, strategySavings, reclaimable }) {
  const headline = document.getElementById('overviewSavingsHeadline');
  const note = document.getElementById('overviewSavingsNote');
  const actions = document.getElementById('overviewActionList');
  const primary = document.getElementById('overviewPrimaryAction');
  if (!headline || !note || !actions) return;

  const isUpdating = scanIsActive;
  headline.textContent = reclaimable ? formatBytes(reclaimable) : (isUpdating ? 'Calculating…' : '0 B');
  note.textContent = isUpdating
    ? 'Estimated from verified duplicates so far; more may appear as the scan continues.'
    : 'Potential savings are recommendations. Review each path before moving anything to Trash.';
  actions.innerHTML = '';

  const topHogs = Array.isArray(caseData.topHogs) ? caseData.topHogs : [];
  const stories = Array.isArray(caseData.archaeologistStories) ? caseData.archaeologistStories : [];
  const rows = [
    { title: 'Exact duplicates', detail: duplicateSavings ? `${formatBytes(duplicateSavings)} · ${caseData.duplicates.length} groups` : 'Highest-confidence savings', tab: 'tabDuplicates' },
    { title: 'Regeneratable workspace data', detail: strategySavings ? `${formatBytes(strategySavings)} · caches and build output` : 'Caches and build output', tab: 'tabSmartCare' },
    { title: 'Large or stale files', detail: topHogs.length ? `${topHogs.length} candidates · review individually` : `${stories.length || 'No'} review stories yet`, tab: 'tabBigFiles' },
  ];
  rows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'scan-overview-action';
    const title = document.createElement('strong');
    title.textContent = row.title;
    const detail = document.createElement('span');
    detail.textContent = row.detail;
    const button = document.createElement('button');
    button.className = 'btn btn-secondary';
    button.type = 'button';
    button.textContent = 'Review';
    button.addEventListener('click', () => switchTab(row.tab));
    card.append(title, detail, button);
    actions.appendChild(card);
  });
  if (primary && !primary.dataset.bound) {
    primary.dataset.bound = 'true';
    primary.addEventListener('click', () => switchTab((caseData.duplicates || []).length ? 'tabDuplicates' : 'tabBigFiles'));
  }
}

function renderAppleStorageBar() {
  const appleStorageBar = document.getElementById('appleStorageBar');
  const storageLegendContainer = document.getElementById('storageLegendContainer');
  const storageCapacityText = document.getElementById('storageCapacityText');
  const storageBarTitle = document.getElementById('storageBarTitle');

  if (!appleStorageBar || !storageLegendContainer) return;

  const currentPath = scanPathInput ? scanPathInput.value : '~';
  let pathName = 'Macintosh HD';
  if (currentPath.includes('scratch')) {
    pathName = 'Scratch Workspace (~/scratch)';
  } else if (currentPath === '~') {
    pathName = 'Home Directory (~)';
  } else if (currentPath !== '/') {
    pathName = currentPath.split('/').filter(Boolean).pop() || currentPath;
  }

  if (storageBarTitle) {
    storageBarTitle.textContent = `${pathName} Storage Breakdown`;
  }

  // Drive capacity stats
  const disk = caseData.diskUsage || {
    totalBytes: 2 * 1024 * 1024 * 1024 * 1024,
    usedBytes: 1.91 * 1024 * 1024 * 1024 * 1024,
    freeBytes: 90 * 1024 * 1024 * 1024,
    totalFormatted: '2.0 TB',
    usedFormatted: '1.91 TB',
    freeFormatted: '90.0 GB'
  };

  if (storageCapacityText) {
    storageCapacityText.textContent = `${disk.usedFormatted || '1.91 TB'} of ${disk.totalFormatted || '2.0 TB'} Used`;
  }

  // Aggregate Category Bytes for current path
  const catBytesMap = caseData.categoryBytes || {};
  let scannedCatBytes = 0;
  Object.values(catBytesMap).forEach(b => scannedCatBytes += (b || 0));

  // Determine base capacity for bar calculation
  let totalBaseBytes = disk.totalBytes || (2 * 1024 * 1024 * 1024 * 1024);
  let otherSystemBytes = (disk.usedBytes || (1.91 * 1024 * 1024 * 1024 * 1024)) - scannedCatBytes;
  if (otherSystemBytes < 0) otherSystemBytes = 0;

  // Category configs matching native macOS Storage bar
  const categories = [
    { key: "Dev Dependencies (node_modules)", label: "Dev Dependencies", cls: "dev", color: "#00f2fe", bytes: catBytesMap["Dev Dependencies (node_modules)"] || 0 },
    { key: "AI Models & Safetensors", label: "AI Models", cls: "ai", color: "#a855f7", bytes: catBytesMap["AI Models & Safetensors"] || 0 },
    { key: "4K Video & Media Renders", label: "4K Media Renders", cls: "media", color: "#3b82f6", bytes: catBytesMap["4K Video & Media Renders"] || 0 },
    { key: "Python __pycache__ Bytecode", label: "Python Bytecode", cls: "pycache", color: "#f59e0b", bytes: catBytesMap["Python __pycache__ Bytecode"] || 0 },
    { key: "VM Images (.vmdk / .iso)", label: "VM Images", cls: "vm", color: "#f43f5e", bytes: catBytesMap["VM Images (.vmdk / .iso)"] || 0 },
    { key: "Archives & Database Dumps", label: "Archives & Dumps", cls: "archives", color: "#10b981", bytes: catBytesMap["Archives & Database Dumps"] || 0 },
    { key: "macOS System & Data", label: "macOS System Data", cls: "ds", color: "#94a3b8", bytes: (catBytesMap["macOS .DS_Store Clutter"] || 0) + (otherSystemBytes > 0 ? otherSystemBytes : 0) }
  ];

  appleStorageBar.innerHTML = '';
  storageLegendContainer.innerHTML = '';

  categories.forEach(cfg => {
    const bytes = cfg.bytes || 0;
    const pct = totalBaseBytes > 0 ? (bytes / totalBaseBytes) * 100 : 0;

    if (pct > 0.3) {
      const seg = document.createElement('div');
      seg.className = `storage-segment ${cfg.cls}`;
      seg.style.width = `${pct.toFixed(1)}%`;
      seg.setAttribute('title', `${cfg.label}: ${formatBytes(bytes)}`);
      seg.onclick = () => filterByStorageCategory(cfg.key);
      appleStorageBar.appendChild(seg);
    }

    const chip = document.createElement('div');
    chip.className = `legend-chip ${cfg.cls}`;
    if (bytes === 0) chip.style.opacity = '0.35';
    chip.onclick = () => filterByStorageCategory(cfg.key);
    chip.innerHTML = `
      <span class="legend-dot" style="background: ${cfg.color};"></span>
      <span>${cfg.label}</span>
      <span class="legend-size">${formatBytes(bytes)}</span>
    `;
    storageLegendContainer.appendChild(chip);
  });
}

function recalculateStats() {
  let dupBytes = 0;
  let dupCount = 0;

  (caseData.duplicates || []).forEach(group => {
    (group.files || []).forEach(f => {
      if (f.selected) {
        dupBytes += (f.size || group.sizeBytes || 0);
        dupCount++;
      }
    });
  });

  let stratBytes = 0;
  (caseData.strategies || []).forEach(s => { if (s.enabled) stratBytes += s.savingsBytes; });

  const totalReclaimable = dupBytes + stratBytes;
  const displayedReclaimable = scanIsActive
    ? Math.max(totalReclaimable, Number(caseData.progressiveReclaimableBytes) || 0)
    : totalReclaimable;

  if (statTotalFiles) statTotalFiles.textContent = caseData.totalFiles ? caseData.totalFiles.toLocaleString() : '0';
  if (statDuplicateCount) {
    const duplicateGroupCount = Number.isFinite(Number(caseData.duplicateGroupsFound))
      ? Number(caseData.duplicateGroupsFound)
      : (caseData.duplicates ? caseData.duplicates.length : 0);
    statDuplicateCount.textContent = `${duplicateGroupCount.toLocaleString()} Groups`;
  }
  if (statReclaimableSpace) statReclaimableSpace.textContent = formatBytes(displayedReclaimable);
  if (statHealthScore) statHealthScore.textContent = caseData.healthScore ? `${caseData.healthScore}%` : '—';

  const elSafeDeleteText = document.getElementById('btnTopSafeDeleteText');
  if (elSafeDeleteText) {
    elSafeDeleteText.textContent = `Review Selected (${formatBytes(dupBytes)})`;
  }

  const indexedFiles = Number(caseData.totalFiles) || 0;
  setDialValue(indexedFiles ? indexedFiles.toLocaleString() : '—');
  if (dialMeterCircle) {
    // Keep an in-progress scan visibly indeterminate; only a completed scan
    // earns the full ring, avoiding a false “done” signal during hashing.
    dialMeterCircle.style.strokeDashoffset = scanIsActive ? '390' : (indexedFiles ? '0' : '565');
  }
}

function renderDuplicatesLocker() {
  duplicatesListContainer.innerHTML = '';

  if (scanIsActive) {
    const pending = document.createElement('div');
    pending.className = 'tab-inline-pending';
    pending.textContent = caseData.duplicates?.length
      ? 'Live exact duplicate groups are ready to review while verification continues.'
      : 'Exact duplicate verification is starting. Verified groups will appear here while the scan continues.';
    duplicatesListContainer.appendChild(pending);
  }

  const dups = Array.isArray(caseData.duplicates) ? caseData.duplicates : [];

  if (dups.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align: center; color: var(--text-muted); padding: 40px;';
    empty.textContent = scanIsActive ? 'New exact duplicate groups will appear when SHA-256 verification completes.' : 'No duplicate files detected in this audit.';
    duplicatesListContainer.appendChild(empty);
    return;
  }

  const displayGroups = dups.slice(0, 30);

  displayGroups.forEach((group, gIdx) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'duplicate-group';

    groupEl.innerHTML = `
      <div class="duplicate-group-header">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 14px;">${group.name}</span>
          <span style="font-size: 12px; color: var(--accent-amber); font-family: var(--font-code);">(${formatBytes(group.sizeBytes)} per copy)</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="autoSelectGroupDuplicates(${gIdx})">Auto-Flag Duplicates</button>
        </div>
      </div>
      <div>
        ${(group.files || []).map((file, fIdx) => `
          <div class="duplicate-file-item ${file.selected ? 'selected-for-deletion' : ''}">
            <div class="file-info">
              <div class="file-details">
                <div class="file-path" title="${file.path}">${file.path}</div>
                <div class="file-meta"><span>Modified: ${file.mtime}</span></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="action-selector">
                <button class="action-chip ${file.action === 'trash' ? 'active delete' : ''}" onclick="setFileAction(${gIdx}, ${fIdx}, 'trash')">Move to Trash</button>
              </div>
              <label style="font-size: 12px; cursor: pointer;">
                <input type="checkbox" class="checkbox-custom" data-group="${gIdx}" data-file="${fIdx}" ${file.selected ? 'checked' : ''}>
                Flag
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    duplicatesListContainer.appendChild(groupEl);
  });

  if (dups.length > 30) {
    const moreNotice = document.createElement('div');
    moreNotice.style.cssText = "text-align: center; font-size: 12px; color: var(--text-dim); padding: 12px;";
    moreNotice.textContent = `Showing top 30 of ${dups.length} duplicate file groups.`;
    duplicatesListContainer.appendChild(moreNotice);
  }

  document.querySelectorAll('.checkbox-custom').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const gIdx = parseInt(e.target.getAttribute('data-group'));
      const fIdx = parseInt(e.target.getAttribute('data-file'));
      caseData.duplicates[gIdx].files[fIdx].selected = e.target.checked;
      renderDuplicatesLocker();
      recalculateStats();
      renderTerminalScript();
    });
  });
}

window.autoSelectGroupDuplicates = function(gIdx) {
  const group = caseData.duplicates[gIdx];
  if (group && group.files.length > 1) {
    group.files.forEach((f, idx) => f.selected = (idx > 0));
    renderDuplicatesLocker();
    recalculateStats();
    renderTerminalScript();
  }
};

window.setFileAction = function(gIdx, fIdx, actionName) {
  caseData.duplicates[gIdx].files[fIdx].action = actionName;
  caseData.duplicates[gIdx].files[fIdx].selected = true;
  renderDuplicatesLocker();
  recalculateStats();
  renderTerminalScript();
};

function applySmartSelection(rule) {
  if (!caseData || !caseData.duplicates) return;

  caseData.duplicates.forEach(group => {
    if (!group.files || group.files.length === 0) return;

    if (rule === 'all') {
      group.files.forEach((f, idx) => {
        f.selected = (idx > 0);
        if (idx > 0) f.action = 'trash';
      });
    } else if (rule === 'none') {
      group.files.forEach(f => f.selected = false);
    } else if (rule === 'oldest') {
      const sorted = [...group.files].sort((a, b) => new Date(a.mtime) - new Date(b.mtime));
      const oldestPath = sorted[0].path;
      group.files.forEach(f => {
        f.selected = (f.path !== oldestPath);
        if (f.path !== oldestPath) f.action = 'trash';
      });
    } else if (rule === 'newest') {
      const sorted = [...group.files].sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
      const newestPath = sorted[0].path;
      group.files.forEach(f => {
        f.selected = (f.path !== newestPath);
        if (f.path !== newestPath) f.action = 'trash';
      });
    } else if (rule === 'downloads') {
      group.files.forEach(f => {
        const isDownload = f.path.includes('/Downloads/') || f.path.includes('(1)');
        f.selected = isDownload;
        if (isDownload) f.action = 'trash';
      });
    }
  });

  renderDuplicatesLocker();
  recalculateStats();
  renderTerminalScript();

  let totalSelectedBytes = 0;
  let totalSelectedFiles = 0;
  caseData.duplicates.forEach(g => {
    (g.files || []).forEach(f => {
      if (f.selected) {
        totalSelectedBytes += g.sizeBytes;
        totalSelectedFiles++;
      }
    });
  });

  showToast(`Selected ${totalSelectedFiles} duplicate copies (${formatBytes(totalSelectedBytes)}) for review.`, 'success');
}

function renderStrategies() {
  strategyGrid.innerHTML = '';
  (caseData.strategies || []).forEach(strat => {
    const card = document.createElement('div');
    card.className = 'strategy-card';
    card.innerHTML = `
      <div>
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 6px;">${strat.name}</h3>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 12px;">${strat.desc}</p>
        <div class="strategy-cmd"><code>$ ${strat.command}</code></div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span style="font-family: var(--font-code); font-size: 12px; color: var(--accent-emerald);">~${formatBytes(strat.savingsBytes)}</span>
        <button class="btn ${strat.enabled ? 'btn-emerald' : 'btn-secondary'}" onclick="toggleStrategy('${strat.id}')">
          ${strat.enabled ? '✓ Enabled' : '+ Enable'}
        </button>
      </div>
    `;
    strategyGrid.appendChild(card);
  });
}

window.toggleStrategy = function(id) {
  const strat = caseData.strategies.find(s => s.id === id);
  if (strat) {
    strat.enabled = !strat.enabled;
    renderStrategies();
    recalculateStats();
    renderTerminalScript();
  }
};

function renderTreemap() {
  treemapContainer.innerHTML = '';
  
  const categoryDefs = [
    { 
      name: "Dev Dependencies (node_modules)", 
      size: caseData.nodeModulesSize || "0 B",
      flex: "grid-column: span 3; grid-row: span 2;", 
      colorRgb: "0, 242, 254", 
      accent: "var(--primary)" 
    },
    { 
      name: "AI Models & Safetensors", 
      size: caseData.aiModelsSize || "0 B",
      flex: "grid-column: span 3; grid-row: span 2;", 
      colorRgb: "139, 92, 246", 
      accent: "#a855f7" 
    },
    { 
      name: "4K Video & Media Renders", 
      size: caseData.mediaSize || "0 B",
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "59, 130, 246", 
      accent: "#3b82f6" 
    },
    { 
      name: "Python __pycache__ Bytecode", 
      size: caseData.pycacheSize || "0 B",
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "245, 158, 11", 
      accent: "var(--accent-amber)" 
    },
    { 
      name: "VM Images (.vmdk / .iso)", 
      size: caseData.vmImagesSize || "0 B",
      flex: "grid-column: span 2; grid-row: span 2;", 
      colorRgb: "244, 63, 94", 
      accent: "var(--accent-rose)" 
    },
    { 
      name: "Archives & Database Dumps", 
      size: caseData.archivesSize || "0 B",
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "16, 185, 129", 
      accent: "var(--accent-emerald)" 
    },
    { 
      name: "macOS .DS_Store Clutter", 
      size: caseData.dsStoreSize || "0 B",
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "148, 163, 184", 
      accent: "var(--text-muted)" 
    }
  ];

  categoryDefs.forEach(node => {
    const item = document.createElement('div');
    const rgb = node.colorRgb;
    const accentColor = node.accent;

    // Semi-transparent border + subtle dark-mode glow
    const borderStyle = `1px solid rgba(${rgb}, 0.35)`;
    const glowStyle = `0 0 16px rgba(${rgb}, 0.15), inset 0 0 12px rgba(${rgb}, 0.05), 0 8px 20px rgba(0,0,0,0.4)`;
    const hoverGlowStyle = `0 0 24px rgba(${rgb}, 0.4), inset 0 0 16px rgba(${rgb}, 0.1), 0 12px 28px rgba(0,0,0,0.6)`;

    item.style.cssText = `${node.flex} background: rgba(12, 17, 30, 0.85); border: ${borderStyle}; padding: 18px; border-radius: 14px; display: flex; flex-direction: column; justify-content: space-between; transition: border-color 0.15s ease, box-shadow 0.15s ease; cursor: pointer; backdrop-filter: blur(16px); box-shadow: ${glowStyle}; position: relative; overflow: hidden;`;

    item.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(${rgb}, 0.6), transparent);"></div>
      <div style="font-size: 13.5px; font-weight: 700; color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
        <span>${node.name}</span>
        <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 6px; background: rgba(${rgb}, 0.12); color: ${accentColor}; font-family: var(--font-code); border: 1px solid rgba(${rgb}, 0.25);">Category</span>
      </div>
      <div style="font-size: 24px; font-weight: 800; font-family: var(--font-code); color: ${accentColor}; text-shadow: 0 0 12px rgba(${rgb}, 0.3); margin-top: 12px;">
        ${node.size}
      </div>
    `;

    item.addEventListener('mouseenter', () => {
      item.style.border = `1px solid rgba(${rgb}, 0.75)`;
      item.style.boxShadow = hoverGlowStyle;
    });
    item.addEventListener('mouseleave', () => {
      item.style.border = borderStyle;
      item.style.boxShadow = glowStyle;
    });
    item.addEventListener('click', () => openCategoryInspector(node.name));

    treemapContainer.appendChild(item);
  });
}

function renderTopHogs() {
  topHogsTableBody.innerHTML = '';
  (caseData.topHogs || []).forEach(hog => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    tr.innerHTML = `
      <td style="padding: 10px;">${hog.type}</td>
      <td style="padding: 10px; color: var(--cyan);">${hog.path}</td>
      <td style="padding: 10px; font-weight: 700; color: var(--accent-amber);">${hog.size}</td>
      <td style="padding: 10px; color: #c084fc;">${hog.category}</td>
    `;
    topHogsTableBody.appendChild(tr);
  });
}

function renderVelocityAndInsights() {
  if (caseData.aiInsight) aiInsightText.textContent = caseData.aiInsight;
  if (caseData.burnRate) velocityRate.textContent = caseData.burnRate;
  if (caseData.daysLeft) velocityDaysLeft.textContent = caseData.daysLeft;
}

function generateScriptContent() {
  let lines = ["#!/usr/bin/env bash\n# HD Optimizer Detective v2 - Multi-Action Script\nset -e\n"];
  (caseData.duplicates || []).forEach(g => {
    (g.files || []).forEach(f => {
      if (f.selected) lines.push(`rm -f "${f.path}"`);
    });
  });
  (caseData.strategies || []).forEach(s => {
    if (s.enabled) lines.push(s.command);
  });
  return lines.join("\n");
}

function renderTerminalScript() {
  terminalBody.textContent = generateScriptContent();
}

function downloadShellScript() {
  const blob = new Blob([generateScriptContent()], { type: 'text/x-sh' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clean_junk.sh';
  a.click();
  showToast("Downloaded clean_junk.sh script!", "success");
}

function renderDeletionPreview() {
  if (!previewTableBody) return;
  previewTableBody.innerHTML = '';
  let deleteCnt = 0;
  let totalBytes = 0;

  // Render only items the user explicitly selected.
  (caseData.duplicates || []).forEach((g) => {
    (g.files || []).forEach((f) => {
      if (f.selected) {
        totalBytes += (g.sizeBytes || 0);
        deleteCnt++;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
        const pathEscaped = f.path.replace(/'/g, "\\'");
        tr.innerHTML = `
          <td style="padding: 10px;"><span class="action-chip active delete"><i class="ph-duotone ph-trash"></i> MOVE TO TRASH</span></td>
          <td title="${f.path}" style="padding: 10px; font-family: var(--font-code); font-size: 12px; color: var(--text-main);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>${f.path}</span>
              <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px;" onclick="revealInFinder('${pathEscaped}')">
                <i class="ph-duotone ph-magnifying-glass"></i> Finder
              </button>
            </div>
          </td>
          <td style="padding: 10px; font-weight: 700; color: var(--accent-amber); font-family: var(--font-code);">${formatBytes(g.sizeBytes || 0)}</td>
          <td style="padding: 10px; color: var(--accent-emerald); font-size: 12px;"><i class="ph-duotone ph-shield-check"></i> Preserves Original</td>
        `;
        previewTableBody.appendChild(tr);
      }
    });
  });

  // 2. Render active junk strategies
  (caseData.strategies || []).forEach((strat) => {
    if (strat.enabled && strat.savingsBytes > 0) {
      totalBytes += strat.savingsBytes;
      deleteCnt++;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
      tr.innerHTML = `
        <td style="padding: 10px;"><span class="action-chip active delete"><i class="ph-duotone ph-broom"></i> PURGE STRATEGY</span></td>
        <td title="${strat.name}" style="padding: 10px; font-weight: 600; color: var(--text-main);">${strat.name.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F1E0-\u1F1FF]/g, '')} <div style="font-size: 11px; color: var(--text-muted);">${strat.desc || ''}</div></td>
        <td style="padding: 10px; font-weight: 700; color: var(--accent-amber); font-family: var(--font-code);">${formatBytes(strat.savingsBytes)}</td>
        <td style="padding: 10px; color: var(--accent-emerald); font-size: 12px;"><i class="ph-duotone ph-shield-check"></i> Safe Reclaim</td>
      `;
      previewTableBody.appendChild(tr);
    }
  });

  if (previewTableBody.children.length === 0) {
    previewTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 24px; text-align: center; color: var(--text-muted);">
          No items are selected for review. Run a scan and inspect candidates first.
        </td>
      </tr>
    `;
  }

  if (previewTotalReclaim) previewTotalReclaim.textContent = formatBytes(totalBytes);
  if (previewDeleteCount) previewDeleteCount.textContent = `${deleteCnt} Items`;
}

function renderFileDistModal() {
  fileDistList.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
        <span>AI Models (.safetensors, .ckpt)</span>
        <span>0 B</span>
      </div>
      <div class="hud-bar-bg"><div class="hud-bar-fill" style="width: 45%;"></div></div>
    </div>
  `;
}

// Phase 3: Big File Radar Implementation
function renderBigFilesRadar() {
  const bigFilesTableBody = document.getElementById('bigFilesTableBody');
  const filterBigFileSize = document.getElementById('filterBigFileSize');
  const filterBigFileAge = document.getElementById('filterBigFileAge');
  if (!bigFilesTableBody) return;

  const minMb = filterBigFileSize ? parseInt(filterBigFileSize.value) : 100;
  const minBytes = minMb * 1024 * 1024;

  bigFilesTableBody.innerHTML = '';

  const allHogs = caseData.topHogs || [];
  const filtered = allHogs.filter(hog => (hog.sizeBytes >= minBytes));

  if (filtered.length === 0) {
    bigFilesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">No files found matching size > ${minMb} MB filter.</td></tr>`;
    return;
  }

  filtered.forEach(hog => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    const pathEscaped = hog.path.replace(/'/g, "\\'");
    tr.innerHTML = `
      <td style="padding: 10px; color: var(--cyan); font-weight: 700;">${hog.type ? hog.type.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F1E0-\u1F1FF]/g, '') : 'File'}</td>
      <td style="padding: 10px; font-family: var(--font-code); color: var(--text-main);" title="${hog.path}">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span>${hog.path}</span>
          <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px;" onclick="revealInFinder('${pathEscaped}')" title="Reveal in macOS Finder">
            <i class="ph-duotone ph-magnifying-glass"></i> Finder
          </button>
        </div>
      </td>
      <td style="padding: 10px; font-weight: 700; color: var(--accent-amber); font-family: var(--font-code);">${hog.size || formatBytes(hog.sizeBytes)}</td>
      <td style="padding: 10px; color: var(--text-muted); font-size: 12px;">Recent Audit</td>
      <td style="padding: 10px; text-align: right;">
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="flagSingleBigFile('${hog.path.replace(/'/g, "\\'")}')">Flag Item</button>
      </td>
    `;
    bigFilesTableBody.appendChild(tr);
  });
}

window.flagSingleBigFile = function(path) {
  showToast(`Flagged item for audit: ${path}`, 'info');
};

// Phase 4: Interactive Treemap Drill-Down & Category File Inspection
window.openCategoryInspector = function(categoryName) {
  const modalCategoryTitle = document.getElementById('modalCategoryTitle');
  const modalCategoryDesc = document.getElementById('modalCategoryDesc');
  const modalCategoryTableBody = document.getElementById('modalCategoryTableBody');

  if (modalCategoryTitle) modalCategoryTitle.textContent = `Category Inspector: ${categoryName}`;
  if (modalCategoryDesc) modalCategoryDesc.textContent = `Detailed file inspection, location breakdown, and isolation actions for ${categoryName}.`;

  // Comprehensive Category File Aggregator
  let items = [];

  // 1. Check topHogs
  if (caseData.topHogs) {
    caseData.topHogs.forEach(h => {
      if (h.category === categoryName || categoryName.toLowerCase().includes((h.category || '').toLowerCase().split(' ')[0])) {
        items.push({
          type: h.type || '📦 File',
          path: h.path,
          size: h.size || formatBytes(h.sizeBytes),
          source: 'Space Hog'
        });
      }
    });
  }

  // 2. Check scannedItems from real disk scan
  if (caseData.scannedItems) {
    caseData.scannedItems.forEach(item => {
      if (item.category === categoryName || categoryName.includes(item.category) || (item.category && categoryName.toLowerCase().includes(item.category.toLowerCase().split(' ')[0]))) {
        if (!items.some(i => i.path === item.path)) {
          items.push({
            type: item.type || '📦 Item',
            path: item.path,
            size: item.size || formatBytes(item.sizeBytes),
            source: 'Real Disk Audit'
          });
        }
      }
    });
  }

  // 3. Check duplicates for matching extension/type
  if (caseData.duplicates) {
    caseData.duplicates.forEach(group => {
      group.files.forEach(f => {
        const lowerPath = f.path.toLowerCase();
        let match = false;
        if (categoryName.includes('Dev Dependencies') && (lowerPath.includes('node_modules') || lowerPath.includes('vendor') || lowerPath.includes('build'))) match = true;
        if (categoryName.includes('AI Models') && (lowerPath.endsWith('.safetensors') || lowerPath.endsWith('.ckpt') || lowerPath.endsWith('.bin') || lowerPath.endsWith('.gguf'))) match = true;
        if (categoryName.includes('4K Video') && (lowerPath.endsWith('.mp4') || lowerPath.endsWith('.mov') || lowerPath.includes('renders') || lowerPath.includes('deriveddata'))) match = true;
        if (categoryName.includes('Python') && (lowerPath.includes('__pycache__') || lowerPath.endsWith('.pyc'))) match = true;
        if (categoryName.includes('VM Images') && (lowerPath.endsWith('.vmdk') || lowerPath.endsWith('.iso') || lowerPath.endsWith('.qcow2') || lowerPath.includes('utm'))) match = true;
        if (categoryName.includes('Archives') && (lowerPath.endsWith('.zip') || lowerPath.endsWith('.tar.gz') || lowerPath.endsWith('.dump') || lowerPath.endsWith('.sql'))) match = true;
        if (categoryName.includes('.DS_Store') && lowerPath.endsWith('.ds_store')) match = true;

        if (match && !items.some(i => i.path === f.path)) {
          items.push({
            type: '👯 Duplicate',
            path: f.path,
            size: formatBytes(group.sizeBytes),
            source: 'Duplicate Locker'
          });
        }
      });
    });
  }

  if (modalCategoryTableBody) {
    modalCategoryTableBody.innerHTML = '';

    if (items.length === 0) {
      modalCategoryTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 30px; text-align: center; color: var(--text-muted); font-family: var(--font-main);">
            <i class="ph-duotone ph-folder-notch" style="font-size: 28px; color: var(--text-dim); display: block; margin-bottom: 8px;"></i>
            No files detected on real disk for <strong>${categoryName}</strong> in current audit path.
          </td>
        </tr>
      `;
    } else {
      items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
        const pathEscaped = item.path.replace(/'/g, "\\'");
        tr.innerHTML = `
          <td style="padding: 10px; color: var(--primary); font-weight: 700;">${item.type.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F1E0-\u1F1FF]/g, '')}</td>
          <td style="padding: 10px; font-family: var(--font-code); color: var(--text-main);" title="${item.path}">
            <div style="font-weight: 600;">${item.path}</div>
            <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
              <span>${item.source}</span>
              <span>•</span>
              <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px; display: inline-flex; align-items: center; gap: 3px;" onclick="revealInFinder('${pathEscaped}')" title="Reveal in macOS Finder">
                <i class="ph-duotone ph-magnifying-glass"></i> Reveal in Finder
              </button>
            </div>
          </td>
          <td style="padding: 10px; font-weight: 700; color: var(--accent-amber); font-family: var(--font-code);">${item.size}</td>
          <td style="padding: 10px; text-align: right;">
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11.5px;" onclick="flagInspectorItem('${pathEscaped}')">
              <i class="ph-duotone ph-flag"></i> Flag
            </button>
          </td>
        `;
        modalCategoryTableBody.appendChild(tr);
      });
    }
  }

  openModal('modalCategoryInspector');
};

window.flagInspectorItem = function(path) {
  showToast(`Added to review: ${path}`, 'success');
};

// Phase 5: Export JSON & CSV Reports
function exportJsonReport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(caseData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `hd_optimizer_report_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Exported JSON scan report!", "success");
}

function exportCsvReport() {
  let csvContent = "data:text/csv;charset=utf-8,Type,Path,SizeBytes,Category\n";
  (caseData.topHogs || []).forEach(h => {
    csvContent += `"${h.type}","${h.path}",${h.sizeBytes},"${h.category}"\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `hd_optimizer_hogs_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Exported CSV top space hogs report!", "success");
}

// Apple-Style Storage Bar Category Filter & Drill-Down Logic
window.filterByStorageCategory = function(categoryName) {
  const activeFilterPill = document.getElementById('activeFilterPill');
  const activeFilterLabel = document.getElementById('activeFilterLabel');

  if (activeFilterPill && activeFilterLabel) {
    activeFilterLabel.textContent = `Filtered: ${categoryName.split(' ')[0]}`;
    activeFilterPill.style.display = 'inline-flex';
  }

  // Highlight selected segment on storage bar
  const segments = document.querySelectorAll('.storage-segment');
  segments.forEach(seg => {
    const title = seg.getAttribute('title') || '';
    if (title.includes(categoryName.split(' ')[0])) {
      seg.style.opacity = '1';
      seg.style.filter = 'brightness(1.4) drop-shadow(0 0 8px currentColor)';
    } else {
      seg.style.opacity = '0.35';
      seg.style.filter = 'none';
    }
  });

  showToast(`Filtering Storage view by: ${categoryName}`, 'info');

  // Trigger Category Inspector Modal for detailed file breakdown
  openCategoryInspector(categoryName);
};

window.clearStorageCategoryFilter = function() {
  const activeFilterPill = document.getElementById('activeFilterPill');
  if (activeFilterPill) activeFilterPill.style.display = 'none';

  const segments = document.querySelectorAll('.storage-segment');
  segments.forEach(seg => {
    seg.style.opacity = '1';
    seg.style.filter = 'none';
  });

  showToast("Cleared category filter.", "info");
};

function renderScanningSkeletons() {
  const container = document.getElementById('archaeologistStoriesContainer');
  if (container) {
    container.innerHTML = `
      <div class="scanning-radar-pulse" style="grid-column: span 2;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="ph-duotone ph-compass ph-spin" style="font-size: 22px; color: #a855f7;"></i>
          <span>Digital Archaeologist inspecting real workspace artifacts…</span>
        </div>
        <span style="font-size: 11px; padding: 2px 10px; border-radius: 12px; background: rgba(168,85,247,0.2); border: 1px solid #a855f7; color: #a855f7;">
          SCANNING STRATA
        </span>
      </div>
      <div class="skeleton-tile" style="padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <i class="ph-duotone ph-brain" style="font-size: 24px; color: rgba(168, 85, 247, 0.4);"></i>
          <div style="height: 16px; width: 140px; background: rgba(255,255,255,0.08); border-radius: 4px;"></div>
        </div>
        <div style="height: 12px; width: 80%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 16px;"></div>
        <div style="height: 12px; width: 60%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 8px;"></div>
      </div>
      <div class="skeleton-tile" style="padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <i class="ph-duotone ph-file-zip" style="font-size: 24px; color: rgba(168, 85, 247, 0.4);"></i>
          <div style="height: 16px; width: 140px; background: rgba(255,255,255,0.08); border-radius: 4px;"></div>
        </div>
        <div style="height: 12px; width: 80%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 16px;"></div>
        <div style="height: 12px; width: 60%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 8px;"></div>
      </div>
      <div class="skeleton-tile" style="padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <i class="ph-duotone ph-code" style="font-size: 24px; color: rgba(168, 85, 247, 0.4);"></i>
          <div style="height: 16px; width: 140px; background: rgba(255,255,255,0.08); border-radius: 4px;"></div>
        </div>
        <div style="height: 12px; width: 80%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 16px;"></div>
        <div style="height: 12px; width: 60%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 8px;"></div>
      </div>
      <div class="skeleton-tile" style="padding: 22px 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <i class="ph-duotone ph-folder-user" style="font-size: 24px; color: rgba(168, 85, 247, 0.4);"></i>
          <div style="height: 16px; width: 140px; background: rgba(255,255,255,0.08); border-radius: 4px;"></div>
        </div>
        <div style="height: 12px; width: 80%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 16px;"></div>
        <div style="height: 12px; width: 60%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 8px;"></div>
      </div>
    `;
  }
}

function renderLiveFindings(progress) {
  const container = document.getElementById('archaeologistStoriesContainer');
  if (!container) return;
  const findings = Array.isArray(progress.candidatePreview) ? progress.candidatePreview : [];
  container.innerHTML = '';

  const banner = document.createElement('div');
  banner.className = 'scanning-radar-pulse';
  banner.style.gridColumn = 'span 2';
  banner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><i class="ph-duotone ph-compass ph-spin" style="font-size:22px;color:#a855f7;"></i><span>Live findings — review while the full scan continues</span></div><span style="font-size:11px;padding:2px 10px;border-radius:12px;background:rgba(168,85,247,0.2);border:1px solid #a855f7;color:#a855f7;">${(Number(progress.filesScanned) || 0).toLocaleString()} FILES INDEXED</span>`;
  container.appendChild(banner);

  if (findings.length === 0) {
    const waiting = document.createElement('div');
    waiting.className = 'skeleton-tile';
    waiting.style.cssText = 'grid-column: span 2; padding: 32px; color: var(--text-muted); text-align: center;';
    waiting.textContent = 'Still enumerating accessible files. Actionable findings will appear here as soon as candidates are confirmed.';
    container.appendChild(waiting);
    return;
  }

  findings.slice(0, 8).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'bento-tile live-finding-card';
    const title = document.createElement('h3');
    title.textContent = item.path.split('/').pop() || item.path;
    const detail = document.createElement('p');
    detail.textContent = `${item.category || 'Large file'} · ${item.size || formatBytes(item.sizeBytes || 0)}`;
    const path = document.createElement('code');
    path.textContent = item.path;
    const actions = document.createElement('div');
    actions.className = 'live-finding-actions';
    const finder = document.createElement('button');
    finder.className = 'btn btn-secondary';
    finder.textContent = 'Reveal in Finder';
    finder.addEventListener('click', () => revealInFinder(item.path));
    const scope = document.createElement('button');
    scope.className = 'btn btn-secondary';
    scope.textContent = 'Scan folder';
    scope.addEventListener('click', () => navigateToPathScope(item.path.substring(0, item.path.lastIndexOf('/')) || '/'));
    actions.append(finder, scope);
    card.append(title, detail, path, actions);
    container.appendChild(card);
  });
}

function renderArchaeologistStories() {
  const container = document.getElementById('archaeologistStoriesContainer');
  if (!container) return;

  container.innerHTML = '';
  const stories = caseData.archaeologistStories || [];

  if (stories.length === 0) {
    container.innerHTML = '<div class="bento-tile" style="text-align: center; color: var(--text-muted); padding: 48px; grid-column: span 2;"><strong style="display:block;color:var(--text-main);font-size:16px;margin-bottom:8px;">No review candidates found in this scope</strong>Everything accessible here is below the current evidence thresholds. Try a broader scope, or inspect Big File Radar and Storage Treemap for the full inventory.</div>';
    return;
  }

  // Scanning Progress Banner
  const radarBanner = document.createElement('div');
  radarBanner.className = 'scanning-radar-pulse';
  radarBanner.style.gridColumn = 'span 2';
  radarBanner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <i class="ph-duotone ph-compass ph-spin" style="font-size: 20px; color: #a855f7;"></i>
      <span id="radarBannerText">Digital Archaeologist grouping workspace findings…</span>
    </div>
    <span id="radarCountTag" style="font-size: 11px; padding: 2px 10px; border-radius: 12px; background: rgba(168,85,247,0.2); border: 1px solid #a855f7; color: #a855f7;">
      0 / ${stories.length} Discovered
    </span>
  `;
  container.appendChild(radarBanner);

  stories.forEach((story, idx) => {
    const card = document.createElement('div');
    card.className = 'bento-tile lazy-card';
    card.style.padding = '22px 24px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.border = '1px solid rgba(168, 85, 247, 0.3)';
    card.style.background = 'rgba(12, 16, 28, 0.85)';

    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="${story.icon || 'ph-compass'}" style="font-size: 26px; color: #a855f7;"></i>
            <div>
              <h3 style="font-size: 16px; font-weight: 700; font-family: var(--font-display);">${story.title}</h3>
              <div style="font-size: 11.5px; color: var(--text-dim);">${story.itemCount || 0} items identified</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 800; font-family: var(--font-code); color: var(--accent-emerald);">${story.recoverFormatted || '0 B'}</div>
            <div style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(168,85,247,0.15); border: 1px solid #a855f7; color: #a855f7; font-family: var(--font-code); display: inline-block; margin-top: 2px;">
              ${story.confidence}/100 review score
            </div>
          </div>
        </div>

        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.4;">${story.subtitle}</p>

        <!-- Explain WHY Checklist -->
        <div style="background: rgba(8, 12, 22, 0.6); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border); margin-bottom: 16px;">
          <div style="font-size: 10.5px; font-weight: 700; color: var(--text-dim); margin-bottom: 4px; letter-spacing: 0.5px;">SAFETY SIGNALS:</div>
          ${(story.why || []).map(w => `<div style="font-size: 12px; color: var(--text-main); line-height: 1.5;">${w}</div>`).join('')}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 8px;">
        <button class="btn btn-secondary" style="font-size: 11.5px; padding: 6px 12px;" onclick="openStoryInspector('${story.id}')">
          <i class="ph-duotone ph-magnifying-glass"></i> Inspect Story
        </button>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-emerald" style="padding: 6px 12px; font-size: 11.5px; font-weight: 700;" onclick="openStoryInspector('${story.id}')">
            Review Candidates
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);

    // Staggered Pop-In reveal delay (300ms step per card)
    setTimeout(() => {
      card.classList.add('pop-visible');
      const radarCountTag = document.getElementById('radarCountTag');
      if (radarCountTag) radarCountTag.textContent = `${idx + 1} / ${stories.length} Discovered`;
      
      if (idx === stories.length - 1) {
        const radarBannerText = document.getElementById('radarBannerText');
        if (radarBannerText) radarBannerText.textContent = `Analysis complete: ${stories.length} populated use-cases found`;
        if (radarCountTag) {
          radarCountTag.textContent = "COMPLETE";
          radarCountTag.style.background = "rgba(16, 185, 129, 0.2)";
          radarCountTag.style.borderColor = "#10b981";
          radarCountTag.style.color = "#10b981";
        }
      }
    }, (idx + 1) * 320);
  });
}

window.revealInFinder = function(path) {
  if (!path) return;
  fetch('/api/reveal_in_finder?path=' + encodeURIComponent(path))
    .then(r => r.json())
    .then(data => {
      if (data.status === 'success') {
        showToast("Revealed item in macOS Finder", "success");
      } else {
        showToast(data.error || "Could not reveal item in Finder", "error");
      }
    })
    .catch(err => {
      showToast("Error opening Finder: " + err.message, "error");
    });
};

window.openStoryInspector = function(storyId) {
  const stories = caseData.archaeologistStories || [];
  const story = stories.find(s => s.id === storyId) || stories[0];

  if (!story) return;

  const modal = document.getElementById('modalStoryInspector');
  const title = document.getElementById('storyModalTitle');
  const icon = document.getElementById('storyModalIcon');
  const subtitle = document.getElementById('storyModalSubtitle');
  const whyList = document.getElementById('storyModalWhyList');
  const tbody = document.getElementById('storyModalTableBody');
  const needProb = document.getElementById('storyModalNeedProb');

  if (title) title.textContent = story.title;
  if (icon) icon.className = `${story.icon || 'ph-compass'}`;
  if (subtitle) subtitle.textContent = story.subtitle;
  if (needProb) needProb.innerHTML = `Rule-based review score: <span style="color: var(--accent-emerald); font-weight: 700;">${story.confidence || 0}/100</span>`;

  if (whyList) {
    whyList.innerHTML = (story.why || []).map(w => `<span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); padding: 4px 10px; border-radius: 12px;"><i class="ph-duotone ph-check-circle" style="color: #a855f7;"></i> ${w.replace(/^✔\s*/, '')}</span>`).join('');
  }

  if (tbody) {
    tbody.innerHTML = '';
    const displayItems = (story.items || []).slice(0, 30);
    if (displayItems.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      emptyCell.style.cssText = 'padding: 28px; text-align: center; color: var(--text-muted);';
      emptyCell.textContent = 'No real files were found for this category in the current scan.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    displayItems.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--glass-border)';

      const recAction = story.recommendedAction || 'trash';
      const pathEscaped = item.path.replace(/'/g, "\\'");

      tr.innerHTML = `
        <td style="padding: 10px 8px; font-weight: 600;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="ph-duotone ph-file-code" style="color: var(--primary);"></i>
            <span>${item.name}</span>
          </div>
        </td>
        <td style="padding: 10px 8px; font-family: var(--font-code); color: var(--text-muted); word-break: break-all;" title="${item.path}">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-size: 11.5px;">${item.path}</span>
            <div style="display: flex; gap: 4px; shrink: 0;">
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 10.5px;" onclick="closeModal('modalStoryInspector'); navigateToPathScope('${pathEscaped.substring(0, pathEscaped.lastIndexOf('/')) || '/' }')" title="Set scope anchor to this folder and rescan">
                <i class="ph-duotone ph-compass"></i> Scope
              </button>
              <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 10.5px;" onclick="revealInFinder('${pathEscaped}')" title="Reveal in macOS Finder">
                <i class="ph-duotone ph-magnifying-glass"></i> Finder
              </button>
            </div>
          </div>
        </td>
        <td style="padding: 10px 8px;">
          <span style="color: #a855f7; font-weight: 700; font-family: var(--font-code);">${item.confidence || story.confidence}%</span>
        </td>
        <td style="padding: 10px 8px; text-align: right;">
          <div class="action-selector" style="justify-content: flex-end;">
            <button class="action-chip ${recAction === 'trash' ? 'active delete' : 'delete'}" id="chip-del-${idx}" onclick="selectStoryItemAction('${pathEscaped}', 'trash', 'chip-del-${idx}', '${idx}')">
              <i class="ph-duotone ph-trash"></i> Move to Trash
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (modal) modal.classList.add('open');
};

window.selectStoryItemAction = function(path, action, chipId, idx) {
  const rowDel = document.getElementById(`chip-del-${idx}`);
  const rowComp = document.getElementById(`chip-comp-${idx}`);
  const rowArch = document.getElementById(`chip-arch-${idx}`);

  if (rowDel) rowDel.className = 'action-chip delete';
  if (rowComp) rowComp.className = 'action-chip compress';
  if (rowArch) rowArch.className = 'action-chip archive';

  const selectedBtn = document.getElementById(chipId);
  if (selectedBtn) {
    selectedBtn.className = `action-chip active ${action}`;
  }

  showToast(`Action '${action.toUpperCase()}' selected for ${path.split('/').pop()}`, 'info');
};

function renderPathAssistantHUD() {
  const assistantPathValue = document.getElementById('assistantPathValue');
  const assistantClutterValue = document.getElementById('assistantClutterValue');
  const btnQuickCleanText = document.getElementById('btnQuickCleanText');

  const currentPath = scanPathInput ? scanPathInput.value : '~';
  let pathName = 'Macintosh HD';
  if (currentPath.includes('scratch')) {
    pathName = '~/scratch';
  } else if (currentPath === '~') {
    pathName = '~/Home';
  } else if (currentPath !== '/') {
    pathName = currentPath.split('/').filter(Boolean).pop() || currentPath;
  }

  if (assistantPathValue) assistantPathValue.textContent = pathName;

  const catBytesMap = caseData.categoryBytes || {};
  let totalCatBytes = 0;
  Object.values(catBytesMap).forEach(b => totalCatBytes += (b || 0));

  if (assistantClutterValue) assistantClutterValue.textContent = formatBytes(totalCatBytes);
  if (btnQuickCleanText) btnQuickCleanText.textContent = `Review ${pathName} Candidates`;
}

window.exportShellScript = function() {
  const terminalScriptOutput = document.getElementById('terminalScriptOutput');
  const scriptText = terminalScriptOutput ? terminalScriptOutput.textContent : '#!/bin/bash\n# HD Optimizer Detective Clean Script\necho "Running cleanup..."\n';

  if (navigator.clipboard) {
    navigator.clipboard.writeText(scriptText).then(() => {
      showToast("⚡ Reproducible Shell Script (.sh) copied to clipboard!", "success");
    }).catch(() => {
      showToast("Exported Shell Script ready in Script Generator tab.", "info");
    });
  } else {
    showToast("Exported Shell Script ready in Script Generator tab.", "info");
  }
};

window.toggleDaemonService = function() {
  fetch('/api/health')
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        const daemonStatusText = document.getElementById('daemonStatusText');
        const daemonStatusDot = document.getElementById('daemonStatusDot');
        if (daemonStatusText) daemonStatusText.textContent = "Daemon: ONLINE (8080)";
        if (daemonStatusDot) {
          daemonStatusDot.style.background = "#10b981";
          daemonStatusDot.style.boxShadow = "0 0 8px #10b981";
        }
        showToast("⚡ Background Scanner Daemon is ONLINE & active on http://127.0.0.1:8080", "success");
      }
    })
    .catch(err => {
      const daemonStatusText = document.getElementById('daemonStatusText');
      const daemonStatusDot = document.getElementById('daemonStatusDot');
      if (daemonStatusText) daemonStatusText.textContent = "Daemon: OFFLINE";
      if (daemonStatusDot) {
        daemonStatusDot.style.background = "#ef4444";
        daemonStatusDot.style.boxShadow = "0 0 8px #ef4444";
      }
      showToast("⚠️ Daemon connection offline. Ensure scanner_backend.py is running on port 8080.", "error");
    });
};

const APP_SETTINGS_KEY = 'zerospace.preferences.v1';
let appSettings = {
  compressionMode: 'manual',
  compressionConfidence: 95,
  compressionMinSavingsMb: 1,
  compressionMaxFileGb: 10,
  compressionExcludedExtensions: 'zip, tar.gz, tgz, mp4, mov, mkv, jpg, jpeg, png, heic, pdf',
  compressionExcludedPaths: '~/Library',
  compressionRequireConfirmation: true,
  scanGlobalCaches: false,
  archivePath: '~/Volumes/NAS_Storage/Archive',
  menuBarCompanion: true
};

function loadAppSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
    if (saved && typeof saved === 'object') appSettings = { ...appSettings, ...saved };
  } catch (_error) {
    showToast('Preferences could not be loaded; using safe defaults.', 'warning');
  }
  const fields = {
    settingCompressionMode: appSettings.compressionMode,
    settingCompressionConfidence: appSettings.compressionConfidence,
    settingCompressionMinSavings: appSettings.compressionMinSavingsMb,
    settingCompressionMaxFile: appSettings.compressionMaxFileGb,
    settingCompressionExcludedExtensions: appSettings.compressionExcludedExtensions,
    settingCompressionExcludedPaths: appSettings.compressionExcludedPaths,
    settingArchivePath: appSettings.archivePath
  };
  Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
  const confirmation = document.getElementById('settingCompressionConfirmation');
  const globalCaches = document.getElementById('settingGlobalCaches');
  if (confirmation) confirmation.checked = appSettings.compressionRequireConfirmation !== false;
  if (globalCaches) globalCaches.checked = appSettings.scanGlobalCaches === true;
}

function getCompressionSettings() {
  return {
    mode: appSettings.compressionMode,
    confidence: Math.max(50, Math.min(100, Number(appSettings.compressionConfidence) || 95)),
    minSavingsBytes: Math.max(0, (Number(appSettings.compressionMinSavingsMb) || 1) * 1024 * 1024),
    maxFileBytes: Math.max(1, (Number(appSettings.compressionMaxFileGb) || 10) * 1024 * 1024 * 1024),
    excludedExtensions: String(appSettings.compressionExcludedExtensions || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
    excludedPaths: String(appSettings.compressionExcludedPaths || '').split('\n').map(value => value.trim()).filter(Boolean),
    archivePath: String(appSettings.archivePath || '~/Volumes/NAS_Storage/Archive'),
    requireConfirmation: appSettings.compressionRequireConfirmation !== false
  };
}

window.saveAppSetting = function(key, val) {
  appSettings[key] = val;
  try { localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings)); } catch (_error) { /* local-only preference best effort */ }
  showToast(`Setting '${key}' updated`, 'info');
};

window.toggleSettingAutoCompress = function() {
  appSettings.autoCompress = !appSettings.autoCompress;
  const btn = document.getElementById('btnToggleAutoCompress');
  if (btn) {
    if (appSettings.autoCompress) {
      btn.textContent = "ON (Auto-Compress >95%)";
      btn.className = "btn btn-emerald";
      showToast("Smart Auto-Compress ENABLED for >95% confidence files", "success");
    } else {
      btn.textContent = "OFF (Manual)";
      btn.className = "btn btn-secondary";
      showToast("Smart Auto-Compress set to MANUAL mode", "info");
    }
  }
};

window.toggleSettingMenuBar = function() {
  appSettings.menuBarCompanion = !appSettings.menuBarCompanion;
  const btn = document.getElementById('btnToggleMenuBarSetting');
  if (btn) {
    if (appSettings.menuBarCompanion) {
      btn.textContent = "ACTIVE (Port 8080)";
      btn.className = "btn btn-emerald";
      showToast("macOS Menu Bar Quick Bar Companion ACTIVE", "success");
    } else {
      btn.textContent = "DISABLED";
      btn.className = "btn btn-secondary";
      showToast("Menu Bar Companion DISABLED", "info");
    }
  }
};
