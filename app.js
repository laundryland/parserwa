/* === PARSER RULE: ALIAS / NAMA PEKERJAAN BUKAN CUSTOMER === */
function isWorkAliasOrName(token) {
    const t = String(token || '').trim().toLowerCase();
    if (!t) return false;
    try {
        const items = (typeof getItems === 'function') ? getItems() : [];
        for (const item of (items || [])) {
            const name = String(item?.name || item?.nama || '').trim().toLowerCase();
            const aliases = String(item?.aliases || item?.alias || '')
                .split(',')
                .map(x => x.trim().toLowerCase())
                .filter(Boolean);
            if (t === name || aliases.includes(t)) return true;
        }
    } catch (_) {}
    return [
        'stk','setrika','cks','ckl','cb','sepatu','selimut',
        'bc','bedcover','bed cover','gorden','boneka','bnk',
        'seprai','sprai','spt','spatu'
    ].includes(t);
}


/* =========================================================
   MODERN UI DIALOGS — NO window.alert / confirm / prompt
   ========================================================= */
(function(){
  function ensureDialogHost(){
    let host=document.getElementById('modern-dialog-host');
    if(host) return host;
    host=document.createElement('div');
    host.id='modern-dialog-host';
    host.innerHTML=`
      <div id="modern-dialog-backdrop" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px">
        <div id="modern-dialog-box" style="width:min(100%,400px);background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.4);padding:20px">
          <div id="modern-dialog-title" style="font-weight:800;font-size:17px;margin-bottom:8px"></div>
          <div id="modern-dialog-message" style="font-size:14px;line-height:1.5;color:#cbd5e1;white-space:pre-wrap"></div>
          <div id="modern-dialog-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"></div>
        </div>
      </div>
      <div id="modern-toast" style="display:none;position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100000;width:min(calc(100% - 28px),420px);background:#111827;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px 15px;box-shadow:0 15px 40px rgba(0,0,0,.35);font-size:13px"></div>`;
    document.body.appendChild(host);
    return host;
  }
  window.uiToast=function(message){
    ensureDialogHost();
    const el=document.getElementById('modern-toast');
    el.textContent=message;
    el.style.display='block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>el.style.display='none',2800);
  };
  window.uiConfirm=function(message,title='Konfirmasi'){
    ensureDialogHost();
    return new Promise(resolve=>{
      const back=document.getElementById('modern-dialog-backdrop');
      document.getElementById('modern-dialog-title').textContent=title;
      document.getElementById('modern-dialog-message').textContent=message;
      const actions=document.getElementById('modern-dialog-actions');
      actions.innerHTML='';
      const cancel=document.createElement('button');
      cancel.textContent='Batal';
      const ok=document.createElement('button');
      ok.textContent='Lanjutkan';
      [cancel,ok].forEach(b=>{b.type='button';b.style.cssText='border:0;border-radius:11px;padding:10px 16px;font-weight:700;cursor:pointer'});
      cancel.style.background='#334155'; cancel.style.color='#fff';
      ok.style.background='#2563eb'; ok.style.color='#fff';
      const close=v=>{back.style.display='none';resolve(v)};
      cancel.onclick=()=>close(false); ok.onclick=()=>close(true);
      actions.append(cancel,ok);
      back.style.display='flex';
    });
  };
})();

let isCommissionActive = true;

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadSavedLogo();
  loadDarkMode();
});

function initClock() {
  setInterval(() => {
    const now = new Date();
    const dateEl = document.getElementById('real-date');
    const timeEl = document.getElementById('real-time');
    if (dateEl) dateEl.innerText = now.toLocaleDateString('id-ID');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString('id-ID');
  }, 1000);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  const btnIndex = tabId === 'input' ? 0 : tabId === 'rekap' ? 1 : 2;
  const navBtns = document.querySelectorAll('nav button');
  if (navBtns[btnIndex]) navBtns[btnIndex].classList.add('active');
}

