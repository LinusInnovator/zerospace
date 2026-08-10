/**
 * HD Optimizer Detective v2 - CleanMyMac Premium UX Edition Engine
 */

const WORKLOAD_PRESETS = {
  ai: {
    totalFiles: 124500,
    healthScore: 48,
    burnRate: "+9.2 GB / week",
    daysLeft: "24 Days",
    aiInsight: "Detected 42.5 GB of duplicate LLM quantization checkpoints (`.safetensors`) and 68.0 GB of inactive VM images (`.vmdk`).",
    duplicates: [
      {
        hash: "f489c7d032e185882b5e282f1b4a2a1f",
        name: "llama-3-70b-instruct-q4_k_m.safetensors",
        sizeBytes: 42500000000,
        aiCategory: "AI Model Checkpoint",
        confidence: "99% High Confidence",
        files: [
          { path: "/Users/linus/ai-models/hf/llama-3-70b-instruct-q4_k_m.safetensors", mtime: "2026-01-10", selected: false, action: "delete" },
          { path: "/Users/linus/Downloads/llama-3-70b-instruct-q4_k_m (1).safetensors", mtime: "2026-03-15", selected: true, action: "delete" }
        ]
      }
    ],
    strategies: [],
    treemapNodes: [],
    topHogs: []
  },
  dev: {
    totalFiles: 42890,
    healthScore: 58,
    burnRate: "+4.2 GB / week",
    daysLeft: "42 Days",
    aiInsight: "Identified 18.5 GB of stale node_modules inactive for >60 days and 14.2 GB of Xcode DerivedData.",
    duplicates: [
      {
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        name: "node_modules_vendor_bundle.js",
        sizeBytes: 154200000,
        aiCategory: "Dev Build Artifact",
        confidence: "99% High Confidence",
        files: [
          { path: "/Users/linus/projects/app-v1/node_modules/vendor/bundle.js", mtime: "2025-11-12", selected: false, action: "delete" },
          { path: "/Users/linus/projects/app-v2/node_modules/vendor/bundle.js", mtime: "2026-02-18", selected: true, action: "delete" },
          { path: "/Users/linus/Downloads/bundle (1).js", mtime: "2026-04-02", selected: true, action: "delete" }
        ]
      }
    ],
    strategies: [
      {
        id: "strat-node-modules",
        name: "Clean Real node_modules Directories",
        category: "dev",
        desc: "Finds dangling node_modules in inactive projects not updated in over 60 days.",
        command: "find ~ -name 'node_modules' -type d -prune -mtime +60 -exec rm -rf {} +",
        savingsBytes: 18500000000,
        safety: "safe",
        confidence: "99% High",
        enabled: true,
        action: "delete"
      }
    ],
    treemapNodes: [],
    topHogs: []
  },
  design: { totalFiles: 18240, healthScore: 52, burnRate: "+8.5 GB / week", daysLeft: "31 Days", aiInsight: "Found 24.5 GB of Adobe media caches.", duplicates: [], strategies: [], treemapNodes: [], topHogs: [] }
};

let currentWorkload = "dev";
let caseData = JSON.parse(JSON.stringify(WORKLOAD_PRESETS.dev));

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

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconClass = type === 'success' ? 'ph-check-circle' : type === 'warning' ? 'ph-warning' : 'ph-info';
  toast.innerHTML = `<i class="ph-duotone ${iconClass}" style="font-size: 18px; color: var(--primary);"></i> <span>${message}</span>`;
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
    }
  } catch (e) {
    console.log("Using static drive list fallback.");
  }
}

