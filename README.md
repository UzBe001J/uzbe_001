# UzBe DevOps LMS — deploy qo'llanmasi

## 1) Anthropic API key olish (AI test funksiyasi uchun)
1. https://console.anthropic.com ga kiring (ro'yxatdan o'ting).
2. **Settings -> API Keys -> Create Key** bosing, kalitni nusxalab oling (`sk-ant-...`).
3. Hisobingizga biroz balans (masalan $5-10) qo'shing — test yaratish shu balansdan yechiladi.
   Bu kalitni hech qayerga (GitHub'ga ham) qo'ymang — faqat Cloudflare "sir" (secret) sifatida kiritiladi (4-qadam).

## 2) Supabase loyihasi yaratish (foydalanuvchilar/progress saqlash uchun)
1. https://supabase.com -> **New project**.
2. Loyiha tayyor bo'lgach: **Project Settings -> API** bo'limidan:
   - `Project URL` ni nusxalang
   - `anon` / `publishable` kalitni nusxalang
3. **SQL Editor -> New query** ga o'ting, ushbu repodagi `supabase-setup.sql` faylining
   ichidagini to'liq joylashtirib **Run** bosing (bu `kv_store` jadvalini yaratadi).
4. `index.html` faylini oching, quyidagi qatorlarni toping va o'zgartiring:
   ```js
   const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
   const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```
   O'z URL va kalitingiz bilan almashtiring.

## 3) GitHub'ga yuklash
```bash
git add .
git commit -m "Deploy uchun tayyorlash: AI backend, Supabase sozlamalari"
git push
```

## 4) Cloudflare Pages'ga ulash
1. https://dash.cloudflare.com -> **Workers & Pages -> Create -> Pages -> Connect to Git**.
2. GitHub repongizni tanlang.
3. Build sozlamalari:
   - **Framework preset:** None
   - **Build command:** bo'sh qoldiring
   - **Build output directory:** `/` (yoki `.`)
4. **Deploy** tugmasini bosing — birinchi deploy AI'siz ham ishga tushadi.
5. Deploy tugagach: loyiha sahifasida **Settings -> Environment variables -> Add secret**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: 1-qadamda olgan `sk-ant-...` kalit
   - **Save**, so'ng **Deployments -> ... -> Retry deployment** qilib qayta deploy qiling
   (environment variable faqat keyingi deploy'dan ishlay boshlaydi).

Shundan so'ng sayt `https://SIZNING-LOYIHA.pages.dev` manzilida ochiladi va istalgan
qurilmadan (PC, planshet, telefon) kirish mumkin bo'ladi. Xohlasangiz Cloudflare
Pages -> **Custom domains** orqali o'z domeningizni ham ulashingiz mumkin.

## 5) Birinchi kirish va xavfsizlik
- Standart login: `uzbe` / parol: `DevOps`
- **Birinchi kirishdan so'ng darhol** admin panel orqali bu parolni albatta o'zgartiring —
  hozircha kod ichida ochiq turibdi va uni hamma ko'rishi mumkin (agar GitHub repo public bo'lsa).
- Agar repo public bo'lishi kerak bo'lsa, `DEFAULT_ADMIN_PASS` qiymatini kodda ham
  o'zingiznikiga almashtiring (`index.html` faylida qidiring).

## Nima o'zgartirildi (avvalgi versiyaga nisbatan)
- **AI test generatsiyasi** endi brauzerdan to'g'ridan-to'g'ri emas, `/api/generate-quiz`
  (Cloudflare Pages Function, `functions/api/generate-quiz.js`) orqali ishlaydi — API key
  endi hech qachon brauzerga chiqmaydi va sayt Claude.ai tashqarisida ham ishlaydi.
- **Supabase kalitlar** boshqa (eski) akkauntga tegishli edi — endi placeholder qilib
  qo'yildi, o'zingiznikini kiritishingiz kerak (yuqoridagi 2-qadam).
- Dizayn allaqachon CSS Grid (`auto-fit`/`minmax`) asosida qurilgan bo'lib, PC, planshet
  va telefon o'lchamlariga avtomatik moslashadi — qo'shimcha o'zgartirish talab qilinmadi.
