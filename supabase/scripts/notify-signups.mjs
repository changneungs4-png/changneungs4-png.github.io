// 새 가입 신청이 있으면 협의회 메일로 알립니다. (GitHub Actions에서 30분마다 실행)
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

export async function run(env, fetcher = fetch, send) {
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const get = async (path) => { const r = await fetcher(env.SUPABASE_URL + "/rest/v1/" + path, { headers: H }); if (!r.ok) throw new Error(path.split("?")[0] + " HTTP " + r.status + " " + (await r.text()).slice(0, 200)); return r.json(); };
  const pending = await get("profiles?select=id,unit_id,created_at&status=eq.pending&order=created_at.asc");
  if (!pending.length) return { pending: 0, sent: 0 };
  const done = new Set((await get("signup_notices?select=profile_id")).map((x) => x.profile_id));
  const fresh = pending.filter((p) => !done.has(p.id));
  if (!fresh.length) return { pending: pending.length, sent: 0 };
  const ids = fresh.map((p) => p.id).join(",");
  const consented = new Set((await get("agreements?select=user_id&user_id=in.(" + ids + ")")).map((x) => x.user_id));
  const mail = buildMail(fresh, pending.length, consented, env.SITE_URL || "https://changneungs4-png.github.io");
  if (!send) return { pending: pending.length, sent: 0, skipped: "메일 설정(GMAIL_APP_PASSWORD) 없음", preview: mail.subject };
  await send(mail);
  const r = await fetcher(env.SUPABASE_URL + "/rest/v1/signup_notices", { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(fresh.map((p) => ({ profile_id: p.id }))) });
  if (!r.ok) throw new Error("알림 기록 실패 HTTP " + r.status);
  return { pending: pending.length, sent: fresh.length };
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
