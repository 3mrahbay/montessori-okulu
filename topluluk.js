// Topluluk sayfası — liste, filtreler, gönderi detayı, cevaplar, paylaşım ve bildirim
import { oturumDinle, kimlik, profilGetir, hataMetni } from './oturum.js';
import {
  TURLER, KATEGORILER, YASLAR, TIP_ETIKET, SINIRLAR, gorunenAd, tarihYazi, yoneticiMi,
  yayindakiGonderiler, gonderiGetir, cevaplariGetir, benimGonderilerim, gonderiOlustur,
  cevapEkle, bildir, kendiIceriginiSil
} from './topluluk-veri.js';

// ── Yardımcılar ──
const $ = (s, k = document) => k.querySelector(s);
const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mi = (ad, sinif = 'mi') => `<svg class="${sinif}" aria-hidden="true"><use href="materyal-ikonlar.svg#m-${ad}"/></svg>`;
const ik = (ad, sinif = 'ik') => `<svg class="${sinif}" aria-hidden="true"><use href="ikonlar.svg#ik-${ad}"/></svg>`;
const TIP_KARO = { ebeveyn: ['E', 'karo-s'], ogretmen: ['Ö', 'karo-g'], merakli: ['M', 'karo-y'] };
const yazarHtml = (o) => {
  const [harf, renk] = TIP_KARO[o.yazar_tip] || TIP_KARO.merakli;
  return `<span class="g-yazar"><span class="karo ${renk}" title="${TIP_ETIKET[o.yazar_tip] || 'Üye'}">${harf}</span>${kacis(o.yazar_ad)}</span>`;
};
function bildirimGoster(m) {
  const b = $('#bildirimK'); b.textContent = m; b.classList.add('goster');
  clearTimeout(bildirimGoster.z); bildirimGoster.z = setTimeout(() => b.classList.remove('goster'), 3400);
}

const ONERILER = {
  soru: ['Küçük bir evde hazırlanmış ortamı nasıl kurarım?', 'Montessori okulu ziyaretinde nelere bakmalıyım?',
    'Çocuğum işini yarıda bırakıyor, ne yapmalıyım?', 'İki kardeş aynı materyali isteyince ne yapıyorsunuz?'],
  deneyim: ['Mutfakta çocuğuma verdiğim ilk görev', 'Raf düzenini değiştirince neler oldu?',
    'Sabah rutinimizi nasıl sadeleştirdik?', 'Sınıfta sessizlik oyunu deneyimim'],
  rehber: ['Evde pratik yaşam köşesi kurma rehberi', 'Seyahatte Montessori: yanınıza alabilecekleriniz',
    'Sınıfta gözlem formu nasıl hazırlanır?']
};

// ── Durum ──
let kullanici = null;
let tumGonderiler = [];
let benimBekleyenlerim = [];
const filtre = { tur: '', kategori: '', yas: '', ara: '' };

// ── LİSTE ──
function kartHtml(o) {
  const t = TURLER[o.tur];
  const ozet = String(o.metin || '').replace(/\s+/g, ' ').slice(0, 220);
  const cevap = o.tur === 'soru'
    ? (o.cevap_sayisi > 0 ? `<span class="g-cevap var">${ik('sohbet', 'ik')} ${o.cevap_sayisi} cevap</span>` : `<span class="g-cevap">${ik('sohbet', 'ik')} Henüz cevap yok</span>`)
    : (o.cevap_sayisi > 0 ? `<span class="g-cevap var">${ik('sohbet', 'ik')} ${o.cevap_sayisi} yorum</span>` : '');
  return `<button class="g-kart" data-ac="${kacis(o.id)}">
    <div class="g-ikon gi-${o.tur}">${mi(t.mi)}</div>
    <div class="g-bilgi">
      <div class="g-ust"><span class="g-rozet gr-${o.tur}">${t.ad}</span>
        <span class="g-etiket">${kacis(KATEGORILER[o.kategori] || '')}${o.yas && o.yas !== 'genel' ? ' · ' + kacis(YASLAR[o.yas]) : ''}</span>
        ${o.durum !== 'yayinda' ? '<span class="g-bekliyor">İncelemede</span>' : ''}</div>
      <div class="g-baslik">${kacis(o.baslik)}</div>
      <div class="g-ozet">${kacis(ozet)}</div>
      <div class="g-alt">${yazarHtml(o)}<span>${tarihYazi(o.olusturma)}</span>${cevap}</div>
    </div></button>`;
}

