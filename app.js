/* ===== Cấu hình & dữ liệu ===== */
const KEY = 'so-chi-tieu-v1';
const INSTALLED_KEY = 'so-chi-tieu-installed';
const BACKUP_KEY = 'so-chi-tieu-last-backup';
const CATS = ['Đi lại', 'Xăng xe', 'Phí nền tảng', 'Bảo dưỡng xe', 'Ăn uống', 'Nhà ở', 'Học tập', 'Giải trí', 'Mua sắm', 'Sức khỏe', 'Khác'];
const VEHICLE = ['Xăng xe', 'Phí nền tảng', 'Bảo dưỡng xe']; // chi phí trừ vào lãi ròng
const PALETTE = ['#17845a', '#c5412f', '#f2b134', '#3b82b6', '#8a5cc2', '#e0707f', '#4aa3a0', '#9a7b4f', '#7f8c8d', '#b36a2e', '#5c6bc0'];

// Mỗi khoản: { id, type:'in'|'out', scope:'day'|'month', amount, date, cat, note }
// scope 'day' -> date = YYYY-MM-DD | scope 'month' -> date = YYYY-MM
let data = [];
try { data = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

/* ===== Tiện ích ===== */
const $ = id => document.getElementById(id);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const money = n => Math.round(n).toLocaleString('vi-VN') + ' ₫';
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'tr' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (a, t) => a.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
const by = prefix => data.filter(e => e.date.startsWith(prefix));
const dmy = d => d.split('-').reverse().join('/');
const isMonthly = e => e.scope === 'month';

const today = iso(new Date());
const S = { tab: 'day', day: today, month: today.slice(0, 7), year: +today.slice(0, 4), type: 'out', scope: 'day', edit: null };

/* ===== Thành phần giao diện ===== */
function head(label, list) {
  const i = sum(list, 'in'), o = sum(list, 'out');
  $('hl').textContent = label;
  $('hb').textContent = money(i - o);
  $('hs').innerHTML = `<span>Thu <b>${money(i)}</b></span><span>Chi <b>${money(o)}</b></span>`;
}

function entries(list) {
  if (!list.length) return '<div class="empty">Chưa có khoản nào</div>';
  return list.map(e => `
    <div class="row">
      <div>${e.type === 'in' ? 'Thu nhập' + (isMonthly(e) ? '<span class="tag">cả tháng</span>' : '') : esc(e.cat)}
        <small>${esc(e.note) || (e.type === 'in' ? 'Không ghi chú' : '')}</small></div>
      <div><span class="amt ${e.type}">${e.type === 'in' ? '+' : '−'}${money(e.amount)}</span>
        <button class="x ed" data-edit="${e.id}" aria-label="Sửa">✎</button><button class="x" data-del="${e.id}" aria-label="Xóa">×</button></div>
    </div>`).join('');
}

// Lãi ròng = thu nhập − chi phí xe (xăng, phí nền tảng, bảo dưỡng)
function netCard(list, title) {
  const inc = sum(list, 'in');
  const cost = list.filter(e => e.type === 'out' && VEHICLE.includes(e.cat)).reduce((s, e) => s + e.amount, 0);
  const net = inc - cost;
  return `<div class="card"><h2>${title}</h2>
    <div class="net">
      <div><small>Thu</small><b class="in">${money(inc)}</b></div>
      <div><small>Chi phí xe</small><b class="out">${money(cost)}</b></div>
      <div><small>Lãi ròng</small><b class="${net >= 0 ? 'in' : 'out'}">${money(net)}</b></div>
    </div>
    <div class="note">Chi phí xe gồm: ${VEHICLE.join(', ')}.</div></div>`;
}

/* ===== Biểu đồ (SVG tự vẽ, không cần thư viện) ===== */
function donut(items, total) {
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = items.map(([, v], i) => {
    const len = v / total * c;
    const s = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len;
    return s;
  }).join('');
  return `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="Biểu đồ tròn chi tiêu theo lý do">${arcs}
    <text x="70" y="66" text-anchor="middle" class="dl">Tổng chi</text>
    <text x="70" y="84" text-anchor="middle" class="dv">${short(total)}</text></svg>`;
}

function barChart(months) { // months: [{p, a, b}]
  const max = Math.max(1, ...months.map(m => Math.max(m.a, m.b)));
  const H = 120, step = 29;
  const bars = months.map((m, i) => {
    const x = 14 + i * step, ha = m.a / max * H, hb = m.b / max * H;
    return `<g data-m="${m.p}" style="cursor:pointer">
      <rect x="${x}" y="${H + 8 - ha}" width="10" height="${m.a ? Math.max(ha, 2) : 0}" rx="2" class="bi"/>
      <rect x="${x + 11}" y="${H + 8 - hb}" width="10" height="${m.b ? Math.max(hb, 2) : 0}" rx="2" class="bo"/>
      <text x="${x + 10}" y="${H + 22}" text-anchor="middle" class="ax">${i + 1}</text></g>`;
  }).join('');
  return `<div class="lgd"><span><i style="background:var(--in)"></i>Thu</span><span><i style="background:var(--out)"></i>Chi</span><span>Cao nhất: ${short(max)}</span></div>
    <svg viewBox="0 0 366 ${H + 28}" class="chart" role="img" aria-label="Biểu đồ cột thu chi theo tháng">${bars}</svg>`;
}

/* ===== Tab: Hôm nay (nhập / sửa) ===== */
function viewDay() {
  const ed = S.edit ? data.find(x => x.id === S.edit) : null;
  if (S.edit && !ed) S.edit = null;
  const dayList = by(S.day);
  head('Ngày ' + dmy(S.day), dayList);

  const out = S.type === 'out';
  const monthMode = !out && S.scope === 'month';
  const monthList = by(S.month).filter(isMonthly);

  const picker = monthMode
    ? `<label style="margin-top:0">Tháng</label><input type="month" id="mm" value="${S.month}">`
    : `<label style="margin-top:0">Ngày</label><input type="date" id="d" value="${S.day}">`;

  const switches = ed ? `<h2 style="margin-top:14px">Sửa khoản ${out ? 'chi' : 'thu'}</h2>` : `
    <div class="seg" style="margin-top:12px">
      <button class="in ${!out ? 'on' : ''}" data-t="in">Thu nhập</button>
      <button class="out ${out ? 'on' : ''}" data-t="out">Chi tiêu</button>
    </div>
    ${out ? '' : `<label>Nhập thu nhập</label>
    <div class="seg s">
      <button data-s="day" class="${!monthMode ? 'on' : ''}">Theo ngày</button>
      <button data-s="month" class="${monthMode ? 'on' : ''}">Theo tháng</button>
    </div>`}`;

  const fields = out
    ? `<label>Khoản chi (₫)</label><input id="a" type="number" inputmode="numeric" min="0" placeholder="0" value="${ed ? ed.amount : ''}">
       <label>Lý do chi</label><select id="c">${CATS.map(c => `<option${ed && ed.cat === c ? ' selected' : ''}>${c}</option>`).join('')}</select>`
    : `<label>${monthMode ? 'Tổng thu nhập tháng (₫)' : 'Số tiền thu (₫)'}</label>
       <input id="a" type="number" inputmode="numeric" min="0" placeholder="0" value="${ed ? ed.amount : ''}">
       <label>Ghi chú</label><input id="n" maxlength="80" placeholder="VD: 12 cuốc taxi, lương dạy kèm..." value="${ed ? esc(ed.note) : ''}">`;

  $('app').innerHTML = `
    ${netCard(dayList, 'Lãi ròng hôm nay')}
    <div class="card">
      ${picker}${switches}${fields}
      <button class="go" id="add">${ed ? 'Cập nhật' : out ? 'Lưu khoản chi' : 'Lưu khoản thu'}</button>
      ${ed ? '<button class="ghost" data-cancel="1">Hủy sửa</button>' : ''}
    </div>
    <div class="card"><h2>Giao dịch trong ngày</h2>${entries(dayList.filter(e => !isMonthly(e)))}</div>
    ${monthList.length ? `<div class="card"><h2>Thu nhập cả tháng ${+S.month.slice(5)}/${S.month.slice(0, 4)}</h2>${entries(monthList)}</div>` : ''}`;

  if (monthMode) {
    $('mm').onchange = e => { if (e.target.value) { S.month = e.target.value; S.year = +S.month.slice(0, 4); render(); } };
  } else {
    $('d').onchange = e => {
      S.day = e.target.value || S.day;
      S.month = S.day.slice(0, 7);
      S.year = +S.day.slice(0, 4);
      render();
    };
  }

  $('add').onclick = () => {
    const amount = +$('a').value;
    if (!(amount > 0)) { $('a').focus(); return; }
    const fields = {
      type: S.type,
      scope: monthMode ? 'month' : 'day',
      amount,
      date: monthMode ? S.month : S.day,
      cat: out ? $('c').value : '',
      note: out ? '' : $('n').value.trim()
    };
    if (ed) { Object.assign(ed, fields); S.edit = null; }
    else data.push({ id: Date.now(), ...fields });
    save();
    render();
  };
}

/* ===== Tab: Tháng ===== */
function viewMonth() {
  const list = by(S.month);
  const [y, m] = S.month.split('-');
  head(`Tháng ${+m}/${y}`, list);

  const totalOut = sum(list, 'out');
  const cats = {};
  list.filter(e => e.type === 'out').forEach(e => cats[e.cat] = (cats[e.cat] || 0) + e.amount);
  const items = Object.entries(cats).sort((a, b) => b[1] - a[1]);

  const monthly = list.filter(isMonthly);
  const days = {};
  list.filter(e => !isMonthly(e)).forEach(e => (days[e.date] = days[e.date] || []).push(e));

  $('app').innerHTML = `
    <div class="card"><label style="margin-top:0">Chọn tháng</label><input type="month" id="m" value="${S.month}"></div>
    ${netCard(list, 'Lãi ròng tháng này')}
    ${monthly.length ? `<div class="card"><h2>Thu nhập cả tháng</h2>${entries(monthly)}</div>` : ''}
    <div class="card"><h2>Chi tiêu theo lý do</h2>
      ${items.length ? `<div class="pie">${donut(items, totalOut)}<div class="leg">${items.map(([c, v], i) =>
        `<div><span><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(c)}</span><b>${Math.round(v / totalOut * 100)}%</b></div>`).join('')}</div></div>
        <div style="margin-top:10px">${items.map(([c, v]) => `<div class="row"><span>${esc(c)}</span><b>${money(v)}</b></div>`).join('')}</div>`
        : '<div class="empty">Chưa có khoản chi</div>'}
    </div>
    <div class="card"><h2>Theo ngày</h2>
      ${Object.keys(days).sort().reverse().map(d => `
        <div class="row link" data-go="${d}">
          <div>${dmy(d)}</div>
          <div class="amt"><span class="in">+${money(sum(days[d], 'in'))}</span><br><span class="out">−${money(sum(days[d], 'out'))}</span></div>
        </div>`).join('') || '<div class="empty">Chưa có dữ liệu</div>'}
    </div>`;

  $('m').onchange = e => { if (e.target.value) { S.month = e.target.value; S.year = +S.month.slice(0, 4); render(); } };
}

/* ===== Tab: Năm ===== */
function viewYear() {
  const list = by(String(S.year));
  head('Năm ' + S.year, list);
  const months = [];
  let rows = '';
  for (let i = 1; i <= 12; i++) {
    const p = `${S.year}-${String(i).padStart(2, '0')}`;
    const l = by(p), a = sum(l, 'in'), b = sum(l, 'out');
    months.push({ p, a, b });
    rows += `<tr class="link" data-m="${p}"><td>Tháng ${i}</td>
      <td class="in">${a ? money(a) : '–'}</td><td class="out">${b ? money(b) : '–'}</td>
      <td>${a || b ? money(a - b) : '–'}</td></tr>`;
  }
  $('app').innerHTML = `
    <div class="card"><label style="margin-top:0">Năm</label><input type="number" id="y" value="${S.year}" min="2000" max="2100"></div>
    ${netCard(list, 'Lãi ròng cả năm')}
    <div class="card"><h2>Thu chi theo tháng</h2>${barChart(months)}</div>
    <div class="card" style="overflow-x:auto"><table>
      <tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Dư</th></tr>${rows}</table></div>`;
  $('y').onchange = e => { S.year = +e.target.value || S.year; render(); };
}

/* ===== Tab: Sao lưu ===== */
function download(name, text, type) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validEntry(e) {
  return e && (e.type === 'in' || e.type === 'out') && typeof e.amount === 'number' && e.amount > 0 &&
    typeof e.date === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(e.date);
}

function viewBackup() {
  head('Tất cả dữ liệu', data);
  const last = localStorage.getItem(BACKUP_KEY);
  $('app').innerHTML = `
    <div class="card"><h2>Sao lưu</h2>
      <p class="note" style="margin:0 0 6px">${data.length} khoản đang lưu trong trình duyệt này. ${last ? 'Sao lưu gần nhất: ' + dmy(last) + '.' : 'Bạn chưa sao lưu lần nào.'}</p>
      <button class="go" id="exp">Tải file sao lưu (.json)</button>
      <button class="go alt" id="csv">Xuất Excel (.csv)</button>
    </div>
    <div class="card"><h2>Khôi phục</h2>
      <p class="note" style="margin:0 0 10px">Chọn file .json đã sao lưu. Khoản nào chưa có sẽ được thêm vào, dữ liệu hiện tại không bị xóa.</p>
      <input type="file" id="imp" accept=".json,application/json">
    </div>`;

  $('exp').onclick = () => {
    download(`so-chi-tieu-${today}.json`, JSON.stringify({ app: 'so-chi-tieu', version: 1, exported: today, data }, null, 1), 'application/json');
    localStorage.setItem(BACKUP_KEY, today);
    render();
  };
  $('csv').onclick = () => {
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [...data].sort((a, b) => a.date.localeCompare(b.date)).map(e =>
      [e.date, e.type === 'in' ? 'Thu' : 'Chi', isMonthly(e) ? 'Cả tháng' : 'Theo ngày', e.cat, e.amount, e.note].map(q).join(','));
    download(`so-chi-tieu-${today}.csv`, '\ufeff' + ['Ngày,Loại,Phạm vi,Lý do,Số tiền,Ghi chú', ...rows].join('\n'), 'text/csv');
  };
  $('imp').onchange = async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const arr = Array.isArray(json) ? json : json.data;
      const ids = new Set(data.map(x => x.id));
      let added = 0, skipped = 0;
      (arr || []).forEach(e => {
        if (!validEntry(e)) { skipped++; return; }
        if (ids.has(e.id)) return;
        const id = typeof e.id === 'number' ? e.id : Date.now() + added;
        data.push({ id, type: e.type, scope: e.date.length === 7 ? 'month' : 'day', amount: e.amount, date: e.date, cat: e.cat || '', note: e.note || '' });
        ids.add(id); added++;
      });
      save();
      alert(`Đã thêm ${added} khoản.` + (skipped ? ` Bỏ qua ${skipped} khoản không hợp lệ.` : ''));
      render();
    } catch (err) {
      alert('Không đọc được file. Hãy chọn đúng file .json đã sao lưu từ app này.');
    }
  };
}

