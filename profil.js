// Üye profil sayfası — üyelik tipine göre (ebeveyn / öğretmen / meraklı) içerik üretir.
// Veri: Firestore profiller/{uid}. Giriş: oturum.js (Firebase Authentication).
import {
  kimlik, oturumDinle, profilGetir, profilGuncelle, cikisYap,
  sifreSifirlamaGonder, dogrulamaTekrarGonder, hataMetni, GOREVLER, ILGI_ALANLARI
} from './oturum.js';
import { benimGonderilerim, benimCevaplarim, TURLER as T_TURLER, tarihYazi } from './topluluk-veri.js';

// Önizleme yetkisi olan yönetici hesapları (admin.html ile aynı)
const YONETICILER = ['emrahby@gmail.com', 'eposta@bircicekkoleji.com'];

// ── Sabit içerikler (ana sayfadaki kitaplık ve seminerlerle aynı) ──
const ILGI_ETIKET = {
  hazirlanmis_ortam: 'Hazırlanmış ortam', gunluk_yasam: 'Günlük yaşam becerileri',
  hassas_donemler: 'Hassas dönemler', matematik: 'Matematik', dil: 'Dil gelişimi',
  orman_okulu: 'Orman okulu', okul_secimi: 'Okul seçimi', ev_uygulamalari: 'Evde uygulama'
};
const GOREV_ETIKET = {
  montessori_ogretmeni: 'Montessori öğretmeni', asistan: 'Sınıf asistanı', yonetici: 'Okul yöneticisi',
  ogretmen_adayi: 'Öğretmen adayı / öğrenci', diger: 'Diğer'
};
const TUR_IKON = { Blog: 'yazi', Podcast: 'mikrofon', Video: 'video' };
const TUR_RENK = { Blog: 'oi-v', Podcast: 'oi-b', Video: 'oi-o' };

const KITAPLIK = [
  { id: 'nedir', tur: 'Video', kategori: 'Başlangıç', baslik: 'Montessori Nedir? 5 Dakikada Temel Kavramlar', meta: 'Video', durum: 'Hazırlanıyor', tipler: ['merakli', 'ebeveyn'] },
  { id: 'sss10', tur: 'Podcast', kategori: 'Giriş', baslik: 'Montessori Hakkında En Sık Sorulan 10 Soru', meta: 'Bölüm 1 · 18 dk', durum: 'Yakında', tipler: ['merakli', 'ebeveyn'] },
  { id: 'hassas', tur: 'Blog', kategori: 'Çocuk Gelişimi', baslik: 'Hassas Dönemler: Çocuğunuzun Öğrenme Pencereleri', meta: '7 dk okuma', durum: 'Yakında', tipler: ['ebeveyn', 'merakli', 'ogretmen'] },
  { id: 'ortam', tur: 'Podcast', kategori: 'Gelişim', baslik: 'Hazırlanmış Ortam: Beyin ve Mekân Arasındaki Bağ', meta: 'Bölüm 2 · 22 dk', durum: 'Yakında', tipler: ['ogretmen', 'ebeveyn', 'merakli'] },
  { id: 'evortam', tur: 'Video', kategori: 'Ebeveyn', baslik: 'Evde Hazırlanmış Ortam Nasıl Kurulur?', meta: 'Video', durum: 'Hazırlanıyor', tipler: ['ebeveyn'] },
  { id: 'bagimsizlik', tur: 'Blog', kategori: 'Ebeveyn Rehberi', baslik: 'Bağımsızlık Nasıl Kazanılır? "Yapıyorum!" Diyen Çocuk', meta: '6 dk okuma', durum: 'Yakında', tipler: ['ebeveyn'] },
  { id: 'mutfak', tur: 'Video', kategori: 'Günlük Yaşam', baslik: 'Çocuğunuzu Mutfağa Dahil Edin', meta: 'Video', durum: 'Hazırlanıyor', tipler: ['ebeveyn'] },
  { id: 'pencere', tur: 'Podcast', kategori: 'Gelişim', baslik: 'Hassas Dönemler: Pencereleri Yakalamak', meta: 'Bölüm 3 · 25 dk', durum: 'Yakında', tipler: ['ebeveyn', 'merakli', 'ogretmen'] },
  { id: 'matematik', tur: 'Blog', kategori: 'Öğretmen Kaynakları', baslik: 'Montessori Matematikle Arkadaş Olur', meta: '8 dk okuma', durum: 'Yakında', tipler: ['ogretmen'] },
  { id: 'raf', tur: 'Video', kategori: 'Öğretmen', baslik: 'Sınıf Ortamı: Raf Organizasyonu İpuçları', meta: 'Video', durum: 'Hazırlanıyor', tipler: ['ogretmen'] },
  { id: 'motivasyon', tur: 'Podcast', kategori: 'Pedagoji', baslik: 'Motivasyonun Kaynağı: İçsel mi, Dışsal mı?', meta: 'Bölüm 4 · 20 dk', durum: 'Yakında', tipler: ['ogretmen', 'ebeveyn'] },
  { id: 'orman', tur: 'Blog', kategori: 'Orman Okulu', baslik: 'Orman Okulu Nedir? Doğanın İçinde Büyümek', meta: '6 dk okuma', durum: 'Yakında', tipler: ['ebeveyn', 'merakli'] }
];
const SEMINERLER = [
  { baslik: "Montessori'ye Giriş: Temel Kavramlar", tur: 'Online', kitle: 'Ebeveyn ve öğretmenler için', tipler: ['ebeveyn', 'ogretmen', 'merakli'] },
  { baslik: 'Hazırlanmış Ortam Atölyesi: Evde ve Sınıfta', tur: 'Online', kitle: 'Uygulamalı atölye', tipler: ['ebeveyn', 'ogretmen'] }
];

