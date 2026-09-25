# Radyo kurulumu

Sayfa adresi: `https://guldal.me/radio/`

Firebase ayarlanmadan da sayfa açılır ama **demo modunda** çalışır: sohbet ve kuyruk sadece senin tarayıcında görünür.
Herkesin aynı şarkıyı duyması ve birlikte sohbet edebilmesi için aşağıdaki adımları bir kez yapman yeterli (ücretsiz).

## 1. Firebase projesi oluştur
1. https://console.firebase.google.com adresine gir, **Proje ekle** de (Analytics'i kapatabilirsin).
2. Sol menü → **Build → Realtime Database → Create database**. Konum olarak `europe-west1` seç, **locked mode** ile başlat.
3. Sol menü → **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.

## 2. Kuralları yükle
Realtime Database → **Rules** sekmesi. İçeriği `database.rules.json` dosyasındakiyle değiştirip **Publish** de.

## 3. Ayarları siteye ekle
1. Proje ayarları (⚙️) → **General** → alttaki **Your apps** → `</>` (Web) simgesi → bir isim ver, kaydet.
2. Gösterilen `firebaseConfig` içindeki değerleri `radio/config.js` dosyasındaki `firebase: { ... }` kısmına kopyala.
   `databaseURL` görünmüyorsa Realtime Database sayfasının üstündeki adresi (`https://...firebasedatabase.app`) yaz.
3. Authentication → **Settings → Authorized domains** listesine `guldal.me` ekle.

## 4. Kendini mod yap
1. Siteye girip bir kez katıl.
2. Firebase → Realtime Database → **Data** → `presence` altında kendi ID'ni gör (uzun bir kod).
3. Kök dizine `mods` adında bir alan ekle, içine `<senin-id'n>: true` yaz.

Modlar sohbette **MOD** rozetiyle görünür, mesaj silebilir, kuyruktan şarkı kaldırabilir ve **GEÇ** tuşuyla şarkıyı oylamasız geçebilir.

## Tasarım
Sayfanın arka planı Three.js ile çizilen bir oda: pencereden güneş ışığı giren bir masa ve üstünde bir pikap.
- Plağın etiketinde çalan şarkının kapağı ve adı görünür. Müzik çalınca plak 33⅓ devirle döner, kol şarkı ilerledikçe içe kayar.
- Plağa tıklayınca çal / durdur (sadece o dinleyici için).
- Pencereden görünen gökyüzü, ışığın rengi ve açısı ziyaretçinin saatine göre değişir:

| Saat | Vakit |
|---|---|
| 05–11 | sabah |
| 11–17 | öğle |
| 17–21 | akşam (gün batımı) |
| 21–05 | gece (ay ışığı) |

Üstteki **vakit** düğmesiyle elle de seçilebilir.

Odada ayrıca şunlar var: pencerede adalar ve geçen bir yelkenli, duvarda kanla çizilmiş Red John gülen yüzü, masada çay fincanı, sukulent, plak kapakları, lastik ördek (şarkı değişince zıplar) ve masaya kazınmış bir **11**.

## Özelleştirme
- **İsim, yedek çalma listesi, emojiler, avatarlar:** `radio/config.js`
- **3D sahnenin renkleri ve ışıkları:** `radio/scene.js` içindeki `PHASES`
- **Arayüz renkleri ve yazı tipleri:** `radio/style.css` başındaki `[data-phase=...]` blokları

## Nasıl çalışıyor?
- Çalan şarkı ve başlama zamanı veritabanında tutulur; herkes şarkıyı aynı saniyeden dinler.
- Şarkı bitince kuyrukta **en çok oy alan** şarkı çalar. Kuyruk boşsa yedek listeden rastgele seçilir.
- Dinleyicilerin yarısı **GEÇ** derse şarkı atlanır.
- Ses YouTube oynatıcısından gelir, yani izlenmeler sanatçıya sayılır.
