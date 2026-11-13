// 민원 문구 AI 새로 쓰기 (Supabase Edge Function)
// 승인 회원만, 한 사람당 하루 PETITION_AI_DAILY(기본 20)번까지. 사실(숫자 · 요구사항)은 바꾸지 않고 표현만 새로 씁니다.
//
// 환경 변수 (Supabase 대시보드 → Edge Functions → Secrets)
//   GEMINI_API_KEY    : Google AI Studio 키 (무료 등급으로 사용 가능 · 있으면 이것을 먼저 씀)
//   ANTHROPIC_API_KEY : Claude API 키 (유료 · Gemini 키가 없을 때)
//   둘 다 없으면 501을 돌려주고, 화면은 조합 문장으로 대신함
//   PETITION_AI_MODEL : 선택 · 기본 Gemini는 gemini-flash-latest, Claude는 claude-haiku-5-5
//   PETITION_AI_DAILY : 선택 · 1인 하루 횟수 (기본 20)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY : 자동

const FACTS = [
  "고양은평선(광역철도) 가칭 '도래울역(G04)' 출입구 위치가 설계 중이며 12월 말 최종 확정 예정",
  "창릉 S-3블록 1,282세대 + S-4블록 1,024세대 = 총 2,306세대(약 8,000명)",
  "고양은평선은 창릉지구 입주예정자가 분양가에 포함해 낸 광역교통시설부담금으로 건설됨(수익자 부담 원칙)",
  "요청: S-4·S-3 및 전면 상업지구 앞 출입구를 원안대로 유지하고, 교차로 사방에 출입구를 4개소 이상 증설해 인근 기입주 단지와 상생",
  "근거: 통근·통학 보행 안전(대로 이중 횡단 위험), 전면 상업지구 상권 보호, 부담금 형평성",
];
const KINDS = {
  sns1: { name: "페이스북 · 인스타 · 유튜브 댓글", rule: "2~3문장, 220~320자. 마지막은 정중한 요청으로 끝냄." },
  sns2: { name: "스레드 · X 짧은 댓글", rule: "맨 앞에 [대괄호 머리말]을 붙이고 2문장, 140~220자." },
  sns3: { name: "의원에게 보내는 DM · 문자", rule: "인사로 시작해 3~4문장, 230~340자. 존댓말." },
  board: { name: "경기도의회 · 고양시의회 · 국민신문고 · 이메일용 정식 민원 본문", rule: "인사와 자기소개 단락, 번호를 붙인 근거 4단락(각 단락 첫 줄은 소제목), [건의 요지] 2개 항목, 감사 인사. 1,200~1,800자. 단락 사이는 빈 줄." },
  title: { name: "민원 게시판 · 이메일 제목", rule: "한 줄, 45~80자. 필요하면 [대괄호 머리말]." },
};
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

export function buildPrompt(kind, persona, base, tone) {
  const k = KINDS[kind];
  const system = "당신은 아파트 입주예정자가 지방의회 · 관계기관에 보내는 정중한 정책 건의 문구를 다듬는 도우미입니다.\n" +
    "아래 사실만 사용하세요. 숫자 · 단지명 · 요구사항을 바꾸거나 새 사실을 지어내지 마세요.\n" + FACTS.map((f) => "- " + f).join("\n") +
    "\n규칙: 특정인 · 특정 단지 · 정당을 비방하거나 언급하지 않습니다. 과장 · 허위 · 협박성 표현, 이모지, 해시태그를 쓰지 않습니다. 한국어 존댓말로 씁니다. 결과 문장만 출력하고 설명이나 따옴표를 붙이지 않습니다.";
  const user = "용도: " + k.name + "\n형식: " + k.rule +
    (persona ? "\n작성자 상황(자연스럽게 한 번만 반영): " + String(persona).slice(0, 120) : "") +
    (tone ? "\n말투: " + String(tone).slice(0, 40) : "") +
    (base ? "\n참고 문장(이것과 표현 · 문장 구조가 확실히 다르게 새로 쓰기):\n" + String(base).slice(0, 2500) : "") +
    "\n새 버전 하나를 써 주세요.";
  return { system, user, max_tokens: kind === "board" ? 1600 : 500 };
}

