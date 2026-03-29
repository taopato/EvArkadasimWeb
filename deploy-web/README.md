# EvArkadasim Web

Bu klasor, mevcut Expo tabanli mobil uygulamanin web cikisini build edip yayina hazir hale getirmek icin olusturuldu.

## Komutlar

```powershell
npm install
npm run dev
npm run build
npm run serve
```

## Akis

- `npm run dev` mevcut mobil/frontend uygulamasini web modunda açar.
- `npm run build` Expo web build alir ve sonucu `web/dist` altina kopyalar.
- `npm run serve` olusan statik dosyalari local olarak test etmek icin kullanilir.

## Production onerisi

- Web: `evarkadasim.co`
- API: `api.evarkadasim.co`
- OCR servisi: backend ile ayni sunucuda `127.0.0.1:8008`

## Domain notlari

- Google login icin Google Cloud Console tarafinda `https://evarkadasim.co` ve gerekiyorsa `https://www.evarkadasim.co` Authorized JavaScript origins olarak eklenmeli.
- Backend CORS ayarlari `EvArkadasim.API/appsettings*.json` icinde hazirlandi.