// ── Üyelik tiplerine özel yapı ──
const TIPLER = {
  ebeveyn: {
    ad: 'Ebeveyn', etiket: 'Ebeveyn Üyesi', harf: 'E', renk: '#F4857A',
    tanim: 'Evde uygulamak, okul seçmek',
    karsilama: 'Evde Montessori uygulamak, doğru okulu seçmek ve çocuğunu daha iyi anlamak için hazırladığımız içerikler burada toplanıyor.',
    vaatler: ['Evde hazırlanmış ortam rehberleri', 'Yaşa göre etkinlik önerileri', 'Okul seçerken nelere bakılır?'],
    yol: [
      { id: 'evde', ad: 'Evde Montessori', ik: 'ev' },
      { id: 'yas', ad: 'Yaşa Göre Etkinlikler', ik: 'filiz' },
      { id: 'okulsecimi', ad: 'Okul Seçimi', ik: 'okul' }
    ]
  },
  ogretmen: {
    ad: 'Öğretmen', etiket: 'Öğretmen Üyesi', harf: 'Ö', renk: '#4A90C4',
    tanim: 'Sınıfı ve pedagojiyi geliştirmek',
    karsilama: 'Sınıfını geliştirmek ve pedagojini derinleştirmek için hazırladığımız kaynaklar, ipuçları ve seminerler burada toplanıyor.',
    vaatler: ['Sınıf ortamı ve materyal rehberleri', 'Gözleme dayalı pratik ipuçları', 'Mesleki gelişim seminerleri'],
    yol: [
      { id: 'sinif', ad: 'Sınıf ve Materyal', ik: 'sinif' },
      { id: 'gozlem', ad: 'Gözlem İpuçları', ik: 'goz' },
      { id: 'gelisim', ad: 'Mesleki Gelişim', ik: 'okul' }
    ]
  },
  merakli: {
    ad: 'Meraklı', etiket: 'Meraklı Üye', harf: 'M', renk: '#5C8A5E',
    tanim: "Montessori'yi yeni keşfetmek",
    karsilama: "Montessori'yi yeni keşfediyorsan doğru yerdesin. Temelleri sağlam kaynaklardan, adım adım öğrenmen için bir yol hazırlıyoruz.",
    vaatler: ['Sıfırdan başlangıç serisi', 'Temel kavram sözlüğü', 'Sık sorulan sorular'],
    yol: [
      { id: 'baslangic', ad: 'Başlangıç Yolu', ik: 'pusula' },
      { id: 'sozluk', ad: 'Kavram Sözlüğü', ik: 'sozluk' },
      { id: 'sss', ad: 'Sık Sorulan Sorular', ik: 'soru' }
    ]
  }
};

// ── Durum ──
let kullanici = null;
let profil = {};
let tip = 'merakli';
let onizleme = false;
let aktifPanel = 'genel';

// ── Yardımcılar ──
const $ = (s) => document.querySelector(s);
const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ik = (ad, sinif = 'ik') => `<svg class="${sinif}" aria-hidden="true"><use href="ikonlar.svg#ik-${ad}"/></svg>`;
const ilkAd = () => (profil.ad_soyad || kullanici?.displayName || '').trim().split(/\s+/)[0] || 'Merhaba';

function bildir(mesaj, tur = 'basarili') {
  const b = $('#bildirim');
  b.className = 'bildirim ' + tur;
  b.innerHTML = ik(tur === 'hata' ? 'carpi' : 'onay', 'ik ik-sm') + ' ' + kacis(mesaj);
  requestAnimationFrame(() => b.classList.add('goster'));
  clearTimeout(bildir.z);
  bildir.z = setTimeout(() => b.classList.remove('goster'), 3200);
}

function durumRozeti(durum) {
  const sinif = durum === 'Planlanıyor' ? 'r-plan' : durum === 'Yayında' ? 'r-hazir' : 'r-yakinda';
  return `<span class="rozet ${sinif}">${ik('saat', 'ik ik-sm')}${kacis(durum)}</span>`;
}

function icerikListesi(ogeler) {
  if (!ogeler.length) return bosDurum('kitap', 'Henüz içerik yok', 'Bu alandaki içerikler yayına girdikçe burada görünecek.');
  return ogeler.map(o => `
    <div class="liste-oge">
      <div class="lo-ik ozet-ik ${TUR_RENK[o.tur]}">${ik(TUR_IKON[o.tur])}</div>
      <div class="lo-bilgi">
        <div class="lo-ust">${kacis(o.tur)} · ${kacis(o.kategori)}</div>
        <div class="lo-baslik">${kacis(o.baslik)}</div>
        <div class="lo-meta">${kacis(o.meta)}</div>
      </div>
      ${durumRozeti(o.durum)}
    </div>`).join('');
}

