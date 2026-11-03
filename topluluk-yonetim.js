// Yönetim paneli — topluluk moderasyonu ve üye listesi (admin.html içinden yüklenir)
import { oturumDinle, veritabani } from './oturum.js';
import { collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  TURLER, KATEGORILER, TIP_ETIKET, tarihYazi, yoneticiMi, bekleyenler, bildirimler, yayindakiGonderiler,
  yayindakiCevaplarHepsi, onayla, gizle, yoneticiSil, bildirimKapat, gonderiGetir, uyeOnayKaldir
} from './topluluk-veri.js';

const $ = (s) => document.querySelector(s);
const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ik = (ad) => `<svg class="ik ik-sm" aria-hidden="true"><use href="ikonlar.svg#ik-${ad}"/></svg>`;
const bildirimVer = (m, t = 'success') => (window.notify ? window.notify(m, t) : console.log(m));

let sekme = 'bekleyen';
let veri = { bekleyen: { gonderiler: [], cevaplar: [] }, bildirimler: [], yayinda: [], yayindaCevap: [], basliklar: {} };
let uyeler = [];

const ROZET = { soru: 'badge-blue', deneyim: 'badge-orange', rehber: 'badge-green', cevap: 'badge-gray' };

function ogeHtml(tur, o, eylemler) {
  const tAd = tur === 'cevap' ? 'Cevap' : TURLER[o.tur]?.ad;
  const rozet = ROZET[tur === 'cevap' ? 'cevap' : o.tur];
  const baslik = tur === 'cevap'
    ? `<span style="color:var(--ink-s);font-weight:600">Şu paylaşıma:</span> ${kacis(veri.basliklar[o.gonderi_id] || o.gonderi_id)}`
    : kacis(o.baslik);
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;background:#fff">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <span class="badge ${rozet}">${tAd}</span>
      ${o.kategori ? `<span class="badge badge-gray">${kacis(KATEGORILER[o.kategori] || o.kategori)}</span>` : ''}
      ${o.uzman ? '<span class="badge badge-green">Uzman cevabı</span>' : ''}
      <span style="font-size:11px;color:var(--ink-s)">${kacis(o.yazar_ad)} · ${kacis(TIP_ETIKET[o.yazar_tip] || '')} · ${tarihYazi(o.olusturma)}</span>
    </div>
    <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px">${baslik}</div>
    <div style="font-size:13px;color:var(--ink-m);line-height:1.6;white-space:pre-wrap;max-height:180px;overflow:auto;background:var(--bg-cream);border-radius:8px;padding:10px 12px">${kacis(o.metin)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${eylemler}</div>
  </div>`;
}

function eylem(ad, sinif, veriAttr) {
  return `<button class="btn ${sinif} btn-sm" ${veriAttr}>${ad}</button>`;
}

function ciz() {
  const alan = $('#modAlan');
  if (!alan) return;
  const b = veri.bekleyen;
  const bekleyenSay = b.gonderiler.length + b.cevaplar.length;
  const sekmeBtn = (id, ad, say) => `<button class="tab ${sekme === id ? 'active' : ''}" data-mod-sekme="${id}">${ad}${say !== undefined ? ` (${say})` : ''}</button>`;
  let icerik = '';

  if (sekme === 'bekleyen') {
    const tum = [...b.gonderiler.map(o => ['gonderi', o]), ...b.cevaplar.map(o => ['cevap', o])];
    icerik = tum.length ? tum.map(([tur, o]) => ogeHtml(tur, o,
      eylem(`${ik('onay')} Onayla ve üyeyi onayla`, 'btn-s', `data-mod="onayla-uye" data-tur="${tur}" data-id="${o.id}"`) +
      eylem('Yalnızca bunu onayla', 'btn-ghost', `data-mod="onayla" data-tur="${tur}" data-id="${o.id}"`) +
      eylem('Reddet', 'btn-red', `data-mod="gizle" data-tur="${tur}" data-id="${o.id}"`) +
      eylem(`${ik('sil')} Sil`, 'btn-red', `data-mod="sil" data-tur="${tur}" data-id="${o.id}"`)
    )).join('') : bosHtml('Bekleyen paylaşım yok', 'Yeni üyelerin ilk paylaşımları burada onayını bekler.');
  } else if (sekme === 'bildirim') {
    icerik = veri.bildirimler.length ? veri.bildirimler.map(n => `
      <div style="border:1px solid rgba(231,76,60,.25);border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#fff">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge badge-red">${n.hedef_tur === 'cevap' ? 'Cevap' : 'Paylaşım'}</span>
          <span style="font-size:13px;font-weight:700">${kacis(n.neden || 'Neden belirtilmedi')}</span>
          <span style="font-size:11px;color:var(--ink-s)">${tarihYazi(n.olusturma)}</span></div>
        <div style="font-size:13px;color:var(--ink-m);margin-top:6px">${kacis(veri.basliklar[n.gonderi_id] || n.gonderi_id)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <a class="btn btn-ghost btn-sm" href="topluluk.html?g=${encodeURIComponent(n.gonderi_id)}" target="_blank" rel="noopener">${ik('goz')} İçeriğe bak</a>
          ${eylem('İçeriği gizle', 'btn-red', `data-mod="bildirim-gizle" data-id="${n.id}"`)}
          ${eylem('Bildirimi kapat', 'btn-ghost', `data-mod="bildirim-kapat" data-id="${n.id}"`)}
        </div></div>`).join('') : bosHtml('Bildirim yok', 'Üyelerin "Bildir" ile ilettiği içerikler burada görünür.');
  } else if (sekme === 'yayinda') {
    const tum = [...veri.yayinda.map(o => ['gonderi', o]), ...veri.yayindaCevap.map(o => ['cevap', o])];
    icerik = tum.length ? tum.map(([tur, o]) => ogeHtml(tur, o,
      `<a class="btn btn-ghost btn-sm" href="topluluk.html?g=${encodeURIComponent(tur === 'cevap' ? o.gonderi_id : o.id)}" target="_blank" rel="noopener">${ik('goz')} Toplulukta gör</a>` +
      eylem('Gizle', 'btn-red', `data-mod="gizle" data-tur="${tur}" data-id="${o.id}"`) +
      eylem(`${ik('sil')} Sil`, 'btn-red', `data-mod="sil" data-tur="${tur}" data-id="${o.id}"`)
    )).join('') : bosHtml('Yayında paylaşım yok', 'Onaylanan sorular, deneyimler, rehberler ve cevaplar burada listelenir.');
  }

  alan.innerHTML = `
    <div class="card"><div class="card-head"><span class="card-title">Topluluk Moderasyonu</span>
      <div style="display:flex;gap:8px">
        <a class="btn btn-ghost btn-sm" href="topluluk.html" target="_blank" rel="noopener">${ik('dunya')} Topluluğu aç</a>
        <button class="btn btn-ghost btn-sm" data-mod="yenile">Yenile</button></div></div>
      <div class="card-body">
        <div style="background:rgba(74,144,196,.06);border:1px solid rgba(74,144,196,.15);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:var(--ink-m);line-height:1.6">
          Yeni üyenin ilk paylaşımı burada onay bekler. <b>"Onayla ve üyeyi onayla"</b> derseniz o üyenin sonraki paylaşımları beklemeden yayına girer.
          Cevaplarınız toplulukta <b>"Uzman cevabı"</b> rozetiyle görünür.</div>
        <div class="tabs">${sekmeBtn('bekleyen', 'Bekleyenler', bekleyenSay)}${sekmeBtn('bildirim', 'Bildirilenler', veri.bildirimler.length)}${sekmeBtn('yayinda', 'Yayındakiler', veri.yayinda.length + veri.yayindaCevap.length)}</div>
        ${icerik}
      </div></div>`;
  const rozet = $('#modCount');
  if (rozet) { rozet.textContent = bekleyenSay + veri.bildirimler.length; rozet.style.display = (bekleyenSay + veri.bildirimler.length) ? '' : 'none'; }
}

const bosHtml = (b, m) => `<div style="text-align:center;padding:36px 20px;color:var(--ink-s)">
  <div style="font-size:14px;font-weight:700;color:var(--ink-m);margin-bottom:4px">${b}</div><div style="font-size:12.5px">${m}</div></div>`;

async function basliklariTamamla(idler) {
  const eksik = [...new Set(idler)].filter(id => id && !veri.basliklar[id]);
  await Promise.all(eksik.map(async id => {
    try { const g = await gonderiGetir(id); veri.basliklar[id] = g ? g.baslik : '(silinmiş paylaşım)'; } catch (e) { veri.basliklar[id] = id; }
  }));
}

async function yukle() {
  const alan = $('#modAlan');
  if (alan && !alan.innerHTML.trim()) alan.innerHTML = bosHtml('Yükleniyor…', '');
  try {
    const [b, n, y, yc] = await Promise.all([bekleyenler(), bildirimler(), yayindakiGonderiler(), yayindakiCevaplarHepsi()]);
    veri.bekleyen = b; veri.bildirimler = n; veri.yayinda = y; veri.yayindaCevap = yc;
    y.forEach(g => { veri.basliklar[g.id] = g.baslik; });
    b.gonderiler.forEach(g => { veri.basliklar[g.id] = g.baslik; });
    await basliklariTamamla([...b.cevaplar.map(c => c.gonderi_id), ...n.map(x => x.gonderi_id), ...yc.map(c => c.gonderi_id)]);
    ciz();
  } catch (e) {
    console.error('Moderasyon verisi alınamadı:', e);
    if (alan) alan.innerHTML = bosHtml('Topluluk verisi alınamadı', 'Sayfayı yenileyip tekrar giriş yapmayı deneyin.');
  }
}

function bul(tur, id) {
  const b = veri.bekleyen;
  const havuz = tur === 'cevap' ? [...b.cevaplar, ...veri.yayindaCevap] : [...b.gonderiler, ...veri.yayinda];
  return havuz.find(o => o.id === id);
}

// ── Üyeler ──
async function uyeleriYukle() {
  const tbody = $('#uyelerTbody');
  try {
    const s = await getDocs(query(collection(veritabani, 'profiller'), limit(1000)));
    uyeler = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.olusturma?.toMillis?.() || 0) - (a.olusturma?.toMillis?.() || 0));
    const sayi = $('#statMembers'); if (sayi) sayi.textContent = uyeler.length;
    uyeleriCiz();
  } catch (e) {
    console.error('Üyeler alınamadı:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--ink-s);">Üye listesi alınamadı.</td></tr>`;
  }
}

function uyeleriCiz() {
  const tbody = $('#uyelerTbody');
  if (!tbody) return;
  const ara = ($('#uyeAra')?.value || '').toLocaleLowerCase('tr-TR');
  const tip = $('#uyeTip')?.value || '';
  const liste = uyeler.filter(u => (!tip || u.uyelik_tipi === tip)
    && (!ara || `${u.ad_soyad || ''} ${u.email || ''}`.toLocaleLowerCase('tr-TR').includes(ara)));
  tbody.innerHTML = liste.length ? liste.map(u => `<tr>
      <td><strong>${kacis(u.ad_soyad || '—')}</strong></td>
      <td>${kacis(u.email || '')}</td>
      <td><span class="badge badge-blue">${kacis(TIP_ETIKET[u.uyelik_tipi] || '—')}</span></td>
      <td>${u.olusturma?.toDate ? u.olusturma.toDate().toLocaleDateString('tr-TR') : '—'}</td>
      <td>${u.onayli ? '<span class="badge badge-green">Onaylı</span>' : '<span class="badge badge-gray">Yeni</span>'}</td>
      <td>${u.onayli ? eylem('Onayı kaldır', 'btn-ghost btn-xs', `data-mod="uye-onay-kaldir" data-id="${u.id}"`) : ''}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--ink-s);">Üye bulunamadı.</td></tr>`;
}

// ── Olaylar ──
document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-mod-sekme]');
  if (s) { sekme = s.dataset.modSekme; ciz(); return; }
  const d = e.target.closest('[data-mod]');
  if (!d) return;
  const islem = d.dataset.mod, tur = d.dataset.tur, id = d.dataset.id;
  d.disabled = true;
  try {
    if (islem === 'yenile') { await yukle(); await uyeleriYukle(); return; }
    if (islem === 'uye-onay-kaldir') { await uyeOnayKaldir(id); bildirimVer('Üyenin onayı kaldırıldı'); await uyeleriYukle(); return; }
    if (islem === 'bildirim-kapat') { await bildirimKapat(id); bildirimVer('Bildirim kapatıldı'); await yukle(); return; }
    if (islem === 'bildirim-gizle') {
      const n = veri.bildirimler.find(x => x.id === id);
      const t = n.hedef_tur === 'cevap' ? 'cevap' : 'gonderi';
      const oge = bul(t, n.hedef_id) || { id: n.hedef_id, gonderi_id: n.gonderi_id, durum: 'yayinda' };
      await gizle(t, oge); await bildirimKapat(id); bildirimVer('İçerik gizlendi'); await yukle(); return;
    }
    const oge = bul(tur, id);
    if (!oge) { bildirimVer('İçerik bulunamadı, liste yenileniyor', 'error'); await yukle(); return; }
    if (islem === 'onayla-uye' || islem === 'onayla') {
      await onayla(tur, oge, { uyeyiOnayla: islem === 'onayla-uye' });
      bildirimVer(islem === 'onayla-uye' ? 'Onaylandı; üye artık doğrudan paylaşabilir' : 'İçerik onaylandı');
    } else if (islem === 'gizle') {
      await gizle(tur, oge); bildirimVer('Gizlendi');
    } else if (islem === 'sil') {
      if (!d.dataset.onay) { d.dataset.onay = '1'; d.disabled = false; d.innerHTML = 'Emin misiniz? Tekrar tıklayın'; return; }
      await yoneticiSil(tur, oge); bildirimVer('Silindi');
    }
    await yukle(); await uyeleriYukle();
  } catch (err) {
    console.error(err);
    bildirimVer('İşlem yapılamadı: ' + (err.message || err), 'error');
  } finally { d.disabled = false; }
});
document.addEventListener('input', (e) => { if (e.target.id === 'uyeAra') uyeleriCiz(); });
document.addEventListener('change', (e) => { if (e.target.id === 'uyeTip') uyeleriCiz(); });

// Firebase oturumu yönetici değilse paneli kapat (yerel kayıtla açılmasın)
oturumDinle((u) => {
  if (!u || !yoneticiMi(u)) {
    if (document.getElementById('adminApp')?.style.display === 'block' && typeof window.logout === 'function') window.logout();
    return;
  }
  yukle(); uyeleriYukle();
});
