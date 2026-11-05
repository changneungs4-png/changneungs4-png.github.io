// 창릉 S-4 소식 자동 수집 (Supabase Edge Function)
// 매일 pg_cron이 호출하거나, 운영진이 운영진 페이지에서 "지금 수집"을 눌러 호출합니다.
// 가져오는 것: 제목 · 출처 · 날짜 · 링크만. 기사 본문은 저장하지 않습니다(저작권).
//
// 환경 변수 (Supabase 대시보드 → Edge Functions → Secrets)
//   CRON_SECRET  : pg_cron 호출 확인용 임의 문자열
//   LH_API_KEY   : 공공데이터포털 '한국토지주택공사_분양임대공고문 조회 서비스' 인증키 (없으면 LH는 건너뜀)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY : Supabase가 자동으로 넣어줌

const NEWS_QUERIES = [
  { topic: "S-4", q: '고양창릉 "S-4"' },
  { topic: "S-4", q: '창릉 S4블록' },
  { topic: "창릉", q: '창릉신도시' }
];
const S4_RE = /S\s*[-‐–—]?\s*4(?![0-9])/i;
const BLOCK_OTHER = /(S\s*-?\s*[1-35-9]|A\s*-?\s*\d)\s*블록/i;

export function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? decode(m[1]) : "";
}

// 구글 뉴스 RSS → 기사 목록
export function parseRss(xml, topic) {
  const out = [];
  const items = String(xml || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    let title = tag(it, "title"), source = tag(it, "source"), link = tag(it, "link");
    const pub = tag(it, "pubDate");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    if (!/창릉/.test(title)) continue;                                   // 창릉 관련만
    const isS4 = S4_RE.test(title);
    if (topic === "S-4" && !isS4) continue;                               // S-4 검색어는 제목에 S-4가 있어야
    if (topic === "창릉" && BLOCK_OTHER.test(title) && !isS4) continue;   // 다른 블록 단독 기사 제외
    const d = pub ? new Date(pub) : null;
    out.push({ kind: "news", topic: isS4 ? "S-4" : "창릉", title: title.slice(0, 300), url: link, source: source.slice(0, 60), published_at: d && !isNaN(+d) ? d.toISOString() : null, extra: {} });
  }
  return out;
}

// LH 분양임대공고문 API 응답 → 공고 목록 (응답이 중첩 배열이라 PAN_NM이 있는 객체를 모두 찾음)
export function parseLh(json) {
  const rows = [];
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") { if (v.PAN_NM && v.DTL_URL) rows.push(v); else Object.values(v).forEach(walk); }
  })(json);
  const out = [];
  for (const r of rows) {
    const title = decode(r.PAN_NM), url = String(r.DTL_URL || "").trim();
    if (!/창릉/.test(title) || !/^https?:\/\//.test(url)) continue;
    const ds = String(r.PAN_NT_ST_DT || r.PAN_DT || "").replace(/[^0-9]/g, "");
    const pub = ds.length >= 8 ? new Date(ds.slice(0, 4) + "-" + ds.slice(4, 6) + "-" + ds.slice(6, 8) + "T09:00:00+09:00") : null;
    out.push({
      kind: "lh", topic: decode(r.AIS_TP_CD_NM || r.UPP_AIS_TP_NM || "LH 공고").slice(0, 40), title: title.slice(0, 300), url,
      source: "LH 청약플러스", published_at: pub && !isNaN(+pub) ? pub.toISOString() : null,
      extra: { status: decode(r.PAN_SS), closes: decode(r.CLSG_DT), region: decode(r.CNP_CD_NM), s4: S4_RE.test(title),
        ids: { PAN_ID: r.PAN_ID, SPL_INF_TP_CD: r.SPL_INF_TP_CD, CCR_CNNT_SYS_DS_CD: r.CCR_CNNT_SYS_DS_CD, UPP_AIS_TP_CD: r.UPP_AIS_TP_CD, AIS_TP_CD: r.AIS_TP_CD } }
    });
  }
  return out;
}

