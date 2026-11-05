// LH 공고문(PDF)을 읽어 일정 · 주요 정보를 뽑아 사이트에 올립니다.
// GitHub Actions에서 매일 실행 (.github/workflows/read-notices.yml)
// 필요: Node 20+, pdftotext(poppler-utils)
// 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const PARSER_VERSION = 1;

// 일정 이름표: 줄에 이 말이 있으면 그 일정으로 봅니다 (위에 있을수록 우선)
const LABELS = [
  [/선택\s*품목|유상\s*옵션|추가\s*선택|옵션\s*(선택|신청|계약)/, "유상옵션(선택품목) 선택"],
  [/계약\s*체결|정\s*당\s*계\s*약|계\s*약\s*일|계약\s*기간/, "계약 체결"],
  [/서류\s*(제출|접수)|자격\s*검증/, "당첨자 서류 제출"],
  [/당첨자\s*(발표|선정)/, "당첨자 발표"],
  [/동\s*[·.]?\s*호\s*(배정|추첨|공개)/, "동호 배정"],
  [/사전\s*점검/, "사전점검"],
  [/입주\s*지정\s*기간|입주\s*개시/, "입주지정기간"],
  [/입주\s*예정/, "입주 예정"],
  [/중도금/, "중도금"],
  [/잔\s*금/, "잔금"],
  [/주택\s*전시관|견본\s*주택|모델\s*하우스/, "주택전시관 관람"],
  [/특별\s*공급/, "특별공급 접수"],
  [/일반\s*공급|1\s*순위|2\s*순위/, "일반공급 접수"]
];
// 일정이 아닌 날짜 (자격 기준일 등)는 무시
const NOT_EVENT = /기준일|현재|이전|이후\s*출생|생년월일|무주택|소득|자산|거주\s*기간|이상\s*거주|만\s*\d+세|입주자\s*모집\s*공고일/;
const FACTS = [
  [/전매\s*제한/, "전매제한"], [/거주\s*의무|실거주\s*의무/, "거주의무"], [/계약금/, "계약금"],
  [/중도금\s*(대출|집단|이자)/, "중도금 대출"], [/잔금/, "잔금"], [/발코니\s*확장/, "발코니 확장"], [/(유상\s*옵션|선택\s*품목).*(금액|원|가격)/, "옵션 금액"]
];

const D1 = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[일.]?(?:\s*\([월화수목금토일]\))?/g;
const pad = (n) => String(n).padStart(2, "0");

// 한 줄에서 날짜(또는 기간)를 찾음: [{start, end, at}]
export function findDates(line) {
  const out = [];
  let m; D1.lastIndex = 0;
  while ((m = D1.exec(line))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const start = y + "-" + pad(mo) + "-" + pad(d);
    let end = null, after = line.slice(D1.lastIndex);
    // "~ 11.19(목)" 또는 "~ 2026.11.19" 또는 "~ 19일"
    const r = after.match(/^ {0,2}(?:\d{1,2}:\d{2} {0,2})?[~∼〜\-–] {0,2}(?:(20\d{2})\s*[.\-/년]\s*)?(?:(\d{1,2})\s*[.\-/월]\s*)?(\d{1,2})\s*[일.]?(?:\s*\([월화수목금토일]\))?/);
    if (r) {
      const ey = r[1] ? +r[1] : y, em = r[2] ? +r[2] : mo, ed = +r[3];
      if (em >= 1 && em <= 12 && ed >= 1 && ed <= 31) { end = ey + "-" + pad(em) + "-" + pad(ed); D1.lastIndex += r[0].length; }
    }
    out.push({ start, end: end && end !== start ? end : null, at: m.index });
  }
  // "2030년 3월" 같은 월 단위 (입주 예정 등)
  if (!out.length) {
    const ym = line.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월(?!\s*\d)/) || line.match(/(20\d{2})\s*\.\s*(\d{1,2})(?![\d.])/);
    if (ym && +ym[2] >= 1 && +ym[2] <= 12) out.push({ start: ym[1] + "-" + pad(+ym[2]), end: null, at: ym.index, month: true });
  }
  return out;
}
function labelOf(s) { for (const [re, name] of LABELS) if (re.test(s)) return name; return null; }
const clean = (s) => s.replace(/\s+/g, " ").trim();

