/* =====================================================
   AgentBlueprint — script.js
   IBM SkillsBuild · Capstone Project IT & AI Agent Track
   
   Struktur:
   1. State Management & LocalStorage
   2. Sample Data
   3. Section Navigation
   4. Blueprint CRUD
   5. Task CRUD
   6. Readiness Score Engine
   7. Ethics & Risk Checklist
   8. Simulation Run Log
   9. Export (Markdown & JSON)
   10. Filter & Search
   11. Utility: Toast, Modal, ID Generator
   12. Init
   ===================================================== */

'use strict';

/* =====================================================
   1. STATE MANAGEMENT
   ===================================================== */

/** @type {{ blueprints: Blueprint[], activeFilter: string }} */
let state = {
  blueprints: [],
  activeFilter: 'all'
};

/** Load state from localStorage or seed sample data */
function loadState() {
  // v2: bumped from v1 to force fresh sample data with the new blueprints
  const raw = localStorage.getItem('agentblueprint_v2');
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = { blueprints: [], activeFilter: 'all' };
    }
  } else {
    state.blueprints = getSampleData();
  }
}

/** Persist state to localStorage */
function saveState() {
  localStorage.setItem('agentblueprint_v2', JSON.stringify(state));
}

/* =====================================================
   2. SAMPLE DATA (2 contoh blueprint)
   ===================================================== */

