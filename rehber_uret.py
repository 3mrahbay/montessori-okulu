#!/usr/bin/env python3
"""Rehber sayfalarını üretir.

Kaynak : rehber-kaynak/<anne|ogretmen>/<kisa-ad>.md   (YAML bilgi bloğu + Markdown gövde)
Çıktı  : rehber/<anne|ogretmen>/<kisa-ad>.html, rehber.html, sitemap.xml

Kullanım: python3 rehber_uret.py
Gerekli : pip install markdown pyyaml
"""
import html
import json
import pathlib
import re
from datetime import date

import markdown
import yaml

KOK = pathlib.Path(__file__).resolve().parent
SITE = "https://montessoriokulu.com"
BUGUN = date.today().isoformat()

REHBERLER = {
    "anne": {
        "ad": "Anne Rehberi", "kisa": "Anne", "ikon": "giyinme",
        "aciklama": "Evde Montessori: çocuğunuzu anlamak, ortamı hazırlamak ve gündelik hayatta Montessori'yi uygulamak için kaynaklı, sade yazılar.",
        "deneyin": "Evde deneyin",
    },
    "ogretmen": {
        "ad": "Öğretmen Rehberi", "kisa": "Öğretmen", "ikon": "geometrik",
        "aciklama": "Montessori sınıfı için: hazırlanmış ortam, ders sunumu, gözlem ve sınıf yaşamı üzerine uygulamalı yazılar.",
        "deneyin": "Sınıfta deneyin",
    },
}
# Her yazı için Montessori materyali ikonu (materyal-ikonlar.svg)
IKON = {
    "emici-zihin": "pembe-kule", "evde-gozlem": "dokme", "odul-yerine-icsel-motivasyon": "merdiven",
    "hatadan-ogrenmek": "silindir-blok", "okuma-yazmaya-ilk-adim": "zimpara-harf",
    "kozmik-egitime-evden-baslamak": "kure", "hazirlanmis-ortam-kontrol-listesi": "geometrik",
    "uc-asamali-ders": "renk-tableti", "gozlem-kaydi-tutmak": "sayi-cubugu",
    "normallesme-ve-calisma-dongusu": "altin-boncuk", "karma-yas-grubu": "pembe-kule",
    "nezaket-ve-incelik-dersleri": "giyinme",
}
SIRA = {
    "anne": ["emici-zihin", "evde-gozlem", "odul-yerine-icsel-motivasyon", "hatadan-ogrenmek",
             "okuma-yazmaya-ilk-adim", "kozmik-egitime-evden-baslamak"],
    "ogretmen": ["hazirlanmis-ortam-kontrol-listesi", "uc-asamali-ders", "gozlem-kaydi-tutmak",
                 "normallesme-ve-calisma-dongusu", "karma-yas-grubu", "nezaket-ve-incelik-dersleri"],
}

e = lambda s: html.escape(str(s or ""), quote=True)
mi = lambda ad, sinif="mi": f'<svg class="{sinif}" aria-hidden="true"><use href="{{kok}}materyal-ikonlar.svg#m-{ad}"/></svg>'


def yazilari_oku():
    yazilar = {}
    for rehber in REHBERLER:
        liste = []
        for yol in sorted((KOK / "rehber-kaynak" / rehber).glob("*.md")):
            metin = yol.read_text(encoding="utf-8")
            _, bilgi, govde = metin.split("---", 2)
            d = yaml.safe_load(bilgi)
            d["kisa_ad"] = yol.stem
            d["govde_html"] = markdown.markdown(govde, extensions=["md_in_html", "sane_lists"])
            liste.append(d)
        sira = SIRA[rehber]
        liste.sort(key=lambda d: sira.index(d["kisa_ad"]) if d["kisa_ad"] in sira else 99)
        yazilar[rehber] = liste
    return yazilar


