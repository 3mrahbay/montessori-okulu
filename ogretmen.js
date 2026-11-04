// Öğretmen profil sayfası — /ogretmen?u=<uid>
// Yalnızca öğretmenin herkese açık yaptığı kart gösterilir. Açık değilse sayfa "noindex" kalır.
import { oturumDinle } from './oturum.js';
import { ogretmenKartiGetir, dogrulandiMi } from './ogretmen-veri.js';
import { kartGovdeHtml } from './yazar-karti.js';
import { TURLER, tarihYazi } from './topluluk-veri.js';
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { veritabani } from './oturum.js';

const SITE = 'https://montessoriokulu.com';
const $ = (s) => document.querySelector(s);
const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = new URLSearchParams(location.search).get('u') || '';

function meta(ad, deger, ozellik = 'name') {
  let m = document.querySelector(`meta[${ozellik}="${ad}"]`);
  if (!m) { m = document.createElement('meta'); m.setAttribute(ozellik, ad); document.head.appendChild(m); }
  m.setAttribute('content', deger);
}

function yapisalVeri(kart, adres) {
  const dogrular = [...(kart.egitim || []), ...(kart.sertifikalar || [])].filter(k => dogrulandiMi(kart, k));
  const ld = {
    '@context': 'https://schema.org', '@type': 'ProfilePage', url: adres, inLanguage: 'tr-TR',
    mainEntity: {
      '@type': 'Person', name: kart.ad_soyad, ...(kart.unvan ? { jobTitle: kart.unvan } : {}),
      ...(kart.kurum ? { worksFor: { '@type': 'Organization', name: kart.kurum } } : {}),
      ...(kart.tanitim ? { description: kart.tanitim } : {}),
      // Yalnızca yöneticinin doğruladığı eğitim ve sertifikalar arama motorlarına bildirilir
      ...(dogrular.length ? {
        hasCredential: dogrular.map(k => ({
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: k.ad !== undefined ? 'certificate' : 'degree',
          name: k.ad !== undefined ? k.ad : k.bolum,
          ...((k.kurum || k.okul) ? { recognizedBy: { '@type': 'Organization', name: k.kurum || k.okul } } : {})
        }))
      } : {})
    }
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
}

async function paylasimlar() {
  try {
    const [g, c] = await Promise.all([
      getDocs(query(collection(veritabani, 'gonderiler'), where('yazar_uid', '==', uid), where('durum', '==', 'yayinda'), limit(50))),
      getDocs(query(collection(veritabani, 'cevaplar'), where('yazar_uid', '==', uid), where('durum', '==', 'yayinda'), limit(50)))
    ]);
    const zaman = (o) => o.olusturma?.toMillis?.() || 0;
    const liste = [
      ...g.docs.map(d => ({ tip: 'gonderi', id: d.id, ...d.data() })),
      ...c.docs.map(d => ({ tip: 'cevap', id: d.id, ...d.data() }))
    ].sort((a, b) => zaman(b) - zaman(a));
    if (!liste.length) return '<p class="og-not">Henüz toplulukta yayımlanmış bir paylaşımı yok.</p>';
    return liste.map(o => o.tip === 'gonderi'
      ? `<a class="og-pay" href="topluluk?g=${encodeURIComponent(o.id)}">
          <small>${kacis(TURLER[o.tur]?.ad || '')} · ${tarihYazi(o.olusturma)}</small><b>${kacis(o.baslik)}</b></a>`
      : `<a class="og-pay" href="topluluk?g=${encodeURIComponent(o.gonderi_id)}">
          <small>Cevap · ${tarihYazi(o.olusturma)}</small><b>${kacis(String(o.metin).slice(0, 140))}${String(o.metin).length > 140 ? '…' : ''}</b></a>`).join('');
  } catch (e) {
    console.warn('Paylaşımlar okunamadı:', e);
    return '<p class="og-not">Paylaşımlar şu an yüklenemedi.</p>';
  }
}

async function ciz() {
  if (!uid) { $('#ogDurum').textContent = 'Profil bulunamadı.'; return; }
  let kart = null;
  try { kart = await ogretmenKartiGetir(uid); } catch (e) { console.warn(e); }
  if (!kart || !kart.acik) {
    $('#ogDurum').textContent = kart ? 'Bu profil şu an yalnızca sahibine açık. Herkese açık yapıldığında burada görünecek.'
      : 'Bu öğretmen profili herkese açık değil ya da bulunamadı.';
    return;
  }
  const adres = `${SITE}/ogretmen?u=${encodeURIComponent(uid)}`;
  document.title = `${kart.ad_soyad}${kart.unvan ? ' — ' + kart.unvan : ''} · Montessori Okulu`;
  meta('description', (kart.tanitim || `${kart.ad_soyad}, Montessori Okulu topluluğunda öğretmen.`).slice(0, 155));
  meta('og:title', document.title, 'property');
  $('#robotlar')?.setAttribute('content', 'index, follow');
  const kanonik = document.createElement('link'); kanonik.rel = 'canonical'; kanonik.href = adres; document.head.appendChild(kanonik);
  yapisalVeri(kart, adres);

  $('#ogDurum').remove();
  $('#ogIcerik').innerHTML = `
    <article class="og-kart">${kartGovdeHtml(kart, { sayfaBaglantisi: false })}
      <p class="og-aciklama"><b>✓ Doğrulandı:</b> öğretmen belgesini paylaştı ve Montessori Okulu yöneticisi inceledi.
        <b>Beyan:</b> öğretmenin kendi verdiği bilgi.</p></article>
    <section class="og-paylasimlar"><h2>Topluluktaki paylaşımları</h2><div id="ogPay"><p class="og-not">Yükleniyor…</p></div></section>`;
  $('#ogPay').innerHTML = await paylasimlar();
}

$('#hamburger')?.addEventListener('click', () => $('#mobilMenu').classList.toggle('acik'));
oturumDinle((u) => {
  if (u) {
    const g = $('#girisDugme'); if (g) { g.textContent = 'Profilim'; g.href = 'profil.html'; }
    const y = $('#uyeDugme'); if (y) y.style.display = 'none';
  }
});
ciz();