// Google Gemini (AI Studio 무료 등급 가능)
// 모델 이름은 Google이 자주 바꾸고, 새 키에는 예전 모델(2.5 등)을 막기도 함 → 이 키로 쓸 수 있는 모델 목록을 물어서 고름
export const GEMINI_FALLBACK = ["gemini-flash-lite-latest", "gemini-flash-latest"];
let MODEL_CACHE = null, MODEL_AT = 0;
export function rankModels(names) {
  const ok = names.filter((n) => /flash/.test(n) && !/image|tts|audio|live|embed|vision|thinking-exp|computer|robotics/.test(n));
  // 새 버전 우선(버전 × 10), 같은 버전이면 빠른 lite, 정식 > preview. latest 별칭은 버전을 모르니 중간쯤
  const ver = (n) => /latest/.test(n) ? 2.5 : Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1]) || 0;
  const score = (n) => (/lite/.test(n) ? 0 : 3) + (/preview|exp/.test(n) ? 4 : 0) - ver(n) * 10;
  return ok.sort((x, y) => score(x) - score(y));
}
export function resetModelCache() { MODEL_CACHE = null; }
async function geminiModels(env, fetcher) {
  if (MODEL_CACHE && Date.now() - MODEL_AT < 6 * 3600e3) return MODEL_CACHE;
  let names = [];
  try {
    const r = await fetcher("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (r.ok) names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
    else console.error("gemini list", r.status, (await r.text()).slice(0, 160));
  } catch (e) { console.error("gemini list", String(e)); }
  const ranked = rankModels(names);
  MODEL_CACHE = [...new Set([env.PETITION_AI_MODEL, ...ranked, ...GEMINI_FALLBACK].filter(Boolean))]; MODEL_AT = Date.now();
  return MODEL_CACHE;
}
// 생각(thinking)을 줄여 빨리 답하게. Gemini 3 계열은 thinkingLevel, 2.x는 thinkingBudget
function thinking(model) { return /gemini-[3-9]/.test(model) || /latest/.test(model) ? { thinkingLevel: "low" } : { thinkingBudget: 0 }; }
async function gemini(p, env, fetcher) {
  const list = await geminiModels(env, fetcher), t0 = Date.now(), DEAD = Number(env.AI_DEADLINE_MS) || 75000;
  let last = "";
  for (const model of list.slice(0, 5)) {
    if (Date.now() - t0 > DEAD) break;
    for (const useThink of [true, false]) {
      const cfg = { temperature: 1, maxOutputTokens: 4096 }; if (useThink) cfg.thinkingConfig = thinking(model);
      let r;
      try {
        r = await fetcher("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
          method: "POST", signal: AbortSignal.timeout(Math.max(200, Math.min(Number(env.AI_CALL_MS) || 30000, DEAD - (Date.now() - t0)))),
          headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: p.system }] }, contents: [{ role: "user", parts: [{ text: p.user }] }], generationConfig: cfg }),
        });
      } catch (e) { last = model + " 시간 초과"; console.error("gemini", model, String(e)); break; }   // 느린 모델은 건너뜀
      const raw = await r.text();
      if (!r.ok) {
        last = "HTTP " + r.status + " " + raw.slice(0, 160);
        console.error("gemini", model, last);
        if (r.status === 400 && useThink && /think/i.test(raw)) continue;           // 생각 설정을 모르는 모델 → 설정 없이 다시
        if (r.status === 404 || r.status === 429 || r.status >= 500) break;         // 다음 모델로
        throw new Error(last);                                                      // 키 오류 등은 바로 알림
      }
      let out = {}; try { out = JSON.parse(raw); } catch { /* */ }
      const c = (out.candidates || [])[0] || {};
      const text = ((c.content || {}).parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join("");
      if (text.trim()) return text;
      last = "빈 응답 (" + (c.finishReason || (out.promptFeedback || {}).blockReason || "이유 없음") + ")";
      console.error("gemini", model, last);
      break;
    }
  }
  if (/404/.test(last)) resetModelCache();
  throw new Error(last || "Gemini 응답 없음");
}
// Anthropic Claude (유료)
async function claude(p, env, fetcher) {
  const r = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: AbortSignal.timeout(45000),
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.PETITION_AI_MODEL || "claude-haiku-5-5", max_tokens: p.max_tokens, temperature: 1, system: p.system, messages: [{ role: "user", content: p.user }] }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const out = await r.json();
  return (out.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
}

