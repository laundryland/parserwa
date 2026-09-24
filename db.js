let db = null;

const request = indexedDB.open('PWARekapBoronganDB', 2);

request.onupgradeneeded = (e) => {
  db = e.target.result;

  if (!db.objectStoreNames.contains('karyawan')) {
    const storeK = db.createObjectStore('karyawan', { keyPath: 'id', autoIncrement: true });
    storeK.createIndex('nama', 'nama', { unique: true });
  }

  if (!db.objectStoreNames.contains('items')) {
    const storeI = db.createObjectStore('items', { keyPath: 'alias' });
    storeI.createIndex('name', 'name', { unique: false });
  }

  if (!db.objectStoreNames.contains('comm_rules')) {
    db.createObjectStore('comm_rules', { keyPath: 'key' });
  }

  if (!db.objectStoreNames.contains('pcs_master')) {
    db.createObjectStore('pcs_master', { keyPath: 'alias' });
  }

  if (!db.objectStoreNames.contains('orders')) {
    const storeO = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
    storeO.createIndex('tanggal', 'tanggal', { unique: false });
    storeO.createIndex('karyawan', 'karyawan', { unique: false });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  seedInitialData();
};

request.onerror = (e) => {
  console.error("IndexedDB Error:", e.target.error);
};

function seedInitialData() {
  // Bersihkan seluruh pengerjaan lama satu kali saat versi revisi ini pertama dijalankan.
  if (localStorage.getItem('orders_legacy_cleared_v4') !== '1') {
    const txOld = db.transaction('orders', 'readwrite');
    txOld.objectStore('orders').clear();
    txOld.oncomplete = () => localStorage.setItem('orders_legacy_cleared_v4', '1');
  }
  // Master karyawan default: Rahma Romlah (1), Susi Handayani (2).
  // Budi dan Siti dihapus dari master tanpa menghapus riwayat pengerjaan.
  const txK = db.transaction('karyawan', 'readwrite');
  const storeK = txK.objectStore('karyawan');
  storeK.getAll().onsuccess = (e) => {
    const list = e.target.result || [];
    list.filter(k => ['budi','siti'].includes(String(k.nama || '').trim().toLowerCase()))
      .forEach(k => storeK.delete(k.id));

    const names = list.map(k => String(k.nama || '').trim().toLowerCase());
    if (!names.includes('rahma romlah')) storeK.add({ nama: 'Rahma Romlah' });
    if (!names.includes('susi handayani')) storeK.add({ nama: 'Susi Handayani' });
  };
  txK.oncomplete = () => { if (typeof renderAll === 'function') renderAll(); };

  // Normalisasi skema komisi lama ke format Tier 1/2/3 baru - default 0 untuk semua rate.
  const txR = db.transaction('comm_rules', 'readwrite');
  txR.objectStore('comm_rules').getAll().onsuccess = (e) => {
    (e.target.result || []).forEach(r => {
      const migrated = {
        ...r,
        tier1Limit: Number.isFinite(Number(r.tier1Limit)) ? Number(r.tier1Limit) : 50,
        tier1Rate: Number.isFinite(Number(r.tier1Rate)) ? Number(r.tier1Rate) : 0,
        tier2Limit: Number.isFinite(Number(r.tier2Limit)) ? Number(r.tier2Limit) : 70,
        tier2Rate: Number.isFinite(Number(r.tier2Rate)) ? Number(r.tier2Rate) : 0,
        tier3Rate: Number.isFinite(Number(r.tier3Rate)) ? Number(r.tier3Rate) : 0,
        pcsRate: Number.isFinite(Number(r.pcsRate)) ? Number(r.pcsRate) : 0,
        key: `${String(r.karyawan || '').trim().toLowerCase()}_${String(r.itemAlias || '').trim().toLowerCase()}`
      };
      delete migrated.minQuota;
      if (r.key && r.key !== migrated.key) txR.objectStore('comm_rules').delete(r.key);
      txR.objectStore('comm_rules').put(migrated);
    });
  };

  const txI = db.transaction('items', 'readwrite');
  const storeI = txI.objectStore('items');
  storeI.getAll().onsuccess = (e) => {
    const items = e.target.result || [];
    if (items.length === 0) {
      storeI.add({ alias: 'stk', name: 'Setrika', unit: 'kg' });
      storeI.add({ alias: 'ckl', name: 'Cuci Kering Lipat', unit: 'kg' });
    } else {
      items.forEach(item => {
        const clean = { ...item, unit: normalizeUnit(item.unit) };
        delete clean.price;
        storeI.put(clean);
      });
    }
  };
}

function normalizeUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (['pcs','pc'].includes(u)) return 'pcs';
  if (['kg'].includes(u)) return 'kg';
  return u;
}

