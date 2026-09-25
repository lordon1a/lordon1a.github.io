// Radyo ayarları — burayı düzenleyerek siteyi kendine göre ayarlayabilirsin.
export const CONFIG = {
  // Kartın başlığında görünen isim
  siteName: 'Sunshine Radio',

  // Firebase ayarları. Boş bırakılırsa site "demo modunda" çalışır (sadece sen görürsün).
  // Kurulum için KURULUM.md dosyasına bak.
  firebase: {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    appId: '',
  },

  // Kuyruk boşken rastgele çalınacak şarkılar (YouTube video ID'si + başlık)
  fallbackPlaylist: [
    { videoId: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody' },
    { videoId: 'hTWKbfoikeg', title: 'Nirvana - Smells Like Teen Spirit' },
    { videoId: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up' },
    { videoId: '60ItHLz5WEA', title: 'Alan Walker - Faded' },
  ],

  // Sohbette yüklenecek son mesaj sayısı
  chatHistory: 100,

  // Şarkıyı geçmek için gereken oy oranı (0.5 = dinleyicilerin yarısı)
  skipRatio: 0.5,

  // Sohbetteki hızlı tepki emojileri
  reactions: ['☀️', '🔥', '❤️', '😂', '🎧'],

  // Katılırken seçilebilecek avatarlar
  avatars: ['🌞', '🌻', '🦁', '🐱', '🦊', '🐼', '🐙', '🦄', '🍋', '🍉', '🎸', '😎'],
};