def ust_bar(kok, aktif="rehber"):
    a = lambda k: ' class="aktif"' if k == aktif else ""
    return f'''<header class="ust-bar">
  <div class="ust-bar-ic">
    <a href="{kok}index.html" class="marka" aria-label="Montessori Okulu ana sayfa">
      <span class="marka-karolar" aria-hidden="true"><span class="karo karo-s">M</span><span class="karo karo-g">O</span><span class="karo karo-s">C</span></span>
      <span class="marka-yazi"><span class="marka-ust">MONTESSORİ</span><span class="marka-alt">OKULU<b>•</b>COM</span></span>
    </a>
    <nav aria-label="Ana menü" style="display:contents">
      <ul class="ust-linkler">
        <li><a href="{kok}topluluk.html"{a("topluluk")}>Topluluk</a></li>
        <li><a href="{kok}rehber.html"{a("rehber")}>Rehberler</a></li>
        <li><a href="{kok}index.html#kitaplik">Kitaplık</a></li>
        <li><a href="{kok}index.html#seminerler">Seminerler</a></li>
        <li><a href="{kok}index.html#okul">Bir Çiçek Koleji</a></li>
      </ul>
    </nav>
    <div class="ust-eylem">
      <a class="dugme dugme-hayalet dugme-kucuk" href="{kok}uyelik.html" id="girisDugme">Giriş Yap</a>
      <a class="dugme dugme-somon dugme-kucuk" href="{kok}uyelik.html" id="uyeDugme">Üye Ol — Ücretsiz</a>
      <button class="hamburger" onclick="document.getElementById('mobilMenu').classList.toggle('acik')" aria-label="Menüyü aç"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mobil-menu" id="mobilMenu">
  <a href="{kok}topluluk.html">Topluluk</a><a href="{kok}rehber.html">Rehberler</a>
  <a href="{kok}index.html#kitaplik">Kitaplık</a><a href="{kok}index.html#seminerler">Seminerler</a><a href="{kok}index.html#okul">Bir Çiçek Koleji</a>
  <div class="mobil-eylem"><a class="dugme dugme-hayalet" style="flex:1" href="{kok}uyelik.html">Giriş Yap</a><a class="dugme dugme-somon" style="flex:1" href="{kok}uyelik.html">Üye Ol</a></div>
</div>'''


def alt_bilgi(kok):
    return f'''<footer>
  <div class="icerik">
    <div class="alt-taban" style="border-top:none;padding-top:0">
      <span class="alt-telif">© 2026 montessoriokulu.com — Bir Çiçek Koleji Anaokulu ailesinden</span>
      <div class="alt-kardes"><a href="{kok}index.html">Ana sayfa</a> · <a href="{kok}topluluk.html">Topluluk</a> · <a href="{kok}rehber.html">Rehberler</a> ·
        <a href="https://www.instagram.com/montessoriokulucom/" target="_blank" rel="noopener">Instagram</a></div>
    </div>
  </div>
</footer>
<script type="module">
try {{
  const {{ oturumDinle }} = await import('{kok}oturum.js');
  oturumDinle(u => {{ if (!u) return; const g = document.getElementById('girisDugme'); g.textContent = 'Profilim'; g.href = '{kok}profil.html';
    document.getElementById('uyeDugme').style.display = 'none'; }});
}} catch (e) {{}}
</script>'''


def bas(baslik, aciklama, kanonik, kok, ek=""):
    return f'''<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(baslik)}</title>
<meta name="description" content="{e(aciklama)}">
<link rel="canonical" href="{kanonik}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(baslik)}">
<meta property="og:description" content="{e(aciklama)}">
<meta property="og:url" content="{kanonik}">
<meta property="og:image" content="{SITE}/og-image.png">
<link rel="icon" type="image/png" sizes="32x32" href="{kok}favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{kok}site.css">
<link rel="stylesheet" href="{kok}topluluk.css">
<link rel="stylesheet" href="{kok}rehber.css">
{ek}
</head>
<body>'''