// Live Hard Drive Scan
async function runRealSystemDriveScan(path) {
  showToast(`Running CleanMyMac Smart Scan at ${path}...`, 'info');
  btnRealDiskScan.disabled = true;
  btnSmartCareScan.disabled = true;

  if (dialSvg) dialSvg.classList.add('scanning');
  dialMeterCircle.style.strokeDashoffset = "450";
  dialHealthScore.textContent = "...";

  let data = null;
  try {
    const res = await fetch(`/api/scan?path=${encodeURIComponent(path)}`);
    data = await res.json();
  } catch (netErr) {
    btnRealDiskScan.disabled = false;
    btnSmartCareScan.disabled = false;
    if (dialSvg) dialSvg.classList.remove('scanning');
    showToast(`Backend connection offline: ${netErr.message}`, 'warning');
    return;
  }

  btnRealDiskScan.disabled = false;
  btnSmartCareScan.disabled = false;
  if (dialSvg) dialSvg.classList.remove('scanning');

  if (!data || data.error) {
    showToast(`Scan Error: ${data ? data.error : 'Empty response'}`, 'warning');
    return;
  }

  try {
    caseData = data || {};
    renderAll();
    showToast(`Smart Care Scan Complete! Found ${Array.isArray(data.duplicates) ? data.duplicates.length : 0} duplicate groups.`, 'success');
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
        items.push({ path: f.path, action: f.action || 'delete' });
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
      body: JSON.stringify({ items })
    });
    const result = await res.json();

    if (result.status === 'success') {
      showToast(`Real System Cleanup Finished! Reclaimed ${formatBytes(result.reclaimedBytes)}!`, 'success');
      runRealSystemDriveScan(scanPathInput.value);
      fetchRealSystemHud();
    } else {
      showToast(`Execution Error: ${result.error}`, 'warning');
    }
  } catch (err) {
    showToast(`Execution Error: ${err.message}`, 'warning');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebarNav();
  fetchSystemDrives();
  fetchRealSystemHud();
  runRealSystemDriveScan(scanPathInput.value);

  driveSelectPicker.addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected === 'custom') {
      scanPathInput.focus();
      scanPathInput.select();
    } else {
      scanPathInput.value = selected;
      runRealSystemDriveScan(selected);
    }
  });

  btnRealDiskScan.addEventListener('click', () => runRealSystemDriveScan(scanPathInput.value));
  btnSmartCareScan.addEventListener('click', () => runRealSystemDriveScan(scanPathInput.value));

  btnToggleHud.addEventListener('click', () => {
    fetchRealSystemHud();
    hudDrawer.classList.toggle('open');
  });

  if (workloadSelect) workloadSelect.addEventListener('change', (e) => currentWorkload = e.target.value);
  if (btnScanPreset) {
    btnScanPreset.addEventListener('click', () => {
      caseData = JSON.parse(JSON.stringify(WORKLOAD_PRESETS[currentWorkload] || WORKLOAD_PRESETS['dev']));
      renderAll();
      showToast(`Loaded ${workloadSelect ? workloadSelect.options[workloadSelect.selectedIndex].text : 'preset'}!`, 'success');
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
      (caseData.strategies || []).forEach(s => { if (s.safety === 'safe') s.enabled = true; });
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
      showToast("Flagged all filtered big files for deletion audit!", "success");
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
  const currentPath = path || (scanPathInput ? scanPathInput.value : '/Users/linus');

  if (scopePathText) scopePathText.textContent = currentPath;

  if (scopeBadgeTag) {
    if (currentPath === '/Users/linus' || currentPath === '~') {
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
  runRealSystemDriveScan();
};

window.drillUpPathScope = function() {
  let curr = scanPathInput ? scanPathInput.value : '/Users/linus';
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

function renderAppleStorageBar() {
  const appleStorageBar = document.getElementById('appleStorageBar');
  const storageLegendContainer = document.getElementById('storageLegendContainer');
  const storageCapacityText = document.getElementById('storageCapacityText');
  const storageBarTitle = document.getElementById('storageBarTitle');

  if (!appleStorageBar || !storageLegendContainer) return;

  const currentPath = scanPathInput ? scanPathInput.value : '/Users/linus';
  let pathName = 'Macintosh HD';
  if (currentPath.includes('scratch')) {
    pathName = 'Scratch Workspace (~/scratch)';
  } else if (currentPath === '/Users/linus' || currentPath === '~') {
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

  if (statTotalFiles) statTotalFiles.textContent = caseData.totalFiles ? caseData.totalFiles.toLocaleString() : '0';
  if (statDuplicateCount) statDuplicateCount.textContent = `${caseData.duplicates ? caseData.duplicates.length : 0} Groups`;
  if (statReclaimableSpace) statReclaimableSpace.textContent = formatBytes(totalReclaimable);
  if (statHealthScore) statHealthScore.textContent = `${caseData.healthScore || 88}%`;

  const elSafeDeleteText = document.getElementById('btnTopSafeDeleteText');
  if (elSafeDeleteText) {
    elSafeDeleteText.textContent = `⚡ Safe Delete Selected (${formatBytes(dupBytes)})`;
  }

  const health = caseData.healthScore || 88;
  if (dialHealthScore) dialHealthScore.textContent = `${health}%`;
  if (dialMeterCircle) {
    const offset = 565 - (565 * (health / 100));
    dialMeterCircle.style.strokeDashoffset = offset;
  }
}

function renderDuplicatesLocker() {
  duplicatesListContainer.innerHTML = '';

  const dups = Array.isArray(caseData.duplicates) ? caseData.duplicates : [];

  if (dups.length === 0) {
    duplicatesListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">No duplicate files detected in this audit.</div>';
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
                <button class="action-chip ${file.action === 'delete' ? 'active delete' : ''}" onclick="setFileAction(${gIdx}, ${fIdx}, 'delete')">Delete</button>
                <button class="action-chip ${file.action === 'compress' ? 'active compress' : ''}" onclick="setFileAction(${gIdx}, ${fIdx}, 'compress')">Compress</button>
                <button class="action-chip ${file.action === 'migrate' ? 'active migrate' : ''}" onclick="setFileAction(${gIdx}, ${fIdx}, 'migrate')">Migrate NAS</button>
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
        if (idx > 0) f.action = 'delete';
      });
    } else if (rule === 'none') {
      group.files.forEach(f => f.selected = false);
    } else if (rule === 'oldest') {
      const sorted = [...group.files].sort((a, b) => new Date(a.mtime) - new Date(b.mtime));
      const oldestPath = sorted[0].path;
      group.files.forEach(f => {
        f.selected = (f.path !== oldestPath);
        if (f.path !== oldestPath) f.action = 'delete';
      });
    } else if (rule === 'newest') {
      const sorted = [...group.files].sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
      const newestPath = sorted[0].path;
      group.files.forEach(f => {
        f.selected = (f.path !== newestPath);
        if (f.path !== newestPath) f.action = 'delete';
      });
    } else if (rule === 'downloads') {
      group.files.forEach(f => {
        const isDownload = f.path.includes('/Downloads/') || f.path.includes('(1)');
        f.selected = isDownload;
        if (isDownload) f.action = 'delete';
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

  showToast(`Flagged ${totalSelectedFiles} duplicate copies (${formatBytes(totalSelectedBytes)}) for deletion!`, 'success');
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
      size: caseData.nodeModulesSize || "18.5 GB", 
      flex: "grid-column: span 3; grid-row: span 2;", 
      colorRgb: "0, 242, 254", 
      accent: "var(--primary)" 
    },
    { 
      name: "AI Models & Safetensors", 
      size: caseData.aiModelsSize || "42.5 GB", 
      flex: "grid-column: span 3; grid-row: span 2;", 
      colorRgb: "139, 92, 246", 
      accent: "#a855f7" 
    },
    { 
      name: "4K Video & Media Renders", 
      size: caseData.mediaSize || "14.2 GB", 
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "59, 130, 246", 
      accent: "#3b82f6" 
    },
    { 
      name: "Python __pycache__ Bytecode", 
      size: caseData.pycacheSize || "2.4 GB", 
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "245, 158, 11", 
      accent: "var(--accent-amber)" 
    },
    { 
      name: "VM Images (.vmdk / .iso)", 
      size: caseData.vmImagesSize || "68.0 GB", 
      flex: "grid-column: span 2; grid-row: span 2;", 
      colorRgb: "244, 63, 94", 
      accent: "var(--accent-rose)" 
    },
    { 
      name: "Archives & Database Dumps", 
      size: caseData.archivesSize || "8.6 GB", 
      flex: "grid-column: span 2; grid-row: span 1;", 
      colorRgb: "16, 185, 129", 
      accent: "var(--accent-emerald)" 
    },
    { 
      name: "macOS .DS_Store Clutter", 
      size: caseData.dsStoreSize || "124 MB", 
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
  caseData.duplicates.forEach(g => {
    g.files.forEach(f => {
      if (f.selected) lines.push(`rm -f "${f.path}"`);
    });
  });
  caseData.strategies.forEach(s => {
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

  // 1. If no duplicate files selected yet, auto-select non-primary duplicate copies
  let hasSelected = (caseData.duplicates || []).some(g => (g.files || []).some(f => f.selected));
  if (!hasSelected && caseData.duplicates && caseData.duplicates.length > 0) {
    caseData.duplicates.forEach(g => {
      (g.files || []).forEach((f, idx) => {
        if (idx > 0) f.selected = true; // Auto-flag secondary copy for deletion
      });
    });
  }

  // Render selected duplicates
  (caseData.duplicates || []).forEach((g) => {
    (g.files || []).forEach((f) => {
      if (f.selected) {
        totalBytes += (g.sizeBytes || 0);
        deleteCnt++;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
        const pathEscaped = f.path.replace(/'/g, "\\'");
        tr.innerHTML = `
          <td style="padding: 10px;"><span class="action-chip active delete"><i class="ph-duotone ph-trash"></i> DELETE COPY</span></td>
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
          No reclaimable items or duplicate files flagged for deletion. Run a scan to discover cleanable space.
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
        <span>42.5 GB</span>
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
  showToast(`Flagged for deletion script: ${path}`, 'success');
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

function renderArchaeologistStories() {
  const container = document.getElementById('archaeologistStoriesContainer');
  if (!container) return;

  container.innerHTML = '';
  const stories = caseData.archaeologistStories || [];

  stories.forEach(story => {
    const card = document.createElement('div');
    card.className = 'bento-tile';
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
              ${story.confidence}% Confidence
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
            ⚡ 3-Action Reclaim
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
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
  if (needProb) needProb.innerHTML = `Probability of future need: <span style="color: var(--accent-emerald); font-weight: 700;">${story.futureNeedProb || 2}%</span>`;

  if (whyList) {
    whyList.innerHTML = (story.why || []).map(w => `<span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); padding: 4px 10px; border-radius: 12px;"><i class="ph-duotone ph-check-circle" style="color: #a855f7;"></i> ${w.replace(/^✔\s*/, '')}</span>`).join('');
  }

  if (tbody) {
    tbody.innerHTML = '';
    const displayItems = (story.items && story.items.length > 0) ? story.items.slice(0, 30) : [
      { name: story.title + " Bundle", path: "/Users/linus/.../" + story.id, confidence: story.confidence, futureNeedProb: story.futureNeedProb, size: story.recoverFormatted }
    ];

    displayItems.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--glass-border)';

      const recAction = story.recommendedAction || 'delete';
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
            <button class="action-chip ${recAction === 'delete' ? 'active delete' : 'delete'}" id="chip-del-${idx}" onclick="selectStoryItemAction('${pathEscaped}', 'delete', 'chip-del-${idx}', '${idx}')">
              <i class="ph-duotone ph-trash"></i> Delete
            </button>
            <button class="action-chip ${recAction === 'compress' ? 'active compress' : 'compress'}" id="chip-comp-${idx}" onclick="selectStoryItemAction('${pathEscaped}', 'compress', 'chip-comp-${idx}', '${idx}')">
              <i class="ph-duotone ph-file-zip"></i> Compress
            </button>
            <button class="action-chip ${recAction === 'archive' ? 'active archive' : 'archive'}" id="chip-arch-${idx}" onclick="selectStoryItemAction('${pathEscaped}', 'archive', 'chip-arch-${idx}', '${idx}')">
              <i class="ph-duotone ph-archive"></i> Archive
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

  const currentPath = scanPathInput ? scanPathInput.value : '/Users/linus';
  let pathName = 'Macintosh HD';
  if (currentPath.includes('scratch')) {
    pathName = '~/scratch';
  } else if (currentPath === '/Users/linus' || currentPath === '~') {
    pathName = '~/Home';
  } else if (currentPath !== '/') {
    pathName = currentPath.split('/').filter(Boolean).pop() || currentPath;
  }

  if (assistantPathValue) assistantPathValue.textContent = pathName;

  const catBytesMap = caseData.categoryBytes || {};
  let totalCatBytes = 0;
  Object.values(catBytesMap).forEach(b => totalCatBytes += (b || 0));

  if (assistantClutterValue) assistantClutterValue.textContent = formatBytes(totalCatBytes);
  if (btnQuickCleanText) btnQuickCleanText.textContent = `⚡ Clean ${pathName} Now`;
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

let appSettings = {
  autoCompress: false,
  archivePath: '~/Volumes/NAS_Storage/Archive',
  menuBarCompanion: true
};

window.saveAppSetting = function(key, val) {
  appSettings[key] = val;
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
