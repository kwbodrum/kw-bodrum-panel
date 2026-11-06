# KW Bodrum | JSON ile güncellenen istatistik paneli

**Bu sürümde API, veritabanı ve eklenti senkronizasyonu yoktur.** Kaynak: Chrome eklentisinin kendi **İstatistik Kontrolü > JSON indir** dosyası.

## 1. GitHub Pages'e ilk yayın

1. GitHub'da örneğin `kw-bodrum-panel` adında **yeni bir depo** aç.
2. Bu ZIP içindeki `index.html`, `style.css`, `app.js`, `core.js` dosyaları ve **`data/rapor.json` klasörünü** deponun **köküne** yükle. ZIP'i olduğu gibi dosya olarak yükleme, içindekileri yükle.
3. GitHub deposunda **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → / (root) → Save** seç.
4. Sayfa adresi genellikle `https://KULLANICI.github.io/kw-bodrum-panel/` biçiminde olur.

Site ilk açılışta **26–31 Ekim 2026** için önceden hazırlanmış **63 alıcı arayışını** gösterir. **02–07 Kasım 2026** haftası veri gelene kadar sıfır görünür. 27 olumlu, 29 olumsuz, 7 bekleyen **tarihsel tahmindir**.

> **GİZLİLİK:** GitHub Pages herkese açık bir site olabilir. `data/rapor.json` dosyasında gönderen *isimleri* ile sayımlar bulunur. Ham WhatsApp mesajları, ham telefonlar, mesaj ID/JID'leri, portföy detayları yayınlanmaz. Şirket içi isimlerin de herkese açık görünmesini istemiyorsanız bunu yayımlamadan önce erişim yöntemi planlayın.

## 2. Haftalık güncelleme: 3 adım

1. Eklentide **İstatistik Kontrolü** aç. **Tüm dönem** (en güvenlisi) veya ilgili hafta için **Bu hafta / Geçen hafta** seç, **JSON indir** düğmesine bas.
2. Yayımlanan KW Bodrum paneline gir, **Eklenti JSON'unu yükle** butonundan indirilen dosyayı seç. Özet ekranda hangi haftaların değişeceğini oku, **Haftaları güncelle** ile onayla. Bu anda yalnızca **kendi tarayıcındaki önizleme** değişir.
3. **Yayın JSON'unu indir** ile `rapor.json` dosyasını indir. GitHub deposundaki **`data/rapor.json` dosyasını bu dosyayla değiştir** ve Commit changes yap. GitHub Pages yayınlandığında tüm cihazlarda aynı güncel rakamlar görünür.

**Her güncellemede tek bir dosya değiştiriyorsun:** `data/rapor.json`.

## Eklenti JSON'u hakkında

Desteklenen dışa aktarım dosyasında `tur: "KW_BODRUM_DASHBOARD_VERISI"` ve `kayitlar: [...]` vardır. Eklentinin mevcut `istatistik.js` dosyasında bu biçimde hazırlanır.

- Arayış tarihi: `tespitZamaniMs` (İstanbul saatine göre günlük, haftalık, aylık ve yıllık gruplama)
- Gönderen: `gonderen`
- Bölgeler: `bolgeler` (bir kayıt birden fazla bölgede sayılır)
- Net maksimum bütçe: `maksimumButce.tutar` + `maksimumButce.birim`
- Olumlu: `teslimatDurumu === "gonderildi"` VE `eslesmeDurumu === "olumlu"`
- Olumsuz: `teslimatDurumu === "gonderildi"` VE `eslesmeDurumu === "olumsuz"`
- Diğerleri: bekleyen / dönüş yapılmayan

Aynı JSON iki defa yüklendiğinde aynı haftanın verisi **yenilenir**, iki kez toplanmaz. Tam dönem dışa aktarımı önerilir: bir haftayı güncelleyen dosyanın o haftanın **bütün kayıtlarını** içermesi gerekir. Eklenti HTML dosyasının kendi hafta seçimi Pazartesi–Pazar iken bu yönetim raporu Pazartesi–Cumartesi haftalarını kullanır. Pazar gününe denk gelen arayışlar kaybolmaması için **ayrı bir “Pazar” döneminde** gösterilir.

## Çift sayım koruması

İlk tarihsel 63 arayış, daha önce hazırlanan birleşik rapordur ve eklentinin eski kayıtlarını da içerebilir. Bu yüzden **02.11.2026 tarihinden önce tespit edilmiş arayışlar içe aktarımdan atlanır**. İlk dönemin 63 sayısı değiştirilmez.

## GitHub'daki veriler nasıl korunuyor?

Sayfa, seçtiğin ham eklenti JSON'unu tarayıcında işler; sunucuya göndermez. Tarayıcıda yalnızca özet günlük sayımlar tutulur. İndirilen `rapor.json` günlük/haftalık istatistikleri içerir; ham alıcı mesajı, tam telefon, WhatsApp ID veya portföy açıklaması içermez. **Gönderen isimleri ve özetler** yine kişisel/iş verisi sayılabilir.

## Notlar

- Excel, PDF, canlı API veya Chrome eklentisinin kendisinde değişiklik yapılmamıştır.
- Siteye JSON yüklemek diğer cihazları **otomatik** güncellemez; **GitHub'a `data/rapor.json` yükleme adımı gerekli**.
- Yeni tasarım ileride API'ye geçmeye uygun tutulmuştur: veri okuma katmanı değiştirilebilir, istatistik tabloları ve filtreler korunabilir.
- Sunucu olmadan ZIP içindeki `index.html` dosyasını açarsan ilk tarihsel sayıları görebilirsin. Kalıcı kullanım için GitHub Pages üzerinde aç.