function toggleCommissionMode() {
  const toggle = document.getElementById('commissionToggle');
  const label = document.getElementById('commission-status-label');
  isCommissionActive = toggle ? toggle.checked : true;

  if (label) {
    label.innerText = isCommissionActive ? "AKTIF" : "NONAKTIF";
    label.style.color = isCommissionActive ? "var(--success)" : "var(--danger)";
  }

  document.querySelectorAll('.com-col').forEach(el => {
    el.style.display = isCommissionActive ? '' : 'none';
  });

  // Jangan panggil renderAll() dari sini.
  // renderAll() -> renderItemsTable()/renderOrdersTable() -> toggleCommissionMode()
  // sebelumnya menyebabkan recursive render tanpa akhir.
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Image = e.target.result;
    localStorage.setItem('app_custom_logo', base64Image);
    applyLogo(base64Image);
    uiToast('Logo berhasil dipasang untuk Header, Favicon, Nota PNG, dan Splash Screen!');
  };
  reader.readAsDataURL(file);
}


function toggleDarkMode() {
  const toggle = document.getElementById('darkModeToggle');
  const label = document.getElementById('dark-mode-label');
  const isDark = toggle ? toggle.checked : false;
  document.body.classList.toggle('dark-mode', isDark);
  if (label) {
    label.innerText = isDark ? 'Terang' : 'Gelap';
    label.previousSibling ? null : null;
  }
  localStorage.setItem('app_dark_mode', isDark ? '1' : '0');
  // update switch container icon
  const span = toggle ? toggle.closest('.switch-container').querySelector('span') : null;
  if (span) span.innerHTML = (isDark ? '☀️' : '🌙') + ' <strong id="dark-mode-label">' + (isDark ? 'Terang' : 'Gelap') + '</strong>';
}

function loadDarkMode() {
  const saved = localStorage.getItem('app_dark_mode');
  const isDark = saved === '1';
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.checked = isDark;
  document.body.classList.toggle('dark-mode', isDark);
  const label = document.getElementById('dark-mode-label');
  if (label) label.innerText = isDark ? 'Terang' : 'Gelap';
  const span = toggle ? toggle.closest('.switch-container').querySelector('span') : null;
  if (span) span.innerHTML = (isDark ? '☀️' : '🌙') + ' <strong id="dark-mode-label">' + (isDark ? 'Terang' : 'Gelap') + '</strong>';
}

async function resetTodayOrders() {
  const todayStr = new Date().toLocaleDateString('id-ID');
  if (!(await uiConfirm(`Reset semua pengerjaan hari ini (${todayStr})? Data akan dihapus permanen.`, 'Reset Hari Ini'))) return;
  const tx = db.transaction('orders','readwrite');
  const store = tx.objectStore('orders');
  store.getAll().onsuccess = e => {
    const all = e.target.result || [];
    all.forEach(o => {
      if (o.tanggal === todayStr) store.delete(o.id);
    });
  };
  tx.oncomplete = () => {
    renderOrdersTable();
    generateEmployeeDailyReport();
    uiToast('Pengerjaan hari ini direset.');
  };
}

function loadSavedLogo() {
  const savedLogo = localStorage.getItem('app_custom_logo');
  applyLogo(savedLogo || 'laundryicon.png');
}

function applyLogo(logoData) {
  const src = logoData || 'laundryicon.png';
  const headerLogo = document.getElementById('appHeaderLogo');
  if (headerLogo) {
    headerLogo.src = src;
    headerLogo.style.display = 'block';
  }

  document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']").forEach(el => {
    el.href = src;
  });
}

// Render Seluruh Tampilan UI
function updateSettingsCards() {
  try {
    const kCount = document.querySelectorAll('#karyawanListTable tr').length;
    const kInfo = document.getElementById('cardKaryawanInfo');
    if (kInfo) kInfo.textContent = (kCount||2)+' orang';
    const iCount = document.querySelectorAll('#itemsTable tr').length;
    const iInfo = document.getElementById('cardItemsInfo');
    if (iInfo) iInfo.textContent = (iCount||0)+' jenis';
    const txP = db.transaction('pcs_master','readonly');
    txP.objectStore('pcs_master').getAll().onsuccess = e=>{
      const c = (e.target.result||[]).filter(r=>r.active!==false).length;
      const pInfo = document.getElementById('cardPcsInfo');
      if (pInfo) pInfo.textContent = c+' aktif';
    };
  } catch(e){}
}

function renderAll() {
  if (!db) return;
  renderKaryawanOptions();
  renderKaryawanList();
  renderItemsTable();
  renderCommissionRulesTable();
  renderPcsMasterTable();
  renderOrdersTable();
  generateEmployeeDailyReport();
  setTimeout(updateSettingsCards, 300);
}