function calculateCommissionForRule(rule, unit, currentQty, newQty) {
  if (normalizeUnit(unit) === 'pcs') {
    const pcsRate = Math.max(0, Number(rule?.pcsRate ?? 0));
    return Number(newQty || 0) * pcsRate;
  }
  return calculateTieredCommission(
    Number(rule?.tier1Limit ?? 50),
    Number(rule?.tier2Limit ?? 70),
    Number(rule?.tier1Rate ?? 0),
    Number(rule?.tier2Rate ?? 0),
    Number(rule?.tier3Rate ?? 0),
    Number(currentQty || 0),
    Number(newQty || 0)
  );
}

// Helper DB
function getItemsMap() {
  return new Promise((resolve) => {
    const tx = db.transaction('items', 'readonly');
    const map = {};
    tx.objectStore('items').getAll().onsuccess = (e) => {
      e.target.result.forEach(item => {
        const aliases = String(item.aliases || item.alias || '')
          .split(',')
          .map(x => x.trim().toLowerCase()).filter(Boolean);
        aliases.forEach(a => { map[a] = item; });
        const name = String(item.name || '').trim().toLowerCase();
        if (name) map[name] = item;
      });
      resolve(map);
    };
  });
}

function getPcsMasterMap() {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains('pcs_master')) { resolve({}); return; }
      const tx = db.transaction('pcs_master', 'readonly');
      const map = {};
      tx.objectStore('pcs_master').getAll().onsuccess = (e) => {
        (e.target.result || []).forEach(r => {
          const alias = String(r.alias || '').trim().toLowerCase();
          if (alias) map[alias] = r;
          const name = String(r.name || '').trim().toLowerCase();
          if (name) map[name] = r;
        });
        resolve(map);
      };
      tx.objectStore('pcs_master').getAll().onerror = () => resolve({});
    } catch(e){ resolve({}); }
  });
}

function getCommRulesMap() {
  return new Promise((resolve) => {
    const tx = db.transaction('comm_rules', 'readonly');
    const map = {};
    tx.objectStore('comm_rules').getAll().onsuccess = (e) => {
      e.target.result.forEach(r => {
        const k = `${String(r.karyawan || '').trim().toLowerCase()}_${String(r.itemAlias || '').trim().toLowerCase()}`;
        map[k] = r;
        if (r.key) map[r.key] = r;
      });
      resolve(map);
    };
  });
}



// Identitas Master: semua alias WA yang menunjuk item yang sama
// harus memakai satu key canonical saat rule/order disimpan.
function canonicalItemAlias(item) {
  if (!item) return '';
  return String(item.alias || item.aliases || '').split(',')[0].trim().toLowerCase();
}

function getRuleForItem(rulesMap, employee, item) {
  const emp = String(employee || '').trim().toLowerCase();
  const canonical = canonicalItemAlias(item);
  const storedAlias = String(item?.alias || '').trim().toLowerCase();
  return rulesMap[`${emp}_${canonical}`]
      || rulesMap[`${emp}_${storedAlias}`]
      || { tier1Limit:50, tier1Rate:0, tier2Limit:70, tier2Rate:0, tier3Rate:0, pcsRate:0 };
}

function getTodayOrders(todayStr) {
  return new Promise((resolve) => {
    const tx = db.transaction('orders', 'readonly');
    tx.objectStore('orders').getAll().onsuccess = (e) => {
      const orders = e.target.result.filter(o => o.tanggal === todayStr);
      resolve(orders);
    };
  });
}

function calculateTieredCommission(tier1Limit, tier2Limit, tier1Rate, tier2Rate, tier3Rate, currentQty, newQty) {
  const start = Math.max(0, Number(currentQty || 0));
  const end = Math.max(start, start + Number(newQty || 0));
  if (end <= start) return 0;

  const l1 = Math.max(0, Number(tier1Limit ?? 50));
  const l2 = Math.max(l1, Number(tier2Limit ?? 70));
  const r1 = Math.max(0, Number(tier1Rate ?? 0));
  const r2 = Math.max(0, Number(tier2Rate ?? 0));
  const r3 = Math.max(0, Number(tier3Rate ?? 0));

  const q1 = Math.max(0, Math.min(end, l1) - Math.min(start, l1));
  const q2 = Math.max(0, Math.min(end, l2) - Math.max(start, l1));
  const q3 = Math.max(0, end - Math.max(start, l2));
  return (q1 * r1) + (q2 * r2) + (q3 * r3);
}