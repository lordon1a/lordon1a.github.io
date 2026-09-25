// Link sayfası ayarları — linkleri buradan ekle, sil, sırala.
// url boş bırakılan link gösterilmez.
export const PROFILE = {
  name: 'Güldal',
  // Etiket, sayfanın açıldığı alan adını gösterir: guldal.me / link.guldal.me
  eyebrow: (typeof location === 'undefined' ? 'guldal.me' : location.host).toUpperCase(),
  tagline: '> sunshine, plaklar ve biraz kod',
  // Kendi fotoğrafını koymak için dosyayı link/ klasörüne at ve adını yaz: 'avatar.jpg'
  avatar: '',
};

// icon: radio | youtube | x | instagram | github | spotify | discord | tiktok | mail | link
export const LINKS = [
  { icon: 'radio', title: 'Sunshine Radio', handle: 'radio.guldal.me', desc: 'Birlikte dinlenen radyo · şimdi ne çalıyor?', url: 'https://radio.guldal.me', featured: true },
  { icon: 'youtube', title: 'YouTube', handle: '@kullaniciadi', desc: 'Videolar ve yayın tekrarları', url: 'https://youtube.com/@kullaniciadi' },
  { icon: 'x', title: 'X', handle: '@kullaniciadi', desc: 'Anlık notlar ve paylaşımlar', url: 'https://x.com/kullaniciadi' },
  { icon: 'instagram', title: 'Instagram', handle: '@kullaniciadi', desc: 'Fotoğraflar ve hikâyeler', url: 'https://instagram.com/kullaniciadi' },
  { icon: 'github', title: 'GitHub', handle: 'lordon1a', desc: 'Projeler ve kodlar', url: 'https://github.com/lordon1a' },
  { icon: 'spotify', title: 'Spotify', handle: 'çalma listelerim', desc: 'Radyoda çalanların en iyileri', url: '' },
  { icon: 'discord', title: 'Discord', handle: 'sunucu', desc: 'Sohbet ve topluluk', url: '' },
  { icon: 'mail', title: 'E-posta', handle: 'yigitguldal@gmail.com', desc: 'İş birlikleri ve her şey', url: 'yigitguldal@gmail.com' },
];