function renderKaryawanOptions() {
  const tx = db.transaction('karyawan', 'readonly');
  tx.objectStore('karyawan').getAll().onsuccess = (e) => {
    const priority = {'rahma romlah': 0, 'susi handayani': 1};
    const list = (e.target.result || []).sort((a,b) => {
      const pa = priority[String(a.nama||'').toLowerCase()] ?? 99;
      const pb = priority[String(b.nama||'').toLowerCase()] ?? 99;
      return pa - pb || String(a.nama).localeCompare(String(b.nama));
    });
    const opts = list.map(k => `<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join('');
    const selInput = document.getElementById('input-karyawan-select');
    const selRekap = document.getElementById('rekap-karyawan-select');
    const selRule = document.getElementById('ruleKaryawanSelect');
    if (selInput) selInput.innerHTML = opts;
    if (selRekap) selRekap.innerHTML = opts;
    if (selRule) {
      selRule.innerHTML = opts;
      if ([...selRule.options].some(o => o.value.toLowerCase() === 'rahma romlah')) selRule.value = 'Rahma Romlah';
    }
  };
}

function renderKaryawanList() {
  const tx = db.transaction('karyawan', 'readonly');
  tx.objectStore('karyawan').getAll().onsuccess = (e) => {
    const priority = {'rahma romlah': 0, 'susi handayani': 1};
    const list = (e.target.result || []).sort((a,b) => (priority[String(a.nama||'').toLowerCase()] ?? 99) - (priority[String(b.nama||'').toLowerCase()] ?? 99) || String(a.nama).localeCompare(String(b.nama)));
    // Support both old container and new table
    const container = document.getElementById('karyawanListContainer');
    const tbody = document.getElementById('karyawanListTable');
    if (tbody) {
      tbody.innerHTML = list.map(k => `
        <tr>
          <td><b>${escapeHtml(k.nama)}</b></td>
          <td><div class="settings-action-icons"><button class="icon-action edit" onclick="editKaryawan(${k.id})">✏️</button><button class="icon-action delete" onclick="deleteKaryawan(${k.id})">🗑️</button></div></td>
        </tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">Belum ada karyawan</td></tr>';
    }
    if (container) {
      container.innerHTML = list.map(k => `
        <div style="display:flex; justify:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #ddd;">
          <span><b>${escapeHtml(k.nama)}</b></span>
          <div class="settings-action-icons" style="margin-left:auto; justify-content:flex-end;">
            <button class="icon-action edit" onclick="editKaryawan(${k.id})" title="Edit" aria-label="Edit">✏️</button>
            <button class="icon-action delete" onclick="deleteKaryawan(${k.id})" title="Hapus" aria-label="Hapus">🗑️</button>
          </div>
        </div>`).join('');
    }
  };
}

async function editKaryawan(id) {
  const nama = await new Promise(resolve => {
    const tx = db.transaction('karyawan','readonly');
    tx.objectStore('karyawan').get(id).onsuccess = e => resolve(e.target.result?.nama || '');
  });
  if (!nama) return;
  const host = document.createElement('div');
  host.innerHTML = `<div style="position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px"><div style="background:#fff;border-radius:16px;padding:18px;width:min(100%,380px)"><b>Edit Karyawan</b><input id="tmpEditKaryawan" value="${escapeHtml(nama)}" style="margin-top:12px"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn btn-warning" id="tmpCancel">Batal</button><button class="btn btn-primary" id="tmpSave">Simpan</button></div></div></div>`;
  document.body.appendChild(host);
  host.querySelector('#tmpCancel').onclick=()=>host.remove();
  host.querySelector('#tmpSave').onclick=()=>{
    const value=host.querySelector('#tmpEditKaryawan').value.trim();
    if(!value) return uiToast('Nama karyawan tidak boleh kosong.');
    const tx=db.transaction('karyawan','readwrite'); tx.objectStore('karyawan').put({id,nama:value});
    tx.oncomplete=()=>{host.remove();renderAll();uiToast('Karyawan berhasil diedit.');};
  };
}

function addKaryawan() {
  const input = document.getElementById('newKaryawanInput');
  const nama = input ? input.value.trim() : '';
  if (!nama) return;

  const tx = db.transaction('karyawan', 'readwrite');
  tx.objectStore('karyawan').add({ nama: nama });
  tx.oncomplete = () => {
    input.value = '';
    renderAll();
  };
}

async function deleteKaryawan(id) {
  if (!(await uiConfirm("Hapus karyawan ini?"))) return;
  const tx = db.transaction('karyawan', 'readwrite');
  tx.objectStore('karyawan').delete(id);
  tx.oncomplete = () => renderAll();
}