function bosDurum(ikon, baslik, metin, dugme = '') {
  return `<div class="bos"><div class="bos-ik">${ik(ikon)}</div>
    <div class="bos-baslik">${kacis(baslik)}</div><div class="bos-metin">${metin}</div>${dugme}</div>`;
}

function kart(baslik, ikon, govde, sag = '') {
  return `<div class="kart"><div class="kart-bas"><div class="kart-baslik">${ik(ikon)} ${kacis(baslik)}</div>${sag}</div>
    <div class="kart-govde">${govde}</div></div>`;
}

const tipIcerikleri = (t = tip) => KITAPLIK.filter(o => o.tipler.includes(t));

// Profil tamamlanma oranı (tipine göre beklenen alanlar)
function tamamlanma() {
  const alanlar = [!!profil.ad_soyad, (profil.ilgi_alanlari || []).length > 0];
  if (tip === 'ebeveyn') alanlar.push(!!profil.cocuk_yasi);
  if (tip === 'ogretmen') alanlar.push(!!profil.okul_adi, !!profil.gorev);
  return Math.round(alanlar.filter(Boolean).length / alanlar.length * 100);
}

// ── Paneller ──
function panelGenel() {
  const t = TIPLER[tip];
  const oran = tamamlanma();
  const icerikler = tipIcerikleri();
  const seminerSay = SEMINERLER.filter(s => s.tipler.includes(tip)).length;
  return `
    <section class="karsilama">
      <div class="k-ust">${ik('yildiz', 'ik ik-sm')} ${kacis(t.etiket)}</div>
      <div class="k-baslik">Hoş geldin, ${kacis(ilkAd())}</div>
      <p class="k-metin">${kacis(t.karsilama)}</p>
      <div class="k-dugmeler">
        <button class="btn btn-v" data-git="${t.yol[0].id}">${ik(t.yol[0].ik)} ${kacis(t.yol[0].ad)}</button>
        ${oran < 100 ? `<button class="btn btn-acik" data-git="profil">${ik('kalem')} Profilini tamamla</button>` : ''}
      </div>
    </section>

    <div class="ozet-izgara">
      <div class="ozet"><div class="ozet-ik oi-v">${ik('kisi')}</div>
        <div style="flex:1"><div class="ozet-sayi">%${oran}</div><div class="ozet-etiket">Profil tamamlandı</div>
        <div class="ilerleme"><span style="width:${oran}%"></span></div></div></div>
      <div class="ozet"><div class="ozet-ik oi-b">${ik('kitap')}</div>
        <div><div class="ozet-sayi">${icerikler.length}</div><div class="ozet-etiket">Senin için hazırlanan içerik</div></div></div>
      <div class="ozet"><div class="ozet-ik oi-o">${ik('takvim')}</div>
        <div><div class="ozet-sayi">${seminerSay}</div><div class="ozet-etiket">Planlanan seminer</div></div></div>
    </div>

    <div class="hizli-izgara">
      ${t.yol.map(y => `<button class="hizli" data-git="${y.id}"><div class="hizli-ik">${ik(y.ik)}</div>
        <div class="hizli-baslik">${kacis(y.ad)}</div><div class="hizli-alt">Senin yolun</div></button>`).join('')}
      ${tip === 'ogretmen'
        ? `<button class="hizli" data-git="kaydedilen"><div class="hizli-ik">${ik('isaret')}</div>
            <div class="hizli-baslik">Kaydettiklerim</div><div class="hizli-alt">Sonra dönmek için</div></button>`
        : `<button class="hizli" data-git="seminer"><div class="hizli-ik">${ik('takvim')}</div>
            <div class="hizli-baslik">Seminerler</div><div class="hizli-alt">Online etkinlikler</div></button>`}
    </div>

    <div class="iki-sutun">
      ${kart('Senin için hazırlananlar', 'kitap', icerikListesi(icerikler.slice(0, 4)),
        `<button class="btn btn-hayalet btn-kucuk" data-git="${t.yol[0].id}">Tümü ${ik('ok-sag', 'ik ik-sm')}</button>`)}
      ${kart(`${t.ad} yolunda neler var?`, 'pusula', `
        <div class="adimlar">${t.vaatler.map(v => `<div class="adim"><div class="adim-no"></div>
          <div class="lo-bilgi"><div class="lo-baslik">${kacis(v)}</div><div class="lo-meta">Hazırlanıyor, yayına girdiğinde buradan ulaşacaksın.</div></div></div>`).join('')}</div>`)}
    </div>`;
}

