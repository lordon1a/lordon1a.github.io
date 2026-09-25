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

## Özelleştirme
- **İsim, arka plan görseli, yedek çalma listesi, emojiler, avatarlar:** `radio/config.js`
- **Renkler ve fontlar:** `radio/style.css` dosyasının başındaki tema blokları (`amber`, `neon`, `minimal`, `lofi`).
  Yeni bir tema eklemek için bir bloğu kopyala, adını değiştir, `app.js` içindeki `THEMES` listesine ekle.

## Nasıl çalışıyor?
- Çalan şarkı ve başlama zamanı veritabanında tutulur; herkes şarkıyı aynı saniyeden dinler.
- Şarkı bitince kuyrukta **en çok oy alan** şarkı çalar. Kuyruk boşsa yedek listeden rastgele seçilir.
- Dinleyicilerin yarısı **GEÇ** derse şarkı atlanır.
- Ses YouTube oynatıcısından gelir, yani izlenmeler sanatçıya sayılır.
