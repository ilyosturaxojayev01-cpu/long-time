const express = require('express'), cors = require('cors'), crypto = require('crypto'), fs = require('fs');
const FILE = __dirname + '/data.json', H = 3600e3;
const SUPPLY_MS = 2 * H;   // zavoddan yetkazish: 2 soat
const GEN_MS = (+process.env.GEN_HOURS || 6) * H;      // do'konlardan so'rov: har 6 soatda
// Sergeli (ombor) dan tumanlargacha yo'l vaqti (daqiqa)
const DISTRICTS = { "Bektemir": 35, "Chilonzor": 25, "Mirobod": 30, "Mirzo Ulug'bek": 45, "Olmazor": 40, "Sergeli": 15,
  "Shayxontohur": 40, "Uchtepa": 35, "Yakkasaroy": 25, "Yashnobod": 60, "Yunusobod": 55, "Yangihayot": 30 };
// kategoriya: ["mahsulot|zavod narxi (ming so'm)"]
const CATS = {
  "Sichqoncha": ["Logitech G102|150", "Razer DeathAdder V3|1300", "A4Tech OP-620D|60", "Logitech MX Master 3S|1200", "HyperX Pulsefire Haste 2|650"],
  "Klaviatura": ["Logitech K120|90", "Redragon Kumara K552|350", "Keychron K2 V2|900", "HyperX Alloy Origins|1100", "A4Tech KR-85|80"],
  "Monitor": ["Samsung S24C 24\"|1500", "LG 27MP400 27\"|1900", "AOC 24G2 24\"|2100", "ASUS TUF VG27AQ 27\"|4200", "Xiaomi 27\" Monitor|1700"],
  "Videokarta": ["RTX 5060 Ti 16GB|6500", "RTX 5070 12GB|9500", "RTX 4060 8GB|4200", "Radeon RX 7600|3500", "GTX 1650 4GB|1800"],
  "Protsessor": ["Intel Core i5-14400F|2300", "Intel Core i7-14700K|6000", "AMD Ryzen 5 7600|2800", "AMD Ryzen 7 7800X3D|6200", "AMD Ryzen 5 5600|1500"],
  "Operativ xotira": ["Kingston Fury 16GB DDR4|450", "Corsair Vengeance 32GB DDR5|1600", "Samsung 8GB DDR4 SODIMM|250", "G.Skill Ripjaws 16GB DDR5|750", "Crucial 16GB DDR4 3200|420"],
  "Doimiy xotira": ["Samsung 980 1TB NVMe|1100", "Kingston NV2 500GB|550", "WD Blue 2TB HDD|900", "Seagate Barracuda 1TB|600", "Crucial MX500 1TB SATA|1000"],
  "Anakart": ["ASUS PRIME B760M|1800", "MSI B650 Tomahawk|3000", "Gigabyte B550M|1500", "ASRock H610M|1100", "MSI MAG Z790|4200"],
  "Quvvat bloki": ["Corsair CV550|600", "Deepcool PK650D|800", "Seasonic Focus 750W|1800", "Cooler Master MWE 600|650", "be quiet! Pure Power 12M 850W|2300"],
  "Korpus": ["NZXT H510|900", "Deepcool CC560|550", "Lian Li Lancool 216|1500", "Cooler Master NR200|1600", "Zalman S2|400"],
  "Sovutish tizimi": ["Deepcool AK400|400", "Noctua NH-D15|1900", "Arctic Liquid Freezer III 360|1700", "Cooler Master Hyper 212|350", "ID-Cooling SE-224|300"],
  "Quloqchin": ["HyperX Cloud II|900", "Logitech G435|700", "Razer BlackShark V2|1400", "JBL Quantum 100|450", "Sony WH-CH520|600"],
  "Veb-kamera": ["Logitech C270|300", "Logitech C920 HD Pro|800", "Razer Kiyo|1000", "Xiaomi 2K Web kamera|250", "Elgato Facecam|2500"],
  "Tarmoq uskunalari": ["TP-Link Archer C6|350", "Mikrotik hAP ax2|900", "Tenda AC10|300", "D-Link DIR-615|200", "TP-Link TL-SG108 svitch|250"],
  "Noutbuk": ["Lenovo IdeaPad 3|5500", "ASUS TUF F15|11000", "HP 250 G9|4800", "Acer Aspire 5|5200", "MSI Thin GF63|8500"],
  "Printer va skaner": ["HP LaserJet M111w|1300", "Canon PIXMA G3411|1900", "Epson L3250|2300", "Brother HL-L2340DW|1800", "Canon LiDE 300 skaner|1100"],
  "Flesh va xotira kartalari": ["Kingston DataTraveler 64GB|70", "SanDisk Ultra 128GB|110", "Samsung EVO microSD 128GB|150", "SanDisk Extreme 256GB|380", "Transcend 32GB|50"],
  "Kabel va adapterlar": ["HDMI 2.1 kabel 2m|60", "DisplayPort 1.4 kabel|80", "USB-C hub 7-in-1|250", "USB 3.0 uzaytirgich|40", "Ethernet Cat6 5m|30"]
};
const hash = p => crypto.createHash('sha256').update('ombor:' + p).digest('hex');
const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const now = () => new Date().toISOString();
let db;
const save = () => fs.writeFileSync(FILE, JSON.stringify(db));
const nid = k => (db.seq[k] = (db.seq[k] || 0) + 1);
const log = (text, type = 'tizim', by = 'tizim') => { db.events.unshift({ id: nid('ev'), at: now(), type, text, by }); db.events = db.events.slice(0, 1000); };
const som = n => Number(n).toLocaleString('ru-RU') + " so'm";
const ledger = (type, p, qty, unit, ref, at = now()) => db.tx.unshift({ id: nid('tx'), at, type, productId: p.id, name: p.name, qty, unit, total: qty * unit, ref });