// ── LH 상세 · 공급정보 → 표 ──────────────────────────────
// 응답은 dsXxx(행 배열)와 dsXxxNm(열 이름표)을 함께 줍니다. 필드 코드를 미리 알지 않아도
// 이름표로 표를 만들기 때문에, LH가 필드를 바꿔도 깨지지 않습니다.
const DS_TITLES = { dsSbd: "단지 정보", dsSplScdl: "공급 일정", dsList01: "주택형별 공급", dsList02: "주택형별 공급", dsCtrtPlc: "계약 장소", dsAhflInfo: "첨부파일" };
const FIELD_LABELS = { HSH_CNT: "전체 세대수", NOW_HSH_CNT: "금회 공급 세대수", HTY_NNA: "주택형", DDO_AR: "전용면적", SBD_NM: "단지명" };
const SKIP_FIELD = /^(RNUM|ALL_CNT|SS_CODE|RS_DTTM|PAN_ID|CCR_CNNT_SYS_DS_CD|SPL_INF_TP_CD|UPP_AIS_TP_CD|AIS_TP_CD)$|_(CD|ID|SN|SEQ)$/;
const clip = (v, n) => { const t = decode(v); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

export function tablesFrom(json) {
  const tables = [], attachments = [];
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    for (const k of Object.keys(v)) {
      const rows = v[k];
      if (!/^ds/.test(k) || /Nm$/.test(k) || k === "dsSch" || !Array.isArray(rows)) continue;
      const objs = rows.filter((r) => r && typeof r === "object");
      if (!objs.length) continue;
      const names = (Array.isArray(v[k + "Nm"]) && v[k + "Nm"][0]) || {};
      if (k === "dsAhflInfo") {
        for (const r of objs.slice(0, 30)) {
          const vals = Object.entries(r).map(([f, x]) => [f, String(x == null ? "" : x).trim()]);
          const url = (vals.find(([, x]) => /^https?:\/\//i.test(x)) || [])[1];
          const name = (vals.find(([f, x]) => x && !/^https?:/i.test(x) && /파일명|명$/.test(names[f] || "") && !/구분/.test(names[f] || "")) ||
                        vals.find(([f, x]) => x && !/^https?:/i.test(x) && !SKIP_FIELD.test(f)) || [])[1];
          const kind = (vals.find(([f, x]) => x && /구분/.test(names[f] || "")) || [])[1];
          if (url) attachments.push({ name: clip(name || "첨부파일", 120), kind: clip(kind || "", 40), url });
        }
        continue;
      }
      const cols = [];
      for (const r of objs) for (const f of Object.keys(r)) if (!SKIP_FIELD.test(f) && !cols.includes(f) && objs.some((o) => String(o[f] ?? "").trim())) cols.push(f);
      if (!cols.length) continue;
      const use = cols.slice(0, 10);
      tables.push({
        key: k, title: DS_TITLES[k] || k,
        columns: use.map((f) => ({ k: f, label: clip(names[f] || FIELD_LABELS[f] || f, 30) })),
        rows: objs.slice(0, 60).map((r) => use.map((f) => clip(r[f] ?? "", 200)))
      });
    }
    Object.values(v).forEach((x) => { if (Array.isArray(x)) x.forEach((y) => { if (y && typeof y === "object" && !Array.isArray(y)) for (const z of Object.values(y)) if (Array.isArray(z) || (z && typeof z === "object")) walk(z); }); });
  })(json);
  // 같은 표가 두 번 잡히지 않게
  const seen = new Set();
  return { tables: tables.filter((t) => { const sig = t.key + JSON.stringify(t.rows[0]); return !seen.has(sig) && seen.add(sig); }), attachments };
}

function ymd(d) { return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0"); }

export async function collect(env, fetcher = fetch) {
  const items = [], errors = [];
  for (const { topic, q } of NEWS_QUERIES) {
    try {
      const u = "https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q=" + encodeURIComponent(q + " when:30d");
      const r = await fetcher(u, { headers: { "user-agent": "changneung-s4-news-bot" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      items.push(...parseRss(await r.text(), topic));
    } catch (e) { errors.push("뉴스(" + q + "): " + e.message); }
  }
  if (env.LH_API_KEY) {
    try {
      const now = new Date(), from = new Date(now.getTime() - 365 * 864e5), to = now;
      const u = "https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=" + encodeURIComponent(env.LH_API_KEY) +
        "&PG_SZ=100&PAGE=1&PAN_NM=" + encodeURIComponent("창릉") + "&PAN_ST_DT=" + ymd(from) + "&PAN_ED_DT=" + ymd(to);
      const r = await fetcher(u);
      const body = await r.text();
      if (!r.ok) throw new Error("HTTP " + r.status + " " + body.slice(0, 200));
      let json; try { json = JSON.parse(body); } catch { throw new Error("JSON 아님: " + body.slice(0, 200)); }
      const got = parseLh(json);
      if (!got.length) errors.push("LH: 창릉 공고 0건 — 응답 " + body.slice(0, 200));
      items.push(...got);
    } catch (e) { errors.push("LH: " + e.message); }
  } else errors.push("LH: LH_API_KEY가 설정되지 않아 건너뜀");
  // 같은 링크 중복 제거
  const seen = new Set(), uniq = items.filter((x) => !seen.has(x.url) && seen.add(x.url));

  // LH 공고: 상세(일정 · 단지 · 첨부) + 공급정보(주택형별 세대수) 붙이기. 매번 최신 내용으로 갱신
  let detailed = 0;
  const lhItems = uniq.filter((x) => x.kind === "lh").slice(0, 20);
  for (const it of lhItems) {
    const ids = it.extra.ids || {};
    if (!ids.PAN_ID || !ids.SPL_INF_TP_CD || !ids.CCR_CNNT_SYS_DS_CD || !ids.UPP_AIS_TP_CD) continue;
    const qs = "serviceKey=" + encodeURIComponent(env.LH_API_KEY) + "&PAN_ID=" + encodeURIComponent(ids.PAN_ID) + "&SPL_INF_TP_CD=" + encodeURIComponent(ids.SPL_INF_TP_CD) +
      "&CCR_CNNT_SYS_DS_CD=" + encodeURIComponent(ids.CCR_CNNT_SYS_DS_CD) + "&UPP_AIS_TP_CD=" + encodeURIComponent(ids.UPP_AIS_TP_CD) + (ids.AIS_TP_CD ? "&AIS_TP_CD=" + encodeURIComponent(ids.AIS_TP_CD) : "");
    const tables = [], attachments = [];
    for (const [name, path] of [["상세", "lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1"], ["공급정보", "lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1"]]) {
      try {
        const r = await fetcher("https://apis.data.go.kr/B552555/" + path + "?" + qs);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const t = tablesFrom(await r.json());
        tables.push(...t.tables); attachments.push(...t.attachments);
      } catch (e) { errors.push("LH " + name + "(" + it.title.slice(0, 20) + "): " + e.message); }
    }
    if (tables.length || attachments.length) { it.extra.tables = tables; it.extra.attachments = attachments; it.extra.detail_at = new Date().toISOString(); detailed++; }
  }

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  let inserted = 0;
  const news = uniq.filter((x) => x.kind === "news"), lh = uniq.filter((x) => x.kind === "lh");
  if (news.length) {   // 기사: 이미 있으면 그대로 둠
    const r = await fetcher(env.SUPABASE_URL + "/rest/v1/news_items?on_conflict=url", { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(news) });
    if (!r.ok) errors.push("저장(기사): HTTP " + r.status + " " + (await r.text()).slice(0, 200)); else inserted += (await r.json()).length;
  }
  if (lh.length) {     // LH 공고: 상태 · 마감 · 일정이 바뀌므로 갱신 (숨김 여부는 건드리지 않음)
    const before = await fetcher(env.SUPABASE_URL + "/rest/v1/news_items?select=url&kind=eq.lh", { headers: H });
    const had = new Set(before.ok ? (await before.json()).map((x) => x.url) : []);
    const r = await fetcher(env.SUPABASE_URL + "/rest/v1/news_items?on_conflict=url", { method: "POST", headers: { ...H, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(lh) });
    if (!r.ok) errors.push("저장(LH): HTTP " + r.status + " " + (await r.text()).slice(0, 200)); else inserted += lh.filter((x) => !had.has(x.url)).length;
  }
  return { found: uniq.length, inserted, detailed, errors };
}

// 호출 권한: pg_cron(비밀 헤더) 또는 로그인한 운영진
async function authorized(req, env, fetcher = fetch) {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    if (env.CRON_SECRET) return cron === env.CRON_SECRET;
    // 비밀값을 사람이 다루지 않도록 DB(vault)에 만들어 둔 값과 비교합니다.
    const c = await fetcher(env.SUPABASE_URL + "/rest/v1/rpc/check_cron_secret", { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ s: cron }) });
    return c.ok && (await c.json()) === true;
  }
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetcher(env.SUPABASE_URL + "/rest/v1/rpc/is_admin", { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, "content-type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-cron-secret" };
export async function handle(req, env, fetcher = fetch) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await authorized(req, env, fetcher))) return new Response(JSON.stringify({ error: "권한이 없습니다" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });
  const res = await collect(env, fetcher);
  return new Response(JSON.stringify(res), { headers: { ...CORS, "content-type": "application/json" } });
}

// Deno(Supabase Edge Runtime)에서만 서버 시작
if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve((req) => handle(req, {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"), SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"), CRON_SECRET: Deno.env.get("CRON_SECRET"), LH_API_KEY: Deno.env.get("LH_API_KEY")
  }));
}