function filtrelenmis() {
  const ara = filtre.ara.trim().toLocaleLowerCase('tr-TR');
  const liste = [...benimBekleyenlerim.filter(b => !filtre.tur || b.tur === filtre.tur), ...tumGonderiler];
  return liste.filter(o => (!filtre.tur || o.tur === filtre.tur)
    && (!filtre.kategori || o.kategori === filtre.kategori)
    && (!filtre.yas || o.yas === filtre.yas || o.yas === 'genel')
    && (!ara || (o.baslik + ' ' + o.metin).toLocaleLowerCase('tr-TR').includes(ara)));
}

function bosDurumHtml() {
  const tur = filtre.tur || 'soru';
  const t = TURLER[tur];
  const filtreli = filtre.kategori || filtre.yas || filtre.ara;
  if (filtreli) {
    return `<div class="t-bos">${mi('geometrik')}<h3>Bu filtreyle bir şey bulamadık</h3>
      <p>Farklı bir kategori ya da yaş seç, ya da bu konuyu ilk sen aç.</p>
      <div class="oneriler"><button class="dugme dugme-somon" data-yaz="${tur}">${t.fiil}</button></div></div>`;
  }
  const baslik = { soru: 'İlk soruyu sen sor', deneyim: 'İlk deneyimi sen paylaş', rehber: 'İlk üye rehberini sen yaz' }[tur];
  const metin = {
    soru: 'Topluluk yeni açıldı. Evde ya da sınıfta takıldığın bir konu varsa sor; ekibimiz ve diğer üyeler cevaplasın.',
    deneyim: 'Evde ya da sınıfta işe yarayan bir şey denediysen anlat; bir başkasına yol göstersin.',
    rehber: 'Bildiğin bir konuyu adım adım anlatan bir rehber yaz; incelendikten sonra rehberler arasında yayınlansın.'
  }[tur];
  return `<div class="t-bos">${mi(t.mi)}<h3>${baslik}</h3><p>${metin}</p>
    <div class="oneriler">${ONERILER[tur].map(o => `<button class="oneri" data-yaz="${tur}" data-baslik="${kacis(o)}">${kacis(o)}</button>`).join('')}</div>
    <div style="margin-top:18px"><button class="dugme dugme-somon" data-yaz="${tur}">${t.fiil}</button></div></div>`;
}

function sayaclariYaz() {
  const sayi = (tur) => tumGonderiler.filter(o => o.tur === tur).length;
  $('#saySoru').textContent = sayi('soru'); $('#sayDeneyim').textContent = sayi('deneyim'); $('#sayRehber').textContent = sayi('rehber');
}

