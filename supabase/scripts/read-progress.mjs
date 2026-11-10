// LH 청약플러스 '공사진행현황'(고양창릉 S-4)을 읽어 assets/lh-progress.json 으로 저장합니다.
// 공정 사진은 assets/lh/ 에 내려받습니다. GitHub Actions(lh-progress.yml)가 매일 돌리고, 바뀌면 커밋합니다.
// 로컬 실행: node supabase/scripts/read-progress.mjs
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const BASE = "https://apply.lh.or.kr";
const PAGE = BASE + "/lhapply/land/cwsttInfo.do";
const SITE = { bzdtCd: "105142", hcBlkCd: "05" };            // 고양창릉 S-4 (지구코드 105142, 블록 05)
const ROOT = process.env.S4_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "assets/lh-progress.json");
const IMG = path.join(ROOT, "assets/lh");

/* 페이지 안 JSON에서 key를 포함하는 객체를 꺼냄 (문자열 안의 괄호는 건너뜀) */
export function extract(html, key = '"cntCwsttDetailInfo"') {
  const at = html.indexOf(key);
  if (at < 0) throw new Error("공사진행현황 데이터를 찾지 못했습니다 (페이지 구조 변경?)");
  for (let s = html.lastIndexOf("{", at); s >= 0; s = html.lastIndexOf("{", s - 1)) {
    let d = 0, q = false;
    for (let e = s; e < html.length; e++) {
      const c = html[e];
      if (q) { if (c === "\\") e++; else if (c === '"') q = false; continue; }
      if (c === '"') q = true;
      else if (c === "{") d++;
      else if (c === "}" && --d === 0) {
        if (e < at) break;
        try { const o = JSON.parse(html.slice(s, e + 1)); if (o.cntCwsttDetailInfo) return o; } catch { /* 바깥으로 */ }
        break;
      }
    }
    if (at - s > 400000) break;
  }
  throw new Error("공사진행현황 데이터를 읽지 못했습니다");
}

const dot = (d) => (/^\d{8}$/.test(d || "") ? d.slice(0, 4) + "." + d.slice(4, 6) + "." + d.slice(6) : String(d || "").replace(/-/g, "."));
export const imgUrl = (f) => BASE + "/upload" + String(f.cmnAhflPth || "").replace("/Files/upload/", "/Files/upload_dec/") + f.cmnPhyAhflNm;

export function shape(o, prev = {}) {
  const info = o.cntCwsttDetailInfo || {}, intro = o.cntCwsttIntroDetail || {};
  const rows = (o.cntCwsttDetailList || []).filter((r) => r.delYn !== "Y");
  const reports = new Map((prev.reports || []).map((r) => [r.date, r]));    // LH에서 지워져도 지난 보고는 남김
  for (const r of rows) {
    const date = dot(r.mtiRgsDt);
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(date)) continue;
    const ext = (String(r.cmnPhyAhflNm || "").split(".").pop() || "jpg").toLowerCase();
    reports.set(date, {
      date, rate: Number(r.conPrrt), text: String(r.conXpnDtlCts || "").trim(),
      photo: r.cmnPhyAhflNm && /^(gif|jpe?g|png|webp)$/.test(ext) ? "assets/lh/" + String(r.cmnAhflSn || r.cmnPhyAhflNm.split(".")[0]) + "." + ext : null,
      photoTitle: String(r.imgAhflDesc || "").trim(), _src: r.cmnPhyAhflNm ? imgUrl(r) : null,
    });
  }
  return {
    source: PAGE, site: "고양창릉 S-4",
    info: { households: info.hshCnt ?? null, start: info.csstDt || intro.csstDt || null, end: info.ccwDt || intro.ccwDt || null, rate: info.conPrrt ?? null, builder: intro.frmNm || null, type: intro.splTpNm || null },
    reports: [...reports.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

export async function run(fetcher = fetch) {
  const res = await fetcher(PAGE, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0 (changneung-s4 site)" }, body: new URLSearchParams(SITE).toString() });
  if (!res.ok) throw new Error("LH 페이지 응답 " + res.status);
  const html = await res.text();
  let prev = {}; try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch { /* 처음 */ }
  const data = shape(extract(html), prev);
  await mkdir(IMG, { recursive: true });
  for (const r of data.reports) {
    if (r.photo && r._src && !(await exists(path.join(ROOT, r.photo)))) {
      try {
        const im = await fetcher(r._src);
        const ct = im.headers.get("content-type") || "";
        if (!im.ok || !/^image\//.test(ct)) throw new Error(im.status + " " + ct);
        const buf = Buffer.from(await im.arrayBuffer());
        if (buf.length > 8 * 1024 * 1024) throw new Error("사진이 너무 큼");
        await writeFile(path.join(ROOT, r.photo), buf);
      } catch (e) { console.log("사진 내려받기 실패:", r.date, e.message); r.photo = null; }
    }
    delete r._src;
  }
  const same = prev.info && JSON.stringify({ i: prev.info, r: prev.reports }) === JSON.stringify({ i: data.info, r: data.reports });
  if (same) { console.log("변경 없음 · 공정률", data.info.rate + "%"); return { changed: false, data }; }
  data.updatedAt = new Date().toISOString();
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log("갱신 · 공정률", data.info.rate + "%", "· 보고", data.reports.length + "건");
  return { changed: true, data };
}

if (import.meta.url === "file://" + process.argv[1]) run().catch((e) => { console.error(e.message); process.exit(1); });
