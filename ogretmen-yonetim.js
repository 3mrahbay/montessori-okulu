// Yönetim paneli — öğretmen belge başvuruları ve doğrulama (admin.html içinden yüklenir)
import { oturumDinle } from './oturum.js';
import { yoneticiMi, tarihYazi } from './topluluk-veri.js';
import {
  bekleyenBasvurular, sonKararlar, ogretmenKartiGetir, basvuruOnayla, basvuruReddet,
  belgeAdresi, dogrulamaKaldir, dogrulandiMi, kalemYazi
} from './ogretmen-veri.js';

const $ = (s) => document.querySelector(s);
const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bildirimVer = (m, t = 'success') => (window.notify ? window.notify(m, t) : console.log(m));

let bekleyen = [];
let kararlar = [];
const kartlar = new Map();

async function kartAl(uid) {
  if (!kartlar.has(uid)) kartlar.set(uid, await ogretmenKartiGetir(uid).catch(() => null));
  return kartlar.get(uid);
}

function kalemBul(kart, b) {
  const liste = b.kalem_tur === 'egitim' ? (kart?.egitim || []) : (kart?.sertifikalar || []);
  return liste.find(x => x.id === b.kalem_id) || null;
}

function basvuruHtml(b, kart, karar = false) {
  const kalem = kalemBul(kart, b);
  const degisti = kalem && kalemYazi(kalem) !== b.kalem_ad;
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;background:#fff">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <span class="badge ${b.kalem_tur === 'egitim' ? 'badge-blue' : 'badge-orange'}">${b.kalem_tur === 'egitim' ? 'Eğitim' : 'Sertifika'}</span>
      ${karar ? `<span class="badge ${b.durum === 'onaylandi' ? 'badge-green' : 'badge-gray'}">${b.durum === 'onaylandi' ? 'Onaylandı' : 'Reddedildi'}</span>` : ''}
      <span style="font-size:11px;color:var(--ink-s)">${kacis(kart?.ad_soyad || 'Kartı bulunamadı')}${kart?.unvan ? ' · ' + kacis(kart.unvan) : ''} · ${tarihYazi(b.olusturma)}</span>
      ${kart?.acik ? `<a href="ogretmen?u=${encodeURIComponent(b.uid)}" target="_blank" rel="noopener" style="font-size:11px">Herkese açık kartı</a>` : '<span style="font-size:11px;color:var(--ink-s)">Kart gizli</span>'}
    </div>
    <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px">${kacis(b.kalem_ad)}</div>
    ${degisti ? `<div style="font-size:12px;color:#B45309;margin-bottom:6px">Öğretmen başvurudan sonra bu bilgiyi değiştirmiş. Karttaki şimdiki hâli: <b>${kacis(kalemYazi(kalem))}</b></div>` : ''}
    ${!kalem && !karar ? '<div style="font-size:12px;color:#B91C1C;margin-bottom:6px">Bu kalem artık öğretmenin kartında yok.</div>' : ''}
    ${b.not ? `<div style="font-size:13px;color:var(--ink-m);margin-bottom:6px">Öğretmenin notu: ${kacis(b.not)}</div>` : ''}
    ${b.yonetici_notu ? `<div style="font-size:13px;color:var(--ink-m);margin-bottom:6px">Yönetici notu: ${kacis(b.yonetici_notu)}</div>` : ''}
    <div style="font-size:13px;color:var(--ink-m)">${b.dosya_yolu ? '' : 'Belge e-postayla gönderilecek (yükleme kapalıyken). Gelen kutusunu kontrol et.'}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      ${b.dosya_yolu ? `<button class="btn btn-ghost btn-sm" data-og="belge" data-id="${b.id}">Belgeyi aç</button>` : ''}
      ${!karar ? `
        <button class="btn btn-s btn-sm" data-og="onayla" data-id="${b.id}" ${kalem ? '' : 'disabled'}>Onayla</button>
        <button class="btn btn-red btn-sm" data-og="reddet" data-id="${b.id}">Reddet</button>`
      : (b.durum === 'onaylandi' && kalem && dogrulandiMi(kart, kalem)
        ? `<button class="btn btn-red btn-sm" data-og="kaldir" data-id="${b.id}">Doğrulamayı kaldır</button>` : '')}
    </div>
  </div>`;
}

async function ciz() {
  const alan = $('#ogDogrulamaAlan');
  if (!alan) return;
  const uidler = [...new Set([...bekleyen, ...kararlar].map(b => b.uid))];
  await Promise.all(uidler.map(kartAl));
  const zaman = (b) => b.olusturma?.toMillis?.() || 0;
  const bek = [...bekleyen].sort((a, b) => zaman(a) - zaman(b));
  const kar = [...kararlar].sort((a, b) => (b.karar_tarihi?.toMillis?.() || 0) - (a.karar_tarihi?.toMillis?.() || 0)).slice(0, 30);
  alan.innerHTML = `
    <div class="card"><div class="card-head"><span class="card-title">Bekleyen başvurular (${bek.length})</span></div>
      <div class="card-body">${bek.length ? bek.map(b => basvuruHtml(b, kartlar.get(b.uid))).join('')
        : '<p style="color:var(--ink-s);font-size:13px;margin:0">Bekleyen doğrulama başvurusu yok.</p>'}
        <p style="color:var(--ink-s);font-size:12px;margin:12px 0 0">Onayladığında, öğretmenin kartındaki bu bilgi o anki hâliyle kaydedilir ve
        “✓ Doğrulandı” rozeti görünür. Öğretmen bilgiyi sonradan değiştirirse rozet kendiliğinden kalkar.</p></div></div>
    <div class="card" style="margin-top:16px"><div class="card-head"><span class="card-title">Son kararlar</span></div>
      <div class="card-body">${kar.length ? kar.map(b => basvuruHtml(b, kartlar.get(b.uid), true)).join('')
        : '<p style="color:var(--ink-s);font-size:13px;margin:0">Henüz karar verilmiş başvuru yok.</p>'}</div></div>`;
  const rozet = $('#ogDogrulamaSay');
  if (rozet) { rozet.textContent = bek.length; rozet.style.display = bek.length ? '' : 'none'; }
}

async function yukle() {
  try {
    [bekleyen, kararlar] = await Promise.all([bekleyenBasvurular(), sonKararlar()]);
    kartlar.clear();
    await ciz();
  } catch (e) {
    console.error('Başvurular yüklenemedi:', e);
    const alan = $('#ogDogrulamaAlan');
    if (alan) alan.innerHTML = '<div class="card"><div class="card-body">Başvurular yüklenemedi. Güvenlik kuralları yayına alındı mı?</div></div>';
  }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-og]');
  if (!t) return;
  const b = [...bekleyen, ...kararlar].find(x => x.id === t.dataset.id);
  if (!b) return;
  t.disabled = true;
  try {
    if (t.dataset.og === 'belge') {
      window.open(await belgeAdresi(b.dosya_yolu), '_blank', 'noopener');
    } else if (t.dataset.og === 'onayla') {
      await basvuruOnayla(b, await kartAl(b.uid));
      bildirimVer('Doğrulandı. Rozet öğretmenin kartında görünüyor.');
      await yukle();
    } else if (t.dataset.og === 'reddet') {
      const not = prompt('Öğretmene görünecek kısa bir not (isteğe bağlı):', '');
      if (not === null) { t.disabled = false; return; }
      await basvuruReddet(b, not);
      bildirimVer('Başvuru reddedildi.');
      await yukle();
    } else if (t.dataset.og === 'kaldir') {
      if (!confirm('Bu doğrulama kaldırılsın mı? Rozet kartta görünmeyecek.')) { t.disabled = false; return; }
      await dogrulamaKaldir(b.uid, b.kalem_id);
      bildirimVer('Doğrulama kaldırıldı.');
      await yukle();
    }
  } catch (err) {
    console.error(err);
    bildirimVer('İşlem yapılamadı: ' + (err.message || err), 'error');
  }
  t.disabled = false;
});

oturumDinle((u) => { if (u && yoneticiMi(u)) yukle(); });
