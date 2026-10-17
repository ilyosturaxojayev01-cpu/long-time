import React, { useState, useEffect, useCallback } from 'react';

const TZ = 'Asia/Tashkent'; // UTC+5
const fmt = iso => iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: TZ, hour12: false }) : '—';
const som = n => Number(n || 0).toLocaleString('ru-RU') + " so'm";
const left = iso => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
const ST = { kutilmoqda: 'Kutilmoqda', yolda: "Buyurtma yo'lda", yetkazildi: 'Yetkazildi', 'rad etildi': 'Rad etildi' };

async function api(path, method = 'GET', body) {
  let r;
  try { r = await fetch('https://long-time-4.onrender.com/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') }, body: body && JSON.stringify(body) }); }
  catch (e) { throw new Error("Serverga ulanib bo'lmadi. Server (npm start) ishlayaptimi?"); }
  const d = await r.json().catch(() => null);
  if (r.status === 401 && path !== '/login') { localStorage.clear(); location.reload(); }
  if (!r.ok) throw new Error((d && d.error) || `Server xatosi (${r.status}). Serverni to'xtatib, qayta ishga tushiring.`);
  return d;
}
function useData(path, ms = 10000) {
  const [d, setD] = useState(null);
  const load = useCallback(() => api(path).then(setD).catch(() => {}), [path]);
  useEffect(() => { load(); const t = setInterval(load, ms); return () => clearInterval(t); }, [load, ms]);
  return [d, load];
}

function Login({ onLogin }) {
  const [f, setF] = useState({ login: '', password: '' }), [err, setErr] = useState('');
  const go = async () => {
    try { const d = await api('/login', 'POST', f); localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); onLogin(d.user); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="loginwrap"><div className="card login">
      <h2>📦 Ombor tizimi</h2>
      <input placeholder="Login" value={f.login} onChange={e => setF({ ...f, login: e.target.value })} />
      <input type="password" placeholder="Parol" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && go()} />
      {err && <div className="err">{err}</div>}
      <button className="b" style={{ width: '100%' }} onClick={go}>Kirish</button>
    </div></div>
  );
}

function BarChart({ data }) {
  const W = 760, Hh = 240, pad = 40, max = Math.max(1, ...data.flatMap(d => [d.kirim, d.chiqim]));
  const bw = (W - pad) / data.length;
  return (
    <div className="tw"><svg viewBox={`0 0 ${W} ${Hh + 30}`} style={{ width: '100%', minWidth: 560 }}>
      {[0, .5, 1].map(k => <g key={k}><line x1={pad} x2={W} y1={Hh - k * (Hh - 10)} y2={Hh - k * (Hh - 10)} stroke="#94a3b8" opacity=".3" />
        <text x="0" y={Hh - k * (Hh - 10) + 4} fontSize="10" fill="#66708a">{Math.round(max * k / 1e6)}M</text></g>)}
      {data.map((d, i) => { const h1 = d.kirim / max * (Hh - 10), h2 = d.chiqim / max * (Hh - 10), x = pad + i * bw;
        return <g key={d.date}><rect x={x + 3} y={Hh - h1} width={bw / 2 - 4} height={h1} rx="3" fill="#22c55e"><title>{d.date} kirim: {som(d.kirim)}</title></rect>
          <rect x={x + bw / 2} y={Hh - h2} width={bw / 2 - 4} height={h2} rx="3" fill="#f43f5e"><title>{d.date} chiqim: {som(d.chiqim)}</title></rect>
          <text x={x + bw / 2} y={Hh + 14} fontSize="9" textAnchor="middle" fill="#66708a">{d.date.slice(5)}</text></g>; })}
    </svg></div>
  );
}

