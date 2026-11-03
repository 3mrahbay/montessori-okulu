// Ortak oturum modülü — Firebase Authentication + Firestore
// Tüm sayfalar giriş/üyelik işlemlerini bu dosya üzerinden yapar.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const uygulama = initializeApp(firebaseConfig);
export const kimlik = getAuth(uygulama);
kimlik.languageCode = "tr";
export const veritabani = getFirestore(uygulama);

// Oturum durumu değişince çağrılır (kullanıcı ya da null)
export function oturumDinle(geriCagir) {
  return onAuthStateChanged(kimlik, geriCagir);
}

// Geçerli değerler (firestore.rules ile aynı tutulmalı)
export const UYELIK_TIPLERI = ["ebeveyn", "ogretmen", "merakli"];
export const GOREVLER = ["montessori_ogretmeni", "asistan", "yonetici", "ogretmen_adayi", "diger"];
export const ILGI_ALANLARI = ["hazirlanmis_ortam", "gunluk_yasam", "hassas_donemler", "matematik",
  "dil", "orman_okulu", "okul_secimi", "ev_uygulamalari"];

// Giriş/kayıt sırasında çağrılır: profil yoksa oluşturur.
// Var olan profilde üyelik tipini ve adı EZMEZ (yalnızca eksikse tamamlar).
export async function profilKaydet(kullanici, alanlar = {}) {
  const ref = doc(veritabani, "profiller", kullanici.uid);
  const mevcut = await getDoc(ref);
  const eski = mevcut.exists() ? mevcut.data() : {};
  const veri = { email: kullanici.email || null, guncelleme: serverTimestamp() };
  if (!eski.ad_soyad) veri.ad_soyad = alanlar.ad_soyad || kullanici.displayName || null;
  if (!mevcut.exists()) {
    veri.olusturma = serverTimestamp();
    veri.uyelik_tipi = UYELIK_TIPLERI.includes(alanlar.uyelik_tipi) ? alanlar.uyelik_tipi : "merakli";
    if (alanlar.cocuk_yasi) veri.cocuk_yasi = String(alanlar.cocuk_yasi).slice(0, 40);
    if (alanlar.okul_adi) veri.okul_adi = String(alanlar.okul_adi).slice(0, 120);
  }
  await setDoc(ref, veri, { merge: true });
}

// Profil sayfasından bilinçli düzenleme: yalnızca izin verilen alanları yazar
export async function profilGuncelle(kullanici, alanlar) {
  const ref = doc(veritabani, "profiller", kullanici.uid);
  const veri = { email: kullanici.email || null, guncelleme: serverTimestamp() };
  if ("ad_soyad" in alanlar) veri.ad_soyad = String(alanlar.ad_soyad || "").trim().slice(0, 120) || null;
  if (UYELIK_TIPLERI.includes(alanlar.uyelik_tipi)) veri.uyelik_tipi = alanlar.uyelik_tipi;
  if ("cocuk_yasi" in alanlar) veri.cocuk_yasi = String(alanlar.cocuk_yasi || "").trim().slice(0, 40) || null;
  if ("okul_adi" in alanlar) veri.okul_adi = String(alanlar.okul_adi || "").trim().slice(0, 120) || null;
  if ("gorev" in alanlar) veri.gorev = GOREVLER.includes(alanlar.gorev) ? alanlar.gorev : null;
  if ("ilgi_alanlari" in alanlar) {
    veri.ilgi_alanlari = (alanlar.ilgi_alanlari || []).filter(a => ILGI_ALANLARI.includes(a)).slice(0, 8);
  }
  const mevcut = await getDoc(ref);
  if (!mevcut.exists()) veri.olusturma = serverTimestamp();
  await setDoc(ref, veri, { merge: true });
}

export function dogrulamaTekrarGonder() {
  if (!kimlik.currentUser) return Promise.reject(new Error("Oturum yok"));
  return sendEmailVerification(kimlik.currentUser, { url: location.origin + "/profil.html" });
}

export async function profilGetir(uid) {
  const s = await getDoc(doc(veritabani, "profiller", uid));
  return s.exists() ? s.data() : null;
}

// Google ile giriş: önce açılır pencere, engellenirse yönlendirme
export async function googleIleGirisYap() {
  const saglayici = new GoogleAuthProvider();
  saglayici.setCustomParameters({ prompt: "select_account" });
  try {
    const sonuc = await signInWithPopup(kimlik, saglayici);
    return sonuc.user;
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(kimlik, saglayici);
      return null;
    }
    throw e;
  }
}

export async function yonlendirmeSonucu() {
  const sonuc = await getRedirectResult(kimlik);
  return sonuc ? sonuc.user : null;
}

export async function epostaIleKayit(email, sifre, adSoyad) {
  const sonuc = await createUserWithEmailAndPassword(kimlik, email, sifre);
  await updateProfile(sonuc.user, { displayName: adSoyad });
  try {
    await sendEmailVerification(sonuc.user, { url: location.origin + "/uyelik.html" });
  } catch (e) { console.warn("Doğrulama e-postası gönderilemedi:", e); }
  return sonuc.user;
}

export async function epostaIleGiris(email, sifre) {
  const sonuc = await signInWithEmailAndPassword(kimlik, email, sifre);
  return sonuc.user;
}

export function sifreSifirlamaGonder(email) {
  return sendPasswordResetEmail(kimlik, email, { url: location.origin + "/uyelik.html" });
}

export function cikisYap() {
  return signOut(kimlik);
}

// Firebase hata kodlarını Türkçeye çevirir
export function hataMetni(e) {
  const hatalar = {
    "auth/email-already-in-use": "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/wrong-password": "E-posta veya şifre hatalı.",
    "auth/user-not-found": "E-posta veya şifre hatalı.",
    "auth/invalid-email": "Geçerli bir e-posta adresi girin.",
    "auth/weak-password": "Şifre en az 6 karakter olmalıdır.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.",
    "auth/popup-closed-by-user": "Google penceresi kapatıldı.",
    "auth/network-request-failed": "Bağlantı hatası. İnternetinizi kontrol edin.",
    "auth/unauthorized-domain": "Bu alan adı giriş için henüz yetkilendirilmedi."
  };
  return hatalar[e?.code] || e?.message || "Beklenmeyen bir hata oluştu.";
}