function renderItemsTable() {
  const tx = db.transaction('items', 'readonly');
  tx.objectStore('items').getAll().onsuccess = (e) => {
    const items = e.target.result;
    const tbody = document.getElementById('itemsTable');
    if (tbody) {
      tbody.innerHTML = items.map(i => `
        <tr>
          <td><b class="item-code">${escapeHtml(i.alias)}</b></td>
          <td>${i.name}</td>
          <td>${escapeHtml(String(i.unit || "").toUpperCase())}</td>
          <td><div class="settings-action-icons"><button class="icon-action edit" onclick="editItem('${escapeHtml(i.alias)}')" title="Edit" aria-label="Edit">✏️</button><button class="icon-action delete" onclick="deleteItem('${escapeHtml(i.alias)}')" title="Hapus" aria-label="Hapus">🗑️</button></div></td>
        </tr>
      `).join('');
    }

    const selRuleItem = document.getElementById('ruleItemSelect');
    if (selRuleItem) {
      selRuleItem.innerHTML = items.map(i => `<option value="${i.alias}" data-unit="${(i.unit||'').toLowerCase()}">${i.name} (${String(i.unit||'').toUpperCase()}) - ${i.alias}</option>`).join('');
      if ([...selRuleItem.options].some(o=>String(o.value).toLowerCase()==='stk')) selRuleItem.value=[...selRuleItem.options].find(o=>String(o.value).toLowerCase()==='stk').value;
    }
    toggleCommissionMode();
  };
}

function editItem(alias) {
  const tx=db.transaction('items','readonly');
  tx.objectStore('items').get(alias).onsuccess=e=>{
    const i=e.target.result; if(!i)return;
    document.getElementById('editItemAlias').value=i.alias;
    document.getElementById('itemAlias').value=i.alias;
    document.getElementById('itemName').value=i.name||'';
    document.getElementById('itemUnit').value=i.unit||'kg';
    const btn=document.querySelector('#tab-settings .card button[onclick="addItem()"]');
    if(btn){btn.textContent='💾 Atualizar Barang';btn.dataset.editing='1';}
    document.getElementById('itemAlias').focus();
  };
}

function addItem() {
  const oldAlias = document.getElementById('editItemAlias').value.trim().toLowerCase();
  const alias = document.getElementById('itemAlias').value.trim().toLowerCase();
  const name = document.getElementById('itemName').value.trim();
  const unit = String(document.getElementById('itemUnit').value || '').trim().toLowerCase();
  if (!alias || !name) { uiToast('Isi Kode WA dan Nama Pekerjaan!'); return; }
  const tx = db.transaction('items', 'readwrite');
  if (oldAlias && oldAlias !== alias) tx.objectStore('items').delete(oldAlias);
  tx.objectStore('items').put({ alias, name, unit: String(unit || '').toLowerCase() });
  tx.oncomplete = () => {
    document.getElementById('editItemAlias').value='';
    document.getElementById('itemAlias').value=''; document.getElementById('itemName').value='';
    const btn=document.querySelector('#tab-settings .card button[data-editing="1"]'); if(btn){btn.textContent='+ Simpan Barang';delete btn.dataset.editing;}
    renderAll(); uiToast(oldAlias ? 'Barang berhasil diedit.' : 'Barang berhasil disimpan.');
  };
}

async function deleteItem(alias) {
  if (!(await uiConfirm(`Hapus barang dengan kode "${alias}"?`))) return;
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').delete(alias);
  tx.oncomplete = () => renderAll();
}

