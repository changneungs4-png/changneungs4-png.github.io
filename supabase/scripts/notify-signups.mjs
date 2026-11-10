// 새 가입 신청 · 위임동의 철회가 있으면 협의회 메일로 알립니다. (GitHub Actions에서 30분마다 실행)
// 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, (선택) NOTIFY_TO, SITE_URL
// 메일에는 세대(동 · 호)와 신청 시각만 넣고, 계약서 사진 등은 넣지 않습니다.

export function kst(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "." + p(d.getUTCMonth() + 1) + "." + p(d.getUTCDate()) + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}
export function unitLabel(u) { const [d, h] = String(u).split("-"); return d + "동 " + h + "호"; }

export function buildMail(fresh, allPending, consented, site) {
  const lines = fresh.map((p) => "· " + unitLabel(p.unit_id) + " — " + kst(p.created_at) + " 신청" + (consented.has(p.id) ? " · 위임동의 제출" : " · 위임동의 없음"));
  const subject = "[창릉 S-4 입예협] 새 가입 신청 " + fresh.length + "건" + (allPending > fresh.length ? " (대기 총 " + allPending + "건)" : "");
  const text = "새 가입 신청이 들어왔습니다.\n\n" + lines.join("\n") + "\n\n승인 대기 총 " + allPending + "건\n계약서 확인 · 승인: " + site + "/admin.html#pending\n\n— 이 메일은 자동으로 보냈습니다.";
  return { subject, text };
}

export function buildWithdrawMail(rows, site) {
  const subject = "[창릉 S-4 입예협] 위임동의 철회 " + rows.length + "건";
  const text = "위임동의를 철회한 세대가 있습니다.\n\n" + rows.map((r) => "· " + unitLabel(r.unit_id) + " — " + kst(r.at) + " 철회").join("\n") +
    "\n\n확인: " + site + "/admin.html#agreements\n오픈채팅 비밀번호를 바꾸는 것을 권장합니다(운영진 페이지 > 회원).\n\n— 이 메일은 자동으로 보냈습니다.";
  return { subject, text };
}

