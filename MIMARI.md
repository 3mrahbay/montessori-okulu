# 🏛 montessoriokulu.com — Topluluk Platformu Mimarisi

## Vizyon
Türkiye'nin ilk ve tek Montessori topluluğu. Dünya örnekleri (AMS — 18.000 üye,
Montessori Thrive, Trillium, Circle/Mighty Networks) incelenerek temellendirildi.

Üç ayak: **İçerik Kitaplığı** + **Canlı Seminerler** + **Topluluk (Soru-Cevap)**

## Teknoloji Yığını (mevcut ve hedef)

| Katman | Araç | Durum |
|---|---|---|
| Hosting + CDN | Vercel | ✅ Canlı |
| Kimlik (Auth) | Supabase Auth (Google + e-posta) | ✅ Kuruldu |
| Veritabanı | Supabase PostgreSQL | ✅ Şema hazır |
| İçerik (geçiş dönemi) | Wix CMS | ✅ Çalışıyor → Faz 3'te Supabase'e taşınacak |
| Görseller | Cloudinary (25GB ücretsiz) | ⏳ Hesap açılacak |
| Video | YouTube embed | ⏳ Kanal açılacak |
| Seminer kayıtları | Supabase `seminer_kayitlari` | ✅ Tablo hazır |
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
/uyelik      → uyelik.html     Kayıt + giriş (✅ Supabase)
/profil      → profil.html     Üye paneli (🔄 Supabase'e bağlanacak)
/admin       → admin.html      Yönetim (✅ Google OAuth)
/blog        → blog.html       Kitaplık: yazılar (⏳ Faz 1)
/podcast     → podcast.html    Kitaplık: bölümler (⏳ Faz 1)
/topluluk    → topluluk.html   Soru-Cevap forumu (⏳ Faz 2)
```
`vercel.json` → `cleanUrls: true` sayesinde `.html` uzantısız temiz adresler.

## Fazlar

**Faz 0 — Temel (✅ tamamlandı)**
Ana sayfa v9, üyelik (Google + e-posta), Supabase şeması, admin paneli, domain.

**Faz 1 — Kitaplık (sıradaki)**
- blog.html + podcast.html ayrı sayfalar, kategori filtreli
- profil.html'i Supabase'e bağla (gerçek rozetler, okuma listesi)
- Cloudinary hesabı + görsellerin taşınması
- Seminer kaydını Supabase'e yaz (tek tık kayıt)

**Faz 2 — Topluluk**
- Soru-Cevap forumu (Supabase `sorular` + `cevaplar` tabloları, RLS'li)
- Rozet motoru (ilk soru, ilk cevap, 5 içerik okuma...)
- Resend ile haftalık bülten
- Üye sayısı 1.000+ hedefi

**Faz 3 — Bağımsızlık ve Ölçek**
- İçeriğin Wix'ten Supabase'e tam taşınması
- Next.js'e geçiş (SEO + hız için SSG)
- Premium içerik katmanı (isteğe bağlı gelir modeli)
- SaaS vizyonu: diğer okullara topluluk altyapısı

## Ölçeklenme Notları
- Vercel CDN: milyonlarca istek, sorun değil.
- Supabase ücretsiz plan: 50.000 aktif üye, 500MB DB — Faz 2 sonuna kadar yeterli.
- Video/görsel trafiği sitede değil (YouTube + Cloudinary) → site her zaman hızlı.