function Dashboard({ user }) {
  const [s] = useData('/dashboard'), [rep] = useData('/reports?days=14', 30000);
  if (!s) return <p>Yuklanmoqda...</p>;
  const st = [['📦 Mahsulotlar', s.products], ['🗂 Kategoriyalar', s.categories], ['👥 Xodimlar', s.staff], ['💰 Ombor qiymati', som(s.stockValue)],
    ['⬇️ Bugungi kirim', som(s.todayKirim)], ['⬆️ Bugungi chiqim', som(s.todayChiqim)], ["🔔 Kutilayotgan so'rovlar", s.pending],
    ["🚚 Yo'ldagi buyurtmalar", s.onTheWay], ["🏭 Ta'minotdagi buyurtmalar", s.openSupplies]];
  return <>
    <div className="hero"><h2>Xush kelibsiz, {user.name}!</h2><div>Toshkent vaqti (UTC+5): {fmt(new Date().toISOString())}</div></div>
    <div className="grid">{st.map(([a, b], i) => <div className={'stat g' + (i % 9)} key={a}><small>{a}</small><b>{b}</b></div>)}</div>
    <div className="card accent"><b>Kirim va chiqim (oxirgi 14 kun, so'm)</b>
      <span className="leg"><span style={{ background: '#22c55e' }} />Kirim<span style={{ background: '#f43f5e' }} />Chiqim</span>
      {rep && <BarChart data={rep} />}</div>
    <div className="card"><b>Qoldig'i eng kam mahsulotlar</b><div className="tw"><table><thead><tr><th>Mahsulot</th><th>Qoldiq</th></tr></thead>
      <tbody>{s.low.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.stock}</td></tr>)}</tbody></table></div></div>
    <div className="card"><b>So'nggi hodisalar</b><Events list={s.events} /></div>
  </>;
}

function AddProduct({ cats, done }) {
  const empty = { name: '', categoryId: '', cost: '', price: '', stock: '' };
  const [f, setF] = useState(empty), [err, setErr] = useState(''), [ok, setOk] = useState(''), set = k => e => setF({ ...f, [k]: e.target.value });
  const add = async () => {
    setErr(''); setOk('');
    if (!f.name.trim()) return setErr('Mahsulot nomini kiriting');
    if (!f.categoryId) return setErr('Kategoriyani tanlang');
    if (!(+f.cost > 0)) return setErr("Zavod narxini to'g'ri kiriting");
    try { const p = await api('/products', 'POST', f); setOk(`"${p.name}" qo'shildi`); setF(empty); done(); } catch (e) { setErr(e.message); }
  };
  return <div className="card accent"><b>➕ Yangi mahsulot qo'shish</b><div className="row" style={{ marginTop: 10 }}>
    <input placeholder="Mahsulot nomi" value={f.name} onChange={set('name')} />
    <select value={f.categoryId} onChange={set('categoryId')}><option value="">Kategoriya tanlang</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <input type="number" placeholder="Zavod narxi (so'm)" value={f.cost} onChange={set('cost')} />
    <input type="number" placeholder="Sotuv narxi (ixtiyoriy)" value={f.price} onChange={set('price')} />
    <input type="number" placeholder="Boshlang'ich soni" value={f.stock} onChange={set('stock')} />
    <button className="b" onClick={add}>Qo'shish</button></div>{err && <div className="err">{err}</div>}{ok && <div style={{ color: 'var(--ok)' }}>✅ {ok}</div>}</div>;
}

function EditProduct({ p, cats, done, cancel }) {
  const [f, setF] = useState({ name: p.name, categoryId: p.categoryId, cost: p.cost, price: p.price, stock: p.stock }), [err, setErr] = useState(''), set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { setErr(''); await api('/products/' + p.id, 'PUT', f); done(); } catch (e) { setErr(e.message); } };
  return <div className="card warn"><b>✏️ Mahsulotni o'zgartirish</b><div className="row" style={{ marginTop: 10 }}>
    <label className="clock">Nomi<br /><input value={f.name} onChange={set('name')} /></label>
    <label className="clock">Kategoriya<br /><select value={f.categoryId} onChange={set('categoryId')}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="clock">Zavod narxi<br /><input type="number" value={f.cost} onChange={set('cost')} /></label>
    <label className="clock">Sotuv narxi<br /><input type="number" value={f.price} onChange={set('price')} /></label>
    <label className="clock">Qoldiq<br /><input type="number" value={f.stock} onChange={set('stock')} /></label></div>
    <div className="row"><button className="b ok" onClick={save}>Saqlash</button><button className="b" onClick={cancel}>Bekor qilish</button></div>{err && <div className="err">{err}</div>}</div>;
}

