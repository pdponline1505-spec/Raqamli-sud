# Raqamli sud — Sudya kabineti (dizayn prototipi)

Sudya va sudya yordamchisi kabinetining interaktiv prototipi: Bosh sahifa (dashboard), ishlar ro'yxati, ish oynasi, Devonxona (ro'yxatga olish) va boshqa bo'limlar.

Bu statik sayt — build bosqichi yo'q, Node.js kerak emas.

## Tuzilishi

| Fayl / papka | Vazifasi |
|---|---|
| `index.html` | Sahifaning o'zi (shablon, uslublar va logika) |
| `support.js` | Shablonni brauzerda chizadigan runtime |
| `vendor/` | React 18 (CDN'ga bog'liq bo'lmasligi uchun lokal nusxa) |
| `assets/` | Logo va suratlar |
| `vercel.json` | Vercel sozlamalari (kesh sarlavhalari) |
| `comments.js`, `comments.css` | Izohlar qatlami (sahifaga izoh qadash) |
| `api/comments.js` | Izohlar API (Vercel serverless funksiyasi) |

## Lokal ko'rish

```bash
python3 -m http.server 8080
# keyin brauzerda: http://localhost:8080
```

`index.html` faylini to'g'ridan-to'g'ri (file://) ochmang — skriptlar server orqali yuklanishi kerak.

## Vercel'ga joylash

1. https://vercel.com → **Add New… → Project**
2. GitHub'dan `Raqamli-sud` repozitoriyasini tanlang (**Import**)
3. Sozlamalar:
   - **Framework Preset:** `Other`
   - **Build Command:** bo'sh qoldiring
   - **Output Directory:** bo'sh qoldiring (ildiz papka)
4. **Deploy** bosing

Shundan keyin `main` branchga har bir push avtomatik qayta joylanadi.

## Izohlar (comment) funksiyasi

Saytning o'ng pastki burchagida **Izoh** tugmasi bor (yoki klaviaturada `C`):

1. **Izoh** ni bosing va sahifaning kerakli joyini tanlang.
2. Ismingiz va izohni yozib **Yuborish** ni bosing (`Ctrl+Enter`).
3. Raqamli belgini bosib javob yozish, **✓** bilan hal qilindi deb belgilash yoki o'chirish mumkin.
4. Ro'yxat tugmasi barcha izohlarni ko'rsatadi; boshqa ekrandagi izohni bossangiz, sayt o'sha ekranga o'tadi.

Izohlar Vercel login talab qilmaydi — havolani ochgan har kim izoh qoldira oladi.

### Bir martalik sozlash (ma'lumotlar bazasi)

Izohlar **Upstash Redis** (Vercel Marketplace, bepul tarif) da saqlanadi:

1. Vercel'da loyihani oching → **Storage** → **Create Database** (yoki **Browse Marketplace**) → **Upstash** → **Upstash for Redis**.
2. Bepul tarifni tanlab bazani yarating va **Connect Project** orqali shu loyihaga ulang.
   Vercel `KV_REST_API_URL` va `KV_REST_API_TOKEN` o'zgaruvchilarini o'zi qo'shadi.
3. **Deployments** → oxirgi deploymentda **⋯ → Redeploy** (o'zgaruvchilar kuchga kirishi uchun).

Baza ulanmaguncha sayt ishlayveradi, faqat izoh yuborishda "Izohlar xizmati hali sozlanmagan" degan xabar chiqadi.
