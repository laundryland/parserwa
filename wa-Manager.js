
if (typeof window.uiToast !== 'function') {
  window.uiToast = function(message){
    const el=document.createElement('div');
    el.textContent=message;
    el.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100000;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;max-width:90%;font-size:13px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2800);
  };
}
if (typeof window.uiConfirm !== 'function') {
  window.uiConfirm = function(message){
    return Promise.resolve(true);
  };
}

let unmatchedQueue = [];
let currentFixerItem = null;

// ==========================================
// 1. ENGINE AI LOKAL (PARSER 2 KATA & 3 KATA)
// ==========================================
const LocalAI = {
  DEFAULT_ALIAS_2_WORDS: 'stk',

  normalizeSpaces(text) {
    return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  },

  // Abaikan header pesan WA: [tanggal/jam] NAMA_PENGIRIM
  // Contoh: [19/09/2020] rahma budi 7 -> budi 7
  stripWAHeader(line) {
    let s = this.normalizeSpaces(line);
    const m = s.match(/^\s*\[[^\]]+\]\s+\S+\s*:?\s*(.*)$/);
    return m ? this.normalizeSpaces(m[1]) : s;
  },

  getLearnedRules() {
    try { return JSON.parse(localStorage.getItem('wa_parser_logic_rules') || '{}'); }
    catch (_) { return {}; }
  },

  saveLearnedRule(raw, logic) {
    const rules = this.getLearnedRules();
    rules[this.normalizeSpaces(raw).toLowerCase()] = this.normalizeSpaces(logic);
    localStorage.setItem('wa_parser_logic_rules', JSON.stringify(rules));
  },

  cleanInput(rawText) {
    return String(rawText || '')
      .split(/\r?\n/)
      .map(line => this.stripWAHeader(line))
      .filter(Boolean);
  },

  analyzeBlock(rawText, itemsMap) {
    const learned = this.getLearnedRules();
    let currentCustomer = '';
    const jobs = [];
    const errors = [];
    const lines = this.cleanInput(rawText);

    for (const originalLine of lines) {
      const learnedLogic = learned[this.normalizeSpaces(originalLine).toLowerCase()];
      const line = learnedLogic || originalLine;
      const tokens = line.replace(/,/g, ' , ').split(/\s+/).filter(Boolean);
      let i = 0;
      let lineCustomer = currentCustomer;
      let firstJobOnLine = true;

      while (i < tokens.length) {
        if (tokens[i] === ',') { i++; continue; }
        const token = tokens[i].toLowerCase();
        const next = tokens[i + 1];
        const next2 = tokens[i + 2];

        // Alias pekerjaan di awal/di tengah berarti masih customer yang sama.
        if (itemsMap[token]) {
          const qty = parseFloat(next);
          if (isNaN(qty)) {
            errors.push({ line: originalLine, customer: lineCustomer || 'Umum', itemAlias: token, amount: 1,
              aiReason: `Jumlah untuk ${token} belum valid.` });
            break;
          }
          if (!lineCustomer) {
            errors.push({ line: originalLine, customer: 'Umum', itemAlias: token, amount: qty,
              aiReason: `Pekerjaan ${token} muncul tanpa nama customer sebelumnya.` });
            break;
          }
          jobs.push({ customer: lineCustomer, alias: token, qty });
          i += 2;
          firstJobOnLine = false;
          continue;
        }

        // Nama customer + alias + qty, misalnya: budi ckl 3
        if (next && itemsMap[next.toLowerCase()]) {
          const qty = parseFloat(next2);
          if (isNaN(qty)) {
            errors.push({ line: originalLine, customer: token, itemAlias: next.toLowerCase(), amount: 1,
              aiReason: `Jumlah "${next2 || ''}" bukan angka.` });
            break;
          }
          lineCustomer = tokens[i];
          currentCustomer = lineCustomer;
          jobs.push({ customer: lineCustomer, alias: next.toLowerCase(), qty });
          i += 3;
          firstJobOnLine = false;
          continue;
        }

        // Nama customer + angka = Setrika default.
        if (next && /^[-+]?\d+(?:[.,]\d+)?$/.test(next.replace(',', '.'))) {
          const qty = parseFloat(next.replace(',', '.'));
          // Di awal baris, token non-alias + angka dianggap customer baru.
          // Di tengah baris, ini juga menjadi customer baru hanya jika memang belum ada pekerjaan.
          lineCustomer = tokens[i];
          currentCustomer = lineCustomer;
          jobs.push({ customer: lineCustomer, alias: this.DEFAULT_ALIAS_2_WORDS, qty });
          i += 2;
          firstJobOnLine = false;
          continue;
        }

        // Token biasa tanpa struktur pekerjaan: anggap sebagai bagian nama customer
        // hanya jika belum ada customer. Jika customer sudah ada, tandai agar tidak diam-diam salah.
        if (!lineCustomer && firstJobOnLine) {
          lineCustomer = tokens[i];
          currentCustomer = lineCustomer;
          i++;
          continue;
        }

        errors.push({ line: originalLine, customer: lineCustomer || 'Umum', itemAlias: token, amount: 1,
          aiReason: `Format tidak dikenali pada "${token}".` });
        break;
      }
    }

    return { jobs, errors };
  },

  analyzeLine(line, itemsMap) {
    const result = this.analyzeBlock(line, itemsMap);
    if (result.jobs.length === 1 && result.errors.length === 0) {
      return { status: 'OK', data: result.jobs[0] };
    }
    return {
      status: 'ERROR',
      reason: 'PARSE_ERROR',
      suggestion: result.errors[0]?.aiReason || 'Format pekerjaan belum dikenali.'
    };
  }
};