function seed() {
  db = { seq: {}, users: [], cats: [], products: [], stores: [], requests: [], supplies: [], tx: [], events: [], lastGen: 0 };
  const mk = (login, pw, name, role) => db.users.push({ id: nid('u'), login, pass: hash(pw), name, role, createdAt: now() });
  mk('admin', 'admin123', 'Bosh administrator', 'administrator');
  mk('xodim', 'xodim123', 'Omborchi xodim', 'xodim');
  for (const [c, items] of Object.entries(CATS)) {
    const cat = { id: nid('c'), name: c }; db.cats.push(cat);
    for (const s of items) {
      const [name, k] = s.split('|'), cost = k * 1000;
      const p = { id: nid('p'), name, categoryId: cat.id, cost, price: Math.round(cost * 1.2 / 1000) * 1000, stock: 12 + rnd(30) };
      db.products.push(p); ledger('kirim', p, p.stock, cost, "Boshlang'ich qoldiq");
    }
  }
  // grafik uchun demo tarix (qoldiqqa ta'sir qilmaydi)
  for (let d = 1; d <= 13; d++) for (let i = 0; i < 5; i++) {
    const p = pick(db.products), at = new Date(Date.now() - d * 24 * H - rnd(10) * H).toISOString();
    ledger(i < 2 ? 'kirim' : 'chiqim', p, 2 + rnd(10), i < 2 ? p.cost : p.price, 'Demo tarix', at);
  }
  Object.keys(DISTRICTS).forEach(d => db.stores.push({ id: nid('s'), name: d + " kompyuter do'koni", district: d }));
  log("Tizim ishga tushirildi, boshlang'ich qoldiq kiritildi");
  genRequests();
}
function genRequests() {
  db.stores.forEach(s => {
    const cat = pick(db.cats), list = db.products.filter(p => p.categoryId === cat.id);
    const items = shuffle(list).slice(0, 1 + rnd(3)).map(p => ({ productId: p.id, name: p.name, qty: 1 + rnd(8), unit: p.price }));
    db.requests.unshift({ id: nid('r'), storeId: s.id, store: s.name, district: s.district, category: cat.name, items,
      total: items.reduce((a, i) => a + i.qty * i.unit, 0), status: 'kutilmoqda', createdAt: now() });
  });
  db.lastGen = Date.now(); log("12 ta do'kondan yangi mahsulot so'rovlari keldi", 'buyurtma');
}
function tick() {
  let ch = false; const t = Date.now();
  db.requests.forEach(r => { if (r.status === 'yolda' && Date.parse(r.etaAt) <= t) {
    r.status = 'yetkazildi'; r.deliveredAt = now(); log(`#${r.id} buyurtma ${r.store}ga yetkazildi`, 'yetkazildi'); ch = true; } });
  db.supplies.forEach(s => { if (s.status === 'buyurtma berildi' && Date.parse(s.etaAt) <= t) {
    let p = db.products.find(x => x.id === s.productId);
    if (!p) { p = db.products.find(x => x.categoryId === s.categoryId && x.name.toLowerCase() === s.name.toLowerCase());
      if (!p) { p = { id: nid('p'), name: s.name, categoryId: s.categoryId, cost: s.unit, price: Math.round(s.unit * 1.2 / 100) * 100, stock: 0 }; db.products.push(p); }
      s.productId = p.id; } s.status = 'qabul qilindi'; s.receivedAt = now(); p.stock += s.qty;
    ledger('kirim', p, s.qty, s.unit, "Zavoddan ta'minot #" + s.id);
    log(`Zavoddan ${s.qty} ta "${p.name}" omborga keldi`, 'kirim'); ch = true; } });
  if (t - db.lastGen >= GEN_MS) { genRequests(); ch = true; }
  if (ch) save();
}

