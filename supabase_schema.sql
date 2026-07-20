-- ═══════════════════════════════════════════════════
-- MONTESSORİ OKULU — Supabase Veritabanı Şeması
-- supabase.com/dashboard → SQL Editor → New Query
-- Tümünü kopyalayıp çalıştır
-- ═══════════════════════════════════════════════════

-- 1. PROFILLER TABLOSU
-- Supabase Auth ile otomatik entegre
CREATE TABLE IF NOT EXISTS public.profiller (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  ad_soyad TEXT,
  avatar_url TEXT,
  uyelik_tipi TEXT DEFAULT 'merakli' CHECK (uyelik_tipi IN ('ebeveyn', 'ogretmen', 'merakli')),
  bio TEXT,
  sehir TEXT,
  cocuk_yasi TEXT[], -- ebeveynler için çocuk yaşları
  okul_adi TEXT,     -- öğretmenler için okul adı
  rozet_sayisi INTEGER DEFAULT 0,
  toplam_okuma INTEGER DEFAULT 0,
  katilma_tarihi TIMESTAMPTZ DEFAULT NOW(),
  son_aktif TIMESTAMPTZ DEFAULT NOW(),
  bildirimler BOOLEAN DEFAULT TRUE,
  gizlilik TEXT DEFAULT 'public' CHECK (gizlilik IN ('public', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROZETLEr TABLOSU
CREATE TABLE IF NOT EXISTS public.rozetler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uye_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
  rozet_adi TEXT NOT NULL,
  rozet_icon TEXT NOT NULL,
  rozet_aciklama TEXT,
  kazanilma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 3. OKUMA LİSTESİ
CREATE TABLE IF NOT EXISTS public.okuma_listesi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uye_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
  icerik_tipi TEXT CHECK (icerik_tipi IN ('blog', 'podcast', 'video')),
  icerik_id TEXT NOT NULL,  -- Wix blog post ID veya CMS ID
  icerik_baslik TEXT,
  icerik_kategori TEXT,
  icerik_icon TEXT,
  durum TEXT DEFAULT 'kayitli' CHECK (durum IN ('kayitli', 'tamamlandi')),
  ekleme_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SEMİNER KAYITLARI
CREATE TABLE IF NOT EXISTS public.seminer_kayitlari (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uye_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
  seminer_id TEXT NOT NULL, -- Wix Bookings service ID
  seminer_adi TEXT NOT NULL,
  seminer_tarihi TIMESTAMPTZ,
  seminer_turu TEXT,
  katilim_durumu TEXT DEFAULT 'kayitli' CHECK (katilim_durumu IN ('kayitli', 'katildi', 'iptal')),
  kayit_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 5. İÇERİK ERİŞİM LOGU (analitik için)
CREATE TABLE IF NOT EXISTS public.icerik_erisim (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uye_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
  icerik_tipi TEXT,
  icerik_id TEXT,
  erisim_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BÜLTEN ABONELERİ
CREATE TABLE IF NOT EXISTS public.bulten_abone (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  ad TEXT,
  uyelik_tipi TEXT DEFAULT 'merakli',
  aktif BOOLEAN DEFAULT TRUE,
  kayit_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — Güvenlik Kuralları
-- ═══════════════════════════════════════════════════

ALTER TABLE public.profiller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rozetler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okuma_listesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminer_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icerik_erisim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulten_abone ENABLE ROW LEVEL SECURITY;

-- Profil: herkes okuyabilir, sadece sahip güncelleyebilir
CREATE POLICY "Profiller herkes tarafindan goruntülenebilir"
  ON public.profiller FOR SELECT USING (TRUE);

CREATE POLICY "Kullaniclar kendi profilini güncelleyebilir"
  ON public.profiller FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Kullaniclar kendi profilini ekleyebilir"
  ON public.profiller FOR INSERT WITH CHECK (auth.uid() = id);

-- Rozetler: herkes okuyabilir, sadece sistem ekleyebilir
CREATE POLICY "Rozetler herkes tarafindan goruntülenebilir"
  ON public.rozetler FOR SELECT USING (TRUE);

CREATE POLICY "Kullaniclar kendi rozetlerini ekleyebilir"
  ON public.rozetler FOR INSERT WITH CHECK (auth.uid() = uye_id);

-- Okuma listesi: sadece sahip görebilir
CREATE POLICY "Okuma listesi sadece sahip tarafindan goruntülenebilir"
  ON public.okuma_listesi FOR SELECT USING (auth.uid() = uye_id);

CREATE POLICY "Okuma listesine sadece sahip ekleyebilir"
  ON public.okuma_listesi FOR INSERT WITH CHECK (auth.uid() = uye_id);

CREATE POLICY "Okuma listesini sadece sahip güncelleyebilir"
  ON public.okuma_listesi FOR UPDATE USING (auth.uid() = uye_id);

CREATE POLICY "Okuma listesinden sadece sahip silebilir"
  ON public.okuma_listesi FOR DELETE USING (auth.uid() = uye_id);

-- Seminer kayıtları: sadece sahip görebilir
CREATE POLICY "Seminer kayitlari sadece sahip tarafindan goruntülenebilir"
  ON public.seminer_kayitlari FOR SELECT USING (auth.uid() = uye_id);

CREATE POLICY "Seminer kayitlarina sadece sahip ekleyebilir"
  ON public.seminer_kayitlari FOR INSERT WITH CHECK (auth.uid() = uye_id);

-- Bülten: herkes ekleyebilir
CREATE POLICY "Bültene herkes abone olabilir"
  ON public.bulten_abone FOR INSERT WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════
-- TRIGGER: Yeni kullanıcı kaydında profil oluştur
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.yeni_kullanici_profili()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiller (id, email, ad_soyad, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER yeni_kullanici_kaydi
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.yeni_kullanici_profili();

-- ═══════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.updated_at_guncelle()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiller_updated_at
  BEFORE UPDATE ON public.profiller
  FOR EACH ROW EXECUTE FUNCTION public.updated_at_guncelle();

-- ═══════════════════════════════════════════════════
-- BAŞLANGIÇ ROZETLERİ FONKSİYONU
-- Yeni üye kaydında otomatik "Hoş Geldin" rozeti ekler
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.hos_geldin_rozeti()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.rozetler (uye_id, rozet_adi, rozet_icon, rozet_aciklama)
  VALUES (NEW.id, 'Yeni Üye', '🌱', 'Montessori Okulu topluluğuna hoş geldin!');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER yeni_uye_rozeti
  AFTER INSERT ON public.profiller
  FOR EACH ROW EXECUTE FUNCTION public.hos_geldin_rozeti();

-- Tamamlandı! ✅
SELECT 'Supabase şeması başarıyla oluşturuldu!' AS sonuc;