/* ===== Điều hướng & sự kiện ===== */
const TABS = [['day', 'Hôm nay'], ['month', 'Tháng'], ['year', 'Năm'], ['backup', 'Sao lưu']];
function render() {
  ({ day: viewDay, month: viewMonth, year: viewYear, backup: viewBackup })[S.tab]();
  $('nav').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('');
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-t],[data-s],[data-del],[data-edit],[data-cancel],[data-go],[data-m]');
  if (!t) return;
  const D = t.dataset;
  if (D.tab) { S.tab = D.tab; S.edit = null; }
  else if (D.t) S.type = D.t;
  else if (D.s) S.scope = D.s;
  else if (D.cancel) S.edit = null;
  else if (D.edit) {
    const en = data.find(x => x.id === +D.edit);
    if (!en) return;
    S.edit = en.id; S.type = en.type; S.scope = en.scope || 'day'; S.tab = 'day';
    if (en.date.length === 7) { S.month = en.date; S.year = +en.date.slice(0, 4); }
    else { S.day = en.date; S.month = en.date.slice(0, 7); S.year = +en.date.slice(0, 4); }
    scrollTo(0, 0);
  } else if (D.del) {
    if (!confirm('Xóa khoản này?')) return;
    data = data.filter(x => x.id !== +D.del);
    if (S.edit === +D.del) S.edit = null;
    save();
  } else if (D.go) { S.day = D.go; S.tab = 'day'; S.edit = null; }
  else if (D.m) { S.month = D.m; S.year = +D.m.slice(0, 4); S.tab = 'month'; }
  render();
});

/* ===== Cài ứng dụng ra màn hình chính ===== */
let deferredPrompt = null;
const standaloneQuery = matchMedia('(display-mode: standalone)');

function isInstalled() {
  return standaloneQuery.matches || navigator.standalone === true || localStorage.getItem(INSTALLED_KEY) === '1';
}
function updateInstallButton() { $('inst').hidden = isInstalled(); } // đã cài -> ẩn, chưa cài -> hiện

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  localStorage.removeItem(INSTALLED_KEY);
  updateInstallButton();
});
addEventListener('appinstalled', () => {
  localStorage.setItem(INSTALLED_KEY, '1');
  deferredPrompt = null;
  updateInstallButton();
});
standaloneQuery.addEventListener('change', updateInstallButton);

$('inst').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
    deferredPrompt = null;
    updateInstallButton();
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  alert(ios
    ? 'Trên iPhone: bấm nút Chia sẻ trong Safari, rồi chọn "Thêm vào MH chính".'
    : 'Mở menu ⋮ của trình duyệt, rồi chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".');
};

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

updateInstallButton();
render();