if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8')); else { seed(); save(); }
db.secret = db.secret || crypto.randomBytes(24).toString('hex'); save();
setInterval(tick, 15000);

const sign = id => { const b = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 24 * H })).toString('base64url'); return b + '.' + crypto.createHmac('sha256', db.secret).update(b).digest('base64url'); };
const verify = t => { const [b, sg] = (t || '').split('.'); if (!b || !sg || sg !== crypto.createHmac('sha256', db.secret).update(b).digest('base64url')) return null;
  try { const d = JSON.parse(Buffer.from(b, 'base64url').toString()); return d.exp > Date.now() ? d.id : null; } catch (e) { return null; } };
const app = express();
app.use(cors()); app.use(express.json());
const pub = u => ({ id: u.id, login: u.login, name: u.name, role: u.role, createdAt: u.createdAt });

app.post('/api/login', (req, res) => {
  const { login, password } = req.body || {};
  const u = db.users.find(x => x.login === login && x.pass === hash(password || ''));
  if (!u) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  const token = sign(u.id);
  log(`${u.name} tizimga kirdi`, 'kirish', u.name); save(); res.json({ token, user: pub(u) });
});
app.use('/api', (req, res, next) => {
  const u = db.users.find(x => x.id === verify((req.headers.authorization || '').slice(7)));
  if (!u) return res.status(401).json({ error: 'Kirish talab qilinadi' });
  req.user = u; next();
});
const admin = (req, res, next) => req.user.role === 'administrator' ? next() : res.status(403).json({ error: 'Faqat administrator uchun' });

app.get('/api/categories', (q, r) => r.json(db.cats));
app.get('/api/products', (q, r) => r.json(db.products.map(p => ({ ...p, category: db.cats.find(c => c.id === p.categoryId).name }))));
app.get('/api/transactions', (q, r) => r.json(db.tx.slice(0, 500)));
app.get('/api/events', (q, r) => r.json(db.events.slice(0, 300)));
app.get('/api/supplies', admin, (q, r) => r.json(db.supplies));
app.get('/api/requests', (q, r) => r.json(db.requests.slice(0, 200)));
app.get('/api/staff', admin, (q, r) => r.json(db.users.map(pub)));

