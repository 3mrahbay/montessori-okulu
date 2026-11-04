// Firestore ve Storage kural testleri — öğretmen kartı, belge başvuruları, belgeler.
// Çalıştırma (testler klasöründe):  npm install  &&  npm test
// Emülatörde çalışır; gerçek veritabanına dokunmaz.
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where, serverTimestamp, deleteField
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let ortam;
const YONETICI = { email: 'emrahby@gmail.com', email_verified: true };

before(async () => {
  ortam = await initializeTestEnvironment({
    projectId: 'demo-montessori-okulu',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('../storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
  });
});
after(async () => { await ortam.cleanup(); });
beforeEach(async () => {
  await ortam.clearFirestore();
  await ortam.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'profiller/ayse'), { email: 'ayse@ornek.com', uyelik_tipi: 'ogretmen' });
    await setDoc(doc(db, 'profiller/veli'), { email: 'veli@ornek.com', uyelik_tipi: 'ebeveyn' });
  });
});

const ayse = () => ortam.authenticatedContext('ayse', { email: 'ayse@ornek.com', email_verified: true }).firestore();
const veli = () => ortam.authenticatedContext('veli', { email: 'veli@ornek.com', email_verified: true }).firestore();
const yonetici = () => ortam.authenticatedContext('yon', YONETICI).firestore();
const misafir = () => ortam.unauthenticatedContext().firestore();

const kart = (ek = {}) => ({
  ad_soyad: 'Ayşe Yılmaz', unvan: 'Montessori Öğretmeni', kurum: 'Örnek Anaokulu', deneyim_yil: 7,
  egitim: [{ id: 'e1', bolum: 'Çocuk Gelişimi', okul: 'İstanbul Üniversitesi', yil: 2015 }],
  sertifikalar: [{ id: 's1', ad: 'Montessori 3–6 Diploması', kurum: 'MACTE akreditasyonlu program', yil: 2018 }],
  tanitim: 'On yıldır okul öncesinde çalışıyorum.', acik: true, guncelleme: serverTimestamp(), ...ek
});

// ── Kart ──
test('öğretmen kendi kartını oluşturabilir', async () => {
  await assertSucceeds(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart()));
});

test('öğretmen olmayan üye kart oluşturamaz', async () => {
  await assertFails(setDoc(doc(veli(), 'ogretmenler/veli'), kart({ ad_soyad: 'Veli Kaya' })));
});

test('başkasının adına kart oluşturulamaz', async () => {
  await assertFails(setDoc(doc(veli(), 'ogretmenler/ayse'), kart()));
});

test('öğretmen kartı oluştururken kendine doğrulama ekleyemez', async () => {
  await assertFails(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ dogrulamalar: { s1: { ad: 'x' } } })));
});

test('öğretmen sonradan da kendine doğrulama ekleyemez', async () => {
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart());
  await assertFails(updateDoc(doc(ayse(), 'ogretmenler/ayse'), { 'dogrulamalar.s1': { ad: 'x' }, guncelleme: serverTimestamp() }));
});

test('bilinmeyen alan (ör. e-posta) karta yazılamaz', async () => {
  await assertFails(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ email: 'ayse@ornek.com' })));
});

test('sınırları aşan veri reddedilir', async () => {
  await assertFails(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ tanitim: 'a'.repeat(401) })));
  await assertFails(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ deneyim_yil: 99 })));
  await assertFails(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ sertifikalar: new Array(9).fill({ id: 'x', ad: 'y' }) })));
});

test('açık kartı herkes, kapalı kartı yalnızca sahibi ve yönetici okur', async () => {
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ acik: true }));
  await assertSucceeds(getDoc(doc(misafir(), 'ogretmenler/ayse')));
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ acik: false }), { merge: true });
  await assertFails(getDoc(doc(misafir(), 'ogretmenler/ayse')));
  await assertFails(getDoc(doc(veli(), 'ogretmenler/ayse')));
  await assertSucceeds(getDoc(doc(ayse(), 'ogretmenler/ayse')));
  await assertSucceeds(getDoc(doc(yonetici(), 'ogretmenler/ayse')));
});

test('yönetici yalnızca doğrulama alanını değiştirebilir', async () => {
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart());
  await assertSucceeds(updateDoc(doc(yonetici(), 'ogretmenler/ayse'),
    { 'dogrulamalar.s1': { tur: 'sertifika', ad: 'Montessori 3–6 Diploması', kurum: 'MACTE akreditasyonlu program', yil: 2018 } }));
  await assertFails(updateDoc(doc(yonetici(), 'ogretmenler/ayse'), { unvan: 'Değiştirildi' }));
  await assertSucceeds(updateDoc(doc(yonetici(), 'ogretmenler/ayse'), { 'dogrulamalar.s1': deleteField() }));
});

test('öğretmen kartını güncellerken yöneticinin doğrulaması korunur', async () => {
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart());
  await updateDoc(doc(yonetici(), 'ogretmenler/ayse'), { 'dogrulamalar.s1': { ad: 'Montessori 3–6 Diploması' } });
  // merge ile yazım dogrulamalar'a dokunmaz → izinli
  await assertSucceeds(setDoc(doc(ayse(), 'ogretmenler/ayse'), kart({ tanitim: 'Güncel tanıtım' }), { merge: true }));
  const s = await getDoc(doc(ayse(), 'ogretmenler/ayse'));
  if (!s.data().dogrulamalar?.s1) throw new Error('doğrulama silinmemeliydi');
});