function panelSeminer() {
  const liste = SEMINERLER.filter(s => s.tipler.includes(tip));
  return `
    <div class="uyari uyari-mavi">${ik('bilgi')}<div><strong>Yeni dönem seminerleri hazırlanıyor.</strong>
      Tarihler netleştiğinde buradan tek tıkla kayıt olabileceksin. Duyurular Instagram hesabımızda da paylaşılıyor.</div></div>
    ${kart('Planlanan seminerler', 'takvim', liste.map(s => `
      <div class="liste-oge">
        <div class="lo-ik ozet-ik oi-o">${ik('takvim')}</div>
        <div class="lo-bilgi"><div class="lo-ust">${kacis(s.tur)} · Tarih yakında</div>
          <div class="lo-baslik">${kacis(s.baslik)}</div><div class="lo-meta">${kacis(s.kitle)}</div></div>
        ${durumRozeti('Planlanıyor')}
      </div>`).join(''),
      `<a class="btn btn-hayalet btn-kucuk" href="https://www.instagram.com/montessoriokulucom/" target="_blank" rel="noopener">Instagram ${ik('ok-sag', 'ik ik-sm')}</a>`)}
    ${kart('Kayıtlarım', 'onay', bosDurum('takvim', 'Henüz bir seminere kayıtlı değilsin', 'Seminer takvimi açıldığında kayıt olduğun etkinlikler ve katılım bağlantıları burada görünecek.'))}`;
}

async function panelPaylasimlar() {
  if (onizleme) return kart('Paylaşımlarım', 'sohbet', bosDurum('sohbet', 'Önizlemede paylaşımlar gösterilmez', 'Bu bölüm üyenin kendi soru, deneyim ve cevaplarını listeler.'));
  let g = [], c = [];
  try { [g, c] = await Promise.all([benimGonderilerim(kullanici.uid), benimCevaplarim(kullanici.uid)]); } catch (e) { console.error(e); }
  const durum = (d) => d === 'yayinda' ? '<span class="rozet r-hazir">Yayında</span>' : d === 'beklemede' ? '<span class="rozet r-plan">İncelemede</span>' : '<span class="rozet r-yakinda">Gizlendi</span>';
  const ust = `<div class="hizli-izgara" style="grid-template-columns:repeat(3,1fr)">
      ${['soru', 'deneyim', 'rehber'].map(t => `<a class="hizli" href="topluluk.html?yaz=${t}"><div class="hizli-ik">${ik(T_TURLER[t].ik)}</div>
        <div class="hizli-baslik">${T_TURLER[t].fiil}</div><div class="hizli-alt">Toplulukta</div></a>`).join('')}</div>`;
  const gHtml = g.length ? g.map(o => `<a class="liste-oge" href="topluluk.html?g=${encodeURIComponent(o.id)}">
      <div class="lo-ik ozet-ik oi-v">${ik(T_TURLER[o.tur]?.ik || 'sohbet')}</div>
      <div class="lo-bilgi"><div class="lo-ust">${kacis(T_TURLER[o.tur]?.ad || '')} · ${tarihYazi(o.olusturma)}</div>
        <div class="lo-baslik">${kacis(o.baslik)}</div><div class="lo-meta">${o.cevap_sayisi || 0} ${o.tur === 'soru' ? 'cevap' : 'yorum'}</div></div>
      ${durum(o.durum)}</a>`).join('')
    : bosDurum('sohbet', 'Henüz bir paylaşımın yok', 'Topluluğa ilk sorunu sor ya da bir deneyimini paylaş.', `<a class="btn btn-v" href="topluluk.html">${ik('uyeler')} Topluluğa git</a>`);
  const cHtml = c.length ? c.map(o => `<a class="liste-oge" href="topluluk.html?g=${encodeURIComponent(o.gonderi_id)}">
      <div class="lo-ik ozet-ik oi-b">${ik('sohbet')}</div>
      <div class="lo-bilgi"><div class="lo-ust">Cevap · ${tarihYazi(o.olusturma)}</div>
        <div class="lo-baslik" style="font-weight:600">${kacis(String(o.metin).slice(0, 120))}${String(o.metin).length > 120 ? '…' : ''}</div></div>
      ${durum(o.durum)}</a>`).join('') : '';
  return ust + kart('Paylaşımlarım', 'sohbet', gHtml, `<a class="btn btn-hayalet btn-kucuk" href="topluluk.html">Topluluk ${ik('ok-sag', 'ik ik-sm')}</a>`)
    + (cHtml ? kart('Cevaplarım ve yorumlarım', 'sohbet', cHtml) : '');
}

function panelKaydedilenler() {
  return kart('Kaydettiklerim', 'isaret', bosDurum('isaret', 'Kaydedilen içerik yok',
    'İçerikler yayına girdiğinde beğendiğin yazıları, podcast bölümlerini ve videoları buraya kaydedip istediğin zaman dönebileceksin.',
    `<button class="btn btn-v" data-git="genel">${ik('kitap')} Senin için hazırlananlara bak</button>`));
}

