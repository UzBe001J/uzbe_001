// Cloudflare Pages Function
// URL: /api/generate-quiz
// Bu fayl brauzerdan kelgan so'rovni qabul qilib, Anthropic API'ga
// SIZNING serverdagi maxfiy kalitingiz (ANTHROPIC_API_KEY) bilan murojaat qiladi.
// Kalit hech qachon brauzerga (frontendga) chiqmaydi.
//
// ANTHROPIC_API_KEY ni Cloudflare Pages loyihasi sozlamalarida
// "Settings -> Environment variables -> Add secret" orqali qo'shing.

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY sozlanmagan. Cloudflare Pages -> Settings -> Environment variables bo'limida qo'shing." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await request.json();
    const { topic, sectionName, description, difficultyTag, difficultyInstr, count } = body;

    if (!topic || !count) {
      return new Response(JSON.stringify({ error: "topic va count majburiy." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const safeCount = Math.max(1, Math.min(15, Number(count) || 8));
    const prompt = `Mavzu: "${topic}" (bo'lim: "${sectionName || "noma'lum"}"). Qisqacha tavsif: ${description || "yo'q"}.
Bu mavzu kurs dasturida ${difficultyTag || "O'rta"} darajaga to'g'ri keladi. ${difficultyInstr || ""}
Shu DevOps mavzusi bo'yicha aynan ${safeCount} ta ko'p tanlovli test savoli tuz (o'zbek tilida, amaliy va aniq).
Har bir savolda aynan 4 ta variant bo'lsin va faqat bitta to'g'ri javob bo'lsin.
FAQAT quyidagi JSON massiv formatida javob ber — hech qanday qo'shimcha matn, sarlavha yoki markdown belgisi ("\`\`\`") qo'shma:
[{"q":"savol matni","options":["variant A","variant B","variant C","variant D"],"correct":0,"explain":"juda qisqa (10 so'zgacha) tushuntirish"}]
Har bir maydonni imkon qadar qisqa va lo'nda yoz.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: "Anthropic API xatosi", detail: errText }), {
        status: anthropicRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let arr;
    try {
      arr = JSON.parse(clean);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Model javobini o'qib bo'lmadi" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!Array.isArray(arr)) {
      return new Response(JSON.stringify({ error: "Noto'g'ri format" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const questions = arr.filter(
      (q) => q && q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === "number"
    );

    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server xatosi", detail: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
