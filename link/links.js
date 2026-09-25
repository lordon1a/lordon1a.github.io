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

// icon: radio | youtube | x | instagram | github | spotify | discord | tiktok | mail | book | link
export const LINKS = [
  { icon: 'radio', title: 'Sunshine Radio', handle: 'radio.guldal.me', desc: 'Birlikte dinlenen radyo · şimdi ne çalıyor?', url: 'https://radio.guldal.me', featured: true },
  { icon: 'youtube', title: 'YouTube', handle: '@sunshin3fr', desc: 'Videolar ve yayın tekrarları', url: 'https://www.youtube.com/@sunshin3fr' },
  { icon: 'tiktok', title: 'TikTok', handle: '@tekelbluesu', desc: 'Kısa videolar', url: 'https://www.tiktok.com/@tekelbluesu' },
  { icon: 'instagram', title: 'Instagram', handle: '@yigitguldall', desc: 'Fotoğraflar ve hikâyeler', url: 'https://instagram.com/yigitguldall' },
  { icon: 'x', title: 'X', handle: '@yigitguldall', desc: 'Anlık notlar ve paylaşımlar', url: 'https://x.com/yigitguldall' },
  { icon: 'book', title: 'Steady State', handle: 'ders.guldal.me', desc: 'Üniversite ders notları · interaktif anlatım', url: 'https://ders.guldal.me' },
  { icon: 'link', title: 'Portföy', handle: 'ozgecmis.guldal.me', desc: 'Projeler, vaka çalışmaları ve iletişim', url: 'https://ozgecmis.guldal.me' },
  { icon: 'link', title: 'Sunshine Sunucu', handle: 'play.guldal.me', desc: 'Minecraft sunucusu · kurulum ve harita', url: 'https://play.guldal.me' },
  { icon: 'github', title: 'GitHub', handle: 'lordon1a', desc: 'Projeler ve kodlar', url: 'https://github.com/lordon1a' },
  { icon: 'spotify', title: 'Spotify', handle: 'çalma listelerim', desc: 'Radyoda çalanların en iyileri', url: '' },
  { icon: 'discord', title: 'Discord', handle: 'sunucu', desc: 'Sohbet ve topluluk', url: '' },
  { icon: 'mail', title: 'E-posta', handle: 'yigitguldal@gmail.com', desc: 'İş birlikleri ve her şey', url: 'yigitguldal@gmail.com' },
];
