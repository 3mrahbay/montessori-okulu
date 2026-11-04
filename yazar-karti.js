// Açılır öğretmen kartı — topluluk ve öğretmen sayfalarında yazar adına tıklanınca açılır.
// Kullanım: <button class="yazar-tik" data-ogretmen="<uid>" data-ad="Ayşe Y.">Ayşe Y.</button>
// Kart yalnızca öğretmen profilini herkese açık yaptıysa ayrıntı gösterir; değilse yalnızca
// zaten görünen adı ve "Öğretmen üye" bilgisini gösterir.
import { ogretmenKartiGetir, dogrulandiMi, kalemYazi } from './ogretmen-veri.js';

const kacis = (m) => String(m ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const basHarf = (ad) => String(ad || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
const onbellek = new Map();

export function rozetHtml(dogru) {
  return dogru
    ? '<span class="yk-rozet yk-dogru" title="Belgesi yönetici tarafından incelendi">✓ Doğrulandı</span>'
    : '<span class="yk-rozet yk-beyan" title="Öğretmenin kendi beyanı">Beyan</span>';
}

export function kalemListesiHtml(kart, liste, bosMetin = '') {
  if (!liste?.length) return bosMetin;
  return `<ul class="yk-kalemler">${liste.map(k => `<li><span>${kacis(kalemYazi(k))}</span>${rozetHtml(dogrulandiMi(kart, k))}</li>`).join('')}</ul>`;
}

export function avatarHtml(ad, boyut = 64) {
  return `<span class="yk-av" aria-hidden="true" style="width:${boyut}px;height:${boyut}px;font-size:${Math.round(boyut * .36)}px">${kacis(basHarf(ad))}</span>`;
}

// Kartın gövdesi (hem açılır pencerede hem önizlemede kullanılır)
export function kartGovdeHtml(kart, { sayfaBaglantisi = true } = {}) {
  const sert = kalemListesiHtml(kart, kart.sertifikalar);
  const egt = kalemListesiHtml(kart, kart.egitim);
  const alt = [kart.kurum, Number.isInteger(kart.deneyim_yil) ? `${kart.deneyim_yil} yıl deneyim` : ''].filter(Boolean).join(' · ');
  return `
    <div class="yk-ust">${avatarHtml(kart.ad_soyad, 64)}
      <div><h2 class="yk-ad" id="yk-baslik">${kacis(kart.ad_soyad)}</h2>
        ${kart.unvan ? `<p class="yk-unvan">${kacis(kart.unvan)}</p>` : ''}
        ${alt ? `<p class="yk-alt">${kacis(alt)}</p>` : ''}</div></div>
    ${kart.tanitim ? `<p class="yk-tanitim">${kacis(kart.tanitim)}</p>` : ''}
    ${sert ? `<h3 class="yk-bas">Sertifikalar</h3>${sert}` : ''}
    ${egt ? `<h3 class="yk-bas">Eğitim</h3>${egt}` : ''}
    ${sayfaBaglantisi ? `<a class="yk-git" href="ogretmen?u=${encodeURIComponent(kart.uid)}">Profili ve paylaşımları →</a>` : ''}`;
}

let pencere;
function pencereKur() {
  pencere = document.createElement('dialog');
  pencere.className = 'yk-dialog';
  pencere.setAttribute('aria-labelledby', 'yk-baslik');
  document.body.appendChild(pencere);
  pencere.addEventListener('click', (e) => { if (e.target === pencere) pencere.close(); });
}

function goster(html, tetikleyen) {
  if (!pencere) pencereKur();
  pencere.innerHTML = `<div class="yk-kart"><button class="yk-kapat" type="button" aria-label="Kapat">×</button>${html}</div>`;
  pencere.querySelector('.yk-kapat').addEventListener('click', () => pencere.close());
  pencere.addEventListener('close', function geri() {
    pencere.removeEventListener('close', geri);
    tetikleyen?.focus?.();
  });
  if (typeof pencere.showModal === 'function') pencere.showModal();
}

export async function yazarKartiAc(uid, gorunenAd, tetikleyen) {
  goster(`<div class="yk-ust">${avatarHtml(gorunenAd, 64)}<div><h2 class="yk-ad" id="yk-baslik">${kacis(gorunenAd)}</h2>
    <p class="yk-alt">Yükleniyor…</p></div></div>`, tetikleyen);
  let kart = onbellek.get(uid);
  if (kart === undefined) {
    try { kart = await ogretmenKartiGetir(uid); } catch (e) { console.warn('Öğretmen kartı okunamadı:', e); kart = null; }
    onbellek.set(uid, kart);
  }
  const govde = kart && kart.acik
    ? kartGovdeHtml(kart)
    : `<div class="yk-ust">${avatarHtml(gorunenAd, 64)}<div><h2 class="yk-ad" id="yk-baslik">${kacis(gorunenAd)}</h2>
        <p class="yk-unvan">Öğretmen üye</p></div></div>
        <p class="yk-tanitim">Bu öğretmen profil bilgilerini henüz herkese açık paylaşmadı.</p>`;
  if (pencere?.open) pencere.querySelector('.yk-kart').innerHTML = `<button class="yk-kapat" type="button" aria-label="Kapat">×</button>${govde}`;
  pencere?.querySelector('.yk-kapat')?.addEventListener('click', () => pencere.close());
}

// Sayfadaki tüm [data-ogretmen] düğmelerine tek dinleyici
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-ogretmen]');
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();
  yazarKartiAc(t.dataset.ogretmen, t.dataset.ad || t.textContent.trim(), t);
});