function renderCommissionRulesTable() {
  if (!db) return;
  const tx = db.transaction('comm_rules','readonly');
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => {
    const rules = e.target.result || [];
    const tbody = document.getElementById('commissionRulesTable');
    if (tbody) {
      tbody.innerHTML = rules.map(r=>{
        // Hide PCS - only KG tier
        const isKg = true; // KG only now
        return `<tr>
          <td>${escapeHtml(r.karyawan)}</td>
          <td><b>${escapeHtml(r.itemAlias)}</b></td>
          <td>${r.tier1Limit} / Rp ${(r.tier1Rate||0).toLocaleString()}</td>
          <td>${r.tier2Limit} / Rp ${(r.tier2Rate||0).toLocaleString()}</td>
          <td>Rp ${(r.tier3Rate||0).toLocaleString()}</td>
          <td><div class="settings-action-icons"><button class="icon-action edit" onclick="editCommissionRule('${escapeHtml(r.key)}')" title="Edit">✏️</button><button class="icon-action delete" onclick="deleteCommissionRule('${escapeHtml(r.key)}')" title="Hapus">🗑️</button></div></td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Belum ada skema KG</td></tr>';
    }
  };
}

function editCommissionRule(key) {
  const tx=db.transaction('comm_rules','readonly');
  tx.objectStore('comm_rules').get(key).onsuccess=e=>{
    const r=e.target.result; if(!r)return;
    document.getElementById('editRuleKey').value=r.key;
    document.getElementById('ruleKaryawanSelect').value=r.karyawan;
    document.getElementById('ruleItemSelect').value=r.itemAlias;
    document.getElementById('ruleTier1Limit').value=r.tier1Limit ?? 50;
    document.getElementById('ruleTier1Rate').value=r.tier1Rate ?? 0;
    document.getElementById('ruleTier2Limit').value=r.tier2Limit ?? 70;
    document.getElementById('ruleTier2Rate').value=r.tier2Rate ?? 0;
    document.getElementById('ruleTier3Rate').value=r.tier3Rate ?? 0;
    document.getElementById('rulePcsRate').value=r.pcsRate ?? 0;
    const btn=document.querySelector('#tab-settings .card.com-col button[onclick="addCommissionRule()"]');
    if(btn){btn.textContent='💾 Update Skema';btn.dataset.editing='1';}
  };
}

function addCommissionRule() {
  const oldKey=document.getElementById('editRuleKey').value.trim();
  const karyawan = document.getElementById('ruleKaryawanSelect').value;
  const itemAlias = String(document.getElementById('ruleItemSelect').value || '').trim().toLowerCase();
  const tier1Limit = Math.max(0, Number.parseFloat(document.getElementById('ruleTier1Limit').value) ?? 50);
  const tier1Rate = Math.max(0, Number.parseFloat(document.getElementById('ruleTier1Rate').value) ?? 0);
  const tier2Limit = Math.max(tier1Limit, Number.parseFloat(document.getElementById('ruleTier2Limit').value) ?? 70);
  const tier2Rate = Math.max(0, Number.parseFloat(document.getElementById('ruleTier2Rate').value) ?? 0);
  const tier3Rate = Math.max(0, Number.parseFloat(document.getElementById('ruleTier3Rate').value) ?? 0);
  const pcsRate = Math.max(0, Number.parseFloat(document.getElementById('rulePcsRate').value) ?? 0);
  const key = `${String(karyawan).trim().toLowerCase()}_${itemAlias}`;
  const tx = db.transaction('comm_rules', 'readwrite');
  if(oldKey && oldKey!==key) tx.objectStore('comm_rules').delete(oldKey);
  tx.objectStore('comm_rules').put({ key, karyawan, itemAlias, tier1Limit, tier1Rate, tier2Limit, tier2Rate, tier3Rate, pcsRate });
  tx.oncomplete = () => {
    ['ruleTier1Limit','ruleTier1Rate','ruleTier2Limit','ruleTier2Rate','ruleTier3Rate','editRuleKey'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    document.getElementById('ruleTier1Limit').value='50';
    document.getElementById('ruleTier1Rate').value='0';
    document.getElementById('ruleTier2Limit').value='70';
    document.getElementById('ruleTier2Rate').value='0';
    document.getElementById('ruleTier3Rate').value='0';
    document.getElementById('rulePcsRate').value='0';
    const btn=document.querySelector('#tab-settings .card.com-col button[data-editing="1"]'); if(btn){btn.textContent='+ Simpan Skema';delete btn.dataset.editing;}
    renderAll(); uiToast(oldKey ? 'Skema berhasil diedit.' : 'Skema berhasil disimpan.');
  };
}

async function deleteCommissionRule(key) {
  if (!(await uiConfirm('Hapus skema komisi ini?','Hapus Skema'))) return;
  const tx = db.transaction('comm_rules', 'readwrite');
  tx.objectStore('comm_rules').delete(key);
  tx.oncomplete = () => { renderAll(); uiToast('Skema komisi dihapus.'); };
}

function renderOrdersTable() {
  const todayStr = new Date().toLocaleDateString('id-ID');
  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    const orders = e.target.result.filter(o => o.tanggal === todayStr);
    const tbody = document.getElementById('ordersTable') || document.getElementById('dataTable');
    if (tbody) {
      tbody.innerHTML = orders.map(o => {
        const custText = o.customer ? `[${escapeHtml(o.customer)}] ` : '';
        return `
          <tr>
            <td><small>${escapeHtml(o.waktu || '')}</small></td>
            <td><b>${escapeHtml(o.karyawan || '')}</b></td>
            <td>${custText}${escapeHtml(o.jenis || '')}</td>
            <td>${o.qty} ${escapeHtml(o.unit || '')}</td>
            <td>${escapeHtml(String(o.unit || "").toUpperCase())}</td>
            <td class="com-col">Rp ${(o.totalKomisi || 0).toLocaleString()}</td>
            <td>
              <div class="report-actions">
                <button class="report-action-btn edit" onclick="editOrder(${o.id})" title="Edit" aria-label="Edit">✏️</button>
                <button class="report-action-btn delete" onclick="deleteOrder(${o.id})" title="Hapus" aria-label="Hapus">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
    toggleCommissionMode();
  };
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

async function editOrder(id) {
  const tx = db.transaction(['orders','karyawan','items'], 'readonly');
  const orderReq = tx.objectStore('orders').get(id);
  const empReq = tx.objectStore('karyawan').getAll();
  const itemReq = tx.objectStore('items').getAll();

  orderReq.onsuccess = () => {
    const o = orderReq.result;
    if (!o) return uiToast('Data pengerjaan tidak ditemukan.');
    empReq.onsuccess = () => {
      itemReq.onsuccess = () => {
        const empSel=document.getElementById('editOrderEmployee');
        const itemSel=document.getElementById('editOrderItem');
        empSel.innerHTML=empReq.result.map(k=>`<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join('');
        itemSel.innerHTML=itemReq.result.map(i=>`<option value="${escapeHtml(i.alias)}">${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`).join('');
        document.getElementById('editOrderId').value=o.id;
        document.getElementById('editOrderCustomer').value=o.customer || '';
        document.getElementById('editOrderQty').value=o.qty;
        empSel.value=o.karyawan || '';
        itemSel.value=o.itemAlias || '';
        document.getElementById('editOrderModal').style.display='flex';
      };
    };
  };
}

function closeEditOrder() {
  const m=document.getElementById('editOrderModal');
  if(m) m.style.display='none';
}

async function saveEditedOrder() {
  const id=Number(document.getElementById('editOrderId').value);
  const customer=document.getElementById('editOrderCustomer').value.trim();
  const karyawan=document.getElementById('editOrderEmployee').value;
  const itemAlias=document.getElementById('editOrderItem').value;
  const qty=parseFloat(document.getElementById('editOrderQty').value);
  if(!id || !karyawan || !itemAlias || !Number.isFinite(qty) || qty<=0) {
    uiToast('Lengkapi data edit terlebih dahulu.'); return;
  }
  const items=await new Promise(resolve=>{
    const t=db.transaction('items','readonly');
    t.objectStore('items').get(itemAlias).onsuccess=e=>resolve(e.target.result);
  });
  if(!items){ uiToast('Jenis pekerjaan tidak ditemukan.'); return; }

  const todayStr=new Date().toLocaleDateString('id-ID');
  const orders=await getTodayOrders(todayStr);
  const current=orders.find(o=>o.id===id);
  const rules=await getCommRulesMap();
  const pcsMasterMap=await getPcsMasterMap();
  const canonicalAlias=canonicalItemAlias(items);
  const rule=getRuleForItem(rules, karyawan, items);
  const currentEmpQty=orders.filter(o=>o.id!==id && o.karyawan===karyawan && String(o.itemAlias||'').toLowerCase()===canonicalAlias)
    .reduce((sum,o)=>sum+Number(o.qty||0),0);
  let komisi=0;
  const isPcsEdit = normalizeUnit(items.unit)==='pcs';
  if (isPcsEdit) {
    const pcsMaster = pcsMasterMap[canonicalAlias] || pcsMasterMap[String(items.alias||'').toLowerCase()];
    if (pcsMaster && pcsMaster.active!==false) {
      komisi = Number(qty||0) * Math.max(0, Number(pcsMaster.rate||0));
    } else {
      komisi = Number(qty||0) * Math.max(0, Number(rule?.pcsRate ?? 0));
    }
  } else {
    komisi=calculateCommissionForRule(rule, items.unit, currentEmpQty, qty);
  }

  const updated={
    ...current,
    karyawan, customer, itemAlias:canonicalAlias, jenis:items.name, unit:normalizeUnit(items.unit), qty,
    totalKomisi:komisi
  };
  const tx=db.transaction('orders','readwrite');
  tx.objectStore('orders').put(updated);
  tx.oncomplete=()=>{ closeEditOrder(); renderAll(); uiToast('Pengerjaan berhasil diedit.'); };
}

async function deleteOrder(id) {
  if (!(await uiConfirm('Hapus data pengerjaan ini?','Hapus Pengerjaan'))) return;
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').delete(id);
  tx.oncomplete = () => { renderAll(); uiToast('Pengerjaan dihapus.'); };
}

async function clearAllOrders() {
  if (!(await uiConfirm("Hapus seluruh data pengerjaan hari ini?"))) return;
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').clear();
  tx.oncomplete = () => renderAll();
}

function renderPcsMasterTable() {
  if (!db || !db.objectStoreNames.contains('pcs_master')) {
    // if store not exists yet (old db), try to render items select only
    const sel = document.getElementById('pcsMasterItemSelect');
    if (sel) {
      const tx = db.transaction('items','readonly');
      tx.objectStore('items').getAll().onsuccess = e => {
        const pcsItems = (e.target.result||[]).filter(i=>String(i.unit||'').toLowerCase()==='pcs');
        const dl = document.getElementById('pcsMasterDatalist');
        if (dl) {
          dl.innerHTML = pcsItems.map(i=>`<option value="${escapeHtml(i.alias)}">${escapeHtml(i.name)} (${escapeHtml(String(i.unit||'').toUpperCase())})</option>`).join('');
        }
      };
    }
    return;
  }
  const txItems = db.transaction('items','readonly');
  txItems.objectStore('items').getAll().onsuccess = eItems => {
    const pcsItems = (eItems.target.result||[]).filter(i=>String(i.unit||'').toLowerCase()==='pcs');
    const dl = document.getElementById('pcsMasterDatalist');
    const selInput = document.getElementById('pcsMasterItemSelect');
    if (dl) {
      dl.innerHTML = pcsItems.map(i=>`<option value="${escapeHtml(i.alias)}">${escapeHtml(i.name)} (${escapeHtml(String(i.unit||'').toUpperCase())})</option><option value="${escapeHtml(String(i.name||'').toLowerCase())}"></option>`).join('');
    }
    // keep placeholder, don't overwrite input value if user typing
    if (selInput && !selInput.value && !document.getElementById('editPcsMasterAlias').value) {
      // leave empty for new entry, datalist provides suggestions
    }
    const tx = db.transaction('pcs_master','readonly');
    tx.objectStore('pcs_master').getAll().onsuccess = e => {
      const rules = e.target.result || [];
      const tbody = document.getElementById('pcsMasterTable');
      if (tbody) {
        tbody.innerHTML = rules.map(r=>`
          <tr>
            <td><input type="checkbox" class="pcs-master-check" data-alias="${escapeHtml(r.alias)}" ${r.active!==false?'checked':''} onchange="togglePcsMasterActive('${escapeHtml(r.alias)}', this.checked)"></td>
            <td><b>${escapeHtml(r.name||r.alias)}</b><br><small class="alias-code">${escapeHtml(r.alias)}</small> <small>PCS</small></td>
            <td>Rp ${(Number(r.rate||0)).toLocaleString()}</td>
            <td><div class="settings-action-icons"><button class="icon-action edit" onclick="editPcsMaster('${escapeHtml(r.alias)}')" title="Edit">✏️</button><button class="icon-action delete" onclick="deletePcsMaster('${escapeHtml(r.alias)}')" title="Hapus">🗑️</button></div></td>
          </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Belum ada master PCS</td></tr>';
      }
    };
  };
}

function addPcsMaster() {
  const aliasRaw = document.getElementById('pcsMasterItemSelect').value.trim().toLowerCase();
  const rate = Math.max(0, Number.parseFloat(document.getElementById('pcsMasterRate').value) ?? 0);
  if (!aliasRaw) { uiToast('Ketik jenis satuan PCS!'); return; }
  if (rate <= 0) { uiToast('Isi nominal PCS!'); return; }
  // cari item di master barang, jika tidak ada buat otomatis sebagai PCS
  const txI = db.transaction('items','readonly');
  txI.objectStore('items').getAll().onsuccess = eAll => {
    const all = eAll.target.result||[];
    let item = all.find(i=> String(i.alias||'').toLowerCase()===aliasRaw || String(i.name||'').toLowerCase()===aliasRaw);
    if (!item) {
      // buat item baru otomatis di master barang agar bisa dipakai di WA
      const txC = db.transaction('items','readwrite');
      const newItem = { alias: aliasRaw, name: aliasRaw.charAt(0).toUpperCase()+aliasRaw.slice(1), unit: 'pcs' };
      txC.objectStore('items').put(newItem);
      txC.oncomplete = () => {
        savePcsRule(aliasRaw, newItem.name, rate);
      };
    } else {
      savePcsRule(aliasRaw, item.name, rate);
    }
  };

  function savePcsRule(alias, name, rateVal){
    const editAlias = document.getElementById('editPcsMasterAlias').value.trim().toLowerCase();
    const tx = db.transaction('pcs_master','readwrite');
    if (editAlias && editAlias !== alias) tx.objectStore('pcs_master').delete(editAlias);
    tx.objectStore('pcs_master').put({ alias: alias, name: name, rate: rateVal, active: true });
    tx.oncomplete = () => {
      document.getElementById('editPcsMasterAlias').value='';
      document.getElementById('pcsMasterRate').value='';
      document.getElementById('pcsMasterItemSelect').value='';
      closePcsAddForm();
      renderPcsMasterTable(); 
      renderItemsTable();
      uiToast(editAlias ? 'Master PCS diupdate.' : 'Master PCS disimpan.');
    };
  }
}

function editPcsMaster(alias) {
  const tx = db.transaction('pcs_master','readonly');
  tx.objectStore('pcs_master').get(alias).onsuccess = e => {
    const r = e.target.result; if (!r) return;
    document.getElementById('editPcsMasterAlias').value = r.alias;
    const wrap = document.getElementById('pcsMasterFormWrap');
    if(wrap) wrap.style.display='block';
    document.getElementById('pcsMasterItemSelect').value = r.alias;
    document.getElementById('pcsMasterRate').value = r.rate;
    document.getElementById('pcsMasterRate').focus();
  };
}

async function deletePcsMaster(alias) {
  if (!(await uiConfirm(`Hapus master PCS "${alias}"?`,'Hapus PCS'))) return;
  const tx = db.transaction('pcs_master','readwrite');
  tx.objectStore('pcs_master').delete(alias);
  tx.oncomplete = () => { renderPcsMasterTable(); uiToast('Master PCS dihapus.'); };
}

function togglePcsMasterActive(alias, active) {
  const tx = db.transaction('pcs_master','readwrite');
  const store = tx.objectStore('pcs_master');
  store.get(alias).onsuccess = e => {
    const r = e.target.result; if (!r) return;
    r.active = active;
    store.put(r);
  };
}

function togglePcsMasterCheckAll(checked) {
  document.querySelectorAll('.pcs-master-check').forEach(cb=>{
    cb.checked = checked;
    togglePcsMasterActive(cb.dataset.alias, checked);
  });
}

function savePcsMasterChecked() {
  uiToast('Status checklist PCS tersimpan.');
  renderPcsMasterTable();
}

// extend renderAll base

function syncCommissionUnitMode() {
  const sel = document.getElementById('ruleItemSelect');
  const pcs = document.getElementById('rulePcsRate');
  if (!sel || !pcs) return;
  const opt = sel.options[sel.selectedIndex];
  const unitFromData = opt ? (opt.dataset.unit || '') : '';
  let isPcs = unitFromData.toLowerCase() === 'pcs';
  if (!isPcs) {
    const m = opt ? String(opt.textContent).match(/\(([^)]+)\)/) : null;
    isPcs = !!m && String(m[1]).toLowerCase() === 'pcs';
  }
  ['ruleTier1Limit','ruleTier1Rate','ruleTier2Limit','ruleTier2Rate','ruleTier3Rate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = isPcs; el.style.opacity = isPcs ? '0.5' : '1'; }
  });
  pcs.style.borderColor = isPcs ? 'var(--primary)' : '';
}
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('ruleItemSelect');
  if (sel) sel.addEventListener('change', syncCommissionUnitMode);
});
const _renderAllBase = renderAll;
renderAll = function() { _renderAllBase(); setTimeout(syncCommissionUnitMode, 0); };
