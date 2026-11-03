# UzBe DevOps LMS

Sayt: https://uzbe001.uzbedevopsmap.workers.dev

## Repo tuzilmasi
```
public/index.html     <- sayt
src/worker.js         <- /api/generate-quiz, /api/check-sentences, /api/dialog, /api/ai-chat (Google Gemini)
wrangler.toml         <- Cloudflare sozlamasi
supabase-setup.sql    <- Supabase jadvali (bir marta ishga tushiriladi)
```

## Cloudflare sozlamalari
- Deploy command: `npx wrangler deploy`
- Settings -> Variables and Secrets (runtime):
  - `GEMINI_API_KEY` (Type: Secret) — https://aistudio.google.com/apikey dan bepul kalit

  - `TELEGRAM_BOT_TOKEN` (Secret) — Telegramda @BotFather orqali bot yarating va tokenni oling
  - `TELEGRAM_WEBHOOK_SECRET` (Secret) — o'zingiz o'ylab topgan uzun tasodifiy qator (faqat A-Z a-z 0-9 _ -)
  - `TELEGRAM_CHAT_ID` (Secret) — xabar keladigan chat ID (botga /start yozing, so'ng @userinfobot yoki
    `https://api.telegram.org/bot<TOKEN>/getUpdates` orqali o'z ID'ingizni toping)

## Eslatma
- Faol bo'lmagan foydalanuvchi 10 daqiqadan keyin avtomatik chiqariladi (`IDLE_LIMIT_MS`, index.html).
- Admin parolini (`uzbe` / `DevOps`) birinchi kirishda o'zgartiring.
- Google model nomlarini tez-tez o'zgartiradi: `src/worker.js` ichidagi `candidateModels` ro'yxatini kerak bo'lsa yangilang.

## Telegram webhook (bir marta, brauzerda)
Ariza xabaridagi "Ruxsat berish / Rad etish" tugmalari ishlashi uchun:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://uzbe001.uzbedevopsmap.workers.dev/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
Javobda `"ok":true` chiqishi kerak. Tekshirish: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

