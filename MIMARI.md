# 🏛 montessoriokulu.com — Topluluk Platformu Mimarisi

## Vizyon
Türkiye'nin ilk ve tek Montessori topluluğu. Dünya örnekleri (AMS — 18.000 üye,
Montessori Thrive, Trillium, Circle/Mighty Networks) incelenerek temellendirildi.

Üç ayak: **İçerik Kitaplığı** + **Canlı Seminerler** + **Topluluk (Soru-Cevap)**

## Teknoloji Yığını (mevcut ve hedef)

| Katman | Araç | Durum |
|---|---|---|
| Hosting + CDN | Cloudflare Pages | ✅ Kasım 2026 Vercel'den taşındı |
| Kimlik (Auth) | Firebase Authentication (Google + e-posta) | ✅ Kasım 2026 Supabase'den taşındı |
| Veritabanı | Firebase Firestore (ayrı proje, okul verisinden bağımsız) | ✅ `profiller` koleksiyonu, kurallar `firestore.rules` |
| İçerik (geçiş dönemi) | Wix CMS | ✅ Çalışıyor → Faz 3'te Firestore'a taşınacak |
| Görseller | Cloudinary (25GB ücretsiz) | ⏳ Hesap açılacak |
| Video | YouTube embed | ⏳ Kanal açılacak |
| Seminer kayıtları | Firestore (koleksiyon eklenecek) | ⏳ |
| E-posta | Resend (bülten) | ⏳ Faz 2 |

## Tasarım Sistemi (v9 — "Hareketli Alfabe")

- **İmza:** Logodaki M-O-C kareleri = Montessori'nin hareketli alfabe materyali.
  Başlıklarda harf karoları, bölüm etiketlerinde tek karo. Sitenin hatırlanacak öğesi.
- **Tipografi:** Fraunces (display, sıcak/karakterli) + Manrope (gövde). İkisi de Türkçe destekli.
- **Palet:** Çivit mürekkep `#22223A` · Kâğıt `#FAF6EF` · Somon `#F4857A` · Gök `#4A90C4`
  · Yaprak `#5C8A5E` (orman okulu) · Altın `#D9A441` (altın boncuk)
- **Raf motifi:** Kitaplık bölümünün altında altın raf çizgisi (hazırlanmış ortam göndermesi).
- Kalite tabanı: mobil duyarlı, focus-visible, prefers-reduced-motion, semantik HTML.

## Sayfa Haritası

```
/            → index.html      Ana sayfa (✅ v9 yeni tasarım)
/uyelik      → uyelik.html     Kayıt + giriş (✅ Firebase)
/profil      → profil.html     Üye paneli (🔄 Firebase'e bağlanacak)
/admin       → admin.html      Yönetim (✅ Google OAuth)
/blog        → blog.html       Kitaplık: yazılar (⏳ Faz 1)
/podcast     → podcast.html    Kitaplık: bölümler (⏳ Faz 1)
/topluluk    → topluluk.html   Soru-Cevap forumu (⏳ Faz 2)
```
Cloudflare Pages `.html` uzantısız temiz adresleri kendiliğinden sunar; güvenlik başlıkları `_headers` dosyasında.

## Fazlar

**Faz 0 — Temel (✅ tamamlandı)**
Ana sayfa v9, üyelik (Google + e-posta), Firestore kuralları, admin paneli, domain.

**Faz 1 — Kitaplık (sıradaki)**
- blog.html + podcast.html ayrı sayfalar, kategori filtreli
- profil.html'i Firebase'e bağla (gerçek rozetler, okuma listesi)
- Cloudinary hesabı + görsellerin taşınması
- Seminer kaydını Firestore'a yaz (tek tık kayıt)

**Faz 2 — Topluluk**
- Soru-Cevap forumu (Firestore `sorular` + `cevaplar` koleksiyonları, kurallı)
- Rozet motoru (ilk soru, ilk cevap, 5 içerik okuma...)
- Resend ile haftalık bülten
- Üye sayısı 1.000+ hedefi

**Faz 3 — Bağımsızlık ve Ölçek**
- İçeriğin Wix'ten Firestore'a tam taşınması
- Next.js'e geçiş (SEO + hız için SSG)
- Premium içerik katmanı (isteğe bağlı gelir modeli)
- SaaS vizyonu: diğer okullara topluluk altyapısı

## Ölçeklenme Notları
- Cloudflare CDN: sınırsız statik trafik, ücretsiz.
- Firebase ücretsiz plan (Spark): günlük okuma/yazma kotası küçük topluluk için yeterli.
- Video/görsel trafiği sitede değil (YouTube + Cloudinary) → site her zaman hızlı.

## Öğretmen kartı ve doğrulama (Kasım 2026)

Toplulukta öğretmen üyelerin adına tıklanınca açılan kart ve `/ogretmen?u=<uid>` profil sayfası.

| Parça | Dosya |
|---|---|
| Veri katmanı | `ogretmen-veri.js` |
| Açılır kart (topluluk, profil önizlemesi) | `yazar-karti.js`, `yazar-karti.css` |
| Herkese açık profil sayfası | `ogretmen.html`, `ogretmen.js` |
| Öğretmenin düzenleme ekranı | `profil.js` → "Öğretmen Kartım" bölümü |
| Yönetici doğrulama kuyruğu | `ogretmen-yonetim.js` → admin "Öğretmen Doğrulama" |
| Kurallar | `firestore.rules` (`ogretmenler`, `belge_basvurulari`), `storage.rules` (`belgeler/`) |
| Kural testleri | `testler/` → `npm install && npm test` (emülatörde) |

- `ogretmenler/{uid}`: kart. `acik: true` ise herkes okur, değilse yalnızca sahibi ve yönetici. E-posta/iletişim alanı yoktur.
- `dogrulamalar` alanını yalnızca yönetici yazar. Onay anındaki bilgi kopyalanır; öğretmen bilgiyi değiştirirse rozet kendiliğinden düşer.
- `belge_basvurulari`: öğretmenin doğrulama isteği; sahibi ve yönetici okur, kararı yönetici verir.
- Belge yükleme (`ogretmen-veri.js` → `BELGE_YUKLEME_ACIK`) Firebase Storage açılana kadar kapalı; o sürede belge e-postayla istenir.