// Tipine özel paneller
function panelYol(id) {
  const icerikFiltre = (kategoriler) => KITAPLIK.filter(o => o.tipler.includes(tip) && (!kategoriler || kategoriler.includes(o.id)));
  switch (id) {
    // ── EBEVEYN ──
    case 'evde':
      return `
        <div class="uyari uyari-mavi">${ik('ev')}<div><strong>Kardeş sitemiz evdemontessori.com yeniden açılmaya hazırlanıyor:</strong>
          yaşa göre ev rehberleri, oda oda hazırlanmış ortam fikirleri, indirilebilir listeler ve ev danışmanlığı.
          <br><a class="btn btn-hayalet btn-kucuk" href="https://www.instagram.com/evdemontessoricom/" target="_blank" rel="noopener">@evdemontessoricom ${ik('ok-sag', 'ik ik-sm')}</a></div></div>
        ${kart('Evde Montessori içerikleri', 'ev', icerikListesi(icerikFiltre(['evortam', 'mutfak', 'bagimsizlik', 'ortam'])))}`;
    case 'yas': {
      const yas = profil.cocuk_yasi;
      return `
        ${yas
          ? `<div class="uyari uyari-mavi">${ik('filiz')}<div>Çocuğunun yaşı: <strong>${kacis(yas)}</strong>. Öneriler bu yaşa göre sıralanacak.</div></div>`
          : `<div class="uyari uyari-turuncu">${ik('bilgi')}<div><strong>Çocuğunun yaşını eklersen</strong> etkinlik önerilerini ona göre gösterebiliriz.
              <br><button class="btn btn-hayalet btn-kucuk" data-git="profil">${ik('kalem')} Yaşı ekle</button></div></div>`}
        ${kart('Yaşa göre etkinlik önerileri', 'filiz', bosDurum('filiz', 'Etkinlik önerileri hazırlanıyor',
          'Günlük yaşam becerilerinden duyu etkinliklerine, yaşa uygun öneriler burada listelenecek.'))}
        ${kart('Gelişimi anlamak için', 'isik', icerikListesi(icerikFiltre(['hassas', 'pencere', 'bagimsizlik'])))}`;
    }
    case 'okulsecimi':
      return `
        ${kart('Okul seçerken nelere bakılır?', 'okul', bosDurum('okul', 'Okul seçimi rehberi hazırlanıyor',
          'Bir Montessori okulunu ziyaret ederken nelere dikkat edeceğini adım adım anlatan rehber yayına girdiğinde burada olacak.'))}
        ${kart('Anlattıklarımızın her gün yaşandığı okul', 'filiz', `
          <div class="lo-baslik" style="margin-bottom:6px">Bir Çiçek Koleji Anaokulu · Tuzla</div>
          <div class="lo-meta" style="line-height:1.7">MEB ruhsatlı anaokulu. MACTE sertifikalı Montessori programı, 24–72 ay çocuklar için Montessori sınıfları ve Seviye 3 Orman Okulu.</div>
          <div style="margin-top:14px"><a class="btn btn-v btn-kucuk" href="https://bircicekkoleji.com" target="_blank" rel="noopener">Okulu tanı ${ik('ok-sag', 'ik ik-sm')}</a></div>`)}`;
    // ── ÖĞRETMEN ──
    case 'sinif':
      return `${kart('Sınıf ortamı ve materyal rehberleri', 'sinif', icerikListesi(icerikFiltre(['raf', 'ortam', 'matematik'])))}
        ${kart('İndirilebilir sınıf kaynakları', 'indir', bosDurum('indir', 'Kaynaklar hazırlanıyor',
          'Raf düzeni listeleri, materyal kontrol formları gibi indirilebilir kaynaklar yayına girdiğinde burada olacak.'))}`;
    case 'gozlem':
      return `${kart('Gözleme dayalı pratik ipuçları', 'goz', bosDurum('goz', 'Gözlem ipuçları hazırlanıyor',
          'Sınıfta gözlem yapmak, not tutmak ve gözlemi ortamı hazırlamaya dönüştürmek üzerine pratik ipuçları burada toplanacak.'))}
        ${kart('Pedagojiyi derinleştirmek için', 'isik', icerikListesi(icerikFiltre(['motivasyon', 'hassas', 'pencere'])))}`;
    case 'gelisim':
      return panelSeminer();
    // ── MERAKLI ──
    case 'baslangic': {
      const sira = ['nedir', 'sss10', 'hassas', 'ortam', 'orman'].map(i => KITAPLIK.find(o => o.id === i));
      return `
        <div class="uyari uyari-mavi">${ik('pusula')}<div><strong>Sıfırdan başlangıç serisi.</strong> Aşağıdaki sırayı takip edersen Montessori'nin temel fikirlerini birbirinin üzerine koyarak öğrenirsin.</div></div>
        ${kart('Başlangıç yolun', 'pusula', `<div class="adimlar">${sira.map(o => `
          <div class="adim"><div class="adim-no"></div>
            <div class="lo-bilgi"><div class="lo-ust">${kacis(o.tur)} · ${kacis(o.meta)}</div><div class="lo-baslik">${kacis(o.baslik)}</div></div>
            ${durumRozeti(o.durum)}</div>`).join('')}</div>`)}`;
    }
    case 'sozluk':
      return kart('Temel kavram sözlüğü', 'sozluk', bosDurum('sozluk', 'Sözlük hazırlanıyor',
        "Montessori'de sık geçen kavramların sade Türkçe açıklamaları burada, alfabetik olarak yer alacak."));
    case 'sss':
      return `${kart('Sık sorulan sorular', 'soru', icerikListesi(icerikFiltre(['sss10'])))}
        ${kart('Sorunu sor', 'sohbet', bosDurum('sohbet', 'Toplulukta sor',
          'Aklına takılanı topluluğa sor; ekibimiz ve diğer üyeler cevaplasın.',
          `<a class="btn btn-v" href="topluluk.html?yaz=soru">${ik('soru')} Soru sor</a>`))}`;
  }
  return '';
}