def yazi_sayfasi(rehber, d, kardesler):
    kok = "../../"
    r = REHBERLER[rehber]
    adres = f"{SITE}/rehber/{rehber}/{d['kisa_ad']}"
    ikon = IKON.get(d["kisa_ad"], r["ikon"])
    sss = d.get("sss") or []
    kaynaklar = d.get("kaynaklar") or []
    makale_ld = {
        "@context": "https://schema.org", "@type": "Article", "headline": d["baslik"],
        "description": d["ozet"], "inLanguage": "tr", "mainEntityOfPage": adres,
        "datePublished": d.get("tarih", BUGUN), "dateModified": BUGUN,
        "author": {"@type": "Organization", "name": "Montessori Okulu"},
        "publisher": {"@type": "Organization", "name": "Montessori Okulu", "url": SITE,
                      "logo": {"@type": "ImageObject", "url": f"{SITE}/logo-moc.png"}},
        "image": f"{SITE}/og-image.png", "keywords": ", ".join(d.get("anahtar") or []),
        "citation": [k["url"] for k in kaynaklar],
    }
    ld = [makale_ld, {
        "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Rehberler", "item": f"{SITE}/rehber"},
            {"@type": "ListItem", "position": 2, "name": r["ad"], "item": f"{SITE}/rehber#{rehber}"},
            {"@type": "ListItem", "position": 3, "name": d["baslik"], "item": adres}]}]
    if sss:
        ld.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": s["s"], "acceptedAnswer": {"@type": "Answer", "text": s["c"]}} for s in sss]})
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)

    sss_html = "".join(f'<details class="m-sss"><summary>{e(s["s"])}</summary><p>{e(s["c"])}</p></details>' for s in sss)
    kaynak_html = "".join(
        f'<li><a href="{e(k["url"])}" target="_blank" rel="noopener">{e(k["ad"])}</a>'
        f'<span class="m-dil">{"Türkçe" if k.get("dil") == "tr" else "İngilizce"}</span></li>' for k in kaynaklar)
    kardes_html = "".join(
        f'<a class="r-kart" href="{k["kisa_ad"]}.html">{mi(IKON.get(k["kisa_ad"], r["ikon"])).replace("{kok}", kok)}'
        f'<span class="r-kat">{e(k["kategori"])}</span><span class="r-ad">{e(k["baslik"])}</span>'
        f'<span class="r-meta">{e(k.get("okuma_dk", 5))} dk okuma</span></a>' for k in kardesler[:3])

    govde = d["govde_html"].replace("Evde deneyin", r["deneyin"]) if rehber == "ogretmen" else d["govde_html"]
    sayfa = bas(f'{d.get("seo_baslik") or d["baslik"]} · {r["ad"]} — Montessori Okulu', d["ozet"], adres, kok, ld_html)
    sayfa += ust_bar(kok)
    sayfa += f'''
<main>
  <article class="m-makale">
    <div class="icerik m-dar">
      <nav class="m-yol" aria-label="Konum"><a href="{kok}rehber.html">Rehberler</a> <span>/</span> <a href="{kok}rehber.html#{rehber}">{e(r["ad"])}</a></nav>
      <div class="m-ust">
        <div class="m-ikon">{mi(ikon).replace("{kok}", kok)}</div>
        <div>
          <div class="r-kat">{e(r["ad"])} · {e(d["kategori"])}</div>
          <h1 class="m-baslik">{e(d["baslik"])}</h1>
          <div class="m-meta"><span>{e(d.get("yas", ""))}</span><span>{e(d.get("okuma_dk", 5))} dk okuma</span><span>{len(kaynaklar)} kaynak</span></div>
        </div>
      </div>
      <p class="m-ozet">{e(d["ozet"])}</p>
      <div class="m-kisa"><span class="m-kisa-etiket">Kısaca</span>{e(d["kisa_cevap"])}</div>
      <div class="m-govde">{govde}</div>
      {f'<section class="m-bolum"><h2>Sık sorulan sorular</h2>{sss_html}</section>' if sss else ''}
      <section class="m-bolum m-kaynaklar"><h2>Kaynaklar</h2>
        <p class="m-not">Bu yazı aşağıdaki yurt dışı ve yurt içi kaynaklardan yararlanılarak, kendi cümlelerimizle hazırlandı.</p>
        <ol>{kaynak_html}</ol></section>
      <section class="m-topluluk">
        {mi("ses-kutusu").replace("{kok}", kok)}
        <div><h2>Bu konuda aklına takılan bir şey mi var?</h2>
          <p>Topluluğa sor; ekibimiz ve deneyimli üyeler cevaplasın. Kendi deneyimini paylaşmak da başkalarına yol gösterir.</p></div>
        <div class="m-topluluk-dugme"><a class="dugme dugme-somon" href="{kok}topluluk.html?yaz=soru">Toplulukta sor</a>
          <a class="dugme dugme-hayalet" href="{kok}topluluk.html?yaz=deneyim">Deneyimini paylaş</a></div>
      </section>
    </div>
  </article>
  <section class="m-kardes"><div class="icerik">
    <h2 class="m-kardes-baslik">{e(r["ad"])}'nden diğer yazılar</h2>
    <div class="r-izgara">{kardes_html}</div>
  </div></section>
</main>'''
    sayfa += alt_bilgi(kok) + "\n</body>\n</html>\n"
    return sayfa


