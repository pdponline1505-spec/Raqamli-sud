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