function getSampleData() {
  return [
    /* ── Blueprint 1: SKOR TINGGI (Siap) ──────────────────────── */
    {
      id: 'bp-sample-1',
      name: 'Customer Support Agent',
      goal: 'Selesaikan ≥90% tiket Level-1 dalam waktu ≤5 menit dengan CSAT ≥4.5/5',
      desc: 'Agent AI berbasis LLM yang menangani tiket dukungan pelanggan: klasifikasi otomatis, jawaban FAQ dari knowledge base, dan eskalasi terstruktur ke L2 jika confidence rendah atau isu sensitif.',
      tasks: [
        {
          id: 'task-s1-1',
          name: 'Classify Ticket',
          input: 'Teks tiket dari user (max 500 karakter) + metadata channel',
          validation: 'Confidence score ≥ 0.85; label harus salah satu dari 12 enum resmi; waktu respons < 800ms',
          output: 'Label kategori + tingkat prioritas (low/med/high) + confidence score',
          tools: 'OpenAI GPT-4o API, Internal Taxonomy DB v3',
          failureStrategy: 'fallback',
          failureNote: 'Jika confidence < 0.85, fallback ke routing manual dengan flag "low-confidence" dan notifikasi supervisor',
          humanApproval: false
        },
        {
          id: 'task-s1-2',
          name: 'Generate FAQ Response',
          input: 'Kategori tiket + teks pertanyaan + riwayat 3 interaksi terakhir',
          validation: 'Response harus ada dalam knowledge base; panjang 50–300 kata; tidak mengandung PII',
          output: 'Jawaban terformat markdown dengan tautan sumber dan tombol eskalasi',
          tools: 'OpenAI API, Zendesk KB Search API, PII Detector',
          failureStrategy: 'retry',
          failureNote: 'Retry 2× dengan backoff 500ms; jika tetap gagal, sajikan template fallback dan log error',
          humanApproval: false
        },
        {
          id: 'task-s1-3',
          name: 'Sentiment & Risk Check',
          input: 'Teks percakapan lengkap + metadata akun pelanggan',
          validation: 'Skor sentimen valid (−1 s.d. +1); kategori risiko harus salah satu dari: low/medium/high/critical',
          output: 'Laporan sentimen + flag risiko + rekomendasi tindak lanjut',
          tools: 'Watson NLU API, Internal Risk Scoring Model',
          failureStrategy: 'timeout',
          failureNote: 'Timeout 5 detik; jika gagal, default ke risk=medium dan lanjutkan alur dengan peringatan',
          humanApproval: false
        },
        {
          id: 'task-s1-4',
          name: 'Escalate to Human Agent',
          input: 'Tiket beserta history + alasan eskalasi + skor risiko',
          validation: 'Alasan eskalasi terdokumentasi; agen manusia tersedia dalam SLA 2 menit; tiket tidak sudah di-handle',
          output: 'Tiket dialihkan ke antrian L2 dengan konteks lengkap dan priority flag',
          tools: 'Zendesk API, Slack Notification API, Workforce Management API',
          failureStrategy: 'rollback',
          failureNote: 'Jika antrian L2 penuh, rollback ke L1 dengan prioritas HIGH dan notif supervisor via PagerDuty',
          humanApproval: true
        }
      ],
      ethics: {
        bias_audit: true,
        explainability: true,
        privacy_impact: true,
        safety_canary: true
      },
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },

    /* ── Blueprint 2: SKOR RENDAH (Belum Siap) ─────────────────── */
    {
      id: 'bp-sample-2',
      name: 'Social Media Monitor Bot',
      goal: 'Monitor brand mentions di media sosial',
      desc: '',
      tasks: [
        {
          id: 'task-s2-1',
          name: 'Scrape Mentions',
          input: 'Keyword daftar brand',
          validation: '',
          output: 'Daftar post',
          tools: '',
          failureStrategy: '',
          failureNote: '',
          humanApproval: false
        },
        {
          id: 'task-s2-2',
          name: 'Classify Sentiment',
          input: 'Teks post',
          validation: '',
          output: 'Label positif/negatif',
          tools: 'OpenAI API',
          failureStrategy: '',
          failureNote: '',
          humanApproval: false
        }
      ],
      ethics: {
        bias_audit: false,
        explainability: false,
        privacy_impact: false,
        safety_canary: false
      },
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];
}

/* =====================================================
   3. SECTION NAVIGATION
   ===================================================== */

const SECTIONS = ['builder', 'ethics', 'simulation', 'export'];

/** Show one section, hide others, update nav active state */
function showSection(name) {
  SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`nav-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
    if (btn) btn.classList.toggle('active', s === name);
  });

  // Populate selects when switching to certain sections
  if (name === 'ethics') populateBlueprintSelect('ethics-bp-select');
  if (name === 'simulation') populateBlueprintSelect('sim-bp-select');
  if (name === 'export') {
    populateBlueprintSelect('export-bp-select');
    // Bind change event for export preview
    document.getElementById('export-bp-select').onchange = updateExportPreview;
  }
}

/** Fill a <select> with all blueprints */
function populateBlueprintSelect(selectId) {
  const sel = document.getElementById(selectId);
  const current = sel.value;
  sel.innerHTML = '<option value="">— Pilih Blueprint —</option>';
  state.blueprints.forEach(bp => {
    const opt = document.createElement('option');
    opt.value = bp.id;
    opt.textContent = bp.name;
    sel.appendChild(opt);
  });
  // Restore previous selection if still valid
  if (current && state.blueprints.find(b => b.id === current)) {
    sel.value = current;
  }
}

/* =====================================================
   4. BLUEPRINT CRUD
   ===================================================== */

/** Open modal to create or edit a blueprint */
function openBlueprintModal(id = null) {
  const modal = document.getElementById('modal-blueprint');
  const titleEl = document.getElementById('modal-bp-title');
  document.getElementById('bp-id').value = '';
  document.getElementById('bp-name').value = '';
  document.getElementById('bp-goal').value = '';
  document.getElementById('bp-desc').value = '';

  if (id) {
    const bp = state.blueprints.find(b => b.id === id);
    if (!bp) return;
    document.getElementById('bp-id').value = bp.id;
    document.getElementById('bp-name').value = bp.name;
    document.getElementById('bp-goal').value = bp.goal;
    document.getElementById('bp-desc').value = bp.desc || '';
    titleEl.textContent = 'Edit Blueprint';
  } else {
    titleEl.textContent = 'Buat Blueprint Baru';
  }

  openModal('modal-blueprint');
}

/** Save blueprint (create or update) */
function saveBlueprint(e) {
  e.preventDefault();
  const name = document.getElementById('bp-name').value.trim();
  const goal = document.getElementById('bp-goal').value.trim();
  if (!name || !goal) { showToast('Nama dan Tujuan wajib diisi.', 'error'); return; }

  const id = document.getElementById('bp-id').value;
  if (id) {
    // Update existing
    const bp = state.blueprints.find(b => b.id === id);
    if (bp) {
      bp.name = name;
      bp.goal = goal;
      bp.desc = document.getElementById('bp-desc').value.trim();
    }
    showToast('Blueprint berhasil diperbarui.', 'success');
  } else {
    // Create new
    state.blueprints.unshift({
      id: genId('bp'),
      name,
      goal,
      desc: document.getElementById('bp-desc').value.trim(),
      tasks: [],
      ethics: { bias_audit: false, explainability: false, privacy_impact: false, safety_canary: false },
      createdAt: new Date().toISOString()
    });
    showToast('Blueprint baru dibuat.', 'success');
  }

  saveState();
  closeModal('modal-blueprint');
  renderBlueprints();
}

/** Delete a blueprint with confirmation */
function deleteBlueprint(id) {
  const bp = state.blueprints.find(b => b.id === id);
  if (!bp) return;
  if (!confirm(`Hapus blueprint "${bp.name}"? Semua task akan ikut terhapus.`)) return;
  state.blueprints = state.blueprints.filter(b => b.id !== id);
  saveState();
  renderBlueprints();
  showToast('Blueprint dihapus.', 'info');
}

/* =====================================================
   5. TASK CRUD
   ===================================================== */

/** Open task modal for create or edit */
function openTaskModal(bpId, taskId = null) {
  // Reset form
  ['task-id','task-bp-id','task-name','task-input','task-validation',
   'task-output','task-tools','task-failure-note'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('task-failure').value = '';
  document.getElementById('task-human').checked = false;
  document.getElementById('modal-task-title').textContent = taskId ? 'Edit Task' : 'Tambah Task';
  document.getElementById('task-bp-id').value = bpId;

  if (taskId) {
    const bp = state.blueprints.find(b => b.id === bpId);
    const task = bp && bp.tasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-name').value = task.name;
    document.getElementById('task-input').value = task.input || '';
    document.getElementById('task-validation').value = task.validation || '';
    document.getElementById('task-output').value = task.output || '';
    document.getElementById('task-tools').value = task.tools || '';
    document.getElementById('task-failure').value = task.failureStrategy || '';
    document.getElementById('task-failure-note').value = task.failureNote || '';
    document.getElementById('task-human').checked = !!task.humanApproval;
  }

  openModal('modal-task');
}

/** Save task (create or update) */
function saveTask(e) {
  e.preventDefault();
  const name = document.getElementById('task-name').value.trim();
  if (!name) { showToast('Nama task wajib diisi.', 'error'); return; }

  const bpId = document.getElementById('task-bp-id').value;
  const taskId = document.getElementById('task-id').value;
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;

  const taskData = {
    name,
    input:           document.getElementById('task-input').value.trim(),
    validation:      document.getElementById('task-validation').value.trim(),
    output:          document.getElementById('task-output').value.trim(),
    tools:           document.getElementById('task-tools').value.trim(),
    failureStrategy: document.getElementById('task-failure').value,
    failureNote:     document.getElementById('task-failure-note').value.trim(),
    humanApproval:   document.getElementById('task-human').checked
  };

  if (taskId) {
    const idx = bp.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) bp.tasks[idx] = { id: taskId, ...taskData };
    showToast('Task diperbarui.', 'success');
  } else {
    bp.tasks.push({ id: genId('task'), ...taskData });
    showToast('Task ditambahkan.', 'success');
  }

  saveState();
  closeModal('modal-task');

  // Re-render detail modal if open
  if (!document.getElementById('modal-detail').classList.contains('hidden')) {
    openDetailModal(bpId);
  }
  renderBlueprints();
}

/** Delete a task from a blueprint */
function deleteTask(bpId, taskId) {
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;
  const task = bp.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!confirm(`Hapus task "${task.name}"?`)) return;
  bp.tasks = bp.tasks.filter(t => t.id !== taskId);
  saveState();
  renderBlueprints();
  openDetailModal(bpId); // refresh detail
  showToast('Task dihapus.', 'info');
}

/* =====================================================
   6. READINESS SCORE ENGINE
   ===================================================== */

/**
 * Hitung skor kesiapan blueprint (0–100).
 *
 * Bobot:
 *  - Tujuan terukur diisi           : +15
 *  - Deskripsi diisi                : +5
 *  - Jumlah task (1pt per task, max 20): max +20
 *  - Validasi diisi per task        : +2 per task, max 20
 *  - Failure mode diisi per task    : +2 per task, max 10
 *  - Human approval ada (≥1 task)   : +5
 *  - Ethics: per item               : +3.75 (4 items = +15)
 *
 * Total max = 15+5+20+20+10+5+15 = 90  → normalized to 100
 */
function calculateScore(bp) {
  let score = 0;
  const details = { suggestions: [], breakdown: [] };

  // ── Tujuan terukur (+15) ──
  let goalPts = 0;
  if (bp.goal && bp.goal.trim().length > 0) {
    goalPts = 15; score += 15;
  } else {
    details.suggestions.push('Tambahkan tujuan terukur yang spesifik (SMART).');
  }
  details.breakdown.push({ label: 'Tujuan terukur', earned: goalPts, max: 15 });

  // ── Deskripsi (+5) ──
  let descPts = 0;
  if (bp.desc && bp.desc.trim().length > 10) {
    descPts = 5; score += 5;
  } else {
    details.suggestions.push('Lengkapi deskripsi agent untuk konteks yang lebih baik.');
  }
  details.breakdown.push({ label: 'Deskripsi agent', earned: descPts, max: 5 });

  // ── Task count (max 20) ──
  const taskCount = bp.tasks.length;
  const taskPts = Math.min(taskCount * 4, 20);
  score += taskPts;
  if (taskCount === 0) {
    details.suggestions.push('Tambahkan minimal 1 task untuk blueprint ini.');
  } else if (taskCount < 3) {
    details.suggestions.push('Pertimbangkan mendekomposisi lebih lanjut (≥3 task).');
  }
  details.breakdown.push({ label: `Dekomposisi task (${taskCount} task)`, earned: taskPts, max: 20 });

  // ── Validasi per task (max 20) ──
  let validationScore = 0;
  let failureScore = 0;
  let tasksWithoutValidation = 0;
  let tasksWithoutFailure = 0;

  bp.tasks.forEach(task => {
    if (task.validation && task.validation.trim().length > 0) {
      validationScore += 2;
    } else {
      tasksWithoutValidation++;
    }
    if (task.failureStrategy) {
      failureScore += 2;
    } else {
      tasksWithoutFailure++;
    }
  });

  const validationPts = Math.min(validationScore, 20);
  const failurePts    = Math.min(failureScore, 10);
  score += validationPts;
  score += failurePts;

  if (tasksWithoutValidation > 0) {
    details.suggestions.push(`Isi kriteria validasi untuk ${tasksWithoutValidation} task yang belum memilikinya.`);
  }
  if (tasksWithoutFailure > 0) {
    details.suggestions.push(`Tentukan strategi failure mode untuk ${tasksWithoutFailure} task.`);
  }
  details.breakdown.push({ label: `Validasi task (${taskCount - tasksWithoutValidation}/${taskCount} terisi)`, earned: validationPts, max: 20 });
  details.breakdown.push({ label: `Failure mode (${taskCount - tasksWithoutFailure}/${taskCount} terisi)`, earned: failurePts, max: 10 });

  // ── Human-in-the-loop (+5) ──
  const hasHighRiskTask = bp.tasks.some(t => t.humanApproval);
  const humanPts = hasHighRiskTask ? 5 : 0;
  score += humanPts;
  if (!hasHighRiskTask && bp.tasks.length > 0) {
    details.suggestions.push('Tandai setidaknya 1 task berisiko tinggi untuk human approval (Human-in-the-Loop).');
  }
  details.breakdown.push({ label: 'Human-in-the-Loop checkpoint', earned: humanPts, max: 5 });

  // ── Ethics (4 × 3.75 = 15) ──
  const ethics = bp.ethics || {};
  const ethicsKeys = ['bias_audit', 'explainability', 'privacy_impact', 'safety_canary'];
  const ethicsChecked = ethicsKeys.filter(k => ethics[k]).length;
  const ethicsPts = Math.round(ethicsChecked * 3.75);
  score += ethicsChecked * 3.75;

  const missingEthics = ethicsKeys.filter(k => !ethics[k]).map(k => ETHICS_ITEMS[k]?.label || k);
  if (missingEthics.length > 0) {
    details.suggestions.push(`Lengkapi Ethics Checklist: ${missingEthics.slice(0, 2).join(', ')}${missingEthics.length > 2 ? ', ...' : ''}.`);
  }
  details.breakdown.push({ label: `Ethics checklist (${ethicsChecked}/4 item)`, earned: ethicsPts, max: 15 });

  // ── Normalize to 0–100 ──
  const maxRaw = 90;
  const normalized = Math.round(Math.min((score / maxRaw) * 100, 100));

  let category, cssClass;
  if (normalized >= 75) {
    category = 'Siap'; cssClass = 'score-ready';
  } else if (normalized >= 40) {
    category = 'Cukup Siap'; cssClass = 'score-partial';
  } else {
    category = 'Belum Siap'; cssClass = 'score-not-ready';
  }

  return { score: normalized, category, cssClass, suggestions: details.suggestions, breakdown: details.breakdown };
}

/* =====================================================
   7. ETHICS & RISK CHECKLIST
   ===================================================== */

/** Ethics checklist items definition */
const ETHICS_ITEMS = {
  bias_audit: {
    label: 'Bias Audit',
    desc: 'Model telah diuji terhadap bias demografis dan dataset representatif.'
  },
  explainability: {
    label: 'Explainability',
    desc: 'Keputusan agent dapat dijelaskan kepada pengguna dan stakeholder.'
  },
  privacy_impact: {
    label: 'Privacy Impact Assessment',
    desc: 'Data pribadi diidentifikasi, diminimalkan, dan dilindungi sesuai regulasi.'
  },
  safety_canary: {
    label: 'Safety Canary',
    desc: 'Mekanisme deteksi dini untuk output berbahaya atau perilaku tak terduga.'
  }
};

/** Render ethics panel for selected blueprint */
function renderEthicsPanel() {
  const bpId = document.getElementById('ethics-bp-select').value;
  const panel = document.getElementById('ethics-panel');

  if (!bpId) { panel.classList.add('hidden'); return; }

  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) { panel.classList.add('hidden'); return; }

  panel.classList.remove('hidden');
  document.getElementById('ethics-bp-name').textContent = bp.name;

  const container = document.getElementById('ethics-items');
  container.innerHTML = '';

  Object.entries(ETHICS_ITEMS).forEach(([key, item]) => {
    const checked = bp.ethics && bp.ethics[key];
    const div = document.createElement('label');
    div.className = `ethics-item${checked ? ' checked' : ''}`;
    div.setAttribute('for', `ethics-${key}`);
    div.innerHTML = `
      <input type="checkbox" id="ethics-${key}" class="w-4 h-4 accent-ibm-blue mt-0.5 flex-shrink-0"
        ${checked ? 'checked' : ''} onchange="toggleEthics('${bpId}','${key}',this.checked)" />
      <div>
        <p class="text-sm font-semibold text-ibm-gray100">${item.label}</p>
        <p class="text-xs text-ibm-gray50 readable-muted mt-0.5">${item.desc}</p>
      </div>
    `;
    container.appendChild(div);
  });

  updateEthicsScoreInfo(bp);
}

/** Toggle individual ethics item and re-render */
function toggleEthics(bpId, key, checked) {
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;
  if (!bp.ethics) bp.ethics = {};
  bp.ethics[key] = checked;
  saveState();
  renderBlueprints();
  renderEthicsPanel(); // re-render to update label style
  showToast(checked ? `${ETHICS_ITEMS[key].label} dicentang.` : `${ETHICS_ITEMS[key].label} tidak dicentang.`, 'info');
}

/** Update score info text in ethics panel */
function updateEthicsScoreInfo(bp) {
  const { score, category } = calculateScore(bp);
  document.getElementById('ethics-score-info').textContent =
    `Readiness Score saat ini: ${score}/100 (${category}). Centang semua item untuk meningkatkan skor.`;
}

/* =====================================================
   8. SIMULATION RUN LOG
   ===================================================== */

/** Status options for simulation */
const SIM_STATUSES = ['success', 'success', 'success', 'failed', 'waiting_approval'];

/** Run simulation for selected blueprint */
function runSimulation() {
  const bpId = document.getElementById('sim-bp-select').value;
  if (!bpId) { showToast('Pilih blueprint terlebih dahulu.', 'error'); return; }

  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp || bp.tasks.length === 0) {
    showToast('Blueprint tidak memiliki task untuk disimulasikan.', 'error');
    return;
  }

  const logContainer = document.getElementById('sim-log');
  logContainer.innerHTML = '';
  document.getElementById('sim-summary').classList.add('hidden');

  const results = [];

  bp.tasks.forEach((task, idx) => {
    // Deterministic-ish simulation: human approval tasks → waiting_approval
    let status;
    if (task.humanApproval) {
      status = 'waiting_approval';
    } else {
      // Weighted random: 70% success, 20% success, 10% failed
      const r = Math.random();
      status = r < 0.75 ? 'success' : 'failed';
    }

    const latency = Math.floor(Math.random() * 1800) + 80; // 80–1880ms
    results.push({ task, status, latency });

    // Build log row
    const row = document.createElement('div');
    const statusConfig = {
      success:          { cls: 'sim-success', icon: '✅', label: 'Success' },
      failed:           { cls: 'sim-failed',  icon: '❌', label: 'Failed' },
      waiting_approval: { cls: 'sim-waiting', icon: '⏳', label: 'Waiting Approval' }
    }[status];

    row.className = `sim-log-row ${statusConfig.cls}`;
    row.style.animationDelay = `${idx * 80}ms`;
    row.style.animation = 'slideUp 0.25s ease both';
    row.innerHTML = `
      <span class="text-lg flex-shrink-0">${statusConfig.icon}</span>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-ibm-gray100 truncate">${escHtml(task.name)}</p>
        <p class="text-xs text-ibm-gray50 readable-muted">
          Tools: ${escHtml(task.tools || '—')}
          ${task.failureStrategy ? ` · Failure mode: <span class="font-medium">${task.failureStrategy}</span>` : ''}
        </p>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="font-semibold text-ibm-gray100">${statusConfig.label}</span>
        <p class="text-xs text-ibm-gray50">${latency}ms</p>
      </div>
    `;
    logContainer.appendChild(row);
  });

  // Summary
  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  const successRate = Math.round((successCount / totalCount) * 100);
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latency, 0) / totalCount);

  document.getElementById('sim-success-rate').textContent = `${successRate}%`;
  document.getElementById('sim-avg-latency').textContent = `${avgLatency}ms`;
  document.getElementById('sim-task-count').textContent = totalCount;
  document.getElementById('sim-summary').classList.remove('hidden');

  showToast('Simulasi selesai.', 'success');
}

/* =====================================================
   9. EXPORT (Markdown & JSON)
   ===================================================== */

/** Generate Markdown string for a blueprint */
function generateMarkdown(bp) {
  const { score, category } = calculateScore(bp);
  const date = new Date(bp.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' });

  let md = `# ${bp.name}\n\n`;
  md += `> **IBM SkillsBuild AgentBlueprint** — Dibuat: ${date}\n\n`;
  md += `## Tujuan Terukur\n${bp.goal}\n\n`;
  if (bp.desc) md += `## Deskripsi\n${bp.desc}\n\n`;
  md += `## Readiness Score\n**${score}/100** — ${category}\n\n`;
  md += `## Task List\n\n`;

  bp.tasks.forEach((task, i) => {
    md += `### ${i + 1}. ${task.name}\n`;
    if (task.input)           md += `- **Input:** ${task.input}\n`;
    if (task.validation)      md += `- **Validasi:** ${task.validation}\n`;
    if (task.output)          md += `- **Output:** ${task.output}\n`;
    if (task.tools)           md += `- **Tools/API:** ${task.tools}\n`;
    if (task.failureStrategy) md += `- **Failure Strategy:** ${task.failureStrategy}\n`;
    if (task.failureNote)     md += `- **Failure Note:** ${task.failureNote}\n`;
    md += `- **Human Approval:** ${task.humanApproval ? 'Ya' : 'Tidak'}\n\n`;
  });

  md += `## Ethics & Risk Checklist\n`;
  Object.entries(ETHICS_ITEMS).forEach(([key, item]) => {
    md += `- [${bp.ethics && bp.ethics[key] ? 'x' : ' '}] ${item.label}\n`;
  });
  md += '\n';

  return md;
}

/** Download Markdown file */
function exportMarkdown() {
  const bpId = document.getElementById('export-bp-select').value;
  if (!bpId) { showToast('Pilih blueprint terlebih dahulu.', 'error'); return; }
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;

  const content = generateMarkdown(bp);
  downloadFile(`${slugify(bp.name)}.md`, content, 'text/markdown');
  showToast('Markdown berhasil diunduh.', 'success');
}

/** Download JSON file */
function exportJSON() {
  const bpId = document.getElementById('export-bp-select').value;
  if (!bpId) { showToast('Pilih blueprint terlebih dahulu.', 'error'); return; }
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;

  const scoreData = calculateScore(bp);
  const exportObj = { ...bp, readinessScore: scoreData.score, readinessCategory: scoreData.category };
  const content = JSON.stringify(exportObj, null, 2);
  downloadFile(`${slugify(bp.name)}.json`, content, 'application/json');
  showToast('JSON berhasil diunduh.', 'success');
}

/** Update export preview when blueprint is selected */
function updateExportPreview() {
  const bpId = document.getElementById('export-bp-select').value;
  const previewBlock = document.getElementById('export-preview');
  if (!bpId) { previewBlock.classList.add('hidden'); return; }
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;
  document.getElementById('export-preview-content').textContent = generateMarkdown(bp);
  previewBlock.classList.remove('hidden');
}

/* =====================================================
   10. FILTER & SEARCH + RENDER
   ===================================================== */

let activeFilter = 'all';

function setFilter(filter) {
  activeFilter = filter;
  ['all', 'ready', 'not_ready'].forEach(f => {
    document.getElementById(`filter-${f}`).classList.toggle('active', f === filter);
  });
  renderBlueprints();
}

/** Main render function — rebuilds the blueprint grid */
/** Render summary stats bar above the blueprint grid */
function renderSummaryBar() {
  const bar = document.getElementById('summary-bar');
  if (!bar) return;
  const total = state.blueprints.length;
  if (total === 0) { bar.classList.add('hidden'); return; }

  const scores = state.blueprints.map(bp => calculateScore(bp).score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const readyCount = scores.filter(s => s >= 75).length;

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="stat-card-sm">
      <span class="stat-label-sm">Total Blueprint</span>
      <span class="stat-value-sm">${total}</span>
    </div>
    <div class="stat-card-sm">
      <span class="stat-label-sm">Rata-rata Skor</span>
      <span class="stat-value-sm" style="color:${avgScore >= 75 ? 'var(--ibm-green)' : avgScore >= 40 ? '#92400e' : 'var(--ibm-red)'}">${avgScore}<span style="font-size:0.9rem;font-weight:500">/100</span></span>
    </div>
    <div class="stat-card-sm">
      <span class="stat-label-sm">Blueprint Siap</span>
      <span class="stat-value-sm" style="color:var(--ibm-green)">${readyCount}<span style="font-size:0.9rem;font-weight:500;color:var(--ibm-gray50)"> / ${total}</span></span>
    </div>
  `;
}

function renderBlueprints() {
  const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const container = document.getElementById('blueprint-list');
  const emptyState = document.getElementById('empty-state');
  container.innerHTML = '';

  // Always refresh summary bar (uses full list, not filtered)
  renderSummaryBar();

  // Filter by search query
  let filtered = state.blueprints.filter(bp => {
    if (query && !bp.name.toLowerCase().includes(query) &&
        !bp.goal.toLowerCase().includes(query) &&
        !(bp.desc || '').toLowerCase().includes(query)) return false;
    return true;
  });

  // Filter by readiness
  if (activeFilter !== 'all') {
    filtered = filtered.filter(bp => {
      const { score } = calculateScore(bp);
      if (activeFilter === 'ready') return score >= 75;
      if (activeFilter === 'not_ready') return score < 75;
      return true;
    });
  }

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(bp => {
    const { score, category, cssClass, suggestions } = calculateScore(bp);
    const taskCount = bp.tasks.length;
    const humanTasks = bp.tasks.filter(t => t.humanApproval).length;
    const barColor = score >= 75 ? '#24A148' : score >= 40 ? '#F1C21B' : '#DA1E28';

    const card = document.createElement('article');
    card.className = 'blueprint-card';
    card.setAttribute('aria-label', `Blueprint: ${bp.name}`);
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-bold text-ibm-gray100 text-base leading-tight">${escHtml(bp.name)}</h3>
        <span class="score-badge ${cssClass} flex-shrink-0">${category}</span>
      </div>
      <p class="card-goal line-clamp-2">${escHtml(bp.goal)}</p>
      
      <!-- Score Bar -->
      <div>
        <div class="flex items-center justify-between mb-1" style="font-size:0.8rem">
          <span style="font-weight:600;color:var(--ibm-gray80)">Readiness Score</span>
          <span style="font-weight:800;color:${barColor}">${score}/100</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${score}%;background:${barColor}"></div>
        </div>
      </div>
      
      <!-- Stats -->
      <div class="card-meta">
        <span>📋 ${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
        ${humanTasks > 0 ? `<span>👤 ${humanTasks} human checkpoint</span>` : ''}
        <span style="margin-left:auto">${new Date(bp.createdAt).toLocaleDateString('id-ID')}</span>
      </div>
      
      <!-- Suggestions (max 2) -->
      ${suggestions.length > 0 ? `
      <div class="border-t border-ibm-gray20 pt-2 space-y-1">
        ${suggestions.slice(0, 2).map(s => `<p class="suggestion-item card-suggest"><span style="color:var(--ibm-yellow)">⚠</span> ${escHtml(s)}</p>`).join('')}
      </div>` : ''}
      
      <!-- Actions -->
      <div class="flex items-center gap-2 border-t border-ibm-gray20 pt-3 mt-auto">
        <button onclick="openDetailModal('${bp.id}')" class="btn-secondary text-xs py-1.5 flex-1" aria-label="Lihat detail ${escHtml(bp.name)}">
          Detail &amp; Tasks
        </button>
        <button onclick="openBlueprintModal('${bp.id}')" class="btn-icon" title="Edit Blueprint" aria-label="Edit ${escHtml(bp.name)}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="deleteBlueprint('${bp.id}')" class="btn-icon text-ibm-red hover:bg-ibm-redlight" title="Hapus Blueprint" aria-label="Hapus ${escHtml(bp.name)}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* =====================================================
   11. DETAIL MODAL
   ===================================================== */

/** Build the Score Breakdown HTML panel */
function buildScoreBreakdown(breakdown, score, barColor) {
  const rows = breakdown.map(item => {
    const pct = item.max > 0 ? Math.round((item.earned / item.max) * 100) : 0;
    const rowColor = item.earned >= item.max ? '#24A148' : item.earned > 0 ? '#F1C21B' : '#DA1E28';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--ibm-gray20)">
        <span style="flex:1;font-size:0.8rem;color:var(--ibm-gray80)">${escHtml(item.label)}</span>
        <div style="width:80px;height:6px;background:var(--ibm-gray20);border-radius:9999px;overflow:hidden;flex-shrink:0">
          <div style="height:100%;width:${pct}%;background:${rowColor};border-radius:9999px;transition:width 0.5s"></div>
        </div>
        <span style="width:44px;text-align:right;font-size:0.78rem;font-weight:700;color:${rowColor};flex-shrink:0">${item.earned}/${item.max}</span>
      </div>
    `;
  }).join('');

  return `
    <div style="background:var(--ibm-gray10);border-radius:12px;padding:14px 16px;margin-bottom:16px">
      <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ibm-gray50);margin-bottom:8px">Rincian Skor</p>
      ${rows}
      <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:6px">
        <span style="font-size:0.85rem;font-weight:800;color:${barColor}">Total: ${score}/100</span>
      </div>
    </div>
  `;
}

