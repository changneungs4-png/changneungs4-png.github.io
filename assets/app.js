(function () {
  "use strict";
  var S = window.SITE;
  var main = document.getElementById("main");
  if (!S || !main) return;
  var page = main.dataset.page;
  var API = window.API || { enabled: false };
  var LIVE = API.enabled;
  async function boot() {
  /* 필요한 자료를 처음부터 한꺼번에 요청 (차례로 기다리지 않게) */
  var wantLH = ["home", "progress"].indexOf(page) >= 0 && location.protocol !== "file:";
  var P_LHP = wantLH ? fetch("assets/lh-progress.json?h=" + Math.floor(Date.now() / 600000)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
  var wantStats = LIVE && ["home", "association"].indexOf(page) >= 0;
  var P_STATS = wantStats ? Promise.all([API.stats().catch(function () { return null; }), API.memberStats().catch(function () { return null; })]) : Promise.resolve([null, null]);
  var P_NEWS = LIVE && page === "home" ? API.news(null, 30).catch(function () { return []; }) : null;
  if (LIVE) { try { await API.init(); } catch (e) {} }

  /* ── helpers ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(x) { return Number(x || 0).toLocaleString("ko-KR"); }
  function el(id) { return document.getElementById(id); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function eok(won) {
    var man = Math.round((won || 0) / 10000);
    if (man >= 10000) { var e = Math.floor(man / 10000), r = man % 10000; return e + "억" + (r ? " " + n(r) + "만" : "") + "원"; }
    return n(man) + "만원";
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function safeUrl(u) { return /^(https?:)?\/\//i.test(u) || /^[\w\-./#]+$/.test(u) ? u : "#"; }
  function empty(title, desc) { return '<div class="empty"><b>' + esc(title) + "</b>" + (desc ? "<span>" + esc(desc) + "</span>" : "") + "</div>"; }
  function head(title, right) { return '<div class="sec-head"><h2>' + title + "</h2>" + (right || "") + "</div>"; }
  function more(href, label) { return '<a class="more" href="' + href + '">' + (label || "더보기") + " →</a>"; }
  function tagClass(cat) { return cat === "필독" || cat === "진행" ? "tag hot" : cat === "예정" ? "tag off" : "tag"; }
  function pct(a, b) { return b ? a / b * 100 : 0; }

  /* ── 배치표 → 세대 목록 ── */
  var UNITS = [], UNIT = {};
  arr(S.layout).forEach(function (d) {
    arr(d.lines).forEach(function (l, li) {
      for (var f = l[1]; f <= l[2]; f++) {
        var u = { id: d.dong + "-" + (f * 100 + li + 1), dong: d.dong, ho: f * 100 + li + 1, floor: f, line: li + 1, type: l[0] };
        UNITS.push(u); UNIT[u.id] = u;
      }
    });
  });
  function siteAgreed() { var o = {}; arr(S.agreedUnits).forEach(function (id) { if (UNIT[id]) o[id] = 1; }); return o; }
  var AGREED = siteAgreed();
  var T = S.totalUnits || UNITS.length, NEED = Math.floor(T / 2) + 1;
  var LIVE_AGREED = null, LIVE_MEMBERS = null;
  function agreedCount() { return LIVE_AGREED != null ? LIVE_AGREED : Object.keys(AGREED).length; }

  /* ── 메뉴 ── */
  var GROUPS = [
    { name: "소식", items: [["notice.html", "공지사항", "notice", "협의회 · LH 안내"], ["schedule.html", "주요일정", "schedule", "청약부터 입주까지"], ["news.html", "언론보도", "news", "S-4 관련 기사"]] },
    { name: "우리 단지", items: [["floorplan.html", "단지 · 평면", "floorplan", "7개 타입과 단지 개요"], ["progress.html", "공사현황", "progress", "공정률과 현장 기록"], ["gallery.html", "사진관", "gallery", "현장과 주변 모습"]] },
    { name: "협의회", items: [["association.html", "협의회 소개", "association", "인사말 · 조직 · 회칙 · 회계"], ["agreement.html", "위임동의", "agreement", "현황판 · 동의서 제출"], ["participate.html", "민원 · 투표", "participate", "함께 내는 목소리"]] },
    { name: "커뮤니티", items: [["board.html", "자유게시판", "board", "입주예정자 이야기"], ["links.html", "카페 · 바로가기", "links", "가입 · 인증 안내"]] },
    { name: "입주 준비", items: [["calculator.html", "납부 · 취득세 계산기", "calculator", "회차별 금액"], ["checklist.html", "사전점검", "checklist", "공간별 체크리스트"], ["documents.html", "자료실", "documents", "공고문 · 정리 자료"], ["faq.html", "자주 묻는 질문", "faq", "FAQ"]] }
  ];
  var NAVKEY = { bylaws: "association", consent: "agreement" }[page] || page;
  var myGroup = GROUPS.filter(function (g) { return g.items.some(function (x) { return x[2] === NAVKEY; }); })[0];
  var HEAD = {
    login: ["MEMBERS", "로그인 · 회원가입", "입주예정자 인증을 거친 회원만 위임동의, 게시판, 투표에 참여할 수 있습니다."],
    account: ["MY PAGE", "내 정보", "가입 상태와 위임동의 내역을 확인합니다."],
    consent: ["CONSENT", "위임동의서", "공급계약을 마친 계약자가 제출합니다."],
    privacy: ["PRIVACY", "개인정보처리방침", "협의회가 어떤 정보를 왜 받고, 언제 지우는지 안내합니다."],
    admin: ["ADMIN", "운영진", "가입 승인부터 위임동의 · 회비 · 투표 · 민원 · 자료 수집까지 관리합니다."],
    notice: ["NOTICE", "공지사항", "협의회와 LH의 안내입니다."],
    schedule: ["SCHEDULE", "주요 일정", "청약부터 입주까지의 흐름입니다."],
    news: ["MEDIA", "언론보도", "S-4블록 · 창릉신도시 · 교통(고양은평선 · GTX 창릉역) 관련 기사입니다."],
    floorplan: ["FLOOR PLAN", "단지 · 평면", "7개 주택형의 공급 정보와 단지 개요입니다. 평면도 원본은 모집공고 첨부를 확인하세요."],
    progress: ["CONSTRUCTION", "공사현황", "공정률과 현장 방문 기록입니다."],
    gallery: ["PHOTO", "우리 단지 사진관", "현장과 주변 모습입니다."],
    bylaws: ["BYLAWS", "회칙", "협의회가 어떻게 운영되는지 회원 모두가 함께 정한 약속입니다."],
    association: ["ASSOCIATION", "협의회 소개", "입주예정자의 의견을 모아 LH와 관계 기관에 전달하는 자발적 모임입니다."],
    agreement: ["AGREEMENT BOARD", "위임동의 현황판", "동·호수별 위임동의 현황입니다."],
    participate: ["PARTICIPATE", "단체민원 · 투표", "여러 세대가 함께 낸 목소리는 더 무겁습니다."],
    board: ["COMMUNITY", "자유게시판", "입주예정자끼리 정보와 이야기를 나눕니다."],
    links: ["LINKS", "카페 · 바로가기", "공식 카페와 자주 쓰는 기관 사이트입니다."],
    calculator: ["CALCULATOR", "분양대금 · 취득세 계산기", "분양가와 옵션 금액을 넣으면 회차별 납부액과 예상 취득세를 계산합니다."],
    checklist: ["PRE-INSPECTION", "사전점검 체크리스트", "사전점검 날 공간별로 확인할 항목입니다. 체크한 내용은 이 기기에만 저장됩니다."],
    documents: ["ARCHIVE", "자료실", "공고문 원문과 협의회가 정리한 자료입니다."],
    faq: ["FAQ", "자주 묻는 질문", "협의회, 계약, 대출, 입주에 관한 질문입니다."]
  };

  /* ── header ── */
  function cur(x) { return x[2] === NAVKEY ? ' aria-current="page"' : ""; }
  var header = document.createElement("header");
  header.className = "top";
  header.innerHTML =
    '<div class="wrap bar"><a class="brand" href="index.html" aria-label="' + esc(S.name) + ' 홈"><span class="seal" aria-hidden="true">창릉<br>S4</span><span class="brand-name"><b>창릉 S-4</b><span>입주예정자협의회</span></span></a>' +
    '<nav class="gnb" aria-label="주 메뉴">' + GROUPS.map(function (g, gi) {
      return '<div class="grp"><button type="button" aria-expanded="false" aria-controls="gp' + gi + '"' + (g === myGroup ? ' aria-current="true"' : "") + ">" + g.name + '</button><div class="panel" id="gp' + gi + '">' +
        g.items.map(function (x) { return '<a href="' + x[0] + '"' + cur(x) + ">" + x[1] + "<small>" + x[3] + "</small></a>"; }).join("") + "</div></div>";
    }).join("") + "</nav>" +
    (!LIVE ? '<a class="acct" id="acctLink" href="login.html">로그인</a>' : "") +
    (LIVE ? '<a class="acct" id="acctLink" href="' + (API.loggedIn ? "account.html" : "login.html") + '">' + (API.loggedIn ? (API.profile ? esc(API.profile.unit_id) + (API.isDelegate ? "" : API.profile.status === "pending" ? " · 승인 대기" : API.profile.status === "rejected" ? " · 반려" : " · 위임 전") : "가입 마무리") : "로그인") + "</a>" : "") +
    '<a class="btn solid head-cta" href="' + (LIVE && !API.loggedIn ? "login.html#signup" : "agreement.html") + '">' + (LIVE && !API.loggedIn ? "회원가입" : "위임동의 현황") + "</a>" +
    '<button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="drawer">메뉴</button></div>' +
    '<nav class="wrap drawer" id="drawer" aria-label="전체 메뉴" hidden>' + (!LIVE ? '<a class="btn solid" href="login.html" style="justify-content:center">로그인 · 회원가입</a>' : "") + (LIVE ? '<a class="btn' + (API.loggedIn ? "" : " solid") + '" href="' + (API.loggedIn ? "account.html" : "login.html") + '" style="justify-content:center">' + (API.loggedIn ? "내 정보" : "로그인 · 회원가입") + "</a>" : "") + GROUPS.map(function (g) {
      return "<div><h4>" + g.name + '</h4><div class="dl">' + g.items.map(function (x) { return '<a href="' + x[0] + '"' + cur(x) + ">" + x[1] + "</a>"; }).join("") + "</div></div>";
    }).join("") + "</nav>";
  document.body.insertBefore(header, document.body.firstChild);
  el("menuBtn").addEventListener("click", function () {
    var d = el("drawer"); d.hidden = !d.hidden;
    this.setAttribute("aria-expanded", d.hidden ? "false" : "true");
    this.textContent = d.hidden ? "메뉴" : "닫기";
  });
  var grps = header.querySelectorAll(".grp");
  function closeAll() { grps.forEach(function (o) { o.classList.remove("open"); o.querySelector("button").setAttribute("aria-expanded", "false"); }); }
  grps.forEach(function (g) {
    g.querySelector("button").addEventListener("click", function () {
      var open = !g.classList.contains("open"); closeAll();
      if (open) { g.classList.add("open"); this.setAttribute("aria-expanded", "true"); }
    });
    /* 다른 메뉴로 마우스를 옮기면 앞서 눌러 둔 메뉴는 닫음 (겹쳐 보이지 않게) */
    g.addEventListener("mouseenter", function () {
      grps.forEach(function (o) {
        if (o === g) return;
        o.classList.remove("open"); o.querySelector("button").setAttribute("aria-expanded", "false");
        var a = document.activeElement; if (a && o.contains(a)) a.blur();
      });
    });
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".grp")) closeAll(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var a = document.activeElement; if (a && a.closest && a.closest(".grp")) a.blur(); closeAll(); } });

  /* ── 운영진 알림: 승인 대기 가입 신청 ── */
  if (LIVE && API.isAdmin && page !== "admin") {
    Promise.all([API.admin.profiles("pending").catch(function () { return []; }), API.admin.withdrawals().catch(function () { return []; })]).then(function (r) {
      var L = r[0] || [], W = r[1] || [], n2 = L.length + W.length;
      if (!n2) return;
      var parts = [];
      if (L.length) parts.push('가입 신청 ' + L.length + '건이 승인을 기다리고 있습니다. <a href="admin.html#pending">확인하기 →</a>');
      if (W.length) parts.push('<b class="wd">위임동의 철회 ' + W.length + '건</b>(' + W.slice(0, 3).map(function (w) { return esc(w.unit_id); }).join(", ") + (W.length > 3 ? " 외" : "") + ') <a href="admin.html#agreements">확인하기 →</a>');
      var ab = document.createElement("div");
      ab.className = "banner admin-alert";
      ab.setAttribute("role", "status");
      ab.innerHTML = '<div class="wrap"><span><b>운영진 알림</b> · ' + parts.join(" · ") + "</span></div>";
      header.after(ab);
      document.title = "(" + n2 + ") " + document.title;
      var al = el("acctLink"); if (al) al.insertAdjacentHTML("beforeend", ' <span class="dot" aria-label="운영진 알림 ' + n2 + '건">' + n2 + "</span>");
    });
  }

  /* ── banner ── */
  if (S.banner && store("hide:" + S.banner.id) !== new Date().toDateString()) {
    var bn = document.createElement("div");
    bn.className = "banner";
    bn.innerHTML = '<div class="wrap"><span>' + esc(S.banner.text) + (S.banner.link ? ' <a href="' + esc(safeUrl(S.banner.link)) + '">' + esc(S.banner.linkText || "자세히") + " →</a>" : "") + '</span><button type="button" id="bnClose" aria-label="오늘 하루 보지 않기"><span class="lg">오늘 하루 보지 않기</span><span class="sm" aria-hidden="true">×</span></button></div>';
    header.after(bn);
    el("bnClose").addEventListener("click", function () { store("hide:" + S.banner.id, new Date().toDateString()); bn.remove(); });
  }

  /* ── footer ── */
  var foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML = '<div class="wrap sitemap">' + GROUPS.map(function (g) { return "<div><b>" + g.name + "</b>" + g.items.map(function (x) { return '<a href="' + x[0] + '">' + x[1] + "</a>"; }).join("") + "</div>"; }).join("") + "</div>" +
    '<div class="wrap"><span>' + esc(S.name) + " · 최종 갱신 " + esc(S.updated) + '</span><a href="privacy.html">개인정보처리방침</a><button type="button" class="linkbtn" id="shareBtn">사이트 주소 복사</button><span>입주예정자가 자발적으로 운영하는 사이트이며 LH의 공식 사이트가 아닙니다.</span></div>';
  document.body.appendChild(foot);
  el("shareBtn").addEventListener("click", function () {
    var btn = this, url = location.href.split("#")[0];
    var fail = function () { btn.textContent = url; btn.classList.add("sel"); };
    try { navigator.clipboard.writeText(url).then(function () { btn.textContent = "주소를 복사했습니다"; }, fail); } catch (e) { fail(); }
  });


  /* 페이지별 선 그림 (장식) — 페이지 성격을 한눈에 */
  var ART = (function () {
    var P = function (d) { return '<path d="' + d + '"/>'; }, R = function (x, y, w, h, r) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (r ? ' rx="' + r + '"' : "") + "/>"; }, Cc = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; };
    var grid = function (x0, y0, cols, rows, w, h, gap, on) { var o = ""; for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var k = r * cols + c; o += '<rect x="' + (x0 + c * (w + gap)) + '" y="' + (y0 + r * (h + gap)) + '" width="' + w + '" height="' + h + '" rx="1.5"' + (on && on.indexOf(k) >= 0 ? ' class="f"' : "") + "/>"; } return o; };
    return {
      notice: P("M40 70 L120 40 L120 130 L40 100 Z") + R(22, 70, 18, 30, 3) + P("M60 104 L70 140 L86 140 L78 110") + P("M140 60 Q160 85 140 110") + P("M156 48 Q186 85 156 122"),
      schedule: R(30, 30, 180, 120, 8) + P("M30 58 H210") + P("M70 20 V40 M170 20 V40") + grid(44, 70, 7, 3, 16, 16, 8, [3, 9, 16]),
      news: R(30, 26, 150, 124, 4) + P("M46 46 H164 M46 60 H164") + R(46, 74, 56, 40, 2) + P("M112 78 H164 M112 90 H164 M112 102 H150 M46 126 H164 M46 138 H130") + P("M180 50 H206 V140 Q206 150 196 150 H180"),
      floorplan: R(24, 24, 192, 132, 2) + P("M24 92 H96 V156 M96 92 V24 M96 70 H150 V24 M150 70 V112 H216 M150 112 V156") + P("M96 120 Q116 120 116 140") + P("M150 40 Q166 40 166 56"),
      progress: P("M30 150 H220") + R(60, 70, 50, 80) + R(116, 96, 44, 54) + grid(68, 78, 3, 5, 10, 8, 6) + P("M180 150 V22 M168 22 H228 M180 34 L210 22 M222 22 V60") + R(214, 60, 16, 12, 2) + P("M160 96 V60 L200 60"),
      gallery: R(30, 34, 180, 116, 8) + P("M30 128 L84 84 L118 112 L150 86 L210 130") + Cc(170, 62, 12),
      association: Cc(80, 66, 18) + P("M48 140 Q48 98 80 98 Q112 98 112 140") + Cc(150, 58, 22) + P("M112 140 Q112 92 150 92 Q188 92 188 140") + Cc(196, 78, 14) + P("M176 140 Q178 108 196 108 Q216 108 218 140"),
      bylaws: R(58, 18, 124, 152, 4) + P("M78 44 H162 M78 60 H162 M78 76 H146 M78 100 H162 M78 116 H138") + Cc(150, 144, 14) + P("M143 144 L148 149 L158 138"),
      consent: R(50, 20, 130, 150, 6) + P("M70 46 H160 M70 62 H160 M70 78 H140 M70 94 H160") + P("M72 134 Q86 112 96 132 T120 128 Q132 120 150 134") + P("M168 150 L210 108 L222 120 L180 162 L164 166 Z"),
      agreement: grid(30, 26, 8, 5, 18, 18, 5, [1, 2, 5, 9, 10, 12, 13, 18, 20, 21, 22, 27, 29, 33, 34, 36, 38]),
      participate: R(60, 80, 120, 80, 6) + P("M60 104 H180") + R(100, 20, 44, 66, 3) + P("M110 44 L118 52 L134 34") + P("M96 92 H148"),
      board: R(24, 30, 120, 70, 14) + P("M50 100 L44 124 L72 100") + R(100, 84, 120, 64, 14) + P("M190 148 L198 168 L172 148") + P("M46 56 H120 M46 74 H100 M122 108 H196 M122 124 H176"),
      links: R(36, 70, 80, 40, 20) + R(124, 70, 80, 40, 20) + P("M96 90 H144"),
      calculator: R(60, 20, 120, 150, 10) + R(78, 38, 84, 30, 4) + grid(78, 82, 4, 4, 15, 14, 8, [15]),
      checklist: R(40, 30, 22, 22, 4) + R(40, 76, 22, 22, 4) + R(40, 122, 22, 22, 4) + P("M45 41 L50 47 L58 36 M45 87 L50 93 L58 82") + P("M80 41 H200 M80 87 H180 M80 133 H160"),
      documents: P("M30 50 H90 L104 64 H210 V150 H30 Z") + P("M30 76 H210") + R(60, 30, 120, 30, 3),
      faq: Cc(90, 84, 46) + P("M76 72 Q76 56 92 56 Q108 56 108 70 Q108 82 92 88 V98") + Cc(92, 112, 2.5) + Cc(176, 64, 24) + P("M168 58 Q168 50 176 50 Q184 50 184 58 Q184 64 176 68 V74") + Cc(176, 82, 1.5),
      login: R(70, 76, 100, 80, 10) + P("M90 76 V56 Q90 30 120 30 Q150 30 150 56 V76") + Cc(120, 110, 8) + P("M120 118 V134"),
      account: Cc(120, 66, 28) + P("M64 160 Q64 108 120 108 Q176 108 176 160"),
      privacy: P("M120 22 L186 46 V92 Q186 140 120 164 Q54 140 54 92 V46 Z") + P("M96 92 L114 110 L148 74"),
      admin: Cc(120, 90, 26) + P("M120 30 V48 M120 132 V150 M60 90 H78 M162 90 H180 M78 48 L91 61 M149 119 L162 132 M78 132 L91 119 M149 61 L162 48"),
      links_: ""
    };
  })();
  /* ── page head ── */
  if (HEAD[page]) {
    var h = HEAD[page], ph = document.createElement("section");
    var sub = myGroup && myGroup.items.length > 1 ? '<nav class="subnav" aria-label="' + myGroup.name + ' 메뉴">' + myGroup.items.map(function (x) { return '<a href="' + x[0] + '"' + cur(x) + ">" + x[1] + "</a>"; }).join("") + "</nav>" : "";
    var gi = myGroup ? GROUPS.indexOf(myGroup) : -1;
    ph.className = "page-head" + (sub ? "" : " solo") + " g" + (gi < 0 ? "x" : gi);
    ph.innerHTML = '<div class="wrap"><div class="eyebrow">' + (myGroup ? myGroup.name + " · " : "") + h[0] + "</div><h1>" + h[1] + "</h1><p>" + h[2] + "</p>" + sub + "</div>" +
      (ART[page] ? '<svg class="head-art" viewBox="0 0 240 180" aria-hidden="true" focusable="false">' + ART[page] + "</svg>" : "");
    main.insertBefore(ph, main.firstChild);
    var sn = ph.querySelector(".subnav"), act = sn && sn.querySelector('[aria-current="page"]');
    if (act && act.offsetLeft + act.offsetWidth > sn.clientWidth) sn.scrollLeft = act.offsetLeft - 24;   // 휴대폰: 지금 페이지 메뉴가 보이게
  }
  var C = el("content");

  /* ── shared pieces ── */
  function chips(id, cats, label) {
    return '<div class="chips" id="' + id + '" role="group" aria-label="' + label + '">' +
      ["전체"].concat(cats).map(function (c, i) { return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (i === 0) + '">' + esc(c) + "</button>"; }).join("") + "</div>";
  }
  function bindChips(id, onPick) {
    var box = el(id); if (!box) return;
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      box.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      onPick(b.dataset.cat);
    });
  }
  function filterBy(listId, sel) { return function (c) { el(listId).querySelectorAll(sel).forEach(function (d) { d.hidden = c !== "전체" && d.dataset.cat !== c; }); }; }

  function noticeRows(list) {
    if (!list.length) return empty("아직 공지가 없습니다", "");
    return '<ul class="list">' + list.map(function (x) {
      return '<li><span class="' + tagClass(x.cat) + '">' + esc(x.cat) + '</span><span class="t"><a href="notice.html#' + esc(x.id) + '">' + esc(x.title) + '</a></span><span class="d num">' + esc(String(x.date).slice(5)) + "</span></li>";
    }).join("") + "</ul>";
  }
  function timeline(list) {
    if (!list.length) return empty("등록된 일정이 없습니다", "");
    return '<ol class="tl">' + list.map(function (x) {
      return '<li class="' + esc(x.state || "") + '"><span class="when">' + esc(x.when) + '</span><span class="dot"></span><span class="what"><b>' + esc(x.title) + ("") + "</b>" + (x.desc ? "<span>" + (x.auto && x.src ? '<a href="' + esc(safeUrl(x.src)) + '" target="_blank" rel="noopener">' + esc(x.desc) + "</a>" : esc(x.desc)) + "</span>" : "") + "</span></li>";
    }).join("") + "</ol>";
  }
  function memberLine(a, m) { return m != null ? '<small class="members">가입 ' + n(m) + "세대 · 위임 전 " + n(Math.max(0, m - a)) + "세대</small>" : ""; }
  function membersMeter() {
    if (LIVE_MEMBERS == null) return "";
    var m = LIVE_MEMBERS, a = agreedCount(), p = pct(m, T);
    return '<div class="meter"><div class="row"><span>가입 세대</span><b class="num">' + n(m) + ' <small class="muted">/ ' + n(T) + "</small></b></div>" +
      '<div class="bar-track member"><i style="width:' + Math.min(100, p).toFixed(1) + '%"></i></div>' +
      "<small>위임 완료 " + n(Math.min(a, m)) + "세대 · 가입만 " + n(Math.max(0, m - a)) + "세대</small></div>";
  }
  function agreeMeter(compact) {
    var a = agreedCount(), p = pct(a, T);
    return '<div class="meter"><div class="row"><span>위임동의 세대</span><b class="num">' + n(a) + ' <small class="muted">/ ' + n(T) + "</small></b></div>" +
      '<div class="bar-track"><i style="width:' + p.toFixed(1) + '%"></i><span class="goal" style="left:' + pct(NEED, T).toFixed(1) + '%"></span></div>' +
      "<small>" + (a ? "목표 과반(" + n(NEED) + "세대)까지 " + n(Math.max(0, NEED - a)) + "세대" + (S.agreementAsOf ? " · " + esc(S.agreementAsOf) + " 기준" : "") : (compact ? "위임동의 접수 전입니다" : "위임동의 접수 전입니다. 세로선이 목표인 과반(" + n(NEED) + "세대)입니다.")) + "</small></div>";
  }
  function progressMeter() {
    var p = S.progress || {};
    if (p.overall == null) return '<div class="meter"><div class="row"><span>전체 공정률</span><b class="num">—</b></div><div class="bar-track water"><i style="width:0%"></i></div></div>';
    return '<div class="meter"><div class="row"><span>전체 공정률</span><b class="num">' + p.overall + '%</b></div><div class="bar-track water"><i style="width:' + Math.min(100, p.overall) + '%"></i></div><small>' + esc(p.asOf) + "</small></div>";
  }
  function phaseList() {
    var ph = arr((S.progress || {}).phases);
    if (!ph.length) return "";
    return '<ul class="list">' + ph.map(function (x) { return '<li><span class="' + tagClass(x.status) + '">' + esc(x.status) + '</span><span class="t">' + esc(x.name) + '</span><span class="d"></span></li>'; }).join("") + "</ul>";
  }
  function areaBars() {
    var A = arr(S.areas), max = Math.max.apply(null, A.map(function (a) { return a.units; }).concat([1]));
    return '<div class="types">' + A.map(function (a) {
      return '<div class="type"><span class="lab">' + esc(a.area) + '</span><span class="track"><i style="width:' + pct(a.units, max).toFixed(1) + '%"></i></span><span class="v">' + n(a.units) + "</span></div>";
    }).join("") + "</div>";
  }
  function tile(x) {
    var inner = "<b>" + esc(x.title) + "</b><span>" + esc(x.desc) + (x.url ? "" : " · 개설 후 연결") + "</span>";
    if (x.url && x.url.charAt(0) === "#") return '<a class="tile" href="' + esc(x.url) + '">' + inner + "</a>";   // 같은 페이지 안
    return x.url ? '<a class="tile" href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + inner + "</a>" : '<div class="tile pending">' + inner + "</div>";
  }
  function newsRows(list) {
    if (!list.length) return empty("등록된 기사가 없습니다", "");
    return '<ul class="list news">' + list.map(function (x) {
      return '<li><span class="src">' + esc(x.src) + '<br><span class="num">' + esc(x.date) + '</span></span><span class="t"><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a><p>" + esc(x.desc) + "</p></span></li>";
    }).join("") + "</ul>";
  }
  function complexTable(rows) { return '<div class="tablebox"><table class="spec kv">' + rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table></div>"; }
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var d = document.getElementById(id);
    if (d && d.tagName === "DETAILS") { d.open = true; setTimeout(function () { d.scrollIntoView({ block: "center" }); }, 0); }
  }

  /* ── pages ── */
  var R = {};

  R.home = async function () {
    var dd = "", ddl = "입주 예정 " + esc(S.moveInText || "");
    if (S.moveInDate) {
      var diff = Math.ceil((new Date(S.moveInDate + "T00:00:00+09:00") - new Date()) / 86400000);
      dd = diff > 0 ? "D-" + n(diff) : "입주"; ddl = esc(S.moveInText || S.moveInDate) + " 입주 예정";
    }
    var ridge = '<svg class="ridge" viewBox="0 0 1200 170" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="r1" d="M0 92 Q120 30 260 74 Q380 112 500 66 Q640 14 780 64 Q900 104 1020 58 Q1110 26 1200 48 V170 H0Z"/>' +
      '<path class="r2" d="M0 122 Q160 70 330 108 Q470 138 610 100 Q760 62 900 104 Q1040 140 1200 96 V170 H0Z"/>' +
      '<path class="r3" d="M0 148 Q220 112 440 140 Q640 164 840 136 Q1020 114 1200 136 V170 H0Z"/>' +
      '<path class="w" d="M-10 160 Q60 152 130 160 T270 160 T410 160 T550 160 T690 160 T830 160 T970 160 T1110 160 T1250 160"/></svg>';
    var upcoming = (await mergedSchedule()).filter(function (x) { return x.state !== "done"; }).slice(0, 4);
    main.innerHTML =
      '<section class="hero"><div class="wrap hero-grid"><div>' +
      '<div class="eyebrow">고양창릉 공공주택지구 · LH 공공분양</div>' +
      "<h1>창릉 S-4<small>입주예정자협의회</small></h1>" +
      '<p class="lead">창릉천 물길과 서오릉 숲 사이, ' + n(T) + '세대가 함께 만들어갈 새 동네입니다. 공지와 일정, 공사 진행과 위임동의 현황을 이곳에서 확인하세요.</p>' +
      '<div class="cta-row">' + (LIVE ? (API.loggedIn ? '<a class="btn solid" href="account.html">내 정보 · 위임동의</a>' : '<a class="btn solid" href="login.html#signup">회원가입</a>') : '<a class="btn solid" href="links.html">공식 카페 가입 · 인증</a>') + '<a class="btn" href="notice.html">공지사항 보기</a></div></div>' +
      '<aside class="status" aria-label="단지 현황"><div class="top"><div><b class="num">' + dd + "</b></div><span>" + ddl + "<br>16개 동 · " + n(T) + "세대</span></div>" +
      agreeMeter(true) + membersMeter() + progressMeter() +
      '<a class="go" href="agreement.html">동·호수별 현황판 보기 →</a></aside>' +
      "</div>" + ridge + "</section>" +

      '<section class="band" id="homeDues" hidden><div class="wrap"></div></section>' +
      '<section class="band"><div class="wrap two"><div>' + head("공지사항", more("notice.html")) + noticeRows(arr(S.notices).slice(0, 5)) + "</div>" +
      "<div>" + head("다가오는 일정", more("schedule.html", "전체 일정")) + timeline(upcoming) + "</div></div></section>" +

      '<div id="homeNews"></div>' +
      '<section class="band first"><div class="wrap">' + head("처음 오셨나요?") +
      '<ol class="steps steps-row">' +
      (LIVE ? '<li><div><b><a href="login.html#signup">공급계약 후 회원가입</a></b><span>' + esc(consentOpenLabel()) + ' 계약이 시작되면 동·호수를 고르고 계약서 사진을 올려 가입합니다. 승인되면 게시판을 쓸 수 있습니다.</span></div></li>' +
        '<li><div><b><a href="consent.html">위임동의서</a></b><span>가입 뒤 계약자 성명과 서명으로 위임장을 냅니다. 승인 대기 중에도 낼 수 있습니다.</span></div></li>' +
        '<li><div><b><a href="participate.html">투표 · 민원 참여</a></b><span>위임 세대는 협의회 투표와 단체민원에 참여하고 세대별 현황을 볼 수 있습니다.</span></div></li>'
      : "<li><div><b>공식 카페 가입</b><span>카페 · 바로가기 메뉴에서 카페에 가입합니다.</span></div></li>" +
        "<li><div><b>계약자 인증 · 등업</b><span>동·호수와 이름만 보이게 가린 계약서를 올립니다.</span></div></li>" +
        "<li><div><b>위임동의서 제출</b><span>선택 사항입니다. 모일수록 협상력이 커집니다.</span></div></li>") +
      "</ol></div></section>" +

      '<section class="band"><div class="wrap">' + head("자주 찾는 메뉴") + '<div class="shortcuts">' +
      '<a class="shortcut" href="calculator.html"><span class="k">CALC</span><b>납부 계산기</b><span>회차별 금액과 예상 취득세</span></a>' +
      '<a class="shortcut" href="floorplan.html"><span class="k">59 · 74 · 84</span><b>단지 · 평면</b><span>7개 타입 공급 정보</span></a>' +
      '<a class="shortcut" href="agreement.html"><span class="k">' + arr(S.layout).length + '개 동</span><b>위임동의 현황판</b><span>동·호수별로 한눈에</span></a>' +
      '<a class="shortcut" href="checklist.html"><span class="k">' + arr(S.checklist).reduce(function (s, g) { return s + arr(g.items).length; }, 0) + '항목</span><b>사전점검</b><span>공간별 체크리스트</span></a>' +
      "</div></div></section>";
    if (LIVE && API.isMember) Promise.all([API.duesMine(), API.duesPublic()]).then(function (r) {
      var m = r[0], d = r[1]; if (!m || (m.paid > 0 && m.paid >= (m.due || 1))) return;
      var h = duesCardHtml(m, d, true) || duesAdminHint(d); if (!h) return;
      var s = el("homeDues"); s.querySelector(".wrap").innerHTML = head("회비 안내") + h; s.hidden = false; bindCopy(s);
    }).catch(function () {});
  };

  async function homeNews() {
    if (!LIVE || page !== "home") return;
    try {
      var L = clusterNews(await (P_NEWS || API.news(null, 30))).slice(0, 4); if (!L.length) return;
      el("homeNews").innerHTML = '<section class="band"><div class="wrap">' + head("새 소식", more("news.html", "전체 기사") ) + autoRows(L) + "</div></section>";
    } catch (e) {}
  }
  R.notice = async function () {
    var L = arr(S.notices), lh = await lhItems();
    var lhBlock = LIVE ? "<div>" + head("LH 공고") + (lh.length ? lhPanel(lh) : empty("아직 LH 공고가 없습니다", "")) + "</div>" : "";
    if (!L.length) { C.innerHTML = empty("아직 공지가 없습니다", "새 공지가 올라오면 이곳에 표시됩니다.") + lhBlock; return; }
    var cats = uniq(L.map(function (x) { return x.cat; }));
    C.innerHTML = "<div>" + '<div class="toolbar">' + chips("nCats", cats, "분류") + '<span class="muted small">총 ' + L.length + "건</span></div>" +
      '<div class="rows" id="nList">' + L.map(function (x) {
        return '<details class="row" id="' + esc(x.id) + '" data-cat="' + esc(x.cat) + '"><summary><span class="' + tagClass(x.cat) + '">' + esc(x.cat) + '</span><span class="t">' + esc(x.title) + '</span><span class="d num">' + esc(x.date) + '</span></summary><p class="body">' + esc(x.body) + "</p></details>";
      }).join("") + "</div></div>" + lhBlock;
    bindChips("nCats", filterBy("nList", "details"));
    openHash();
    window.addEventListener("hashchange", openHash);
  };

  R.schedule = async function () {
    var t0 = arr(S.types)[0], lhs = "";
    if (LIVE) {
      try {
        var L = (await lhItems()).filter(function (x) { return x.extra && x.extra.s4 && arr(x.extra.tables).some(function (t) { return t.key === "dsSplScdl"; }); });
        if (L.length) lhs = "<div>" + head("LH 공식 일정 (S-4)") + L.slice(0, 1).map(function (x) {
          return '<div class="lh-sched"><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener"><b>' + esc(x.title) + "</b></a>" + lhTables(x, "dsSplScdl") + "</div>";
        }).join("") + "</div>";
      } catch (e) { lhs = ""; }
    }
    var merged = await mergedSchedule(), hasAuto = merged.some(function (x) { return x.auto; });
    C.innerHTML = '<div class="two"><div>' + head("전체 일정") + timeline(merged) + "</div>" +
      "<div>" + head("분양대금 납부 구조") + '<div class="tablebox"><table class="spec"><thead><tr><th>회차</th><th class="r">비율</th><th>시기</th></tr></thead><tbody>' +
      '<tr><td>계약금</td><td class="r num">10%</td><td>계약 시 (2026.11.16–19)</td></tr>' +
      [1, 2, 3, 4, 5, 6].map(function (i) { return "<tr><td>중도금 " + i + '회</td><td class="r num">10%</td><td>공사 기간 중 (계약서 기준)</td></tr>'; }).join("") +
      '<tr><td>잔금</td><td class="r num">30%</td><td>입주지정기간</td></tr></tbody></table></div>' +
      (t0 ? '<p class="muted small">' + esc(t0.type) + " 최고가 " + eok(t0.maxPrice) + " 기준 회차당 약 " + eok(t0.maxPrice * 0.1) + '입니다. <a href="calculator.html">계산기에서 내 금액으로 보기 →</a></p>' : "") +
      "</div></div>" + lhs;
  };

  function cellText(v) {
    var t = String(v == null ? "" : v).trim(), m = t.match(/^0*(\d{2,3})\.0+([A-Z]{0,3})$/);
    if (m) return m[1] + m[2];
    if (/^20\d{6}$/.test(t)) return t.slice(0, 4) + "." + t.slice(4, 6) + "." + t.slice(6);
    return t;
  }
  var DS_NAMES = { dsEtcInfo: "기타 안내", dsSbdAhfl: "단지 첨부자료", dsSbd: "단지 정보", dsSplScdl: "공급 일정", dsCtrtPlc: "계약 장소", dsAhflInfo: "첨부파일" };
  function lhTables(x, only) {
    var ex = x.extra || {}, T = arr(ex.tables).filter(function (t) { return !only || t.key === only; });
    return T.map(function (t) {
      if (/^ds[A-Z]/.test(t.title || "")) t = Object.assign({}, t, { title: DS_NAMES[t.title] || DS_NAMES[t.key] || "기타 정보" });
      var cols = arr(t.columns), rows = arr(t.rows).map(function (r) { return arr(r).map(cellText); });
      if (cols.length <= 4) {
        return '<div class="lh-table"><h4>' + esc(t.title) + '</h4><div class="tablebox"><table class="spec"><thead><tr>' + cols.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (v) { return "<td>" + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></div>";
      }
      // 열이 많은 표: 모든 행에 같은 값은 위에 한 번만, 나머지는 행마다 카드로
      var same = cols.map(function (c, i) { return rows.length > 1 && rows.every(function (r) { return r[i] === rows[0][i]; }); });
      var common = cols.map(function (c, i) { return same[i] && rows[0][i] ? '<div><dt>' + esc(c.label) + "</dt><dd>" + esc(rows[0][i]) + "</dd></div>" : ""; }).join("");
      return '<div class="lh-table"><h4>' + esc(t.title) + "</h4>" + (common ? '<dl class="kv-common">' + common + "</dl>" : "") +
        '<div class="kvcards">' + rows.map(function (r) {
          return "<dl>" + cols.map(function (c, i) { return !same[i] && r[i] ? "<div><dt>" + esc(c.label) + "</dt><dd>" + esc(r[i]) + "</dd></div>" : ""; }).join("") + "</dl>";
        }).join("") + "</div></div>";
    }).join("");
  }
  function lhDetail(x) {
    var ex = x.extra || {}, A = arr(ex.attachments);
    if (!arr(ex.tables).length && !A.length) return "";
    return '<details class="lh-detail"><summary>공고 상세 보기 · 일정 · 공급 정보' + (A.length ? " · 첨부 " + A.length : "") + "</summary>" + lhTables(x) +
      (A.length ? '<div class="lh-table"><h4>첨부파일</h4><ul class="attach">' + A.map(function (f) { return '<li><a href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener">' + esc(f.name) + "</a>" + (f.kind ? ' <span class="muted small">' + esc(f.kind) + "</span>" : "") + "</li>"; }).join("") + "</ul></div>" : "") +
      (ex.detail_at ? '<p class="muted small">LH 공공데이터 기준 · ' + fmtTime(ex.detail_at) + " 갱신</p>" : "") + "</details>";
  }
  /* LH 공고문에서 읽은 일정 → 사이트 일정 */
  var LH_CACHE = null;
  async function lhItems() { if (!LIVE) return []; if (!LH_CACHE) { try { LH_CACHE = (await API.news("lh", 30)).filter((x) => x.extra && x.extra.s4); } catch (e) { LH_CACHE = []; } } return LH_CACHE; }
  function canon(t) { return String(t || "").replace(/\(.*?\)|\s/g, ""); }
  function todayKST() { var d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); }
  function whenOf(e) { var f = function (s) { return s.replace(/-/g, "."); }; return e.month ? f(e.start) : f(e.start) + (e.end ? "–" + (e.end.slice(0, 4) === e.start.slice(0, 4) ? f(e.end.slice(5)) : f(e.end)) : ""); }
  function stateOf(e) {
    var t = todayKST(), soon = new Date(Date.now() + 9 * 3600e3 + 14 * 864e5).toISOString().slice(0, 10), last = e.end || e.start;
    if (last.length === 7) last += "-31";
    if (last < t) return "done";
    if (e.start <= soon) return "now";
    return "";
  }
  async function parsedEvents() {
    var by = {}, L = (await lhItems()).filter(function (x) { return x.extra && x.extra.s4 && x.parsed && arr(x.parsed.events).length; });
    // 오래된 공고 → 최신 정정공고 순으로 덮어써서, 최신 공고의 날짜가 남게 함
    L.sort(function (a, b) { return String(a.published_at || "") < String(b.published_at || "") ? -1 : 1; });
    L.forEach(function (x) { arr(x.parsed.events).forEach(function (e) { by[canon(e.label)] = { when: whenOf(e), title: e.label, desc: "LH 공고문 · " + (e.file || x.title), state: stateOf(e), start: e.start, auto: true, src: x.url }; }); });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  }
  async function mergedSchedule() {
    var auto = await parsedEvents();
    if (!auto.length) return arr(S.schedule);
    // 기존 일정이 기간(7.10–19)을 갖고 있는데 공고문에서 하루만 읽혔다면 기존 일정을 유지
    auto = auto.filter(function (e) {
      if (/[–~-]/.test(String(e.when).slice(5))) return true;
      return !arr(S.schedule).some(function (s) { return canon(s.title) === canon(e.title) && /^20\d{2}.*[–~]/.test(s.when); });
    });
    var keys = auto.map(function (e) { return canon(e.title); });
    var rest = arr(S.schedule).filter(function (s) { var c = canon(s.title); return !keys.some(function (k) { return c === k || c.indexOf(k) === 0; }); });
    var autoStarts = auto.map(function (e) { return e.start; });
    var dated = rest.filter(function (s) { return /^20\d{2}/.test(s.when); }).map(function (s) { return Object.assign({ start: s.when.replace(/\./g, "-").slice(0, 10) }, s); })
      .filter(function (s) { return autoStarts.indexOf(s.start) < 0; });   // 같은 날 시작하는 일정은 공고문 쪽만 남김
    var undated = rest.filter(function (s) { return !/^20\d{2}/.test(s.when); });
    var all = dated.concat(auto).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var cut = todayKST().slice(0, 4) + "-12-31";
    return all.filter(function (x) { return x.start <= cut; }).concat(undated).concat(all.filter(function (x) { return x.start > cut; }));
  }
  function parsedBlock(x) {
    var P = x.parsed; if (!P || (!arr(P.events).length && !arr(P.facts).length)) return "";
    return '<div class="lh-parsed"><div class="eyebrow">공고문 요약</div>' +
      (arr(P.events).length ? '<div class="tablebox"><table class="spec"><thead><tr><th>일정</th><th>날짜</th><th>공고문 원문</th></tr></thead><tbody>' + P.events.map(function (e) { return "<tr><td>" + esc(e.label) + '</td><td class="num">' + esc(whenOf(e)) + '</td><td class="muted small">' + esc(e.evidence) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") +
      (arr(P.facts).length ? '<ul class="facts">' + P.facts.map(function (f) { return "<li><b>" + esc(f.label) + "</b> " + esc(f.text) + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="muted small">' + "정확한 내용은 공고문 원문을 확인하세요.</p></div>";
  }
  function keyDates(x) {
    var P = x.parsed, by = {};
    arr(P && P.events).forEach(function (e) { by[canon(e.label)] = e; });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  }
  function lhPanel(list) {
    var L = list.slice().sort(function (a, b) { return String(b.published_at || "") < String(a.published_at || "") ? -1 : 1; });
    var x = L[0], ex = x.extra || {}, K = keyDates(x), P = x.parsed || {}, today = todayKST();
    var card = '<article class="lh-card"><p class="lh-meta"><span class="tag hot">' + esc(ex.status || "LH 공고") + "</span>" +
      (x.published_at ? ' <span class="num">' + esc(fmtDate(x.published_at)) + " 공고</span>" : "") + (ex.closes ? ' <span class="muted small">· 접수 마감 ' + esc(ex.closes) + "</span>" : "") + "</p>" +
      '<h3><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.title) + " ↗</a></h3>" +
      (K.length ? '<div class="eyebrow">공고문에서 읽은 핵심 일정</div><ol class="keydates">' + K.map(function (e) {
        var last = e.end || e.start, st = last < today ? "done" : e.start <= today ? "now" : "";
        return '<li class="' + st + '"><span class="kd-d num">' + esc(whenOf(e)) + '</span><span class="kd-t">' + esc(e.label) + "</span></li>";
      }).join("") + "</ol>" : "") +
      (arr(P.facts).length ? '<details class="lh-more"><summary>주요 내용 ' + P.facts.length + "가지 (전매제한 · 거주의무 · 계약금 등)</summary>" + '<ul class="facts">' + P.facts.map(function (f) { return "<li><b>" + esc(f.label) + "</b> " + esc(f.text) + "</li>"; }).join("") + "</ul></details>" : "") +
      (K.length ? '<details class="lh-more"><summary>날짜가 나온 공고문 원문 문장 보기</summary><ul class="evid">' + K.map(function (e) { return "<li><b>" + esc(e.label) + '</b> <span class="num">' + esc(whenOf(e)) + "</span><br>" + esc(e.evidence) + "</li>"; }).join("") + "</ul></details>" : "") +
      lhDetail(x) +
      (P.parsed_at ? '<p class="muted small">' + "정확한 내용은 공고문 원문을 확인하세요.</p>" : "") + "</article>";
    var older = L.slice(1);
    return card + (older.length ? '<details class="lh-more lh-older"><summary>이전 공고 ' + older.length + "건</summary><ul>" + older.map(function (o) {
      return '<li><a href="' + esc(safeUrl(o.url)) + '" target="_blank" rel="noopener">' + esc(o.title) + '</a> <span class="muted small num">' + esc(o.published_at ? fmtDate(o.published_at) : "") + "</span></li>";
    }).join("") + "</ul></details>" : "");
  }
  /* 기사 주제: S-4 / 교통(고양은평선 · GTX 창릉역 등) / 창릉 */
  var S4_RE = /S\s*[-‐–—]?\s*4(?![0-9])/i, TRAFFIC_RE = /고양은평선|창릉역|GTX|지하철|도시철도|광역버스|교통|도로/;
  var S4_CONTEXT = /본청약|사전청약|분양가|중도금|일반\s*청약|입주예정자|입주\s*예정자|비대위|59㎡|74㎡|84㎡/, NOT_S4 = /지분적립형|이익공유형|신혼희망|임대|토지|용지|상가/;
  /* 다음 검색 결과는 제목도 창릉 · S4 · 주택 · 교통 기사여야(목록 페이지의 엉뚱한 제목 제외) */
  var HOUSING_RE = /분양|분상제|국평|공공택지|청약|공사비|신도시|입주|주택|아파트|집값|부동산|LH|중도금|대출/;
  function relevantTitle(x) { return !(x.extra && x.extra.via === "daum") || /창릉|고양은평선/.test(x.title) || S4_RE.test(x.title) || HOUSING_RE.test(x.title) || TRAFFIC_RE.test(x.title); }
  function topicOf(x) {
    if (x.kind === "lh") return "LH";
    if (S4_RE.test(x.title) || (x.topic === "S-4" && ((x.extra && x.extra.via === "daum") || (S4_CONTEXT.test(x.title) && !NOT_S4.test(x.title))))) return "S-4";
    if (x.topic === "교통" || TRAFFIC_RE.test(x.title)) return "교통";
    return "창릉";
  }
  function autoRows(list) {
    return '<ul class="list news">' + list.map(function (x) {
      var d = x.published_at ? fmtDate(x.published_at) : (x.date || ""), tp = topicOf(x), dup = arr(x.dups);
      return '<li><span class="src">' + esc(x.source) + '<br><span class="num">' + esc(d) + '</span></span><span class="t"><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a>" +
        (x.desc || (x.extra && x.extra.snippet) ? '<span class="desc">' + esc(x.desc || x.extra.snippet) + "</span>" : "") +
        '<p><span class="tag' + (tp === "S-4" || (x.extra && x.extra.s4) ? " hot" : tp === "교통" ? " water" : "") + '">' + esc(tp === "LH" ? (x.extra && x.extra.status ? x.extra.status : "LH 공고") : tp) + "</span>" + (x.kind === "lh" && x.extra && x.extra.closes ? ' <span class="muted small">마감 ' + esc(x.extra.closes) + "</span>" : "") +
        (dup.length ? ' <details class="dups"><summary>같은 소식 ' + dup.length + "건</summary><ul>" + dup.map(function (y) { return '<li><a href="' + esc(safeUrl(y.url)) + '" target="_blank" rel="noopener">' + esc(y.title) + '</a> <span class="muted small">' + esc(y.source) + "</span></li>"; }).join("") + "</ul></details>" : "") +
        "</p></span></li>";
    }).join("") + "</ul>";
  }
  /* 비슷한 제목(같은 사건을 여러 언론이 낸 기사)을 하나로 묶음 */
  function grams(t) { t = String(t).replace(/[^0-9A-Za-z가-힣]/g, ""); var g = {}; for (var i = 0; i < t.length - 1; i++) g[t.substr(i, 2)] = 1; return g; }
  function sim(a, b) { var n = 0, ka = Object.keys(a), kb = Object.keys(b).length; ka.forEach(function (k) { if (b[k]) n++; }); return n / Math.max(1, ka.length + kb - n); }
  function clusterNews(list) {
    var out = [];
    list.forEach(function (x) {
      var g = grams(x.title), t = x.published_at ? +new Date(x.published_at) : 0, hit = null;
      for (var i = out.length - 1; i >= 0 && i >= out.length - 40; i--) {
        var c = out[i]; if (Math.abs(c._t - t) > 3 * 864e5) continue;
        if (sim(c._g, g) >= 0.3) { hit = c; break; }
      }
      if (hit) hit.dups.push(x); else out.push(Object.assign({}, x, { _g: g, _t: t, dups: [] }));
    });
    return out;
  }
  R.news = async function () {
    var curated = arr(S.news).map(function (x) {
      var m = String(x.date || "").match(/^(\d{4})\.(\d{2})(?:\.(\d{2}))?/);
      return { kind: "news", topic: "S-4", title: x.title, url: x.url, source: x.src, desc: x.desc, date: x.date, published_at: m ? m[1] + "-" + m[2] + "-" + (m[3] || "01") + "T12:00:00+09:00" : null };
    }), auto = [];
    if (LIVE) { try { auto = await API.news("news", 400); } catch (e) { auto = []; } }
    var known = {}; curated.forEach(function (x) { known[x.url] = 1; });
    var COMMUNITY = /(^|\.)(fmkorea\.com|dcinside\.com|zibble\.kr|clien\.net|ruliweb\.com|theqoo\.net|ppomppu\.co\.kr|82cook\.com|bobaedream\.co\.kr|mlbpark\.donga\.com|instiz\.net|hogangnono\.com|asil\.kr|applepie\.one)$/i;
    var all = curated.concat(auto.filter(function (x) { var h = ""; try { h = new URL(x.url).hostname; } catch (e) {} return !known[x.url] && !COMMUNITY.test(h) && !/프리미엄콘텐츠|에펨코리아|디시인사이드|fmkorea|dcinside|Calgary/i.test(x.source || "") && relevantTitle(x); }))
      .sort(function (a, b) { return String(b.published_at || "").localeCompare(String(a.published_at || "")); });
    var T = ["S-4", "교통", "창릉"], shown = 30, cur = "전체";
    C.innerHTML = "<div>" + '<div class="toolbar">' + chips("nwTopic", T, "주제") + '<span class="muted small" id="nwCount"></span></div><div id="nwList"></div>' +
      '<p class="cta-row" style="justify-content:center"><button type="button" class="btn" id="nwMore" hidden>더 보기</button></p></div>';
    function draw() {
      var L = clusterNews(cur === "전체" ? all : all.filter(function (x) { return topicOf(x) === cur; }));
      el("nwList").innerHTML = L.length ? autoRows(L.slice(0, shown)) : empty("기사가 없습니다", "");
      var tot = L.reduce(function (k, c) { return k + 1 + c.dups.length; }, 0);
      el("nwCount").textContent = n(L.length) + "건" + (tot > L.length ? " · 기사 " + n(tot) + "건" : "");
      el("nwMore").hidden = L.length <= shown;
    }
    bindChips("nwTopic", function (t) { cur = t; shown = 30; draw(); });
    el("nwMore").addEventListener("click", function () { shown += 30; draw(); });
    draw();
  };

  R.floorplan = function () {
    var cnt = {}; UNITS.forEach(function (u) { cnt[u.type] = (cnt[u.type] || 0) + 1; });
    var cards = arr(S.types).map(function (t) {
      return '<div class="ftype"><div class="code">' + esc(t.type) + "</div>" +
        "<dl><dt>전용면적</dt><dd>" + esc(t.area) + "</dd><dt>공급면적</dt><dd>" + Number(t.supply).toFixed(2) + "㎡</dd>" +
        "<dt>최고 분양가</dt><dd>" + eok(t.maxPrice) + "</dd>" + (t.units ? "<dt>공급 세대</dt><dd>" + n(t.units) + "</dd>" : cnt[t.type] ? "<dt>배치표 세대</dt><dd>" + n(cnt[t.type]) + "</dd>" : "") + "</dl></div>";
    }).join("");
    C.innerHTML = "<div>" + head("주택형 7개", '<span class="more-row"><a class="more" href="https://apply.lh.or.kr/lhapply/lhFile.do?fileid=67715916" target="_blank" rel="noopener">평면도 원본 (팸플릿 PDF) →</a> <a class="more" href="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=0000061144&ccrCnntSysDsCd=02&uppAisTpCd=05&aisTpCd=05&mi=1027" target="_blank" rel="noopener">모집공고 →</a></span>') + '<div class="ftypes">' + cards + "</div>" +
      '<p class="muted small" style="margin-top:12px">최고 분양가는 모집공고의 주택형별 최고가입니다. 층과 동에 따라 낮아집니다. 공급 세대는 모집공고(LH) 기준입니다.</p></div>' +
      '<div class="two"><div>' + head("면적별 세대수", '<span class="note">모집공고 기준</span>') + areaBars() + "</div><div>" + head("단지 개요") + complexTable(arr(S.complex)) + "</div></div>";
  };

  R.progress = async function () {
    var p = S.progress || {}, M = arr(S.progressMonthly), chart;
    var V = LIVE ? arr(await API.visits().catch(function () { return []; })) : [];
    var logs = V.map(function (v) { return { date: dotDate(v.visited_on), title: v.title, text: v.body, photos: livePhotos(arr(v.photos).sort(function (a, b) { return a.id - b.id; }).map(function (x) { return { id: x.id, cat: "현장 방문", title: v.title, taken_on: v.visited_on, path: x.path, width: x.width, height: x.height }; })) }; })
      .concat(arr(p.logs)).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (M.length) {
      var narrow = window.innerWidth < 600, W = narrow ? 340 : 560, H = narrow ? 190 : 200, pl = 36, pb = 28, pt = 16;   // 휴대폰에서는 좁은 그림으로 그려 글자가 작아지지 않게
      var maxR = Math.max(10, Math.ceil(Math.max.apply(null, M.map(function (m) { return m.rate; })) / 5) * 5);
      var bw = (W - pl - 12) / M.length, y = function (v) { return pt + (H - pt - pb) * (1 - v / maxR); };
      var grid = [0, maxR / 2, maxR].map(function (v) { return '<line x1="' + pl + '" x2="' + (W - 4) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="g"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "%</text>"; }).join("");
      var bars = M.map(function (m, i) {
        var x = pl + i * bw + bw * 0.2, w = bw * 0.6, last = i === M.length - 1;
        return '<rect x="' + x + '" y="' + y(m.rate) + '" width="' + w + '" height="' + (y(0) - y(m.rate)) + '" rx="3" class="' + (last ? "b last" : "b") + '"/>' +
          '<text x="' + (x + w / 2) + '" y="' + (y(m.rate) - 5) + '" text-anchor="middle" class="' + (last ? "v last" : "v") + '">' + m.rate + "</text>" +
          '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(String(m.ym).slice(2)) + "</text>";
      }).join("");
      chart = '<div class="tablebox"><svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="월별 누적 공정률">' + grid + bars + "</svg></div>" +
        '<div class="tablebox"><table class="spec"><thead><tr><th>월</th><th class="r">누적 공정률</th><th class="r">증감</th></tr></thead><tbody>' +
        M.slice().reverse().map(function (m, i, a) { var prev = a[i + 1]; return '<tr><td class="num">' + esc(m.ym) + '</td><td class="r num">' + m.rate + '%</td><td class="r num">' + (prev ? "+" + (m.rate - prev.rate).toFixed(1) + "%p" : "-") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    } else chart = empty("아직 공정 보고가 없습니다", "");
    var LR = LHP ? arr(LHP.reports) : [], lhPh = LR.filter(function (r) { return r.photo; }).map(function (r) { return { title: r.date + " " + (r.text || "공정 사진"), date: r.rate + "%", src: r.photo }; });
    var lhBox = LHP && LHP.info ? '<div class="two"><div>' + head("LH 공사진행현황", '<a class="more" href="https://apply.lh.or.kr/lhapply/land/cwsttInfo.do" target="_blank" rel="noopener">LH청약플러스 →</a>') + progressMeter() +
        '<dl class="kv lhkv"><div><dt>착공</dt><dd class="num">' + esc(dotDate(LHP.info.start)) + '</dd></div><div><dt>준공 예정</dt><dd class="num">' + esc(dotDate(LHP.info.end)) + '</dd></div><div><dt>시공사</dt><dd>' + esc(LHP.info.builder || "") + "</dd></div></dl>" +
        (LR.length ? '<ol class="tl lhrep">' + LR.map(function (r, i) {
          var k = lhPh.findIndex(function (x) { return x.src === r.photo; });
          return '<li class="' + (i === 0 ? "now" : "done") + '"><span class="when">' + esc(r.date) + '</span><span class="dot"></span><span class="what"><b>공정률 ' + esc(r.rate) + "%</b><span>" + esc(r.text) + "</span>" +
            (r.photo ? '<span class="vthumbs"><button type="button" class="vthumb lhthumb" data-k="' + k + '" aria-label="' + esc(r.date) + ' 공정 사진 크게 보기"><img src="' + esc(r.photo) + '" alt="" loading="lazy"></button></span>' : "") + "</span></li>";
        }).join("") + "</ol>" : "") + "</div>" : null;
    C.innerHTML = "<div>" + head("월별 공정률", '<span class="note">LH 공정 보고 기준 누적</span>') + chart + "</div>" +
      (lhBox ? lhBox : (p.overall == null && !arr(p.phases).length) ? "<div>" : '<div class="two"><div>' + head("공정 단계") + progressMeter() + phaseList() + "</div>") +
      "<div>" + head("현장 방문 기록") + (logs.length ? '<ol class="tl">' + logs.map(function (l, i) {
        return '<li class="' + (i === 0 ? "now" : "done") + '"><span class="when">' + esc(l.date) + '</span><span class="dot"></span><span class="what"><b>' + esc(l.title) + '</b><span class="pre">' + esc(l.text) + "</span>" +
          (arr(l.photos).length ? '<span class="vthumbs">' + l.photos.map(function (ph, k) { return '<button type="button" class="vthumb" data-l="' + i + '" data-k="' + k + '" aria-label="사진 ' + (k + 1) + ' 크게 보기"><img src="' + esc(ph.src) + '" alt="" loading="lazy"></button>'; }).join("") + "</span>" : "") + "</span></li>";
      }).join("") + "</ol>" : empty("아직 현장 방문 기록이 없습니다", "")) + "</div></div>";
    C.querySelectorAll(".vthumb:not(.lhthumb)").forEach(function (b) { b.addEventListener("click", function () { lightbox(logs[Number(b.dataset.l)].photos, Number(b.dataset.k)); }); });
    C.querySelectorAll(".lhthumb").forEach(function (b) { b.addEventListener("click", function () { lightbox(lhPh, Math.max(0, Number(b.dataset.k))); }); });
  };

  /* 사진 크게 보기 (← → 키, 밀어서 넘기기, Esc 닫기) */
  function lightbox(list, start) {
    var i = start, box = document.createElement("div"); box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button type="button" class="lb-x" aria-label="닫기">×</button><button type="button" class="lb-p" aria-label="이전 사진">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-n" aria-label="다음 사진">›</button>';
    document.body.appendChild(box); document.body.classList.add("noscroll");
    var img = box.querySelector("img"), cap = box.querySelector("figcaption");
    function draw() { var g = list[i]; img.src = g.src; img.alt = g.title; cap.innerHTML = "<b>" + esc(g.title) + "</b>" + (g.date ? " <small>" + esc(g.date) + "</small>" : "") + ' <small class="lb-c">' + (i + 1) + " / " + list.length + "</small>"; box.querySelector(".lb-p").hidden = box.querySelector(".lb-n").hidden = list.length < 2; }
    function go(d) { i = (i + d + list.length) % list.length; draw(); }
    function close() { box.remove(); document.body.classList.remove("noscroll"); document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); }
    box.querySelector(".lb-x").addEventListener("click", close);
    box.querySelector(".lb-p").addEventListener("click", function () { go(-1); });
    box.querySelector(".lb-n").addEventListener("click", function () { go(1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    var x0 = null; box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
    document.addEventListener("keydown", key); draw(); box.querySelector(".lb-x").focus();
  }
  function dotDate(d) { return d ? String(d).slice(0, 10).replace(/-/g, ".") : ""; }
  function livePhotos(rows) { return arr(rows).map(function (p) { return { id: p.id, cat: p.cat, title: p.title, date: dotDate(p.taken_on), src: API.photoUrl(p.path), w: p.width, h: p.height }; }); }

  R.gallery = async function () {
    var L = (LIVE ? livePhotos(await API.photos().catch(function () { return []; })) : []).concat(arr(S.gallery).map(function (g) { return { cat: g.cat, title: g.title, date: g.date, src: g.src ? safeUrl(g.src) : "" }; }));
    if (!L.length) { C.innerHTML = empty("아직 등록된 사진이 없습니다", LIVE && API.isAdmin ? "운영진 페이지 → 사진 · 방문에서 올릴 수 있습니다." : ""); return; }
    var cats = uniq(L.map(function (g) { return g.cat; }));
    C.innerHTML = "<div>" + '<div class="toolbar">' + chips("gCats", cats, "분류") + '<span class="muted small">' + n(L.length) + "장</span></div>" +
      '<div class="gallery" id="gList">' + L.map(function (g, i) {
        var img = g.src ? '<button type="button" class="ph-open" data-i="' + i + '" aria-label="' + esc(g.title) + ' 크게 보기"><img src="' + esc(g.src) + '" alt="' + esc(g.title) + '" loading="lazy"' + (g.w ? ' width="' + g.w + '" height="' + g.h + '"' : "") + "></button>" : '<div class="img"><span>' + esc(g.cat) + "</span></div>";
        return '<figure class="ph" data-cat="' + esc(g.cat) + '">' + img + "<figcaption>" + esc(g.title) + "<small>" + esc(g.date || "") + "</small></figcaption></figure>";
      }).join("") + "</div></div>";
    bindChips("gCats", filterBy("gList", "figure"));
    el("gList").addEventListener("click", function (e) {
      var b = e.target.closest(".ph-open"); if (!b) return;
      var vis = [].slice.call(el("gList").querySelectorAll("figure")).filter(function (f) { return !f.hidden && f.style.display !== "none"; }).map(function (f) { var o = f.querySelector(".ph-open"); return o ? Number(o.dataset.i) : -1; }).filter(function (k) { return k >= 0; });
      var list = vis.map(function (k) { return L[k]; }); lightbox(list, Math.max(0, vis.indexOf(Number(b.dataset.i))));
    });
  };

  R.association = function () {
    var o = S.org || {}, g = S.greeting, ac = S.accounting || { rows: [] }, rows = arr(ac.rows);
    var tin = 0, tout = 0; rows.forEach(function (r) { tin += r.in || 0; tout += r.out || 0; });
    function role(r, cls) { return '<div class="role ' + (cls || "") + '"><b>' + esc(r.role) + "</b><span>" + esc(r.name) + "</span></div>"; }
    var ab = S.about;
    C.innerHTML =
      (ab ? '<div class="as-about"><p class="as-lead">' + esc(ab.lead) + '</p><p class="muted">' + esc(ab.note) + "</p>" +
        '<ul class="as-acts">' + arr(ab.activities).map(function (x, i) { return '<li><span class="num">0' + (i + 1) + "</span><b>" + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span></li>"; }).join("") + "</ul></div>" : "") +
      (g && g.text ? '<div class="greeting"><div class="eyebrow">인사말</div><p class="content">' + esc(g.text) + '</p><p class="muted small">— ' + esc(g.from) + "</p></div>" : "") +
      (o.head ? "<div>" + head("조직 구성(안)", '<span class="note">운영진 선출 전</span>') +
        '<div class="org">' + role(o.head, "head") + '<span class="link-line"></span><div class="lvl">' + arr(o.officers).map(function (r) { return role(r); }).join("") + '</div><span class="link-line"></span><div class="lvl">' + arr(o.teams).map(function (r) { return role(r); }).join("") + "</div>" +
        '<span class="link-line"></span><div class="lvl">' + role({ role: "동대표", name: "각 동 1인" }) + "</div></div></div>" : "") +
      "<div>" + head("회칙", more("bylaws.html", "전문 보기")) + bylawsKeys() + "</div>" +
      '<div id="asMoney">' + head("회계 공개", ac.asOf ? '<span class="note">' + esc(ac.asOf) + " 기준</span>" : "") +
      (rows.length ? '<div class="tablebox"><table class="spec"><thead><tr><th>날짜</th><th>항목</th><th class="r">수입</th><th class="r">지출</th><th>비고</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="num">' + esc(r.date) + "</td><td>" + esc(r.item) + '</td><td class="r num">' + n(r.in) + '</td><td class="r num">' + n(r.out) + "</td><td>" + esc(r.by) + "</td></tr>"; }).join("") +
        '<tr class="total"><td colspan="2">합계</td><td class="r num">' + n(tin) + '</td><td class="r num">' + n(tout) + "</td><td></td></tr></tbody></table></div>"
        : empty("수입 · 지출 내역이 없습니다", "협의회는 현재 회비를 걷지 않습니다.")) +
      (ac.note ? '<p class="muted small">' + esc(ac.note) + "</p>" : "") + "</div>";
    if (LIVE) API.duesPublic().then(function (d) { if (d) el("asMoney").innerHTML = duesPublicHtml(d, ac.note); }).catch(function () {});
  };

  /* ── 회비 ── */
  function won(x) { return n(x) + "원"; }
  function duesTierNow(tiers) {
    var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    return arr(tiers).filter(function (t) { return !t.until || today <= t.until; })[0] || null;
  }
  function duesTiersHtml(tiers) {
    var nowT = duesTierNow(tiers), prev = null;
    return '<table class="spec dues-tiers"><thead><tr><th>납부 시기</th><th class="r">금액</th></tr></thead><tbody>' + arr(tiers).map(function (t) {
      var from = prev ? fmtDate(new Date(new Date(prev + "T00:00:00+09:00").getTime() + 86400e3)) : "";
      var label = t.until ? (from ? from + " ~ " : "~ ") + fmtDate(t.until + "T00:00:00+09:00") : (from ? from + " 이후" : "언제든");
      prev = t.until;
      return "<tr" + (t === nowT ? ' class="now"' : "") + "><td>" + esc(label) + (t === nowT ? ' <span class="tag">지금</span>' : "") + '</td><td class="r num">' + won(t.amount) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function duesAccountHtml(d) {
    if (!d || !d.account) return "";
    return '<div class="dues-acc"><div><span class="muted small">입금 계좌</span><b class="num">' + esc(d.bank || "") + " " + esc(d.account) + '</b><span class="small">' + esc(d.holder || "") + "</span></div>" +
      '<button type="button" class="btn" data-copy="' + esc(d.account) + '">계좌번호 복사</button>' +
      '<p class="small" style="flex-basis:100%;margin:0">입금자명은 <b>동호수+닉네임</b>으로 적어 주세요. 예: <span class="num">403-1804홍길동</span> · 동호수가 있어야 자동으로 납부 확인이 됩니다.</p></div>';
  }
  function bindCopy(root) {
    root.querySelectorAll("[data-copy]").forEach(function (b) { b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy"), was = b.textContent, done = function () { b.textContent = "복사했습니다"; setTimeout(function () { b.textContent = was; }, 1600); };
      try { navigator.clipboard.writeText(v).then(done, function () { prompt("계좌번호", v); }); } catch (e) { prompt("계좌번호", v); }
    }); });
  }
  /* 회원용 회비 안내: 우리 세대 금액 · 계좌 · 입금자명 */
  function duesPayer() {
    var p = API.profile || {}, nick = String(p.nickname || "").replace(/\s+/g, "").slice(0, 6);
    return (p.unit_id || "") + nick;
  }
  function duesCardHtml(m, d, compact) {
    if (!m || !d) return "";
    var due = Number(m.due || 0), paid = Number(m.paid || 0), done = paid > 0 && paid >= (due || 1), left = Math.max(due - paid, 0);
    if (done) return '<div class="dues-card done"><span class="tag">납부 완료</span><b class="num">' + won(paid) + '</b><span class="muted small">' + fmtDate(m.first_at) + " 입금 확인 · 감사합니다</span></div>";
    if (!d.account || !due) return "";
    return '<div class="dues-card">' +
      '<div class="dc-amt"><span class="muted small">' + (paid ? "남은 회비" : "우리 세대 회비") + '</span><b class="num">' + won(left) + "</b>" +
        (paid ? '<span class="small muted">' + won(paid) + " 입금 확인됨 · 총 " + won(due) + "</span>" : nextTierNote(d.tiers)) + "</div>" +
      '<dl class="dc-info">' +
        "<div><dt>입금 계좌</dt><dd><b class=\"num\">" + esc(d.bank || "") + " " + esc(d.account) + '</b> <button type="button" class="btn sm" data-copy="' + esc(d.account) + '">복사</button><span class="small muted">' + esc(d.holder || "") + "</span></dd></div>" +
        '<div><dt>입금자명</dt><dd><b class="num">' + esc(duesPayer()) + '</b> <button type="button" class="btn sm" data-copy="' + esc(duesPayer()) + '">복사</button><span class="small muted">이대로 적어야 자동으로 확인됩니다</span></dd></div>' +
      "</dl>" + (compact ? '<a class="small" href="account.html">내 정보에서 보기 →</a>' : "") + "</div>";
  }
  /* 운영진: 설정 전이면 회원에게 안내가 안 보인다는 걸 알려 줌 */
  function duesAdminHint(d) {
    if (!API.isAdmin || (d && d.account && arr(d.tiers).length)) return "";
    return '<div class="dues-card hint"><div class="dc-amt"><span class="muted small">운영진에게만 보입니다</span><b>회비 설정 전</b></div>' +
      '<p class="small" style="margin:0">계좌와 세대당 금액을 저장하면 회원의 홈 · 내 정보에 이 자리에 납부 금액 · 계좌 · 입금자명 안내가 나타납니다. <a href="admin.html#dues">회비 설정하기 →</a></p></div>';
  }
  function nextTierNote(tiers) {
    var now = duesTierNow(tiers), L = arr(tiers), i = L.indexOf(now), nx = i >= 0 ? L[i + 1] : null;
    if (!now || !now.until || !nx) return "";
    return '<span class="small">' + fmtDate(now.until + "T00:00:00+09:00") + "까지 · 그 뒤에는 " + won(nx.amount) + "</span>";
  }
  function duesPublicHtml(d, note) {
    var months = arr(d.months), spend = arr(d.spend), h = head("회계 공개", d.updated ? '<span class="note">' + fmtDate(d.updated) + " 거래까지</span>" : "");
    if (d.account && arr(d.tiers).length) h += '<div class="two dues-pub"><div>' + duesAccountHtml(d) + '<p class="muted small" style="margin:8px 0 0">납부 세대 <b class="num">' + n(d.paid_units) + "</b> / " + n(T) + "세대</p></div><div>" + duesTiersHtml(d.tiers) + "</div></div>";
    if (months.length) {
      h += '<div class="tablebox"><table class="spec"><thead><tr><th>월</th><th class="r">회비</th><th class="r">기타 수입</th><th class="r">지출</th><th class="r">월말 잔액</th></tr></thead><tbody>' +
        months.map(function (m) { return '<tr><td class="num">' + esc(m.month.replace("-", ".")) + '</td><td class="r num">' + n(m.dues) + '</td><td class="r num">' + n(m.other) + '</td><td class="r num">' + n(m.out) + '</td><td class="r num">' + (m.balance == null ? "—" : n(m.balance)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      if (spend.length) h += '<h3 class="small" style="margin:12px 0 4px">주요 지출</h3><ul class="list">' + spend.slice(0, 20).map(function (s) { return '<li><span class="t">' + esc(s.note) + '</span><span class="d num">' + fmtDate(s.at) + " · " + won(s.amount) + "</span></li>"; }).join("") + "</ul>";
    } else if (!d.account) h += empty("수입 · 지출 내역이 없습니다", "협의회는 현재 회비를 걷지 않습니다.");
    h += '<p class="muted small">' + (d.account ? "수입 · 지출은 매월 공개합니다(회칙 제29조)." : esc(note || "")) + " 입금자 이름은 공개하지 않습니다.</p>";
    setTimeout(function () { var r = el("asMoney"); if (r) bindCopy(r); }, 0);
    return h;
  }

  /* ── 회칙 ── */
  /* 협의회 소개의 회칙 요약: 장마다 한 줄 */
  function bylawsKeys() {
    var chs = arr((S.bylaws || {}).chapters);
    return '<ol class="bl-keys">' + chs.map(function (c, i) {
      var as = arr(c.a), r = as.length ? "제" + as[0].n + "~" + as[as.length - 1].n + "조" : "";
      return '<li><a class="bl-key" href="bylaws.html#ch' + (i + 1) + '"><span class="bl-ref">제' + (i + 1) + "장</span><b>" + esc(c.t) + '</b><span class="bl-range">' + r + "</span><span>" + esc(c.s || "") + "</span></a></li>";
    }).join("") + "</ol>";
  }
  R.bylaws = function () {
    var B = S.bylaws || { chapters: [] }, chs = arr(B.chapters), total = 0;
    chs.forEach(function (c) { total += arr(c.a).length; });
    if (!total) { C.innerHTML = empty("회칙을 준비하고 있습니다", ""); return; }
    var fixed = B.status === "확정";
    var status = fixed ? '<span class="bl-badge ok">시행 중</span><span>' + (B.enacted ? esc(B.enacted) + " 제정" : "") + "</span>"
      : '<span class="bl-badge">제정(안)</span><span>창립총회 의결 전입니다. 의견은 게시판이나 카페에 남겨 주세요.</span>';
    function art(a) {
      return '<article class="bl-art" id="a' + a.n + '" data-q="' + esc(("제" + a.n + "조 " + a.t + " " + a.p + " " + arr(a.i).join(" ")).toLowerCase()) + '">' +
        '<h3><a class="bl-no" href="#a' + a.n + '">제' + a.n + "조</a> " + esc(a.t) + "</h3>" +
        (a.p ? "<p>" + esc(a.p) + "</p>" : "") +
        (arr(a.i).length ? "<ol>" + a.i.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + "</article>";
    }
    C.innerHTML =
      '<div class="bl-status">' + status + '<span class="bl-count">' + chs.length + "장 " + total + "개 조</span></div>" +
      '<div class="bl-body"><div class="bl-tools"><label class="bl-find"><span class="sr-only">조문 찾기</span><input id="blQ" type="search" placeholder="조문 찾기 (예: 회비, 감사)" autocomplete="off"></label>' +
        "</div>" +
        '<nav class="bl-toc" aria-label="목차">' + chs.map(function (c, i) { return '<a href="#ch' + (i + 1) + '">' + (i + 1) + ". " + esc(c.t) + "</a>"; }).join("") + "</nav>" +
        chs.map(function (c, i) {
          return '<section class="bl-ch" id="ch' + (i + 1) + '"><h2><span class="bl-chno">제' + (i + 1) + "장</span> " + esc(c.t) + "</h2>" + (c.s ? '<p class="bl-sum">' + esc(c.s) + "</p>" : "") + arr(c.a).map(art).join("") + "</section>";
        }).join("") +
        '<p class="bl-none" id="blNone" hidden>찾는 조문이 없습니다.</p>' +
        '<p class="bl-foot">' + esc(B.title || "회칙") + " · 제정일 " + (B.enacted ? esc(B.enacted) : "창립총회 의결 후 기재") +
        (arr(B.revisions).length ? "<br>" + B.revisions.map(function (r) { return esc(r.date) + " 개정 · " + esc(r.note); }).join("<br>") : "") + "</p>" +
      "</div>";
    var q = el("blQ"), arts = C.querySelectorAll(".bl-art"), chsEl = C.querySelectorAll(".bl-ch");
    q.addEventListener("input", function () {
      var v = q.value.trim().toLowerCase(), any = false;
      Array.prototype.forEach.call(arts, function (x) { var hit = !v || x.getAttribute("data-q").indexOf(v) >= 0; x.hidden = !hit; if (hit) any = true; });
      Array.prototype.forEach.call(chsEl, function (s) { s.hidden = !s.querySelector(".bl-art:not([hidden])"); });
      el("blNone").hidden = any;
    });
    function jump() {
      var id = (location.hash || "").slice(1); if (!/^(a|ch)\d+$/.test(id)) return;
      var t = el(id); if (!t) return;
      if (q.value) { q.value = ""; q.dispatchEvent(new Event("input")); }
      t.scrollIntoView({ block: "start" });
      if (id[0] === "a") { t.classList.remove("hl"); void t.offsetWidth; t.classList.add("hl"); }
    }
    window.addEventListener("hashchange", jump);
    setTimeout(jump, 0);
  };

  /* ── 회원 상태 안내 ── */
  function gate(need) {
    // need: "member" | "login"
    if (!LIVE) return '<div class="empty"><b>로그인이 필요합니다</b><span>입주예정자 인증을 거친 회원만 이용할 수 있습니다. (미리보기: 서버 연결 후 동작)</span><p class="cta-row" style="margin-top:8px"><a class="btn solid" href="login.html">로그인</a><a class="btn" href="login.html#signup">회원가입</a></p></div>';
    if (!API.loggedIn) return '<div class="empty"><b>로그인이 필요합니다</b><span>입주예정자 인증을 거친 회원만 이용할 수 있습니다.</span><p class="cta-row" style="margin-top:8px"><a class="btn solid" href="login.html">로그인</a><a class="btn" href="login.html#signup">회원가입</a></p></div>';
    if (need === "login") return "";
    var p = API.profile;
    if (!p) return '<div class="empty"><b>가입을 마무리해 주세요</b><span>계약서 사진이 아직 등록되지 않았습니다.</span><p class="cta-row" style="margin-top:8px"><a class="btn solid" href="login.html#signup">가입 마무리</a></p></div>';
    if (p.status === "pending") return '<div class="empty"><b>승인 대기 중입니다</b><span>운영진이 올려주신 사진으로 세대를 확인하고 있습니다. 승인되면 바로 이용할 수 있습니다.</span></div>';
    if (p.status === "rejected") return '<div class="empty"><b>가입이 반려되었습니다</b><span>' + esc(p.reject_reason || "") + '</span><p class="cta-row" style="margin-top:8px"><a class="btn solid" href="account.html">재신청하기</a></p></div>';
    if (need === "delegate" && !API.isDelegate) return delegateNote(true);
    return "";
  }
  /* 위임장 제출 시작일 (공급계약 시작) */
  function consentOpenLabel() {
    var d = API.consentOpenAt || new Date(S.consentOpenAt || "2026-11-16T00:00:00+09:00");
    var k = new Date(d.getTime() + 9 * 3600 * 1000);
    return (k.getUTCMonth() + 1) + "월 " + k.getUTCDate() + "일";
  }
  /* 위임 전 세대 안내: 투표 · 민원 · 세대별 현황은 위임 세대만 */
  function delegateNote(block) {
    var title, body, cta = "";
    if (!API.consentOpen) {
      title = "위임장은 공급계약 후 받습니다";
      body = consentOpenLabel() + " 공급계약이 시작되면 위임동의서를 낼 수 있습니다. 위임한 세대는 투표 · 단체민원에 참여하고 세대별 현황을 볼 수 있습니다." + (API.isMember ? " 지금은 게시판을 이용할 수 있습니다." : "");
    } else {
      title = "위임장을 낸 세대만 참여할 수 있습니다";
      body = "위임동의서를 내면 투표 · 단체민원 참여와 세대별 현황 보기가 바로 열립니다." + (API.profile && API.profile.status === "pending" ? " 승인 대기 중에도 낼 수 있습니다." : "");
      cta = '<a class="btn solid" href="consent.html">위임동의서 제출</a>';
    }
    if (!block) return '<p class="notice-box small">' + esc(title) + ". " + esc(body) + (cta ? ' <a href="consent.html">위임동의서 제출 →</a>' : "") + "</p>";
    return '<div class="empty"><b>' + esc(title) + "</b><span>" + esc(body) + "</span>" + (cta ? '<p class="cta-row" style="margin-top:8px">' + cta + "</p>" : "") + "</div>";
  }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || "처리 중…"; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; }
  function say(id, msg, bad) { var m = el(id); if (!m) return; m.hidden = !msg; m.textContent = msg || ""; m.classList.toggle("bad", !!bad); if (msg && id === "admMsg" && m.scrollIntoView) { var r = m.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) m.scrollIntoView({ behavior: "smooth", block: "center" }); } }
  function fmtDate(s) { if (!s) return ""; var d = new Date(s); return d.getFullYear() + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + ("0" + d.getDate()).slice(-2); }
  function fmtTime(s) { var d = new Date(s); return fmtDate(s) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function unitLabel(id) { var u = UNIT[id]; return u ? u.dong + "동 " + u.ho + "호 (" + u.type + ")" : id; }
  function unitPicker(prefix, current) {
    var dongs = arr(S.layout).map(function (d) { return d.dong; });
    return '<div class="two" style="gap:12px"><div class="field"><label for="' + prefix + 'Dong">동</label><select id="' + prefix + 'Dong" required><option value="">동 선택</option>' +
      dongs.map(function (d) { return '<option value="' + d + '">' + d + "동</option>"; }).join("") + '</select></div>' +
      '<div class="field"><label for="' + prefix + 'Ho">호수</label><select id="' + prefix + 'Ho" required disabled><option value="">먼저 동을 고르세요</option></select></div></div>';
  }
  function bindUnitPicker(prefix, current) {
    var D = el(prefix + "Dong"), H = el(prefix + "Ho");
    function fill() {
      var d = Number(D.value);
      var list = UNITS.filter(function (u) { return u.dong === d; }).sort(function (a, b) { return a.floor - b.floor || a.line - b.line; });
      H.innerHTML = '<option value="">호수 선택</option>' + list.map(function (u) { return '<option value="' + u.id + '">' + u.ho + "호 · " + u.type + "</option>"; }).join("");
      H.disabled = !list.length;
    }
    D.addEventListener("change", fill);
    if (current && UNIT[current]) { D.value = String(UNIT[current].dong); fill(); H.value = current; }
  }
  var PRIVACY_SIGNUP = "수집 항목: 동 · 호수(아이디), 비밀번호(암호화하여 저장), 계약서 사진, 가입 · 접속 기록\n목적: 입주예정자 여부 확인과 1세대 1계정 관리\n보유 기간: 계약서 사진은 운영진 확인(승인 · 반려) 즉시 삭제, 나머지는 탈퇴 또는 협의회 해산 시까지\n사진에 주민등록번호가 보이면 반려하고 즉시 삭제합니다.\n동의하지 않을 수 있으나, 이 경우 가입할 수 없습니다.";

  /* ── 위임동의 현황판 ── */
  function agreeSteps() {
    var go = LIVE && !API.loggedIn ? '<a class="btn solid" href="login.html#signup">회원가입</a>' : "";
    return '<details class="ag-steps"><summary><ol>' +
      "<li><b>1</b>계약 후 회원가입</li><li><b>2</b>운영진 승인</li><li><b>3</b>위임동의서 서명</li><li><b>4</b>현황판 반영</li>" +
      '</ol><span class="more-t">자세히</span></summary><div class="ag-steps-body"><ol class="steps">' +
      "<li><div><b>공급계약 후 회원가입</b><span>" + esc(consentOpenLabel()) + " 계약이 시작되면 동·호수를 고르고 계약서 첫 장 사진을 올립니다. 한 세대에는 한 계정만 만들 수 있습니다.</span></div></li>" +
      "<li><div><b>운영진 승인</b><span>운영진이 사진으로 세대를 확인하고, 사진은 확인 후 바로 삭제합니다.</span></div></li>" +
      '<li><div><b>위임동의서 서명</b><span><a href="consent.html">위임동의서</a>를 읽고 계약자 성명과 서명으로 냅니다. 주민등록번호는 받지 않습니다. 서면 위임장은 공식 메일로 보내도 됩니다.</span></div></li>' +
      "<li><div><b>현황판 반영</b><span>바로 반영되고 투표 · 단체민원에 참여할 수 있습니다. 내 정보에서 언제든 철회할 수 있습니다.</span></div></li>" +
      '</ol><p class="muted small">협의회는 법적 권한이 있는 단체가 아닌 자발적 모임이라, 위임 세대 수가 곧 대표성입니다.</p></div></details>' +
      (go ? '<p class="cta-row" style="margin:0">' + go + "</p>" : "");
  }
  R.agreement = async function () {
    if (!UNITS.length) { C.innerHTML = empty("배치표가 없습니다", "data.js의 layout에 동별 라인을 넣어주세요."); return; }
    var TYPES = uniq(UNITS.map(function (u) { return u.type; })).sort(), filt = "전체", stats = null, canSee = true, myUnit = null, MEMBER = {};
    if (LIVE) {
      stats = await API.stats();
      var mst = await API.memberStats().catch(function () { return null; });
      canSee = API.isDelegate || API.isAdmin;
      AGREED = {};
      if (canSee) arr(await API.agreedUnits()).forEach(function (id) { AGREED[id] = 1; });
      if (canSee) arr(await API.memberUnits()).forEach(function (id) { MEMBER[id] = 1; });
      myUnit = API.isMember ? API.profile.unit_id : null;
    }
    var sDong = {}; arr(stats).forEach(function (r) { sDong[r.dong] = r; });
    var liveTotal = stats ? stats.reduce(function (s, r) { return s + r.agreed; }, 0) : null;
    var mDong = {}, mTotal = null; if (LIVE && mst) { mTotal = 0; mst.forEach(function (r) { mDong[r.dong] = r.members; mTotal += r.members; }); }

    C.innerHTML =
      '<div class="ag-summary" id="agSum"></div>' + agreeSteps() +
      (LIVE && !canSee ? '<div class="notice-box">동별 집계는 누구나 볼 수 있습니다. 세대별 현황은 위임장을 낸 세대에게만 보입니다. ' + (API.loggedIn ? '<a href="consent.html">위임동의서 →</a>' : '<a href="login.html">로그인</a>') + "</div>" : "") +
      (LIVE && API.isMember ? '<div class="notice-box' + (API.hasAgreement ? " good" : "") + '">' + (API.hasAgreement ? "우리 세대(" + esc(unitLabel(myUnit)) + ")는 위임동의를 마쳤습니다." : '우리 세대(' + esc(unitLabel(myUnit)) + ')는 아직 위임동의 전입니다. ' + (API.consentOpen ? '<a href="consent.html">위임동의서 제출 →</a>' : esc(consentOpenLabel()) + " 공급계약 후 제출할 수 있습니다.")) + "</div>" : "") +
      (canSee ? '<div class="toolbar">' + chips("agTypes", TYPES, "타입") +
        '<form class="find" id="agFind" role="search"><label for="agQ" class="small muted">세대 찾기</label><input id="agQ" placeholder="예: 403-1803" autocomplete="off"><button class="btn" type="submit">찾기</button></form></div>' +
        '<div class="legend small"><span><i class="sw on"></i>위임동의 완료</span>' + (LIVE ? '<span><i class="sw mem"></i>가입 · 위임 전</span>' : "") + '<span><i class="sw off"></i>미가입</span><span><i class="sw none"></i>필로티 · 비주거</span>' + (myUnit ? '<span><i class="sw mine"></i>우리 세대</span>' : "") + "</div>" : "") +
      '<div class="dongs' + (canSee ? "" : " compact") + '" id="agDongs"></div>' +
      '<div class="panel ag-info" id="agInfo" hidden></div>' +
      (canSee ? "<div>" + head("타입별 현황") + '<div class="tablebox"><table class="spec"><thead><tr><th>타입</th><th class="r">세대</th><th class="r">동의</th><th class="r">동의율</th><th style="width:40%"><span class="sr">막대</span></th></tr></thead><tbody id="agTypeTbl"></tbody></table></div></div>' : "") +
      (LIVE && API.isAdmin ? '<p class="muted small">운영진 메모: ' + esc(S.layoutNote || "") + " 배치표 집계 " + n(UNITS.length) + "세대, 공고 " + n(T) + "세대.</p>" : "") +
      (LIVE ? "" : '<p class="muted small">회원 기능이 연결되면 승인된 회원이 낸 위임동의서가 이 화면에 자동으로 반영됩니다.</p>');

    function render() {
      var a = liveTotal != null && !canSee ? liveTotal : Object.keys(AGREED).length, byDong = {}, byType = {};
      UNITS.forEach(function (u) {
        var on = !!AGREED[u.id];
        (byDong[u.dong] = byDong[u.dong] || [0, 0])[1]++; if (on) byDong[u.dong][0]++;
        (byType[u.type] = byType[u.type] || [0, 0])[1]++; if (on) byType[u.type][0]++;
      });
      if (!canSee) Object.keys(sDong).forEach(function (d) { byDong[d] = [sDong[d].agreed, sDong[d].total]; });
      var p = pct(a, T);
      el("agSum").innerHTML =
        '<div class="big"><b class="num">' + n(a) + '</b><span class="muted"> / ' + n(T) + "세대</span></div>" +
        '<div class="meter" style="margin:0;flex:1;min-width:240px"><div class="row"><span>전체 동의율</span><b class="num">' + p.toFixed(1) + '%</b></div>' +
        '<div class="bar-track"><i style="width:' + Math.min(100, p).toFixed(1) + '%"></i><span class="goal" style="left:' + pct(NEED, T).toFixed(1) + '%"></span></div>' +
        "<small>" + (a >= NEED ? "목표 과반(" + n(NEED) + "세대)을 넘었습니다" : "목표 과반(" + n(NEED) + "세대)까지 " + n(NEED - a) + "세대") + (LIVE ? " · 실시간" : (S.agreementAsOf ? " · " + esc(S.agreementAsOf) + " 기준" : "")) + "</small>" + memberLine(a, mTotal) + "</div>";

      el("agDongs").innerHTML = arr(S.layout).map(function (d) {
        var st = byDong[d.dong] || [0, 0], dp = pct(st[0], st[1]);
        var top = '<header><h3>' + d.dong + '동</h3><span class="num">' + st[0] + "/" + st[1] + " · " + dp.toFixed(0) + "%</span></header>" + '<div class="mini"><i style="width:' + dp.toFixed(1) + '%"></i></div>' +
          (mTotal != null ? '<p class="dmem small muted">가입 ' + n(mDong[d.dong] || 0) + "세대</p>" : "");
        if (!canSee) return '<section class="dong" aria-label="' + d.dong + '동">' + top + "</section>";
        var maxF = Math.max.apply(null, d.lines.map(function (l) { return l[2]; })), cells = "";
        for (var f = maxF; f >= 1; f--) {
          cells += '<span class="fl num">' + (f % 5 === 0 || f === 1 ? f : "") + "</span>";
          d.lines.forEach(function (l, li) {
            var ho = f * 100 + li + 1, id = d.dong + "-" + ho, dim = filt !== "전체" && l[0] !== filt;
            if (f < l[1] || f > l[2]) cells += '<span class="c' + (f < l[1] ? " none" : " sky") + (dim ? " dim" : "") + '"></span>';
            else cells += '<button type="button" class="c ' + (AGREED[id] ? "on" : MEMBER[id] ? "mem" : "off") + (id === myUnit ? " mine" : "") + (dim ? " dim" : "") + '" data-id="' + id + '" title="' + d.dong + "동 " + ho + '호" aria-label="' + d.dong + "동 " + ho + "호 " + l[0] + (AGREED[id] ? " 위임동의 완료" : MEMBER[id] ? " 가입 · 위임 전" : " 미제출") + '"></button>';
          });
        }
        var footer = '<span class="fl"></span>' + d.lines.map(function (l) { return '<span class="tp t' + l[0].slice(0, 2) + (filt !== "전체" && l[0] !== filt ? " dim" : "") + '">' + l[0] + "</span>"; }).join("");
        return '<section class="dong" aria-label="' + d.dong + '동">' + top + '<div class="grid" style="grid-template-columns:18px repeat(' + d.lines.length + ',1fr)">' + cells + footer + "</div></section>";
      }).join("");

      if (canSee) el("agTypeTbl").innerHTML = TYPES.map(function (t) {
        var s = byType[t], q = pct(s[0], s[1]);
        return "<tr><td>" + t + '</td><td class="r num">' + n(s[1]) + '</td><td class="r num">' + n(s[0]) + '</td><td class="r num">' + q.toFixed(1) + '%</td><td><div class="bar-track" style="margin:0"><i style="width:' + q.toFixed(1) + '%"></i></div></td></tr>';
      }).join("");
    }
    var selected = null;
    function info(id) {
      var u = UNIT[id]; if (!u) return false;
      selected = id; var b = el("agInfo"); b.hidden = false;
      b.innerHTML = '<div class="row-info"><b>' + u.dong + "동 " + u.ho + "호</b><span>" + u.type + " · " + u.floor + '층</span><span class="tag' + (AGREED[id] ? "" : MEMBER[id] ? " water" : " off") + '">' + (AGREED[id] ? "위임동의 완료" : MEMBER[id] ? "가입 · 위임 전" : "미가입") + '</span><button type="button" class="linkbtn" id="agInfoClose">닫기</button></div>';
      el("agInfoClose").addEventListener("click", function () { b.hidden = true; selected = null; C.querySelectorAll(".c.sel").forEach(function (x) { x.classList.remove("sel"); }); });
      C.querySelectorAll(".c.sel").forEach(function (x) { x.classList.remove("sel"); });
      var c = C.querySelector('.c[data-id="' + id + '"]'); if (c) c.classList.add("sel");
      return true;
    }
    render();
    if (!canSee) return;
    el("agDongs").addEventListener("click", function (e) { var c = e.target.closest("button.c"); if (c) info(c.dataset.id); });
    bindChips("agTypes", function (t) { filt = t; render(); if (selected) info(selected); });
    el("agFind").addEventListener("submit", function (e) {
      e.preventDefault();
      var m = el("agQ").value.match(/(\d{3})\D*(\d{3,4})/), id = m ? m[1] + "-" + Number(m[2]) : "";
      if (info(id)) { var c = C.querySelector('.c[data-id="' + id + '"]'); if (c) c.scrollIntoView({ block: "center" }); }
      else { var b = el("agInfo"); b.hidden = false; b.textContent = "해당 세대를 찾지 못했습니다. 401-1401처럼 동과 호수를 입력하세요."; }
    });
  };

  /* ── 단체민원 · 투표 ── */
  R.participate = async function () {
    var CP = LIVE ? await API.campaigns() : arr(S.campaigns), PL = LIVE ? await API.polls() : arr(S.polls);
    var stCls = { "의견 모집": "tag hot", "접수 완료": "tag", "답변 완료": "tag off" };
    var pollGate = LIVE ? gate("member") : "";
    C.innerHTML = "<div>" + head("단체민원", CP.length ? '<span class="note">1세대 1참여 · 참여 세대 수 기준</span>' : "") +
      (CP.length ? '<div class="camps">' + CP.map(function (c) {
        var q = Math.min(100, pct(c.joined, T)), canJoin = LIVE && API.isDelegate && c.status === "의견 모집" && !c.mine;
        return '<article class="camp"><div class="camp-top"><span class="' + (stCls[c.status] || "tag") + '">' + esc(c.status) + '</span><span class="muted small">대상 · ' + esc(c.target || c.to) + "</span></div>" +
          "<h3>" + esc(c.title) + '</h3><p class="muted">' + esc(c.description || c.desc) + "</p>" +
          '<div class="bar-track"><i style="width:' + q.toFixed(1) + '%"></i></div><div class="camp-foot"><span class="num">' + n(c.joined) + "세대 참여 · " + q.toFixed(0) + "%</span>" +
          (c.mine ? '<span class="tag">참여함</span>' : canJoin ? '<button type="button" class="btn join" data-id="' + c.id + '">참여하기</button>' : "") + "</div></article>";
      }).join("") + "</div>" : empty("진행 중인 단체민원이 없습니다", "민원 제안은 게시판에 남겨주세요.")) +
      (LIVE && !API.isDelegate && CP.some(function (c) { return c.status === "의견 모집"; }) ? (API.isMember ? delegateNote(false) : '<p class="muted small">참여는 위임장을 낸 세대만 할 수 있습니다. <a href="login.html">로그인</a></p>') : "") +
      '<p class="notice-box" id="pMsg" role="status" hidden></p></div>' +
      "<div>" + head("투표", '<span class="note">1세대 1표</span>') +
      (pollGate ? pollGate : PL.length ? '<div class="two">' + PL.map(function (p) {
        var votes = p.votes || arr(p.options).map(function (o) { return o.v || 0; }), labels = arr(p.options).map(function (o) { return typeof o === "string" ? o : o.t; });
        var tot = votes.reduce(function (s, v) { return s + v; }, 0), voted = p.mine != null, can = LIVE && API.isDelegate && !voted && !p.closed;
        return '<div class="panel poll"><h3 style="font-size:19px">' + esc(p.question || p.q) + '</h3><p class="muted small" style="margin:4px 0 14px">' + (p.closed ? "마감됨" : "마감 " + esc(p.ends_at ? fmtDate(p.ends_at) : p.ends)) + " · " + n(tot) + "표" + (voted ? " · 우리 세대 투표함" : "") + "</p>" + (LIVE && !API.isDelegate && !p.closed ? '<p class="muted small" style="margin:-8px 0 12px">투표는 위임장을 낸 세대만 할 수 있습니다. 결과는 회원 모두 볼 수 있습니다.</p>' : "") +
          labels.map(function (t, i) {
            var q = pct(votes[i], tot);
            return '<div class="meter" style="margin-bottom:12px"><div class="row"><span>' + esc(t) + (p.mine === i ? ' <span class="tag">선택</span>' : "") + '</span><span class="num">' + q.toFixed(0) + "% · " + n(votes[i]) + '</span></div><div class="bar-track"><i style="width:' + q.toFixed(1) + '%"></i></div>' +
              (can ? '<button type="button" class="btn vote" data-poll="' + p.id + '" data-idx="' + i + '" style="margin-top:6px;padding:5px 12px;font-size:13px">이 항목에 투표</button>' : "") + "</div>";
          }).join("") + "</div>";
      }).join("") + "</div>" : empty("진행 중인 투표가 없습니다", "운영진이 투표를 열면 이곳에 표시됩니다.")) + "</div>";
    if (!LIVE) return;
    C.addEventListener("click", async function (e) {
      var j = e.target.closest(".join"), v = e.target.closest(".vote");
      if (!j && !v) return;
      var btn = j || v; busy(btn, true);
      try {
        if (j) await API.joinCampaign(Number(j.dataset.id));
        else await API.vote(Number(v.dataset.poll), Number(v.dataset.idx));
        await R.participate();
      } catch (err) { busy(btn, false); say("pMsg", API.errorText(err), true); el("pMsg").scrollIntoView({ block: "center" }); }
    });
  };

  /* ── 자유게시판 ── */
  R.board = async function () {
    if (!LIVE) { C.innerHTML = gate("member"); return; }
    var g = gate("member"); if (g) { C.innerHTML = g; return; }
    var cats = arr(S.boardCats).length ? S.boardCats : ["자유"];
    var L = await API.posts();
    C.innerHTML =
      '<div id="postView" hidden></div>' +
      "<div>" + '<div class="toolbar">' + (L.length ? chips("bCats", cats, "분류") : "<span></span>") + '<a class="btn solid" href="#write">글쓰기</a></div>' +
      (L.length ? '<div class="tablebox"><table class="spec board"><thead><tr><th class="r">번호</th><th>분류</th><th>제목</th><th>작성자</th><th class="r">날짜</th></tr></thead><tbody id="bList">' +
        L.map(function (b) {
          var cc = b.comments && b.comments[0] ? b.comments[0].count : 0;
          return '<tr data-no="' + b.id + '" data-cat="' + esc(b.cat) + '" tabindex="0"><td class="r num no">' + b.id + '</td><td class="cat"><span class="tag">' + esc(b.cat) + '</span></td><td class="title">' + esc(b.title) + (cc ? ' <span class="muted num">[' + cc + "]</span>" : "") + '</td><td class="who">' + esc(b.author_label) + '</td><td class="r num when">' + fmtDate(b.created_at).slice(5) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : empty("아직 게시글이 없습니다", "첫 글을 남겨주세요.")) + "</div>" +
      '<div id="write">' + head("글쓰기", '<span class="note">작성자: ' + esc(API.profile.nickname ? API.profile.nickname + " · " + API.profile.unit_id : API.profile.unit_id) + ' · <a href="account.html">닉네임 설정</a></span>') +
      '<form class="panel" id="wForm"><div class="field"><label for="wCat">분류</label><select id="wCat">' + cats.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="wTitle">제목</label><input id="wTitle" maxlength="80" required></div>' +
      '<div class="field"><label for="wBody">내용</label><textarea id="wBody" maxlength="5000" required></textarea></div>' +
      '<button class="btn solid" type="submit">등록</button><p class="notice-box" id="wMsg" role="status" hidden style="margin-top:12px"></p></form></div>';
    async function show(id) {
      var b = await API.post(id), v = el("postView");
      if (!b) { v.hidden = false; v.innerHTML = empty("글을 찾을 수 없습니다", "삭제되었을 수 있습니다."); return; }
      var mine = b.author_id === API.session.user.id;
      v.innerHTML = '<article class="panel post"><span class="tag">' + esc(b.cat) + '</span><h3 style="margin-top:8px">' + esc(b.title) + '</h3><div class="meta">' + esc(b.author_label) + " · " + fmtTime(b.created_at) + '</div><div class="content">' + esc(b.body) + "</div>" +
        '<ul class="comments">' + (b.comments.length ? b.comments.map(function (c) { var cm = c.author_id === API.session.user.id || API.isAdmin; return "<li><b>" + esc(c.author_label) + "</b>" + esc(c.body) + ' <span class="muted small">' + fmtTime(c.created_at) + "</span>" + (cm ? ' <button type="button" class="linkbtn delc" data-id="' + c.id + '">삭제</button>' : "") + "</li>"; }).join("") : '<li class="muted">아직 댓글이 없습니다.</li>') + "</ul>" +
        '<form id="cForm" class="find" style="margin-top:10px"><label for="cBody" class="sr">댓글</label><input id="cBody" maxlength="1000" placeholder="댓글 쓰기" style="flex:1;width:auto;min-width:0"><button class="btn" type="submit">등록</button></form>' +
        '<p class="cta-row" style="margin:14px 0 0"><button type="button" class="btn" id="closePost">목록으로</button>' + (mine || API.isAdmin ? '<button type="button" class="btn danger" id="delPost">글 삭제</button>' : "") + '</p><p class="notice-box" id="vMsg" role="status" hidden></p></article>';
      v.hidden = false; v.scrollIntoView({ block: "start" });
      el("closePost").addEventListener("click", function () { v.hidden = true; history.replaceState(null, "", "#"); });
      el("cForm").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.addComment(b.id, el("cBody").value); await show(b.id); } catch (err) { say("vMsg", API.errorText(err), true); } });
      v.querySelectorAll(".delc").forEach(function (x) { x.addEventListener("click", async function () { try { await API.deleteComment(Number(x.dataset.id)); await show(b.id); } catch (err) { say("vMsg", API.errorText(err), true); } }); });
      if (el("delPost")) el("delPost").addEventListener("click", async function () {
        var btn = this;
        if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "한 번 더 누르면 삭제됩니다"; return; }
        try { await API.deletePost(b.id); history.replaceState(null, "", "#"); await R.board(); } catch (err) { say("vMsg", API.errorText(err), true); }
      });
    }
    if (L.length) {
      el("bList").addEventListener("click", function (e) { var tr = e.target.closest("tr"); if (tr) { history.replaceState(null, "", "#p" + tr.dataset.no); show(tr.dataset.no); } });
      el("bList").addEventListener("keydown", function (e) { if (e.key === "Enter") { var tr = e.target.closest("tr"); if (tr) show(tr.dataset.no); } });
      bindChips("bCats", filterBy("bList", "tr"));
      var hm = location.hash.match(/^#p(\d+)$/); if (hm) show(hm[1]);
    }
    el("wForm").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button[type=submit]"); busy(btn, true, "등록 중…");
      try { var p = await API.createPost({ cat: el("wCat").value, title: el("wTitle").value, body: el("wBody").value }); history.replaceState(null, "", "#p" + p.id); await R.board(); }
      catch (err) { busy(btn, false); say("wMsg", API.errorText(err), true); }
    });
  };

  /* 입주민 오픈채팅: 바로가기를 누르면 위임 세대에게는 비밀번호를 보여주고 바로 카톡방으로 */
  function sheet(html) {
    var o = el("sheet"); if (o) o.remove();
    o = document.createElement("div"); o.id = "sheet"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
    o.innerHTML = '<div class="sheet-box">' + html + '<button type="button" class="sheet-x" aria-label="닫기">×</button></div>';
    document.body.appendChild(o);
    var close = function () { o.remove(); document.removeEventListener("keydown", key); }, key = function (e) { if (e.key === "Escape") close(); };
    o.addEventListener("click", function (e) { if (e.target === o || e.target.closest(".sheet-x")) close(); });
    document.addEventListener("keydown", key);
    return o;
  }
  async function openChat() {
    if (!LIVE) return;
    if (!API.isDelegate && !API.isAdmin) {
      sheet('<b class="sheet-t">위임동의 세대 전용 채팅방입니다</b><p class="muted">비밀번호가 걸린 채팅방이라, 위임동의를 마친 세대에게만 입장 비밀번호를 알려드립니다.</p>' +
        '<p class="cta-row">' + (!API.loggedIn ? '<a class="btn solid" href="login.html">로그인</a>' : API.consentOpen ? '<a class="btn solid" href="consent.html">위임동의서 제출</a>' : '<span class="muted small">' + esc(consentOpenLabel()) + " 공급계약 후 위임동의서를 낼 수 있습니다.</span>") + "</p>");
      return;
    }
    var c = await API.chatInfo().catch(function () { return null; });
    if (!c || !c.url) { sheet('<b class="sheet-t">채팅방을 준비하고 있습니다</b><p class="muted">열리면 이 버튼으로 바로 들어갈 수 있습니다.</p>'); return; }
    if (!c.password) { location.href = c.url; return; }
    var o = sheet('<b class="sheet-t">입주민 오픈채팅</b><p class="muted small">채팅방에 들어갈 때 아래 비밀번호를 붙여 넣으세요.</p>' +
      '<div class="chat-pw"><span class="muted small">입장 비밀번호</span><b class="num" id="chatPw">' + esc(c.password) + "</b></div>" +
      '<p class="cta-row"><a class="btn solid" id="chatGo" href="' + esc(safeUrl(c.url)) + '">비밀번호 복사하고 입장</a></p>' +
      '<p class="muted small" style="margin:0">' + (API.isDelegate ? "비밀번호는 위임 세대끼리만 나눠 주세요." : "운영진이라 위임 전에도 보입니다.") + "</p>");
    o.querySelector("#chatGo").addEventListener("click", function () { try { navigator.clipboard.writeText(c.password); } catch (e) { /* 복사 안 돼도 입장 */ } });
  }
  function bindChatTiles() { document.querySelectorAll('.tile[href="#chat"]').forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); openChat(); }); }); }

  R.links = async function () {
    var CT = arr(S.contacts);
    C.innerHTML = "<div>" + head("바로가기") + '<div class="tiles">' + arr(S.links).map(tile).join("") + "</div></div>" +
      (CT.length ? "<div>" + head("문의처") + '<div class="tablebox"><table class="spec kv">' + CT.map(function (c) { return "<tr><th>" + esc(c[0]) + '</th><td class="num sel-all">' + esc(c[1]) + "</td></tr>"; }).join("") + "</table></div></div>" : "") +
      '<div class="two"><div>' + (arr(S.links).some(function (l) { return /카페/.test(l.title) && l.url; })
        ? head("공식 카페 가입") + '<ol class="steps">' +
          "<li><div><b>카페 가입</b><span>닉네임은 \"동-호수 끝자리/닉네임\" 형식을 권장합니다. 예: 403-18xx/창릉새집</span></div></li>" +
          '<li><div><b>입주예정자 확인</b><span>입주예정자 확인은 <a href="login.html#signup">이 홈페이지 회원가입</a>으로 합니다. 카페에 계약서를 따로 올리지 않아도 됩니다.</span></div></li>' +
          '<li><div><b>오픈채팅 참여</b><span>위임동의를 마친 세대는 위 "입주민 오픈채팅"을 누르면 입장 비밀번호와 함께 바로 들어갈 수 있습니다.</span></div></li></ol>'
        : head("입주예정자 확인") + '<p class="muted">입주예정자 확인은 <a href="login.html#signup">이 홈페이지 회원가입</a>으로 합니다. 동·호수를 고르고 계약서 사진을 올리면 운영진이 확인합니다. 공식 카페와 오픈채팅은 개설되면 이곳에 연결합니다.</p>') + "</div>" +
      "<div>" + head("휴대폰 홈 화면에 추가") +
      '<p class="muted"><b class="fg">아이폰(사파리)</b> 하단 공유 버튼을 누르고 "홈 화면에 추가"를 선택합니다.</p>' +
      '<p class="muted"><b class="fg">안드로이드(크롬)</b> 오른쪽 위 메뉴에서 "홈 화면에 추가"를 선택합니다.</p></div></div>';
    bindChatTiles();
    if (location.hash === "#chat") openChat();
  };

  R.calculator = function () {
    var TY = arr(S.types), hasOpt = S.options && typeof S.options === "object";
    C.innerHTML = '<div class="two"><form class="panel" id="cForm" novalidate>' +
      '<div class="field"><label for="cPrice">분양가</label><input id="cPrice" class="big num" inputmode="numeric" autocomplete="off"></div>' +
      '<div class="chips" role="group" aria-label="타입별 최고 분양가 불러오기" id="cChips" style="margin:-4px 0 16px">' + TY.map(function (t, i) { return '<button type="button" class="chip" data-p="' + t.maxPrice + '" data-area="' + esc(t.area) + '" aria-pressed="' + (i === 0) + '">' + esc(t.type) + "</button>"; }).join("") + "</div>" +
      (hasOpt ? '<fieldset class="ck opts"><legend>유상옵션 선택</legend><div id="cOptList"></div></fieldset>' : "") +
      '<div class="field"><label for="cOpt">유상옵션 합계</label><input id="cOpt" class="big num" inputmode="numeric" value="0" autocomplete="off"></div>' +
      '<div class="field"><label for="cBal">발코니 확장비용 <span class="muted small">모집공고 발코니 확장금액 표 · 분양가와 별도</span></label><input id="cBal" class="big num" inputmode="numeric" value="0" autocomplete="off"></div>' +
      '<label class="check"><input type="checkbox" id="cFirst"> 생애최초 주택 구입 감면 (현행 최대 200만원 · 2028년 말까지 취득분)</label>' +
      '<p class="muted small" style="margin:12px 0 0">타입 버튼은 모집공고의 타입별 최고가를 불러옵니다. 실제 금액은 계약서의 동·층별 분양가로 입력하세요.</p></form>' +
      "<div>" + head("회차별 납부액") + '<div class="tablebox"><table class="spec"><thead><tr><th>구분</th><th class="r">비율</th><th class="r">금액</th><th class="r">누적</th></tr></thead><tbody id="cPay"></tbody></table></div></div></div>' +
      '<div class="two"><div>' + head("예상 취득세", '<span class="note">1주택 · 전용 85㎡ 이하</span>') + '<div class="tablebox"><table class="spec"><tbody id="cTax"></tbody></table></div></div>' +
      '<div><h3 style="margin-bottom:8px">계산 기준</h3><p class="muted small">과세표준은 분양가, 유상옵션, 발코니 확장비용을 합한 금액입니다. 취득세율은 6억 이하 1%, 6억 초과 9억 이하 (금액×2/3억 − 3)%, 9억 초과 3%로 계산했습니다. 지방교육세는 취득세의 10%이며, 전용 85㎡ 이하는 농어촌특별세가 없습니다.</p>' +
      '<p class="muted small">취득세는 잔금을 내는 입주 시점(2030년 예정)의 법으로 매겨집니다. 생애최초 감면은 현행법상 2028년 12월 31일까지 취득분에 적용되므로, 입주 때 연장되었는지 확인이 필요합니다. 2026년 정부 개편안(40세 미만 한도 300만원 등)은 아직 확정 전입니다.</p>' +
      '<p class="muted small">세율과 감면 요건은 바뀔 수 있으니 실제 신고 전 <a href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스</a>나 세무 전문가에게 확인하세요.</p></div></div>';
    var P = el("cPrice"), O = el("cOpt"), BL = el("cBal"), F = el("cFirst");
    function val(i) { return Number(String(i.value).replace(/[^0-9]/g, "")) || 0; }
    function fmtIn(i) { var d = i.value.replace(/[^0-9]/g, "").slice(0, 12); i.value = d ? n(Number(d)) : ""; }
    function render() {
      var p = val(P), o = val(O), bl = val(BL), base = p + o + bl;
      var rows = [["계약금", 0.1]]; for (var i = 1; i <= 6; i++) rows.push(["중도금 " + i + "회", 0.1]); rows.push(["잔금", 0.3]);
      var acc = 0;
      el("cPay").innerHTML = rows.map(function (r, i) { var a = p * r[1] + (i === 0 ? bl * 0.1 : 0); acc += a; return "<tr><td>" + r[0] + (i === 0 && bl ? '<br><span class="muted small">발코니 10% 포함</span>' : "") + '</td><td class="r num">' + Math.round(r[1] * 100) + '%</td><td class="r num">' + eok(a) + '</td><td class="r num">' + eok(acc) + "</td></tr>"; }).join("") +
        (bl ? '<tr><td>발코니 확장 나머지<br><span class="muted small">중도금 · 잔금 때 나눠 냄</span></td><td class="r num">-</td><td class="r num">' + eok(bl * 0.9) + '</td><td class="r num">' + eok(acc += bl * 0.9) + "</td></tr>" : "") +
        (o ? '<tr><td>유상옵션</td><td class="r num">-</td><td class="r num">' + eok(o) + '</td><td class="r num">' + eok(acc += o) + "</td></tr>" : "") +
        '<tr class="total"><td colspan="2">합계</td><td class="r num" colspan="2">' + eok(base) + "</td></tr>";
      var rate = base <= 6e8 ? 0.01 : base <= 9e8 ? (base / 1e8 * 2 / 3 - 3) / 100 : 0.03;
      var tax = base * rate, relief = F.checked ? Math.min(tax, 2e6) : 0, edu = tax * 0.1;
      el("cTax").innerHTML =
        '<tr><th>과세표준</th><td class="r num">' + eok(base) + "</td></tr>" +
        '<tr><th>취득세율</th><td class="r num">' + (base ? (rate * 100).toFixed(2) : "0.00") + "%</td></tr>" +
        '<tr><th>취득세</th><td class="r num">' + n(Math.round(tax)) + "원</td></tr>" +
        (relief ? '<tr><th>생애최초 감면</th><td class="r num">−' + n(Math.round(relief)) + "원</td></tr>" : "") +
        '<tr><th>지방교육세</th><td class="r num">' + n(Math.round(edu)) + "원</td></tr>" +
        '<tr class="total"><td>합계 (예상)</td><td class="r num">' + n(Math.round(tax - relief + edu)) + "원</td></tr>";
    }
    function optList(area) {
      if (!hasOpt) return;
      var L = arr(S.options[area]);
      el("cOptList").innerHTML = L.length ? L.map(function (o, i) {
        return '<div class="optrow"><label class="check" for="op' + i + '"><input type="checkbox" id="op' + i + '"> ' + esc(o[0]) + '</label><input class="num optamt" id="opa' + i + '" inputmode="numeric" aria-label="' + esc(o[0]) + ' 금액" value="' + n(o[1]) + '"></div>';
      }).join("") : '<p class="muted small">이 면적의 옵션 정보가 없습니다.</p>';
      sumOpts();
    }
    function sumOpts() {
      if (!hasOpt) return;
      var s = 0;
      el("cOptList").querySelectorAll(".optrow").forEach(function (r) { if (r.querySelector("input[type=checkbox]").checked) s += val(r.querySelector(".optamt")); });
      O.value = n(s); render();
    }
    if (hasOpt) {
      el("cOptList").addEventListener("input", function (e) { if (e.target.classList.contains("optamt")) fmtIn(e.target); sumOpts(); });
      el("cOptList").addEventListener("change", sumOpts);
    }
    el("cForm").addEventListener("submit", function (e) { e.preventDefault(); });
    P.addEventListener("input", function () { fmtIn(P); el("cChips").querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); }); render(); });
    O.addEventListener("input", function () { fmtIn(O); render(); });
    BL.addEventListener("input", function () { fmtIn(BL); render(); });
    F.addEventListener("change", render);
    el("cChips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      el("cChips").querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      P.value = n(Number(b.dataset.p)); optList(b.dataset.area); render();
    });
    P.value = TY.length ? n(TY[0].maxPrice) : "";
    optList(TY.length ? TY[0].area : "");
    render();
  };

  R.checklist = function () {
    var KEY = "s4-checklist", saved = {}, total = 0;
    try { saved = JSON.parse(store(KEY) || "{}") || {}; } catch (e) { saved = {}; }
    C.innerHTML = '<div class="toolbar"><div class="meter" style="margin:0;flex:1;min-width:220px"><div class="row"><span>점검 진행률</span><b class="num" id="ckPct">0%</b></div><div class="bar-track"><i id="ckBar" style="width:0%"></i></div></div>' +
      '<button type="button" class="btn" id="ckReset">체크 모두 지우기</button></div>' +
      '<div class="ck-grid">' + arr(S.checklist).map(function (g, gi) {
        return '<fieldset class="ck"><legend>' + esc(g.room) + "</legend>" + arr(g.items).map(function (it, ii) {
          total++; var id = "ck" + gi + "-" + ii;
          return '<label class="check" for="' + id + '"><input type="checkbox" id="' + id + '"' + (saved[id] ? " checked" : "") + "> " + esc(it) + "</label>";
        }).join("") + "</fieldset>";
      }).join("") + "</div>" +
      '<div class="two"><div><h3 style="margin-bottom:8px">챙겨갈 준비물</h3><p class="muted">마스킹테이프(하자 표시), 수평계 앱, 멀티탭 테스터, 줄자, 손전등, 물 한 병(배수 확인), 휴대폰 충전기</p></div>' +
      '<div><h3 style="margin-bottom:8px">하자 접수 팁</h3><p class="muted">하자 부위는 테이프로 표시하고 멀리서 한 장, 가까이서 한 장 찍습니다. 사진에 동·호수와 위치를 메모해 두면 접수가 빨라집니다.</p></div></div>';
    function update(persist) {
      var on = 0, st = {};
      C.querySelectorAll(".ck input").forEach(function (b) { if (b.checked) { on++; st[b.id] = 1; } });
      var q = pct(on, total);
      el("ckPct").textContent = on + " / " + total + " · " + q.toFixed(0) + "%";
      el("ckBar").style.width = q.toFixed(1) + "%";
      if (persist) store(KEY, JSON.stringify(st));
    }
    C.addEventListener("change", function (e) { if (e.target.matches(".ck input")) update(true); });
    el("ckReset").addEventListener("click", function () { C.querySelectorAll(".ck input").forEach(function (b) { b.checked = false; }); update(true); });
    update(false);
  };

  R.documents = function () {
    var L = arr(S.documents);
    if (!L.length) { C.innerHTML = empty("등록된 자료가 없습니다", ""); return; }
    var cats = uniq(L.map(function (d) { return d.cat; }));
    C.innerHTML = "<div>" + '<div class="toolbar">' + chips("dCats", cats, "분류") + "</div>" +
      '<ul class="list" id="dList">' + L.map(function (d) {
        var t = d.url ? '<a href="' + esc(safeUrl(d.url)) + '" target="_blank" rel="noopener">' + esc(d.title) + "</a>" : esc(d.title);
        return '<li data-cat="' + esc(d.cat) + '"><span class="tag">' + esc(d.cat) + '</span><span class="t">' + t + '<br><span class="muted small">' + esc(d.src) + '</span></span><span class="d num">' + esc(d.date) + "</span></li>";
      }).join("") + "</ul>" +
      '<p class="muted small" style="margin-top:12px">협의회가 정리한 자료(옵션 비교표, 계약 체크리스트 등)는 만들어지는 대로 추가합니다.</p></div>';
    bindChips("dCats", filterBy("dList", "li"));
  };

  R.faq = function () {
    var L = arr(S.faq), cats = uniq(L.map(function (f) { return f.cat; }));
    C.innerHTML = "<div>" + '<div class="toolbar">' + chips("fCats", cats, "분류") + "</div>" +
      '<div class="rows" id="fList">' + L.map(function (x) { return '<details class="row faq" data-cat="' + esc(x.cat) + '"><summary><span class="t">' + esc(x.q) + '</span></summary><p class="body">' + esc(x.a) + "</p></details>"; }).join("") + "</div>" +
      '<p class="muted small" style="margin-top:16px">찾는 답이 없으면 공식 카페에 질문을 남겨주세요.</p></div>';
    bindChips("fCats", filterBy("fList", "details"));
  };

  R.privacy = function () {
    var rows = [
      ["회원가입", "동 · 호수(아이디), 비밀번호(암호화 저장), 계약서 사진, 가입 · 접속 기록, 닉네임(선택)", "입주예정자 확인, 1세대 1계정 관리", "계약서 사진은 운영진 확인(승인 · 반려) 즉시 삭제. 나머지는 탈퇴 또는 협의회 해산 시까지. 가입 · 승인 · 반려 기록(세대 · 일시 · 처리자)은 분쟁 대비로 해산 시까지"],
      ["위임동의서", "주택형 · 동 · 호수, 계약자 성명, 휴대전화번호, 카페 닉네임(선택), 서명, 동의 일시, 공동명의자 성명 · 서명(공동명의자 본인이 서명할 때만) (서면 접수 시 위임장 스캔본)", "계약자 확인, 과반수 동의 집계, 협의회 공지 · 의견수렴 · 투표", "동의 철회 또는 입주자대표회의 인계 완료 · 협의회 해산 시 지체 없이 파기 (제출 · 철회 기록은 분쟁 대비로 해산 시까지)"],
      ["카페 등업", "네이버 카페 닉네임(선택), 등업 처리 기록", "공식 카페 회원 등급 관리", "닉네임 삭제 · 탈퇴 또는 협의회 해산 시까지"],
      ["회비", "협의회 통장 거래내역(입금 일시 · 금액 · 입금자명), 세대별 납부 여부", "회비 납부 확인, 회계 공개(월별 합계만 공개, 입금자 이름은 비공개)", "협의회 해산 시 결산 · 인계 후 파기"],
      ["게시판 · 투표 · 민원", "작성 글과 댓글, 세대별 투표 · 참여 여부", "커뮤니티 운영, 1세대 1표 집계", "삭제 시 또는 협의회 해산 시까지"]
    ];
    var LB = ["구분", "항목", "목적", "보유 기간"];
    C.innerHTML = "<div>" + head("수집 항목과 보유 기간") + '<div class="tablebox"><table class="spec stack"><thead><tr><th>구분</th><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead><tbody>' +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return '<td data-label="' + LB[i] + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></div>" +
      '<div class="two"><div>' + head("제3자 제공") + '<p class="muted">회원 정보(동 · 호수, 성명, 연락처, 서명 등)는 LH · 시공사 · 관계기관 · 법무법인 등 외부에 제공하지 않습니다(회칙 제33조). 협의 · 민원에서 대표성을 보일 때는 동별 위임 세대 수만 알립니다.</p>' +
      head("처리 위탁 · 국외 이전") + '<ul class="muted plain-list"><li><b>Supabase Inc.</b> (미국, support@supabase.com) — 회원 정보 · 위임동의 · 게시글 · 계약서 사진 저장과 로그인 처리. 데이터는 서울(대한민국) 리전에 저장되며, 회원가입 · 이용 시 인터넷으로 전송됩니다. 보유 기간은 위 표와 같습니다.</li>' +
      '<li><b>GitHub Inc.</b> (미국) — 홈페이지 호스팅과 LH 공고문 자동 읽기. 회원 개인정보는 다루지 않으며, 접속 기록(IP 등)이 남을 수 있습니다.</li></ul>' +
      '<p class="muted small">위 이전은 서비스 제공에 필요한 처리로, 원하지 않으면 회원가입을 하지 않거나 탈퇴하면 됩니다.</p></div>' +
      "<div>" + head("공개 범위") + '<p class="muted">누구나 볼 수 있는 것은 동별 위임 세대수뿐입니다. 세대별 위임 여부는 승인된 회원과 운영진에게만 보입니다. 게시판 작성자는 승인된 회원에게만 "동-호"(닉네임을 정하면 "닉네임 · 동-호")로 표시합니다.</p>' +
      head("권리 행사") + '<p class="muted">위임동의 철회는 내 정보 화면에서 바로 할 수 있습니다. 회원 정보 열람 · 정정 · 삭제(탈퇴)는 운영진에게 요청하면 지체 없이 처리합니다.</p>' +
      head("파기 · 안전 조치") + '<p class="muted">보유 기간이 끝나거나 철회 · 탈퇴하면 데이터베이스에서 즉시 삭제합니다. 비밀번호는 암호화해 저장하고, 계약서 사진은 운영진만 열람할 수 있는 비공개 저장소에 두었다가 확인 즉시 삭제합니다. 로그인 상태 유지를 위해 브라우저 저장소에 로그인 정보를 저장합니다.</p>' +
      head("개인정보 보호책임자") + '<p class="muted">' + esc((S.privacyOfficer && S.privacyOfficer.role) || "협의회 운영진 대표") + (S.privacyOfficer && S.privacyOfficer.contact ? " · " + esc(S.privacyOfficer.contact) : " · 연락처는 공지사항으로 안내합니다") + '</p></div></div>' +
      '<p class="muted small">시행일: ' + esc(S.updated) + ". 내용이 바뀌면 이 페이지와 공지사항으로 알립니다.</p>";
  };

  /* ── 로그인 · 회원가입 ── */
  /* 위임동의 입력칸 (가입 화면 p="c", 위임동의서 화면 p="a") */
  function consentFields(p, withDoc) {
    return '<fieldset class="consent-in"><legend>위임동의서 <span class="tag hot">필수</span></legend>' +
      (withDoc ? '<p class="muted small" style="margin:0 0 8px">입주예정자협의회는 위임한 세대의 뜻을 모아 LH · 시공사와 협의합니다. 운영진 승인 후 위임동의 현황판에 반영됩니다. 철회는 언제든 내 정보에서 할 수 있습니다.</p>' +
        '<details class="terms"><summary>위임동의서 전문 보기</summary><div class="body">' + CONSENT.map(function (c) { return "<b>" + esc(c[0]) + "</b>\n" + esc(c[1]); }).join("\n\n") + "</div></details>" : "") +
      '<div class="field"><label for="' + p + 'Name">계약자 성명</label><input id="' + p + 'Name" maxlength="30" autocomplete="name"></div>' +
      '<div class="field"><label for="' + p + 'Phone">휴대전화번호</label><input id="' + p + 'Phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13"></div>' +
      '<div class="field"><label for="' + p + 'Cafe">카페 닉네임 <span class="muted small">선택 · 적으면 카페 등업에 씁니다</span></label><input id="' + p + 'Cafe" maxlength="30" autocomplete="off" value="' + esc(((API.profile || {}).cafe_nick) || "") + '"></div>' +
      '<div class="field"><label for="' + p + 'Sig">서명 (계약자) <span class="muted small">손가락이나 마우스로 이름을 쓰듯 서명하세요</span></label>' +
      '<div class="sigpad"><canvas id="' + p + 'Sig" width="600" height="200" aria-label="계약자 서명 칸"></canvas><button type="button" class="linkbtn" id="' + p + 'SigClear">지우기</button></div></div>' +
      '<label class="check" for="' + p + 'Co"><input type="checkbox" id="' + p + 'Co"> 공동명의자도 함께 서명합니다 <span class="muted small">(공동명의자 본인이 직접 쓰는 경우에만)</span></label>' +
      '<div id="' + p + 'CoBox" hidden><div class="field"><label for="' + p + 'CoName">공동명의자 성명</label><input id="' + p + 'CoName" maxlength="30"></div>' +
      '<div class="field"><label for="' + p + 'CoSig">공동명의자 서명</label><div class="sigpad"><canvas id="' + p + 'CoSig" width="600" height="200" aria-label="공동명의자 서명 칸"></canvas><button type="button" class="linkbtn" id="' + p + 'CoSigClear">지우기</button></div></div></div>' +
      '<label class="check" for="' + p + 'Del"><input type="checkbox" id="' + p + 'Del"> 제1조~제5조 (가입 · 회칙 · 위임 내용)에 동의합니다 (필수)</label>' +
      '<label class="check" for="' + p + 'Priv"><input type="checkbox" id="' + p + 'Priv"> 개인정보 수집 · 이용에 동의합니다 (필수)</label>' +
      '<label class="check" for="' + p + 'Id"><input type="checkbox" id="' + p + 'Id"> 본인은 이 세대의 계약자 본인 또는 공동명의자임을 확인합니다 (필수)</label></fieldset>';
  }
  var SIG = {};
  function sigPad(id) {
    var c = el(id), ctx = c.getContext("2d"), drawing = false, strokes = 0, last = null;
    function pt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
    function clear() { ctx.clearRect(0, 0, c.width, c.height); strokes = 0; }
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a1a1a";
    c.addEventListener("pointerdown", function (e) { e.preventDefault(); drawing = true; last = pt(e); try { c.setPointerCapture(e.pointerId); } catch (er) {} });
    c.addEventListener("pointermove", function (e) { if (!drawing) return; e.preventDefault(); var q = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x, q.y); ctx.stroke(); last = q; strokes++; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { c.addEventListener(t, function () { drawing = false; }); });
    el(id + "Clear").addEventListener("click", clear);
    return { empty: function () { return strokes < 8; }, data: function () { return strokes < 8 ? null : c.toDataURL("image/png"); } };
  }
  function bindConsent(p) {
    SIG[p] = sigPad(p + "Sig"); SIG[p + "Co"] = sigPad(p + "CoSig");
    el(p + "Co").addEventListener("change", function () { el(p + "CoBox").hidden = !this.checked; });
  }
  function consentValues(p) {
    var co = el(p + "Co").checked;
    return { signer: el(p + "Name").value, signature: SIG[p] ? SIG[p].data() : null, delegation: el(p + "Del").checked, privacy: el(p + "Priv").checked,
      thirdParty: false, contact: true, phone: el(p + "Phone").value, cafeNick: el(p + "Cafe").value, identity: el(p + "Id").checked,
      coOwner: co, coName: co ? el(p + "CoName").value : "", coSignature: co && SIG[p + "Co"] ? SIG[p + "Co"].data() : null };
  }

  /* 위임장 보기 · 인쇄 (본인 사본 · 운영진 출력 · 빈 서면 양식) */
  function wiDoc(a) {
    var blank = !a, u = blank ? null : UNIT[a.unit_id];
    var box = function (on) { return '<span class="pbox">' + (on ? "✓" : "") + "</span>"; };
    var line = function (v) { return blank ? '<span class="sigline"></span>' : esc(v || "-"); };
    var sig = function (src, paperNote) { return blank ? '<span class="sigline"></span> (서명)' : src ? '<img src="' + esc(src) + '" alt="서명">' : paperNote; };
    return '<article class="wi-doc"><p class="wi-sub">고양창릉 S-4블록 공공분양주택</p><h1>입주예정자협의회 가입 및 위임 동의서</h1>' +
      '<ol class="wi-pre">' + CONSENT_PRE.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
      "<section><h2>단지 개요</h2>" + consentOverview() + "</section>" +
      CONSENT.map(function (c) { return "<section><h2>" + esc(c[0]) + "</h2><p>" + esc(c[1]) + "</p></section>"; }).join("") +
      '<ul class="wi-checks"><li>' + box(!blank) + " 제1조~제5조 (입예협 구성 · 회칙 · 위임 내용)에 동의합니다 (필수)</li><li>" + box(!blank) + " 개인정보 수집 · 이용에 동의합니다 (필수)</li><li>" +
        box(!blank) + " 본인은 이 세대의 계약자 본인 또는 공동명의자입니다 (필수)</li></ul>" +
      '<p class="wi-oath">' + esc(CONSENT_OATH) + "</p>" +
      '<table class="wi-head"><tr><th>주택형</th><td>' + (blank ? "□ 59㎡ &nbsp; □ 74㎡ &nbsp; □ 84㎡" : esc(u ? u.type : "")) + "</td></tr>" +
      "<tr><th>동 / 호수</th><td>" + (blank ? "_______ 동 _______ 호" : esc(u ? u.dong + "동 " + u.ho + "호" : a.unit_id)) + "</td></tr>" +
      "<tr><th>계약자 성명</th><td>" + line(a && a.signer_name) + "</td></tr>" +
      "<tr><th>휴대전화번호</th><td>" + line(a && a.phone) + "</td></tr>" +
      "<tr><th>카페 닉네임</th><td>" + line(a && a.cafe_nick) + "</td></tr>" +
      "<tr><th>서명 (계약자)</th><td>" + sig(a && a.signature, "서면 위임장 원본 보관") + "</td></tr>" +
      "<tr><th>공동명의자 성명 · 서명<br><span class=\"muted\">(본인 직접 작성 시에만)</span></th><td>" + (blank ? '(성명) <span class="sigline"></span> (서명) <span class="sigline"></span>' : a.co_name ? esc(a.co_name) + " " + sig(a.co_signature, "") : "-") + "</td></tr>" +
      "<tr><th>일시</th><td>" + (blank ? "2026 년 ___ 월 ___ 일" : esc(fmtTime(a.signed_at))) + "</td></tr></table>" +
      '<p class="wi-to">' + esc(CONSENT_TO) + "</p>" +
      '<p class="wi-foot">' + (blank ? "작성 후 사진 또는 스캔하여 changneung.s4@gmail.com 으로 보내 주세요. 주민등록번호 · 계좌번호는 적지 마세요." :
        (a.source === "paper" ? "서면 접수" : "온라인 전자서명") + " · 문서 번호 " + esc(String(a.doc_hash || "").slice(0, 16)) + " · 양식 " + esc(a.form_version || "")) + "</p></article>";
  }
  function showPrint(html, title) {
    var v = el("printView"); if (v) v.remove();
    v = document.createElement("div"); v.id = "printView"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", title || "위임장");
    v.innerHTML = '<div class="pv-bar"><b>' + esc(title || "위임장") + '</b><span><button type="button" class="btn solid" id="pvPrint">인쇄 / PDF로 저장</button> <button type="button" class="btn" id="pvClose">닫기</button></span></div><div class="pv-body">' + html + "</div>";
    document.body.appendChild(v); document.body.classList.add("printing");
    el("pvPrint").addEventListener("click", function () { window.print(); });
    el("pvClose").addEventListener("click", function () { v.remove(); document.body.classList.remove("printing"); });
  }
  window.S4_showBlankForm = function () { showPrint(wiDoc(null), "서면 위임장 양식"); };

  R.login = async function () {
    var PREVIEW = !LIVE;
    var needsProfile = !PREVIEW && API.loggedIn && !API.profile;
    if (!PREVIEW && API.loggedIn && !needsProfile) { location.replace("account.html"); return; }
    var tab = needsProfile || location.hash === "#signup" ? "signup" : "login";
    var closed = !PREVIEW && !needsProfile && !API.consentOpen;   // 가입은 공급계약 시작부터
    var fileField = '<div class="field"><label for="sFile">계약서 사진 <span class="muted small">첫 장, 동 · 호수와 계약자 이름만 보이게 나머지는 가려주세요 · <b>주민등록번호는 반드시 가리세요</b> · 5MB 이하</span></label><input id="sFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required></div>';
    var privacy = '<details class="terms"><summary>개인정보 수집 · 이용 안내 보기</summary><p class="body">' + esc(PRIVACY_SIGNUP) + "</p></details>" +
      '<label class="check" for="sPriv"><input type="checkbox" id="sPriv"> 개인정보 수집 · 이용에 동의합니다 (필수)</label>';
    C.innerHTML =
      '<div class="auth-wrap">' +
      (PREVIEW ? '<div class="notice-box" style="margin-bottom:14px">미리보기 화면입니다. 서버가 연결되기 전이라 실제로 가입 · 로그인되지는 않습니다.</div>' : "") +
      (needsProfile ? "" : '<div class="tabs" role="tablist"><button type="button" role="tab" id="tLogin" aria-selected="' + (tab === "login") + '">로그인</button><button type="button" role="tab" id="tSignup" aria-selected="' + (tab === "signup") + '">회원가입</button></div>') +

      '<form class="panel" id="fLogin"' + (tab === "login" ? "" : " hidden") + ' novalidate>' +
      unitPicker("l") +
      '<div class="field"><label for="lPw">비밀번호</label><input id="lPw" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn solid wide" type="submit">로그인</button><p class="notice-box" id="lMsg" role="alert" hidden></p>' +
      '<p class="muted small" style="margin:12px 0 0">비밀번호를 잊었다면 운영진에게 문의하세요. 본인 확인 후 다시 가입할 수 있게 도와드립니다.</p></form>' +

      (closed ? '<div class="panel" id="fSignup"' + (tab === "signup" ? "" : " hidden") + '><div class="empty" style="border:0;padding:8px 0"><b>가입은 ' + esc(consentOpenLabel()) + ' 공급계약 시작과 함께 받습니다</b><span>계약을 마친 계약자만 가입하도록 해, 계약을 포기한 세대가 섞이지 않게 하려는 것입니다. 가입할 때 계약서 첫 장 사진이 필요합니다. 그 전에도 공지 · LH 공고 · 일정 · FAQ · 계산기는 누구나 볼 수 있습니다.</span><p class="cta-row" style="margin-top:8px"><a class="btn" href="notice.html">공지사항 보기</a><a class="btn" href="faq.html">FAQ</a></p></div></div></div>' :
      '<form class="panel" id="fSignup"' + (tab === "signup" ? "" : " hidden") + ' novalidate>' +
      (needsProfile
        ? '<div class="notice-box" style="margin-bottom:14px">' + esc(unitLabel(API.accountUnit)) + " 계정은 만들어졌지만 계약서 사진이 아직 없습니다. 사진을 올려 가입을 마무리하세요.</div>"
        : '<p class="muted small" style="margin:0 0 12px">우리 집 동 · 호수가 아이디가 됩니다. 로그인할 때도 동 · 호수와 비밀번호만 넣으면 됩니다.</p>' + unitPicker("s") +
          '<div class="two" style="gap:12px"><div class="field"><label for="sPw">비밀번호 <span class="muted small">8자 이상</span></label><input id="sPw" type="password" autocomplete="new-password" required></div>' +
          '<div class="field"><label for="sPw2">비밀번호 확인</label><input id="sPw2" type="password" autocomplete="new-password" required></div></div>') +
      fileField + privacy +
      '<button class="btn solid wide" type="submit">' + (needsProfile ? "가입 마무리" : "가입 신청") + '</button><p class="notice-box" id="sMsg" role="alert" hidden></p>' +
      '<p class="muted small" style="margin:12px 0 0">운영진이 사진으로 세대를 확인해 승인하면 게시판을 이용할 수 있습니다. 위임동의서는 공급계약(' + esc(consentOpenLabel()) + '~) 후 따로 제출하며, 위임 세대는 투표 · 단체민원에 참여합니다. 한 세대에는 한 계정만 만들 수 있습니다.</p></form></div>');
    bindUnitPicker("l");
    if (!needsProfile && !closed) bindUnitPicker("s");
    function setTab(t) {
      el("fLogin").hidden = t !== "login"; el("fSignup").hidden = t !== "signup";
      el("tLogin").setAttribute("aria-selected", t === "login"); el("tSignup").setAttribute("aria-selected", t === "signup");
    }
    if (!needsProfile) {
      el("tLogin").addEventListener("click", function () { setTab("login"); history.replaceState(null, "", "#"); });
      el("tSignup").addEventListener("click", function () { setTab("signup"); history.replaceState(null, "", "#signup"); });
    }
    if (PREVIEW) {
      el("fLogin").addEventListener("submit", function (e) { e.preventDefault(); say("lMsg", "미리보기에서는 로그인되지 않습니다. 서버 연결 후 동작합니다."); });
      el("fSignup").addEventListener("submit", function (e) { e.preventDefault(); say("sMsg", "미리보기에서는 가입되지 않습니다. 서버 연결 후 동작합니다."); });
      return;
    }
    el("fLogin").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button[type=submit]"); busy(btn, true, "로그인 중…"); say("lMsg", "");
      try {
        await API.signIn(el("lHo").value, el("lPw").value);
        if (!API.profile) { location.hash = "signup"; location.reload(); return; }
        location.href = API.isMember ? "index.html" : "account.html";
      } catch (err) { busy(btn, false); say("lMsg", API.errorText(err), true); }
    });
    if (closed) return;
    el("fSignup").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button[type=submit]"); busy(btn, true, "가입 처리 중…"); say("sMsg", "");
      var o = { file: el("sFile").files[0], privacy: el("sPriv").checked };
      try {
        if (needsProfile) await API.completeProfile(o);
        else { o.unit = el("sHo").value; o.password = el("sPw").value; o.password2 = el("sPw2").value; await API.signUp(o); }
        location.href = "account.html";
      } catch (err) { busy(btn, false); say("sMsg", API.errorText(err), true); }
    });
  };

  /* ── 내 정보 ── */
  R.account = async function () {
    if (!LIVE) { C.innerHTML = gate("login"); return; }
    if (!API.loggedIn) { C.innerHTML = gate("login"); return; }
    if (!API.profile) { location.replace("login.html#signup"); return; }
    var p = API.profile, ag = p.status !== "rejected" ? await API.myAgreement() : null;
    var badge = { pending: ["tag hot", "승인 대기"], approved: ["tag", "승인됨"], rejected: ["tag off", "반려됨"] }[p.status];
    var dongLabel = p.unit_id.split("-")[0] + "동";
    C.innerHTML =
      '<div class="two"><div class="panel"><div class="acct-head"><b>' + esc(unitLabel(p.unit_id)) + '</b><span class="' + badge[0] + '">' + badge[1] + "</span>" + (API.isAdmin ? '<span class="tag">운영진</span>' : "") + "</div>" +
      '<table class="spec kv"><tr><th>아이디</th><td class="num">' + esc(p.unit_id) + "</td></tr><tr><th>게시판 표시</th><td>" + esc(p.nickname ? p.nickname + " · " + p.unit_id : p.unit_id) + "</td></tr><tr><th>가입 신청</th><td>" + fmtDate(p.created_at) + "</td></tr>" +
      (p.reviewed_at ? "<tr><th>" + (p.status === "approved" ? "승인일" : "처리일") + "</th><td>" + fmtDate(p.reviewed_at) + "</td></tr>" : "") + "</table>" +
      (p.status === "pending" ? '<p class="notice-box">운영진이 올려주신 사진으로 세대를 확인하고 있습니다. 승인되면 게시판을 이용할 수 있습니다.</p>' : "") +
      (p.status === "rejected" ? '<p class="notice-box bad">반려 사유: ' + esc(p.reject_reason || "-") + "</p>" : "") +
      '<p class="cta-row">' + (API.isAdmin ? '<a class="btn solid" href="admin.html">운영진 페이지</a>' : "") + '<button type="button" class="btn" id="logout">로그아웃</button></p></div>' +

      "<div>" + (p.status !== "rejected" ? head("위임동의") + (ag ? '<div class="panel"><p style="margin-top:0">' + fmtTime(ag.signed_at) + "에 위임동의서를 제출했습니다." + (p.status === "pending" ? " 운영진 승인 후 현황판에 반영됩니다." : "") + '</p><p class="cta-row"><a class="btn" href="agreement.html">현황판 보기</a><button type="button" class="btn" id="accWi">내 위임장 보기 · 인쇄</button> ' + (API.isDelegate ? '<button type="button" class="btn" id="accChat">입주민 오픈채팅 입장</button> ' : "") + '<button type="button" class="btn danger" id="withdraw">위임동의 철회</button></p><p class="muted small" style="margin:0">철회하면 현황판에서 바로 빠지고 투표 · 민원 참여와 세대별 현황 보기가 중지됩니다. 게시판은 계속 쓸 수 있고, 위임동의서를 다시 내면 바로 회복됩니다.</p><p class="notice-box" id="aMsg" role="status" hidden></p></div>'
        : delegateNote(true)) : "") +
      (p.status === "approved" ? '<div id="accDues"></div>' : "") +
      (p.status === "rejected" ? head("계약서 사진 다시 내기") + '<form class="panel" id="fRe" novalidate>' +
        '<div class="field"><label for="rFile">계약서 사진 <span class="muted small">첫 장 · 주민등록번호는 가리세요</span></label><input id="rFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required></div>' +
        '<button class="btn solid" type="submit">재신청</button><p class="notice-box" id="rMsg" role="alert" hidden></p>' +
        '<p class="muted small" style="margin:10px 0 0">세대를 잘못 골랐다면 운영진에게 계정 삭제를 요청한 뒤 맞는 세대로 다시 가입하세요.</p></form>' : "") +
      "</div></div>" +

      '<div class="two"><form class="panel" id="fNick" novalidate><h3 style="margin-bottom:10px">닉네임 <span class="muted small">선택</span></h3><div class="field"><label for="nNick">게시판 닉네임 <span class="muted small">비워 두면 "' + esc(p.unit_id) + '"로 표시</span></label><input id="nNick" maxlength="20" value="' + esc(p.nickname || "") + '"></div>' +
        (p.status === "approved" ? '<div class="field"><label for="nCafe">네이버 카페 닉네임 <span class="muted small">적어 두면 운영진이 확인하고 카페 등업</span></label><input id="nCafe" maxlength="30" autocomplete="off" value="' + esc(p.cafe_nick || "") + '"></div>' : "") +
        '<button class="btn" type="submit">저장</button><p class="notice-box" id="nMsg" role="status" hidden></p></form>' +
      '<form class="panel" id="fPw" novalidate><h3 style="margin-bottom:10px">비밀번호 바꾸기</h3><div class="field"><label for="pPw">새 비밀번호</label><input id="pPw" type="password" autocomplete="new-password"></div><div class="field"><label for="pPw2">새 비밀번호 확인</label><input id="pPw2" type="password" autocomplete="new-password"></div><button class="btn" type="submit">변경</button><p class="notice-box" id="pMsg2" role="status" hidden></p></form></div>';
    el("logout").addEventListener("click", async function () { await API.signOut(); location.href = "index.html"; });
    if (el("accDues")) Promise.all([API.duesMine(), API.duesPublic()]).then(function (r) {
      var h = duesCardHtml(r[0], r[1]) || duesAdminHint(r[1]); if (!h) return;
      el("accDues").innerHTML = head("회비") + h + '<p class="muted small">총무가 은행 거래내역을 올리면 반영됩니다. 입금하고 며칠이 지나도 그대로면 게시판이나 메일로 알려 주세요.</p>';
      bindCopy(el("accDues"));
    }).catch(function () {});
    if (el("accWi") && ag) el("accWi").addEventListener("click", function () { showPrint(wiDoc(ag), "내 위임장"); });
    if (el("accChat")) el("accChat").addEventListener("click", openChat);
    if (el("withdraw")) el("withdraw").addEventListener("click", async function () {
      var btn = this;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "한 번 더 누르면 철회 (투표 · 민원 참여 중지)"; return; }
      busy(btn, true); try { await API.withdrawAgreement(); await R.account(); } catch (err) { busy(btn, false); say("aMsg", API.errorText(err), true); }
    });
    if (el("fRe")) el("fRe").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button"); busy(btn, true);
      try { await API.reapply({ file: el("rFile").files[0] }); await R.account(); } catch (err) { busy(btn, false); say("rMsg", API.errorText(err), true); }
    });
    el("fNick").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.updateNickname(el("nNick").value); if (el("nCafe")) await API.setCafeNick(el("nCafe").value); await R.account(); say("nMsg", "저장했습니다."); } catch (err) { say("nMsg", API.errorText(err), true); } });
    el("fPw").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.changePassword(el("pPw").value, el("pPw2").value); el("pPw").value = el("pPw2").value = ""; say("pMsg2", "비밀번호를 바꿨습니다."); } catch (err) { say("pMsg2", API.errorText(err), true); } });
  };

  /* ── 위임동의서 ── */
  /* 가입 및 위임 동의서 — 확정 회칙(37개 조) 기준, 다른 단지 입예협 위임장 참고. 문구를 바꾸면 api.js FORM_VERSION도 올려 주세요 */
  var CONSENT_PRE = ["이 동의서에 서명한다고 회비가 청구되지 않습니다. 회비는 총회에서 정합니다(회칙 제26조).", "주민등록번호 · 생년월일 · 계좌번호는 받지 않습니다.", "협의회는 각 세대의 하자보수 · 손해배상 청구권을 대신 포기하거나 제한할 수 없습니다.", "동의는 언제든 철회할 수 있습니다."];
  var CONSENT = [
    ["누구에게 위임하나요", "수임인: 고양창릉 S4블록 입주예정자협의회(이하 \"협의회\")와 회칙에 따라 선출된 회장\n임원 선출 전에는 협의회 준비위원회가 이 업무를 맡고, 협의회가 그 활동과 자료를 이어받습니다(회칙 제35조)."],
    ["제1조 (가입과 회칙 동의)", "1. 본인은 고양창릉 S4블록 공공분양주택의 공급계약자로서 협의회에 회원으로 가입합니다.\n2. 본인은 협의회 회칙(37개 조)을 확인하였으며 이에 동의합니다.\n3. 의결권은 한 세대(동 · 호)당 1개이며, 공동명의 세대는 대표 1인이 행사합니다(회칙 제6조)."],
    ["제2조 (위임 범위)", "본인은 협의회에 다음 사항에 관한 협의 · 요청 · 의견 제출 권한을 위임합니다.\n1. 사업주체(LH) · 시공사 · 관계 기관과의 협의, 공정 설명회 · 현장 점검 요청, 공문 · 자료의 요청과 공유\n2. 설계 · 마감재 · 공용시설 · 공사 품질의 확인과 개선 요구\n3. 단지명 · 커뮤니티 · 주민공동시설, 중도금 대출 등 분양 관련 사항에 대한 의견 제출\n4. 교통(고양은평선 · 버스 노선 등), 학교, 도로 · 공원 등 기반시설에 관한 고양시 · 경기도 · 국토교통부 등에 대한 민원과 건의\n5. 사전점검 · 하자 접수 · 보수 이행 · 입주 절차에 관한 협의\n6. 공동구매 · 입주박람회 등 회원 편의 사업 추진 (참여 여부는 각 세대가 정합니다)\n7. 위 업무를 위한 전문가(법무법인 · 법무사 등)와 업체 후보의 공개 모집 · 조건 비교와 선정 절차 진행 (최종 선정은 회원 투표로 정하고, 실제 계약 여부는 각 세대가 정합니다)"],
    ["제3조 (위임하지 않는 사항)", "다음 사항은 위임하지 않으며, 협의회와 임원은 이에 관해 본인을 대신하여 의사표시를 할 수 없습니다. 필요하면 해당 세대의 개별 동의를 받습니다.\n1. 공급계약의 변경 · 해제, 재산권의 처분 · 제한\n2. 개별 세대에 금전적 부담을 지우는 일 (분담금 · 소송비용 등)\n3. 협의회 명의로 소송 등 법적 절차의 당사자가 되는 일, 개별 세대를 대리하여 법무법인 등과 계약하거나 보수를 약정하는 일\n4. 하자보수 청구권 · 손해배상 청구권 · 민원 제기권을 포기하거나 제한하는 합의 (예: \"추가 민원을 제기하지 않는다\"는 합의서)\n5. 개인정보를 이 동의서에서 정한 목적 밖으로 쓰거나 외부에 제공하는 일\n회칙 개정, 회장 · 감사 선출과 임원 해임, 회비와 예산 · 결산, 해산은 위임으로 대신하지 않고 총회에서 회원이 직접 의결합니다(회칙 제20조)."],
    ["제4조 (협의회의 약속)", "1. 협의 결과와 회의록은 회의 후 7일 이내에 카페에 공개하며, 위임 여부와 관계없이 모든 계약자가 열람할 수 있게 합니다(회칙 제24조).\n2. 단지명 확정, 전문가 · 업체 선정, 설계변경 요구, 대외 집단행동, LH · 시공사와의 합의서 작성 등 중요한 사안은 회원 투표를 거칩니다. 총회 안건은 7일 전까지 공고하고 투표는 2일 이상 받습니다(회칙 제21조 · 제22조).\n3. 돈은 협의회 명의 통장으로만 관리하고, 1회 30만 원 이상 지출은 운영위원회 의결을 거치며, 수입 · 지출은 매월 공개하고 감사를 받습니다(회칙 제27조~제29조).\n4. 임원은 무보수로 봉사하며, 업체 · 전문가로부터 수수료 · 리베이트 · 대가성 후원금 등 어떤 이익도 받지 않습니다. 이해관계가 있으면 미리 밝히고 해당 의결에서 빠집니다(회칙 제17조 · 제25조).\n5. 임원이 이를 어기면 회원 10분의 1 이상의 요구로 해임안을 총회에 올릴 수 있습니다(회칙 제16조)."],
    ["제5조 (효력 기간 · 철회 · 승계)", "1. 이 동의는 서명한 날부터 「공동주택관리법」에 따른 입주자대표회의가 구성되어 업무 인계를 마칠 때까지 효력이 있습니다.\n2. 언제든지 별도 사유 없이 철회할 수 있습니다. 홈페이지로 낸 동의는 내 정보 화면에서 바로 철회할 수 있고, 서면 · 카페 쪽지로도 할 수 있으며, 협의회에 도달한 때 효력을 잃습니다. 철회하면 현황판에서 즉시 빠지고 투표 · 단체민원 참여와 세대별 현황 보기가 중지됩니다(게시판은 계속 이용). 다시 동의하면 바로 회복됩니다.\n3. 철회 전에 협의회가 적법하게 한 일과 이미 관계 기관에 제출된 위임 세대 수는 바뀌지 않습니다.\n4. 계약 해지 · 전매 등으로 계약자 지위를 잃으면 이 동의도 효력을 잃고, 지위를 이어받은 사람은 새로 동의서를 냅니다(회칙 제10조)."],
    ["개인정보 수집 · 이용 동의 (필수)", "협의회는 「개인정보 보호법」 제15조에 따라 아래와 같이 개인정보를 수집 · 이용합니다.\n수집 항목: 계약자 성명, 동 · 호수와 주택형, 휴대전화번호, 서명과 제출 일시, 카페 닉네임(선택), 공동명의자 성명 · 서명(공동명의자 본인이 서명하는 경우에만)\n수집 목적: 계약자와 위임 사실 확인, 위임 세대 집계, 협의회 공지 · 의견수렴 · 투표 안내\n보유 기간: 동의 철회 시 또는 협의회 해산(입주자대표회의 인계) 시 지체 없이 파기\n외부 제공: 하지 않습니다. 관계 기관에 대표성을 보여야 할 때는 이름 없이 동별 위임 세대 수만 제출합니다(회칙 제33조).\n거부할 권리와 불이익: 동의를 거부할 수 있으나, 위임 세대로 집계되지 않아 투표 · 단체민원에 참여할 수 없습니다. 협의 결과와 회의록 열람은 가능합니다.\n\n개인정보 보호 조치\n• 개인정보 관리 책임: 회장 (임원 선출 전에는 준비위원회 대표). 연락은 카페 쪽지나 협의회 공식 메일로 합니다.\n• 동의자 명부는 접근이 제한된 저장소에 보관하고, 열람은 운영진으로 한정합니다.\n• 계약자 확인용 공급계약서 이미지는 확인 후 즉시 삭제합니다(회칙 제7조).\n• 동의자 명부는 입주자대표회의에 넘기지 않으며, 인계 때는 집계(위임 세대 수)만 넘깁니다."]
  ];
  var CONSENT_OATH = "본인은 위 내용과 협의회 회칙을 확인하였으며, 고양창릉 S4블록 입주예정자협의회에 가입하고 위 사항을 위임하는 데 동의합니다.";
  var CONSENT_TO = "고양창릉 S4블록 입주예정자협의회 귀중";
  function consentOverview() {
    var cnt = {}; arr(S.types).forEach(function (t) { var k = String(t.type || "").replace(/[A-Z]$/i, ""); if (t.units) cnt[k] = (cnt[k] || 0) + t.units; });
    var mix = Object.keys(cnt).sort().map(function (k) { return k + "㎡ " + n(cnt[k]); }).join(" · ");
    return '<table class="spec c-ov"><tr><th>단지</th><td>고양창릉 공공주택지구 S-4블록 공공분양주택</td></tr><tr><th>사업주체</th><td>한국토지주택공사(LH)</td></tr>' +
      "<tr><th>공급 규모</th><td>총 " + n(T) + "세대" + (mix ? " (전용 " + esc(mix) + ")" : "") + "</td></tr></table>";
  }
  function consentSecs(tag) {
    return CONSENT.map(function (c) { return "<section><" + tag + ">" + esc(c[0]) + "</" + tag + '><p class="body">' + esc(c[1]) + "</p></section>"; }).join("");
  }

  /* 휴대폰: 긴 동의서 위에 '제출 칸으로 이동' 버튼 */
  function consentLayout(form, side) {
    return '<a class="btn jump-side" href="#consentSide">아래 제출 칸으로 이동 ↓</a><div class="two consent-grid"><div>' + form + '</div><div id="consentSide">' + side + "</div></div>";
  }
  R.consent = async function () {
    var form = '<article class="consent-doc"><p class="eyebrow">고양창릉 S-4블록 공공분양주택</p><h2>입주예정자협의회 가입 및 위임 동의서</h2><p class="muted small">양식 버전 ' + esc(API.formVersion || "2026-11-v1") + "</p>" +
      '<div class="c-pre"><b>작성 전 꼭 읽어 주세요</b><ol>' + CONSENT_PRE.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>" +
            '<dl class="c-sum">' +
        "<div><dt>누구에게</dt><dd>고양창릉 S4블록 입주예정자협의회 (임원 선출 전에는 준비위원회)</dd></div>" +
        "<div><dt>위임하는 것</dt><dd>LH · 시공사 · 기관 협의와 자료 요청, 품질 확인 · 개선 요구, 단지명 · 커뮤니티 · 중도금 의견, 교통 · 학교 등 기반시설 건의, 사전점검 · 하자 협의, 공동구매 · 박람회, 전문가 · 업체 후보 공개 모집 <span class=\"muted\">· 제2조</span></dd></div>" +
        "<div><dt>위임하지 않는 것</dt><dd>계약 변경 · 재산권 처분, 분담금 · 소송비 등 금전 부담, 협의회 명의 소송 · 대리 계약, 하자 · 손해배상 청구권 포기, 개인정보 외부 제공. 회칙 개정 · 임원 선출 · 회비는 총회에서 직접 <span class=\"muted\">· 제3조</span></dd></div>" +
        "<div><dt>협의회의 약속</dt><dd>회의록 7일 안에 공개, 중요 사안은 회원 투표, 돈은 협의회 통장 · 매월 공개, 임원 무보수 · 리베이트 금지 <span class=\"muted\">· 제4조</span></dd></div>" +
        "<div><dt>효력 · 철회</dt><dd>입주자대표회의에 업무를 넘길 때까지. 언제든 사유 없이 철회할 수 있고, 내 정보에서 바로 됩니다 <span class=\"muted\">· 제5조</span></dd></div>" +
      "</dl>" +
      '<h3 class="c-h">개인정보 수집 · 이용 <span class="tag hot">필수</span></h3><table class="spec c-priv">' +
        "<tr><th>항목</th><td>계약자 성명, 동 · 호수와 주택형, 휴대전화번호, 서명과 제출 일시, 카페 닉네임(선택), 공동명의자 성명 · 서명(해당 시)</td></tr>" +
        "<tr><th>목적</th><td>계약자 · 위임 확인, 위임 세대 집계, 공지 · 의견수렴 · 투표 안내</td></tr>" +
        "<tr><th>보유 기간</th><td>철회 시 또는 협의회 해산(입주자대표회의 인계) 시 지체 없이 파기</td></tr>" +
        "<tr><th>거부할 때</th><td>거부할 수 있으나 위임 세대로 집계되지 않아 투표 · 단체민원에 참여할 수 없습니다 (협의 결과 · 회의록 열람은 가능)</td></tr></table>" +
      '<p class="muted small" style="margin:6px 0 0">회원 정보는 LH · 시공사 · 관계기관 등 외부에 제공하지 않습니다(회칙 제33조). 대표성을 보일 때는 위임 세대 수만 알립니다.</p>' +
      '<details class="c-full"><summary>동의서 전문 보기 <span class="muted small">단지 개요 · 수임인 · 제1조~제5조 · 개인정보 보호 조치</span></summary>' +
        "<section><h3>단지 개요</h3>" + consentOverview() + "</section>" + consentSecs("h3") + "</details>" +
      '<p class="c-oath">' + esc(CONSENT_OATH) + '</p><p class="c-to">' + esc(CONSENT_TO) + "</p>" +
      '<p class="cta-row" style="margin:8px 0 0"><button type="button" class="btn" id="docPdf">전문 PDF로 저장</button></p></article>' +
      '<div class="panel paper-box"><b>온라인이 어려우신가요?</b><p class="muted small" style="margin:6px 0 10px">공급계약을 마친 뒤 서면 위임장 양식을 인쇄해 작성 · 서명하고, 사진이나 스캔본을 협의회 공식 메일 <b>changneung.s4@gmail.com</b> 으로 보내 주세요. 운영진이 확인해 등록합니다. 주민등록번호는 적지 마세요.</p><button type="button" class="btn" id="blankForm">서면 양식 인쇄 · PDF 저장</button></div>';
    function bindBlank() {
      var b = el("blankForm"); if (b) b.addEventListener("click", window.S4_showBlankForm);
      var d = el("docPdf"); if (d) d.addEventListener("click", function () {
        showPrint('<article class="wi-doc"><p class="wi-sub">고양창릉 S-4블록 공공분양주택</p><h1>입주예정자협의회 가입 및 위임 동의서</h1>' +
          '<ol class="wi-pre">' + CONSENT_PRE.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol><section><h2>단지 개요</h2>" + consentOverview() + "</section>" +
          CONSENT.map(function (c) { return "<section><h2>" + esc(c[0]) + "</h2><p>" + esc(c[1]) + "</p></section>"; }).join("") +
          '<p class="wi-oath">' + esc(CONSENT_OATH) + '</p><p class="wi-to">' + esc(CONSENT_TO) + "</p></article>", "위임 동의서 전문");
      });
    }
    if (!LIVE) { C.innerHTML = consentLayout(form, gate("member")); bindBlank(); return; }
    var pf = API.profile, g = !API.loggedIn || !pf || pf.status === "rejected" ? gate("member") : "";
    if (g) { C.innerHTML = consentLayout(form, g); bindBlank(); return; }
    var ag = await API.myAgreement(), p = API.profile;
    if (!ag && !API.consentOpen) { C.innerHTML = consentLayout(form, delegateNote(true)); bindBlank(); return; }
    var side = ag
      ? '<div class="panel done"><div class="eyebrow">제출 완료</div><h3>' + esc(unitLabel(p.unit_id)) + '</h3><p>' + fmtTime(ag.signed_at) + ' 제출</p><p class="muted small">' + (p.status === "approved" ? "위임동의 현황판에 반영되었습니다." : "운영진이 가입을 승인하면 위임동의 현황판에 반영됩니다.") +  ' 철회는 내 정보에서 할 수 있습니다.</p><p class="cta-row"><button type="button" class="btn solid" id="myWi">내 위임장 보기 · 인쇄</button><a class="btn" href="agreement.html">현황판 보기</a><a class="btn" href="account.html">내 정보</a></p></div>'
      : '<form class="panel" id="fAg" novalidate><div class="eyebrow">제출 세대</div><h3 style="margin:4px 0 14px">' + esc(unitLabel(p.unit_id)) + "</h3>" + consentFields("a", false) +
        '<button class="btn solid wide" type="submit">위임동의서 제출</button><p class="notice-box" id="aMsg" role="alert" hidden></p>' +
        '<p class="muted small" style="margin:10px 0 0">제출 일시 · 세대 · 문서 번호는 서버가 기록합니다. 제출 후 내 위임장을 PDF로 저장할 수 있습니다.</p></form>';
    C.innerHTML = consentLayout(form, side);
    bindBlank();
    if (ag) { el("myWi").addEventListener("click", function () { showPrint(wiDoc(ag), "내 위임장"); }); return; }
    bindConsent("a");
    el("fAg").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button"); busy(btn, true, "제출 중…"); say("aMsg", "");
      try { await API.submitAgreement(consentValues("a")); await R.consent(); window.scrollTo(0, 0); }
      catch (err) { busy(btn, false); say("aMsg", API.errorText(err), true); }
    });
  };

  /* ── 운영진 ── */
  /* ── 운영진: 카페 등업 (홈페이지에서 확인한 세대 ↔ 카페 닉네임) ── */
  async function adminCafe(B, err, show, csv) {
    var L = await API.admin.cafeList(), only = false, filt = "wait", q = "";
    try { only = localStorage.getItem("s4-cafe-only-agreed") === "1"; } catch (e) {}
    var ST = { approved: "승인", pending: "대기", rejected: "반려" };
    function eligible(r) { return (r.status === "approved" || (r.agreed && !r.status)) && (!only || r.agreed); }
    function kind(r) {
      var el2 = eligible(r);
      if (r.state === "up" && !el2) return "down";
      if (r.state === "up" && r.nick && r.marked_nick && r.nick !== r.marked_nick) return "changed";
      if (r.state === "up") return "done";
      if (!el2) return "out";
      if (!r.nick) return "nonick";
      return "wait";
    }
    var K = { wait: ["등업 대기", "hot"], changed: ["닉네임 바뀜", "hot"], down: ["내려야 함", "hot"], done: ["등업 완료", ""], nonick: ["닉네임 없음", ""], out: ["대상 아님", ""] };
    function cnt(k) { return L.filter(function (r) { var x = kind(r); return k === "wait" ? x === "wait" || x === "changed" : x === k; }).length; }
    B.innerHTML =
      '<div class="panel cafe-how"><b>카페 등업 하는 법</b><ol class="small">' +
        "<li>회원이 내 정보(또는 위임장)에 네이버 카페 닉네임을 적으면 아래 <b>등업 대기</b>에 나옵니다. 계약서는 홈페이지에서 이미 확인했습니다.</li>" +
        "<li>카페 관리 › 멤버 관리에서 그 닉네임을 찾아 등급을 올리고, 여기서 <b>등업함</b>을 누릅니다.</li>" +
        "<li>승인이 취소되거나 (위임 세대만 등업하는 경우) 위임을 철회하면 <b>내려야 함</b>에 나옵니다. 카페에서 등급을 내리고 <b>내림</b>을 누르세요.</li></ol>" +
        '<label class="chk" style="margin:8px 0 0"><input type="checkbox" id="cfOnly"' + (only ? " checked" : "") + "> 위임동의를 낸 세대만 등업 대상으로 보기</label></div>" +
      '<div class="toolbar"><div class="chips" id="cfF">' +
        [["wait", "등업 대기 " + cnt("wait")], ["down", "내려야 함 " + cnt("down")], ["done", "등업 완료 " + cnt("done")], ["nonick", "닉네임 없음 " + cnt("nonick")], ["all", "전체 " + L.length]].map(function (c) {
          return '<button type="button" class="chip" data-f="' + c[0] + '" aria-pressed="' + (c[0] === filt) + '">' + c[1] + "</button>"; }).join("") +
        '</div><form class="find" id="cfFind"><label for="cfQ" class="sr">검색</label><input id="cfQ" placeholder="동-호, 카페 닉네임"></form><button type="button" class="btn" id="cfCsv">대기 명단 CSV</button></div>' +
      '<div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>카페 닉네임</th><th>위임</th><th>회원</th><th>처리</th><th></th></tr></thead><tbody id="cfB"></tbody></table></div>';
    function rows() {
      return L.filter(function (r) {
        var x = kind(r);
        var okF = filt === "all" || (filt === "wait" ? x === "wait" || x === "changed" : x === filt);
        return okF && (!q || (r.unit_id + " " + (r.nick || "")).toLowerCase().indexOf(q) >= 0);
      });
    }
    function draw() {
      var R2 = rows();
      el("cfB").innerHTML = R2.length ? R2.map(function (r) {
        var x = kind(r), k = K[x];
        return '<tr data-u="' + esc(r.unit_id) + '"><td class="num">' + esc(r.unit_id) + "</td>" +
          "<td>" + (r.nick ? "<b>" + esc(r.nick) + '</b> <button type="button" class="btn sm" data-copy="' + esc(r.nick) + '">복사</button>' + (x === "changed" ? ' <span class="muted small">(등업 때: ' + esc(r.marked_nick) + ")</span>" : "") : '<span class="muted">-</span>') + "</td>" +
          "<td>" + (r.agreed ? "완료" : '<span class="muted">미제출</span>') + "</td><td>" + (r.status ? ST[r.status] || r.status : '<span class="muted">서면만</span>') + "</td>" +
          '<td><span class="tag' + (k[1] ? " hot" : "") + '">' + k[0] + "</span>" + (r.marked_at ? ' <span class="muted small">' + fmtDate(r.marked_at) + "</span>" : "") + "</td>" +
          '<td class="nowrap">' + (x === "wait" || x === "changed" ? '<button type="button" class="btn sm solid cfUp">등업함</button>' : "") +
            (x === "down" ? '<button type="button" class="btn sm solid cfDown">내림</button>' : "") +
            (x === "done" ? '<button type="button" class="btn sm cfDown">내림</button>' : "") +
            (r.state ? ' <button type="button" class="linkbtn cfClear">기록 지움</button>' : "") + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="muted">' + (filt === "wait" ? "등업을 기다리는 세대가 없습니다." : "해당하는 세대가 없습니다.") + "</td></tr>";
      bindCopy(el("cfB"));
    }
    draw();
    el("cfOnly").addEventListener("change", function () { only = this.checked; try { localStorage.setItem("s4-cafe-only-agreed", only ? "1" : "0"); } catch (e) {} show(); });
    el("cfF").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (!b) return; filt = b.dataset.f; el("cfF").querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b); }); draw(); });
    el("cfQ").addEventListener("input", function () { q = this.value.trim().toLowerCase(); draw(); });
    el("cfFind").addEventListener("submit", function (e) { e.preventDefault(); });
    el("cfCsv").addEventListener("click", function () {
      var W = L.filter(function (r) { var x = kind(r); return x === "wait" || x === "changed"; });
      var a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob(["﻿" + csv([["세대", "카페 닉네임", "위임", "회원"]].concat(W.map(function (r) { return [r.unit_id, r.nick, r.agreed ? "완료" : "미제출", ST[r.status] || "서면만"]; })))], { type: "text/csv" }));
      a2.download = "카페등업대기.csv"; a2.click();
    });
    el("cfB").addEventListener("click", async function (e) {
      var tr = e.target.closest("tr[data-u]"); if (!tr) return; var u = tr.dataset.u, st = null;
      if (e.target.closest(".cfUp")) st = "up"; else if (e.target.closest(".cfDown")) st = "down"; else if (e.target.closest(".cfClear")) st = ""; else return;
      try { await API.admin.cafeMark(u, st); var m3 = u + (st === "up" ? " 등업 처리했습니다." : st === "down" ? " 등급을 내린 것으로 기록했습니다." : " 처리 기록을 지웠습니다."); show().then(function () { say("admMsg", m3); }); } catch (er) { err(er); }
    });
  }

  /* ── 운영진: 회비 (은행 거래내역 파일 → 세대 자동 확인) ── */
  var UNIT_RE = /(\d{3})\s*(?:동|-|_|\.|\/|\s)?\s*(\d{3,4})(?!\d)/;
  function unitFrom(s) { var m = String(s || "").match(UNIT_RE); if (!m) return null; var id = m[1] + "-" + Number(m[2]); return UNIT[id] ? id : null; }
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = "assets/vendor/xlsx-0.18.5.min.js"; s.onload = function () { ok(window.XLSX); }; s.onerror = function () { no(new Error("엑셀 읽기 도구를 불러오지 못했습니다.")); }; document.head.appendChild(s); });
  }
  var BANK_COLS = {
    date: /거래\s*일시|거래\s*일자|거래일|일시|날짜|일자/, time: /거래\s*시간|시간|시각/,
    "in": /^(?!.*입금자).*(입금|맡기신|받은\s*금액)/, out: /출금|지급|찾으신|보낸\s*금액/,
    amount: /거래\s*금액|^금액/, kind: /구분|입출금/, bal: /잔액/,
    payer: /기재\s*내용|보낸\s*분|받는\s*분|의뢰인|수취인|입금자|거래\s*기록|내용|적요|메모|송금/
  };
  function bankNum(v) { if (typeof v === "number") return Math.round(v); var s = String(v == null ? "" : v).replace(/[,\s원]/g, ""); if (!s || s === "-") return 0; var x = Number(s); return isFinite(x) ? Math.round(x) : NaN; }
  function bankDate(dv, tv) {
    function pad(x) { return ("0" + x).slice(-2); }
    var y, mo, d, h = 0, mi = 0, se = 0, m;
    if (dv instanceof Date) { y = dv.getFullYear(); mo = dv.getMonth() + 1; d = dv.getDate(); h = dv.getHours(); mi = dv.getMinutes(); se = dv.getSeconds(); }
    else {
      var s = String(dv == null ? "" : dv).trim();
      m = s.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})(?:\D+(\d{1,2}):?(\d{2})(?::?(\d{2}))?)?/); if (!m) return null;
      y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4] != null) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); }
    }
    if (tv != null && tv !== "") {
      if (tv instanceof Date) { h = tv.getHours(); mi = tv.getMinutes(); se = tv.getSeconds(); }
      else if (typeof tv === "number" && tv < 1) { var t = Math.round(tv * 86400); h = Math.floor(t / 3600); mi = Math.floor(t / 60) % 60; se = t % 60; }
      else if ((m = String(tv).match(/(\d{1,2}):?(\d{2}):?(\d{2})?/))) { h = +m[1]; mi = +m[2]; se = +(m[3] || 0); }
    }
    if (!(y > 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    return y + "-" + pad(mo) + "-" + pad(d) + "T" + pad(h) + ":" + pad(mi) + ":" + pad(se) + "+09:00";
  }
  function bankGuess(rows) {
    var hi = -1, best = 0;
    rows.slice(0, 40).forEach(function (r, i) {
      var sc = 0; r.forEach(function (c) { c = String(c == null ? "" : c).replace(/\s+/g, ""); if (c.length > 14) return; Object.keys(BANK_COLS).forEach(function (k) { if (BANK_COLS[k].test(c)) sc++; }); });
      if (sc > best) { best = sc; hi = i; }
    });
    if (hi < 0 || best < 3) return null;
    var H = rows[hi].map(function (c) { return String(c == null ? "" : c).replace(/\s+/g, ""); }), map = {}, body = rows.slice(hi + 1);
    ["date", "time", "in", "out", "amount", "kind", "bal"].forEach(function (k) {
      var i = H.findIndex(function (c, j) { return BANK_COLS[k].test(c) && Object.keys(map).every(function (q) { return map[q] !== j; }); });
      if (i >= 0) map[k] = i;
    });
    if (map.time != null && map.date != null && map.time === map.date) delete map.time;
    if (map["in"] != null && map.out != null) delete map.amount;
    var cand = H.map(function (c, j) { return j; }).filter(function (j) { return BANK_COLS.payer.test(H[j]) && Object.keys(map).every(function (q) { return map[q] !== j; }); });
    var score = function (j) { return body.reduce(function (s, r) { return s + (UNIT_RE.test(String(r[j] == null ? "" : r[j])) ? 1 : 0); }, 0); };
    cand.sort(function (a, b) { return score(b) - score(a); });
    if (cand.length) map.payer = cand[0];
    return { header: rows[hi], body: body, map: map };
  }
  function bankRows(g) {
    var M = g.map, seen = {}, out = [];
    g.body.forEach(function (r) {
      var at = bankDate(r[M.date], M.time != null ? r[M.time] : null); if (!at) return;
      var vin = 0, vout = 0;
      if (M["in"] != null || M.out != null) { vin = M["in"] != null ? bankNum(r[M["in"]]) : 0; vout = M.out != null ? bankNum(r[M.out]) : 0; }
      else if (M.amount != null) {
        var amt = bankNum(r[M.amount]), kind = String(M.kind != null ? r[M.kind] : "");
        if (/출금|지급|보냄|이체출금/.test(kind) || amt < 0) vout = Math.abs(amt); else vin = Math.abs(amt);
      }
      if (!isFinite(vin) || !isFinite(vout) || (!vin && !vout)) return;
      var bal = M.bal != null ? bankNum(r[M.bal]) : null; if (!isFinite(bal)) bal = null;
      var payer = M.payer != null ? String(r[M.payer] == null ? "" : r[M.payer]).trim().slice(0, 200) : "";
      var key = [at, vin, vout, bal, payer].join("|"); seen[key] = (seen[key] || 0) + 1;
      out.push({ at: at, "in": Math.max(0, vin), out: Math.max(0, vout), balance: bal, payer: payer, seq: seen[key] > 1 ? String(seen[key]) : "" });
    });
    return out;
  }

  async function adminDues(B, err, show, csv) {
    var D = await API.duesPublic() || {}, TX = await API.admin.bankTx(), DU = await API.admin.duesUnits(), MEM = [];
    try { MEM = (await API.admin.profiles()).filter(function (p) { return p.status === "approved"; }); } catch (e) {}
    var tiers = arr(D.tiers).slice(), filt = "check", shown = 60, parsed = null;
    var byU = {}; DU.forEach(function (u) { byU[u.unit_id] = u; });
    var paidN = DU.filter(function (u) { return u.paid >= (u.due || 1); }).length;
    var unpaidMem = MEM.filter(function (p) { var u = byU[p.unit_id]; return !u || u.paid < (u.due || 1); });
    var check = TX.filter(function (t) { return t.amount_in > 0 && !t.unit_id && t.matched === "none"; });
    var dueSum = DU.reduce(function (s, u) { return s + Number(u.paid || 0); }, 0);

    function tierRows() {
      return tiers.map(function (t, i) {
        return '<div class="dues-tier" data-i="' + i + '"><input type="date" class="tUntil" value="' + esc(t.until || "") + '" aria-label="이 날짜까지"><span class="small muted">까지</span>' +
          '<input class="tAmt num" inputmode="numeric" value="' + esc(t.amount ? String(t.amount) : "") + '" placeholder="30000" aria-label="금액"><span class="small muted">원</span><button type="button" class="btn tDel" aria-label="구간 삭제">×</button></div>';
      }).join("");
    }
    B.innerHTML =
      '<div class="dues-stats">' +
        '<div><span class="muted small">납부 세대</span><b class="num">' + n(paidN) + '</b><span class="small muted">/ 승인 회원 ' + n(MEM.length) + "</span></div>" +
        '<div><span class="muted small">회비 입금 합계</span><b class="num">' + n(dueSum) + '</b><span class="small muted">원</span></div>' +
        '<div><span class="muted small">확인 필요</span><b class="num' + (check.length ? " hot" : "") + '">' + n(check.length) + '</b><span class="small muted">건</span></div>' +
      "</div>" +
      '<div class="panel dues-up"><h3>은행 거래내역 올리기</h3>' +
        '<p class="muted small" style="margin:0 0 10px">인터넷뱅킹 · 은행 앱에서 협의회 통장 거래내역을 엑셀(xlsx · xls) 또는 CSV로 받아 올리세요. 기간이 겹쳐도 같은 거래는 한 번만 들어갑니다. 파일은 이 브라우저에서만 읽고, 거래 정보만 저장합니다.</p>' +
        '<input type="file" id="bkFile" accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv">' +
        '<div id="bkPrev"></div></div>' +
      '<div class="toolbar"><div class="chips" id="txF">' +
        [["check", "확인 필요 " + check.length], ["dues", "회비"], ["other", "기타 수입"], ["out", "지출"], ["all", "전체 " + TX.length]].map(function (c) { return '<button type="button" class="chip" data-f="' + c[0] + '" aria-pressed="' + (c[0] === filt) + '">' + c[1] + "</button>"; }).join("") +
        '</div><button type="button" class="btn" id="txCsv">거래 CSV</button></div>' +
      '<div class="tablebox"><table class="spec dues-tx"><thead><tr><th>일시</th><th class="r">입금</th><th class="r">출금</th><th>입금자 · 내용</th><th>세대</th><th>구분</th><th>공개 메모</th><th></th></tr></thead><tbody id="txB"></tbody></table></div>' +
      '<p class="cta-row" id="txMoreRow" hidden><button type="button" class="btn" id="txMore">더 보기</button></p>' +
      '<div class="two">' +
        "<div>" + head("세대별 납부", '<button type="button" class="btn" id="duCsv">CSV</button>') +
          '<div class="tablebox" style="max-height:360px;overflow:auto"><table class="spec"><thead><tr><th>세대</th><th class="r">입금</th><th class="r">낼 금액</th><th>상태</th></tr></thead><tbody>' +
          (DU.length ? DU.slice().sort(function (a, b) { return a.unit_id < b.unit_id ? -1 : 1; }).map(function (u) {
            var ok = u.paid >= (u.due || 1);
            return '<tr><td class="num">' + esc(u.unit_id) + '</td><td class="r num">' + n(u.paid) + '</td><td class="r num">' + (u.due ? n(u.due) : "—") + '</td><td><span class="tag' + (ok ? "" : " hot") + '">' + (ok ? "완납" : "부족") + "</span></td></tr>";
          }).join("") : '<tr><td colspan="4" class="muted">아직 없습니다</td></tr>') + "</tbody></table></div>" +
          '<p class="muted small">승인 회원 중 미납 ' + n(unpaidMem.length) + '세대 <button type="button" class="btn" id="unCsv">미납 세대 CSV</button></p></div>' +
        '<form class="panel" id="fDues" novalidate><h3>회비 설정 <span class="muted small">총회에서 정한 대로</span></h3>' +
          '<div class="two" style="gap:10px"><div class="field"><label for="dBank">은행</label><input id="dBank" maxlength="20" value="' + esc(D.bank || "") + '" placeholder="우리은행"></div>' +
          '<div class="field"><label for="dAcc">계좌번호</label><input id="dAcc" class="num" maxlength="30" value="' + esc(D.account || "") + '" placeholder="1005-000-000000"></div></div>' +
          '<div class="field"><label for="dHolder">예금주</label><input id="dHolder" maxlength="40" value="' + esc(D.holder || "") + '" placeholder="고양창릉S4블록입주예정자협의회"></div>' +
          '<div class="field"><label for="dAmt">세대당 회비</label><div class="dues-tier"><input id="dAmt" class="tAmt num" inputmode="numeric" value="' + esc(tiers.length === 1 ? String(tiers[0].amount) : "") + '" placeholder="30000"' + (tiers.length > 1 ? " disabled" : "") + '><span class="small muted">원</span></div></div>' +
          '<label class="chk"><input type="checkbox" id="dMulti"' + (tiers.length > 1 ? " checked" : "") + '> 납부 시기에 따라 금액을 다르게 받기</label>' +
          '<div class="field" id="tierBox"' + (tiers.length > 1 ? "" : " hidden") + '><span class="lbl">시기별 금액 <span class="muted small">마지막 구간은 날짜를 비우면 \'그 뒤 계속\'</span></span><div id="tiers">' + tierRows() + '</div><button type="button" class="btn" id="tAdd">구간 추가</button></div>' +
          '<p class="cta-row" style="margin:0"><button class="btn solid" type="submit">저장</button></p>' +
          '<p class="muted small" style="margin:8px 0 0">저장하면 협의회 소개 · 회계 공개와 회원의 내 정보에 계좌와 금액이 보입니다. 비워 두면 보이지 않습니다.</p></form>' +
      "</div>";

    function txList() {
      return TX.filter(function (t) {
        if (filt === "check") return check.indexOf(t) >= 0;
        if (filt === "dues") return t.category === "회비";
        if (filt === "other") return t.amount_in > 0 && t.category === "기타";
        if (filt === "out") return t.amount_out > 0;
        return true;
      });
    }
    function drawTx() {
      var L = txList();
      el("txB").innerHTML = L.length ? L.slice(0, shown).map(function (t) {
        return '<tr data-id="' + t.id + '"><td class="num">' + fmtTime(t.at) + '</td><td class="r num">' + (t.amount_in ? n(t.amount_in) : "") + '</td><td class="r num">' + (t.amount_out ? n(t.amount_out) : "") + "</td><td>" + esc(t.payer) + "</td>" +
          '<td><input class="xU num" value="' + esc(t.unit_id || "") + '" placeholder="403-1804" size="8" aria-label="세대">' + (t.matched === "auto" ? ' <span class="muted small">자동</span>' : "") + "</td>" +
          '<td><select class="xC" aria-label="구분">' + ["회비", "기타", "지출"].map(function (c) { return "<option" + (c === t.category ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></td>" +
          '<td><input class="xN" value="' + esc(t.public_note || "") + '" maxlength="80" placeholder="' + (t.amount_out ? "예: 현수막 제작" : "") + '" aria-label="공개 메모"></td>' +
          '<td class="nowrap"><button type="button" class="btn xS">저장</button> <button type="button" class="btn xD" aria-label="삭제">삭제</button></td></tr>';
      }).join("") : '<tr><td colspan="8" class="muted">' + (filt === "check" ? "확인할 입금이 없습니다. 동호수가 적힌 입금은 자동으로 세대가 맞춰집니다." : "거래가 없습니다") + "</td></tr>";
      el("txMoreRow").hidden = L.length <= shown;
    }
    drawTx();
    el("txF").addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (!b) return; filt = b.dataset.f; shown = 60; el("txF").querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b); }); drawTx(); });
    el("txMore").addEventListener("click", function () { shown += 100; drawTx(); });
    el("txB").addEventListener("click", async function (e) {
      var tr = e.target.closest("tr[data-id]"); if (!tr) return; var id = Number(tr.dataset.id), t = TX.filter(function (x) { return x.id === id; })[0];
      if (e.target.closest(".xS")) {
        var u = tr.querySelector(".xU").value.trim(), mm = u.match(/(\d{3})\D*(\d{3,4})/); u = mm ? mm[1] + "-" + Number(mm[2]) : "";
        var c = tr.querySelector(".xC").value, note = tr.querySelector(".xN").value;
        if (u && c !== "회비" && t.amount_in > 0) c = "회비";
        try { await API.admin.bankTxSet(id, u, c, note); var m_ = "저장했습니다."; show().then(function () { say("admMsg", m_); }); } catch (er) { err(er); }
      }
      if (e.target.closest(".xD")) {
        var b = e.target.closest(".xD"); if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더"; return; }
        try { await API.admin.bankTxDelete(id); var m_ = "거래를 지웠습니다."; show().then(function () { say("admMsg", m_); }); } catch (er) { err(er); }
      }
    });
    function dl(name, rows) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv(rows)], { type: "text/csv" })); a.download = name; a.click(); }
    el("txCsv").addEventListener("click", function () { dl("거래내역.csv", [["일시", "입금", "출금", "잔액", "입금자·내용", "세대", "구분", "공개 메모"]].concat(TX.map(function (t) { return [fmtTime(t.at), t.amount_in, t.amount_out, t.balance, t.payer, t.unit_id, t.category, t.public_note]; }))); });
    el("duCsv").addEventListener("click", function () { dl("세대별납부.csv", [["세대", "입금", "낼 금액", "첫 입금"]].concat(DU.map(function (u) { return [u.unit_id, u.paid, u.due, fmtDate(u.first_at)]; }))); });
    el("unCsv").addEventListener("click", function () { dl("미납세대.csv", [["세대", "닉네임", "입금"]].concat(unpaidMem.map(function (p) { return [p.unit_id, p.nickname || "", (byU[p.unit_id] || {}).paid || 0]; }))); });

    // 설정
    function readTiers() {
      tiers = Array.prototype.map.call(el("tiers").querySelectorAll(".dues-tier"), function (r) { return { until: r.querySelector(".tUntil").value || null, amount: bankNum(r.querySelector(".tAmt").value) }; });
    }
    el("dMulti").addEventListener("change", function () {
      var on = this.checked; el("tierBox").hidden = !on; el("dAmt").disabled = on;
      if (on && el("tiers").children.length < 2) { var v = bankNum(el("dAmt").value) || 0; tiers = [{ until: null, amount: v }, { until: null, amount: 0 }]; el("tiers").innerHTML = tierRows(); }
    });
    el("tAdd").addEventListener("click", function () { readTiers(); tiers.push({ until: null, amount: 0 }); el("tiers").innerHTML = tierRows(); });
    el("tiers").addEventListener("click", function (e) { var b = e.target.closest(".tDel"); if (!b) return; readTiers(); tiers.splice(Number(b.parentNode.dataset.i), 1); el("tiers").innerHTML = tierRows(); });
    el("fDues").addEventListener("submit", async function (e) {
      e.preventDefault();
      var T2;
      if (el("dMulti").checked) { readTiers(); T2 = tiers.filter(function (t) { return t.amount > 0; }); }
      else { var one = bankNum(el("dAmt").value); T2 = one > 0 ? [{ until: null, amount: one }] : []; }
      for (var i = 0; i < T2.length; i++) {
        if (!T2[i].until && i < T2.length - 1) { say("admMsg", "날짜를 비울 수 있는 건 마지막 구간뿐입니다.", true); return; }
        if (i && T2[i].until && T2[i - 1].until && T2[i].until <= T2[i - 1].until) { say("admMsg", "구간 날짜는 앞에서부터 늘어나야 합니다.", true); return; }
      }
      var acc = el("dAcc").value.trim(); if (acc && !/^[0-9-]{6,30}$/.test(acc)) { say("admMsg", "계좌번호는 숫자와 - 만 넣어 주세요.", true); return; }
      try { await API.admin.duesConfigSet({ bank: el("dBank").value, account: acc, holder: el("dHolder").value, tiers: T2 }); show().then(function () { say("admMsg", "회비 설정을 저장했습니다."); }); } catch (er) { err(er); }
    });

    // 파일 올리기
    el("bkFile").addEventListener("change", async function () {
      var f = this.files[0], P = el("bkPrev"); if (!f) return;
      P.innerHTML = '<p class="muted small">읽는 중…</p>';
      try {
        var X = await loadXlsx(), buf = await f.arrayBuffer();
        var wb = /\.csv$/i.test(f.name) ? X.read(decodeCsv(buf), { type: "string", cellDates: true }) : X.read(buf, { type: "array", cellDates: true });
        var g = null;
        wb.SheetNames.some(function (nm) { g = bankGuess(X.utils.sheet_to_json(wb.Sheets[nm], { header: 1, raw: true, defval: "" })); return !!g; });
        if (!g) throw new Error("거래내역 표의 제목 줄(거래일시 · 입금 · 출금 · 잔액 등)을 찾지 못했습니다. 은행에서 받은 원본 파일인지 확인해 주세요.");
        parsed = g; drawPrev();
      } catch (er) { P.innerHTML = '<p class="notice-box bad">' + esc(er.message || String(er)) + "</p>"; }
    });
    function decodeCsv(buf) {
      var u = new TextDecoder("utf-8").decode(buf);
      if (u.indexOf("�") < 0) return u.replace(/^﻿/, "");
      try { return new TextDecoder("euc-kr").decode(buf); } catch (e) { return u; }
    }
    function drawPrev() {
      var g = parsed, M = g.map, H = g.header, rows = bankRows(g), P = el("bkPrev");
      var LBL = [["date", "거래일시 · 일자"], ["time", "시간 (따로 있으면)"], ["in", "입금액"], ["out", "출금액"], ["amount", "금액 (입출금 한 칸)"], ["kind", "입출금 구분"], ["bal", "잔액"], ["payer", "입금자 · 내용"]];
      var opts = function (k) { return '<option value="">없음</option>' + H.map(function (h, j) { return '<option value="' + j + '"' + (M[k] === j ? " selected" : "") + ">" + esc(String(h || "열 " + (j + 1))) + "</option>"; }).join(""); };
      var matched = rows.filter(function (r) { return r["in"] > 0 && unitFrom(r.payer); }).length, ins = rows.filter(function (r) { return r["in"] > 0; }).length;
      P.innerHTML = '<div class="bk-map">' + LBL.map(function (l) { return '<label><span class="small muted">' + l[1] + '</span><select data-k="' + l[0] + '">' + opts(l[0]) + "</select></label>"; }).join("") + "</div>" +
        '<p class="small">거래 <b>' + n(rows.length) + "</b>건 · 입금 " + n(ins) + "건 중 동호수 자동 확인 <b>" + n(matched) + "</b>건</p>" +
        '<div class="tablebox"><table class="spec"><thead><tr><th>일시</th><th class="r">입금</th><th class="r">출금</th><th class="r">잔액</th><th>입금자 · 내용</th><th>세대</th></tr></thead><tbody>' +
        rows.slice(0, 8).map(function (r) { var u = r["in"] ? unitFrom(r.payer) : null; return '<tr><td class="num">' + fmtTime(r.at) + '</td><td class="r num">' + (r["in"] ? n(r["in"]) : "") + '</td><td class="r num">' + (r.out ? n(r.out) : "") + '</td><td class="r num">' + (r.balance == null ? "" : n(r.balance)) + "</td><td>" + esc(r.payer) + '</td><td class="num">' + (u || "") + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        '<p class="cta-row" style="margin:8px 0 0"><button type="button" class="btn solid" id="bkGo"' + (rows.length ? "" : " disabled") + ">" + n(rows.length) + '건 올리기</button><span class="muted small">열이 잘못 잡혔으면 위에서 고르세요.</span></p>';
      P.querySelectorAll("select[data-k]").forEach(function (s) { s.addEventListener("change", function () { if (s.value === "") delete M[s.dataset.k]; else M[s.dataset.k] = Number(s.value); drawPrev(); }); });
      el("bkGo").addEventListener("click", async function () {
        var b = this; busy(b, true, "올리는 중…");
        try {
          var tot = { added: 0, skipped: 0, matched: 0 };
          for (var i = 0; i < rows.length; i += 1000) { var r = await API.admin.bankImport(rows.slice(i, i + 1000)); tot.added += r.added; tot.skipped += r.skipped; tot.matched += r.matched; }
          var m2 = "새 거래 " + n(tot.added) + "건을 넣었습니다 (이미 있던 거래 " + n(tot.skipped) + "건은 건너뜀). 이 중 " + n(tot.matched) + "건은 동호수로 세대를 맞췄습니다. 남은 입금은 '확인 필요'에서 세대를 적어 주세요.";
          show().then(function () { say("admMsg", m2); });
        } catch (er) { busy(b, false); err(er); }
      });
    }
  }

  /* 긴 기록 표: 앞 15줄만 보이고 '더 보기' */
  function moreRow(h, i) { return i < 15 ? h : h.replace("<tr>", '<tr class="more-row" hidden>'); }
  function moreBtn(total) { return total > 15 ? '<tr><td colspan="4"><button type="button" class="linkbtn show-more-rows">' + (total - 15) + "건 더 보기</button></td></tr>" : ""; }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".show-more-rows"); if (!b) return;
    b.closest("tbody").querySelectorAll(".more-row").forEach(function (r) { r.hidden = false; }); b.closest("tr").remove();
  });
  R.admin = async function () {
    if (!LIVE || !API.loggedIn) { C.innerHTML = gate("login"); return; }
    if (!API.isAdmin) { C.innerHTML = empty("운영진만 볼 수 있습니다", ""); return; }
    var TABS = [["pending", "가입 승인"], ["members", "회원"], ["agreements", "위임동의 명단"], ["cafe", "카페 등업"], ["dues", "회비"], ["polls", "투표"], ["campaigns", "민원"], ["photos", "사진 · 방문"], ["news", "자동 수집"]];
    var cur = (location.hash || "#pending").slice(1); if (!TABS.some(function (t) { return t[0] === cur; })) cur = "pending";
    C.innerHTML = '<div class="tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '<span class="cnt" id="cnt-' + t[0] + '"></span></button>'; }).join("") + "</div>" +
      '<p class="notice-box" id="admMsg" role="status" hidden></p><div id="adminBody"></div>';
    C.querySelector(".tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (!b) return; cur = b.dataset.t; history.replaceState(null, "", "#" + cur); C.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); }); show(); });
    var B = el("adminBody");
    function err(e) { say("admMsg", API.errorText(e), true); }
    function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n"); }
    async function counts() {
      try { var pd = await API.admin.profiles("pending"); el("cnt-pending").textContent = pd.length ? " " + pd.length : ""; } catch (e) {}
      try { var wd = await API.admin.withdrawals(); el("cnt-agreements").textContent = wd.length ? " " + wd.length : ""; } catch (e) {}
      try {   // 카페: 등업 대기(닉네임 있는 승인 회원 중 미처리 · 닉네임 바뀜) + 내려야 함
        var cl = await API.admin.cafeList(), nc = cl.filter(function (r) { var ok2 = r.status === "approved" || (r.agreed && !r.status);
          return (ok2 && r.nick && (r.state !== "up" || (r.marked_nick && r.nick !== r.marked_nick))) || (r.state === "up" && !ok2); }).length;
        el("cnt-cafe").textContent = nc ? " " + nc : "";
      } catch (e) {}
    }

    async function show() {
      say("admMsg", ""); B.innerHTML = '<p class="muted">불러오는 중…</p>';
      try {
        if (cur === "pending") {
          var L = await API.admin.profiles("pending"), AG = {};
          try { arr(await API.admin.agreements()).forEach(function (a) { AG[a.user_id] = a; }); } catch (e) {}
          B.innerHTML = L.length ? '<div class="review-list">' + L.map(function (p) {
            var a = AG[p.id];
            return '<article class="panel review" data-id="' + p.id + '"><div class="row-info"><b>' + esc(unitLabel(p.unit_id)) + '</b><span class="muted small">' + fmtTime(p.created_at) + " 신청</span>" +
              (a ? '<span class="tag">위임동의 제출</span>' : '<span class="tag off">위임동의 전</span>') + "</div>" +
              '<div class="contract" id="ct-' + p.id + '">' + (p.contract_path ? '<button type="button" class="btn view" data-path="' + esc(p.contract_path) + '">계약서 사진 보기</button>' : '<span class="muted small">계약서 없음</span>') + "</div>" +
              '<div class="review-act"><button type="button" class="btn solid approve">승인</button><input class="reason" placeholder="반려 사유 (예: 사진이 흐립니다)" aria-label="반려 사유"><button type="button" class="btn reject">반려 · 다시 내기</button><button type="button" class="btn danger del">계정 삭제</button></div>' +
              '<p class="muted small" style="margin:0">주민등록번호가 가려지지 않았으면 <b>반려</b>하세요(사진은 바로 삭제됩니다). 사진이 이 세대가 아니면 <b>계정 삭제</b>를 누르세요. 세대가 풀려 실제 계약자가 가입할 수 있습니다.</p></article>';
          }).join("") + "</div>" : empty("대기 중인 가입 신청이 없습니다", "");
          B.querySelectorAll(".view").forEach(function (v) { v.addEventListener("click", async function () {
            try { var u = await API.admin.contractUrl(v.dataset.path), box = v.parentNode; box.innerHTML = /\.pdf$/i.test(v.dataset.path) ? '<a class="btn" href="' + u + '" target="_blank" rel="noopener">PDF 열기</a>' : '<img alt="계약서 사진" src="' + u + '">'; } catch (e) { err(e); }
          }); });
          B.querySelectorAll(".review").forEach(function (r) {
            var p = L.filter(function (x) { return x.id === r.dataset.id; })[0];
            r.querySelector(".approve").addEventListener("click", async function () { busy(this, true); try { await API.admin.approve(p); r.remove(); say("admMsg", unitLabel(p.unit_id) + " 승인했습니다. 계약서 사진은 삭제했습니다."); counts(); } catch (e) { busy(this, false); err(e); } });
            r.querySelector(".reject").addEventListener("click", async function () { busy(this, true); try { await API.admin.reject(p, r.querySelector(".reason").value); r.remove(); say("admMsg", "반려했습니다. 계약서 사진은 삭제했습니다."); counts(); } catch (e) { busy(this, false); err(e); } });
            r.querySelector(".del").addEventListener("click", async function () {
              var b = this; if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; }
              busy(b, true); try { await API.admin.deleteAccount(p); r.remove(); say("admMsg", unitLabel(p.unit_id) + " 계정을 삭제했습니다. 이제 이 세대로 새로 가입할 수 있습니다."); counts(); } catch (e) { busy(b, false); err(e); }
            });
          });
        }
        if (cur === "members") {
          var M = await API.admin.profiles(), O = await API.admin.orphans(), q = "", AGU = {}, AGN = {};
          arr(await API.admin.agreements().catch(function () { return []; })).forEach(function (a) { if (a.user_id) AGU[a.user_id] = a; AGN[a.unit_id] = a; });
          var agOf = function (p) { return AGU[p.id] || AGN[p.unit_id] || null; };
          var CI = await API.chatInfo().catch(function () { return null; }) || {};
          var cntS = function (s) { return M.filter(function (p) { return p.status === s; }).length; }, cntAg = M.filter(function (p) { return p.status === "approved" && agOf(p); }).length;
          B.innerHTML =
            '<div class="toolbar"><div class="chips" id="mSt" role="group" aria-label="회원 걸러 보기">' +
              '<button type="button" class="chip" data-s="" aria-pressed="true">전체 ' + M.length + "</button>" +
              '<button type="button" class="chip" data-s="approved" aria-pressed="false">승인 ' + cntS("approved") + "</button>" +
              '<button type="button" class="chip" data-s="pending" aria-pressed="false">대기 ' + cntS("pending") + "</button>" +
              '<button type="button" class="chip" data-s="rejected" aria-pressed="false">반려 ' + cntS("rejected") + "</button>" +
              '<span class="chip-sep" aria-hidden="true"></span>' +
              '<button type="button" class="chip" data-s="agreed" aria-pressed="false" title="승인 회원 중 위임동의서를 낸 세대">위임 완료 ' + cntAg + "</button>" +
              '<button type="button" class="chip" data-s="noagree" aria-pressed="false" title="승인 회원 중 아직 위임동의서를 내지 않은 세대">위임 미제출 ' + (cntS("approved") - cntAg) + "</button></div>" +
            '<form class="find" id="mFind"><label for="mQ" class="sr">검색</label><input id="mQ" placeholder="동-호, 닉네임"></form></div><div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>타입</th><th>닉네임</th><th>상태</th><th>위임동의</th><th>가입</th><th></th></tr></thead><tbody id="mList"></tbody></table></div>' +
            '<div class="adm-sec">' + head("가입 · 승인 기록", '<span class="note">최근 100건 · 지우지 않고 보관</span>') + '<div class="tablebox"><table class="spec"><tbody id="mLog"><tr><td class="muted">불러오는 중…</td></tr></tbody></table></div></div>' +
            (O.length ? '<div class="adm-sec">' + head("가입 중단 계정", '<span class="note">계정만 있고 계약서 사진이 없는 세대</span>') + '<div class="tablebox"><table class="spec"><tbody>' + O.map(function (o) { return '<tr><td class="num">' + esc(o.unit_id) + '</td><td class="num">' + fmtTime(o.created_at) + '</td><td><button type="button" class="linkbtn delorphan" data-id="' + o.id + '">계정 삭제</button></td></tr>'; }).join("") + "</tbody></table></div></div>" : "") +
            '<div class="adm-sec">' + '<form class="panel chat-admin" id="fChat" novalidate><h3 style="margin-bottom:10px">입주민 오픈채팅 입장 정보 <span class="muted small">위임 세대에게만 보임</span></h3>' +
            '<div class="two" style="gap:12px"><div class="field"><label for="chUrl">채팅방 주소</label><input id="chUrl" placeholder="https://open.kakao.com/o/..." value="' + esc(CI.url || "") + '"></div>' +
            '<div class="field"><label for="chPw">입장 비밀번호</label><input id="chPw" maxlength="40" value="' + esc(CI.password || "") + '"></div></div>' +
            '<p class="cta-row" style="margin:0"><button class="btn solid" type="submit">저장</button>' + (CI.updated_at ? '<span class="muted small">마지막 변경 ' + fmtTime(CI.updated_at) + "</span>" : "") + '</p></form>' + "</div>";
          el("fChat").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.admin.setChatInfo(el("chUrl").value, el("chPw").value); say("admMsg", "오픈채팅 입장 정보를 저장했습니다. 위임 세대의 카페 · 바로가기 화면에 바로 나옵니다."); } catch (er) { err(er); } });
          var sf = "", WHO = {}; M.forEach(function (p) { WHO[p.id] = p.unit_id; });
          var ACT = { signup: "가입 신청", approve: "승인", reject: "반려", reapply: "재신청", revoke: "승인 취소", admin_on: "운영진 지정", admin_off: "운영진 해제", "delete": "계정 삭제" };
          API.admin.memberLog().then(function (L) {
            var lim = 15, rows = L.slice(0, 100);
            var drawLog = function () { el("mLog").innerHTML = rows.slice(0, lim).map(function (x) {
              var by = !x.by_user ? "시스템" : x.by_user === x.profile_id ? "본인" : "운영진 " + (WHO[x.by_user] || "");
              return '<tr><td class="num">' + fmtTime(x.at) + '</td><td class="num">' + esc(x.unit_id) + "</td><td>" + esc(ACT[x.action] || x.action) + (x.note ? ' <span class="muted small">(' + esc(x.note) + ")</span>" : "") + '</td><td class="muted small">' + esc(by) + "</td></tr>";
            }).join("") || '<tr><td class="muted">기록이 없습니다.</td></tr>';
              if (rows.length > lim) el("mLog").insertAdjacentHTML("beforeend", '<tr><td colspan="4"><button type="button" class="linkbtn" id="mLogMore">' + (rows.length - lim) + "건 더 보기</button></td></tr>");
              var mb = el("mLogMore"); if (mb) mb.addEventListener("click", function () { lim = 100; drawLog(); });
            }; drawLog();
          }).catch(function (e) { el("mLog").innerHTML = '<tr><td class="muted">기록을 불러오지 못했습니다.</td></tr>'; });
          function draw() {
            el("mList").innerHTML = M.filter(function (p) {
              var okS = !sf || (sf === "agreed" ? p.status === "approved" && !!agOf(p) : sf === "noagree" ? p.status === "approved" && !agOf(p) : p.status === sf);
              return okS && (!q || (p.unit_id + (p.nickname || "")).indexOf(q) >= 0);
            }).map(function (p) {
              var ag = agOf(p);
              return '<tr><td class="num">' + esc(p.unit_id) + "</td><td>" + esc((UNIT[p.unit_id] || {}).type || "") + "</td><td>" + esc(p.nickname || "-") + "</td><td>" + ({ approved: "승인", pending: "대기", rejected: "반려" })[p.status] + (p.is_admin ? " · 운영진" : "") + "</td><td>" + (ag ? '<span class="tag">' + (ag.source === "paper" ? "서면" : "온라인") + '</span> <span class="num small">' + fmtDate(ag.signed_at) + "</span>" : '<span class="tag off">미제출</span>') + '</td><td class="num">' + fmtDate(p.created_at) + "</td><td>" +
                (p.status === "approved" && p.id !== API.session.user.id ? '<button type="button" class="linkbtn revoke" data-id="' + p.id + '">승인 취소</button>' : "") +
                (p.status === "approved" && p.id !== API.session.user.id ? ' <button type="button" class="linkbtn setadm" data-id="' + p.id + '" data-on="' + (p.is_admin ? "0" : "1") + '">' + (p.is_admin ? "운영진 해제" : "운영진 지정") + "</button>" : "") +
                (!p.is_admin && p.id !== API.session.user.id ? ' <button type="button" class="linkbtn delacct" data-id="' + p.id + '">계정 삭제</button>' : "") + "</td></tr>";
            }).join("") || '<tr><td colspan="7" class="muted">해당하는 회원이 없습니다.</td></tr>';
          }
          draw();
          el("mSt").addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (!b) return; sf = b.dataset.s; el("mSt").querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); draw(); });
          el("mQ").addEventListener("input", function () { q = this.value.trim(); draw(); });
          el("mFind").addEventListener("submit", function (e) { e.preventDefault(); });
          B.querySelectorAll(".delorphan").forEach(function (b) { b.addEventListener("click", async function () {
            if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; }
            try { await API.admin.deleteAccount({ id: b.dataset.id }); await show(); say("admMsg", "계정을 삭제했습니다."); } catch (er) { err(er); }
          }); });
          el("mList").addEventListener("click", async function (e) {
            var sa = e.target.closest(".setadm");
            if (sa) {
              var ps = M.filter(function (x) { return x.id === sa.dataset.id; })[0], on = sa.dataset.on === "1";
              if (sa.dataset.confirm !== "1") { sa.dataset.confirm = "1"; sa.textContent = "한 번 더 누르면 " + (on ? "지정" : "해제"); return; }
              try { await API.admin.setAdmin(ps, on); await show(); say("admMsg", ps.unit_id + (on ? " 회원을 운영진으로 지정했습니다." : " 회원의 운영진 권한을 해제했습니다.")); } catch (er) { err(er); }
              return;
            }
            var d = e.target.closest(".delacct");
            if (d) {
              var pd = M.filter(function (x) { return x.id === d.dataset.id; })[0];
              if (d.dataset.confirm !== "1") { d.dataset.confirm = "1"; d.textContent = "한 번 더 누르면 삭제"; return; }
              try { await API.admin.deleteAccount(pd); await show(); say("admMsg", pd.unit_id + " 계정을 삭제했습니다. 이 세대의 위임동의 · 글도 함께 지워졌습니다."); } catch (er) { err(er); }
              return;
            }
            var b = e.target.closest(".revoke"); if (!b) return;
            var p = M.filter(function (x) { return x.id === b.dataset.id; })[0];
            if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "사유 입력 후 다시 누르기"; var i = document.createElement("input"); i.className = "reason"; i.placeholder = "승인 취소 사유"; i.setAttribute("aria-label", "승인 취소 사유"); b.before(i); return; }
            try { await API.admin.revoke(p, b.previousSibling.value); await show(); say("admMsg", p.unit_id + " 승인을 취소했습니다. 이 세대의 위임동의도 함께 삭제했습니다."); } catch (er) { err(er); }
          });
        }
        if (cur === "agreements") {
          var A = await API.admin.agreements(), lg = await API.admin.log(), PS = {}, WD = await API.admin.withdrawals().catch(function () { return []; });
          try { arr(await API.admin.profiles()).forEach(function (p) { PS[p.id] = p.status; }); } catch (e) {}
          var counted = function (a) { return a.source === "paper" || PS[a.user_id] === "approved"; };
          var how = function (a) { return a.source === "paper" ? "서면" : "온라인"; };
          var rows = [["세대", "동", "호", "타입", "계약자 성명", "방식", "제출일시", "현황 반영", "휴대전화", "카페 닉네임", "공동명의자", "문서 번호"]].concat(A.map(function (a) { var u = UNIT[a.unit_id] || {};
            return [a.unit_id, u.dong, u.ho, u.type, a.signer_name || "", how(a), fmtTime(a.signed_at), counted(a) ? "반영" : "승인 전", a.agree_contact ? a.phone || "" : "", a.cafe_nick || "", a.co_name || "", String(a.doc_hash || "").slice(0, 16)]; }));
          var text = csv(rows), OK3 = A.filter(function (a) { return counted(a) && a.agree_third_party; });
          var wdBox = WD.length ? '<div class="panel wd-box"><h3 style="margin-bottom:6px">확인하지 않은 위임동의 철회 <span class="cnt-b">' + WD.length + '</span></h3><p class="muted small" style="margin:0 0 8px">철회가 있으면 오픈채팅 비밀번호를 바꾸는 것을 권장합니다(회원 탭).</p>' +
            '<ul class="wd-list">' + WD.map(function (w) { return '<li><b class="num">' + esc(w.unit_id) + '</b><span class="muted small">' + esc(unitLabel(w.unit_id)) + " · " + fmtTime(w.at) + (w.by_self ? " · 본인 철회" : "") + '</span><button type="button" class="linkbtn wdack" data-id="' + w.id + '">확인</button></li>'; }).join("") + "</ul>" +
            '<p class="cta-row" style="margin:8px 0 0"><button type="button" class="btn" id="wdAll">모두 확인</button></p></div>' : "";
          B.innerHTML = wdBox + '<div class="toolbar"><b>' + n(A.filter(counted).length) + "세대 반영</b> <span class=\"muted small\">(제출 " + n(A.length) + "세대 · 서면 " + n(A.filter(function (a) { return a.source === "paper"; }).length) + ')</span>' +
            '<div class="cta-row" style="margin:0"><button type="button" class="btn" id="wiAll">기관 제출용 위임 현황 (이름 없이 동별 집계)</button><button type="button" class="btn" id="csvCopy">CSV 복사</button><button type="button" class="btn" id="csvDl">CSV 내려받기</button></div></div>' +
            '<details class="panel lh-more" id="paperBox"><summary>서면 위임장 등록 <span class="muted small">공식 메일로 받은 위임장</span></summary><form id="fPaper" novalidate style="margin-top:12px">' + unitPicker("pp") +
            '<div class="two" style="gap:12px"><div class="field"><label for="ppName">계약자 성명</label><input id="ppName" maxlength="30"></div><div class="field"><label for="ppDate">서명일</label><input id="ppDate" type="date"></div></div>' +
            '<div class="field"><label for="ppFile">위임장 스캔본 <span class="muted small">사진 · PDF, 10MB 이하 · 주민등록번호가 보이면 등록하지 말고 다시 받으세요</span></label><input id="ppFile" type="file" accept="image/*,application/pdf"></div>' +
            '<label class="check"><input type="checkbox" id="ppContact"> 위임장에 휴대전화번호가 적혀 있음</label>' +
            '<div class="field" id="ppPhoneBox" hidden><label for="ppPhone">휴대전화</label><input id="ppPhone" inputmode="tel" placeholder="010-0000-0000" maxlength="13"></div>' +
            '<button class="btn solid" type="submit">서면 위임장 등록</button></form></details>' +
            '<div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>성명</th><th>방식</th><th>제출</th><th>연락처</th><th></th></tr></thead><tbody id="agList">' +
            (A.map(function (a) { var u = UNIT[a.unit_id] || {};
              return '<tr' + (counted(a) ? "" : ' class="muted"') + '><td class="num">' + esc(a.unit_id) + ' <span class="muted small">' + esc(u.type || "") + "</span></td><td>" + esc(a.signer_name || "-") + "</td><td>" + how(a) + (counted(a) ? "" : " · 승인 전") + '</td><td class="num">' + fmtTime(a.signed_at) + '</td><td class="num">' + (a.agree_contact ? esc(a.phone || "") : "-") + "</td><td>" +
                '<button type="button" class="linkbtn wiOne" data-u="' + esc(a.unit_id) + '">위임장</button>' + (a.paper_path ? ' <button type="button" class="linkbtn paperView" data-u="' + esc(a.unit_id) + '">원본</button>' : "") +
                (a.source === "paper" ? ' <button type="button" class="linkbtn paperDel" data-u="' + esc(a.unit_id) + '">서면 철회</button>' : "") + "</td></tr>"; }).join("") || '<tr><td colspan="7" class="muted">아직 제출된 위임동의서가 없습니다.</td></tr>') +
            "</tbody></table></div>" + head("최근 기록", '<span class="note">제출 · 철회 최근 50건</span>') + '<div class="tablebox"><table class="spec"><tbody>' + (lg.slice(0, 50).map(function (x) { return '<tr><td class="num">' + fmtTime(x.at) + '</td><td class="num">' + esc(x.unit_id) + "</td><td>" + (x.action === "sign" ? "제출" : "철회") + '</td><td class="muted small">' + (!x.by_user ? "시스템" : x.by_user === x.user_id ? "본인" : "운영진") + "</td></tr>"; }).map(moreRow).join("") + moreBtn(Math.min(lg.length, 50)) || '<tr><td class="muted">기록이 없습니다.</td></tr>') + "</tbody></table></div>" +
            '<textarea class="out" id="csvOut" readonly hidden aria-label="CSV"></textarea>';
          var byU = {}; A.forEach(function (a) { byU[a.unit_id] = a; });
          bindUnitPicker("pp");
          el("ppContact").addEventListener("change", function () { el("ppPhoneBox").hidden = !this.checked; });
          el("fPaper").addEventListener("submit", async function (e) {
            e.preventDefault(); var b = this.querySelector("button[type=submit]"); busy(b, true, "등록 중…");
            try { await API.admin.registerPaper({ unit: el("ppHo").value, signer: el("ppName").value, signedOn: el("ppDate").value, file: el("ppFile").files[0], thirdParty: false, contact: el("ppContact").checked, phone: el("ppPhone").value });
              await show(); say("admMsg", "서면 위임장을 등록했습니다. 현황판에 반영되었습니다."); }
            catch (er) { busy(b, false); err(er); }
          });
          el("agList").addEventListener("click", async function (e) {
            var w = e.target.closest(".wiOne"); if (w) { showPrint(wiDoc(byU[w.dataset.u]), "위임장 · " + w.dataset.u); return; }
            var v = e.target.closest(".paperView"); if (v) { try { window.open(await API.admin.paperUrl(byU[v.dataset.u].paper_path), "_blank", "noopener"); } catch (er) { err(er); } return; }
            var d = e.target.closest(".paperDel");
            if (d) { if (d.dataset.confirm !== "1") { d.dataset.confirm = "1"; d.textContent = "한 번 더 누르면 철회 · 원본 삭제"; return; }
              try { await API.admin.withdrawPaper(byU[d.dataset.u]); await show(); say("admMsg", d.dataset.u + " 서면 위임을 철회하고 원본을 삭제했습니다."); } catch (er) { err(er); } }
          });
          var ackDo = async function (ids) { try { await API.admin.ackWithdrawals(ids); await show(); counts(); say("admMsg", "철회를 확인했습니다."); } catch (er) { err(er); } };
          B.querySelectorAll(".wdack").forEach(function (b) { b.addEventListener("click", function () { ackDo([Number(b.dataset.id)]); }); });
          if (el("wdAll")) el("wdAll").addEventListener("click", function () { ackDo(WD.map(function (w) { return w.id; })); });
          el("wiAll").addEventListener("click", function () {
            var by = {}, tot = 0; A.filter(counted).forEach(function (a2) { var d = (UNIT[a2.unit_id] || {}).dong || String(a2.unit_id).split("-")[0]; by[d] = (by[d] || 0) + 1; tot++; });
            var dongs = {}; UNITS.forEach(function (u) { dongs[u.dong] = (dongs[u.dong] || 0) + 1; });
            showPrint('<article class="wi-doc wi-list"><h1>고양창릉 S-4블록 입주예정자협의회 위임 현황</h1><p class="muted">' + esc(fmtTime(new Date().toISOString())) + " 기준 · 전체 " + n(T) + "세대 중 위임 <b>" + n(tot) + "세대</b> (" + (tot / T * 100).toFixed(1) + "%)</p>" +
              '<table><thead><tr><th>동</th><th>세대수</th><th>위임 세대</th><th>비율</th></tr></thead><tbody>' + Object.keys(dongs).sort().map(function (d) {
                var k = by[d] || 0; return "<tr><td>" + esc(d) + "동</td><td>" + n(dongs[d]) + "</td><td>" + n(k) + "</td><td>" + (k / dongs[d] * 100).toFixed(1) + "%</td></tr>"; }).join("") +
              '</tbody></table><p class="wi-foot">회칙 제33조에 따라 세대별 성명 · 연락처 등 회원 정보는 외부에 제공하지 않습니다. 세대별 위임장 원문은 협의회가 보관합니다.</p></article>', "기관 제출용 위임 현황");
          });
          el("csvCopy").addEventListener("click", function () { var o = el("csvOut"), b = this; o.value = text; o.hidden = false; try { navigator.clipboard.writeText(text).then(function () { b.textContent = "복사했습니다"; }, function () { o.select(); }); } catch (e) { o.select(); } });
          el("csvDl").addEventListener("click", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })); a.download = "위임동의_" + fmtDate(new Date()).replace(/\./g, "") + ".csv"; document.body.appendChild(a); a.click(); a.remove(); });
        }
        if (cur === "cafe") await adminCafe(B, err, show, csv);
        if (cur === "dues") await adminDues(B, err, show, csv);
        if (cur === "polls") {
          var P = await API.polls();
          B.innerHTML = '<form class="panel" id="fPoll" novalidate><h3 style="margin-bottom:10px">새 투표</h3><div class="field"><label for="pQ">질문</label><input id="pQ" maxlength="200"></div><div class="field"><label for="pO">선택지 (한 줄에 하나, 2~10개)</label><textarea id="pO" style="min-height:90px"></textarea></div><div class="field"><label for="pE">마감일</label><input id="pE" type="date"></div><button class="btn solid" type="submit">투표 열기</button></form>' +
            head("투표 목록") + (P.length ? '<div class="tablebox"><table class="spec"><tbody>' + P.map(function (p) { var t = p.votes.reduce(function (s, v) { return s + v; }, 0); return "<tr><td>" + esc(p.question) + '</td><td class="num">' + n(t) + "표</td><td>" + (p.closed ? "마감" : fmtDate(p.ends_at) + " 마감") + '</td><td><button type="button" class="linkbtn delpoll" data-id="' + p.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("투표가 없습니다", ""));
          el("fPoll").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.admin.createPoll({ question: el("pQ").value, options: el("pO").value.split("\n"), ends: el("pE").value }); show(); } catch (er) { err(er); } });
          B.querySelectorAll(".delpoll").forEach(function (b) { b.addEventListener("click", async function () { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; } try { await API.admin.deletePoll(Number(b.dataset.id)); show(); } catch (er) { err(er); } }); });
        }
        if (cur === "news") {
          var NW = await API.admin.newsAll();
          B.innerHTML = '<div class="toolbar"><span class="muted small">매일 07:13에 자동 수집합니다. 엉뚱한 기사는 숨기면 사이트에서 빠집니다.</span><button type="button" class="btn solid" id="collectNow">지금 수집</button></div>' +
            (NW.length ? '<div class="tablebox"><table class="spec"><thead><tr><th>구분</th><th>제목</th><th>출처</th><th>날짜</th><th></th></tr></thead><tbody>' + NW.map(function (x) {
              return '<tr class="' + (x.hidden ? "muted" : "") + '"><td><span class="tag' + (x.kind === "lh" ? " hot" : "") + '">' + (x.kind === "lh" ? "LH" : esc(x.topic)) + '</span></td><td><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a>" + (x.hidden ? " (숨김)" : "") + "</td><td>" + esc(x.source) + '</td><td class="num">' + (x.published_at ? fmtDate(x.published_at) : "") + '</td><td><button type="button" class="linkbtn togglenews" data-id="' + x.id + '" data-h="' + (x.hidden ? "0" : "1") + '">' + (x.hidden ? "다시 보이기" : "숨기기") + "</button></td></tr>";
            }).join("") + "</tbody></table></div>" : empty("아직 수집된 소식이 없습니다", "\"지금 수집\"을 눌러 바로 가져올 수 있습니다."));
          el("collectNow").addEventListener("click", async function () {
            var b = this; busy(b, true, "수집 중…");
            try { var res = await API.admin.collectNow(); await show(); say("admMsg", "찾은 소식 " + res.found + "건, 새로 올린 소식 " + res.inserted + "건" + (res.daum && res.daum.length ? " · 다음 검색 " + res.daum.map(function (d) { return d.q + " " + d.raw + "→" + d.news + "→" + d.kept; }).join(", ") : "") + (res.errors && res.errors.length ? " · 일부 실패: " + res.errors.join(" / ") : "")); }
            catch (er) { busy(b, false); err(er); }
          });
          B.querySelectorAll(".togglenews").forEach(function (t) { t.addEventListener("click", async function () { try { await API.admin.setNewsHidden(Number(t.dataset.id), t.dataset.h === "1"); await show(); } catch (er) { err(er); } }); });
        }
        if (cur === "photos") {
          var VS = await API.visits(), PH = await API.photos(), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
          var catOpts = function (sel) { return API.photoCats.map(function (c) { return "<option" + (c === sel ? " selected" : "") + ">" + c + "</option>"; }).join(""); };
          var warn = '<p class="muted small" style="margin:0 0 10px">사진은 누구나 볼 수 있습니다. <b>사람 얼굴 · 차량 번호판 · 서류</b>가 보이면 올리지 마세요. 올릴 때 자동으로 줄이고(긴 변 1600px) 촬영 위치 정보는 지웁니다. 한 번에 30장까지.</p>';
          B.innerHTML = '<div class="two">' +
            '<form class="panel" id="fVisit" novalidate><h3 style="margin-bottom:10px" id="vHead">현장 방문 기록 쓰기</h3>' +
            '<div class="two" style="gap:12px"><div class="field"><label for="vDate">방문 날짜</label><input id="vDate" type="date" value="' + today + '"></div><div class="field"><label for="vTitle">제목</label><input id="vTitle" maxlength="120" placeholder="예: 11월 정기 현장 방문"></div></div>' +
            '<div class="field"><label for="vBody">내용</label><textarea id="vBody" maxlength="5000" style="min-height:120px" placeholder="확인한 공정, LH 답변, 다음 확인할 것"></textarea></div>' +
            '<div class="field"><label for="vFiles">사진 <span class="muted small">선택 · 여러 장 · 사진관 "현장 방문"에도 함께 올라감</span></label><input id="vFiles" type="file" accept="image/*" multiple></div>' + warn +
            '<p class="cta-row" style="margin:0"><button class="btn solid" type="submit" id="vSave">기록 올리기</button><button class="btn" type="button" id="vCancel" hidden>수정 취소</button></p><input type="hidden" id="vId"></form>' +
            '<form class="panel" id="fPhoto" novalidate><h3 style="margin-bottom:10px">사진관에 사진 올리기</h3>' +
            '<div class="two" style="gap:12px"><div class="field"><label for="phCat">분류</label><select id="phCat">' + catOpts("공사 현장") + '</select></div><div class="field"><label for="phDate">찍은 날짜</label><input id="phDate" type="date" value="' + today + '"></div></div>' +
            '<div class="field"><label for="phTitle">제목 <span class="muted small">여러 장이면 모두 같은 제목</span></label><input id="phTitle" maxlength="120" placeholder="예: 403동 골조 공사"></div>' +
            '<div class="field"><label for="phFiles">사진</label><input id="phFiles" type="file" accept="image/*" multiple></div>' + warn +
            '<button class="btn solid" type="submit">사진 올리기</button></form></div>' +
            head("현장 방문 기록", '<span class="note">' + n(VS.length) + "건</span>") +
            (VS.length ? '<div class="tablebox"><table class="spec"><tbody>' + VS.map(function (v) { return '<tr><td class="num">' + dotDate(v.visited_on) + "</td><td><b>" + esc(v.title) + '</b><br><span class="muted small">' + esc(String(v.body || "").slice(0, 80)) + '</span></td><td class="num">사진 ' + arr(v.photos).length + '장</td><td><button type="button" class="linkbtn editv" data-id="' + v.id + '">수정</button> <button type="button" class="linkbtn delv" data-id="' + v.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("아직 방문 기록이 없습니다", "위 칸에 첫 기록을 남겨 보세요.")) +
            head("사진관", '<span class="note">' + n(PH.length) + "장 · 제목 · 분류를 고치고 저장</span>") +
            (PH.length ? '<div class="adm-photos">' + PH.map(function (p) { return '<div class="adm-ph" data-id="' + p.id + '"><img src="' + esc(API.photoUrl(p.path)) + '" alt="" loading="lazy"><input class="t" maxlength="120" value="' + esc(p.title) + '" aria-label="제목"><select class="c" aria-label="분류">' + catOpts(p.cat) + '</select><input class="d" type="date" value="' + esc(p.taken_on || "") + '" aria-label="날짜"><p class="cta-row" style="margin:0"><button type="button" class="linkbtn savep">저장</button><button type="button" class="linkbtn delp">삭제</button></p></div>'; }).join("") + "</div>" : empty("아직 사진이 없습니다", ""));
          var prog = function (i, t) { say("admMsg", "사진 올리는 중… " + i + " / " + t); };
          var report = function (r, what) { say("admMsg", what + (r.done.length ? " · 사진 " + r.done.length + "장" : "") + (r.fails.length ? " · 실패 " + r.fails.length + "장: " + r.fails.join(" / ") : ""), !!r.fails.length); };
          function resetVisit() { el("vId").value = ""; el("vTitle").value = ""; el("vBody").value = ""; el("vFiles").value = ""; el("vDate").value = today; el("vHead").textContent = "현장 방문 기록 쓰기"; el("vSave").textContent = "기록 올리기"; el("vCancel").hidden = true; }
          el("vCancel").addEventListener("click", resetVisit);
          el("fVisit").addEventListener("submit", async function (e) {
            e.preventDefault(); var btn = el("vSave"); busy(btn, true, "올리는 중…");
            try { var id = Number(el("vId").value) || null; var r = await API.admin.saveVisit({ id: id, date: el("vDate").value, title: el("vTitle").value, body: el("vBody").value }, el("vFiles").files, prog); await show(); report(r, id ? "방문 기록을 고쳤습니다" : "방문 기록을 올렸습니다"); }
            catch (er) { busy(btn, false); err(er); }
          });
          el("fPhoto").addEventListener("submit", async function (e) {
            e.preventDefault(); var btn = this.querySelector("button[type=submit]"); busy(btn, true, "올리는 중…");
            try { var r = await API.admin.addPhotos(el("phFiles").files, { cat: el("phCat").value, title: el("phTitle").value, takenOn: el("phDate").value }, prog); await show(); report(r, "사진관에 올렸습니다"); }
            catch (er) { busy(btn, false); err(er); }
          });
          B.querySelectorAll(".editv").forEach(function (b) { b.addEventListener("click", function () {
            var v = VS.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
            el("vId").value = v.id; el("vDate").value = v.visited_on; el("vTitle").value = v.title; el("vBody").value = v.body || "";
            el("vHead").textContent = "방문 기록 고치기"; el("vSave").textContent = "고친 내용 저장"; el("vCancel").hidden = false; el("fVisit").scrollIntoView({ behavior: "smooth", block: "start" });
          }); });
          B.querySelectorAll(".delv").forEach(function (b) { b.addEventListener("click", async function () {
            var v = VS.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
            if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제" + (arr(v.photos).length ? " (사진 " + v.photos.length + "장 포함)" : ""); return; }
            try { await API.admin.deleteVisit(v); await show(); say("admMsg", "방문 기록을 삭제했습니다."); } catch (er) { err(er); }
          }); });
          B.querySelectorAll(".adm-ph").forEach(function (c) {
            var p = PH.filter(function (x) { return x.id === Number(c.dataset.id); })[0];
            c.querySelector(".savep").addEventListener("click", async function () { try { await API.admin.updatePhoto(p.id, { title: c.querySelector(".t").value, cat: c.querySelector(".c").value, takenOn: c.querySelector(".d").value }); say("admMsg", "사진 정보를 저장했습니다."); } catch (er) { err(er); } });
            c.querySelector(".delp").addEventListener("click", async function () { var b = this; if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; } try { await API.admin.deletePhoto(p); c.remove(); say("admMsg", "사진을 삭제했습니다."); } catch (er) { err(er); } });
          });
        }
        if (cur === "campaigns") {
          var CP = await API.campaigns(), ST = ["의견 모집", "접수 완료", "답변 완료"];
          B.innerHTML = '<form class="panel" id="fCamp" novalidate><h3 style="margin-bottom:10px">새 단체민원</h3><div class="field"><label for="cT">제목</label><input id="cT" maxlength="120"></div><div class="field"><label for="cTo">대상 기관</label><input id="cTo" maxlength="60" placeholder="예: 고양시, LH 경기북부지역본부"></div><div class="field"><label for="cD">설명</label><textarea id="cD" style="min-height:90px"></textarea></div><button class="btn solid" type="submit">민원 열기</button></form>' +
            head("민원 목록") + (CP.length ? '<div class="tablebox"><table class="spec"><tbody>' + CP.map(function (c) { return "<tr><td>" + esc(c.title) + '</td><td class="num">' + n(c.joined) + '세대</td><td><select class="cst" data-id="' + c.id + '" aria-label="상태">' + ST.map(function (s) { return "<option" + (s === c.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select></td><td><button type="button" class="linkbtn delcamp" data-id="' + c.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("민원이 없습니다", ""));
          el("fCamp").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.admin.createCampaign({ title: el("cT").value, target: el("cTo").value, description: el("cD").value }); show(); } catch (er) { err(er); } });
          B.querySelectorAll(".cst").forEach(function (s) { s.addEventListener("change", async function () { try { await API.admin.setCampaignStatus(Number(s.dataset.id), s.value); say("admMsg", "상태를 바꿨습니다."); } catch (er) { err(er); } }); });
          B.querySelectorAll(".delcamp").forEach(function (b) { b.addEventListener("click", async function () { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; } try { await API.admin.deleteCampaign(Number(b.dataset.id)); show(); } catch (er) { err(er); } }); });
        }
      } catch (e) { B.innerHTML = ""; err(e); }
    }
    window.addEventListener("hashchange", function () {
      var h = location.hash.slice(1);
      if (h !== cur && TABS.some(function (t) { return t[0] === h; })) { cur = h; C.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x.dataset.t === cur); }); show(); }
    });
    await counts(); await show();
  };

  /* LH 공사진행현황 (매일 GitHub Actions가 assets/lh-progress.json 갱신) */
  var LHP = null;
  if (wantLH) {
    LHP = await P_LHP;
    if (LHP && LHP.info && LHP.info.rate != null) {
      var rp = arr(LHP.reports), last = rp[0];
      S.progress = Object.assign({}, S.progress, { overall: LHP.info.rate, asOf: "LH 공사진행현황 " + (last ? last.date : "") + " 기준" });
      var byYm = {};
      rp.slice().reverse().forEach(function (r) { if (typeof r.rate === "number") byYm[r.date.slice(0, 7)] = r.rate; });
      var ms = Object.keys(byYm).sort().map(function (k) { return { ym: k, rate: byYm[k] }; });
      if (ms.length) S.progressMonthly = ms;
    }
  }
  if (wantStats) {
    var both = await P_STATS, sts = both[0], ms2 = both[1];
    LIVE_AGREED = sts ? sts.reduce(function (s, r) { return s + r.agreed; }, 0) : null;
    LIVE_MEMBERS = ms2 ? ms2.reduce(function (s, r) { return s + r.members; }, 0) : null;
  }
  if (R[page]) {
    try { await R[page](); if (page === "home") await homeNews(); }
    catch (e) { if (C) C.innerHTML = '<div class="notice-box">' + esc(API.errorText ? API.errorText(e) : e.message) + "</div>"; }
  }
  }
  boot();
})();
