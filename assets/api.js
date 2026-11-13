/* 서버(Supabase) 연동. 설정이 없으면 API.enabled = false 로 안내 사이트만 동작 */
(function () {
  "use strict";
  var CFG = window.S4_CONFIG || {};
  var enabled = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var sb = enabled ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "s4-auth" }
  }) : null;
  var FORM_VERSION = "2026-11-v7";
  function phoneOk(v) { return /^01[016789]-?\d{3,4}-?\d{4}$/.test(String(v || "").replace(/\s/g, "")); }
  function checkConsent(c) {
    if (!c) throw new Error("위임동의서를 작성하세요.");
    if (!c.signer || c.signer.trim().length < 2) throw new Error("위임동의서의 계약자 성명을 입력하세요.");
    if (!c.signature) throw new Error("위임장 서명 칸에 서명해 주세요.");
    if (!phoneOk(c.phone)) throw new Error("휴대전화번호를 바르게 입력하세요. (예: 010-1234-5678)");
    if (c.coOwner && (!c.coName || c.coName.trim().length < 2)) throw new Error("공동명의자 성명을 입력하세요.");
    if (c.coOwner && !c.repName) throw new Error("공동명의 세대는 대표 회원 성명을 입력하세요.");
    if (c.coOwner && [String(c.signer || "").trim(), String(c.coName || "").trim()].indexOf(String(c.repName || "").trim()) < 0) throw new Error("대표 회원은 계약자나 공동명의자 중 한 명이어야 합니다.");
    if (c.coOwner && !c.coSignature) throw new Error("공동명의자 서명 칸에 서명해 주세요.");
    if (c.coOwner && !c.coOk) throw new Error("공동명의자 본인 확인 · 동의에 체크해 주세요.");
    if (!c.delegation || !c.privacy || !c.identity) throw new Error("위임동의서의 필수 항목에 모두 동의해야 합니다.");
  }
  var st = { session: null, profile: null, openAt: new Date(((window.SITE || {}).consentOpenAt) || "2026-11-16T00:00:00+09:00"), signupAt: null };

  var MSG = [
    [/invalid login credentials/i, "동 · 호수 또는 비밀번호가 맞지 않습니다."],
    [/user already registered|already been registered|email.*exists/i, "이 세대는 이미 가입되어 있습니다. 본인 세대인데 가입한 적이 없다면 운영진에게 문의하세요."],
    [/password should be at least|weak.?password/i, "비밀번호는 8자 이상이어야 합니다."],
    [/profiles_unit_id_key|profiles_username_key/i, "이 세대는 이미 가입되어 있습니다."],
    [/agreements_pkey/i, "이 세대는 이미 위임동의서를 냈습니다."],
    [/poll_votes_pkey/i, "이 세대는 이미 투표했습니다."],
    [/campaign_joins_pkey/i, "이 세대는 이미 참여했습니다."],
    [/rate limit|too many/i, "요청이 너무 잦습니다. 잠시 후 다시 시도하세요."],
    [/failed to fetch|network|load failed/i, "서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요."],
    [/jwt expired|invalid jwt/i, "로그인이 만료되었습니다. 다시 로그인하세요."],
    [/payload too large|exceeded the maximum/i, "파일이 너무 큽니다. 5MB 이하로 올려주세요."],
    [/violates check constraint/i, "입력값을 다시 확인하세요."],
    [/row-level security|permission denied/i, "권한이 없습니다."]
  ];
  function kor(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || "알 수 없는 오류");
    if (/[가-힣]/.test(m)) return m;
    for (var i = 0; i < MSG.length; i++) if (MSG[i][0].test(m) || MSG[i][0].test(e && e.code || "")) return MSG[i][1];
    return "처리하지 못했습니다. (" + m + ")";
  }
  function must(r) { if (r.error) throw new Error(kor(r.error)); return r.data; }
  function need() { if (!enabled) throw new Error("회원 기능이 아직 연결되지 않았습니다."); }
  function emailOf(unit) { return String(unit).trim() + "@" + CFG.idDomain; }
  function validUnit(u) { return /^4\d{2}-\d{3,4}$/.test(String(u || "")); }
  function uid() { return st.session && st.session.user && st.session.user.id; }

  async function loadProfile() {
    if (!uid()) { st.profile = null; return null; }
    var both = await Promise.all([sb.from("profiles").select("*").eq("id", uid()).maybeSingle(), sb.from("agreements").select("user_id").eq("user_id", uid()).maybeSingle()]);
    var r = both[0], a = both[1];
    st.profile = r.error ? null : r.data;
    st.hasAgreement = !!st.profile && !a.error && !!a.data;
    return st.profile;
  }
  function checkFile(f) {
    if (!f) throw new Error("계약서 사진을 첨부하세요.");
    if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(f.type)) throw new Error("사진(JPG · PNG · HEIC) 또는 PDF만 올릴 수 있습니다.");
    if (f.size > 5 * 1024 * 1024) throw new Error("파일이 너무 큽니다. 5MB 이하로 올려주세요.");
  }
  async function uploadContract(f) {
    checkFile(f);
    var ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    var path = uid() + "/" + Date.now() + "." + ext;
    must(await sb.storage.from("contracts").upload(path, f, { contentType: f.type, upsert: false }));
    return path;
  }

  /* 사진 줄이기: 긴 변 1600px JPEG. 다시 그리면서 촬영 위치(EXIF GPS) 같은 메타데이터가 빠짐 */
  var CATS = ["현장 방문", "공사 현장", "모델하우스", "행사", "기타"];
  async function shrink(f) {
    if (!f || !/^image\//.test(f.type || "")) throw new Error("사진 파일만 올릴 수 있습니다. (" + (f && f.name) + ")");
    if (f.size > 30 * 1024 * 1024) throw new Error("사진이 너무 큽니다(30MB 초과): " + f.name);
    var src;
    try { src = await createImageBitmap(f, { imageOrientation: "from-image" }); }
    catch (e) {
      src = await new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error("이 사진 형식은 열 수 없습니다: " + f.name + " (HEIC은 JPG로 바꿔 올려주세요)")); }; i.src = URL.createObjectURL(f); });
    }
    var w = src.width, h = src.height, k = Math.min(1, 1600 / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    var blob = await new Promise(function (ok) { c.toBlob(ok, "image/jpeg", 0.82); });
    if (!blob) throw new Error("사진을 변환하지 못했습니다: " + f.name);
    return { blob: blob, w: w, h: h };
  }
  function photoPath() { return new Date().getFullYear() + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg"; }
  function dateOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")); }

  var API = {
    enabled: enabled,
    formVersion: FORM_VERSION,
    get session() { return st.session; },
    get profile() { return st.profile; },
    get loggedIn() { return !!st.session; },
    /* 가입 회원 = 승인된 세대 (게시판 · 투표 결과 보기) */
    get isMember() { return !!(st.profile && st.profile.status === "approved"); },
    /* 위임 회원 = 승인 + 위임동의 (운영진은 예외): 투표 · 단체민원 참여, 세대별 현황 */
    get isDelegate() { return !!(st.profile && st.profile.status === "approved" && (st.profile.is_admin || st.hasAgreement)); },
    /* 가입 · 위임장 제출 시작(공급계약 시작) */
    get consentOpenAt() { return st.openAt; },
    get consentOpen() { return Date.now() >= st.openAt.getTime(); },
    get signupOpenAt() { return st.signupAt || st.openAt; },
    get signupOpen() { return Date.now() >= (st.signupAt || st.openAt).getTime(); },
    get isApproved() { return !!(st.profile && st.profile.status === "approved"); },
    get hasAgreement() { return !!st.hasAgreement; },
    get isAdmin() { return !!(st.profile && st.profile.status === "approved" && st.profile.is_admin); },
    validUnit: validUnit,

    init: async function () {
      if (!enabled) return st;
      // 시작 시각 조회와 로그인 확인을 동시에 (페이지가 빨리 뜨게)
      var open = Promise.all([
        sb.rpc("consent_open_at").then(function (o) { if (!o.error && o.data) st.openAt = new Date(o.data); }, function () { /* 기본값 사용 */ }),
        sb.rpc("signup_open_at").then(function (o) { if (!o.error && o.data) st.signupAt = new Date(o.data); }, function () { /* 없으면 위임 시작과 같음 */ })]);
      var who = sb.auth.getSession().then(function (r) {
        st.session = r.data && r.data.session;
        if (st.session) return loadProfile();
      }).catch(function () { st.session = null; st.profile = null; });
      await Promise.all([open, who]);
      return st;
    },
    signIn: async function (unit, pw) {
      need();
      if (!validUnit(unit)) throw new Error("동과 호수를 고르세요.");
      if (!pw) throw new Error("비밀번호를 입력하세요.");
      var r = await sb.auth.signInWithPassword({ email: emailOf(unit), password: pw });
      must(r); st.session = r.data.session; await loadProfile(); return st;
    },
    signOut: async function () { if (enabled) await sb.auth.signOut(); st.session = null; st.profile = null; },

    unitTaken: async function (unit) { need(); return !!must(await sb.rpc("unit_taken", { p_unit: unit })); },

    /* 로그인 계정의 세대 (아이디 = 동-호) */
    get accountUnit() { return st.session ? String(st.session.user.email || "").split("@")[0] : null; },

    /* 가입: 세대로 계정 → 계약서 사진 업로드 → 회원 정보(대기). 가입 · 위임은 공급계약 시작 후. 위임동의서는 가입 뒤 따로 */
    signUp: async function (o) {
      need();
      if (!validUnit(o.unit)) throw new Error("동과 호수를 고르세요.");
      if (!o.password || o.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
      if (o.password !== o.password2) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      checkFile(o.file);
      if (!o.privacy) throw new Error("개인정보 수집 · 이용에 동의해야 가입할 수 있습니다.");
      if (!API.signupOpen) { var sa = st.signupAt || st.openAt; throw new Error("가입은 " + (sa.getMonth() + 1) + "월 " + sa.getDate() + "일부터 받습니다."); }
      if (await API.unitTaken(o.unit)) throw new Error("이 세대는 이미 가입되어 있습니다. 본인 세대인데 가입한 적이 없다면 운영진에게 문의하세요.");
      var r = await sb.auth.signUp({ email: emailOf(o.unit), password: o.password });
      must(r);
      if (!r.data.session) { var s = await sb.auth.signInWithPassword({ email: emailOf(o.unit), password: o.password }); must(s); st.session = s.data.session; }
      else st.session = r.data.session;
      return API.completeProfile({ file: o.file, privacy: true });
    },
    /* 계정은 있는데 회원 정보가 없을 때(가입 중단) 마무리 */
    completeProfile: async function (o) {
      need();
      if (!o.privacy) throw new Error("개인정보 수집 · 이용에 동의해야 가입할 수 있습니다.");
      var unit = API.accountUnit, path = await uploadContract(o.file);
      must(await sb.from("profiles").insert({ id: uid(), username: unit, unit_id: unit, contract_path: path }));
      await loadProfile();
      return st.profile;
    },
    /* 반려 후 계약서 다시 내기 */
    reapply: async function (o) {
      need();
      var path = await uploadContract(o.file);
      must(await sb.from("profiles").update({ contract_path: path, status: "pending" }).eq("id", uid()));
      await loadProfile(); return st.profile;
    },
    /* 게시판 표시 이름 (비우면 "403-1804", 정하면 "닉네임 · 403-1804") */
    updateNickname: async function (nick) {
      need(); nick = (nick || "").trim();
      if (nick && (nick.length < 2 || nick.length > 20)) throw new Error("닉네임은 2~20자로 입력하세요. 비워 두면 동-호수만 표시됩니다.");
      must(await sb.from("profiles").update({ nickname: nick || null }).eq("id", uid())); await loadProfile();
    },
    /* 네이버 카페 닉네임: 운영진이 이걸 보고 카페 등업 */
    setCafeNick: async function (nick) {
      need(); nick = String(nick || "").trim();
      if (nick.length > 30) throw new Error("카페 닉네임은 30자까지입니다.");
      must(await sb.rpc("set_my_cafe_nick", { p_nick: nick })); await loadProfile();
    },
    changePassword: async function (pw, pw2) {
      need(); if (!pw || pw.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
      if (pw !== pw2) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      must(await sb.auth.updateUser({ password: pw }));
    },

    /* 위임동의 */
    myAgreement: async function () {
      need(); if (!st.profile || st.profile.status === "rejected") return null;
      return must(await sb.from("agreements").select("*").eq("user_id", uid()).maybeSingle());
    },
    submitAgreement: async function (o) {
      need();
      if (!st.profile || st.profile.status === "rejected") throw new Error("가입한 회원만 위임동의서를 낼 수 있습니다.");
      if (!API.consentOpen) throw new Error("위임동의서는 공급계약이 시작되는 " + (st.openAt.getMonth() + 1) + "월 " + st.openAt.getDate() + "일부터 낼 수 있습니다.");
      checkConsent(o);
      var row = must(await sb.from("agreements").insert({ signer_name: o.signer.trim(), signature: o.signature, agree_delegation: true, agree_privacy: true, agree_identity: true,
        agree_third_party: !!o.thirdParty, agree_contact: true, phone: String(o.phone || "").trim(), cafe_nick: String(o.cafeNick || "").trim() || null,
        co_name: o.coOwner ? String(o.coName || "").trim() : null, co_signature: o.coOwner ? o.coSignature : null, rep_name: o.coOwner ? String(o.repName || "").trim() : null, form_version: FORM_VERSION }).select().single());
      st.hasAgreement = true; return row;
    },
    withdrawAgreement: async function () { need(); must(await sb.from("agreements").delete().eq("user_id", uid())); st.hasAgreement = false; },
    stats: async function () { need(); return must(await sb.rpc("agreement_stats")); },
    memberUnits: async function () { need(); if (!API.isDelegate && !API.isAdmin) return []; var r = await sb.rpc("member_units"); return r.error ? [] : r.data; },
    /* 입주민 오픈채팅 입장 정보 (위임 회원 · 운영진만) */
    /* 회원 전용 안내문 (외부 유출 금지 내용) */
    privateNote: async function (key) { need(); if (!API.isMember) return null; var r = await sb.rpc("private_note_get", { p_key: key }); return r.error ? null : (r.data || [])[0] || null; },
    /* 회비 안내 · 월별 합계 (누구나), 우리 세대 납부 상태 (회원) */
    duesPublic: async function () { need(); var r = await sb.rpc("dues_public"); return r.error ? null : r.data; },
    duesMine: async function () { need(); if (!API.isMember) return null; var r = await sb.rpc("dues_mine"); return r.error ? null : (r.data || [])[0] || null; },
    chatInfo: async function () { need(); if (!API.isDelegate && !API.isAdmin) return null; var r = await sb.rpc("chat_info_get"); if (r.error) return null; return (r.data || [])[0] || null; },
    memberStats: async function () { need(); var r = await sb.rpc("member_stats"); return r.error ? null : r.data; },
    agreedUnits: async function () { need(); if (!API.isDelegate && !API.isAdmin) return []; return must(await sb.rpc("agreed_units")); },

    /* 게시판 */
    posts: async function () { need(); return must(await sb.from("posts").select("id,cat,title,author_id,author_label,created_at,comments(count)").order("id", { ascending: false }).limit(200)); },
    post: async function (id) {
      need();
      var p = must(await sb.from("posts").select("*").eq("id", id).maybeSingle());
      if (!p) return null;
      p.comments = must(await sb.from("comments").select("*").eq("post_id", id).order("id"));
      return p;
    },
    createPost: async function (o) {
      need(); if (!o.title || !o.title.trim()) throw new Error("제목을 입력하세요."); if (!o.body || !o.body.trim()) throw new Error("내용을 입력하세요.");
      return must(await sb.from("posts").insert({ cat: o.cat, title: o.title.trim(), body: o.body.trim() }).select().single());
    },
    deletePost: async function (id) { need(); var d = must(await sb.from("posts").delete().eq("id", id).select("id")); if (!d.length) throw new Error("권한이 없습니다."); },
    addComment: async function (postId, body) { need(); if (!body || !body.trim()) throw new Error("댓글을 입력하세요."); return must(await sb.from("comments").insert({ post_id: postId, body: body.trim() }).select().single()); },
    deleteComment: async function (id) { need(); var d = must(await sb.from("comments").delete().eq("id", id).select("id")); if (!d.length) throw new Error("권한이 없습니다."); },

    /* 사진관 · 현장 방문 (누구나 보기) */
    photoCats: CATS,
    photoUrl: function (path) { return CFG.supabaseUrl + "/storage/v1/object/public/gallery/" + String(path).split("/").map(encodeURIComponent).join("/"); },
    photos: async function () { need(); return must(await sb.from("photos").select("*").order("taken_on", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(1000)); },
    visits: async function () { need(); return must(await sb.from("visits").select("*, photos(id,path,title,width,height)").order("visited_on", { ascending: false }).order("id", { ascending: false }).limit(300)); },

    /* 자동 수집 소식 */
    news: async function (kind, limit) {
      need(); var q = sb.from("news_items").select("*").eq("hidden", false).order("published_at", { ascending: false, nullsFirst: false }).limit(limit || 100);
      if (kind) q = q.eq("kind", kind);
      return must(await q);
    },

    /* 민원 · 투표 */
    campaigns: async function () {
      need();
      var list = must(await sb.from("campaigns").select("*").order("id", { ascending: false }));
      var counts = must(await sb.rpc("campaign_counts")), mine = [];
      if (API.isMember) mine = must(await sb.from("campaign_joins").select("campaign_id").eq("user_id", uid())).map(function (x) { return x.campaign_id; });
      var c = {}; counts.forEach(function (x) { c[x.campaign_id] = x.joined; });
      return list.map(function (x) { x.joined = c[x.id] || 0; x.mine = mine.indexOf(x.id) >= 0; return x; });
    },
    joinCampaign: async function (id) { need(); must(await sb.from("campaign_joins").insert({ campaign_id: id })); },
    polls: async function () {
      need(); if (!API.isMember && !API.isAdmin) return [];
      var list = must(await sb.from("polls").select("*").order("id", { ascending: false }));
      var mine = {};
      must(await sb.from("poll_votes").select("poll_id,option_idx").eq("user_id", uid())).forEach(function (v) { mine[v.poll_id] = v.option_idx; });
      for (var i = 0; i < list.length; i++) {
        var res = must(await sb.rpc("poll_results", { p_poll: list[i].id })), votes = list[i].options.map(function () { return 0; });
        res.forEach(function (r) { votes[r.option_idx] = r.votes; });
        list[i].votes = votes; list[i].mine = mine.hasOwnProperty(list[i].id) ? mine[list[i].id] : null;
        list[i].closed = new Date(list[i].ends_at) < new Date();
      }
      return list;
    },
    vote: async function (pollId, idx) { need(); must(await sb.from("poll_votes").insert({ poll_id: pollId, option_idx: idx })); },

    /* 운영진 */
    admin: {
      profiles: async function (status) {
        need(); var q = sb.from("profiles").select("*").order("created_at", { ascending: true });
        if (status) q = q.eq("status", status);
        return must(await q);
      },
      contractUrl: async function (path) {
        need(); var b = must(await sb.storage.from("contracts").download(path));
        var ext = String(path).split(".").pop().toLowerCase();
        var type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[ext] || b.type;
        return URL.createObjectURL(new Blob([b], { type: type }));
      },
      approve: async function (p) {
        need(); must(await sb.from("profiles").update({ status: "approved", reject_reason: null, contract_path: null }).eq("id", p.id));
        if (p.contract_path) await sb.storage.from("contracts").remove([p.contract_path]);
      },
      setAdmin: async function (p, on) {
        need(); if (p.status !== "approved") throw new Error("승인된 회원만 운영진으로 지정할 수 있습니다.");
        must(await sb.from("profiles").update({ is_admin: !!on }).eq("id", p.id));
      },
      newsAll: async function () { need(); return must(await sb.from("news_items").select("*").order("created_at", { ascending: false }).limit(200)); },
      setNewsHidden: async function (id, hidden) { need(); must(await sb.from("news_items").update({ hidden: !!hidden }).eq("id", id)); },
      collectNow: async function () {
        need();
        var r = await fetch(CFG.supabaseUrl + "/functions/v1/collect-news", { method: "POST", headers: { authorization: "Bearer " + st.session.access_token, apikey: CFG.supabaseAnonKey, "content-type": "application/json" }, body: "{}" });
        var j = {}; try { j = await r.json(); } catch (e) {}
        if (!r.ok) throw new Error(j.error || "수집기를 호출하지 못했습니다. Edge Function 배포 상태를 확인하세요. (HTTP " + r.status + ")");
        return j;
      },
      orphans: async function () { need(); return must(await sb.rpc("admin_orphan_accounts")); },
      deleteAccount: async function (p) {
        need();
        if (p.contract_path) await sb.storage.from("contracts").remove([p.contract_path]);
        must(await sb.rpc("admin_delete_account", { p_user: p.id }));
      },
      reject: async function (p, reason) {
        need(); if (!reason || !reason.trim()) throw new Error("반려 사유를 입력하세요.");
        must(await sb.from("profiles").update({ status: "rejected", reject_reason: reason.trim(), contract_path: null }).eq("id", p.id));
        if (p.contract_path) await sb.storage.from("contracts").remove([p.contract_path]);
      },
      revoke: async function (p, reason) {
        need();
        if (!reason || !reason.trim()) throw new Error("승인 취소 사유를 입력하세요.");
        must(await sb.from("agreements").delete().eq("user_id", p.id));
        must(await sb.from("profiles").update({ status: "rejected", reject_reason: reason.trim() }).eq("id", p.id));
      },
      agreements: async function () { need(); return must(await sb.from("agreements").select("*").order("unit_id")); },
      log: async function () { need(); return must(await sb.from("agreement_log").select("*").order("id", { ascending: false }).limit(300)); },
      /* 서면 위임장: 공식 메일로 받은 스캔본을 올리고 등록 */
      registerPaper: async function (o) {
        need();
        if (!validUnit(o.unit)) throw new Error("세대를 고르세요.");
        if (!o.signer || o.signer.trim().length < 2) throw new Error("서면 위임장의 계약자 성명을 입력하세요.");
        if (o.contact && !phoneOk(o.phone)) throw new Error("연락처 동의 세대는 휴대전화 번호를 바르게 입력하세요.");
        var f = o.file; if (!f) throw new Error("서면 위임장 스캔본(사진 · PDF)을 첨부하세요.");
        if (f.size > 10 * 1024 * 1024) throw new Error("스캔본은 10MB 이하로 올려주세요.");
        if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(f.type || "")) throw new Error("사진(JPG · PNG) 또는 PDF 파일만 올릴 수 있습니다.");
        var ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
        var path = o.unit + "/" + Date.now() + "." + ext;
        must(await sb.storage.from("consents").upload(path, f, { contentType: f.type, upsert: false }));
        var r = await sb.from("agreements").insert({ unit_id: o.unit, source: "paper", signer_name: o.signer.trim(), paper_path: path, agree_delegation: true, agree_privacy: true, agree_identity: true,
          agree_third_party: !!o.thirdParty, agree_contact: !!o.contact, phone: o.contact ? String(o.phone || "").trim() : null, form_version: FORM_VERSION + "-paper",
          signed_at: o.signedOn ? new Date(o.signedOn + "T12:00:00+09:00").toISOString() : null }).select().single();
        if (r.error) { await sb.storage.from("consents").remove([path]); if (r.error.code === "23505") throw new Error("이미 위임동의가 있는 세대입니다."); throw r.error; }
        return r.data;
      },
      paperUrl: async function (path) {
        need(); var b = must(await sb.storage.from("consents").download(path));
        var ext = String(path).split(".").pop().toLowerCase();
        var type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[ext] || b.type;
        return URL.createObjectURL(new Blob([b], { type: type }));
      },
      withdrawPaper: async function (a) {
        need(); must(await sb.from("agreements").delete().eq("unit_id", a.unit_id).eq("source", "paper"));
        if (a.paper_path) await sb.storage.from("consents").remove([a.paper_path]);
      },
      memberLog: async function () { need(); return must(await sb.from("member_log").select("*").order("id", { ascending: false }).limit(300)); },
      createPoll: async function (o) {
        need(); var opts = (o.options || []).map(function (x) { return x.trim(); }).filter(Boolean);
        if (!o.question || o.question.trim().length < 2) throw new Error("질문을 입력하세요.");
        if (opts.length < 2) throw new Error("선택지를 두 개 이상 입력하세요.");
        if (!o.ends) throw new Error("마감일을 고르세요.");
        must(await sb.from("polls").insert({ question: o.question.trim(), options: opts, ends_at: new Date(o.ends + "T23:59:59+09:00").toISOString() }));
      },
      deletePoll: async function (id) { need(); must(await sb.from("polls").delete().eq("id", id)); },
      createCampaign: async function (o) {
        need(); if (!o.title || o.title.trim().length < 2) throw new Error("민원 제목을 입력하세요.");
        must(await sb.from("campaigns").insert({ title: o.title.trim(), target: (o.target || "").trim(), description: (o.description || "").trim() }));
      },
      setCampaignStatus: async function (id, s) { need(); must(await sb.from("campaigns").update({ status: s }).eq("id", id)); },
      /* 사진 올리기: 여러 장. 하나라도 실패하면 그 사진만 건너뛰고 결과를 알려줌 */
      addPhotos: async function (files, o, onStep) {
        need(); files = Array.prototype.slice.call(files || []);
        if (!files.length) throw new Error("사진을 고르세요.");
        if (files.length > 30) throw new Error("한 번에 30장까지 올릴 수 있습니다.");
        if (CATS.indexOf(o.cat) < 0) throw new Error("분류를 고르세요.");
        if (!o.title || !o.title.trim()) throw new Error("사진 제목을 입력하세요.");
        if (o.takenOn && !dateOk(o.takenOn)) throw new Error("날짜를 바르게 고르세요.");
        var done = [], fails = [];
        for (var i = 0; i < files.length; i++) {
          if (onStep) onStep(i + 1, files.length);
          var path = null;
          try {
            var r = await shrink(files[i]); path = photoPath();
            must(await sb.storage.from("gallery").upload(path, r.blob, { contentType: "image/jpeg", upsert: false }));
            done.push(must(await sb.from("photos").insert({ cat: o.cat, title: o.title.trim().slice(0, 120), taken_on: o.takenOn || null, path: path, width: r.w, height: r.h, visit_id: o.visitId || null }).select().single()));
          } catch (e) { if (path) await sb.storage.from("gallery").remove([path]).catch(function () {}); fails.push((files[i] && files[i].name) + ": " + kor(e)); }
        }
        return { done: done, fails: fails };
      },
      updatePhoto: async function (id, o) {
        need(); if (!o.title || !o.title.trim()) throw new Error("사진 제목을 입력하세요."); if (CATS.indexOf(o.cat) < 0) throw new Error("분류를 고르세요.");
        must(await sb.from("photos").update({ title: o.title.trim(), cat: o.cat, taken_on: o.takenOn || null }).eq("id", id));
      },
      deletePhoto: async function (p) {
        need(); must(await sb.from("photos").delete().eq("id", p.id));
        await sb.storage.from("gallery").remove([p.path]).catch(function () {});
      },
      saveVisit: async function (o, files, onStep) {
        need();
        if (!dateOk(o.date)) throw new Error("방문 날짜를 고르세요.");
        if (!o.title || o.title.trim().length < 2) throw new Error("제목을 2자 이상 입력하세요.");
        if ((o.body || "").length > 5000) throw new Error("내용은 5,000자까지 쓸 수 있습니다.");
        var row = { visited_on: o.date, title: o.title.trim(), body: (o.body || "").trim() }, v;
        if (o.id) v = must(await sb.from("visits").update(row).eq("id", o.id).select().single());
        else v = must(await sb.from("visits").insert(row).select().single());
        var res = { visit: v, done: [], fails: [] };
        if (files && files.length) { var r = await API.admin.addPhotos(files, { cat: "현장 방문", title: v.title, takenOn: v.visited_on, visitId: v.id }, onStep); res.done = r.done; res.fails = r.fails; }
        return res;
      },
      deleteVisit: async function (v) {
        need(); var paths = (v.photos || []).map(function (p) { return p.path; });
        must(await sb.from("visits").delete().eq("id", v.id));
        if (paths.length) await sb.storage.from("gallery").remove(paths).catch(function () {});
      },
      /* 운영진이 아직 확인하지 않은 위임동의 철회 */
      withdrawals: async function () { need(); var r = await sb.rpc("withdrawals_unacked"); return r.error ? [] : (r.data || []); },
      ackWithdrawals: async function (ids) { need(); must(await sb.rpc("withdrawals_ack", { p_ids: ids })); },
      setChatInfo: async function (url, pw) {
        need(); url = String(url || "").trim(); pw = String(pw || "").trim();
        if (url && !/^https:\/\//.test(url)) throw new Error("채팅방 주소는 https:// 로 시작해야 합니다.");
        if (pw.length > 40) throw new Error("비밀번호는 40자까지 넣을 수 있습니다.");
        must(await sb.rpc("chat_info_set", { p_url: url, p_password: pw }));
      },
      deleteCampaign: async function (id) { need(); must(await sb.from("campaigns").delete().eq("id", id)); },
      /* 회비: 은행 거래내역 올리기 · 고치기 · 설정 */
      ownerUnit: async function () { need(); var r = await sb.rpc("owner_unit"); return r.error ? null : r.data; },
      setPrivateNote: async function (key, body) { need(); must(await sb.rpc("private_note_set", { p_key: key, p_body: body || "" })); },
      cafeList: async function () { need(); return must(await sb.rpc("cafe_list")) || []; },
      cafeMark: async function (unit, state) { need(); must(await sb.rpc("cafe_mark", { p_unit: unit, p_state: state || "" })); },
      bankImport: async function (rows) { need(); return (must(await sb.rpc("bank_import", { p_rows: rows })) || [])[0] || { added: 0, skipped: 0, matched: 0 }; },
      bankTx: async function () { need(); return must(await sb.rpc("bank_tx_list", { p_limit: 3000 })) || []; },
      bankTxSet: async function (id, unit, cat, note) { need(); must(await sb.rpc("bank_tx_set", { p_id: id, p_unit: unit || "", p_category: cat || "", p_note: note || "" })); },
      bankTxDelete: async function (id) { need(); must(await sb.rpc("bank_tx_delete", { p_id: id })); },
      duesUnits: async function () { need(); return must(await sb.rpc("dues_units")) || []; },
      duesConfigSet: async function (c) {
        need();
        must(await sb.rpc("dues_config_set", { p_bank: c.bank || "", p_account: c.account || "", p_holder: c.holder || "", p_tiers: c.tiers || [] }));
      }
    },
    errorText: kor
  };
  window.API = API;
})();