function panelProfil() {
  const secIlgi = new Set(profil.ilgi_alanlari || []);
  return `
    ${onizleme ? `<div class="uyari uyari-turuncu">${ik('goz')}<div><strong>Önizleme modundasın.</strong> Bu formdaki değişiklikler kaydedilmez.</div></div>` : ''}
    <form id="profilForm" autocomplete="on">
      ${kart('Kişisel bilgiler', 'kisi', `
        <div class="form-satir">
          <div class="form-grup"><label class="form-etiket" for="fAd">Ad Soyad</label>
            <input class="form-alan" id="fAd" name="ad" maxlength="120" value="${kacis(profil.ad_soyad || kullanici?.displayName || '')}"></div>
          <div class="form-grup"><label class="form-etiket" for="fEposta">E-posta</label>
            <input class="form-alan" id="fEposta" value="${kacis(kullanici?.email || '')}" disabled>
            <div class="form-ipucu">E-posta adresi giriş hesabına bağlıdır.</div></div>
        </div>`)}

      ${kart('Üyelik tipi', 'pusula', `
        <div class="tip-secim">${Object.entries(TIPLER).map(([anahtar, t]) => `
          <button type="button" class="tip-kart ${anahtar === tip ? 'secili' : ''}" data-tip-sec="${anahtar}">
            <span class="harf" style="background:${t.renk}">${t.harf}</span>
            <span><span class="t-ad" style="display:block">${t.ad}</span><span class="t-acik" style="display:block">${t.tanim}</span></span>
          </button>`).join('')}</div>
        <div class="form-ipucu" style="margin-top:10px">Üyelik tipini değiştirdiğinde menün ve önerilen içerikler ona göre değişir.</div>`)}

      <div id="tipAlanlari"></div>

      ${kart('İlgi alanların', 'kalp', `
        <div class="cipler">${ILGI_ALANLARI.map(a => `
          <button type="button" class="cip ${secIlgi.has(a) ? 'secili' : ''}" data-ilgi="${a}">${ik('onay')}${kacis(ILGI_ETIKET[a])}</button>`).join('')}</div>
        <div class="form-ipucu" style="margin-top:10px">Seçtiğin konular içerik önerilerinde öne çıkarılacak.</div>`)}

      <div class="form-alt">
        <button type="submit" class="btn btn-v" id="kaydetDugme" ${onizleme ? 'disabled' : ''}>${ik('onay')} Kaydet</button>
        <span class="form-ipucu" id="kayitDurum"></span>
      </div>
    </form>`;
}

// Seçili tipe göre ek alanlar
function tipAlanlariHtml(t) {
  if (t === 'ebeveyn') {
    return kart('Çocuğun', 'filiz', `
      <div class="form-grup" style="margin-bottom:0"><label class="form-etiket" for="fCocuk">Çocuğunun yaşı <small>(isteğe bağlı)</small></label>
        <input class="form-alan" id="fCocuk" maxlength="40" placeholder="örn: 3, 5 yaş" value="${kacis(profil.cocuk_yasi || '')}">
        <div class="form-ipucu">Birden fazla çocuk varsa virgülle ayır.</div></div>`);
  }
  if (t === 'ogretmen') {
    return kart('Mesleki bilgiler', 'okul', `
      <div class="form-satir">
        <div class="form-grup" style="margin-bottom:0"><label class="form-etiket" for="fOkul">Okul / kurum <small>(isteğe bağlı)</small></label>
          <input class="form-alan" id="fOkul" maxlength="120" placeholder="Çalıştığın kurum" value="${kacis(profil.okul_adi || '')}"></div>
        <div class="form-grup" style="margin-bottom:0"><label class="form-etiket" for="fGorev">Görevin</label>
          <select class="form-alan" id="fGorev">
            <option value="">Seç</option>
            ${GOREVLER.map(g => `<option value="${g}" ${profil.gorev === g ? 'selected' : ''}>${GOREV_ETIKET[g]}</option>`).join('')}
          </select></div>
      </div>`);
  }
  return '';
}

function panelHesap() {
  const saglayicilar = (kullanici?.providerData || []).map(p => p.providerId);
  const google = saglayicilar.includes('google.com');
  const sifreli = saglayicilar.includes('password');
  const olusturma = profil.olusturma?.toDate ? profil.olusturma.toDate()
    : (kullanici?.metadata?.creationTime ? new Date(kullanici.metadata.creationTime) : null);
  const tarih = olusturma ? olusturma.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  return `
    ${kart('Hesap bilgileri', 'kilit', `
      <div class="bilgi-satir"><div class="bs-ik">${ik('zarf')}</div>
        <div style="min-width:0"><div class="bs-etiket">E-posta</div><div class="bs-deger">${kacis(kullanici?.email || '—')}</div></div>
        ${kullanici?.emailVerified ? `<span class="rozet r-hazir" style="margin-left:auto">${ik('onay', 'ik ik-sm')}Doğrulandı</span>`
          : `<button class="btn btn-hayalet btn-kucuk" id="dogrulaDugme" ${onizleme ? 'disabled' : ''}>Doğrulama e-postası gönder</button>`}</div>
      <div class="bilgi-satir"><div class="bs-ik">${ik('kilit')}</div>
        <div><div class="bs-etiket">Giriş yöntemi</div><div class="bs-deger">${google ? 'Google hesabı' : ''}${google && sifreli ? ' · ' : ''}${sifreli ? 'E-posta ve şifre' : ''}${!google && !sifreli ? '—' : ''}</div></div>
        ${sifreli ? `<button class="btn btn-hayalet btn-kucuk" id="sifreDugme" ${onizleme ? 'disabled' : ''}>Şifre sıfırlama bağlantısı</button>` : ''}</div>
      <div class="bilgi-satir"><div class="bs-ik">${ik('takvim')}</div>
        <div><div class="bs-etiket">Üyelik tarihi</div><div class="bs-deger">${kacis(tarih)}</div></div></div>`)}
    ${kart('Oturum', 'cikis', `
      <div class="lo-meta" style="margin-bottom:14px">Bu cihazdaki oturumunu kapatır. Bilgilerin silinmez.</div>
      <button class="btn btn-kirmizi" id="hesapCikis">${ik('cikis')} Çıkış yap</button>`)}`;
}

