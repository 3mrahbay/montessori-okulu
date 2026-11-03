// Cloudflare Pages Function: /sitemap-topluluk.xml
// Yayındaki topluluk paylaşımlarını (soru, deneyim, üye rehberi) arama motorlarına bildirir.
// Firestore'un herkese açık okuma kuralı yalnızca durum == "yayinda" belgelerini döndürür.
const PROJE = 'montessori-okulu';
const ANAHTAR = 'AIzaSyD7NuH2eOkuPAYv2d6oYA26MNABxOlA9LI'; // tarayıcıda zaten açık olan Firebase web anahtarı
const SITE = 'https://montessoriokulu.com';

export async function onRequestGet() {
  const sorgu = {
    structuredQuery: {
      from: [{ collectionId: 'gonderiler' }],
      where: { fieldFilter: { field: { fieldPath: 'durum' }, op: 'EQUAL', value: { stringValue: 'yayinda' } } },
      select: { fields: [{ fieldPath: 'olusturma' }] },
      limit: 5000
    }
  };
  let satirlar = '';
  try {
    const yanit = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJE}/databases/(default)/documents:runQuery?key=${ANAHTAR}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sorgu) });
    const veri = await yanit.json();
    satirlar = (Array.isArray(veri) ? veri : [])
      .filter(r => r.document)
      .map(r => {
        const id = r.document.name.split('/').pop();
        const tarih = (r.document.fields?.olusturma?.timestampValue || r.document.updateTime || '').slice(0, 10);
        return `  <url><loc>${SITE}/topluluk?g=${encodeURIComponent(id)}</loc>${tarih ? `<lastmod>${tarih}</lastmod>` : ''}</url>`;
      }).join('\n');
  } catch (e) { /* veri alınamazsa boş harita döner */ }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${satirlar}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