// 공고문 텍스트(pdftotext -layout) → 일정 · 주요 정보
const PART = /(?<![\d.])(\d{1,2})\s*\.\s*(\d{1,2})\s*\([월화수목금토일]\)/g;
function headerCells(h) {
  const cells = [], re = /\S+(?: \S+)*/g; let c;
  while ((c = re.exec(h))) { const lb = labelOf(c[0]); if (lb) cells.push({ label: lb, from: c.index, to: c.index + c[0].length, text: c[0] }); }
  return cells;
}
export function extractEvents(text) {
  const lines = String(text || "").split(/\r?\n/);
  const events = [], seen = new Set(), used = new Set();
  const push = (label, d, raw) => {
    const key = label + "|" + d.start + "|" + (d.end || "");
    if (seen.has(key)) return; seen.add(key);
    events.push({ label, start: d.start, end: d.end || null, month: !!d.month, evidence: clean(raw).slice(0, 140) });
  };

  // 1) 가로 표: 이름표 줄(2개 이상) 아래 몇 줄에 날짜가 흩어져 있는 경우
  for (let h = 0; h < lines.length; h++) {
    if (findDates(lines[h]).length) continue;
    const cells = headerCells(lines[h]);
    if (cells.length < 2) continue;
    const full = [], parts = [], block = [];
    for (let k = h + 1; k < lines.length && k <= h + 8; k++) {
      const L = lines[k];
      const fd = findDates(L).filter((d) => !d.month);
      PART.lastIndex = 0; const pt = []; let m;
      while ((m = PART.exec(L))) { const inside = fd.some((d) => m.index >= d.at && m.index < d.at + 16); if (!inside) pt.push({ at: m.index, mo: +m[1], d: +m[2] }); }
      if (!fd.length && !pt.length && clean(L).length > 4) break;
      if (NOT_EVENT.test(L)) break;
      block.push(k);
      for (const d of fd) full.push({ ...d, open: /^\S*\s*[~∼〜]\s*$/.test(L.slice(d.at).replace(/^20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s*(\([^)]*\))?/, "").split(/\s{2,}/)[0] + " ") || /[~∼〜]\s*$/.test(L.slice(d.at, d.at + 22)), line: k });
      parts.push(...pt.map((x) => ({ ...x, line: k })));
    }
    if (full.length < 2) continue;
    // 줄바꿈된 기간 끝 "07.21(화)" 붙이기
    for (const d of full) {
      if (d.end || !d.open) continue;
      const cand = parts.filter((x) => x.line > d.line && Math.abs(x.at - d.at) <= 8 && !x.taken).sort((a, b) => a.line - b.line)[0];
      if (cand) { cand.taken = true; const [y, mo] = d.start.split("-").map(Number); d.end = (cand.mo < mo ? y + 1 : y) + "-" + pad(cand.mo) + "-" + pad(cand.d); }
    }
    full.sort((a, b) => a.at - b.at);
    const cs = cells.slice().sort((a, b) => a.from - b.from);
    const pairs = full.length === cs.length ? full.map((d, i) => [cs[i], d])
      : full.map((d) => [cs.filter((c) => c.from <= d.at + 6).pop() || cs[0], d]);
    for (const [c, d] of pairs) push(c.label, d, c.text + " " + d.start.slice(5).replace("-", ".") + (d.end ? "~" + d.end.slice(5).replace("-", ".") : ""));
    block.forEach((k) => used.add(k)); used.add(h);
  }

  // 2) 세로 표 · 문장: 같은 줄(또는 바로 윗줄)의 이름표와 날짜
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const line = lines[i], dates = findDates(line);
    if (!dates.length || NOT_EVENT.test(line)) continue;
    const own = labelOf(line);
    if (own) { push(own, dates[0], line); continue; }
    const prev = i > 0 && !used.has(i - 1) ? labelOf(lines[i - 1]) : null;
    if (prev && !findDates(lines[i - 1]).length) push(prev, dates[0], lines[i - 1] + " " + line);
  }

  const facts = [], fseen = new Set();
  for (const line of lines) {
    for (const [re, name] of FACTS) {
      if (re.test(line) && !fseen.has(name) && clean(line).length > 8 && clean(line).length < 220) { fseen.add(name); facts.push({ label: name, text: clean(line).slice(0, 200) }); }
    }
  }
  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { events: events.slice(0, 40), facts: facts.slice(0, 10) };
}

export function pdfToText(buf) {
  const dir = mkdtempSync(join(tmpdir(), "lh-"));
  try {
    const f = join(dir, "a.pdf"); writeFileSync(f, buf);
    return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", f, "-"], { maxBuffer: 64 * 1024 * 1024, timeout: 60000 }).toString("utf8");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 공고문 후보: 이름에 공고문 · 모집 · 안내가 있거나 PDF
export function pickDocs(attachments) {
  return (attachments || []).filter((a) => /^https?:\/\//.test(a.url) && (/공고|모집|안내|pdf/i.test(a.kind + " " + a.name))).slice(0, 3);
}

export async function run(env, fetcher = fetch, toText = pdfToText) {
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const r = await fetcher(env.SUPABASE_URL + "/rest/v1/news_items?select=id,title,extra,parsed&kind=eq.lh&order=published_at.desc.nullslast&limit=30", { headers: H });
  if (!r.ok) throw new Error("목록 조회 실패 HTTP " + r.status);
  const items = (await r.json()).filter((x) => x.extra && x.extra.s4);
  const report = { checked: items.length, parsed: 0, skipped: 0, errors: [] };
  for (const it of items) {
    const docs = pickDocs(it.extra.attachments);
    const sig = docs.map((d) => d.url).join("|");
    if (!docs.length) { report.skipped++; continue; }
    if (it.parsed && it.parsed.sig === sig && it.parsed.version === PARSER_VERSION) { report.skipped++; continue; }
    const events = [], facts = [], files = [];
    for (const d of docs) {
      try {
        const res = await fetcher(d.url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.slice(0, 5).toString() !== "%PDF-") throw new Error("PDF가 아닙니다");
        const out = extractEvents(toText(buf));
        events.push(...out.events.map((e) => ({ ...e, file: d.name })));
        facts.push(...out.facts.filter((f) => !facts.some((g) => g.label === f.label)));
        files.push({ name: d.name, url: d.url, events: out.events.length });
      } catch (e) { report.errors.push(it.title.slice(0, 30) + " / " + d.name + ": " + e.message); }
    }
    if (!files.length) continue;
    const parsed = { version: PARSER_VERSION, sig, parsed_at: new Date().toISOString(), files, events, facts };
    const u = await fetcher(env.SUPABASE_URL + "/rest/v1/news_items?id=eq." + it.id, { method: "PATCH", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ parsed }) });
    if (!u.ok) report.errors.push("저장 실패 HTTP " + u.status); else report.parsed++;
  }
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("read-notices.mjs")) {
  run({ SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); if (r.errors.length) process.exitCode = 0; })
    .catch((e) => { console.error(e); process.exit(1); });
}
