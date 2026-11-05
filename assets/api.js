/* 서버(Supabase) 연동. 설정이 없으면 API.enabled = false 로 안내 사이트만 동작 */
(function () {
  "use strict";
  var CFG = window.S4_CONFIG || {};
  var enabled = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var sb = enabled ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "s4-auth" }
  }) : null;
  var FORM_VERSION = "2026-11-v1";
  var st = { session: null, profile: null };

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
    var r = await sb.from("profiles").select("*").eq("id", uid()).maybeSingle();
    st.profile = r.error ? null : r.data;
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

  var API = {
    enabled: enabled,
    formVersion: FORM_VERSION,
    get session() { return st.session; },
    get profile() { return st.profile; },
    get loggedIn() { return !!st.session; },
    get isMember() { return !!(st.profile && st.profile.status === "approved"); },
    get isAdmin() { return !!(st.profile && st.profile.status === "approved" && st.profile.is_admin); },
    validUnit: validUnit,

    init: async function () {
      if (!enabled) return st;
      try {
        var r = await sb.auth.getSession();
        st.session = r.data && r.data.session;
        if (st.session) await loadProfile();
      } catch (e) { st.session = null; st.profile = null; }
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

    /* 가입: 세대로 계정 → 계약서 업로드 → 회원 정보(대기) */
    signUp: async function (o) {
      need();
      if (!validUnit(o.unit)) throw new Error("동과 호수를 고르세요.");
      if (!o.password || o.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
      if (o.password !== o.password2) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      checkFile(o.file);
      if (!o.privacy) throw new Error("개인정보 수집 · 이용에 동의해야 가입할 수 있습니다.");
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
      await loadProfile(); return st.profile;
    },
    /* 반려 후 계약서 다시 내기 */
    reapply: async function (o) {
      need();
      var path = await uploadContract(o.file);
      must(await sb.from("profiles").update({ contract_path: path, status: "pending" }).eq("id", uid()));
      await loadProfile(); return st.profile;
    },
    /* 게시판 표시 이름 (비우면 "403동 입주예정자") */
    updateNickname: async function (nick) {
      need(); nick = (nick || "").trim();
      if (nick && (nick.length < 2 || nick.length > 20)) throw new Error("닉네임은 2~20자로 입력하세요. 비워 두면 \"동 입주예정자\"로 표시됩니다.");
      must(await sb.from("profiles").update({ nickname: nick || null }).eq("id", uid())); await loadProfile();
    },
    changePassword: async function (pw, pw2) {
      need(); if (!pw || pw.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
      if (pw !== pw2) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      must(await sb.auth.updateUser({ password: pw }));
    },

    /* 위임동의 */
    myAgreement: async function () {
      need(); if (!API.isMember) return null;
      return must(await sb.from("agreements").select("*").eq("user_id", uid()).maybeSingle());
    },
    submitAgreement: async function (o) {
      need();
      if (!API.isMember) throw new Error("승인된 회원만 위임동의서를 낼 수 있습니다.");
      if (!o.signer || o.signer.trim().length < 2) throw new Error("계약자 성명을 입력하세요.");
      if (!o.delegation || !o.privacy || !o.identity) throw new Error("필수 항목에 모두 동의해야 제출할 수 있습니다.");
      return must(await sb.from("agreements").insert({ signer_name: o.signer.trim(), agree_delegation: true, agree_privacy: true, agree_identity: true, agree_third_party: !!o.thirdParty, form_version: FORM_VERSION }).select().single());
    },
    withdrawAgreement: async function () { need(); must(await sb.from("agreements").delete().eq("user_id", uid())); },
    stats: async function () { need(); return must(await sb.rpc("agreement_stats")); },
    agreedUnits: async function () { need(); if (!API.isMember && !API.isAdmin) return []; return must(await sb.rpc("agreed_units")); },

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
      deleteCampaign: async function (id) { need(); must(await sb.from("campaigns").delete().eq("id", id)); }
    },
    errorText: kor
  };
  window.API = API;
})();
