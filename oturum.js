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

// Profil belgesini oluşturur ya da günceller: profiller/{uid}
export async function profilKaydet(kullanici, alanlar = {}) {
  const ref = doc(veritabani, "profiller", kullanici.uid);
  const mevcut = await getDoc(ref);
  const veri = {
    email: kullanici.email || null,
    ad_soyad: alanlar.ad_soyad || kullanici.displayName || null,
    guncelleme: serverTimestamp()
  };
  if (alanlar.uyelik_tipi) veri.uyelik_tipi = alanlar.uyelik_tipi;
  if (alanlar.cocuk_yasi) veri.cocuk_yasi = String(alanlar.cocuk_yasi).slice(0, 40);
  if (alanlar.okul_adi) veri.okul_adi = String(alanlar.okul_adi).slice(0, 120);
  if (!mevcut.exists()) {
    veri.olusturma = serverTimestamp();
    if (!veri.uyelik_tipi) veri.uyelik_tipi = "merakli";
  }
  await setDoc(ref, veri, { merge: true });
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
