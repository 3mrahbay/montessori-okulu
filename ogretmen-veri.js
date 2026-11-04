// Öğretmen kartı veri modülü — herkese açık öğretmen profili, belge başvuruları ve yönetici doğrulaması.
// Kurallar: firestore.rules (ogretmenler, belge_basvurulari) ve storage.rules (belgeler).
//
// ogretmenler/{uid}         Öğretmenin kartı. "acik" true ise herkes okur; değilse yalnızca kendisi ve yönetici.
//                           "dogrulamalar" alanını yalnızca yönetici yazar.
// belge_basvurulari/{id}    Öğretmenin bir eğitim/sertifika için doğrulama isteği. Yalnızca sahibi ve yönetici okur.
// Storage belgeler/{uid}/…  Yüklenen belge (diploma, sertifika). Yalnızca sahibi ve yönetici açar. Asla herkese açık değil.
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, limit,
  serverTimestamp, writeBatch, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { veritabani, kimlik } from "./oturum.js";

// Belge yükleme için Firebase Storage'ın açılmış olması gerekir (Firebase Console > Storage).
// Açılana kadar öğretmen belgesini e-postayla gönderir; başvuru yine kaydedilir.
export const BELGE_YUKLEME_ACIK = false;
export const BELGE_EPOSTA = 'eposta@bircicekkoleji.com';
export const BELGE_AZAMI_MB = 10;

export const SINIR = { ad: 80, unvan: 80, kurum: 120, tanitim: 400, egitim: 5, sertifika: 8, metin: 120, not: 300 };

const kisalt = (v, n) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, n);
const yilAl = (v) => {
  const y = parseInt(v, 10);
  return Number.isFinite(y) && y >= 1950 && y <= 2100 ? y : null;
};
export const yeniId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Kart verisini temizler (tarayıcıdan gelen her şey sınırlanır)
export function kartTemizle(girdi) {
  const deneyim = parseInt(girdi.deneyim_yil, 10);
  return {
    ad_soyad: kisalt(girdi.ad_soyad, SINIR.ad),
    unvan: kisalt(girdi.unvan, SINIR.unvan),
    kurum: kisalt(girdi.kurum, SINIR.kurum) || null,
    deneyim_yil: Number.isFinite(deneyim) && deneyim >= 0 && deneyim <= 60 ? deneyim : null,
    egitim: (girdi.egitim || [])
      .map(e => ({ id: kisalt(e.id, 24) || yeniId(), bolum: kisalt(e.bolum, SINIR.metin), okul: kisalt(e.okul, SINIR.metin), yil: yilAl(e.yil) }))
      .filter(e => e.bolum || e.okul).slice(0, SINIR.egitim),
    sertifikalar: (girdi.sertifikalar || [])
      .map(s => ({ id: kisalt(s.id, 24) || yeniId(), ad: kisalt(s.ad, SINIR.metin), kurum: kisalt(s.kurum, SINIR.metin), yil: yilAl(s.yil) }))
      .filter(s => s.ad).slice(0, SINIR.sertifika),
    tanitim: kisalt(girdi.tanitim, SINIR.tanitim),
    acik: girdi.acik === true
  };
}

// Bir eğitim/sertifika kaleminin doğrulamasının hâlâ geçerli olup olmadığı:
// yönetici onayladığı andaki bilgiyle şimdiki bilgi aynı olmalı. Öğretmen kalemi değiştirirse rozet düşer.
export function dogrulandiMi(kart, kalem) {
  const d = kart?.dogrulamalar?.[kalem.id];
  if (!d) return false;
  const ayni = (a, b) => String(a ?? '') === String(b ?? '');
  return kalem.ad !== undefined
    ? ayni(d.ad, kalem.ad) && ayni(d.kurum, kalem.kurum) && ayni(d.yil, kalem.yil)
    : ayni(d.bolum, kalem.bolum) && ayni(d.okul, kalem.okul) && ayni(d.yil, kalem.yil);
}

export function kalemYazi(kalem) {
  const parca = kalem.ad !== undefined ? [kalem.ad, kalem.kurum] : [kalem.bolum, kalem.okul];
  return parca.filter(Boolean).join(' — ') + (kalem.yil ? ` (${kalem.yil})` : '');
}

// ── Okuma ──
// Kart yoksa ya da herkese açık değilse (ve okuyan sahibi/yönetici değilse) null döner.
export async function ogretmenKartiGetir(uid) {
  try {
    const s = await getDoc(doc(veritabani, 'ogretmenler', uid));
    return s.exists() ? { uid, ...s.data() } : null;
  } catch (e) {
    if (e?.code === 'permission-denied') return null;
    throw e;
  }
}