// ── Menü ve panel çizimi ──
function menuKur() {
  const t = TIPLER[tip];
  const link = (id, ad, ikon, etiket = '') =>
    `<button class="yan-link ${aktifPanel === id ? 'aktif' : ''}" data-git="${id}" type="button">${ik(ikon)} ${kacis(ad)}${etiket ? `<span class="yan-etiket">${etiket}</span>` : ''}</button>`;
  $('#yanNav').innerHTML = `
    <div class="yan-bolum">Genel</div>
    ${link('genel', 'Genel Bakış', 'pano')}
    <div class="yan-bolum">${kacis(t.ad)} Yolu</div>
    ${t.yol.map(y => link(y.id, y.ad, y.ik)).join('')}
    <div class="yan-bolum">Topluluk</div>
    <a class="yan-link" href="topluluk.html">${ik('uyeler')} Topluluk</a>
    ${link('paylasimlar', 'Paylaşımlarım', 'sohbet')}
    ${tip === 'ogretmen' ? '' : link('seminer', 'Seminerler', 'takvim')}
    ${link('kaydedilen', 'Kaydettiklerim', 'isaret')}
    <div class="yan-bolum">Hesabım</div>
    ${link('profil', 'Profil Bilgilerim', 'kisi', tamamlanma() < 100 ? '%' + tamamlanma() : '')}
    ${link('hesap', 'Hesap ve Güvenlik', 'kilit')}`;
}

function panelBasligi(id) {
  const yol = TIPLER[tip].yol.find(y => y.id === id);
  if (yol) return yol.ad;
  return { genel: 'Genel Bakış', paylasimlar: 'Paylaşımlarım', seminer: 'Seminerler', kaydedilen: 'Kaydettiklerim', profil: 'Profil Bilgilerim', hesap: 'Hesap ve Güvenlik' }[id] || 'Genel Bakış';
}

function panelGoster(id) {
  const gecerli = ['genel', 'paylasimlar', 'seminer', 'kaydedilen', 'profil', 'hesap', ...TIPLER[tip].yol.map(y => y.id)];
  if (!gecerli.includes(id)) id = 'genel';
  if (id === 'seminer' && tip === 'ogretmen') id = 'gelisim';
  aktifPanel = id;
  if (id === 'paylasimlar') {
    $('#icerik').innerHTML = '<div class="panel aktif"><div class="bos"><div class="bos-metin">Yükleniyor…</div></div></div>';
    panelPaylasimlar().then(h => { if (aktifPanel === 'paylasimlar') $('#icerik').innerHTML = `<div class="panel aktif">${h}</div>`; });
  }
  const html = id === 'paylasimlar' ? null : id === 'genel' ? panelGenel() : id === 'seminer' ? panelSeminer() : id === 'kaydedilen' ? panelKaydedilenler()
    : id === 'profil' ? panelProfil() : id === 'hesap' ? panelHesap() : panelYol(id);
  if (html !== null) $('#icerik').innerHTML = `<div class="panel aktif">${html}</div>`;
  $('#ustBaslik').textContent = panelBasligi(id);
  document.title = panelBasligi(id) + ' — Montessori Okulu';
  menuKur();
  document.body.classList.remove('menu-acik');
  if (id === 'profil') profilFormBagla();
  if (id === 'hesap') hesapBagla();
  try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (e) {}
  window.scrollTo(0, 0);
}

function kimlikCiz() {
  const t = TIPLER[tip];
  document.body.dataset.tip = tip;
  const ad = profil.ad_soyad || kullanici?.displayName || kullanici?.email || 'Üye';
  $('#kisiAd').textContent = ad;
  $('#kisiTip').textContent = t.etiket;
  const av = $('#avatar');
  if (kullanici?.photoURL) {
    av.innerHTML = '';
    const img = document.createElement('img');
    img.src = kullanici.photoURL; img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onerror = () => { av.textContent = (ad.trim()[0] || t.harf).toLocaleUpperCase('tr-TR'); };
    av.appendChild(img);
  } else {
    av.textContent = (ad.trim()[0] || t.harf).toLocaleUpperCase('tr-TR');
  }
}

