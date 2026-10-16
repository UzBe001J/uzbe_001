// Cloudflare Worker (Static Assets rejimida)
// - "/api/generate-quiz" so'rovlarini o'zi qayta ishlaydi (Google Gemini API bilan gaplashadi)
// - Qolgan barcha so'rovlarni ASSETS orqali (public/ papkasidagi statik fayllar) qaytaradi

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate-quiz") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      if (request.method === "POST") {
        return handleGenerateQuiz(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/notify-register") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      if (request.method === "POST") {
        return handleNotifyRegister(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/telegram-webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    // Qolgan hamma narsa - statik sayt fayllari (index.html va boshqalar)
    return env.ASSETS.fetch(request);
  },
};

async function handleGenerateQuiz(request, env) {
  try {
    if (!env.GEMINI_API_KEY) {
      return json(
        { error: "GEMINI_API_KEY sozlanmagan. Cloudflare -> Settings -> Variables and Secrets bo'limida qo'shing." },
        500
      );
    }

    const body = await request.json();
    const { topic, sectionName, description, difficultyTag, difficultyInstr, count } = body;

    if (!topic || !count) {
      return json({ error: "topic va count majburiy." }, 400);
    }

    const safeCount = Math.max(1, Math.min(15, Number(count) || 8));
    const prompt = `Mavzu: "${topic}" (bo'lim: "${sectionName || "noma'lum"}"). Qisqacha tavsif: ${description || "yo'q"}.
Bu mavzu kurs dasturida ${difficultyTag || "O'rta"} darajaga to'g'ri keladi. ${difficultyInstr || ""}
Shu DevOps mavzusi bo'yicha aynan ${safeCount} ta ko'p tanlovli test savoli tuz (o'zbek tilida, amaliy va aniq).
Har bir savolda aynan 4 ta variant bo'lsin va faqat bitta to'g'ri javob bo'lsin.
FAQAT quyidagi JSON massiv formatida javob ber — hech qanday qo'shimcha matn, sarlavha yoki markdown belgisi qo'shma:
[{"q":"savol matni","options":["variant A","variant B","variant C","variant D"],"correct":0,"explain":"juda qisqa (10 so'zgacha) tushuntirish"}]
Har bir maydonni imkon qadar qisqa va lo'nda yoz.`;

    // Google modellarni tez-tez yopib/nomini o'zgartirib turadi, shu sabab
    // bir nechta model nomini ketma-ket sinab ko'ramiz - biri ishlamasa, keyingisiga o'tamiz.
    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-001"];
    let geminiRes = null;
    let lastErrText = "";

    for (const model of candidateModels) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        }
      );
      if (geminiRes.ok) break;
      lastErrText = await geminiRes.text();
      // Agar sabab "model topilmadi" bo'lsa - keyingi modelni sinaymiz.
      // Boshqa xato turlari (masalan limit tugagan) bo'lsa ham davom etamiz, chunki
      // boshqa model boshqa kvotaga ega bo'lishi mumkin.
    }

    if (!geminiRes.ok) {
      return json({ error: "Gemini API xatosi", detail: lastErrText }, geminiRes.status);
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let arr;
    try {
      arr = JSON.parse(clean);
    } catch (e) {
      return json({ error: "Model javobini o'qib bo'lmadi", detail: text.slice(0, 300) }, 502);
    }

    if (!Array.isArray(arr)) {
      return json({ error: "Noto'g'ri format" }, 502);
    }

    const questions = arr.filter(
      (q) => q && q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === "number"
    );

    return json({ questions }, 200);
  } catch (e) {
    return json({ error: "Server xatosi", detail: String(e) }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ================= TELEGRAM: ariza xabari va tasdiqlash =================
// Kerakli secret'lar: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
// (Supabase sozlamalari index.html dagi bilan bir xil; xohlasangiz SUPABASE_URL / SUPABASE_KEY env bilan almashtiring.)
const SB_URL_DEFAULT = "https://jgckbrjwhoxuauyvqyta.supabase.co";
const SB_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnY2ticmp3aG94dWF1eXZxeXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjUxNzMsImV4cCI6MjA5OTk0MTE3M30.rzhblWr8loMotkdw6oib49pkYW4oR7Seo72m24wlPOk";

function sbUrl(env) { return env.SUPABASE_URL || SB_URL_DEFAULT; }
function sbHeaders(env) {
  const k = env.SUPABASE_KEY || SB_KEY_DEFAULT;
  return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" };
}
async function kvGet(env, key) {
  const r = await fetch(`${sbUrl(env)}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbHeaders(env) });
  if (!r.ok) throw new Error("Supabase o'qish xatosi " + r.status);
  const a = await r.json();
  return a && a[0] ? a[0].value : null;
}
async function kvSet(env, key, value) {
  const r = await fetch(`${sbUrl(env)}/rest/v1/kv_store?on_conflict=key`, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error("Supabase yozish xatosi " + r.status);
}
async function tgCall(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Sayt ro'yxatdan o'tish paytida shuni chaqiradi -> adminga "Ruxsat berish / Rad etish" tugmali xabar boradi
async function handleNotifyRegister(request, env) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({ error: "TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan." }, 500);
    }
    const b = await request.json();
    const clean = (v, max) => String(v || "").replace(/[<>&]/g, "").trim().slice(0, max);
    const firstName = clean(b.firstName, 50);
    const lastName = clean(b.lastName, 50);
    const tg = clean(b.tg, 40);
    const username = clean(b.username, 40);

    if (!firstName || !lastName || !/^@[A-Za-z0-9_]{5,32}$/.test(tg) || !/^[A-Za-z0-9_.\-]{3,40}$/.test(username)) {
      return json({ error: "Ma'lumotlar noto'g'ri." }, 400);
    }

    const time = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
    const text =
      `🆕 <b>UzLearn: yangi ariza</b>\n\n` +
      `👤 Ism: <b>${firstName}</b>\n` +
      `👤 Familya: <b>${lastName}</b>\n` +
      `✈️ Telegram: ${tg}\n` +
      `🔑 Login: <code>${username}</code>\n` +
      `🕐 Vaqt: ${time}\n\n` +
      `Kirishga ruxsat berasizmi?`;

    const res = await tgCall(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Ruxsat berish", callback_data: `ap:${username}` },
          { text: "❌ Rad etish", callback_data: `rj:${username}` },
        ]],
      },
    });
    if (!res.ok) {
      return json({ error: "Telegram xatosi", detail: (await res.text()).slice(0, 200) }, 502);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: "Server xatosi", detail: String(e) }, 500);
  }
}

// Telegram tugma bosilganda shu yerga keladi (webhook)
async function handleTelegramWebhook(request, env) {
  try {
    if (env.TELEGRAM_WEBHOOK_SECRET &&
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const update = await request.json();
    const cq = update.callback_query;
    if (!cq) return new Response("ok");

    const chatId = cq.message && cq.message.chat && cq.message.chat.id;
    const allowed = String(chatId) === String(env.TELEGRAM_CHAT_ID) || String(cq.from && cq.from.id) === String(env.TELEGRAM_CHAT_ID);
    if (!allowed) {
      await tgCall(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Ruxsat yo'q", show_alert: true });
      return new Response("ok");
    }

    const [act, ...rest] = String(cq.data || "").split(":");
    const username = rest.join(":");
    if (!["ap", "rj"].includes(act) || !/^[A-Za-z0-9_.\-]{3,40}$/.test(username)) {
      await tgCall(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Noto'g'ri so'rov" });
      return new Response("ok");
    }

    // Foydalanuvchi mavjudmi va hali "kutmoqda" holatidami?
    let accounts = {};
    try { accounts = JSON.parse((await kvGet(env, "lms_accounts")) || "{}"); } catch (e) {}
    let status = null;
    try { const raw = await kvGet(env, "lms_status_" + username); if (raw) status = JSON.parse(raw).status; } catch (e) {}

    let resultLine;
    if (!accounts[username]) {
      resultLine = "⚠️ Bu foydalanuvchi topilmadi (o'chirilgan bo'lishi mumkin).";
    } else if (status && status !== "pending") {
      const names = { approved: "ruxsat berilgan", rejected: "rad etilgan", blocked: "bloklangan" };
      resultLine = `ℹ️ Bu ariza allaqachon ko'rib chiqilgan (${names[status] || status}).`;
    } else if (act === "ap") {
      await kvSet(env, "lms_status_" + username, JSON.stringify({ status: "approved", at: Date.now(), by: "telegram" }));
      // Foydalanuvchining qo'ng'iroqchasiga "Administrator nomidan" xabar qo'shamiz
      let notifs = [];
      try { notifs = JSON.parse((await kvGet(env, "lms_notif_" + username)) || "[]"); } catch (e) {}
      notifs.unshift({
        id: Date.now().toString(36),
        text: "Sizga ruxsat berildi. Endi platformadan to'liq foydalanishingiz mumkin.",
        from: "Administrator",
        at: Date.now(),
        read: false,
      });
      await kvSet(env, "lms_notif_" + username, JSON.stringify(notifs.slice(0, 50)));
      resultLine = "✅ Ruxsat berildi.";
    } else {
      await kvSet(env, "lms_status_" + username, JSON.stringify({ status: "rejected", at: Date.now(), by: "telegram" }));
      resultLine = "❌ Rad etildi.";
    }

    await tgCall(env, "answerCallbackQuery", { callback_query_id: cq.id, text: resultLine.slice(0, 190) });
    if (cq.message) {
      await tgCall(env, "editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: `${cq.message.text || ""}\n\n${resultLine}`,
        reply_markup: { inline_keyboard: [] },
      });
    }
    return new Response("ok");
  } catch (e) {
    return new Response("error: " + String(e), { status: 200 });
  }
}
