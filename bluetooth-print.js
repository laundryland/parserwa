function printLaporan(type) {
  const now = new Date().toLocaleString('id-ID');
  document.getElementById('th-title').innerText = "LAPORAN PENGERJAAN";
  document.getElementById('th-subtitle').innerText = isCommissionActive ? "MODE DENGAN KOMISI" : "MODE VOLUME PENGERJAAN";
  document.getElementById('th-print-time').innerText = now;
  document.getElementById('th-total-container').style.display = isCommissionActive ? 'block' : 'none';

  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    let grandTotalKomisi = 0;
    document.getElementById('th-items').innerHTML = e.target.result.map(p => {
      grandTotalKomisi += p.totalKomisi || 0;
      const custText = p.customer ? `[${p.customer}] ` : '';
      return `
        <tr>
          <td colspan="2"><b>${p.karyawan.toUpperCase()}</b> - ${custText}${p.jenis}</td>
        </tr>
        <tr>
          <td>Qty: ${p.qty} ${p.unit}</td>
          ${isCommissionActive ? `<td style="text-align:right;">Komisi: Rp ${(p.totalKomisi || 0).toLocaleString()}</td>` : ''}
        </tr>
      `;
    }).join('');

    if (isCommissionActive) {
      document.getElementById('th-total').innerText = 'Rp ' + grandTotalKomisi.toLocaleString();
    }

    if (type === 'png') {
      generateReportPNG();
    } else if (type === 'pdf') {
      showThermalPreview();
      uiToast('Preview PDF siap. Gunakan tombol Simpan PDF di dalam preview; tidak memakai dialog print Windows.');
    } else {
      showThermalPreview();
      openBluetoothThermalPrinter();
    }
  };
}