/** Open detail modal showing all tasks for a blueprint */
function openDetailModal(bpId) {
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return;

  const { score, category, cssClass, suggestions, breakdown } = calculateScore(bp);
  const barColor = score >= 75 ? '#24A148' : score >= 40 ? '#F1C21B' : '#DA1E28';

  document.getElementById('modal-detail-title').textContent = bp.name;

  let html = `
    <!-- Blueprint Info -->
    <div class="mb-5 p-4 bg-ibm-gray10 rounded-xl">
      <div class="flex items-center gap-2 mb-2">
        <span class="score-badge ${cssClass}">${category}</span>
        <span class="font-bold text-lg" style="color:${barColor}">${score}/100</span>
      </div>
      <div class="score-bar-track mb-3">
        <div class="score-bar-fill" style="width:${score}%;background:${barColor}"></div>
      </div>
      <p class="text-sm text-ibm-gray80"><strong>Tujuan:</strong> ${escHtml(bp.goal)}</p>
      ${bp.desc ? `<p class="text-sm readable-muted mt-1" style="color:var(--ibm-gray60)">${escHtml(bp.desc)}</p>` : ''}
    </div>

    <!-- Score Breakdown panel (Fix 1) -->
    ${buildScoreBreakdown(breakdown, score, barColor)}
    
    ${suggestions.length > 0 ? `
    <div class="mb-5 p-3 bg-ibm-yellowlight border border-yellow-200 rounded-xl">
      <p class="text-xs font-semibold text-yellow-700 uppercase mb-2">Saran Perbaikan</p>
      ${suggestions.map(s => `<p class="suggestion-item text-xs"><span style="color:var(--ibm-yellow)">▸</span> ${escHtml(s)}</p>`).join('')}
    </div>` : ''}
    
    <!-- Task List Header -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-ibm-gray100">Tasks (${bp.tasks.length})</h3>
      <button onclick="openTaskModal('${bp.id}')" class="btn-primary text-xs py-1.5 px-3" aria-label="Tambah task baru">
        + Tambah Task
      </button>
    </div>
    
    <!-- Tasks -->
    <div class="space-y-3">
  `;

  if (bp.tasks.length === 0) {
    html += `<p class="text-sm text-ibm-gray50 text-center py-6">Belum ada task. Tambahkan task pertama.</p>`;
  } else {
    bp.tasks.forEach(task => {
      const strategyClass = task.failureStrategy ? `task-badge-${task.failureStrategy}` : 'task-badge-none';
      html += `
        <div class="task-row">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <p class="font-semibold text-sm text-ibm-gray100">${escHtml(task.name)}</p>
              ${task.humanApproval ? `<span class="task-badge bg-ibm-bluelight text-ibm-blue">👤 Human Approval</span>` : ''}
              ${task.failureStrategy ? `<span class="task-badge ${strategyClass}">${task.failureStrategy}</span>` : ''}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-ibm-gray50 readable-muted">
              ${task.input ?      `<p><strong>Input:</strong> ${escHtml(task.input)}</p>` : ''}
              ${task.validation ? `<p><strong>Validasi:</strong> ${escHtml(task.validation)}</p>` : ''}
              ${task.output ?     `<p><strong>Output:</strong> ${escHtml(task.output)}</p>` : ''}
              ${task.tools ?      `<p><strong>Tools:</strong> ${escHtml(task.tools)}</p>` : ''}
              ${task.failureNote ? `<p class="sm:col-span-2"><strong>Failure note:</strong> ${escHtml(task.failureNote)}</p>` : ''}
            </div>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <button onclick="openTaskModal('${bp.id}','${task.id}')" class="btn-icon" title="Edit task" aria-label="Edit task ${escHtml(task.name)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="deleteTask('${bp.id}','${task.id}')" class="btn-icon text-ibm-red hover:bg-ibm-redlight" title="Hapus task" aria-label="Hapus task ${escHtml(task.name)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;

  // ── Asisten Blueprint chat panel ──
  html += buildAssistantPanel(bp.id);

  document.getElementById('modal-detail-content').innerHTML = html;
  openModal('modal-detail');
}

/* =====================================================
   12. ASISTEN BLUEPRINT (Rule-based chat)
   ===================================================== */

/**
 * Render the chat panel HTML.
 * The panel lives inside modal-detail-content and uses the bpId
 * to pull live blueprint data when the user sends a message.
 */
function buildAssistantPanel(bpId) {
  const chips = [
    'Kenapa skor saya rendah?',
    'Apa yang harus diperbaiki?',
    'Apakah blueprint sudah siap?',
    'Bagaimana kondisi task saya?',
    'Apa itu human approval?',
    'Tips ethics checklist?',
  ];
  const chipHtml = chips.map(c =>
    `<button class="asst-chip" onclick="sendAssistantMessage('${bpId}', this.textContent)">${escHtml(c)}</button>`
  ).join('');

  return `
    <div class="asst-panel" id="asst-panel-${bpId}">
      <div class="asst-header">
        <span class="asst-avatar" aria-hidden="true">🤖</span>
        <div>
          <p class="asst-title">Asisten Blueprint</p>
          <p class="asst-subtitle">Tanya apa saja tentang blueprint ini</p>
        </div>
      </div>

      <!-- Chat log -->
      <div class="asst-log" id="asst-log-${bpId}" aria-live="polite" aria-label="Percakapan asisten">
        <div class="asst-bubble asst-bot">
          Halo! Saya siap membantu menganalisis blueprint <strong>${escHtml(getBpName(bpId))}</strong>.
          Ketik pertanyaan di bawah atau pilih salah satu topik cepat. 👇
        </div>
      </div>

      <!-- Quick chips -->
      <div class="asst-chips" id="asst-chips-${bpId}">${chipHtml}</div>

      <!-- Input row -->
      <div class="asst-input-row">
        <input
          id="asst-input-${bpId}"
          type="text"
          class="asst-input"
          placeholder="Ketik pertanyaan…"
          maxlength="200"
          aria-label="Pertanyaan untuk asisten blueprint"
          onkeydown="if(event.key==='Enter'){sendAssistantMessage('${bpId}')}"
        />
        <button
          class="asst-send"
          onclick="sendAssistantMessage('${bpId}')"
          aria-label="Kirim pertanyaan"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/** Helper: get blueprint name without re-finding the whole object */
function getBpName(bpId) {
  const bp = state.blueprints.find(b => b.id === bpId);
  return bp ? bp.name : '';
}

/**
 * Handle send: read input (or an externally provided text),
 * append user bubble, compute reply, append bot bubble.
 * @param {string} bpId
 * @param {string} [forcedText] - used by chip buttons
 */
function sendAssistantMessage(bpId, forcedText) {
  const input = document.getElementById(`asst-input-${bpId}`);
  const text = (forcedText || (input ? input.value : '')).trim();
  if (!text) return;

  appendBubble(bpId, text, 'user');
  if (input) input.value = '';

  // Slight delay so the user bubble renders before the reply
  setTimeout(() => {
    const reply = assistantAnswer(bpId, text);
    appendBubble(bpId, reply, 'bot');
  }, 180);
}

/** Append a chat bubble to the log and auto-scroll */
function appendBubble(bpId, text, role) {
  const log = document.getElementById(`asst-log-${bpId}`);
  if (!log) return;
  const div = document.createElement('div');
  div.className = `asst-bubble asst-${role}`;
  // bot replies may contain safe HTML (bold / line-breaks)
  if (role === 'bot') {
    div.innerHTML = text;
  } else {
    div.textContent = text;
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/**
 * Rule-based answer engine.
 * Reads live blueprint data + calculateScore output and returns an HTML string.
 *
 * Intent matching order (first match wins):
 *   1. rendah / rendah / low / kenapa
 *   2. perbaiki / saran / improve / rekomendasi
 *   3. siap / ready / status
 *   4. task / dekomposisi
 *   5. ethics / etika / checklist
 *   6. human approval / hitl / checkpoint
 *   7. validasi / validation
 *   8. failure / gagal / strategi
 *   9. tips / cara / bagaimana
 *  10. fallback
 */
function assistantAnswer(bpId, text) {
  const bp = state.blueprints.find(b => b.id === bpId);
  if (!bp) return 'Blueprint tidak ditemukan.';

  const { score, category, breakdown, suggestions } = calculateScore(bp);
  const q = text.toLowerCase();

  /* ── Intent: kenapa skor rendah ── */
  if (/rendah|kenapa|mengapa|low|why|skor/.test(q)) {
    if (score >= 75) {
      return `Skor Anda sudah <strong>${score}/100 (${category})</strong> — tidak rendah! 🎉
              Titik terlemah adalah: <strong>${getWeakest(breakdown)}</strong>.
              Perbaiki itu untuk mendekati 100.`;
    }
    const weak = breakdown.filter(i => i.earned < i.max);
    const lines = weak.map(i =>
      `• <strong>${i.label}</strong>: ${i.earned}/${i.max} poin`
    ).join('<br>');
    return `Skor Anda <strong>${score}/100 (${category})</strong> karena ${weak.length} kriteria belum penuh:<br><br>
            ${lines}<br><br>
            Fokus terlebih dahulu pada kriteria berbobot paling besar yang masih kosong.`;
  }

  /* ── Intent: apa yang diperbaiki ── */
  if (/perbaiki|saran|improve|rekomendasi|harus|solusi/.test(q)) {
    if (suggestions.length === 0) {
      return `Semua kriteria sudah terpenuhi! Blueprint ini mendapat skor <strong>${score}/100</strong>.
              Tidak ada saran perbaikan saat ini. 🌟`;
    }
    const list = suggestions.map(s => `• ${s}`).join('<br>');
    return `Berikut <strong>${suggestions.length} saran perbaikan</strong> untuk blueprint ini:<br><br>
            ${list}`;
  }

  /* ── Intent: apakah sudah siap ── */
  if (/siap|ready|status|layak|bisa deploy/.test(q)) {
    const icon = score >= 75 ? '✅' : score >= 40 ? '⚠️' : '🔴';
    return `${icon} Status blueprint: <strong>${category}</strong> (${score}/100).<br><br>
            ${score >= 75
              ? 'Blueprint ini sudah siap untuk diimplementasikan berdasarkan kriteria kelengkapan.'
              : score >= 40
                ? 'Blueprint cukup siap namun masih ada celah. Selesaikan saran perbaikan sebelum deploy.'
                : 'Blueprint belum siap. Masih banyak kriteria penting yang kosong. Lengkapi dulu sebelum melanjutkan.'}`;
  }

  /* ── Intent: kondisi task ── */
  if (/task|dekomposisi|tugas/.test(q)) {
    const tc = bp.tasks.length;
    if (tc === 0) {
      return `Blueprint ini belum memiliki task sama sekali. Tambahkan minimal 3 task untuk mendapatkan poin dekomposisi penuh (+20).`;
    }
    const noVal = bp.tasks.filter(t => !t.validation).length;
    const noFail = bp.tasks.filter(t => !t.failureStrategy).length;
    const hasHuman = bp.tasks.some(t => t.humanApproval);
    return `Blueprint memiliki <strong>${tc} task</strong>.<br>
            • Validasi terisi: <strong>${tc - noVal}/${tc}</strong>${noVal > 0 ? ` — ${noVal} task belum punya kriteria validasi.` : ' ✅'}<br>
            • Failure mode: <strong>${tc - noFail}/${tc}</strong>${noFail > 0 ? ` — ${noFail} task belum punya strategi kegagalan.` : ' ✅'}<br>
            • Human approval: ${hasHuman ? '<strong>Ada</strong> ✅' : '<strong>Belum ada</strong> — tambahkan minimal 1 task berisiko tinggi.'}`;
  }

  /* ── Intent: ethics / etika ── */
  if (/ethics|etika|checklist|bias|privacy|explainability|safety/.test(q)) {
    const e = bp.ethics || {};
    const items = {
      bias_audit: 'Bias Audit',
      explainability: 'Explainability',
      privacy_impact: 'Privacy Impact',
      safety_canary: 'Safety Canary'
    };
    const lines = Object.entries(items).map(([k, label]) =>
      `• ${label}: ${e[k] ? '✅ Sudah' : '❌ Belum'}`
    ).join('<br>');
    const doneCount = Object.values(e).filter(Boolean).length;
    return `<strong>Ethics Checklist</strong> (${doneCount}/4 selesai):<br><br>
            ${lines}<br><br>
            Setiap item yang diselesaikan menambah ~3.75 poin ke skor.
            Pergi ke tab <strong>Ethics</strong> untuk mencentang item.`;
  }

  /* ── Intent: human approval / HITL ── */
  if (/human|approval|hitl|checkpoint|manusia/.test(q)) {
    const humanTasks = bp.tasks.filter(t => t.humanApproval);
    if (humanTasks.length === 0) {
      return `Blueprint ini belum memiliki human approval checkpoint.<br><br>
              <strong>Human-in-the-Loop</strong> artinya ada langkah di mana manusia harus menyetujui keputusan agent sebelum dilanjutkan — penting untuk task berisiko tinggi.<br><br>
              Tambahkan minimal 1 task dengan checkbox "Perlu Human Approval" untuk mendapat +5 poin.`;
    }
    const names = humanTasks.map(t => `<strong>${escHtml(t.name)}</strong>`).join(', ');
    return `${humanTasks.length} task sudah memiliki human approval checkpoint: ${names}.
            Prinsip Human-in-the-Loop terpenuhi ✅ (+5 poin).`;
  }

  /* ── Intent: validasi ── */
  if (/validasi|validation|kriteria|threshold/.test(q)) {
    const noVal = bp.tasks.filter(t => !t.validation || !t.validation.trim());
    if (noVal.length === 0) {
      return `Semua task sudah memiliki kriteria validasi ✅. Poin validasi: penuh.`;
    }
    const names = noVal.map(t => `<strong>${escHtml(t.name)}</strong>`).join(', ');
    return `${noVal.length} task belum memiliki kriteria validasi: ${names}.<br><br>
            Contoh validasi yang baik: <em>"Confidence ≥ 0.85; format JSON valid; latency &lt; 1s"</em>.
            Setiap validasi yang diisi menambah 2 poin (maks 20 poin total).`;
  }

  /* ── Intent: failure mode / strategi ── */
  if (/failure|gagal|strategi|retry|fallback|rollback|timeout/.test(q)) {
    const noFail = bp.tasks.filter(t => !t.failureStrategy);
    const strategies = {
      retry:    'Coba ulang beberapa kali sebelum menyerah.',
      fallback: 'Gunakan solusi alternatif jika aksi utama gagal.',
      timeout:  'Hentikan eksekusi jika melewati batas waktu.',
      rollback: 'Batalkan perubahan dan kembalikan ke kondisi sebelumnya.'
    };
    if (noFail.length > 0) {
      const names = noFail.map(t => `<strong>${escHtml(t.name)}</strong>`).join(', ');
      return `${noFail.length} task belum punya failure strategy: ${names}.<br><br>
              Pilihan strategi yang tersedia:<br>
              ${Object.entries(strategies).map(([k,v]) => `• <strong>${k}</strong>: ${v}`).join('<br>')}`;
    }
    return `Semua task sudah punya failure strategy ✅.<br><br>
            Strategi tersedia:<br>
            ${Object.entries(strategies).map(([k,v]) => `• <strong>${k}</strong>: ${v}`).join('<br>')}`;
  }

  /* ── Intent: tips umum / cara ── */
  if (/tips|cara|bagaimana|meningkatkan|naik/.test(q)) {
    const missing = breakdown.filter(i => i.earned < i.max)
      .sort((a, b) => (b.max - b.earned) - (a.max - a.earned));
    if (missing.length === 0) return `Skor sudah sempurna! Tidak ada yang perlu ditingkatkan. 🏆`;
    const top = missing.slice(0, 3);
    const list = top.map(i =>
      `• Tambah <strong>${i.max - i.earned} poin</strong> dari "<strong>${i.label}</strong>" (saat ini ${i.earned}/${i.max})`
    ).join('<br>');
    return `Tips tercepat untuk menaikkan skor:<br><br>${list}<br><br>
            Fokus pada item dengan gap terbesar terlebih dahulu.`;
  }

  /* ── Fallback ── */
  return `Saya tidak yakin memahami pertanyaan itu. Coba tanyakan:<br>
          • "Kenapa skor rendah?"<br>
          • "Apa yang harus diperbaiki?"<br>
          • "Apakah blueprint sudah siap?"<br>
          • "Bagaimana kondisi task saya?"<br>
          • "Tips ethics checklist?"`;
}

/** Return the label of the single weakest (largest gap) breakdown item */
function getWeakest(breakdown) {
  return breakdown.reduce((worst, item) => {
    const gap = item.max - item.earned;
    return gap > (item._gap || 0) ? { ...item, _gap: gap } : worst;
  }, { label: '—', _gap: -1 }).label;
}

/* =====================================================
   13. UTILITY FUNCTIONS
   ===================================================== */

/** Escape HTML special chars to prevent XSS */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Generate a unique ID with prefix */
function genId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Slugify a string for file names */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blueprint';
}

/** Trigger a file download */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---- Modal helpers ---- */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Trap focus: focus first input
  setTimeout(() => {
    const first = document.getElementById(id).querySelector('input, select, textarea, button');
    if (first) first.focus();
  }, 50);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modals on backdrop click
document.addEventListener('click', e => {
  ['modal-blueprint', 'modal-task', 'modal-detail'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal && e.target === modal) closeModal(id);
  });
});

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['modal-detail', 'modal-task', 'modal-blueprint'].forEach(id => {
      if (!document.getElementById(id).classList.contains('hidden')) {
        closeModal(id);
      }
    });
  }
});

/* ---- Toast notification ---- */
let toastTimer = null;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

/* =====================================================
   13. INIT
   ===================================================== */

/** Bootstrap the application */
function init() {
  loadState();
  renderBlueprints();
  showSection('builder');
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