export async function handle(req, env, fetcher = fetch) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST만 받습니다" }, 405);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "로그인이 필요합니다" }, 401);
  // 승인 회원 확인 + 내 아이디
  const who = await fetcher(env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } });
  if (!who.ok) return json({ error: "로그인이 만료되었습니다" }, 401);
  const uid = (await who.json()).id;
  const mem = await fetcher(env.SUPABASE_URL + "/rest/v1/rpc/is_member", { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, "content-type": "application/json" }, body: "{}" });
  if (!mem.ok || (await mem.json()) !== true) return json({ error: "승인 회원만 쓸 수 있습니다" }, 403);
  let body = {}; try { body = await req.json(); } catch { /* */ }
  const kind = String(body.kind || "");
  if (!KINDS[kind]) return json({ error: "알 수 없는 문구 종류" }, 400);
  if (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) return json({ error: "AI 키가 아직 설정되지 않았습니다" }, 501);
  // 하루 횟수 제한
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const since = new Date(Date.now() - 864e5).toISOString(), LIMIT = Number(env.PETITION_AI_DAILY) || 20;
  const cnt = await fetcher(env.SUPABASE_URL + "/rest/v1/petition_ai_log?select=id&user_id=eq." + uid + "&at=gte." + encodeURIComponent(since), { headers: { ...H, prefer: "count=exact", range: "0-0" } });
  const used = Number((cnt.headers.get("content-range") || "*/0").split("/")[1]) || 0;
  if (used >= LIMIT) return json({ error: "오늘은 AI 새로 쓰기를 " + LIMIT + "번 모두 썼습니다" }, 429);
  const p = buildPrompt(kind, body.persona, body.base, body.tone);
  let text = "";
  try { text = await (env.GEMINI_API_KEY ? gemini : claude)(p, env, fetcher); }
  catch (e) {
    const m = String(e.message || e);
    console.error("[petition-ai] fail", m);
    return json({ error: /429|RESOURCE_EXHAUSTED/.test(m) ? "무료 AI 사용량이 잠시 찼습니다. 1~2분 뒤 다시 눌러 주세요"
      : /API_KEY_INVALID|API key not valid/i.test(m) ? "AI 키가 올바르지 않습니다. 운영진에게 알려 주세요 (GEMINI_API_KEY 확인)"
      : /location is not supported/i.test(m) ? "이 서버 위치에서는 Gemini 무료 API를 쓸 수 없습니다"
      : /시간 초과/.test(m) ? "AI가 너무 오래 걸려 멈췄습니다. 잠시 뒤 다시 눌러 주세요"
      : "AI 응답 오류 (" + m.slice(0, 90) + ")" }, 502);
  }
  text = text.trim().replace(/^["“]|["”]$/g, "");
  if (!text) return json({ error: "AI가 빈 응답을 보냈습니다" }, 502);
  await fetcher(env.SUPABASE_URL + "/rest/v1/petition_ai_log", { method: "POST", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ user_id: uid, kind }) }).catch(() => {});
  return json({ text: text.slice(0, 4000), left: Math.max(LIMIT - used - 1, 0) });
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve((req) => handle(req, {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"), SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY"), ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY"), PETITION_AI_MODEL: Deno.env.get("PETITION_AI_MODEL"), PETITION_AI_DAILY: Deno.env.get("PETITION_AI_DAILY"),
  }));
}