## Ruxsat tizimi
- Ro'yxatdan o'tgan foydalanuvchi `pending` holatda bo'ladi va administrator ruxsat bermaguncha kira olmaydi.
- Administrator Telegramdagi tugma yoki saytdagi Administrator -> "Yangi arizalar" orqali ruxsat beradi.
- Ruxsat berilganda foydalanuvchining qo'ng'iroqchasiga "Administrator nomidan" xabar tushadi.
- Eski hisoblar (status yozuvi yo'q) avtomatik tasdiqlangan hisoblanadi.

## Rus tili lug'at kursi (4 ta lug'at)
Ma'lumotlar `public/data/` ichida, format: `[["ruscha","o'zbekcha"], ...]`
- `rus-verbs.json` — fe'llar (1000)
- `rus-nouns.json` — otlar (995)
- `rus-adjectives.json` — sifatlar (999)
- `rus-words.json` — aralash, eng ko'p ishlatiladigan (1000)

Yangi lug'at qo'shish: JSON faylni `public/data/` ga qo'ying va `index.html` ichidagi `RUS_DICTS` ro'yxatiga element qo'shing (`count` = so'zlar soni).
Har bir bo'lim 40 so'z, har birida 3 ta mashq (so'z yodlash, ruscha→o'zbekcha, o'zbekcha→ruscha) + 4-mashq o'rni.

## 6- va 7-mashq (fe'l, ot, sifat lug'atlari)
Ikkalasi ham bo'limdagi 40 ta so'zdan tuziladi, savollar Oson → O'rta → Qiyin tartibida beriladi. "Aralash" lug'atda hozircha yo'q.
- **6-mashq** — fe'l: hozirgi/o'tgan/kelasi zamon va vid (совершенный/несовершенный); ot: 6 kelishik; sifat: qiyosiy, orttirma daraja va otga moslashuv.
- **7-mashq** — gapni to'ldirish (`Вчера она ___ . (читать)`). Bir nechta to'g'ri javob bo'lsa hammasi qabul qilinadi; xato bo'lsa to'g'ri javob va sabab ko'rsatiladi.
- Lug'at fayllarida kelishik/o'tgan zamon/qiyosiy shakllar yo'q, shuning uchun `rusNounDecl`, `rusAdjForms`, `rusPast`, `RUS_COMP` (index.html) qoidalar bilan hosil qiladi. Qoida ishonchli ishlamaydigan so'zlar (день, конец, мать, идти...) shu mashqlardan chiqarib tashlanadi.

## 8- va 9-mashq (AI bilan; GEMINI_API_KEY kerak)
Ikkalasi ham bo'limdagi 40 ta so'zga bog'langan. Server endpointlari: `/api/check-sentences`, `/api/dialog` (`src/worker.js`).
- **8-mashq — Составь предложение** (fe'l, ot, sifat lug'atlari; har biri uchun alohida topshiriq). Bo'limdan tasodifiy 5 ta so'z beriladi (`RUS_S8_COUNT`), har biri bilan 3–5 ta gap yoziladi. AI grammatikani va so'z ishlatilishini tekshiradi, xatolarni alohida ko'rsatadi, to'g'ri variant beradi; gaplarni tuzatib qayta tekshirish mumkin.
- **9-mashq — Диалог** (4 ta lug'atning hammasida). 8 ta mavzu, A1–B2 darajalar. AI birinchi savolni beradi, har javobga mos davom etadi va xatolarni izohlaydi. 6 ta javobdan keyin (yoki 3 tadan keyin «Suhbatni tugatish») natija, daraja bahosi va tavsiyalar chiqadi. Bo'lim so'zlari AI'ga lug'at sifatida beriladi.
- Mashq 9-bosqichda kamida 3 ta javob berilganda «bajarilgan» hisoblanadi.
- Model nomlari `GEMINI_MODELS` ro'yxatida (worker.js).

## 10-mashq — AI bilan muloqot (Общение с AI; GEMINI_API_KEY kerak)
Barcha 4 lug'atda. Erkin yozma suhbat: AI rus tili o'qituvchisi sifatida **bitta** savol beradi, javobni tekshiradi, xatoni o'zbekcha tushuntiradi va suhbatni davom ettiradi. Endpoint: `/api/ai-chat` (`src/worker.js`, action: `start | reply | recheck | final`).
- **Daraja va mavzu**: A1–B2 (boshlang'ich daraja oldingi suhbat bahosidan tanlanadi). Har javobdan keyin AI keyingi savolni o'quvchining natijasiga qarab osonlashtiradi yoki qiyinlashtiradi (har safar ko'pi bilan 1 pog'ona).
- **Tekshirish formati**: «Sizning javobingiz tushunarli» → *Grammatik xato* → *To'g'ri variant* → *Izoh* (o'zbekcha). Grammatik to'g'ri, lekin boshqacha aytilgan javoblar qabul qilinadi. Kichik xatolar (bosh harf, nuqta) ham tushuntiriladi, lekin xato hisoblanmaydi.
- **Qayta javob berish**: xatoli javob ostida «Javobni qayta yozish» (2 tagacha urinish). Yangi savol berilmaydi, faqat shu javob qayta tekshiriladi.
- **Xotira** (foydalanuvchiga bog'langan, Supabase `kv_store`, kalit `lms_aichat_<login>`): oxirgi 8 suhbat, xatolar banki (zaif mavzular keyingi suhbatda AI'ga beriladi), takrorlanmasligi uchun oldingi savollar, tugallanmagan suhbatni davom ettirish. Yangi SQL kerak emas.
- **Loading**: AI yozayotganda animatsiyali ko'rsatkich, tugmalar o'chiriladi.
- **Xarajat nazorati**: API kaliti faqat serverda; so'rovga oxirgi 16 xabar va 20 ta oldingi savol yuboriladi; javob uzunligi cheklangan; suhbat 10 ta javobgacha; kunlik limit foydalanuvchi bo'yicha (standart 150 so'rov, Cloudflare'da `AI_DAILY_LIMIT` o'zgaruvchisi bilan o'zgartiriladi, `lms_aiuse_<login>` kalitida hisoblanadi); ekranda so'rovlar soni va tokenlar ko'rsatiladi. Limit login bo'yicha — bu qattiq himoya emas, xarajatni cheklash uchun.
- **Yakuniy hisobot**: davomiylik, savollar soni, to'g'ri javoblar (birinchi urinishda), grammatik xatolar, qayta yozib tuzatilganlar, yangi so'zlar, kuchli tomonlar, yaxshilash kerak mavzular, tavsiyalar va keyingi mashq uchun maslahatlar. Kamida 4 ta javobdan keyin mashq «bajarilgan» hisoblanadi.
- Ovozli suhbat yo'q (hozircha faqat yozma chat).