def dizin_sayfasi(yazilar):
    kok = ""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Montessori Rehberleri",
          "url": f"{SITE}/rehber", "inLanguage": "tr",
          "hasPart": [{"@type": "Article", "headline": d["baslik"], "url": f"{SITE}/rehber/{r}/{d['kisa_ad']}"}
                      for r, liste in yazilar.items() for d in liste]}
    sayfa = bas("Montessori Rehberleri — Anne Rehberi ve Öğretmen Rehberi · Montessori Okulu",
                "Evde ve sınıfta Montessori için kaynaklı Türkçe rehberler: Anne Rehberi, Öğretmen Rehberi ve topluluk üyelerinin hazırladığı rehberler.",
                f"{SITE}/rehber", kok, f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')
    sayfa += ust_bar(kok)
    bolumler = ""
    for rehber, liste in yazilar.items():
        r = REHBERLER[rehber]
        kartlar = "".join(
            f'<a class="r-kart" href="rehber/{rehber}/{d["kisa_ad"]}.html">{mi(IKON.get(d["kisa_ad"], r["ikon"])).replace("{kok}", kok)}'
            f'<span class="r-kat">{e(d["kategori"])}</span><span class="r-ad">{e(d["baslik"])}</span>'
            f'<span class="r-ozet">{e(d["ozet"])}</span><span class="r-meta">{e(d.get("yas", ""))} · {e(d.get("okuma_dk", 5))} dk okuma</span></a>'
            for d in liste)
        bolumler += f'''
  <section class="r-bolum" id="{rehber}"><div class="icerik">
    <div class="r-bolum-bas">{mi(r["ikon"]).replace("{kok}", kok)}<div><h2>{e(r["ad"])}</h2><p>{e(r["aciklama"])}</p></div></div>
    <div class="r-izgara">{kartlar}</div>
  </div></section>'''
    sayfa += f'''
<main>
  <section class="t-giris"><div class="icerik">
    <div>
      <div class="etiket"><span class="karo karo-a">R</span> Rehberler</div>
      <h1>Kaynaklı, sade,<br>uygulanabilir.</h1>
      <p>Yurt dışındaki ve Türkiye'deki güvenilir kaynaklardan yararlanarak hazırladığımız Türkçe rehberler. Her yazının sonunda kaynakları, her birinde evde ya da sınıfta hemen deneyebileceğiniz bir uygulama var.</p>
      <div class="t-dugmeler"><a class="dugme dugme-somon" href="#anne">Anne Rehberi</a><a class="dugme dugme-acik" href="#ogretmen">Öğretmen Rehberi</a>
        <a class="dugme dugme-acik" href="topluluk.html?tur=rehber">Üye Rehberleri</a></div>
    </div>
    <div class="t-vitrin">
      <div class="t-vitrin-kart">{mi("giyinme").replace("{kok}", kok)}<div class="t-vitrin-sayi">{len(yazilar["anne"])}</div><div class="t-vitrin-ad">Anne rehberi</div></div>
      <div class="t-vitrin-kart">{mi("geometrik").replace("{kok}", kok)}<div class="t-vitrin-sayi">{len(yazilar["ogretmen"])}</div><div class="t-vitrin-ad">Öğretmen rehberi</div></div>
      <div class="t-vitrin-kart">{mi("zimpara-harf").replace("{kok}", kok)}<div class="t-vitrin-sayi" id="uyeRehberSay">–</div><div class="t-vitrin-ad">Üye rehberi</div></div>
    </div>
  </div></section>
  {bolumler}
  <section class="r-bolum" id="uye"><div class="icerik">
    <div class="m-topluluk">
      {mi("zimpara-harf").replace("{kok}", kok)}
      <div><h2>Bildiğini bir rehbere dönüştür</h2>
        <p>Evde ya da sınıfta işe yarayan bir yöntemin mi var? Adım adım yaz, gönder; incelendikten sonra Üye Rehberleri arasında yayınlansın.</p></div>
      <div class="m-topluluk-dugme"><a class="dugme dugme-somon" href="topluluk.html?yaz=rehber">Rehber gönder</a>
        <a class="dugme dugme-hayalet" href="topluluk.html?tur=rehber">Üye rehberlerini oku</a></div>
    </div>
  </div></section>
</main>
<script type="module">
try {{
  const {{ yayindakiGonderiler }} = await import('./topluluk-veri.js');
  const l = await yayindakiGonderiler('rehber');
  document.getElementById('uyeRehberSay').textContent = l.length;
}} catch (e) {{ document.getElementById('uyeRehberSay').textContent = '0'; }}
</script>'''
    sayfa += alt_bilgi(kok) + "\n</body>\n</html>\n"
    return sayfa


def site_haritasi(yazilar):
    adresler = ["/", "/topluluk", "/rehber"] + [f"/rehber/{r}/{d['kisa_ad']}" for r, l in yazilar.items() for d in l]
    satirlar = "\n".join(f"  <url><loc>{SITE}{a}</loc><lastmod>{BUGUN}</lastmod></url>" for a in adresler)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{satirlar}\n</urlset>\n'


def main():
    yazilar = yazilari_oku()
    for rehber, liste in yazilar.items():
        klasor = KOK / "rehber" / rehber
        klasor.mkdir(parents=True, exist_ok=True)
        for d in liste:
            kardesler = [k for k in liste if k["kisa_ad"] != d["kisa_ad"]]
            (klasor / f"{d['kisa_ad']}.html").write_text(yazi_sayfasi(rehber, d, kardesler), encoding="utf-8")
    (KOK / "rehber.html").write_text(dizin_sayfasi(yazilar), encoding="utf-8")
    (KOK / "sitemap.xml").write_text(site_haritasi(yazilar), encoding="utf-8")
    print(f"Üretildi: {sum(len(l) for l in yazilar.values())} yazı, rehber.html, sitemap.xml")


if __name__ == "__main__":
    main()