function saveNewParserLogic() {
  const rawEl = document.getElementById('logicWrongInput');
  const logicEl = document.getElementById('logicNewRule');
  const raw = rawEl ? rawEl.value.trim() : '';
  const logic = logicEl ? logicEl.value.trim() : '';
  if (!raw || !logic) {
    uiToast('Isi contoh WA yang salah dan logika yang benar terlebih dahulu.');
    return;
  }
  LocalAI.saveLearnedRule(raw, logic);
  rawEl.value = '';
  logicEl.value = '';
  uiToast('Logika baru tersimpan dan akan dipakai parser berikutnya.');
}


// ==========================================
// 2. PEMROSESAN PENGERJAAN
// ==========================================
async function processInputWA() {
  if (!db) {
    uiToast("Database belum siap!");
    return;
  }

  const inputEl = document.getElementById('inputText');
  const selectEl = document.getElementById('input-karyawan-select');
  const rawInput = inputEl ? inputEl.value : '';
  const selectedEmp = selectEl ? selectEl.value : '';

  if (!selectedEmp) {
    uiToast("Pilih Karyawan terlebih dahulu!");
    return;
  }

  if (!rawInput.trim()) {
    uiToast("Masukkan teks pengerjaan!");
    return;
  }

  const itemsMap = await getItemsMap();
  const rulesMap = await getCommRulesMap();
  const pcsMasterMap = await getPcsMasterMap();
  const todayStr = new Date().toLocaleDateString('id-ID');

  const parsed = LocalAI.analyzeBlock(rawInput, itemsMap);
  unmatchedQueue = [];
  const validOrders = [];

  for (const job of parsed.jobs) {
    const { customer, alias, qty } = job;
    const item = itemsMap[alias];
    if (!item) continue;
    const canonicalAlias = canonicalItemAlias(item);
    const rule = getRuleForItem(rulesMap, selectedEmp, item);
    const existingOrders = await getTodayOrders(todayStr);
    const currentEmpQty = existingOrders
      .filter(o => o.karyawan === selectedEmp && String(o.itemAlias || '').toLowerCase() === canonicalAlias)
      .reduce((sum, o) => sum + Number(o.qty || 0), 0)
      + validOrders
        .filter(o => o.karyawan === selectedEmp && String(o.itemAlias || '').toLowerCase() === canonicalAlias)
        .reduce((sum, o) => sum + Number(o.qty || 0), 0);
    // PCS Master Independen - lepas dari Tier
    let komisi = 0;
    const isPcs = normalizeUnit(item.unit) === 'pcs';
    if (isPcs) {
      const pcsMaster = pcsMasterMap[canonicalAlias] || pcsMasterMap[String(item.alias||'').toLowerCase()] || pcsMasterMap[alias];
      if (pcsMaster && pcsMaster.active !== false) {
        komisi = Number(qty||0) * Math.max(0, Number(pcsMaster.rate||0));
      } else {
        // fallback ke rule lama jika master PCS tidak ada / tidak aktif -> tetap independen
        komisi = Number(qty||0) * Math.max(0, Number(rule?.pcsRate ?? 0));
      }
    } else {
      komisi = calculateCommissionForRule(rule, item.unit, currentEmpQty, qty);
    }
    validOrders.push({
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      tanggal: todayStr, karyawan: selectedEmp, customer, itemAlias: canonicalAlias,
      jenis: item.name, qty, unit: normalizeUnit(item.unit), totalKomisi: komisi
    });
  }

  parsed.errors.forEach(err => unmatchedQueue.push({
    line: err.line, customer: err.customer || 'Umum', empName: selectedEmp,
    itemAlias: err.itemAlias || 'stk', amount: err.amount || 1, aiReason: err.aiReason
  }));

  if (validOrders.length > 0) {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    validOrders.forEach(order => store.add(order));

    tx.oncomplete = () => {
      if (inputEl) inputEl.value = '';
      renderAll();

      if (unmatchedQueue.length > 0) {
        triggerNextFixer();
      } else {
        uiToast(`Data (${validOrders.length} item) berhasil disimpan!`);
      }
    };
  } else if (unmatchedQueue.length > 0) {
    triggerNextFixer();
  }
}