// ── Öğretmenin kendisi ──
export async function ogretmenKartiKaydet(girdi) {
  const k = kimlik.currentUser;
  if (!k) throw new Error('Giriş yapmalısın.');
  const veri = kartTemizle(girdi);
  if (veri.ad_soyad.length < 2) throw Object.assign(new Error('Ad soyad en az 2 karakter olmalı.'), { code: 'gecersiz' });
  veri.guncelleme = serverTimestamp();
  // merge: yöneticinin yazdığı "dogrulamalar" alanına dokunulmaz
  await setDoc(doc(veritabani, 'ogretmenler', k.uid), veri, { merge: true });
  return veri;
}

export async function benimBasvurularim() {
  const k = kimlik.currentUser;
  if (!k) return [];
  const s = await getDocs(query(collection(veritabani, 'belge_basvurulari'), where('uid', '==', k.uid), limit(50)));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Doğrulama isteği: belge yükleme açıksa önce dosya Storage'a yüklenir.
export async function dogrulamaIste({ kalem, kalemTur, dosya, not }) {
  const k = kimlik.currentUser;
  if (!k) throw new Error('Giriş yapmalısın.');
  let dosyaYolu = null;
  if (dosya) {
    if (!BELGE_YUKLEME_ACIK) throw new Error('Belge yükleme henüz açık değil.');
    if (dosya.size > BELGE_AZAMI_MB * 1024 * 1024) throw new Error(`Dosya ${BELGE_AZAMI_MB} MB'tan büyük olamaz.`);
    if (!(dosya.type === 'application/pdf' || /^image\//.test(dosya.type))) throw new Error('Yalnızca PDF ya da fotoğraf yükleyebilirsin.');
    const { getStorage, ref, uploadBytes } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
    const temizAd = dosya.name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-60);
    dosyaYolu = `belgeler/${k.uid}/${Date.now()}-${temizAd}`;
    await uploadBytes(ref(getStorage(), dosyaYolu), dosya, { contentType: dosya.type });
  }
  const veri = {
    uid: k.uid, kalem_id: kalem.id, kalem_tur: kalemTur, kalem_ad: kalemYazi(kalem).slice(0, 260),
    dosya_yolu: dosyaYolu, not: kisalt(not, SINIR.not) || null,
    durum: 'bekliyor', olusturma: serverTimestamp()
  };
  const r = await addDoc(collection(veritabani, 'belge_basvurulari'), veri);
  return { id: r.id, ...veri };
}

// ── Yönetici ──
export async function bekleyenBasvurular() {
  const s = await getDocs(query(collection(veritabani, 'belge_basvurulari'), where('durum', '==', 'bekliyor'), limit(200)));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function sonKararlar() {
  const [o, r] = await Promise.all([
    getDocs(query(collection(veritabani, 'belge_basvurulari'), where('durum', '==', 'onaylandi'), limit(100))),
    getDocs(query(collection(veritabani, 'belge_basvurulari'), where('durum', '==', 'reddedildi'), limit(100)))
  ]);
  return [...o.docs, ...r.docs].map(d => ({ id: d.id, ...d.data() }));
}

export async function belgeAdresi(dosyaYolu) {
  const { getStorage, ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  return getDownloadURL(ref(getStorage(), dosyaYolu));
}

// Onay: kartın o anki kalem bilgisi "dogrulamalar" içine kopyalanır, başvuru kapanır.
export async function basvuruOnayla(basvuru, kart) {
  const liste = basvuru.kalem_tur === 'egitim' ? (kart?.egitim || []) : (kart?.sertifikalar || []);
  const kalem = liste.find(x => x.id === basvuru.kalem_id);
  if (!kalem) throw new Error('Bu kalem öğretmenin kartında artık yok. Başvuruyu reddedebilirsin.');
  const kopya = basvuru.kalem_tur === 'egitim'
    ? { tur: 'egitim', bolum: kalem.bolum || '', okul: kalem.okul || '', yil: kalem.yil ?? null }
    : { tur: 'sertifika', ad: kalem.ad || '', kurum: kalem.kurum || '', yil: kalem.yil ?? null };
  kopya.tarih = serverTimestamp();
  const b = writeBatch(veritabani);
  b.update(doc(veritabani, 'ogretmenler', basvuru.uid), { [`dogrulamalar.${basvuru.kalem_id}`]: kopya });
  b.update(doc(veritabani, 'belge_basvurulari', basvuru.id), { durum: 'onaylandi', karar_tarihi: serverTimestamp() });
  await b.commit();
}

export async function basvuruReddet(basvuru, yoneticiNotu) {
  await updateDoc(doc(veritabani, 'belge_basvurulari', basvuru.id), {
    durum: 'reddedildi', karar_tarihi: serverTimestamp(), yonetici_notu: kisalt(yoneticiNotu, SINIR.not) || null
  });
}

export async function dogrulamaKaldir(uid, kalemId) {
  await updateDoc(doc(veritabani, 'ogretmenler', uid), { [`dogrulamalar.${kalemId}`]: deleteField() });
}