function Products({ user }) {
  const [list, load] = useData('/products'), [cats] = useData('/categories', 60000);
  const [cat, setCat] = useState(''), [q, setQ] = useState(''), [show, setShow] = useState(false), [edit, setEdit] = useState(null), [err, setErr] = useState('');
  const isAdmin = user.role === 'administrator';
  if (!list || !cats) return <p>Yuklanmoqda...</p>;
  const del = async p => {
    if (!window.confirm(`"${p.name}" o'chirilsinmi?`)) return;
    try { setErr(''); await api('/products/' + p.id, 'DELETE'); load(); } catch (e) { setErr(e.message); }
  };
  const shown = cats.filter(c => !cat || c.id === +cat);
  return <>
    <div className="row"><button className="b ok" onClick={() => setShow(!show)}>{show ? 'Yopish' : "➕ Yangi mahsulot"}</button>
      <select value={cat} onChange={e => setCat(e.target.value)}><option value="">Barcha kategoriyalar ({cats.length})</option>
        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input placeholder="Qidirish..." value={q} onChange={e => setQ(e.target.value)} /></div>
    {show && <AddProduct cats={cats} done={load} />}
    {edit && <EditProduct key={edit.id} p={edit} cats={cats} cancel={() => setEdit(null)} done={() => { setEdit(null); load(); }} />}
    {err && <div className="err">{err}</div>}
    {shown.map(c => { const ps = list.filter(p => p.categoryId === c.id && p.name.toLowerCase().includes(q.toLowerCase())); if (!ps.length) return null;
      return <div className="card" key={c.id}><b>{c.name}</b> <span className="tag">{ps.length} ta</span><div className="tw"><table>
        <thead><tr><th>Mahsulot</th><th>Zavod narxi</th><th>Sotuv narxi</th><th>Qoldiq</th><th>Qiymati</th>{isAdmin && <th>Amallar</th>}</tr></thead>
        <tbody>{ps.map(p => <tr key={p.id}><td>{p.name}</td><td>{som(p.cost)}</td><td>{som(p.price)}</td><td>{p.stock}</td><td>{som(p.stock * p.cost)}</td>
          {isAdmin && <td style={{ whiteSpace: 'nowrap' }}><button className="b warn" onClick={() => { setEdit(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️ O'zgartirish</button>{' '}
            <button className="b bad" onClick={() => del(p)}>🗑 O'chirish</button></td>}</tr>)}</tbody></table></div></div>; })}
  </>;
}

function TxPage({ type }) {
  const [list] = useData('/transactions'), [q, setQ] = useState('');
  if (!list) return <p>Yuklanmoqda...</p>;
  const rows = list.filter(x => x.type === type && x.name.toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((a, x) => a + x.total, 0), qty = rows.reduce((a, x) => a + x.qty, 0);
  return <>
    <div className="grid"><div className={'stat ' + (type === 'kirim' ? 'g4' : 'g5')}><small>Jami {type} summasi</small><b>{som(total)}</b></div>
      <div className={'stat ' + (type === 'kirim' ? 'g2' : 'g3')}><small>Jami mahsulot soni</small><b>{qty} ta</b></div></div>
    <div className="row"><input placeholder="Mahsulot bo'yicha qidirish..." value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="card tw"><table><thead><tr><th>Sana (UTC+5)</th><th>Mahsulot</th><th>Soni</th><th>Narxi</th><th>Jami</th><th>Izoh</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.id}><td>{fmt(x.at)}</td><td>{x.name}</td><td>{x.qty}</td><td>{som(x.unit)}</td><td>{som(x.total)}</td><td>{x.ref}</td></tr>)}</tbody></table></div>
  </>;
}

// Administrator: kategoriya -> mahsulot (yoki yangi mahsulot) -> soni -> zavodga buyurtma
function OrderForm({ cats, prods, done }) {
  const [cat, setCat] = useState(''), [sel, setSel] = useState(''), [qty, setQty] = useState(''), [nn, setNn] = useState({ name: '', cost: '' }), [lines, setLines] = useState([]), [err, setErr] = useState('');
  const list = prods.filter(p => p.categoryId === +cat), isNew = sel === 'new';
  const addLine = () => {
    const n = Math.floor(+qty);
    if (!cat || !sel || !(n > 0)) return setErr('Kategoriya, mahsulot va sonini kiriting');
    if (isNew) {
      if (!nn.name.trim() || !(+nn.cost > 0)) return setErr('Yangi mahsulot nomi va zavod narxini kiriting');
      setLines([...lines, { key: 'n' + Date.now(), isNew: true, name: nn.name.trim(), categoryId: +cat, cost: +nn.cost, qty: n }]); setNn({ name: '', cost: '' });
    } else {
      const p = prods.find(x => x.id === +sel);
      setLines([...lines.filter(l => l.productId !== p.id), { key: 'p' + p.id, productId: p.id, name: p.name, cost: p.cost, qty: n }]);
    }
    setErr(''); setSel(''); setQty('');
  };
  const total = lines.reduce((a, l) => a + l.qty * l.cost, 0);
  const send = async () => {
    try {
      await api('/supplies', 'POST', { items: lines.map(l => l.isNew ? { newName: l.name, categoryId: l.categoryId, cost: l.cost, qty: l.qty } : { productId: l.productId, qty: l.qty }) });
      setLines([]); setErr(''); done();
    } catch (e) { setErr(e.message); }
  };
  return <div style={{ marginTop: 10 }}>
    <div className="row">
      <select value={cat} onChange={e => { setCat(e.target.value); setSel(''); }}><option value="">1. Kategoriyani tanlang</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={sel} onChange={e => setSel(e.target.value)} disabled={!cat}><option value="">2. Mahsulotni tanlang</option>
        <option value="new">➕ Yangi mahsulot (ro'yxatda yo'q)</option>
        {list.map(p => <option key={p.id} value={p.id}>{p.name} (qoldiq: {p.stock})</option>)}</select>
      {isNew && <><input placeholder="Yangi mahsulot nomi" value={nn.name} onChange={e => setNn({ ...nn, name: e.target.value })} />
        <input type="number" placeholder="Zavod narxi (so'm)" value={nn.cost} onChange={e => setNn({ ...nn, cost: e.target.value })} /></>}
      <input type="number" min="1" placeholder="3. Soni" style={{ width: 100 }} value={qty} onChange={e => setQty(e.target.value)} />
      <button className="b warn" onClick={addLine}>Qo'shish</button></div>
    {lines.length > 0 && <div className="tw"><table><thead><tr><th>Mahsulot</th><th>Soni</th><th>Zavod narxi</th><th>Jami</th><th></th></tr></thead>
      <tbody>{lines.map(l => <tr key={l.key}><td>{l.name}{l.isNew && ' 🆕'}</td><td>{l.qty}</td><td>{som(l.cost)}</td><td>{som(l.qty * l.cost)}</td>
        <td><button className="b bad" onClick={() => setLines(lines.filter(x => x.key !== l.key))}>✕</button></td></tr>)}</tbody></table>
      <p><b>Umumiy buyurtma: {som(total)}</b> · yetkazish ~2 soat</p>
      <button className="b ok" onClick={send}>🏭 Zavodga buyurtma berish</button></div>}
    {err && <div className="err">{err}</div>}
  </div>;
}

function Messages({ user }) {
  const [reqs, loadR] = useData('/requests', 8000), [err, setErr] = useState('');
  const isAdmin = user.role === 'administrator';
  const act = async (id, a) => { try { setErr(''); await api(`/requests/${id}/${a}`, 'POST'); loadR(); } catch (e) { setErr(e.message); } };
  if (!reqs) return <p>Yuklanmoqda...</p>;
  return <>
    <p className="clock">Do'konlardan so'rovlar har 6 soatda avtomatik keladi.</p>
    {err && <div className="err">{err}</div>}
    {reqs.map(r => <div className="card" key={r.id}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}><b>#{r.id} — {r.store}</b><span className={'tag ' + (r.status === 'rad etildi' ? 'rad' : r.status)}>{ST[r.status]}</span></div>
      <div className="clock">Kategoriya: {r.category} · Yuborildi: {fmt(r.createdAt)}</div>
      <div className="tw"><table><thead><tr><th>Mahsulot</th><th>Soni</th><th>Narxi</th><th>Jami</th></tr></thead>
        <tbody>{r.items.map(i => <tr key={i.productId}><td>{i.name}</td><td>{i.qty}</td><td>{som(i.unit)}</td><td>{som(i.qty * i.unit)}</td></tr>)}</tbody></table></div>
      <p><b>Umumiy: {som(r.total)}</b></p>
      {r.status === 'kutilmoqda' && isAdmin && <div className="row"><button className="b ok" onClick={() => act(r.id, 'approve')}>Tasdiqlash</button><button className="b bad" onClick={() => act(r.id, 'reject')}>Rad etish</button></div>}
      {r.status === 'yolda' && <p>🚚 <b>Buyurtma yo'lda</b> — Sergeli ombordan {r.district}ga taxminan {r.etaMinutes} daqiqa. Yetib borishi: {fmt(r.etaAt)} (qoldi ~{left(r.etaAt)} daq.)</p>}
      {r.status === 'yetkazildi' && <p>✅ Yetkazildi: {fmt(r.deliveredAt)}</p>}
    </div>)}
  </>;
}

function Supplies() {
  const [list, load] = useData('/supplies', 8000), [cats] = useData('/categories', 60000), [prods, loadP] = useData('/products', 15000), [err, setErr] = useState('');
  if (!list || !cats || !prods) return <p>Yuklanmoqda...</p>;
  const cancel = async s => {
    if (!window.confirm(`#${s.id} buyurtma (${s.qty} ta ${s.name}) bekor qilinsinmi?`)) return;
    try { setErr(''); await api(`/supplies/${s.id}/cancel`, 'POST'); load(); } catch (e) { setErr(e.message); }
  };
  const cls = st => st === 'qabul qilindi' ? 'yetkazildi' : st === 'bekor qilindi' ? 'rad' : 'yolda';
  return <>
    <div className="card accent"><b>🏭 Zavodga yangi buyurtma</b> <span className="clock">(istalgan vaqtda, mavjud yoki yangi mahsulot)</span>
      <OrderForm cats={cats} prods={prods} done={() => { load(); loadP(); }} /></div>
    {err && <div className="err">{err}</div>}
    <div className="card tw"><p className="clock">Zavoddan yetkazish vaqti: 2 soat. Mahsulot kelguncha buyurtmani bekor qilish mumkin. Yangi mahsulot kelganda ro'yxatga avtomatik qo'shiladi.</p>
      <table><thead><tr><th>#</th><th>Mahsulot</th><th>Soni</th><th>Zavod narxi</th><th>Jami</th><th>Holat</th><th>Buyurtma vaqti</th><th>Kelish vaqti</th><th>Amal</th></tr></thead>
        <tbody>{list.map(s => <tr key={s.id}><td>{s.id}</td><td>{s.name}{s.isNew && ' 🆕'}</td><td>{s.qty}</td><td>{som(s.unit)}</td><td>{som(s.total)}</td>
          <td><span className={'tag ' + cls(s.status)}>{s.status}</span></td><td>{fmt(s.createdAt)}</td>
          <td>{s.status === 'qabul qilindi' ? fmt(s.receivedAt) : s.status === 'bekor qilindi' ? 'Bekor: ' + fmt(s.cancelledAt) : `${fmt(s.etaAt)} (~${left(s.etaAt)} daq.)`}</td>
          <td>{s.status === 'buyurtma berildi' && <button className="b bad" onClick={() => cancel(s)}>❌ Bekor qilish</button>}</td></tr>)}</tbody></table></div>
  </>;
}

function EditStaff({ u, done, cancel }) {
  const [f, setF] = useState({ name: u.name, login: u.login, password: '', role: u.role }), [err, setErr] = useState(''), set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { setErr(''); await api('/staff/' + u.id, 'PUT', f); done(); } catch (e) { setErr(e.message); } };
  return <div className="card warn"><b>✏️ Xodimni o'zgartirish</b><div className="row" style={{ marginTop: 10 }}>
    <label className="clock">Ism familiya<br /><input value={f.name} onChange={set('name')} /></label>
    <label className="clock">Login<br /><input value={f.login} onChange={set('login')} /></label>
    <label className="clock">Yangi parol (bo'sh = o'zgarmaydi)<br /><input type="password" value={f.password} onChange={set('password')} /></label>
    <label className="clock">Rol<br /><select value={f.role} onChange={set('role')}><option value="xodim">xodim</option><option value="administrator">administrator</option></select></label></div>
    <div className="row"><button className="b ok" onClick={save}>Saqlash</button><button className="b" onClick={cancel}>Bekor qilish</button></div>{err && <div className="err">{err}</div>}</div>;
}

function Staff({ user }) {
  const [list, load] = useData('/staff', 20000), [f, setF] = useState({ name: '', login: '', password: '', role: 'xodim' }), [err, setErr] = useState(''), [edit, setEdit] = useState(null);
  const add = async () => { try { setErr(''); await api('/staff', 'POST', f); setF({ name: '', login: '', password: '', role: 'xodim' }); load(); } catch (e) { setErr(e.message); } };
  const del = async u => {
    if (!window.confirm(`${u.name} o'chirilsinmi?`)) return;
    try { setErr(''); await api('/staff/' + u.id, 'DELETE'); load(); } catch (e) { setErr(e.message); }
  };
  return <>
    <div className="card accent"><b>Yangi xodim qo'shish</b><div className="row" style={{ marginTop: 10 }}>
      <input placeholder="Ism familiya" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input placeholder="Login" value={f.login} onChange={e => setF({ ...f, login: e.target.value })} />
      <input type="password" placeholder="Parol" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="xodim">xodim</option><option value="administrator">administrator</option></select>
      <button className="b" onClick={add}>Qo'shish</button></div></div>
    {edit && <EditStaff key={edit.id} u={edit} cancel={() => setEdit(null)} done={() => { setEdit(null); load(); }} />}
    {err && <div className="err">{err}</div>}
    <div className="card tw"><table><thead><tr><th>Ism</th><th>Login</th><th>Rol</th><th>Qo'shilgan sana (UTC+5)</th><th>Amallar</th></tr></thead>
      <tbody>{(list || []).map(u => <tr key={u.id}><td>{u.name}</td><td>{u.login}</td><td><span className="tag">{u.role}</span></td><td>{fmt(u.createdAt)}</td>
        <td style={{ whiteSpace: 'nowrap' }}><button className="b warn" onClick={() => { setEdit(u); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️ O'zgartirish</button>{' '}
          {u.id !== user.id && <button className="b bad" onClick={() => del(u)}>🗑 O'chirish</button>}</td></tr>)}</tbody></table></div>
  </>;
}

function Events({ list }) {
  return <div className="tw"><table><thead><tr><th>Sana va vaqt (UTC+5)</th><th>Tur</th><th>Hodisa</th><th>Kim</th></tr></thead>
    <tbody>{list.map(e => <tr key={e.id}><td>{fmt(e.at)}</td><td><span className="tag">{e.type}</span></td><td>{e.text}</td><td>{e.by}</td></tr>)}</tbody></table></div>;
}
function EventsPage() { const [l] = useData('/events', 8000); return <div className="card">{l ? <Events list={l} /> : 'Yuklanmoqda...'}</div>; }

// [kalit, belgi, nom, faqat administrator]
const PAGES = [['dash', '📊', 'Boshqaruv paneli', 1], ['prod', '📦', 'Mahsulotlar'], ['in', '⬇️', 'Kirim'], ['out', '⬆️', 'Chiqim'],
  ['msg', '🔔', 'Ombor xabarlari'], ['sup', '🏭', "Ta'minot", 1], ['staff', '👥', 'Xodimlar', 1], ['ev', '🕘', 'Hodisalar tarixi']];

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [page, setPage] = useState(() => (JSON.parse(localStorage.getItem('user') || 'null')?.role === 'administrator' ? 'dash' : 'prod')), [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  if (!user) return <Login onLogin={u => { setUser(u); setPage(u.role === 'administrator' ? 'dash' : 'prod'); }} />;
  const isAdmin = user.role === 'administrator', pages = PAGES.filter(p => !p[3] || isAdmin), cur = pages.find(p => p[0] === page) || pages[0];
  const views = { dash: <Dashboard user={user} />, prod: <Products user={user} />, in: <TxPage type="kirim" />, out: <TxPage type="chiqim" />,
    msg: <Messages user={user} />, sup: <Supplies />, staff: <Staff user={user} />, ev: <EventsPage /> };
  return <div className="layout">
    <aside className="side"><h2>📦 Ombor</h2><div className="who">{user.name} · {user.role}</div>
      {pages.map(p => <button key={p[0]} className={cur[0] === p[0] ? 'on' : ''} onClick={() => setPage(p[0])}>{p[1]} {p[2]}</button>)}
      <button onClick={() => { localStorage.clear(); setUser(null); }}>🚪 Chiqish</button></aside>
    <main className="main"><div className="top"><h1>{cur[2]}</h1>
      <div className="clock">Toshkent vaqti (UTC+5): {fmt(new Date().toISOString())}</div></div>
      {views[cur[0]]}</main>
  </div>;
}