// ==========================================
// 3. FIXER MODAL
// ==========================================
function triggerNextFixer() {
  if (unmatchedQueue.length === 0) {
    const modal = document.getElementById('fixerModal');
    if (modal) modal.style.display = 'none';
    uiToast('Semua data berhasil disesuaikan!');
    renderAll();
    return;
  }

  currentFixerItem = unmatchedQueue.shift();

  const labelEmp = document.getElementById('fixerEmpLabel');
  const rawTextEl = document.getElementById('fixerRawText');
  const qtyEl = document.getElementById('fixerQty');

  if (labelEmp) labelEmp.innerText = `${currentFixerItem.empName.toUpperCase()} (Cust: ${currentFixerItem.customer})`;
  if (rawTextEl) rawTextEl.innerText = `${currentFixerItem.line}\n⚠️ AI Info: ${currentFixerItem.aiReason}`;
  if (qtyEl) qtyEl.value = currentFixerItem.amount;

  const txI = db.transaction('items', 'readonly');
  txI.objectStore('items').getAll().onsuccess = (e) => {
    const selI = document.getElementById('fixerItem');
    if (selI) {
      selI.innerHTML = e.target.result.map(i => `<option value="${i.alias}">${i.name} (${i.unit})</option>`).join('');
    }
  };

  const modal = document.getElementById('fixerModal');
  if (modal) modal.style.display = 'flex';
}

async function saveFixerItem() {
  const itemAlias = document.getElementById('fixerItem').value;
  const qty = parseFloat(document.getElementById('fixerQty').value);
  const todayStr = new Date().toLocaleDateString('id-ID');

  const itemsMap = await getItemsMap();
  const rulesMap = await getCommRulesMap();
  const pcsMasterMap = await getPcsMasterMap();
  const existingOrders = await getTodayOrders(todayStr);

  const item = itemsMap[itemAlias];
  if (!item) { uiToast('Jenis pekerjaan tidak ditemukan.'); return; }
  const canonicalAlias = canonicalItemAlias(item);
  const rule = getRuleForItem(rulesMap, currentFixerItem.empName, item);

  const currentEmpQty = existingOrders
    .filter(o => o.karyawan === currentFixerItem.empName && String(o.itemAlias || '').toLowerCase() === canonicalAlias)
    .reduce((sum, o) => sum + o.qty, 0);

  let komisi = 0;
  const isPcs = normalizeUnit(item.unit) === 'pcs';
  if (isPcs) {
    const pcsMaster = pcsMasterMap[canonicalAlias] || pcsMasterMap[String(item.alias||'').toLowerCase()] || pcsMasterMap[itemAlias];
    if (pcsMaster && pcsMaster.active !== false) {
      komisi = Number(qty||0) * Math.max(0, Number(pcsMaster.rate||0));
    } else {
      komisi = Number(qty||0) * Math.max(0, Number(rule?.pcsRate ?? 0));
    }
  } else {
    komisi = calculateCommissionForRule(rule, item.unit, currentEmpQty, qty);
  }

  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').add({
    waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    tanggal: todayStr,
    karyawan: currentFixerItem.empName,
    customer: currentFixerItem.customer,
    itemAlias: canonicalAlias,
    jenis: item.name,
    qty: qty,
    unit: normalizeUnit(item.unit),
    totalKomisi: komisi
  });

  tx.oncomplete = () => triggerNextFixer();
}

function skipFixerItem() {
  triggerNextFixer();
}