function listeCiz() {
  document.body.classList.remove('detay');
  sayaclariYaz();
  const sayi = (tur) => tumGonderiler.filter(o => o.tur === tur).length;
  const liste = filtrelenmis();
  const sekme = (tur, ad) => `<button class="t-sekme ${filtre.tur === tur ? 'aktif' : ''}" data-tur="${tur}">${ad}<span class="say">${tur ? sayi(tur) : tumGonderiler.length}</span></button>`;
  $('#anaAlan').innerHTML = `
    <div class="t-arac">
      <div class="t-sekmeler" role="tablist">${sekme('', 'Tümü')}${sekme('soru', 'Sorular')}${sekme('deneyim', 'Deneyimler')}${sekme('rehber', 'Üye Rehberleri')}</div>
      <div class="t-filtre">
        <select class="t-alan" id="fKategori" aria-label="Kategori"><option value="">Tüm konular</option>
          ${Object.entries(KATEGORILER).map(([k, v]) => `<option value="${k}" ${filtre.kategori === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="t-alan" id="fYas" aria-label="Yaş"><option value="">Tüm yaşlar</option>
          ${Object.entries(YASLAR).filter(([k]) => k !== 'genel').map(([k, v]) => `<option value="${k}" ${filtre.yas === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <input class="t-alan t-ara" id="fAra" type="search" placeholder="Toplulukta ara…" value="${kacis(filtre.ara)}" aria-label="Ara">
      </div>
    </div>
    <div class="g-liste" id="gListe">${liste.length ? liste.map(kartHtml).join('') : bosDurumHtml()}</div>`;
  $('#fKategori').onchange = (e) => { filtre.kategori = e.target.value; listeCiz(); };
  $('#fYas').onchange = (e) => { filtre.yas = e.target.value; listeCiz(); };
  const ara = $('#fAra');
  ara.oninput = () => { filtre.ara = ara.value; $('#gListe').innerHTML = (filtrelenmis().map(kartHtml).join('') || bosDurumHtml()); };
  document.title = 'Topluluk — Sorular, Deneyimler ve Üye Rehberleri · Montessori Okulu';
}

async function listeYukle() {
  try { tumGonderiler = await yayindakiGonderiler(); }
  catch (e) { console.error(e); tumGonderiler = []; }
  if (kullanici) {
    try { benimBekleyenlerim = (await benimGonderilerim(kullanici.uid)).filter(o => o.durum === 'beklemede'); }
    catch (e) { benimBekleyenlerim = []; }
  }
}

// ── DETAY ──
async function detayCiz(id) {
  document.body.classList.add('detay');
  $('#anaAlan').innerHTML = '<div class="yukleniyor-k">Yükleniyor…</div>';
  let o = null;
  try { o = await gonderiGetir(id); } catch (e) { o = null; }
  if (!o) {
    $('#anaAlan').innerHTML = `<button class="d-geri" data-geri>${ik('ok-sol')} Topluluğa dön</button>
      <div class="t-bos">${mi('geometrik')}<h3>Bu paylaşım bulunamadı</h3><p>Kaldırılmış ya da henüz incelemede olabilir.</p></div>`;
    return;
  }
  const t = TURLER[o.tur];
  const benim = kullanici && kullanici.uid === o.yazar_uid;
  let cevaplar = [];
  try { cevaplar = o.durum === 'yayinda' ? await cevaplariGetir(o.id) : []; } catch (e) { console.error(e); }
  const cevapAdi = o.tur === 'soru' ? 'Cevaplar' : 'Yorumlar';
  const yaz = o.tur === 'soru' ? 'Cevabını yaz' : 'Yorumunu yaz';
  const yazGiris = o.tur === 'soru' ? 'Cevap yazmak' : 'Yorum yazmak';

  $('#anaAlan').innerHTML = `
    <button class="d-geri" data-geri>${ik('ok-sol')} Topluluğa dön</button>
    ${o.durum !== 'yayinda' ? `<div class="d-uyari">${ik('saat')}<span><b>Bu paylaşım incelemede.</b> Onaylandığında herkes görebilecek; şimdilik yalnızca sen görüyorsun.</span></div>` : ''}
    <article class="d-kart">
      <div class="g-ust"><span class="g-rozet gr-${o.tur}">${t.ad}</span>
        <span class="g-etiket">${kacis(KATEGORILER[o.kategori] || '')}${o.yas && o.yas !== 'genel' ? ' · ' + kacis(YASLAR[o.yas]) : ''}</span></div>
      <h1 class="g-baslik">${kacis(o.baslik)}</h1>
      <div class="d-metin">${kacis(o.metin)}</div>
      <div class="d-alt">
        <span style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${yazarHtml(o)}<span>${tarihYazi(o.olusturma)}</span></span>
        <span style="display:flex;gap:16px">
          ${benim ? `<button class="link-dugme" data-sil="gonderi" data-id="${kacis(o.id)}">${ik('sil')} Sil</button>`
            : `<button class="link-dugme" data-bildir="gonderi" data-id="${kacis(o.id)}" data-gonderi="${kacis(o.id)}">${ik('bilgi')} Bildir</button>`}
        </span>
      </div>
    </article>
    ${o.durum === 'yayinda' ? `
      <h2 class="c-baslik">${cevapAdi} <span style="color:var(--murekkep-s);font-size:16px">(${cevaplar.filter(c => c.durum === 'yayinda').length})</span></h2>
      <div id="cevapListe">${cevaplar.length ? cevaplar.map(c => cevapHtml(c, o.id)).join('')
        : `<div class="c-kart" style="text-align:center;color:var(--murekkep-s)">Henüz ${o.tur === 'soru' ? 'cevap' : 'yorum'} yok. İlk sen yaz.</div>`}</div>
      <div class="c-form" id="cevapForm">${cevapFormHtml(yaz, yazGiris)}</div>` : ''}`;

  document.title = o.baslik + ' — Montessori Okulu Topluluğu';
  const aciklama = document.querySelector('meta[name="description"]');
  if (aciklama) aciklama.setAttribute('content', String(o.metin).replace(/\s+/g, ' ').slice(0, 155));
  cevapFormBagla(o);
  window.scrollTo(0, 0);
}

function cevapHtml(c, gonderiId) {
  const benim = kullanici && kullanici.uid === c.yazar_uid;
  return `<div class="c-kart ${c.uzman ? 'uzman' : ''}">
    <div class="c-ust"><span style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${yazarHtml(c)}
      ${c.uzman ? `<span class="uzman-rozet">${ik('onay', 'ik')} Uzman cevabı</span>` : ''}
      ${c.durum !== 'yayinda' ? '<span class="g-bekliyor">İncelemede</span>' : ''}<span>${tarihYazi(c.olusturma)}</span></span>
      ${benim ? `<button class="link-dugme" data-sil="cevap" data-id="${kacis(c.id)}">${ik('sil')} Sil</button>`
        : `<button class="link-dugme" data-bildir="cevap" data-id="${kacis(c.id)}" data-gonderi="${kacis(gonderiId)}">${ik('bilgi')} Bildir</button>`}</div>
    <div class="c-metin">${kacis(c.metin)}</div></div>`;
}

function cevapFormHtml(yaz, yazGiris) {
  if (!kullanici) {
    return `<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span style="font-size:14px;color:var(--murekkep-o)">${yazGiris} için giriş yapman gerekiyor.</span>
      <a class="dugme dugme-somon dugme-kucuk" href="uyelik.html?donus=${encodeURIComponent(location.pathname.replace(/^\//, '') + location.search)}">Giriş yap / Üye ol</a></div>`;
  }
  return `<label for="cevapMetin" style="font-size:13px;font-weight:800;color:var(--murekkep-o);display:block;margin-bottom:6px">${yaz}</label>
    <textarea class="t-alan" id="cevapMetin" maxlength="${SINIRLAR.cevap}" placeholder="Deneyimine dayanarak, nazik ve somut yaz."></textarea>
    <div class="c-form-alt"><span id="cevapSay">0 / ${SINIRLAR.cevap}</span>
      <span style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${yoneticiMi(kullanici) ? `<label style="display:flex;gap:6px;align-items:center;font-weight:700"><input type="checkbox" id="uzmanMi" checked style="accent-color:var(--yaprak)"> Uzman cevabı</label>` : ''}
        <button class="dugme dugme-somon dugme-kucuk" id="cevapGonder">Gönder</button></span></div>
    <div class="p-hata" id="cevapHata"></div>`;
}

function cevapFormBagla(o) {
  const alan = $('#cevapMetin');
  if (!alan) return;
  alan.oninput = () => { $('#cevapSay').textContent = `${alan.value.length} / ${SINIRLAR.cevap}`; };
  $('#cevapGonder').onclick = async (e) => {
    const metin = alan.value.trim();
    const hata = $('#cevapHata');
    if (metin.length < 2) { hata.textContent = 'Biraz daha yazmalısın.'; hata.style.display = 'block'; return; }
    e.currentTarget.disabled = true; hata.style.display = 'none';
    try {
      const s = await cevapEkle(o.id, metin, { uzman: !!$('#uzmanMi')?.checked });
      bildirimGoster(s.durum === 'yayinda' ? 'Gönderildi, teşekkürler.' : 'Gönderildi. İlk paylaşımın incelendikten sonra yayına girecek.');
      await detayCiz(o.id);
    } catch (err) {
      console.error(err);
      hata.textContent = 'Gönderilemedi: ' + hataMetni(err); hata.style.display = 'block';
      e.currentTarget.disabled = false;
    }
  };
}

// ── PENCERE (paylaşım, bildirim, silme) ──
function pencereAc(html) { $('#pencereIc').innerHTML = html; $('#pencere').classList.add('acik'); document.body.style.overflow = 'hidden'; }
function pencereKapat() { $('#pencere').classList.remove('acik'); document.body.style.overflow = ''; }
const kapatDugmesi = `<button class="p-kapat" data-kapat aria-label="Kapat">${ik('carpi')}</button>`;

async function yazmaPenceresi(tur = 'soru', baslik = '') {
  if (!kullanici) {
    pencereAc(`<div class="p-bas"><h3 id="pencereBaslik">Paylaşmak için giriş yap</h3>${kapatDugmesi}</div>
      <div class="p-sonuc">${mi('alfabe')}<h3>Topluluğa katıl</h3>
        <p>Soru sormak, deneyim ve rehber paylaşmak için ücretsiz üye ol ya da giriş yap. Okumak herkese açık.</p>
        <a class="dugme dugme-somon" href="uyelik.html?donus=topluluk.html">Giriş yap / Üye ol</a></div>`);
    return;
  }
  let profil = {};
  try { profil = (await profilGetir(kullanici.uid)) || {}; } catch (e) {}
  const ad = gorunenAd(profil.ad_soyad || kullanici.displayName, kullanici.email);
  const turButon = (k) => `<button type="button" data-tur-sec="${k}" class="${k === tur ? 'secili' : ''}">${mi(TURLER[k].mi)}${TURLER[k].ad}</button>`;
  pencereAc(`
    <div class="p-bas"><h3 id="pencereBaslik">Toplulukla paylaş</h3>${kapatDugmesi}</div>
    <form id="yazForm" novalidate>
      <div class="p-govde">
        <div class="p-tur">${turButon('soru')}${turButon('deneyim')}${turButon('rehber')}</div>
        <div class="p-grup"><label for="yBaslik">Başlık</label>
          <input class="t-alan" id="yBaslik" maxlength="${SINIRLAR.baslik}" value="${kacis(baslik)}" placeholder="Kısa ve açık bir başlık"></div>
        <div class="p-grup"><label for="yMetin" id="yMetinEtiket">Ayrıntılar</label>
          <textarea class="t-alan" id="yMetin" placeholder=""></textarea>
          <div class="p-ipucu"><span id="yIpucu"></span><span id="ySay"></span></div></div>
        <div class="p-satir">
          <div class="p-grup"><label for="yKategori">Konu</label>
            <select class="t-alan" id="yKategori"><option value="">Seç</option>${Object.entries(KATEGORILER).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="p-grup"><label for="yYas">Yaş grubu</label>
            <select class="t-alan" id="yYas">${Object.entries(YASLAR).map(([k, v]) => `<option value="${k}" ${k === 'genel' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <label class="p-onay"><input type="checkbox" id="yOnay">
          <span>Paylaşımımda çocukların tam adı, okulu, fotoğrafı ya da sağlık bilgisi gibi kimliğini belli edecek bir şey yok. Topluluk kurallarına uyuyorum.</span></label>
        <div class="p-hata" id="yHata"></div>
      </div>
      <div class="p-alt">
        <span class="p-ad">Toplulukta <b>${kacis(ad)}</b> olarak görüneceksin. <a href="profil.html#profil" style="text-decoration:underline">Adını değiştir</a></span>
        <button type="submit" class="dugme dugme-somon" id="yGonder">Paylaş</button>
      </div>
    </form>`);

  const turAyarla = (k) => {
    tur = k;
    document.querySelectorAll('[data-tur-sec]').forEach(b => b.classList.toggle('secili', b.dataset.turSec === k));
    const sinir = k === 'rehber' ? SINIRLAR.rehberMetin : SINIRLAR.metin;
    const metin = $('#yMetin'); metin.maxLength = sinir;
    metin.placeholder = { soru: 'Durumu anlat: çocuğun yaşı, ne denedin, nerede takıldın?', deneyim: 'Ne denedin, nasıl hazırladın, ne oldu? Başkasına ne önerirsin?', rehber: 'Konuyu adım adım anlat. Gerekli malzemeler, hazırlık, dikkat edilecekler…' }[k];
    $('#yMetinEtiket').textContent = { soru: 'Sorunun ayrıntıları', deneyim: 'Deneyimin', rehber: 'Rehberin' }[k];
    $('#yIpucu').textContent = k === 'rehber' ? 'Rehberler yayından önce incelenir.' : '';
    $('#ySay').textContent = `${metin.value.length} / ${sinir}`;
  };
  document.querySelectorAll('[data-tur-sec]').forEach(b => b.addEventListener('click', () => turAyarla(b.dataset.turSec)));
  $('#yMetin').addEventListener('input', () => { $('#ySay').textContent = `${$('#yMetin').value.length} / ${$('#yMetin').maxLength}`; });
  turAyarla(tur);
  setTimeout(() => (baslik ? $('#yMetin') : $('#yBaslik')).focus(), 50);

  $('#yazForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hata = $('#yHata');
    const v = { tur, baslik: $('#yBaslik').value.trim(), metin: $('#yMetin').value.trim(), kategori: $('#yKategori').value, yas: $('#yYas').value };
    const sorun = v.baslik.length < 5 ? 'Başlık en az 5 karakter olmalı.'
      : v.metin.length < 10 ? 'Biraz daha ayrıntı yaz (en az 10 karakter).'
      : !v.kategori ? 'Bir konu seç.'
      : !$('#yOnay').checked ? 'Göndermeden önce mahremiyet onayını işaretle.' : '';
    if (sorun) { hata.textContent = sorun; hata.style.display = 'block'; return; }
    hata.style.display = 'none';
    const dugme = $('#yGonder'); dugme.disabled = true; dugme.textContent = 'Gönderiliyor…';
    try {
      const s = await gonderiOlustur(v);
      const yayinda = s.durum === 'yayinda';
      $('#pencereIc').innerHTML = `<div class="p-bas"><h3 id="pencereBaslik">${yayinda ? 'Yayında' : 'İncelemeye alındı'}</h3>${kapatDugmesi}</div>
        <div class="p-sonuc">${mi(yayinda ? 'yaprak' : 'merdiven')}
          <h3>${yayinda ? 'Paylaşımın yayında, teşekkürler.' : 'Teşekkürler, paylaşımın alındı.'}</h3>
          <p>${yayinda ? 'Toplulukta herkes görebilir. Cevaplar geldikçe profilinden takip edebilirsin.'
            : 'İlk paylaşımlar kısa bir incelemeden sonra yayına girer. Onaylandıktan sonraki paylaşımların hemen görünür.'}</p>
          <button class="dugme dugme-somon" data-ac="${kacis(s.id)}" data-kapat>Paylaşımı gör</button></div>`;
      await listeYukle();
    } catch (err) {
      console.error(err);
      hata.textContent = 'Gönderilemedi: ' + hataMetni(err); hata.style.display = 'block';
      dugme.disabled = false; dugme.textContent = 'Paylaş';
    }
  });
}

function bildirPenceresi(tur, id, gonderiId) {
  if (!kullanici) { yazmaPenceresi(); return; }
  const nedenler = ['Reklam ya da spam', 'Çocuğun mahremiyetini ihlal ediyor', 'Kaba ya da uygunsuz dil', 'Yanlış ya da zararlı bilgi', 'Diğer'];
  pencereAc(`<div class="p-bas"><h3 id="pencereBaslik">Bildir</h3>${kapatDugmesi}</div>
    <div class="p-govde">
      <p style="font-size:14px;color:var(--murekkep-o);margin-bottom:14px">Bu içerikte bir sorun mu var? Ekibimiz inceleyecek. Bildirimin kimseyle paylaşılmaz.</p>
      <div class="p-grup"><label for="bNeden">Neden</label>
        <select class="t-alan" id="bNeden">${nedenler.map(n => `<option>${n}</option>`).join('')}</select></div>
      <div class="p-grup"><label for="bAciklama">Açıklama <span style="font-weight:500">(isteğe bağlı)</span></label>
        <textarea class="t-alan" id="bAciklama" maxlength="240" style="min-height:80px"></textarea></div>
      <div class="p-hata" id="bHata"></div>
    </div>
    <div class="p-alt"><span></span><button class="dugme dugme-somon" id="bGonder">Bildir</button></div>`);
  $('#bGonder').onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const aciklama = $('#bAciklama').value.trim();
      await bildir(tur, id, gonderiId, $('#bNeden').value + (aciklama ? ': ' + aciklama : ''));
      pencereKapat(); bildirimGoster('Bildirimin alındı, teşekkürler.');
    } catch (err) { $('#bHata').textContent = hataMetni(err); $('#bHata').style.display = 'block'; e.currentTarget.disabled = false; }
  };
}

function silPenceresi(tur, id) {
  pencereAc(`<div class="p-bas"><h3 id="pencereBaslik">Silinsin mi?</h3>${kapatDugmesi}</div>
    <div class="p-govde"><p style="font-size:14.5px;color:var(--murekkep-o)">Bu ${tur === 'cevap' ? 'cevap' : 'paylaşım'} kalıcı olarak silinecek. Bu işlem geri alınamaz.</p></div>
    <div class="p-alt"><button class="dugme dugme-hayalet" data-kapat>Vazgeç</button><button class="dugme dugme-somon" id="silOnay">Sil</button></div>`);
  $('#silOnay').onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await kendiIceriginiSil(tur, id);
      pencereKapat(); bildirimGoster('Silindi.');
      if (tur === 'gonderi') { await listeYukle(); git(null); } else { await detayCiz(new URLSearchParams(location.search).get('g')); }
    } catch (err) { bildirimGoster('Silinemedi: ' + hataMetni(err)); e.currentTarget.disabled = false; }
  };
}

// ── Yönlendirme ──
function git(id, ekle = true) {
  const yol = location.pathname;
  const url = id ? `${yol}?g=${encodeURIComponent(id)}` : `${yol}${filtre.tur ? '?tur=' + filtre.tur : ''}`;
  if (ekle) history.pushState({ id }, '', url);
  if (id) detayCiz(id); else listeCiz();
}
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  filtre.tur = TURLER[p.get('tur')] ? p.get('tur') : '';
  git(p.get('g'), false);
});

document.addEventListener('click', (e) => {
  const kapat = e.target.closest('[data-kapat]');
  const ac = e.target.closest('[data-ac]');
  if (kapat) pencereKapat();
  if (ac) { e.preventDefault(); git(ac.dataset.ac); return; }
  if (kapat) return;
  const yaz = e.target.closest('[data-yaz]');
  if (yaz) { yazmaPenceresi(yaz.dataset.yaz, yaz.dataset.baslik || ''); return; }
  const tur = e.target.closest('[data-tur]');
  if (tur) { filtre.tur = tur.dataset.tur; git(null); return; }
  if (e.target.closest('[data-geri]')) { git(null); return; }
  const b = e.target.closest('[data-bildir]');
  if (b) { bildirPenceresi(b.dataset.bildir, b.dataset.id, b.dataset.gonderi); return; }
  const s = e.target.closest('[data-sil]');
  if (s) { silPenceresi(s.dataset.sil, s.dataset.id); return; }
  if (e.target.id === 'pencere') pencereKapat();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pencereKapat(); });
$('#hamburger').addEventListener('click', () => $('#mobilMenu').classList.toggle('acik'));

// ── Başlangıç ──
let ilk = true;
oturumDinle(async (u) => {
  kullanici = u;
  if (u) {
    const g = $('#girisDugme'); g.textContent = 'Profilim'; g.href = 'profil.html';
    $('#uyeDugme').style.display = 'none';
  }
  if (!ilk) return;
  ilk = false;
  await listeYukle();
  const p = new URLSearchParams(location.search);
  filtre.tur = TURLER[p.get('tur')] ? p.get('tur') : '';
  git(p.get('g'), false);
  if (p.get('yaz') && TURLER[p.get('yaz')]) yazmaPenceresi(p.get('yaz'));
});