function generateReportPNG() {
  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    const orders = e.target.result;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = 400;
    const padding = 20;
    let height = 180 + (orders.length * 40);
    if (typeof isCommissionActive !== 'undefined' && isCommissionActive) height += 40;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Header Background
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(0, 0, width, 60);

    const savedLogo = localStorage.getItem('app_custom_logo');

    const renderContent = () => {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = savedLogo ? "left" : "center";
      ctx.fillText("LAPORAN PENGERJAAN", savedLogo ? 75 : width / 2, 38);

      ctx.fillStyle = "#0f172a";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, padding, 90);

      let y = 120;
      let totalKomisi = 0;

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, 100);
      ctx.lineTo(width - padding, 100);
      ctx.stroke();

      orders.forEach((o, i) => {
        totalKomisi += (o.totalKomisi || 0);
        const custText = o.customer ? `[${o.customer}] ` : '';

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`${i + 1}. ${o.karyawan.toUpperCase()} - ${custText}${o.jenis}`, padding, y);

        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        let detailText = `Qty: ${o.qty} ${o.unit}`;
        if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
          detailText += ` | Komisi: Rp ${(o.totalKomisi || 0).toLocaleString()}`;
        }
        ctx.fillText(detailText, padding + 15, y + 16);

        y += 38;
      });

      if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        y += 25;
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`TOTAL KOMISI: Rp ${totalKomisi.toLocaleString()}`, padding, y);
      }

      const dataURL = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `Nota_Laporan_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    if (savedLogo) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(42, 30, 20, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 22, 10, 40, 40);
        ctx.restore();
        renderContent();
      };
      img.src = savedLogo;
    } else {
      renderContent();
    }
  };
}

/* =========================================================
   DIRECT BLUETOOTH THERMAL — ESC/POS / Web Bluetooth
   Tidak menggunakan browser print dialog.
   Bekerja pada browser yang mendukung Web Bluetooth, umumnya
   Chrome/Chromium Android/desktop HTTPS atau localhost.
   ========================================================= */
function showThermalPreview(){
  const el=document.getElementById('thermal-preview');
  if(el) el.style.display='block';
}

function buildEscPosReport(orders){
  const enc=new TextEncoder();
  const lines=[];
  const now=new Date();
  const line='--------------------------------';
  lines.push('\x1b\x40');                 // initialize
  lines.push('\x1b\x61\x01');             // center
  lines.push('\x1b\x45\x01');             // bold
  lines.push('LAPORAN PENGERJAAN\n');
  lines.push('\x1b\x45\x00');
  lines.push(now.toLocaleString('id-ID')+'\n');
  lines.push('\x1b\x61\x00');             // left
  lines.push(line+'\n');

  let totalKomisi=0;
  orders.forEach((p,i)=>{
    totalKomisi += Number(p.totalKomisi||0);
    const cust=p.customer ? `[${p.customer}] ` : '';
    lines.push(`${i+1}. ${String(p.karyawan||'').toUpperCase()}\n`);
    lines.push(`${cust}${p.jenis||''}\n`);
    lines.push(`Qty: ${p.qty} ${p.unit||''}\n`);
    if(typeof isCommissionActive!=='undefined' && isCommissionActive){
      lines.push(`Komisi: Rp ${(p.totalKomisi||0).toLocaleString('id-ID')}\n`);
    }
    lines.push('\n');
  });
  if(typeof isCommissionActive!=='undefined' && isCommissionActive){
    lines.push(line+'\n');
    lines.push(`TOTAL KOMISI: Rp ${totalKomisi.toLocaleString('id-ID')}\n`);
  }
  lines.push(line+'\n');
  lines.push('\x1b\x61\x01');
  lines.push('Terima kasih\n\n\n');
  lines.push('\x1d\x56\x00');             // cut where supported
  return enc.encode(lines.join(''));
}

async function openBluetoothThermalPrinter(){
  if(!navigator.bluetooth){
    uiToast('Bluetooth printer membutuhkan Chrome/Chromium dengan Web Bluetooth. Pastikan aplikasi dibuka via HTTPS atau localhost.');
    return;
  }

  try{
    uiToast('Pilih printer thermal Bluetooth...');
    const device=await navigator.bluetooth.requestDevice({
      acceptAllDevices:true,
      optionalServices:[
        '000018f0-0000-1000-8000-00805f9b34fb',
        '00001101-0000-1000-8000-00805f9b34fb'
      ]
    });

    const server=await device.gatt.connect();
    let characteristic=null;

    const serviceUUIDs=[
      '000018f0-0000-1000-8000-00805f9b34fb',
      '00001101-0000-1000-8000-00805f9b34fb'
    ];

    for(const suuid of serviceUUIDs){
      try{
        const service=await server.getPrimaryService(suuid);
        const chars=await service.getCharacteristics();
        characteristic=chars.find(c=>c.properties.writeWithoutResponse) ||
                       chars.find(c=>c.properties.write) || null;
        if(characteristic) break;
      }catch(_){}
    }

    if(!characteristic){
      // Fallback: scan all primary services exposed by the device.
      const services=await server.getPrimaryServices();
      for(const service of services){
        try{
          const chars=await service.getCharacteristics();
          characteristic=chars.find(c=>c.properties.writeWithoutResponse) ||
                         chars.find(c=>c.properties.write) || null;
          if(characteristic) break;
        }catch(_){}
      }
    }

    if(!characteristic) throw new Error('Tidak menemukan karakteristik WRITE printer ESC/POS.');

    const orders=await new Promise((resolve,reject)=>{
      const tx=db.transaction('orders','readonly');
      const req=tx.objectStore('orders').getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });

    const data=buildEscPosReport(orders);
    const maxChunk=180;
    for(let i=0;i<data.length;i+=maxChunk){
      const chunk=data.slice(i,i+maxChunk);
      if(characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse){
        await characteristic.writeValueWithoutResponse(chunk);
      }else{
        await characteristic.writeValue(chunk);
      }
    }

    uiToast('Berhasil mengirim laporan langsung ke printer thermal.');
    try{ if(device.gatt.connected) device.gatt.disconnect(); }catch(_){}
  }catch(err){
    if(err && err.name==='NotFoundError'){
      uiToast('Pemilihan printer dibatalkan.');
    }else{
      uiToast('Gagal cetak Bluetooth: '+(err?.message||err));
    }
  }
}