// 새로 생긴 '본인 철회'를 한 번만 메일로 (다시 위임한 세대는 제외). 알린 기록은 notified_at
export async function notifyWithdrawals(env, fetcher, H, get, send) {
  let rows;
  try { rows = await get("agreement_log?select=id,unit_id,user_id,by_user,at&action=eq.withdraw&notified_at=is.null&order=at.asc&limit=200"); }
  catch (e) { if (/HTTP 4\d\d/.test(e.message) && /notified_at/.test(e.message)) return { withdrawals: 0, note: "철회 알림 DB 설정 전" }; throw e; }
  if (!rows.length) return { withdrawals: 0 };
  const units = [...new Set(rows.map((r) => r.unit_id))];
  const back = new Set((await get("agreements?select=unit_id&unit_id=in.(" + units.map((u) => '"' + u + '"').join(",") + ")")).map((x) => x.unit_id));
  const self = rows.filter((r) => r.by_user && r.by_user === r.user_id && !back.has(r.unit_id));
  if (self.length && !send) return { withdrawals: self.length, sent: 0, skipped: "메일 설정 없음" };
  if (self.length) await send(buildWithdrawMail(self, env.SITE_URL || "https://changneungs4-png.github.io"));
  const p = await fetcher(env.SUPABASE_URL + "/rest/v1/agreement_log?id=in.(" + rows.map((r) => r.id).join(",") + ")", { method: "PATCH", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
  if (!p.ok) throw new Error("철회 알림 기록 실패 HTTP " + p.status);
  return { withdrawals: self.length, sent: self.length };
}

export async function run(env, fetcher = fetch, send) {
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const get = async (path) => { const r = await fetcher(env.SUPABASE_URL + "/rest/v1/" + path, { headers: H }); if (!r.ok) throw new Error(path.split("?")[0] + " HTTP " + r.status + " " + (await r.text()).slice(0, 200)); return r.json(); };
  const cleaned = await cleanup(env, fetcher, H, get).catch((e) => "정리 실패: " + e.message);
  const wd = await notifyWithdrawals(env, fetcher, H, get, send).catch((e) => ({ error: e.message }));
  const res = await signups(env, fetcher, H, get, send);
  return { ...res, cleaned, withdraw: wd };
}

async function signups(env, fetcher, H, get, send) {
  const cleaned = undefined;
  const pending = await get("profiles?select=id,unit_id,created_at&status=eq.pending&order=created_at.asc");
  if (!pending.length) return { pending: 0, sent: 0, cleaned };
  const done = new Set((await get("signup_notices?select=profile_id")).map((x) => x.profile_id));
  const fresh = pending.filter((p) => !done.has(p.id));
  if (!fresh.length) return { pending: pending.length, sent: 0, cleaned };
  const ids = fresh.map((p) => p.id).join(",");
  const consented = new Set((await get("agreements?select=user_id&user_id=in.(" + ids + ")")).map((x) => x.user_id));
  const mail = buildMail(fresh, pending.length, consented, env.SITE_URL || "https://changneungs4-png.github.io");
  if (!send) return { pending: pending.length, sent: 0, skipped: "메일 설정(GMAIL_APP_PASSWORD) 없음", preview: mail.subject };
  await send(mail);
  const r = await fetcher(env.SUPABASE_URL + "/rest/v1/signup_notices", { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(fresh.map((p) => ({ profile_id: p.id }))) });
  if (!r.ok) throw new Error("알림 기록 실패 HTTP " + r.status);
  return { pending: pending.length, sent: fresh.length, cleaned };
}

// 지울 목록(file_cleanup)에 오른 파일(서면 스캔본 · 사진관 사진)을 저장소에서 삭제
export async function cleanup(env, fetcher, H, get) {
  let list;
  try { list = await get("file_cleanup?select=bucket,path&limit=200"); } catch (e) { if (/HTTP 404/.test(e.message)) return 0; throw e; }
  let n = 0;
  for (const bucket of [...new Set(list.map((x) => x.bucket))]) {
    const queued = list.filter((x) => x.bucket === bucket).map((x) => x.path);
    // 아직 위임에 연결된 파일(서면 → 온라인 전환 등)은 지우지 않고 목록에서만 뺌
    const ref = { consents: ["agreements", "paper_path"], gallery: ["photos", "path"] }[bucket];
    const inUse = new Set(ref ? (await get(ref[0] + "?select=" + ref[1] + "&" + ref[1] + "=in.(" + queued.map((p) => '"' + p + '"').join(",") + ")")).map((x) => x[ref[1]]) : []);
    const paths = queued.filter((p) => !inUse.has(p));
    if (paths.length) {
    const r = await fetcher(env.SUPABASE_URL + "/storage/v1/object/" + bucket, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: paths }) });
    if (!r.ok) throw new Error("저장소 삭제 HTTP " + r.status);
    }
    const d = await fetcher(env.SUPABASE_URL + "/rest/v1/file_cleanup?bucket=eq." + encodeURIComponent(bucket) + "&path=in.(" + queued.map((p) => '"' + p.replace(/"/g, '\\"') + '"').join(",") + ")", { method: "DELETE", headers: { ...H, prefer: "return=minimal" } });
    if (!d.ok) throw new Error("정리 기록 삭제 HTTP " + d.status);
    n += paths.length;
  }
  return n;
}

if (process.argv[1] && process.argv[1].endsWith("notify-signups.mjs")) {
  const env = process.env;
  let send = null;
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    const nodemailer = (await import("nodemailer")).default;
    const tr = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") } });
    send = (m) => tr.sendMail({ from: '"창릉 S-4 입예협 알림" <' + env.GMAIL_USER + ">", to: env.NOTIFY_TO || env.GMAIL_USER, subject: m.subject, text: m.text });
  }
  run(env, fetch, send).then((r) => console.log(JSON.stringify(r))).catch((e) => { console.error(e.message); process.exit(1); });
}