test('yönetici olmayan e-postası doğrulanmamış hesap yönetici sayılmaz', async () => {
  await setDoc(doc(ayse(), 'ogretmenler/ayse'), kart());
  const sahte = ortam.authenticatedContext('sahte', { email: 'emrahby@gmail.com', email_verified: false }).firestore();
  await assertFails(updateDoc(doc(sahte, 'ogretmenler/ayse'), { 'dogrulamalar.s1': { ad: 'x' } }));
});

// ── Başvurular ──
const basvuru = (ek = {}) => ({
  uid: 'ayse', kalem_id: 's1', kalem_tur: 'sertifika', kalem_ad: 'Montessori 3–6 Diploması — MACTE (2018)',
  dosya_yolu: null, not: null, durum: 'bekliyor', olusturma: serverTimestamp(), ...ek
});

test('öğretmen kendi adına başvuru açabilir, başkası adına açamaz', async () => {
  await assertSucceeds(addDoc(collection(ayse(), 'belge_basvurulari'), basvuru()));
  await assertFails(addDoc(collection(veli(), 'belge_basvurulari'), basvuru()));
});

test('başvuru onaylı olarak açılamaz ve başkasının belge yolunu gösteremez', async () => {
  await assertFails(addDoc(collection(ayse(), 'belge_basvurulari'), basvuru({ durum: 'onaylandi' })));
  await assertFails(addDoc(collection(ayse(), 'belge_basvurulari'), basvuru({ dosya_yolu: 'belgeler/veli/x.pdf' })));
  await assertSucceeds(addDoc(collection(ayse(), 'belge_basvurulari'), basvuru({ dosya_yolu: 'belgeler/ayse/1-diploma.pdf' })));
});

test('başvuruları yalnızca sahibi ve yönetici okur; kararı yalnızca yönetici verir', async () => {
  const r = await addDoc(collection(ayse(), 'belge_basvurulari'), basvuru());
  await assertSucceeds(getDocs(query(collection(ayse(), 'belge_basvurulari'), where('uid', '==', 'ayse'))));
  await assertFails(getDoc(doc(veli(), 'belge_basvurulari', r.id)));
  await assertFails(getDoc(doc(misafir(), 'belge_basvurulari', r.id)));
  await assertSucceeds(getDocs(query(collection(yonetici(), 'belge_basvurulari'), where('durum', '==', 'bekliyor'))));
  await assertFails(updateDoc(doc(ayse(), 'belge_basvurulari', r.id), { durum: 'onaylandi' }));
  await assertSucceeds(updateDoc(doc(yonetici(), 'belge_basvurulari', r.id), { durum: 'onaylandi', karar_tarihi: serverTimestamp() }));
});

// ── Mevcut kurallar bozulmadı ──
test('profiller hâlâ yalnızca sahibine açık', async () => {
  await assertFails(getDoc(doc(veli(), 'profiller/ayse')));
  await assertFails(getDoc(doc(misafir(), 'profiller/ayse')));
});

// ── Storage ──
const st = (ctx) => ctx.storage();
const pdf = new Uint8Array([37, 80, 68, 70, 45]);

test('öğretmen yalnızca kendi klasörüne PDF/fotoğraf yükleyebilir', async () => {
  const a = ortam.authenticatedContext('ayse', { email: 'ayse@ornek.com', email_verified: true });
  await assertSucceeds(uploadBytes(ref(st(a), 'belgeler/ayse/1-diploma.pdf'), pdf, { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(st(a), 'belgeler/veli/1-diploma.pdf'), pdf, { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(st(a), 'belgeler/ayse/2-betik.html'), pdf, { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(st(a), 'herkese-acik/x.pdf'), pdf, { contentType: 'application/pdf' }));
});

test('belgeyi yalnızca sahibi ve yönetici açabilir', async () => {
  await ortam.withSecurityRulesDisabled(async (c) => {
    await uploadBytes(ref(c.storage(), 'belgeler/ayse/1-diploma.pdf'), pdf, { contentType: 'application/pdf' });
  });
  const a = ortam.authenticatedContext('ayse', { email: 'ayse@ornek.com', email_verified: true });
  const v = ortam.authenticatedContext('veli', { email: 'veli@ornek.com', email_verified: true });
  const y = ortam.authenticatedContext('yon', YONETICI);
  await assertSucceeds(getBytes(ref(st(a), 'belgeler/ayse/1-diploma.pdf')));
  await assertSucceeds(getBytes(ref(st(y), 'belgeler/ayse/1-diploma.pdf')));
  await assertFails(getBytes(ref(st(v), 'belgeler/ayse/1-diploma.pdf')));
  await assertFails(getBytes(ref(st(ortam.unauthenticatedContext()), 'belgeler/ayse/1-diploma.pdf')));
});

test('ziyaretçi öğretmenin yayındaki paylaşım ve cevaplarını listeleyebilir', async () => {
  await ortam.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'gonderiler/g1'), { yazar_uid: 'ayse', durum: 'yayinda', baslik: 'x' });
    await setDoc(doc(db, 'cevaplar/c1'), { yazar_uid: 'ayse', durum: 'yayinda', gonderi_id: 'g1', metin: 'y' });
    await setDoc(doc(db, 'cevaplar/c2'), { yazar_uid: 'ayse', durum: 'beklemede', gonderi_id: 'g1', metin: 'z' });
  });
  await assertSucceeds(getDocs(query(collection(misafir(), 'gonderiler'), where('yazar_uid', '==', 'ayse'), where('durum', '==', 'yayinda'))));
  await assertSucceeds(getDocs(query(collection(misafir(), 'cevaplar'), where('yazar_uid', '==', 'ayse'), where('durum', '==', 'yayinda'))));
  // durum filtresi olmadan (bekleyenler dahil) liste okunamaz
  await assertFails(getDocs(query(collection(misafir(), 'cevaplar'), where('yazar_uid', '==', 'ayse'))));
});
