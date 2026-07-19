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