// ==========================================
// 4. BUKTI HARIAN & BACKUP DROPDOWN
// ==========================================
function generateEmployeeDailyReport() {
  const empSelect = document.getElementById('rekap-karyawan-select');
  if (!empSelect || !db) return;

  const empName = empSelect.value;
  if (!empName) return;

  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const empOrders = e.target.result.filter(o => o.karyawan === empName && o.tanggal === todayStr);

    if (empOrders.length === 0) {
      document.getElementById('employeeReportText').value = `Belum ada pengerjaan harian (${todayStr}) untuk ${empName.toUpperCase()}.`;
      return;
    }

    let report = `*BUKTI PENGERJAAN HARIAN*\n`;
    report += `Petugas: ${empName.toUpperCase()}\n`;
    report += `Tgl: ${todayStr}\n`;
    report += `----------------------------\n`;

    let totalKomisiHarian = 0;
    let totalQtyMap = {};

    empOrders.forEach((o, i) => {
      totalKomisiHarian += (o.totalKomisi || 0);
      if (!totalQtyMap[o.jenis]) totalQtyMap[o.jenis] = { qty: 0, unit: o.unit };
      totalQtyMap[o.jenis].qty += o.qty;

      const custLabel = o.customer ? `[${o.customer}] ` : '';
      report += `${i + 1}. ${custLabel}${o.jenis}: ${o.qty} ${o.unit}`;
      if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
        report += ` | Komisi: Rp ${(o.totalKomisi || 0).toLocaleString()}`;
      }
      report += `\n`;
    });

    report += `----------------------------\n`;
    report += `*TOTAL VOLUME PENGERJAAN:*\n`;
    for (let j in totalQtyMap) {
      report += `- ${j}: ${totalQtyMap[j].qty} ${totalQtyMap[j].unit}\n`;
    }

    if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
      report += `----------------------------\n`;
      report += `*TOTAL KOMISI: Rp ${totalKomisiHarian.toLocaleString()}*`;
    }

    document.getElementById('employeeReportText').value = report;
  };
}

function sendReportWA(type, mode) {
  const text = document.getElementById('employeeReportText').value;

  if (mode === 'text') {
    if (!text.trim()) {
      uiToast("Pilih karyawan/isi teks terlebih dahulu!");
      return;
    }
    const url = type === 'business'
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  } else if (mode === 'image') {
    generateReportPNG();
    setTimeout(() => {
      uiToast("Gambar Nota PNG berhasil di-download! Silakan lampirkan gambar tersebut di chat WhatsApp.");
      const url = type === 'business' ? `https://api.whatsapp.com/send` : `https://wa.me/`;
      window.open(url, '_blank');
    }, 600);
  }
}

// BACKUP EXPORT & IMPORT
function executeExportBackup() {
  const type = document.getElementById('backupTypeSelect').value;
  if (type === 'svg') exportBackupSVG();
  else exportBackupJSON();
}

function exportBackupJSON() {
  const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readonly');
  const backupData = {};

  tx.objectStore('orders').getAll().onsuccess = (e) => backupData.orders = e.target.result;
  tx.objectStore('karyawan').getAll().onsuccess = (e) => backupData.karyawan = e.target.result;
  tx.objectStore('items').getAll().onsuccess = (e) => backupData.items = e.target.result;
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => backupData.comm_rules = e.target.result;

  tx.oncomplete = () => {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_PWA_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
}

function exportBackupSVG() {
  const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readonly');
  const backupData = {};

  tx.objectStore('orders').getAll().onsuccess = (e) => backupData.orders = e.target.result;
  tx.objectStore('karyawan').getAll().onsuccess = (e) => backupData.karyawan = e.target.result;
  tx.objectStore('items').getAll().onsuccess = (e) => backupData.items = e.target.result;
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => backupData.comm_rules = e.target.result;

  tx.oncomplete = () => {
    const jsonString = JSON.stringify(backupData);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
      <rect width="100%" height="100%" fill="#2563eb"/>
      <text x="20" y="50" fill="white" font-family="sans-serif" font-size="16">PWA DATA BACKUP CONTAINER</text>
      <script type="text/plain" id="pwa-db-data">${jsonString}</script>
    </svg>`;

    const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Backup_PWA_${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
  };
}

function importBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      let importedData = null;
      const content = e.target.result;

      if (file.name.endsWith('.svg') || content.includes('<svg')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "image/svg+xml");
        const scriptEl = doc.getElementById('pwa-db-data');
        if (scriptEl) importedData = JSON.parse(scriptEl.textContent);
        else throw new Error("File SVG tidak valid!");
      } else {
        importedData = JSON.parse(content);
      }

      if (importedData && await uiConfirm("Restore data sekarang? Data lama akan ditimpa.", "Restore Backup")) {
        const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readwrite');

        if (importedData.orders) { const os = tx.objectStore('orders'); os.clear(); importedData.orders.forEach(i => os.add(i)); }
        if (importedData.karyawan) { const os = tx.objectStore('karyawan'); os.clear(); importedData.karyawan.forEach(i => os.add(i)); }
        if (importedData.items) { const os = tx.objectStore('items'); os.clear(); importedData.items.forEach(i => os.add(i)); }
        if (importedData.comm_rules) { const os = tx.objectStore('comm_rules'); os.clear(); importedData.comm_rules.forEach(i => os.add(i)); }

        tx.oncomplete = () => {
          uiToast("Data berhasil dipulihkan!");
          renderAll();
        };
      }
    } catch (err) {
      uiToast("File backup tidak valid!");
    }
  };
  reader.readAsText(file);
}