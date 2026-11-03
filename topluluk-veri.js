// Topluluk veri modülü — gönderiler, cevaplar ve bildirimler (Firestore)
// Kurallar: firestore.rules. Liste sorguları yalnızca eşitlik filtresi kullanır (bileşik dizin gerekmez);
// sıralama tarayıcıda yapılır.
import {
  collection, doc, getDoc, getDocs, query, where, limit, serverTimestamp,
  increment, writeBatch, updateDoc, deleteDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { veritabani, kimlik, profilGetir } from "./oturum.js";

export const YONETICILER = ['emrahby@gmail.com', 'eposta@bircicekkoleji.com'];
export const yoneticiMi = (k = kimlik.currentUser) => !!k && YONETICILER.includes((k.email || '').toLowerCase());

export const TURLER = {
  soru: { ad: 'Soru', cogul: 'Sorular', fiil: 'Soru sor', ik: 'soru', mi: 'ses-kutusu' },
  deneyim: { ad: 'Deneyim', cogul: 'Deneyimler', fiil: 'Deneyimini paylaş', ik: 'kalp', mi: 'dokme' },
  rehber: { ad: 'Üye Rehberi', cogul: 'Üye Rehberleri', fiil: 'Rehber gönder', ik: 'kitap', mi: 'zimpara-harf' }
};
export const KATEGORILER = {
  'ev-ortami': 'Ev ortamı', 'gunluk-yasam': 'Günlük yaşam', 'gelisim': 'Gelişim', 'dil': 'Dil ve okuma',
  'matematik': 'Matematik', 'duygular-davranis': 'Duygular ve davranış', 'okul-secimi': 'Okul seçimi',
  'sinif-yonetimi': 'Sınıf yönetimi', 'materyaller': 'Materyaller', 'orman-okulu': 'Orman okulu', 'diger': 'Diğer'
};
export const YASLAR = { '0-3': '0–3 yaş', '3-6': '3–6 yaş', '6-12': '6–12 yaş', 'genel': 'Tüm yaşlar' };
export const TIP_ETIKET = { ebeveyn: 'Ebeveyn', ogretmen: 'Öğretmen', merakli: 'Meraklı' };
export const SINIRLAR = { baslik: 140, metin: 4000, rehberMetin: 12000, cevap: 4000, ad: 60 };

const zaman = (v) => v?.toMillis ? v.toMillis() : (v instanceof Date ? v.getTime() : 0);
const yeniyeGore = (a, b) => zaman(b.olusturma) - zaman(a.olusturma);
const eskiyeGore = (a, b) => zaman(a.olusturma) - zaman(b.olusturma);
const veriyle = (s) => ({ id: s.id, ...s.data() });

// "Ayşe Yılmaz" -> "Ayşe Y." (topluluğa açık görünen ad; gizlilik için soyadın baş harfi)
export function gorunenAd(adSoyad, eposta) {
  const parca = String(adSoyad || '').trim().split(/\s+/).filter(Boolean);
  if (parca.length >= 2) return `${parca[0]} ${parca[parca.length - 1][0].toLocaleUpperCase('tr-TR')}.`.slice(0, 60);
  if (parca.length === 1) return parca[0].slice(0, 60);
  return String(eposta || 'Üye').split('@')[0].slice(0, 60);
}

export function tarihYazi(v) {
  const t = zaman(v);
  if (!t) return 'az önce';
  const fark = (Date.now() - t) / 1000;
  if (fark < 60) return 'az önce';
  if (fark < 3600) return Math.floor(fark / 60) + ' dk önce';
  if (fark < 86400) return Math.floor(fark / 3600) + ' saat önce';
  if (fark < 86400 * 7) return Math.floor(fark / 86400) + ' gün önce';
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Okuma ──
export async function yayindakiGonderiler(tur) {
  const kosul = [where('durum', '==', 'yayinda')];
  if (tur) kosul.push(where('tur', '==', tur));
  const s = await getDocs(query(collection(veritabani, 'gonderiler'), ...kosul, limit(400)));
  return s.docs.map(veriyle).sort(yeniyeGore);
}

export async function gonderiGetir(id) {
  const s = await getDoc(doc(veritabani, 'gonderiler', id));
  return s.exists() ? veriyle(s) : null;
}

export async function cevaplariGetir(gonderiId) {
  const s = await getDocs(query(collection(veritabani, 'cevaplar'),
    where('gonderi_id', '==', gonderiId), where('durum', '==', 'yayinda'), limit(300)));
  const liste = s.docs.map(veriyle);
  // Kullanıcının kendi bekleyen cevapları (yalnızca kendisi görür)
  const k = kimlik.currentUser;
  if (k) {
    try {
      const b = await getDocs(query(collection(veritabani, 'cevaplar'),
        where('gonderi_id', '==', gonderiId), where('yazar_uid', '==', k.uid), limit(50)));
      b.docs.map(veriyle).filter(c => c.durum !== 'yayinda').forEach(c => liste.push(c));
    } catch (e) { /* sessiz */ }
  }
  return liste.sort((a, b) => (b.uzman === true) - (a.uzman === true) || eskiyeGore(a, b));
}

export async function benimGonderilerim(uid) {
  const s = await getDocs(query(collection(veritabani, 'gonderiler'), where('yazar_uid', '==', uid), limit(200)));
  return s.docs.map(veriyle).sort(yeniyeGore);
}

export async function benimCevaplarim(uid) {
  const s = await getDocs(query(collection(veritabani, 'cevaplar'), where('yazar_uid', '==', uid), limit(200)));
  return s.docs.map(veriyle).sort(yeniyeGore);
}

// Gönderen kişinin onaylı olup olmadığı (ilk gönderisi onaylandıysa doğrudan yayınlar)
async function yazarBilgisi() {
  const k = kimlik.currentUser;
  if (!k) throw Object.assign(new Error('Giriş yapmalısın.'), { code: 'giris-gerekli' });
  const p = (await profilGetir(k.uid)) || {};
  return {
    uid: k.uid,
    ad: gorunenAd(p.ad_soyad || k.displayName, k.email),
    tip: ['ebeveyn', 'ogretmen', 'merakli'].includes(p.uyelik_tipi) ? p.uyelik_tipi : 'merakli',
    dogrudan: p.onayli === true || yoneticiMi(k)
  };
}

// ── Yazma ──
export async function gonderiOlustur({ tur, baslik, metin, kategori, yas }) {
  const y = await yazarBilgisi();
  const veri = {
    tur, baslik: String(baslik).trim().slice(0, SINIRLAR.baslik),
    metin: String(metin).trim().slice(0, tur === 'rehber' ? SINIRLAR.rehberMetin : SINIRLAR.metin),
    kategori, yas: YASLAR[yas] ? yas : 'genel',
    yazar_uid: y.uid, yazar_ad: y.ad, yazar_tip: y.tip,
    durum: y.dogrudan ? 'yayinda' : 'beklemede',
    olusturma: serverTimestamp(), cevap_sayisi: 0
  };
  const ref = await addDoc(collection(veritabani, 'gonderiler'), veri);
  return { id: ref.id, durum: veri.durum };
}

export async function cevapEkle(gonderiId, metin, { uzman = false } = {}) {
  const y = await yazarBilgisi();
  const durum = y.dogrudan ? 'yayinda' : 'beklemede';
  const uzmanCevap = !!(uzman && yoneticiMi());
  // Uzman cevaplarında yöneticinin tam adı görünür
  const ad = uzmanCevap ? (String(kimlik.currentUser.displayName || y.ad).trim().slice(0, 60) || y.ad) : y.ad;
  const veri = {
    gonderi_id: gonderiId, metin: String(metin).trim().slice(0, SINIRLAR.cevap),
    yazar_uid: y.uid, yazar_ad: ad, yazar_tip: y.tip,
    uzman: uzmanCevap, durum, olusturma: serverTimestamp()
  };
  const b = writeBatch(veritabani);
  const ref = doc(collection(veritabani, 'cevaplar'));
  b.set(ref, veri);
  if (durum === 'yayinda') b.update(doc(veritabani, 'gonderiler', gonderiId), { cevap_sayisi: increment(1) });
  await b.commit();
  return { id: ref.id, durum };
}

export async function bildir(hedefTur, hedefId, gonderiId, neden) {
  const k = kimlik.currentUser;
  if (!k) throw Object.assign(new Error('Giriş yapmalısın.'), { code: 'giris-gerekli' });
  await addDoc(collection(veritabani, 'bildirimler'), {
    hedef_tur: hedefTur, hedef_id: hedefId, gonderi_id: gonderiId || hedefId,
    neden: String(neden || '').trim().slice(0, 300), bildiren_uid: k.uid, olusturma: serverTimestamp()
  });
}

export async function kendiIceriginiSil(tur, id) {
  await deleteDoc(doc(veritabani, tur === 'cevap' ? 'cevaplar' : 'gonderiler', id));
}

// ── Yönetici (moderasyon) ──
export async function bekleyenler() {
  const [g, c] = await Promise.all([
    getDocs(query(collection(veritabani, 'gonderiler'), where('durum', '==', 'beklemede'), limit(200))),
    getDocs(query(collection(veritabani, 'cevaplar'), where('durum', '==', 'beklemede'), limit(200)))
  ]);
  return { gonderiler: g.docs.map(veriyle).sort(eskiyeGore), cevaplar: c.docs.map(veriyle).sort(eskiyeGore) };
}

export async function bildirimler() {
  const s = await getDocs(query(collection(veritabani, 'bildirimler'), limit(200)));
  return s.docs.map(veriyle).sort(yeniyeGore);
}

export async function yayindakiCevaplarHepsi() {
  const s = await getDocs(query(collection(veritabani, 'cevaplar'), where('durum', '==', 'yayinda'), limit(400)));
  return s.docs.map(veriyle).sort(yeniyeGore);
}

// Onayla: içeriği yayına alır, yazarı "onaylı üye" yapar; cevapsa gönderinin sayacını artırır
export async function onayla(tur, oge, { uyeyiOnayla = true } = {}) {
  const b = writeBatch(veritabani);
  if (tur === 'cevap') {
    b.update(doc(veritabani, 'cevaplar', oge.id), { durum: 'yayinda' });
    b.update(doc(veritabani, 'gonderiler', oge.gonderi_id), { cevap_sayisi: increment(1) });
  } else {
    b.update(doc(veritabani, 'gonderiler', oge.id), { durum: 'yayinda' });
  }
  await b.commit();
  if (uyeyiOnayla && oge.yazar_uid) {
    try {
      const p = await getDoc(doc(veritabani, 'profiller', oge.yazar_uid));
      if (p.exists() && p.data().onayli !== true) await updateDoc(p.ref, { onayli: true });
    } catch (e) { console.warn('Üye onaylanamadı:', e); }
  }
}

export async function gizle(tur, oge) {
  const b = writeBatch(veritabani);
  if (tur === 'cevap') {
    b.update(doc(veritabani, 'cevaplar', oge.id), { durum: 'gizli' });
    if (oge.durum === 'yayinda') b.update(doc(veritabani, 'gonderiler', oge.gonderi_id), { cevap_sayisi: increment(-1) });
  } else {
    b.update(doc(veritabani, 'gonderiler', oge.id), { durum: 'gizli' });
  }
  await b.commit();
}

export async function yoneticiSil(tur, oge) {
  if (tur === 'cevap' && oge.durum === 'yayinda') {
    const b = writeBatch(veritabani);
    b.delete(doc(veritabani, 'cevaplar', oge.id));
    b.update(doc(veritabani, 'gonderiler', oge.gonderi_id), { cevap_sayisi: increment(-1) });
    await b.commit();
  } else {
    await deleteDoc(doc(veritabani, tur === 'cevap' ? 'cevaplar' : 'gonderiler', oge.id));
  }
}

export async function bildirimKapat(id) {
  await deleteDoc(doc(veritabani, 'bildirimler', id));
}

export async function uyeOnayKaldir(uid) {
  await updateDoc(doc(veritabani, 'profiller', uid), { onayli: false });
}