function onizlemeSeridi() {
  const s = $('#onizlemeSerit');
  if (!onizleme) { s.innerHTML = ''; return; }
  s.innerHTML = `<div class="onizleme-serit">${ik('goz', 'ik ik-sm')} Yönetici önizlemesi: <strong>${TIPLER[tip].etiket}</strong>
    <span class="ayrac">|</span>
    ${Object.keys(TIPLER).filter(k => k !== tip).map(k => `<a href="?onizle=${k}">${TIPLER[k].ad} profiline bak</a>`).join(' <span class="ayrac">·</span> ')}
    <span class="ayrac">|</span> <a href="profil.html">Önizlemeyi kapat</a></div>`;
}

// ── Form ve hesap olayları ──
function profilFormBagla() {
  let seciliTip = tip;
  const tipAlan = $('#tipAlanlari');
  tipAlan.innerHTML = tipAlanlariHtml(seciliTip);

  document.querySelectorAll('[data-tip-sec]').forEach(d => d.addEventListener('click', () => {
    seciliTip = d.dataset.tipSec;
    document.querySelectorAll('[data-tip-sec]').forEach(x => x.classList.toggle('secili', x === d));
    tipAlan.innerHTML = tipAlanlariHtml(seciliTip);
  }));
  document.querySelectorAll('[data-ilgi]').forEach(c => c.addEventListener('click', () => {
    const secililer = document.querySelectorAll('[data-ilgi].secili').length;
    if (!c.classList.contains('secili') && secililer >= 8) return;
    c.classList.toggle('secili');
  }));

  $('#profilForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (onizleme) return;
    const dugme = $('#kaydetDugme');
    dugme.disabled = true;
    $('#kayitDurum').textContent = 'Kaydediliyor…';
    const alanlar = {
      ad_soyad: $('#fAd').value,
      uyelik_tipi: seciliTip,
      ilgi_alanlari: [...document.querySelectorAll('[data-ilgi].secili')].map(c => c.dataset.ilgi)
    };
    if (seciliTip === 'ebeveyn') alanlar.cocuk_yasi = $('#fCocuk')?.value || '';
    if (seciliTip === 'ogretmen') { alanlar.okul_adi = $('#fOkul')?.value || ''; alanlar.gorev = $('#fGorev')?.value || ''; }
    try {
      await profilGuncelle(kullanici, alanlar);
      profil = (await profilGetir(kullanici.uid)) || profil;
      const tipDegisti = seciliTip !== tip;
      tip = profil.uyelik_tipi || seciliTip;
      kimlikCiz();
      bildir(tipDegisti ? `Kaydedildi. Artık ${TIPLER[tip].etiket} olarak görüyorsun.` : 'Profilin kaydedildi.');
      panelGoster(tipDegisti ? 'genel' : 'profil');
    } catch (err) {
      console.error('Profil kaydı hatası:', err);
      bildir('Kaydedilemedi: ' + hataMetni(err), 'hata');
      dugme.disabled = false;
      $('#kayitDurum').textContent = '';
    }
  });
}

function hesapBagla() {
  $('#hesapCikis')?.addEventListener('click', cikis);
  $('#dogrulaDugme')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await dogrulamaTekrarGonder(); bildir('Doğrulama e-postası gönderildi.'); }
    catch (err) { bildir(hataMetni(err), 'hata'); e.currentTarget.disabled = false; }
  });
  $('#sifreDugme')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await sifreSifirlamaGonder(kullanici.email); bildir('Şifre sıfırlama bağlantısı e-postana gönderildi.'); }
    catch (err) { bildir(hataMetni(err), 'hata'); e.currentTarget.disabled = false; }
  });
}

async function cikis() {
  try { await cikisYap(); } catch (e) {}
  location.href = 'index.html';
}

// Menü ve içerikteki tüm "data-git" bağlantıları
document.addEventListener('click', (e) => {
  const hedef = e.target.closest('[data-git]');
  if (hedef) { e.preventDefault(); panelGoster(hedef.dataset.git); }
});
$('#menuDugme').addEventListener('click', () => document.body.classList.toggle('menu-acik'));
$('#karartma').addEventListener('click', () => document.body.classList.remove('menu-acik'));
$('#cikisDugme').addEventListener('click', cikis);

// ── Başlangıç ──
oturumDinle(async (u) => {
  if (!u) { location.replace('uyelik.html'); return; }
  kullanici = u;
  try { profil = (await profilGetir(u.uid)) || {}; }
  catch (e) { console.error('Profil okunamadı:', e); profil = {}; }

  const istenen = new URLSearchParams(location.search).get('onizle');
  const yonetici = YONETICILER.includes((u.email || '').toLowerCase());
  onizleme = !!(yonetici && TIPLER[istenen]);
  tip = onizleme ? istenen : (TIPLER[profil.uyelik_tipi] ? profil.uyelik_tipi : 'merakli');

  kimlikCiz();
  onizlemeSeridi();
  if (!u.emailVerified && !onizleme && (u.providerData || []).some(p => p.providerId === 'password')) {
    $('#ustEylem').innerHTML = `<button class="btn btn-hayalet btn-kucuk" data-git="hesap">${ik('zarf', 'ik ik-sm')} E-postanı doğrula</button>`;
  }
  panelGoster((location.hash || '#genel').slice(1));
  $('#yukleniyor').remove();
});