app.post('/api/staff', admin, (req, res) => {
  const { name, login, password, role } = req.body || {};
  if (!name || !login || !password || password.length < 4) return res.status(400).json({ error: "Barcha maydonlarni to'ldiring (parol kamida 4 belgi)" });
  if (!['xodim', 'administrator'].includes(role)) return res.status(400).json({ error: "Rol noto'g'ri" });
  if (db.users.some(u => u.login === login)) return res.status(400).json({ error: 'Bu login band' });
  const u = { id: nid('u'), login, pass: hash(password), name, role, createdAt: now() };
  db.users.push(u); log(`Yangi xodim qo'shildi: ${name} (${role})`, 'xodim', req.user.name); save(); res.json(pub(u));
});
app.post('/api/products', (req, res) => {
  const { name, categoryId, cost, price, stock } = req.body || {};
  const cat = db.cats.find(c => c.id === +categoryId);
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Mahsulot nomini kiriting' });
  if (!cat) return res.status(400).json({ error: 'Kategoriyani tanlang' });
  if (!(+cost > 0)) return res.status(400).json({ error: "Zavod narxini to'g'ri kiriting" });
  const nm = String(name).trim();
  if (db.products.some(p => p.categoryId === cat.id && p.name.toLowerCase() === nm.toLowerCase())) return res.status(400).json({ error: 'Bu mahsulot shu kategoriyada allaqachon mavjud' });
  const p = { id: nid('p'), name: nm, categoryId: cat.id, cost: +cost, price: +price > 0 ? +price : Math.round(+cost * 1.2 / 100) * 100, stock: Math.max(0, Math.floor(+stock) || 0) };
  db.products.push(p);
  if (p.stock > 0) ledger('kirim', p, p.stock, p.cost, "Yangi mahsulot qo'shildi");
  log(`Yangi mahsulot qo'shildi: "${p.name}" (${cat.name}), ${p.stock} ta, zavod narxi ${som(p.cost)}`, 'mahsulot', req.user.name);
  save(); res.json(p);
});
// Administrator xohlagan vaqt mavjud yoki yangi (katalogda yo'q) mahsulotni zavoddan buyurtma qiladi
app.post('/api/supplies', admin, (req, res) => {
  const list = [];
  for (const i of (req.body && req.body.items) || []) {
    const qty = Math.floor(+i.qty); if (!(qty > 0)) continue;
    if (i.productId) { const p = db.products.find(x => x.id === +i.productId); if (p) list.push({ productId: p.id, name: p.name, categoryId: p.categoryId, unit: p.cost, qty }); }
    else if (i.newName && String(i.newName).trim() && db.cats.some(c => c.id === +i.categoryId) && +i.cost > 0)
      list.push({ productId: null, name: String(i.newName).trim(), categoryId: +i.categoryId, unit: +i.cost, qty, isNew: true });
  }
  if (!list.length) return res.status(400).json({ error: 'Mahsulot va uning sonini kiriting' });
  const etaAt = new Date(Date.now() + SUPPLY_MS).toISOString(); let total = 0;
  list.forEach(x => { db.supplies.unshift({ id: nid('sp'), ...x, total: x.qty * x.unit, status: 'buyurtma berildi', createdAt: now(), etaAt, by: req.user.name }); total += x.qty * x.unit; });
  log(`Ta'minot: zavoddan ${list.length} xil mahsulot buyurtma qilindi (${som(total)}), 2 soatda keladi`, "ta'minot", req.user.name);
  save(); res.json({ ok: true });
});
// ---- Administrator: mahsulot va xodimlarni o'zgartirish / o'chirish, buyurtmani bekor qilish ----
app.put('/api/products/:id', admin, (req, res) => {
  const p = db.products.find(x => x.id === +req.params.id); if (!p) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  const { name, categoryId, cost, price, stock } = req.body || {}, cat = db.cats.find(c => c.id === +categoryId);
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Mahsulot nomini kiriting' });
  if (!cat) return res.status(400).json({ error: 'Kategoriyani tanlang' });
  if (!(+cost > 0) || !(+price > 0)) return res.status(400).json({ error: "Zavod va sotuv narxini to'g'ri kiriting" });
  if (stock === '' || !(+stock >= 0)) return res.status(400).json({ error: "Qoldiq soni noto'g'ri" });
  const nm = String(name).trim();
  if (db.products.some(x => x.id !== p.id && x.categoryId === cat.id && x.name.toLowerCase() === nm.toLowerCase())) return res.status(400).json({ error: 'Bu mahsulot shu kategoriyada allaqachon mavjud' });
  const old = { ...p };
  Object.assign(p, { name: nm, categoryId: cat.id, cost: +cost, price: +price, stock: Math.floor(+stock) });
  log(`Mahsulot o'zgartirildi: "${old.name}" → "${p.name}" (qoldiq ${old.stock}→${p.stock}, zavod narxi ${som(old.cost)}→${som(p.cost)}, sotuv narxi ${som(old.price)}→${som(p.price)})`, 'mahsulot', req.user.name);
  save(); res.json(p);
});
app.delete('/api/products/:id', admin, (req, res) => {
  const i = db.products.findIndex(x => x.id === +req.params.id); if (i < 0) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  const p = db.products[i];
  if (db.requests.some(r => r.status === 'kutilmoqda' && r.items.some(it => it.productId === p.id))) return res.status(400).json({ error: "Bu mahsulot kutilayotgan do'kon so'rovida bor. Avval so'rovni tasdiqlang yoki rad eting" });
  if (db.supplies.some(s => s.productId === p.id && s.status === 'buyurtma berildi')) return res.status(400).json({ error: "Bu mahsulot zavodga buyurtma qilingan. Avval buyurtmani bekor qiling" });
  db.products.splice(i, 1);
  log(`Mahsulot o'chirildi: "${p.name}" (qoldiq: ${p.stock} ta)`, 'mahsulot', req.user.name); save(); res.json({ ok: true });
});
app.put('/api/staff/:id', admin, (req, res) => {
  const u = db.users.find(x => x.id === +req.params.id); if (!u) return res.status(404).json({ error: 'Xodim topilmadi' });
  const { name, login, password, role } = req.body || {};
  if (!name || !String(name).trim() || !login || !String(login).trim()) return res.status(400).json({ error: 'Ism va loginni kiriting' });
  if (!['xodim', 'administrator'].includes(role)) return res.status(400).json({ error: "Rol noto'g'ri" });
  if (password && password.length < 4) return res.status(400).json({ error: 'Parol kamida 4 belgi bo\'lsin' });
  if (db.users.some(x => x.id !== u.id && x.login === String(login).trim())) return res.status(400).json({ error: 'Bu login band' });
  if (u.role === 'administrator' && role !== 'administrator' && db.users.filter(x => x.role === 'administrator').length < 2)
    return res.status(400).json({ error: "Oxirgi administratorning rolini o'zgartirib bo'lmaydi" });
  Object.assign(u, { name: String(name).trim(), login: String(login).trim(), role }); if (password) u.pass = hash(password);
  log(`Xodim ma'lumoti o'zgartirildi: ${u.name} (${u.role})${password ? ', parol yangilandi' : ''}`, 'xodim', req.user.name); save(); res.json(pub(u));
});
app.delete('/api/staff/:id', admin, (req, res) => {
  const u = db.users.find(x => x.id === +req.params.id); if (!u) return res.status(404).json({ error: 'Xodim topilmadi' });
  if (u.id === req.user.id) return res.status(400).json({ error: "O'zingizni o'chirib bo'lmaydi" });
  if (u.role === 'administrator' && db.users.filter(x => x.role === 'administrator').length < 2) return res.status(400).json({ error: "Oxirgi administratorni o'chirib bo'lmaydi" });
  db.users = db.users.filter(x => x.id !== u.id);
  log(`Xodim o'chirildi: ${u.name} (${u.login})`, 'xodim', req.user.name); save(); res.json({ ok: true });
});
app.post('/api/supplies/:id/cancel', admin, (req, res) => {
  const sp = db.supplies.find(x => x.id === +req.params.id);
  if (!sp) return res.status(404).json({ error: 'Buyurtma topilmadi' });
  if (sp.status !== 'buyurtma berildi') return res.status(400).json({ error: "Bu buyurtmani bekor qilib bo'lmaydi (holati: " + sp.status + ')' });
  sp.status = 'bekor qilindi'; sp.cancelledAt = now();
  log(`Zavodga berilgan buyurtma #${sp.id} bekor qilindi: ${sp.qty} ta "${sp.name}" (${som(sp.total)})`, "ta'minot", req.user.name); save(); res.json(sp);
});
app.post('/api/requests/:id/approve', admin, (req, res) => {
  const r = db.requests.find(x => x.id === +req.params.id);
  if (!r || r.status !== 'kutilmoqda') return res.status(400).json({ error: "So'rov topilmadi yoki allaqachon ko'rib chiqilgan" });
  for (const i of r.items) { const p = db.products.find(x => x.id === i.productId);
    if (!p) return res.status(400).json({ error: `Mahsulot o'chirilgan: ${i.name}` });
    if (p.stock < i.qty) return res.status(400).json({ error: `Omborda "${p.name}" yetarli emas (bor: ${p.stock}, kerak: ${i.qty})` }); }
  for (const i of r.items) { const p = db.products.find(x => x.id === i.productId); p.stock -= i.qty; ledger('chiqim', p, i.qty, i.unit, `#${r.id} - ${r.store}`); }
  const min = DISTRICTS[r.district]; r.status = 'yolda'; r.approvedAt = now(); r.etaMinutes = min; r.etaAt = new Date(Date.now() + min * 60000).toISOString();
  log(`#${r.id} buyurtma tasdiqlandi, ${r.store}ga yo'lga chiqdi (taxminan ${min} daqiqa, ${som(r.total)})`, 'tasdiq', req.user.name);
  save(); res.json(r);
});
app.post('/api/requests/:id/reject', admin, (req, res) => {
  const r = db.requests.find(x => x.id === +req.params.id);
  if (!r || r.status !== 'kutilmoqda') return res.status(400).json({ error: "So'rov topilmadi yoki allaqachon ko'rib chiqilgan" });
  r.status = 'rad etildi'; r.rejectedAt = now(); log(`#${r.id} buyurtma (${r.store}) rad etildi`, 'rad', req.user.name); save(); res.json(r);
});
app.get('/api/reports', admin, (req, res) => {
  const days = Math.min(+req.query.days || 14, 90), out = [];
  for (let d = days - 1; d >= 0; d--) out.push({ date: new Date(Date.now() + 5 * H - d * 24 * H).toISOString().slice(0, 10), kirim: 0, chiqim: 0 });
  db.tx.forEach(t => { const row = out.find(o => o.date === new Date(Date.parse(t.at) + 5 * H).toISOString().slice(0, 10)); if (row) row[t.type] += t.total; });
  res.json(out);
});
app.get('/api/dashboard', admin, (req, res) => {
  const today = new Date(Date.now() + 5 * H).toISOString().slice(0, 10), sumT = type => db.tx.filter(t => t.type === type && new Date(Date.parse(t.at) + 5 * H).toISOString().slice(0, 10) === today).reduce((a, t) => a + t.total, 0);
  res.json({
    products: db.products.length, categories: db.cats.length, staff: db.users.length,
    stockValue: db.products.reduce((a, p) => a + p.stock * p.cost, 0),
    pending: db.requests.filter(r => r.status === 'kutilmoqda').length, onTheWay: db.requests.filter(r => r.status === 'yolda').length,
    openSupplies: db.supplies.filter(s => s.status === 'buyurtma berildi').length,
    todayKirim: sumT('kirim'), todayChiqim: sumT('chiqim'),
    low: db.products.slice().sort((a, b) => a.stock - b.stock).slice(0, 8),
    events: db.events.slice(0, 8)
  });
});
app.use('/api', (req, res) => res.status(404).json({ error: `Server yo'li topilmadi (${req.method} ${req.originalUrl}). Serverni to'xtatib, qayta ishga tushiring: npm start` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server xatosi: ' + err.message }); });
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ombor serveri ${PORT} portida ishlayapti`);
});
