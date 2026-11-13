(function () {
  "use strict";
  var S = window.SITE;
  var main = document.getElementById("main");
  if (!S || !main) return;
  var page = main.dataset.page;
  var API = window.API || { enabled: false };
  var LIVE = API.enabled;
  /* 설정은 있는데 서버 연결 도구가 안 읽힌 경우(차단 · 오래된 캐시 · 인앱 브라우저): '미리보기'가 아니라 연결 실패로 안내 */
  var CONN_FAIL = !LIVE && !!(window.S4_CONFIG && window.S4_CONFIG.supabaseUrl);
  var PREVIEW_MSG = CONN_FAIL ? "서버에 연결하지 못해 지금은 가입 · 로그인이 되지 않습니다. 새로고침하거나, 카카오톡 등 앱 안에서 열었다면 크롬 · 사파리 같은 기본 브라우저로 열어 주세요." : "미리보기 화면입니다. 서버가 연결되기 전이라 실제로 가입 · 로그인되지는 않습니다.";
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
    { name: "소식", items: [["schedule.html", "주요일정", "schedule", "청약부터 입주까지"], ["news.html", "언론보도", "news", "S-4 관련 기사"]] },
    { name: "우리 단지", items: [["floorplan.html", "단지 · 평면", "floorplan", "7개 타입과 단지 개요"], ["progress.html", "공사현황", "progress", "공정률과 현장 기록"], ["calculator.html", "내 아파트", "calculator", "우리 집 옵션 · 납부 계산"]] },
    { name: "협의회", items: [["association.html", "협의회 소개", "association", "인사말 · 조직 · 회칙 · 회계"], ["agreement.html", "위임동의", "agreement", "현황판 · 동의서 제출"], ["petition.html", "민원", "petition", "함께 내는 민원 참여"]] },
    { name: "커뮤니티", items: [["cafe.html", "카페 · 오픈채팅", "cafe", "가입 · 입장 안내"], ["info.html", "정보", "info", "자료 · 자주 묻는 질문"], ["links.html", "바로가기", "links", "LH · 기관 · 문의처"]] }
  ];
  var NAVKEY = { bylaws: "association", consent: "agreement", participate: "petition", documents: "info", faq: "info" }[page] || page;
  var myGroup = GROUPS.filter(function (g) { return g.items.some(function (x) { return x[2] === NAVKEY; }); })[0];
  var HEAD = {
    login: ["MEMBERS", "로그인 · 회원가입", "입주예정자 인증을 거친 회원만 위임동의와 민원 참여, 회원 전용 안내를 이용할 수 있습니다."],
    account: ["MY PAGE", "내 정보", "가입 상태와 위임동의 내역을 확인합니다."],
    consent: ["CONSENT", "위임동의서", "공급계약을 마친 계약자가 제출합니다."],
    privacy: ["PRIVACY", "개인정보처리방침", "협의회가 어떤 정보를 왜 받고, 언제 지우는지 안내합니다."],
    admin: ["ADMIN", "운영진", "가입 승인부터 위임동의 · 회비 · 투표 · 민원 · 자료 수집까지 관리합니다."],
    notice: ["NOTICE", "공지사항", "협의회와 LH의 안내입니다."],
    schedule: ["SCHEDULE", "주요 일정", "청약부터 입주까지의 흐름입니다."],
    news: ["MEDIA", "언론보도", "S-4블록 · 창릉신도시 · 교통(고양은평선 · GTX 창릉역) 관련 기사입니다."],
    floorplan: ["FLOOR PLAN", "단지 · 평면", "7개 주택형의 공급 정보와 단지 개요입니다. 평면도 원본은 모집공고 첨부를 확인하세요."],
    progress: ["CONSTRUCTION", "공사현황", "공정률과 현장 방문 기록입니다."],
    bylaws: ["BYLAWS", "회칙", "협의회가 어떻게 운영되는지 회원 모두가 함께 정한 약속입니다."],
    association: ["ASSOCIATION", "협의회 소개", "입주예정자의 의견을 모아 LH와 관계 기관에 전달하는 자발적 모임입니다."],
    agreement: ["AGREEMENT BOARD", "위임동의 현황판", "동·호수별 위임동의 현황입니다."],
    participate: ["PARTICIPATE", "단체민원 · 투표", "여러 세대가 함께 낸 목소리는 더 무겁습니다."],
    links: ["LINKS", "바로가기", "LH · 청약 · 세금 · 시청 등 자주 쓰는 기관 사이트와 문의처입니다."],
    calculator: ["MY HOME", "내 아파트", "가입한 동 · 호수 기준으로 우리 집 평형과 층이 정해집니다. 선택품목을 고르면 총 분양비용과 회차별 납부액, 예상 취득세를 계산합니다."],
    cafe: ["COMMUNITY", "카페 · 오픈채팅", "입주예정자끼리 이야기를 나누는 곳입니다. 공식 카페는 누구나, 오픈채팅은 위임동의 세대가 들어올 수 있습니다."],
    info: ["INFORMATION", "정보", "공고문 원문 · 협의회 정리 자료와 자주 묻는 질문입니다."],
    petition: ["PETITION", "민원 참여", "입주예정자가 함께 내는 민원입니다. 참여 방법과 접수처를 확인하세요."],
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
    (LIVE ? '<a class="acct" id="acctLink" href="' + (API.loggedIn ? "account.html" : "login.html") + '">' + (API.loggedIn ? (API.profile ? esc(API.profile.unit_id) + (API.isDelegate ? "" : '<span class="acct-st"> · ' + (API.profile.status === "pending" ? "승인 대기" : API.profile.status === "rejected" ? "반려" : "위임 전") + "</span>") : "가입 마무리") : "로그인") + "</a>" : "") +
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
      association: Cc(80, 66, 18) + P("M48 140 Q48 98 80 98 Q112 98 112 140") + Cc(150, 58, 22) + P("M112 140 Q112 92 150 92 Q188 92 188 140") + Cc(196, 78, 14) + P("M176 140 Q178 108 196 108 Q216 108 218 140"),
      bylaws: R(58, 18, 124, 152, 4) + P("M78 44 H162 M78 60 H162 M78 76 H146 M78 100 H162 M78 116 H138") + Cc(150, 144, 14) + P("M143 144 L148 149 L158 138"),
      consent: R(50, 20, 130, 150, 6) + P("M70 46 H160 M70 62 H160 M70 78 H140 M70 94 H160") + P("M72 134 Q86 112 96 132 T120 128 Q132 120 150 134") + P("M168 150 L210 108 L222 120 L180 162 L164 166 Z"),
      agreement: grid(30, 26, 8, 5, 18, 18, 5, [1, 2, 5, 9, 10, 12, 13, 18, 20, 21, 22, 27, 29, 33, 34, 36, 38]),
      participate: R(60, 80, 120, 80, 6) + P("M60 104 H180") + R(100, 20, 44, 66, 3) + P("M110 44 L118 52 L134 34") + P("M96 92 H148"),
      links: R(36, 70, 80, 40, 20) + R(124, 70, 80, 40, 20) + P("M96 90 H144"),
      calculator: R(60, 20, 120, 150, 10) + R(78, 38, 84, 30, 4) + grid(78, 82, 4, 4, 15, 14, 8, [15]),
      documents: P("M30 50 H90 L104 64 H210 V150 H30 Z") + P("M30 76 H210") + R(60, 30, 120, 30, 3),
      faq: Cc(90, 84, 46) + P("M76 72 Q76 56 92 56 Q108 56 108 70 Q108 82 92 88 V98") + Cc(92, 112, 2.5) + Cc(176, 64, 24) + P("M168 58 Q168 50 176 50 Q184 50 184 58 Q184 64 176 68 V74") + Cc(176, 82, 1.5),
      login: R(70, 76, 100, 80, 10) + P("M90 76 V56 Q90 30 120 30 Q150 30 150 56 V76") + Cc(120, 110, 8) + P("M120 118 V134"),
      account: Cc(120, 66, 28) + P("M64 160 Q64 108 120 108 Q176 108 176 160"),
      privacy: P("M120 22 L186 46 V92 Q186 140 120 164 Q54 140 54 92 V46 Z") + P("M96 92 L114 110 L148 74"),
      admin: Cc(120, 90, 26) + P("M120 30 V48 M120 132 V150 M60 90 H78 M162 90 H180 M78 48 L91 61 M149 119 L162 132 M78 132 L91 119 M149 61 L162 48"),
      petition: R(60, 80, 120, 80, 6) + P("M60 104 H180") + R(100, 20, 44, 66, 3) + P("M110 44 L118 52 L134 34") + P("M96 92 H148"),
      cafe: R(24, 30, 120, 70, 14) + P("M50 100 L44 124 L72 100") + R(100, 84, 120, 64, 14) + P("M190 148 L198 168 L172 148") + P("M46 56 H120 M46 74 H100 M122 108 H196 M122 124 H176"),
      info: P("M30 50 H90 L104 64 H210 V150 H30 Z") + P("M30 76 H210") + Cc(170, 112, 18) + P("M164 106 Q164 98 170 98 Q178 98 178 105 Q178 110 170 114 V118"),
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
    if (x.url && (x.url.charAt(0) === "#" || /^[a-z]+\.html(#.*)?$/.test(x.url))) return '<a class="tile" href="' + esc(x.url) + '">' + inner + "</a>";   // 같은 페이지 안
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

  /* ── 메인 최상단: 민원 참여 ── */
  function petitionsHtml() {
    var L = arr(S.petitions).filter(function (x) { return x.active; });
    if (!L.length) return "";
    return '<section class="band petition-band"><div class="wrap">' + L.map(function (x) {
      var g = x.guide || {};
      return '<article class="petition" id="pt-' + esc(x.id) + '"><div class="pt-head"><span class="tag hot">' + esc(x.tag || "민원 참여") + "</span><h2>" + esc(x.title) + "</h2><p>" + esc(x.lead || "") + "</p>" +
        (g.url ? '<p class="cta-row" style="margin:12px 0 0"><a class="btn solid" href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(g.label || "참여 가이드 열기") + " ↗</a>" + (g.by ? '<span class="muted small">' + esc(g.by) + "</span>" : "") + "</p>" : "") + "</div>" +
        '<div class="pt-body">' +
          (arr(g.steps).length ? '<div><h3>참여 방법</h3><ol class="pt-steps">' + g.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>" : "") +
          '<div><h3>접수처</h3><ul class="pt-ch">' + arr(x.channels).map(function (c) {
            return "<li><b>" + esc(c.org) + '</b><span class="muted small">' + esc(c.what || "") + (c.note ? " · " + esc(c.note) : "") + "</span>" +
              '<span class="pt-act">' + (c.tel ? '<a class="btn sm" href="tel:' + esc(c.tel.replace(/[^0-9]/g, "")) + '">' + esc(c.tel) + "</a>" : "") + (c.url ? '<a class="btn sm" href="' + esc(c.url) + '" target="_blank" rel="noopener">바로가기 ↗</a>' : "") + "</span></li>";
          }).join("") + "</ul></div>" +
        "</div>" +
        (x.privateKey ? '<div class="pt-private" data-key="' + esc(x.privateKey) + '">' + (LIVE && API.isMember ? '<p class="muted small">회원 전용 안내를 불러오는 중…</p>'
          : '<p class="small"><b>안건 정보 · 의원 연락처</b>는 외부 유출 금지라 승인 회원에게만 보입니다. ' + (LIVE && API.loggedIn ? "가입 승인 후 볼 수 있습니다." : '<a href="login.html">로그인 →</a>') + "</p>") + "</div>" : "") +
        "</article>";
    }).join("") + "</div></section>";
  }
  function petitionShortcut() {
    var L = arr(S.petitions).filter(function (x) { return x.active; });
    // 민원은 로그인한 입주예정자에게만 (비회원 메인에는 알림 자체를 보이지 않음)
    if (!L.length || !LIVE || !API.loggedIn || !API.profile || API.profile.status === "rejected") return "";
    return '<section class="band petition-band pt-short"><div class="wrap">' + L.map(function (x) {
      var g = x.guide || {};
      return '<a class="pt-card" href="petition.html#pt-' + esc(x.id) + '"><span class="tag hot">' + esc(x.tag || "민원 참여") + '</span><span class="pt-txt"><b>' + esc(x.title) + "</b><span>" + esc(x.short || "참여 방법과 접수처를 한 곳에 모았습니다.") + '</span></span><span class="pt-go">참여하기 →</span></a>';
    }).join("") + "</div></section>";
  }
  /* ── 민원 페이지: 글 쓰기(AI) → 보내기 → 참여 체크 ── */
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function boardText(B) {
    var order = shuffle([0, 1, 2, 3]);
    return pick(B.intros) + "\n\n" + order.map(function (pi, i) { return (i + 1) + ". " + pick(B.paras[pi]); }).join("\n\n") + "\n\n" + pick(B.outros);
  }
  var PT_KINDS = [["sns1", "SNS 댓글", "페이스북 · 인스타 · 유튜브"], ["sns2", "짧은 댓글", "스레드 · X"], ["sns3", "의원 DM · 문자", "메시지 · 문자"], ["board", "민원 · 이메일 본문", "게시판 · 국민신문고 · 메일"], ["title", "민원 제목", "게시판 · 메일 제목"]];
  var PT_TONES = [["정중하게", "정중하고 차분하게"], ["간결하게", "핵심만 짧고 간결하게"], ["간곡하게", "간절하지만 예의 바르게"]];
  var PT_CHECKS = [["sns", "의원 · 기관 SNS에 댓글 남기기"], ["dm", "지역구 의원에게 DM · 문자 보내기"], ["board", "공식 민원 게시판에 접수하기"], ["mail", "의원 이메일로 보내기"]];
  var SNS_ICON = { fb: "페이스북", ig: "인스타", th: "스레드", x: "X", yt: "유튜브" };
  function ptExample(K, kind) { return kind === "board" ? boardText(K.board) : kind === "title" ? pick(K.titles) : pick(K[kind]); }
  function ptDday(d) { if (!d) return ""; var x = Math.ceil((new Date(d + "T23:59:59+09:00") - new Date()) / 864e5); return x > 0 ? "D-" + x : x === 0 ? "D-DAY" : ""; }
  function ptHtml(x, K) {
    var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
    var seen = {}; arr(K.boards).forEach(function (b) { seen[host(b.url)] = 1; });
    var depts = arr(x.channels).filter(function (c) { return c.tel || (c.url && !seen[host(c.url)]); });
    var member = LIVE && API.isMember, dd = ptDday(x.deadline);
    var chip = function (name, v, label, on) { return '<button type="button" class="chip" data-' + name + '="' + esc(v) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>"; };
    return '<article class="pt2" id="pt-' + esc(x.id) + '">' +
      '<section class="pt2-hero"><div class="pt2-top"><span class="tag hot">' + esc(x.tag || "민원 참여") + "</span>" + (dd ? '<span class="pt2-dd num">확정까지 ' + dd + "</span>" : "") + "</div>" +
        "<h2>" + esc(x.title) + "</h2><p>" + esc(x.lead || "") + "</p>" +
        '<ul class="pt2-stats">' + arr(x.stats).map(function (t) { return "<li><b class=\"num\">" + esc(t[0]) + "</b><span>" + esc(t[1]) + "</span></li>"; }).join("") + "</ul>" +
        '<details class="pt2-why"><summary>우리가 요청하는 것</summary><ul>' + arr(K.facts).map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul></details></section>" +
      (x.privateKey ? '<div class="pt-private" data-key="' + esc(x.privateKey) + '">' + (member ? '<p class="muted small">회원 전용 안내를 불러오는 중…</p>'
        : '<p class="small"><b>안건 정보 · 의원 연락처</b>는 외부 유출 금지라 승인 회원에게만 보입니다. ' + (LIVE && API.loggedIn ? "가입 승인 후 볼 수 있습니다." : '<a href="login.html">로그인 →</a>') + "</p>") + "</div>" : "") +
      '<nav class="pt2-nav" aria-label="참여 순서"><a href="#ptWrite"><b>1</b>글 쓰기</a><a href="#ptSend"><b>2</b>보내기</a><a href="#ptCheck"><b>3</b>참여 체크</a></nav>' +
      // 1. 글 쓰기
      '<section class="panel pt2-sec" id="ptWrite"><h3><span class="pt2-no">1</span>보낼 글 만들기</h3>' +
        '<div class="pt2-field"><span class="lbl">어디에 쓸 글인가요?</span><div class="chips pt2-kinds" id="ptKind">' + PT_KINDS.map(function (k, i) { return '<button type="button" class="chip" data-kind="' + k[0] + '" aria-pressed="' + (i === 0) + '"><b>' + esc(k[1]) + "</b><small>" + esc(k[2]) + "</small></button>"; }).join("") + "</div></div>" +
        '<div class="pt2-field"><span class="lbl">내 상황 <small class="muted">선택 · 글에 한 줄 들어가 사람마다 다른 글이 됩니다</small></span><div class="chips" id="ptPersona">' + arr(K.personas).map(function (p, i) { return chip("p", i, p[1], i === 0); }).join("") + "</div></div>" +
        '<div class="pt2-field"><span class="lbl">말투</span><div class="chips" id="ptTone">' + PT_TONES.map(function (t, i) { return chip("t", i, t[0], i === 0); }).join("") + "</div></div>" +
        (member ? '<button type="button" class="btn solid wide pt2-ai" id="ptAi">✨ AI로 내 글 쓰기</button><p class="muted small pt2-left" id="ptLeft">버튼을 누를 때마다 새로운 문장을 씁니다. 1인 하루 20번.</p>'
          : '<p class="notice-box small" style="margin:0">로그인한 <b>승인 회원</b>은 AI로 나만의 문장을 만들 수 있습니다. 지금은 예시 문구를 복사해 쓸 수 있어요. ' + (LIVE && !API.loggedIn ? '<a href="login.html">로그인 →</a>' : "") + "</p>") +
        '<div class="pt2-out"><div class="pt2-oh"><b id="ptOutLabel">예시 문구</b><span class="muted small num" id="ptLen"></span></div>' +
          '<textarea id="ptText" rows="6" aria-label="보낼 글"></textarea>' +
          '<div class="pt2-act"><span class="muted small">고쳐 써도 됩니다. 보내기 전에 숫자 · 사실을 한 번 확인하세요.</span><button type="button" class="btn solid" id="ptCopy">📋 복사</button></div></div>' +
      "</section>" +
      // 2. 보내기
      '<section class="panel pt2-sec" id="ptSend"><h3><span class="pt2-no">2</span>보내기</h3>' +
        '<h4>공식 민원 게시판</h4><p class="muted small">정식 접수 번호가 남는 곳입니다. "민원 · 이메일 본문"과 "민원 제목"을 만들어 붙여 넣으세요.</p>' +
        '<div class="pt2-boards">' + arr(K.boards).map(function (b) {
          return '<a class="pt2-board" href="' + esc(safeUrl(b.url)) + '" target="_blank" rel="noopener"><b>' + esc(b.org) + "</b><span>" + esc(b.what) + '</span><i aria-hidden="true">↗</i></a>'; }).join("") + "</div>" +
        (depts.length ? '<details class="pt2-dept"><summary>담당 부서 연락처</summary><ul class="pt2-list">' + depts.map(function (c) {
          return "<li><div><b>" + esc(c.org) + '</b><span class="muted small">' + esc(c.what || "") + '</span></div><div class="pt2-icons">' +
            (c.tel ? '<button type="button" class="ic" data-copy="' + esc(c.tel) + '" title="전화번호 복사">📞 <span class="num">' + esc(c.tel) + "</span></button>" : "") +
            (c.url ? '<a class="ic" href="' + esc(safeUrl(c.url)) + '" target="_blank" rel="noopener">바로가기 ↗</a>' : "") + "</div></li>"; }).join("") + "</ul></details>" : "") +
        '<h4>의원 · 기관 SNS와 이메일</h4><p class="muted small">"SNS 댓글"이나 "의원 DM"으로 만든 글을 남겨 주세요. ' + esc(K.asOf) + " 기준 공개 정보입니다.</p>" +
        '<div class="chips" id="ptGrp">' + chip("g", "all", "전체", true) + arr(K.contacts).map(function (g, gi) { return chip("g", gi, g.short || g.group.split(" ")[0], false); }).join("") + "</div>" +
        '<ul class="pt2-list" id="ptPeople">' + arr(K.contacts).map(function (g, gi) {
          return g.list.map(function (c) {
            var L = c[4] || {};
            return '<li data-g="' + gi + '"><div><b>' + esc(c[2]) + '</b><span class="muted small">' + esc(c[1]) + " · " + esc(c[0]) + '</span></div><div class="pt2-icons">' +
              Object.keys(SNS_ICON).filter(function (k) { return L[k]; }).map(function (k) { return '<a class="ic" href="' + esc(safeUrl(L[k])) + '" target="_blank" rel="noopener">' + SNS_ICON[k] + "</a>"; }).join("") +
              (c[5] ? '<button type="button" class="ic" data-copy="' + esc(c[5]) + '" title="이메일 복사">✉️ 이메일</button>' : "") +
              (c[6] ? '<button type="button" class="ic" data-copy="' + esc(c[6]) + '" title="전화번호 복사">📞</button>' : "") + "</div></li>";
          }).join("");
        }).join("") + "</ul>" +
        '<button type="button" class="btn wide" id="ptMails">✉️ 보이는 의원 이메일 한 번에 복사</button>' +
      "</section>" +
      // 3. 참여 체크
      '<section class="panel pt2-sec" id="ptCheck"><h3><span class="pt2-no">3</span>참여 체크</h3><p class="muted small">한 것을 체크해 두세요. 이 기기에만 저장됩니다.</p>' +
        '<div class="meter" style="margin:0 0 10px"><div class="row"><span>나의 참여</span><b class="num" id="ptPct"></b></div><div class="bar-track signal"><i id="ptBar"></i></div></div>' +
        PT_CHECKS.map(function (c) { return '<label class="check"><input type="checkbox" data-ck="' + c[0] + '"> ' + esc(c[1]) + "</label>"; }).join("") +
        '<p class="muted small" id="ptDone" hidden>모두 마쳤습니다. 감사합니다! 주변 입주예정자에게도 이 페이지를 알려 주세요.</p>' +
      "</section>" +
      '<p class="kit-note small">⚖️ ' + esc(K.notice) + "</p>" +
      '<p class="muted small">민원 요지 · 예시 문구 · 연락처는 ' + esc(K.source.by) + '의 <a href="' + esc(safeUrl(K.source.url)) + '" target="_blank" rel="noopener">' + esc(K.source.label) + " ↗</a>(" + esc(K.asOf) + " 기준)을 바탕으로 정리했습니다.</p>" +
      "</article>";
  }
  function bindPt(root, x, K) {
    var kind = "sns1", persona = 0, tone = 0, last = {};
    var T = el("ptText"), member = LIVE && API.isMember;
    function fitT() { T.style.height = "auto"; T.style.height = Math.min(Math.max(T.scrollHeight + 4, 90), 640) + "px"; }
    function setText(t, label) { T.value = t; fitT(); el("ptLen").textContent = n(t.length) + "자"; el("ptOutLabel").textContent = label; root.querySelector(".pt2-out").classList.remove("flash"); void T.offsetWidth; root.querySelector(".pt2-out").classList.add("flash"); }
    function example() { last[kind] = last[kind] || ptExample(K, kind); setText(last[kind], "예시 문구 · " + PT_KINDS.filter(function (k) { return k[0] === kind; })[0][1]); }
    function seg(id, attr, fn) { el(id).addEventListener("click", function (e) { var c = e.target.closest(".chip"); if (!c) return; el(id).querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", b === c ? "true" : "false"); }); fn(c.getAttribute("data-" + attr)); }); }
    seg("ptKind", "kind", function (v) { kind = v; example(); });
    seg("ptPersona", "p", function (v) { persona = Number(v); });
    seg("ptTone", "t", function (v) { tone = Number(v); });
    T.addEventListener("input", function () { el("ptLen").textContent = n(T.value.length) + "자"; fitT(); });
    el("ptCopy").addEventListener("click", function () { copyText(T.value, this); });
    example();
    if (member) el("ptAi").addEventListener("click", async function () {
      var btn = this; busy(btn, true, "AI가 쓰는 중…");
      try {
        var r = await API.petitionAi({ kind: kind, persona: K.personas[persona][0], tone: PT_TONES[tone][1], base: T.value });
        setText(r.text, "AI가 쓴 글 · " + PT_KINDS.filter(function (k) { return k[0] === kind; })[0][1]);
        if (r.left != null) el("ptLeft").textContent = "오늘 남은 횟수 " + r.left + "번 · 누를 때마다 새로운 문장을 씁니다.";
        btn.dataset.l = "✨ 다시 쓰기";
      } catch (e) { toast((e && e.message) || "AI 응답을 받지 못했습니다"); }
      busy(btn, false);
    });
    // 보내기: 그룹 필터 · 이메일 일괄 복사
    var grp = "all";
    seg("ptGrp", "g", function (v) { grp = v; el("ptPeople").querySelectorAll("li").forEach(function (li) { li.hidden = grp !== "all" && li.dataset.g !== grp; }); });
    el("ptMails").addEventListener("click", function () {
      var list = []; K.contacts.forEach(function (g, gi) { if (grp !== "all" && String(gi) !== grp) return; g.list.forEach(function (c) { if (c[5] && list.indexOf(c[5]) < 0) list.push(c[5]); }); });
      copyText(list.join(", "), this);
    });
    bindCopy(root);
    // 참여 체크 (이 기기에만)
    var KEY = "s4-pt-" + x.id, st = {}; try { st = JSON.parse(store(KEY) || "{}") || {}; } catch (e) { st = {}; }
    var boxes = root.querySelectorAll("[data-ck]");
    function upd(save) {
      var on = 0; boxes.forEach(function (b) { if (b.checked) on++; st[b.dataset.ck] = b.checked ? 1 : 0; });
      el("ptPct").textContent = on + " / " + boxes.length; el("ptBar").style.width = (on / boxes.length * 100) + "%"; el("ptDone").hidden = on < boxes.length;
      if (save) store(KEY, JSON.stringify(st));
    }
    boxes.forEach(function (b) { b.checked = !!st[b.dataset.ck]; b.addEventListener("change", function () { upd(true); }); });
    upd(false);
  }
  R.petition = async function () {
    var L = arr(S.petitions).filter(function (x) { return x.active; }), KIT = window.S4_PETITION_KIT || {};
    // 민원은 로그인한 입주예정자만 (외부 공유 · 무관한 참여 방지)
    if (LIVE && (!API.loggedIn || !API.profile || API.profile.status === "rejected")) {
      C.innerHTML = '<div class="panel oc-gate"><span class="cm-ic" aria-hidden="true">📣</span><h2>입주예정자만 볼 수 있습니다</h2>' +
        '<p class="muted">민원 참여 안내 · 의원 연락처 · AI 글쓰기는 홈페이지에 가입한 입주예정자에게만 보여 드립니다.' + (L.length ? " 지금 진행 중: <b class=\"fg\">" + esc(L[0].title) + "</b>" : "") + "</p>" +
        (API.loggedIn && API.profile && API.profile.status === "rejected" ? gate("member") : '<p class="cta-row" style="justify-content:center"><a class="btn solid" href="login.html">로그인</a><a class="btn" href="login.html#signup">회원가입</a></p>') + "</div>";
      return;
    }
    C.innerHTML = (L.length ? L.map(function (x) {
      return KIT[x.id] ? ptHtml(x, KIT[x.id]) : petitionsHtml().replace('<section class="band petition-band"><div class="wrap">', "").replace(/<\/div><\/section>$/, "");
    }).join("") : empty("진행 중인 민원이 없습니다", "새 민원 참여가 열리면 이곳에 안내합니다.")) + '<div id="ptMore"></div>';
    bindPetitions();
    L.forEach(function (x) { if (KIT[x.id]) bindPt(el("pt-" + x.id), x, KIT[x.id]); });
    var id = location.hash.slice(1), t = id && document.getElementById(id); if (t) setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 0);
    // 운영진이 연 단체민원 · 투표가 있으면 아래에 함께 (메뉴에서 빠진 '민원 · 투표' 기능)
    if (LIVE) try {
      var cp = await API.campaigns(), pl = API.isMember ? await API.polls() : [];
      if (arr(cp).length || arr(pl).length) { el("ptMore").className = "pt2-more"; await R.participate(el("ptMore")); }
    } catch (e) {}
  };
  function linkify(t) {
    return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(01[016789]-?\d{3,4}-?\d{4}|0\d{1,2}-\d{3,4}-\d{4})/g, function (m) { return '<a href="tel:' + m.replace(/-/g, "") + '">' + m + "</a>"; });
  }
  function bindPetitions() {
    if (!(LIVE && API.isMember)) return;
    document.querySelectorAll(".pt-private[data-key]").forEach(function (box) {
      API.privateNote(box.getAttribute("data-key")).then(function (r) {
        box.innerHTML = r && r.body ? '<div class="pt-note"><b>회원 전용 · 외부 유출 금지</b><div class="body">' + linkify(r.body) + '</div><span class="muted small">' + fmtTime(r.updated_at) + " 운영진 작성</span></div>" : (API.isAdmin ? '<p class="muted small">회원 전용 안내가 비어 있습니다. 운영진 › 민원 탭에서 적어 주세요.</p>' : "");
      }).catch(function () { box.innerHTML = ""; });
    });
  }

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
    main.innerHTML = petitionShortcut() +
      '<section class="hero"><div class="wrap hero-grid"><div>' +
      '<div class="eyebrow">고양창릉 공공주택지구 · LH 공공분양</div>' +
      "<h1>창릉 S-4<small>입주예정자협의회</small></h1>" +
      '<p class="lead">창릉천 물길과 서오릉 숲 사이, ' + n(T) + '세대가 함께 만들어갈 새 동네입니다. 공지와 일정, 공사 진행과 위임동의 현황을 이곳에서 확인하세요.</p>' +
      '<div class="cta-row">' + (LIVE ? (API.loggedIn ? '<a class="btn solid" href="account.html">내 정보 · 위임동의</a>' : '<a class="btn solid" href="login.html#signup">회원가입</a>') : '<a class="btn solid" href="cafe.html">공식 카페 가입 · 인증</a>') + '<a class="btn" href="notice.html">공지사항 보기</a></div></div>' +
      '<aside class="status" aria-label="단지 현황"><div class="top"><div><b class="num">' + dd + "</b></div><span>" + ddl + "<br>16개 동 · " + n(T) + "세대</span></div>" +
      agreeMeter(true) + membersMeter() + progressMeter() +
      '<a class="go" href="agreement.html">동·호수별 현황판 보기 →</a></aside>' +
      "</div>" + ridge + "</section>" +
      '<section class="band" id="homeDues" hidden><div class="wrap"></div></section>' +
      '<section class="band"><div class="wrap two"><div>' + head("공지사항", more("notice.html")) + noticeRows(arr(S.notices).slice(0, 5)) + "</div>" +
      "<div>" + head("다가오는 일정", more("schedule.html", "전체 일정")) + timeline(upcoming) + "</div></div></section>" +
      '<div id="homeNews"></div>';
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
        '<div class="org">' + role(o.head, "head") + '<span class="link-line"></span><div class="lvl">' + arr(o.officers).map(function (r) { return role(r); }).join("") + "</div>" + (arr(o.teams).length ? '<span class="link-line"></span><div class="lvl">' + arr(o.teams).map(function (r) { return role(r); }).join("") + "</div>" : "") +
        '<span class="link-line"></span><div class="lvl">' + role({ role: "동대표", name: "각 동 1명 · 동 회원이 선출" }) + "</div></div>" +
        '<p class="muted small org-note"><b class="fg">운영위원회</b> = 회장 · 부회장 · 총무(운영진) + 동대표. 입예협의 유일한 의결기구이며, 감사는 참석해 의견을 말하지만 의결권은 없습니다(회칙 제17조). 전체회의는 매년 1회 이상 열어 보고와 의견을 듣습니다.</p></div>' : "") +
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
      '<p class="small" style="flex-basis:100%;margin:0">입금자명은 <b>동호수+이름</b>으로 적어 주세요. 예: <span class="num">403-1804홍길동</span> · 동호수가 있어야 자동으로 납부 확인이 됩니다.</p></div>';
  }
  // 복사: 클립보드 → 안 되면 숨은 칸 선택 복사 → 그래도 안 되면 직접 복사하도록 보여줌
  function copyText(v, b) {
    var was = b ? b.textContent : "", done = function () { if (b) { b.textContent = "✓ 복사했습니다"; setTimeout(function () { b.textContent = was; }, 1600); } toast("복사했습니다. 붙여 넣기 하세요."); };
    var legacy = function () {
      var t = document.createElement("textarea"); t.value = v; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:-1000px;opacity:0"; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove();
      if (ok) done(); else prompt("아래 내용을 길게 눌러 복사하세요", v);
    };
    try { navigator.clipboard.writeText(v).then(done, legacy); } catch (e) { legacy(); }
  }
  var toastT;
  function toast(msg) {
    var t = document.getElementById("s4Toast");
    if (!t) { t = document.createElement("div"); t.id = "s4Toast"; t.className = "s4-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function bindCopy(root) {
    root.querySelectorAll("[data-copy]").forEach(function (b) { if (b._cp) return; b._cp = 1; b.addEventListener("click", function () { copyText(b.getAttribute("data-copy"), b); }); });
  }
  /* 회원용 회비 안내: 우리 세대 금액 · 계좌 · 입금자명 */
  function duesPayer() {
    var p = API.profile || {};
    return p.unit_id || "";
  }
  function duesCardHtml(m, d, compact) {
    if (!m || !d) return "";
    var due = Number(m.due || 0), paid = Number(m.paid || 0), done = paid > 0 && paid >= (due || 1), left = Math.max(due - paid, 0);
    if (done) return '<div class="dues-card done"><span class="tag">납부 완료 · 우수회원</span><b class="num">' + won(paid) + '</b><span class="muted small">' + fmtDate(m.first_at) + " 입금 확인 · 감사합니다</span></div>";
    if (!d.account || !due) return "";
    return '<div class="dues-card">' +
      '<div class="dc-amt"><span class="muted small">' + (paid ? "남은 회비" : "우리 세대 회비") + '</span><b class="num">' + won(left) + "</b>" +
        (paid ? '<span class="small muted">' + won(paid) + " 입금 확인됨 · 총 " + won(due) + "</span>" : nextTierNote(d.tiers)) + "</div>" +
      '<dl class="dc-info">' +
        "<div><dt>입금 계좌</dt><dd><b class=\"num\">" + esc(d.bank || "") + " " + esc(d.account) + '</b> <button type="button" class="btn sm" data-copy="' + esc(d.account) + '">복사</button><span class="small muted">' + esc(d.holder || "") + "</span></dd></div>" +
        '<div><dt>입금자명</dt><dd><b class="num">' + esc(duesPayer()) + '</b> <span class="muted">+ 입금자 이름</span> <button type="button" class="btn sm" data-copy="' + esc(duesPayer()) + '">복사</button><span class="small muted">예: ' + esc(duesPayer()) + '홍길동 · 칸이 모자라면 ' + esc(duesPayer().replace("-", "")) + '홍길동 · 동호수가 있어야 자동으로 확인됩니다</span></dd></div>' +
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
    h += '<p class="muted small">' + (d.account ? "수입 · 지출은 매월 공개합니다(회칙 제28조)." : esc(note || "")) + " 입금자 이름은 공개하지 않습니다.</p>";
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
      : '<span class="bl-badge">제정(안)</span><span>준비위원회 의결 전입니다. 의견은 공식 카페에 남겨 주세요.</span>';
    function art(a) {
      return '<article class="bl-art" id="a' + a.n + '" data-q="' + esc(("제" + a.n + "조 " + a.t + " " + a.p + " " + arr(a.i).join(" ") + " " + (a.q || "")).toLowerCase()) + '">' +
        '<h3><a class="bl-no" href="#a' + a.n + '">제' + a.n + "조</a> " + esc(a.t) + "</h3>" +
        (a.p ? "<p>" + esc(a.p) + "</p>" : "") +
        (arr(a.i).length ? "<ol>" + a.i.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + (a.q ? "<p>" + esc(a.q) + "</p>" : "") + "</article>";
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
        '<p class="bl-foot">' + esc(B.title || "회칙") + " · 제정일 " + (B.enacted ? esc(B.enacted) : "준비위원회 의결 후 카페 공표일 기재") +
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
  function signupOpenLabel() {
    var d = (LIVE && API.signupOpenAt) || new Date(S.consentOpenAt || "2026-11-16T00:00:00+09:00"), k = new Date(d.getTime() + 9 * 3600 * 1000);
    return (k.getUTCMonth() + 1) + "월 " + k.getUTCDate() + "일";
  }
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
      body = consentOpenLabel() + " 공급계약이 시작되면 위임동의서를 낼 수 있습니다. 위임한 세대는 투표 · 단체민원에 참여하고 세대별 현황을 볼 수 있습니다." + (API.isMember ? " 지금은 회원 전용 안내와 민원 참여를 이용할 수 있습니다." : "");
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
  R.participate = async function (root) {
    var C = root || el("content");
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
      }).join("") + "</div>" : empty("진행 중인 단체민원이 없습니다", "민원 제안은 공식 카페에 남겨 주세요.")) +
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
    if (C._pBound) return; C._pBound = 1;
    C.addEventListener("click", async function (e) {
      var j = e.target.closest(".join"), v = e.target.closest(".vote");
      if (!j && !v) return;
      var btn = j || v; busy(btn, true);
      try {
        if (j) await API.joinCampaign(Number(j.dataset.id));
        else await API.vote(Number(v.dataset.poll), Number(v.dataset.idx));
        await R.participate(root);
      } catch (err) { busy(btn, false); say("pMsg", API.errorText(err), true); el("pMsg").scrollIntoView({ block: "center" }); }
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

  function cafeLink() { return arr(S.links).filter(function (l) { return /카페/.test(l.title) && l.url; })[0]; }
  R.cafe = async function () {
    var cf = cafeLink(), st = !LIVE ? "" : !API.loggedIn ? "login" : API.isDelegate || API.isAdmin ? "ok" : "need";
    var chatBtn = st === "ok" ? '<button type="button" class="btn solid wide" id="chatOpen">오픈채팅 입장하기</button>'
      : st === "login" ? '<a class="btn solid wide" href="login.html">로그인하고 입장하기</a>'
      : st === "need" ? (API.consentOpen ? '<a class="btn solid wide" href="consent.html">위임동의서 내고 입장하기</a>' : '<span class="btn wide" aria-disabled="true">' + esc(consentOpenLabel()) + " 위임동의 시작 후 입장</span>")
      : '<span class="btn wide" aria-disabled="true">서버 연결 후 입장</span>';
    C.innerHTML = '<div class="cm-grid">' +
      '<section class="panel cm-card"><span class="cm-ic" aria-hidden="true">☕</span><h2>공식 네이버 카페</h2><p class="muted">공지 · 질문 · 정보 나눔을 오래 남겨 두는 곳입니다. 계약자가 아니어도 가족이 함께 볼 수 있습니다.</p>' +
        '<ol class="steps">' +
          "<li><div><b>카페 가입</b><span>닉네임은 \"동-호수 끝자리/닉네임\" 형식을 권장합니다. 예: 403-18xx/창릉새집</span></div></li>" +
          '<li><div><b>입주예정자 확인</b><span><a href="login.html#signup">이 홈페이지 회원가입</a>으로 합니다. 카페에 계약서를 따로 올리지 않아도 됩니다.</span></div></li>' +
          "<li><div><b>등업</b><span>홈페이지에서 확인된 세대는 운영진이 카페 등급을 올려 드립니다.</span></div></li></ol>" +
        (cf ? '<a class="btn solid wide" href="' + esc(safeUrl(cf.url)) + '" target="_blank" rel="noopener">카페 바로가기 ↗</a>' : '<span class="btn wide" aria-disabled="true">카페 개설 후 연결</span>') + "</section>" +
      '<section class="panel cm-card"><span class="cm-ic" aria-hidden="true">💬</span><h2>입주민 오픈채팅</h2><p class="muted">빠른 소식과 일정 알림을 나누는 카카오톡 오픈채팅입니다. 비밀번호가 걸려 있어 <b class="fg">위임동의를 마친 세대</b>에게만 입장 비밀번호를 보여 드립니다.</p>' +
        '<ul class="cm-check"><li class="' + (LIVE && API.loggedIn ? "on" : "") + '">홈페이지 로그인</li><li class="' + (LIVE && (API.isDelegate || API.isAdmin) ? "on" : "") + '">위임동의서 제출</li><li class="' + (st === "ok" ? "on" : "") + '">입장 비밀번호 확인</li></ul>' +
        chatBtn + "</section></div>" +
      '<section class="panel cm-rule"><h3>함께 지킬 약속 <span class="muted small">회칙 제6장</span></h3><ul>' +
        "<li>정치 · 종교 관련 글, 업체 홍보, 욕설과 비방은 금지합니다(제30조).</li>" +
        "<li>회칙에 어긋나는 게시물은 운영진이 안내 없이 삭제하거나 숨길 수 있습니다(제31조).</li>" +
        "<li>회원 정보와 회원 전용으로 공유된 내용은 밖으로 옮기지 않습니다(제8조 · 제32조).</li>" +
        "<li>개인 연락처 · 계약서 · 동호수 사진을 올리지 않습니다.</li>" +
        "<li>문제가 생기면 운영진에게 카페 쪽지나 협의회 메일(" + esc((S.privacyOfficer || {}).contact || "changneung.s4@gmail.com") + ")로 알려 주세요.</li></ul></section>";
    if (el("chatOpen")) el("chatOpen").addEventListener("click", openChat);
    if (location.hash === "#chat" && st === "ok") openChat();
  };
  R.links = async function () {
    var CT = arr(S.contacts), L = arr(S.links).filter(function (l) { return l.url !== "#chat" && !/카페/.test(l.title) && !/calculator/.test(l.url || ""); });
    C.innerHTML = "<div>" + head("기관 사이트") + '<div class="tiles">' + L.map(tile).join("") +
        '<a class="tile" href="cafe.html"><b>카페 · 오픈채팅</b><span>입주예정자 소통 · 위임 세대 채팅방</span></a></div></div>' +
      (CT.length ? "<div>" + head("문의처") + '<div class="tablebox"><table class="spec kv">' + CT.map(function (c) { return "<tr><th>" + esc(c[0]) + '</th><td class="num sel-all">' + esc(c[1]) + "</td></tr>"; }).join("") + "</table></div></div>" : "") +
      "<div>" + head("휴대폰 홈 화면에 추가") +
      '<p class="muted"><b class="fg">아이폰(사파리)</b> 하단 공유 버튼을 누르고 "홈 화면에 추가"를 선택합니다.</p>' +
      '<p class="muted"><b class="fg">안드로이드(크롬)</b> 오른쪽 위 메뉴에서 "홈 화면에 추가"를 선택합니다.</p></div>';
    if (location.hash === "#chat") location.replace("cafe.html#chat");
  };
  // 정보: 자료실 + 자주 묻는 질문 (예전 두 페이지를 한곳에)
  R.info = function () {
    var keep = C;
    keep.innerHTML = '<nav class="chips" style="margin-bottom:-8px"><a class="chip" href="#docs">자료</a><a class="chip" href="#faq">자주 묻는 질문</a></nav><section id="docs"><h2 class="sec-h">자료</h2><div id="infoDocs"></div></section><section id="faq"><h2 class="sec-h">자주 묻는 질문</h2><div id="infoFaq"></div></section>';
    try { C = el("infoDocs"); R.documents(); C = el("infoFaq"); R.faq(); } finally { C = keep; }
  };

  R.calculator = function () {
    var D = S.optCalc;
    if (!D) { C.innerHTML = empty("계산기 자료가 없습니다", ""); return; }
    // 내 아파트: 가입한 동 · 호수로 평형 계열과 층 구간을 정함 (운영진은 다른 평형도 볼 수 있음)
    var ME = null;
    if (LIVE) {
      var pf = API.profile;
      if (!API.loggedIn || !pf || pf.status === "rejected") {
        C.innerHTML = '<div class="panel oc-gate"><span class="cm-ic" aria-hidden="true">🏠</span><h2>우리 집 기준으로 계산해 드립니다</h2>' +
          '<p class="muted">회원가입 때 고른 동 · 호수로 평형과 층이 정해져, 우리 집에 맞는 선택품목과 분양가로 총액 · 회차별 납부액 · 취득세를 바로 볼 수 있습니다.</p>' +
          (pf && pf.status === "rejected" ? gate("member") : '<p class="cta-row" style="justify-content:center"><a class="btn solid" href="login.html">로그인</a><a class="btn" href="login.html#signup">회원가입</a></p>') +
          '<p class="muted small">평형별 공급 정보와 최고 분양가는 <a href="floorplan.html">단지 · 평면</a>에서 누구나 볼 수 있습니다.</p></div>';
        return;
      }
      var uu = UNIT[pf.unit_id];
      if (uu) { var fl = Math.floor(Number(uu.ho) / 100) || 1; ME = { unit: pf.unit_id, label: uu.dong + "동 " + uu.ho + "호", fam: uu.type, floor: fl, key: fl >= 5 ? "5층~최상층" : fl + "층" }; }
    }
    var FREE = !ME || (LIVE && API.isAdmin);
    var CATS = ["침실", "주방", "주방 및 복도", "알파룸", "주방가전", "현관", "거실", "욕실", "바닥재", "조명", "시스템에어컨"];
    var GN = { kitchen: "주방마감", fridge: "냉장고장", pantry: "팬트리", induction: "인덕션", dress: "드레스룸", floor: "바닥재", light: "조명", air: "시스템에어컨" };
    var TYPES = Object.keys(D.types), FAMS = Object.keys(D.families);
    function won(v) { return n(Math.round(v * 1000)) + "원"; }
    function split(t) { var d = Math.floor(t / 10); return [d, d, d, d, d, d, d, t - 7 * d]; }
    var saved = {}; try { saved = JSON.parse(store("s4-optcalc") || "{}") || {}; } catch (e) { saved = {}; }
    C.innerHTML = '<div class="oc">' +
      '<div class="oc-main"><h2 class="oc-h"><span class="oc-no">1</span>' + (ME ? "우리 집" : "평형 · 층 고르기") + '</h2>' +
        (ME ? '<div class="oc-me"><div><span class="muted small">가입 세대</span><b>' + esc(ME.label) + '</b></div><div><span class="muted small">평형 계열</span><b>' + esc(ME.fam) + '</b></div><div><span class="muted small">층 · 분양가 구간</span><b>' + ME.floor + "층 · " + esc(ME.key) + "</b></div>" +
          (LIVE && API.isAdmin ? '<p class="muted small">운영진이라 다른 평형 · 층도 골라 볼 수 있습니다.</p>' : "") + "</div>" : "") +
        '<form class="panel oc-pick" id="ocForm" novalidate>' +
        '<div class="field"><span class="lbl">공급유형</span><div class="seg" role="radiogroup" aria-label="공급유형"><label><input type="radio" name="ocMode" value="basic" checked><span>기본형</span></label><label><input type="radio" name="ocMode" value="minus"><span>마이너스옵션</span></label></div></div>' +
        '<div class="field"><label for="ocType">세부평형</label><select id="ocType">' + FAMS.filter(function (f) { return FREE || f === ME.fam; }).map(function (f) {
          return '<optgroup label="' + esc(f) + ' 계열">' + TYPES.filter(function (t) { return D.types[t][0] === f && (FREE || D.types[t][1][ME.key]); }).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("") + "</optgroup>";
        }).join("") + "</select></div>" +
        '<div class="field"><label for="ocFloor">층</label><select id="ocFloor"></select></div>' +
        '<div class="field"><label for="ocSpace">공간선택</label><select id="ocSpace"><option value="basic">침실2/3 분리</option><option value="A">A형 · 침실2+3 통합</option></select></div>' +
        '<p class="muted small oc-note">' + (ME && !FREE ? "같은 계열에도 세부평형(L · H 등)에 따라 분양가가 조금 다릅니다. 계약서나 동호배치표의 주택형을 확인해 골라 주세요. 선택품목은 같습니다." : "세부평형(L · H 등)과 층은 계약서의 동·호 배정으로 확인하세요. 같은 계열(예: 59AL · 59A · 59AH)은 선택품목이 같고 분양가만 다릅니다.") + "</p>" +
      "</form>" +
      '<details class="panel oc-media-d" id="ocMediaD"' + (window.innerWidth > 760 ? " open" : "") + '><summary><b>평면도 · LH 공식 VR 보기</b><span class="muted small" id="ocMediaS"></span></summary><div class="oc-media" id="ocMedia"></div></details>' +
      '<div class="oc-opthead"><h2 class="oc-h"><span class="oc-no">2</span>선택품목 고르기</h2><button type="button" class="btn sm" id="ocReset">모두 풀기</button><span class="muted small" id="ocFamInfo"></span></div>' +
      '<p class="oc-msg" id="ocMsg" role="status" aria-live="polite"></p>' +
      '<div id="ocOpts" class="oc-opts"></div></div>' +
      '<aside class="panel oc-sum" id="ocSum" aria-label="계산 결과"><span class="muted small">예상 총 분양비용</span><b class="oc-total num" id="ocTotal"></b>' +
        '<div class="oc-split" aria-hidden="true"><i class="h" id="ocSpH"></i><i class="b" id="ocSpB"></i><i class="o" id="ocSpO"></i></div>' +
        '<table class="spec kv oc-kv"><tbody id="ocKv"></tbody></table><p class="small oc-chosen" id="ocChosen"></p><ul class="oc-picked" id="ocPicked"></ul>' +
        '<p class="muted small" style="margin:8px 0 0">세금 · 등기비 · 대출이자는 빠진 금액입니다. 실제 금액은 LH 계약서로 확인하세요.</p></aside>' +
      "</div>" +
      '<div class="oc-bar" id="ocBar" aria-hidden="true"><span>예상 총액</span><b class="num" id="ocBarTotal"></b><a href="#ocSum">자세히</a></div>' +
      '<dialog class="oc-lb" id="ocLb" aria-label="사진 크게 보기"><button type="button" class="oc-lb-x" id="ocLbX" aria-label="닫기">×</button><img id="ocLbImg" alt=""><p id="ocLbCap"></p></dialog>' +
      "<div>" + '<div class="oc-payh"><h2 class="oc-h"><span class="oc-no">3</span>회차별 납부 예정액</h2><button type="button" class="btn sm" id="ocPayFull" aria-pressed="false">항목별로 보기</button></div><p class="muted small" style="margin:-4px 0 10px">입주 시 잔여금액은 대출 적용 전 금액입니다.</p>' +
        '<div class="tablebox"><table class="spec oc-pay" id="ocPayT"><thead><tr><th>회차 · 예정일</th><th class="r d">주택</th><th class="r d">발코니</th><th class="r d">선택품목</th><th class="r">회차 합계</th><th class="r">누적</th></tr></thead><tbody id="ocPay"></tbody></table></div></div>' +
      '<div class="two"><div>' + head("예상 취득세", '<span class="note">1주택 · 전용 85㎡ 이하</span>') +
        '<label class="check"><input type="checkbox" id="ocFirst"> 생애최초 주택 구입 감면 (현행 최대 200만원 · 2028년 말까지 취득분)</label>' +
        '<div class="tablebox"><table class="spec"><tbody id="ocTax"></tbody></table></div></div>' +
      '<div><h3 style="margin-bottom:8px">계산 기준</h3><p class="muted small">금액은 ' + esc(D.src) + "의 표를 옮긴 값입니다. 계약금과 중도금 1~6차는 각 항목 금액의 10%(천원 미만 버림), 입주 시 잔여금액은 나머지입니다. 마이너스옵션을 고르면 주택 · 발코니 금액이 마이너스옵션 가격으로 바뀌고 선택품목은 고를 수 없습니다.</p>" +
        '<p class="muted small">취득세 과세표준은 총 분양비용(주택 + 발코니 + 선택품목)입니다. 세율은 6억 이하 1%, 6억 초과 9억 이하 (금액×2/3억 − 3)%, 9억 초과 3%이며 지방교육세는 취득세의 10%입니다. 취득세는 잔금을 내는 입주 시점(2030년 예정)의 법을 따르므로 실제 신고 전 <a href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스</a>나 세무 전문가에게 확인하세요.</p>' +
        (D.credit ? '<p class="muted small">품목 사진 · 평면도는 ' + esc(D.credit.by || "입주예정자") + '이 정리한 <a href="' + esc(safeUrl(D.credit.url)) + '" target="_blank" rel="noopener">' + esc(D.credit.label) + " ↗</a>의 자료를, 공간 미리보기 · VR은 LH 공식 사이버모델하우스를 불러옵니다. 사진은 팸플릿 기준이라 실제와 다를 수 있습니다.</p>" : "") +
      "</div></div>";
    var TY = el("ocType"), FL = el("ocFloor"), SPC = el("ocSpace"), BOX = el("ocOpts");
    function mode() { var r = C.querySelector('input[name="ocMode"]:checked'); return r ? r.value : "basic"; }
    function fam() { return D.families[D.types[TY.value][0]]; }
    function opt(id) { return fam().opts.filter(function (o) { return o[0] === id; })[0]; }
    function rule(o) { return o[6] || {}; }
    function picked() { var m = {}; BOX.querySelectorAll("input[data-id]:checked:not(:disabled)").forEach(function (x) { m[x.dataset.id] = 1; }); return m; }
    function reason(o, ids) {
      if (mode() === "minus") return "마이너스옵션은 선택품목을 고를 수 없습니다";
      if (o[5] === "basic" && SPC.value === "A") return "침실2/3 분리형에서만 선택";
      if (o[5] === "A" && SPC.value === "basic") return "공간옵션 A에서만 선택";
      var r = rule(o);
      if (r.req && !r.req.every(function (x) { return ids[x]; })) return (opt(r.req[0]) || [0, 0, "연동 품목"])[2].replace(/^\S+\s/, "") + " 먼저 선택";
      if (r.block && r.block.some(function (x) { return ids[x]; })) return "선택한 드레스룸 · 팬트리 · 알파룸과 함께 고를 수 없음";
      return "";
    }
    var M = D.media || null;
    function mu(t, F) { return t.replace("{F}", F).replace("{f}", F.toLowerCase()); }
    function photoBtn(src, cap, cls) {
      return '<button type="button" class="' + (cls || "oc-ph") + '" data-src="' + esc(src) + '" data-cap="' + esc(cap) + '" aria-label="' + esc(cap) + ' 사진 크게 보기"><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"><span>사진 크게</span></button>';
    }
    function media(F) {
      if (!M) return "";
      var sc = M.scenes[F] || M.scenes.std;
      return '<div class="oc-mgrid">' +
        "<figure>" + photoBtn(mu(M.plan, F), F + " 평면도", "oc-ph wide") + "<figcaption>" + esc(F) + " 평면도 · 발코니 확장형</figcaption></figure>" +
        "<figure>" + photoBtn(mu(M.iso, F), F + " 공식 사이버모델하우스 대표 평면", "oc-ph wide") + "<figcaption>LH 공식 사이버모델하우스 · " + esc(F) + " 대표 타입</figcaption></figure></div>" +
        '<div class="oc-vr"><a class="btn sm solid" href="' + esc(mu(M.vr, F)) + '" target="_blank" rel="noopener">공식 VR로 둘러보기 ↗</a>' +
        Object.keys(sc).map(function (r) { return '<a class="chip" href="' + esc(mu(M.vr, F)) + "?startscene=" + encodeURIComponent(sc[r]) + '" target="_blank" rel="noopener">' + esc(r) + " ↗</a>"; }).join("") +
        '</div><p class="muted small" style="margin:6px 0 0">VR은 대표 타입의 발코니 확장형 기준이며, 전시 품목과 실제 계약 옵션은 다를 수 있습니다.</p>';
    }
    function row(o, g) {
      var id = "oc-" + o[0], typ = o[4] ? "radio" : "checkbox";
      return '<label class="oc-row" for="' + id + '"><input type="' + typ + '" id="' + id + '" data-id="' + esc(o[0]) + '"' + (o[4] ? ' name="ocg-' + esc(o[4]) + '"' : "") + '><span class="oc-l"><span>' + esc(o[2]) + '</span><small class="oc-why"></small></span><span class="oc-p num">' + (o[3] ? "+" + won(o[3]) : "무상") + "</span></label>";
    }
    function build() {
      var F = fam(), fl = D.types[TY.value][1], keep = FL.value;
      FL.innerHTML = Object.keys(fl).map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + "</option>"; }).join("");
      if (ME && !FREE) { FL.value = ME.key; FL.disabled = true; }
      else if (ME && fl[ME.key] && !keep) FL.value = ME.key;
      else if (fl[keep]) FL.value = keep; else FL.value = Object.keys(fl)[Object.keys(fl).length - 1];
      var FK = D.types[TY.value][0];
      el("ocFamInfo").textContent = FK + " 계열 · " + F.opts.length + "개 품목 · 표준안내문 " + F.src;
      if (el("ocMedia").dataset.f !== FK) { el("ocMedia").innerHTML = media(FK); el("ocMedia").dataset.f = FK; el("ocMediaS").textContent = FK + " 평면도 · 방별 VR"; }
      BOX.innerHTML = CATS.map(function (c) {
        var L = F.opts.filter(function (o) { return o[1] === c; }); if (!L.length) return "";
        var done = {}, h = "";
        L.forEach(function (o) {
          if (!o[4]) { h += row(o); return; }
          if (done[o[4]]) return; done[o[4]] = 1;
          h += '<div class="oc-grp" role="radiogroup" aria-label="' + esc(GN[o[4]] || o[4]) + '"><span class="oc-gl">' + esc(GN[o[4]] || o[4]) + ' · 하나만</span>' +
            '<label class="oc-row none" for="oc-none-' + esc(o[4]) + '"><input type="radio" id="oc-none-' + esc(o[4]) + '" name="ocg-' + esc(o[4]) + '" data-none="' + esc(o[4]) + '" checked><span class="oc-l"><span>선택 안 함 (기본 사양)</span></span><span class="oc-p num">0원</span></label>' +
            L.filter(function (x) { return x[4] === o[4]; }).map(row).join("") + "</div>";
        });
        var ph = M && M.keys[c] ? photoBtn(mu(M.photo, D.types[TY.value][0]).replace("{K}", M.keys[c]), D.types[TY.value][0] + " · " + c + " 선택품목 (팸플릿)") : "";
        return '<details class="oc-acc" data-cat="' + esc(c) + '"' + (c === "침실" || window.innerWidth > 1000 ? " open" : "") + '><summary><b>' + esc(c) + '</b><span class="oc-acc-c muted small">' + L.length + '개 품목</span><span class="oc-acc-s num"></span></summary>' +
          '<div class="oc-acc-b">' + ph + '<div class="oc-acc-l">' + h + "</div></div></details>";
      }).join("");
      enforce(); calc();
    }
    function enforce() {
      var F = fam(), off = [], changed;
      do {
        changed = false; var ids = picked();
        F.opts.forEach(function (o) { var i = el("oc-" + o[0]); if (i && i.checked && reason(o, ids)) { i.checked = false; off.push(o[2]); changed = true; } });
      } while (changed);
      var ids2 = picked();
      F.opts.forEach(function (o) {
        var i = el("oc-" + o[0]); if (!i) return; var r = reason(o, ids2);
        i.disabled = !!r; i.closest(".oc-row").classList.toggle("off", !!r); i.closest(".oc-row").querySelector(".oc-why").textContent = r && mode() !== "minus" ? r : "";
      });
      BOX.querySelectorAll("input[data-none]").forEach(function (x) {
        x.disabled = mode() === "minus";
        var g = x.dataset.none; if (!F.opts.some(function (o) { return o[4] === g && ids2[o[0]]; })) x.checked = true;
      });
      BOX.classList.toggle("minus", mode() === "minus");
      el("ocMsg").textContent = off.length ? "조건이 바뀌어 선택을 풀었습니다: " + off.join(" · ") : "";
    }
    function tax(base) {
      var rate = base <= 6e8 ? 0.01 : base <= 9e8 ? (base / 1e8 * 2 / 3 - 3) / 100 : 0.03;
      var t = base * rate, relief = el("ocFirst").checked ? Math.min(t, 2e6) : 0, edu = t * 0.1;
      el("ocTax").innerHTML = '<tr><th>과세표준</th><td class="r num">' + n(base) + "원</td></tr>" +
        '<tr><th>취득세율</th><td class="r num">' + (rate * 100).toFixed(2) + "%</td></tr>" +
        '<tr><th>취득세</th><td class="r num">' + n(Math.round(t)) + "원</td></tr>" +
        (relief ? '<tr><th>생애최초 감면</th><td class="r num">−' + n(Math.round(relief)) + "원</td></tr>" : "") +
        '<tr><th>지방교육세</th><td class="r num">' + n(Math.round(edu)) + "원</td></tr>" +
        '<tr class="total"><td>합계 (예상)</td><td class="r num">' + n(Math.round(t - relief + edu)) + "원</td></tr>";
    }
    function calc() {
      var T = D.types[TY.value], F = fam(), m = mode(), ids = picked();
      var house = T[1][FL.value] - (m === "minus" ? T[2] : 0), bal = F.bal[m === "minus" ? 1 : 0];
      var chosen = m === "minus" ? [] : F.opts.filter(function (o) { return ids[o[0]]; });
      var optSum = chosen.reduce(function (a, o) { return a + o[3]; }, 0), total = house + bal + optSum;
      var H = split(house), B = split(bal), O = [0, 0, 0, 0, 0, 0, 0, 0];
      chosen.forEach(function (o) { split(o[3]).forEach(function (v, i) { O[i] += v; }); });
      el("ocTotal").textContent = won(total); el("ocBarTotal").textContent = eok(total * 1000);
      el("ocKv").innerHTML = "<tr><th>주택 분양가 <small>" + esc(TY.value) + " · " + esc(FL.value) + (m === "minus" ? " · 마이너스" : "") + '</small></th><td class="r num">' + won(house) + "</td></tr>" +
        '<tr><th>발코니 확장</th><td class="r num">' + won(bal) + "</td></tr>" +
        "<tr><th>선택품목 <small>" + chosen.length + '개</small></th><td class="r num">' + won(optSum) + "</td></tr>" +
        '<tr class="total"><th>계약금 합계</th><td class="r num">' + won(H[0] + B[0] + O[0]) + "</td></tr>";
      el("ocChosen").textContent = m === "minus" ? "마이너스옵션 · 선택품목 없음" : (SPC.value === "A" ? "공간옵션 A · 침실2+3 통합" : "침실2/3 분리") + (chosen.length ? "" : " · 선택품목 없음");
      var acc = 0;
      el("ocPay").innerHTML = D.dates.map(function (d, i) {
        var lab = i === 0 ? "계약금" : i === 7 ? "입주 시 잔여금액" : "중도금 " + i + "차", sum = H[i] + B[i] + O[i]; acc += sum;
        return "<tr><td>" + lab + '<br><span class="muted small num">' + esc(d) + '</span></td><td class="r num d">' + n(H[i] * 1000) + '</td><td class="r num d">' + n(B[i] * 1000) + '</td><td class="r num d">' + n(O[i] * 1000) + '</td><td class="r num"><b>' + n(sum * 1000) + '</b></td><td class="r num">' + n(acc * 1000) + "</td></tr>";
      }).join("") + '<tr class="total"><td>합계</td><td class="r num d">' + n(house * 1000) + '</td><td class="r num d">' + n(bal * 1000) + '</td><td class="r num d">' + n(optSum * 1000) + '</td><td class="r num" colspan="2">' + won(total) + "</td></tr>";
      tax(total * 1000);
      BOX.querySelectorAll(".oc-acc").forEach(function (d) {
        var cs = chosen.filter(function (o) { return o[1] === d.dataset.cat; }), sum = cs.reduce(function (a, o) { return a + o[3]; }, 0);
        d.querySelector(".oc-acc-s").textContent = cs.length ? cs.length + "개 · +" + won(sum) : ""; d.classList.toggle("has", cs.length > 0);
      });
      el("ocSpH").style.flexGrow = house; el("ocSpB").style.flexGrow = bal; el("ocSpO").style.flexGrow = optSum;
      el("ocPicked").innerHTML = chosen.map(function (o) { return '<li><span>' + esc(o[2].replace(/^\S+\s/, "")) + '</span><b class="num">' + (o[3] ? won(o[3]) : "무상") + '</b><button type="button" class="linkbtn" data-un="' + esc(o[0]) + '" aria-label="' + esc(o[2]) + ' 빼기">빼기</button></li>'; }).join("");
      store("s4-optcalc", JSON.stringify({ t: TY.value, f: FL.value, m: m, s: SPC.value, o: Object.keys(ids), g: D.types[TY.value][0] }));
    }
    el("ocForm").addEventListener("submit", function (e) { e.preventDefault(); });
    TY.addEventListener("change", function () { SPC.value = "basic"; build(); });
    FL.addEventListener("change", calc);
    SPC.addEventListener("change", function () { enforce(); calc(); });
    C.querySelectorAll('input[name="ocMode"]').forEach(function (r) { r.addEventListener("change", function () {
      if (mode() === "minus") { BOX.querySelectorAll("input[data-id]").forEach(function (x) { x.checked = false; }); SPC.value = "basic"; }
      SPC.disabled = mode() === "minus"; enforce(); calc();
    }); });
    BOX.addEventListener("change", function () { enforce(); calc(); });
    el("ocReset").addEventListener("click", function () { BOX.querySelectorAll("input[data-id]").forEach(function (x) { x.checked = false; }); SPC.value = "basic"; enforce(); calc(); el("ocMsg").textContent = "선택품목을 모두 풀었습니다."; });
    el("ocFirst").addEventListener("change", calc);
    el("ocPicked").addEventListener("click", function (e) { var u = e.target.closest("[data-un]"); if (!u) return; var i = el("oc-" + u.dataset.un); if (i) { i.checked = false; if (i.type === "radio") { var nn = el("oc-none-" + opt(u.dataset.un)[4]); if (nn) nn.checked = true; } } enforce(); calc(); });
    el("ocPayFull").addEventListener("click", function () { var on = el("ocPayT").classList.toggle("full"); this.setAttribute("aria-pressed", on); this.textContent = on ? "합계만 보기" : "항목별로 보기"; });
    // 사진: 못 불러오면 칸을 숨김, 누르면 크게
    C.addEventListener("error", function (e) { var b = e.target && e.target.closest && e.target.closest(".oc-ph"); if (b) b.hidden = true; }, true);
    var LB = el("ocLb");
    C.addEventListener("click", function (e) {
      var b = e.target.closest(".oc-ph"); if (!b) return;
      el("ocLbImg").src = b.dataset.src; el("ocLbImg").alt = b.dataset.cap; el("ocLbCap").textContent = b.dataset.cap + " · 실제 시공 · 계약 품목과 다를 수 있습니다.";
      if (LB.showModal) LB.showModal(); else window.open(b.dataset.src, "_blank", "noopener");
    });
    el("ocLbX").addEventListener("click", function () { LB.close(); });
    LB.addEventListener("click", function (e) { if (e.target === LB) LB.close(); });
    var okT = function (t) { return t && D.types[t] && Array.prototype.some.call(TY.options, function (o) { return o.value === t; }); };
    if (ME && !okT(saved.t)) { saved = {}; var dflt = okT(ME.fam) ? ME.fam : TY.options[0] && TY.options[0].value; if (dflt) TY.value = dflt; }
    if (okT(saved.t)) TY.value = saved.t;
    if (saved.m === "minus") { C.querySelector('input[name="ocMode"][value="minus"]').checked = true; SPC.disabled = true; }
    else if (saved.s === "A") SPC.value = "A";
    if (saved.f && FREE) { FL.innerHTML = '<option value="' + esc(saved.f) + '">' + esc(saved.f) + "</option>"; FL.value = saved.f; }
    build();
    // 지난번 고른 품목 다시 (같은 계열일 때만)
    if (saved.o && saved.g === D.types[TY.value][0] && saved.m !== "minus") { saved.o.forEach(function (id) { var i = el("oc-" + id); if (i) i.checked = true; }); enforce(); calc(); }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { el("ocBar").classList.toggle("show", !es[0].isIntersecting); }).observe(el("ocSum"));
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
      ["회원가입", "동 · 호수(아이디), 비밀번호(암호화 저장), 계약서 사진, 가입 · 접속 기록", "입주예정자 확인, 1세대 1계정 관리", "계약서 사진은 운영진 확인(승인 · 반려) 즉시 삭제. 나머지는 탈퇴 또는 협의회 해산 시까지. 가입 · 승인 · 반려 기록(세대 · 일시 · 처리자)은 분쟁 대비로 해산 시까지"],
      ["위임동의서", "주택형 · 동 · 호수, 계약자 성명, 휴대전화번호, 서명, 동의 일시, 공동명의자 성명 · 서명(공동명의자 본인이 서명할 때만) (서면 접수 시 위임장 스캔본)", "계약자 확인, 과반수 동의 집계, 협의회 공지 · 의견수렴 · 투표", "동의 철회 또는 입주자대표회의 인계 완료 · 협의회 해산 시 지체 없이 파기 (제출 · 철회 기록은 분쟁 대비로 해산 시까지)"],
      ["회비", "협의회 통장 거래내역(입금 일시 · 금액 · 입금자명), 세대별 납부 여부", "회비 납부 확인, 회계 공개(월별 합계만 공개, 입금자 이름은 비공개)", "협의회 해산 시 결산 · 인계 후 파기"],
      ["투표 · 단체민원", "세대별 투표 · 참여 여부 (예전 게시판 글 · 댓글 포함)", "1세대 1표 집계, 참여 세대 수 공개", "삭제 시 또는 협의회 해산 시까지"],
      ["민원 AI 글쓰기", "AI 이용 횟수 기록(회원 · 시각 · 글 종류). 쓴 문장은 저장하지 않음", "1인 하루 이용 횟수 제한", "30일 뒤 자동 삭제"]
    ];
    var LB = ["구분", "항목", "목적", "보유 기간"];
    C.innerHTML = "<div>" + head("수집 항목과 보유 기간") + '<div class="tablebox"><table class="spec stack"><thead><tr><th>구분</th><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead><tbody>' +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return '<td data-label="' + LB[i] + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></div>" +
      '<div class="two"><div>' + head("제3자 제공") + '<p class="muted">회원 정보(동 · 호수, 성명, 연락처, 서명 등)는 LH · 시공사 · 관계기관 · 법무법인 등 외부에 제공하지 않습니다(회칙 제32조). 협의 · 민원에서 대표성을 보일 때는 동별 위임 세대 수만 알립니다.</p>' +
      head("처리 위탁 · 국외 이전") + '<ul class="muted plain-list"><li><b>Supabase Inc.</b> (미국, support@supabase.com) — 회원 정보 · 위임동의 · 게시글 · 계약서 사진 저장과 로그인 처리. 데이터는 서울(대한민국) 리전에 저장되며, 회원가입 · 이용 시 인터넷으로 전송됩니다. 보유 기간은 위 표와 같습니다.</li>' +
      '<li><b>Google LLC</b> (미국, Gemini API) — 민원 페이지의 "AI로 글 쓰기"를 누를 때 고른 글 종류 · 상황 · 말투와 공개된 민원 요지만 보내 문장을 받습니다. 이름 · 동호수 등 회원 정보는 보내지 않습니다.</li>' +
      '<li><b>GitHub Inc.</b> (미국) — 홈페이지 호스팅과 LH 공고문 자동 읽기. 회원 개인정보는 다루지 않으며, 접속 기록(IP 등)이 남을 수 있습니다.</li></ul>' +
      '<p class="muted small">위 이전은 서비스 제공에 필요한 처리로, 원하지 않으면 회원가입을 하지 않거나 탈퇴하면 됩니다.</p></div>' +
      "<div>" + head("공개 범위") + '<p class="muted">누구나 볼 수 있는 것은 동별 위임 세대수뿐입니다. 세대별 위임 여부는 승인된 회원과 운영진에게만 보입니다. 게시판 작성자는 승인된 회원에게만 "동-호"로 표시합니다.</p>' +
      head("권리 행사") + '<p class="muted">위임동의 철회는 내 정보 화면에서 바로 할 수 있습니다. 회원 정보 열람 · 정정 · 삭제(탈퇴)는 운영진에게 요청하면 지체 없이 처리합니다.</p>' +
      head("파기 · 안전 조치") + '<p class="muted">보유 기간이 끝나거나 철회 · 탈퇴하면 데이터베이스에서 즉시 삭제합니다. 비밀번호는 암호화해 저장하고, 계약서 사진은 운영진만 열람할 수 있는 비공개 저장소에 두었다가 확인 즉시 삭제합니다. 로그인 상태 유지를 위해 브라우저 저장소에 로그인 정보를 저장합니다.</p>' +
      head("개인정보 보호책임자") + '<p class="muted">' + esc((S.privacyOfficer && S.privacyOfficer.role) || "협의회 운영진 대표") + (S.privacyOfficer && S.privacyOfficer.contact ? " · " + esc(S.privacyOfficer.contact) : " · 연락처는 공지사항으로 안내합니다") + '</p></div></div>' +
      '<p class="muted small">시행일: ' + esc(S.updated) + ". 내용이 바뀌면 이 페이지와 공지사항으로 알립니다.</p>";
  };

  /* ── 로그인 · 회원가입 ── */
  /* 위임동의 입력칸 (가입 화면 p="c", 위임동의서 화면 p="a") */
  function consentFields(p) {
    return '<fieldset class="consent-in"><legend>동의서 작성 <span class="tag hot">필수</span></legend>' +
      '<p class="muted small" style="margin:0 0 8px">공급계약서와 동일하게 작성해 주세요. 동 · 호수는 가입한 세대로 정해집니다.</p>' +
      '<div class="field"><label for="' + p + 'Name">계약자 성명</label><input id="' + p + 'Name" maxlength="30" autocomplete="name"></div>' +
      '<div class="field"><label for="' + p + 'Phone">휴대전화번호</label><input id="' + p + 'Phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13"></div>' +
      '<label class="check" for="' + p + 'Co"><input type="checkbox" id="' + p + 'Co"> 공동명의 세대입니다</label>' +
      '<div id="' + p + 'CoBox" hidden>' +
        '<div class="field"><label for="' + p + 'CoName">공동명의자 성명</label><input id="' + p + 'CoName" maxlength="30"></div>' +
        '<div class="field"><label for="' + p + 'Rep">대표 회원 성명 <span class="muted small">의결권은 세대당 1표, 대표 1인이 행사</span></label><input id="' + p + 'Rep" maxlength="30"></div>' +
      "</div>" +
      '<label class="check" for="' + p + 'Del"><input type="checkbox" id="' + p + 'Del"> 위 구성 및 위임 내용에 동의합니다 (필수)</label>' +
      '<label class="check" for="' + p + 'Priv"><input type="checkbox" id="' + p + 'Priv"> 위 개인정보 수집 · 이용에 동의합니다 (필수)</label>' +
      '<div class="field"><label for="' + p + 'Sig">계약자 서명 <span class="muted small">손가락이나 마우스로 서명해 주세요 · 작성일은 제출 시각으로 자동 기록</span></label>' +
      '<div class="sigpad"><canvas id="' + p + 'Sig" width="600" height="200" aria-label="계약자 서명 칸"></canvas><span class="sig-hint" aria-hidden="true">여기에 서명해 주세요</span><button type="button" class="linkbtn" id="' + p + 'SigClear">다시 쓰기</button></div></div>' +
      '<div id="' + p + 'CoSigBox" hidden><div class="field"><label for="' + p + 'CoSig">공동명의자 서명</label><div class="sigpad"><canvas id="' + p + 'CoSig" width="600" height="200" aria-label="공동명의자 서명 칸"></canvas><span class="sig-hint" aria-hidden="true">여기에 서명해 주세요</span><button type="button" class="linkbtn" id="' + p + 'CoSigClear">다시 쓰기</button></div></div>' +
        '<label class="check" for="' + p + 'CoOk"><input type="checkbox" id="' + p + 'CoOk"> 공동명의자 본인이 위임 내용과 필수 개인정보 수집 · 이용을 직접 확인하고 동의합니다 (필수)</label></div>' +
      "</fieldset>";
  }
  var SIG = {};
  function sigPad(id) {
    var c = el(id), ctx = c.getContext("2d"), drawing = false, strokes = 0, last = null;
    function pen() { var d = c.width / Math.max(c.getBoundingClientRect().width, 1); ctx.lineWidth = 3.2 * d; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a1a1a"; }
    // 보이는 크기 × 화면 배율로 캔버스를 맞춤 (휴대폰에서 큰 서명 칸 · 또렷한 선). 이미 쓴 서명은 늘려서 유지
    function fit() {
      var r = c.getBoundingClientRect(); if (!r.width) return;
      var d = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(r.width * d), Hh = Math.round(r.height * d);
      if (Math.abs(W - c.width) < 4 && Math.abs(Hh - c.height) < 4) return;
      var keep = strokes ? c.toDataURL("image/png") : null;
      c.width = W; c.height = Hh; pen();
      if (keep) { var im = new Image(); im.onload = function () { ctx.drawImage(im, 0, 0, c.width, c.height); }; im.src = keep; }
    }
    function pt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
    function clear() { ctx.clearRect(0, 0, c.width, c.height); strokes = 0; c.parentNode.classList.remove("signed"); }
    fit(); pen();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(c); else window.addEventListener("resize", fit);
    c.addEventListener("pointerdown", function (e) { e.preventDefault(); fit(); drawing = true; last = pt(e); ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, 7); ctx.fillStyle = "#1a1a1a"; ctx.fill(); try { c.setPointerCapture(e.pointerId); } catch (er) {} });
    c.addEventListener("pointermove", function (e) { if (!drawing) return; e.preventDefault(); var q = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x, q.y); ctx.stroke(); last = q; strokes++; if (strokes === 8) c.parentNode.classList.add("signed"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { c.addEventListener(t, function () { drawing = false; }); });
    el(id + "Clear").addEventListener("click", clear);
    // 저장은 가로 900px 이하로 줄여서 (서버 한도 300KB)
    function out() { var W = Math.min(c.width, 900), o = document.createElement("canvas"); o.width = W; o.height = Math.round(c.height * W / c.width); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/png"); }
    return { empty: function () { return strokes < 8; }, data: function () { return strokes < 8 ? null : out(); } };
  }
  function bindConsent(p) {
    SIG[p] = sigPad(p + "Sig"); SIG[p + "Co"] = sigPad(p + "CoSig");
    el(p + "Co").addEventListener("change", function () { el(p + "CoBox").hidden = !this.checked; el(p + "CoSigBox").hidden = !this.checked; });
  }
  function consentValues(p) {
    var co = el(p + "Co").checked;
    return { signer: el(p + "Name").value, signature: SIG[p] ? SIG[p].data() : null, delegation: el(p + "Del").checked, privacy: el(p + "Priv").checked,
      thirdParty: false, contact: true, phone: el(p + "Phone").value, cafeNick: "", identity: true,
      coOwner: co, coName: co ? el(p + "CoName").value : "", repName: co ? el(p + "Rep").value : "", coOk: co ? el(p + "CoOk").checked : true,
      coSignature: co && SIG[p + "Co"] ? SIG[p + "Co"].data() : null };
  }

  /* 위임장 보기 · 인쇄 (본인 사본 · 운영진 출력 · 빈 서면 양식) */
  function wiDoc(a) {
    var blank = !a, u = blank ? null : UNIT[a.unit_id];
    var box = function (on) { return '<span class="pbox">' + (on ? "✓" : "") + "</span>"; };
    var line = function (v) { return blank ? '<span class="sigline"></span>' : esc(v || "-"); };
    var sig = function (src, paperNote) { return blank ? '<span class="sigline"></span> (서명)' : src ? '<img src="' + esc(src) + '" alt="서명">' : paperNote; };
    return '<article class="wi-doc"><h1>' + esc(CONSENT_TITLE) + "</h1><p>" + esc(CONSENT_INTRO) + "</p>" +
      "<section><h2>01 구성 및 위임 동의</h2>" + CONSENT.map(function (c) { return "<h3>" + esc(c[0]) + "</h3><p>" + esc(c[1]) + "</p>"; }).join("") +
      "<p>회칙: 고양창릉 S4블록 입주예정자협의회 회칙 (37개 조) · 홈페이지 협의회 › 회칙</p></section>" +
      "<section><h2>02 개인정보 수집 및 이용 (필수)</h2>" + consentPrivHtml("wi-priv") + "</section>" +
      '<ul class="wi-checks"><li>' + box(!blank) + " 위 구성 및 위임 내용에 동의합니다 (필수)</li><li>" + box(!blank) + " 위 개인정보 수집 · 이용에 동의합니다 (필수)</li></ul>" +
      "<section><h2>03 확인 및 서명</h2><p class=\"wi-oath\">" + esc(CONSENT_OATH) + "</p></section>" +
      '<table class="wi-head"><tr><th>동 / 호수</th><td>' + (blank ? "_______ 동 _______ 호" : esc(u ? u.dong + "동 " + u.ho + "호 (" + u.type + ")" : a.unit_id)) + "</td></tr>" +
      "<tr><th>계약자 성명</th><td>" + line(a && a.signer_name) + "</td></tr>" +
      "<tr><th>휴대전화번호</th><td>" + line(a && a.phone) + "</td></tr>" +
      "<tr><th>작성일</th><td>" + (blank ? "2026 년 ___ 월 ___ 일" : esc(fmtTime(a.signed_at))) + "</td></tr>" +
      "<tr><th>계약자 서명</th><td>" + sig(a && a.signature, "서면 원본 보관") + "</td></tr>" +
      "<tr><th>공동명의자 성명 · 서명<br><span class=\"muted\">(공동명의 세대, 본인 직접)</span></th><td>" + (blank ? '(성명) <span class="sigline"></span> (서명) <span class="sigline"></span>' : a.co_name ? esc(a.co_name) + " " + sig(a.co_signature, "") : "-") + "</td></tr>" +
      "<tr><th>대표 회원 성명<br><span class=\"muted\">(공동명의 세대)</span></th><td>" + line(a && (a.rep_name || (a.co_name ? "" : null))) + "</td></tr></table>" +
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
    var closed = !PREVIEW && !needsProfile && !API.signupOpen;   // 가입 시작 시각 (서버 설정)
    var fileField = '<div class="field"><label for="sFile">계약서 사진 <span class="muted small">첫 장, 동 · 호수와 계약자 이름만 보이게 나머지는 가려주세요 · <b>주민등록번호는 반드시 가리세요</b> · 5MB 이하</span></label><input id="sFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required></div>';
    var privacy = '<details class="terms"><summary>개인정보 수집 · 이용 안내 보기</summary><p class="body">' + esc(PRIVACY_SIGNUP) + "</p></details>" +
      '<label class="check" for="sPriv"><input type="checkbox" id="sPriv"> 개인정보 수집 · 이용에 동의합니다 (필수)</label>';
    C.innerHTML =
      '<div class="auth-wrap">' +
      (PREVIEW ? '<div class="notice-box' + (CONN_FAIL ? " bad" : "") + '" style="margin-bottom:14px">' + PREVIEW_MSG + "</div>" : "") +
      (needsProfile ? "" : '<div class="tabs" role="tablist"><button type="button" role="tab" id="tLogin" aria-selected="' + (tab === "login") + '">로그인</button><button type="button" role="tab" id="tSignup" aria-selected="' + (tab === "signup") + '">회원가입</button></div>') +

      '<form class="panel" id="fLogin"' + (tab === "login" ? "" : " hidden") + ' novalidate>' +
      unitPicker("l") +
      '<div class="field"><label for="lPw">비밀번호</label><input id="lPw" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn solid wide" type="submit">로그인</button><p class="notice-box" id="lMsg" role="alert" hidden></p>' +
      '<p class="muted small" style="margin:12px 0 0">비밀번호를 잊었다면 운영진에게 문의하세요. 본인 확인 후 다시 가입할 수 있게 도와드립니다.</p></form>' +

      (closed ? '<div class="panel" id="fSignup"' + (tab === "signup" ? "" : " hidden") + '><div class="empty" style="border:0;padding:8px 0"><b>가입은 ' + esc(signupOpenLabel()) + ' 공급계약 시작과 함께 받습니다</b><span>계약을 마친 계약자만 가입하도록 해, 계약을 포기한 세대가 섞이지 않게 하려는 것입니다. 가입할 때 계약서 첫 장 사진이 필요합니다. 그 전에도 공지 · LH 공고 · 일정 · FAQ · 계산기는 누구나 볼 수 있습니다.</span><p class="cta-row" style="margin-top:8px"><a class="btn" href="notice.html">공지사항 보기</a><a class="btn" href="faq.html">FAQ</a></p></div></div></div>' :
      '<form class="panel" id="fSignup"' + (tab === "signup" ? "" : " hidden") + ' novalidate>' +
      (needsProfile
        ? '<div class="notice-box" style="margin-bottom:14px">' + esc(unitLabel(API.accountUnit)) + " 계정은 만들어졌지만 계약서 사진이 아직 없습니다. 사진을 올려 가입을 마무리하세요.</div>"
        : '<p class="muted small" style="margin:0 0 12px">우리 집 동 · 호수가 아이디가 됩니다. 로그인할 때도 동 · 호수와 비밀번호만 넣으면 됩니다.</p>' + unitPicker("s") +
          '<div class="two" style="gap:12px"><div class="field"><label for="sPw">비밀번호 <span class="muted small">8자 이상</span></label><input id="sPw" type="password" autocomplete="new-password" required></div>' +
          '<div class="field"><label for="sPw2">비밀번호 확인</label><input id="sPw2" type="password" autocomplete="new-password" required></div></div>') +
      fileField + privacy +
      '<button class="btn solid wide" type="submit">' + (needsProfile ? "가입 마무리" : "가입 신청") + '</button><p class="notice-box" id="sMsg" role="alert" hidden></p>' +
      '<p class="muted small" style="margin:12px 0 0">운영진이 사진으로 세대를 확인해 승인하면 회원 전용 안내와 민원 참여를 이용할 수 있습니다. 위임동의서는 공급계약(' + esc(consentOpenLabel()) + '~) 후 따로 제출합니다. 한 세대에는 한 계정만 만들 수 있습니다.</p></form></div>');
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
      el("fLogin").addEventListener("submit", function (e) { e.preventDefault(); say("lMsg", PREVIEW_MSG, CONN_FAIL); });
      el("fSignup").addEventListener("submit", function (e) { e.preventDefault(); say("sMsg", PREVIEW_MSG, CONN_FAIL); });
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
    var PWFORM = head("비밀번호 바꾸기") + '<form class="panel" id="fPw" novalidate><div class="field"><label for="pPw">새 비밀번호</label><input id="pPw" type="password" autocomplete="new-password"></div><div class="field"><label for="pPw2">새 비밀번호 확인</label><input id="pPw2" type="password" autocomplete="new-password"></div><button class="btn" type="submit">변경</button><p class="notice-box" id="pMsg2" role="status" hidden></p></form>';
    C.innerHTML =
      '<div class="two acct-grid"><div class="acct-col">' + head("내 계정") + '<div class="panel"><div class="acct-head"><b>' + esc(unitLabel(p.unit_id)) + '</b><span class="' + badge[0] + '">' + badge[1] + "</span>" + (API.isAdmin ? '<span class="tag">운영진</span>' : "") + "</div>" +
      '<table class="spec kv"><tr><th>아이디</th><td class="num">' + esc(p.unit_id) + "</td></tr><tr><th>가입 신청</th><td>" + fmtDate(p.created_at) + "</td></tr>" +
      (p.reviewed_at ? "<tr><th>" + (p.status === "approved" ? "승인일" : "처리일") + "</th><td>" + fmtDate(p.reviewed_at) + "</td></tr>" : "") + "</table>" +
      (p.status === "pending" ? '<p class="notice-box">운영진이 올려주신 사진으로 세대를 확인하고 있습니다. 승인되면 회원 전용 안내와 민원 참여를 이용할 수 있습니다.</p>' : "") +
      (p.status === "rejected" ? '<p class="notice-box bad">반려 사유: ' + esc(p.reject_reason || "-") + "</p>" : "") +
      '<p class="cta-row">' + (API.isAdmin ? '<a class="btn solid" href="admin.html">운영진 페이지</a>' : "") + '<button type="button" class="btn" id="logout">로그아웃</button></p></div>' + PWFORM + "</div>" +

      "<div>" + (p.status !== "rejected" ? head("위임동의") + (ag ? '<div class="panel"><p style="margin-top:0">' + fmtTime(ag.signed_at) + "에 위임동의서를 제출했습니다." + (p.status === "pending" ? " 운영진 승인 후 현황판에 반영됩니다." : "") + '</p><p class="cta-row"><a class="btn" href="agreement.html">현황판 보기</a><button type="button" class="btn" id="accWi">내 위임장 보기 · 인쇄</button> ' + (API.isDelegate ? '<button type="button" class="btn" id="accChat">입주민 오픈채팅 입장</button> ' : "") + '<button type="button" class="btn danger" id="withdraw">위임동의 철회</button></p><p class="muted small" style="margin:0">철회하면 현황판에서 바로 빠지고 투표 · 민원 참여와 세대별 현황 보기가 중지됩니다. 게시판은 계속 쓸 수 있고, 위임동의서를 다시 내면 바로 회복됩니다.</p><p class="notice-box" id="aMsg" role="status" hidden></p></div>'
        : delegateNote(true)) : "") +
      (p.status === "approved" ? '<div id="accDues"></div>' : "") +
      (p.status === "rejected" ? head("계약서 사진 다시 내기") + '<form class="panel" id="fRe" novalidate>' +
        '<div class="field"><label for="rFile">계약서 사진 <span class="muted small">첫 장 · 주민등록번호는 가리세요</span></label><input id="rFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required></div>' +
        '<button class="btn solid" type="submit">재신청</button><p class="notice-box" id="rMsg" role="alert" hidden></p>' +
        '<p class="muted small" style="margin:10px 0 0">세대를 잘못 골랐다면 운영진에게 계정 삭제를 요청한 뒤 맞는 세대로 다시 가입하세요.</p></form>' : "") +
      "</div></div>" +

      "";
    el("logout").addEventListener("click", async function () { await API.signOut(); location.href = "index.html"; });
    if (el("accDues")) Promise.all([API.duesMine(), API.duesPublic()]).then(function (r) {
      var card = duesCardHtml(r[0], r[1]), h = card || duesAdminHint(r[1]); if (!h) return;
      el("accDues").innerHTML = head("회비") + h + (card ? '<p class="muted small">총무가 은행 거래내역을 올리면 반영됩니다. 입금하고 며칠이 지나도 그대로면 게시판이나 메일로 알려 주세요.</p>' : "");
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

    el("fPw").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.changePassword(el("pPw").value, el("pPw2").value); el("pPw").value = el("pPw2").value = ""; say("pMsg2", "비밀번호를 바꿨습니다."); } catch (err) { say("pMsg2", API.errorText(err), true); } });
  };

  /* ── 위임동의서 ── */
  /* 구성 및 위임 동의서 — 입예협 최신본(2026-11-13, v9: 제1조② 회칙 동의 문장만 남김. v8: 제2조② 수행 주체 '입예협', 제3조 '개별 세대의' 하자보수 청구권). 선택 항목(카페 닉네임 · 계약서 첨부)은 받지 않음.
     문구를 바꾸면 api.js FORM_VERSION도 올려 주세요 */
  var CONSENT_TITLE = "고양창릉 S4 입주예정자협의회 구성 및 위임 동의서";
  var CONSENT_INTRO = "이 동의서는 입주예정자협의회 구성, 공동 현안에 대한 대표 협의 및 입주 편의 업무의 위임 범위를 확인하기 위한 것입니다. 개별 세대의 계약 변경, 비용 부담 또는 권리 포기를 대신 결정할 권한은 포함하지 않습니다.";
  var CONSENT_PRE = [];
  var CONSENT_HERO = { kicker: "OUR HOME, OUR VOICE", title: "함께 만드는 창릉 S4,\n우리의 동의에서 시작합니다.", lead: "한 세대의 목소리는 민원이지만,\n모인 목소리는 협의가 됩니다.", credit: "이미지 출처: LH 고양창릉 S4 공식 팸플릿 · 투시도는 실제 시공과 다를 수 있습니다." };
  var CONSENT_WHY = [
    ["하나", "개인 민원은 접수로 끝납니다", "혼자 넣은 의견은 답변 한 줄로 마무리되기 쉽습니다. 계약자의 위임을 모은 단체는 협의 상대로 인정받고, 설계 변경 · 마감재 · 조경 · 통학로 확보 및 개선과 같은 사안은 대부분 그 자리에서 정해집니다."],
    ["둘", "계약자만 모아야 힘이 됩니다", "위임동의는 계약 사실이 확인된 세대만 받습니다. 그래야 협의회가 이 단지를 대표한다고 말할 수 있고, 상대방도 매번 그 근거를 요구합니다."],
    ["셋", "지금 해야 반영됩니다", "공사가 진행될수록 바꿀 수 있는 폭은 줄어듭니다. 준공 뒤에 남는 것은 하자보수뿐입니다. 2030년 3월 입주까지 남은 기간이 우리가 쓸 수 있는 시간의 전부입니다."]
  ];
  function consentHeroHtml() {
    return '<section class="c-hero"><img src="assets/img/s4-view-1600.webp" srcset="assets/img/s4-view-800.webp 800w, assets/img/s4-view-1600.webp 1600w" sizes="(max-width: 700px) 100vw, 1100px" alt="고양창릉 S4블록 조감 투시도" width="1600" height="996" fetchpriority="high">' +
      '<div class="c-hero-txt"><span class="c-kick">' + esc(CONSENT_HERO.kicker) + "</span><h2>" + esc(CONSENT_HERO.title).replace(/\n/g, "<br>") + "</h2><p>" + esc(CONSENT_HERO.lead).replace(/\n/g, "<br>") + '</p></div><small class="c-credit">' + esc(CONSENT_HERO.credit) + "</small></section>" +
      '<section class="c-why"><h3>위임동의가 필요한 이유 <span>세 가지만 말씀드립니다.</span></h3><div class="c-why-grid">' + CONSENT_WHY.map(function (w) {
        return '<div><span class="c-no">' + esc(w[0]) + "</span><b>" + esc(w[1]) + "</b><p>" + esc(w[2]) + "</p></div>";
      }).join("") + "</div></section>";
  }
  var CONSENT = [
    ["제1조 구성 및 회칙 동의", "① 본인은 고양창릉 S4블록의 계약자로서 「고양창릉 S4블록 입주예정자협의회」(이하 “입예협”)의 구성에 동의하고 회원으로 참여합니다. 입예협을 본인이 위임한 범위에서 공동 의견을 전달하는 대표 협의 창구로 인정합니다.\n② 별도로 제공된 입예협 회칙을 확인하고 이에 동의합니다."],
    ["제2조 위임 범위", "① 본인은 입예협에 시공 품질, 주거환경 및 입주 준비 등 공동 현안에 관하여 LH · 시공사 · 관계기관과 협의하고, 자료 · 설명을 요청하며, 의견 · 민원 · 건의를 제출하는 권한을 위임합니다.\n② 입예협은 회원 의견을 수렴하고 관련 정보와 협의 결과를 공유합니다. 위임 업무는 회칙에 따라 구성된 입예협이 수행하며, 구성 전 준비위원회는 구성 준비와 동의서 접수 · 집계 업무를 담당합니다.\n③ 본인은 입예협에 공동구매 · 입주박람회 추진과 법무법인 · 법무사 선정을 위한 후보 모집, 조건 비교 · 협의 및 선정 권한을 위임합니다. 추진 및 선정은 회칙에 따른 의결 절차를 거치고, 주요 조건과 결과를 회원에게 공개합니다. 개별 세대의 참여 · 구매 · 수임계약 체결 여부는 각 세대가 자율적으로 결정하며, 특정 업체 이용을 강제하지 않습니다."],
    ["제3조 위임의 한계", "본 동의에는 개별 세대의 공급계약 변경 · 해제, 재산권 처분 · 제한, 비용 부담 약정, 소송 · 수임계약 체결, 개별 세대의 하자보수 · 손해배상 청구권이나 민원 제기권의 포기 · 제한 및 제3자에 대한 재위임 권한이 포함되지 않습니다. 필요한 경우 해당 권리자의 별도 동의를 받아야 합니다."],
    ["제4조 기간 및 철회", "위임은 서명일부터 입주자대표회의 구성 후 업무 인계 완료 시까지 유효합니다. 본인은 언제든 서면 · 카페 쪽지 · 문자로 위임을 철회할 수 있으며, 철회 의사가 도달한 때부터 효력을 잃습니다. 계약자 지위를 상실하면 위임도 종료되며, 승계인은 새로 동의해야 합니다.\n이 홈페이지로 낸 동의는 내 정보 화면에서 바로 철회할 수 있습니다."]
  ];
  var CONSENT_PRIV_INTRO = "입예협은 다음과 같이 개인정보를 수집 · 이용합니다. 구성 전에는 준비위원회가 접수 · 관리하며, 구성 후 입예협이 동일한 목적과 범위에서 관리합니다.";
  var CONSENT_PRIV = [
    ["수집 항목", "계약자 성명, 동 · 호수, 휴대전화번호, 서명, 동의일\n공동명의자는 직접 서명하는 경우 해당 정보 수집"],
    ["이용 목적", "계약자 확인, 구성 · 위임 의사 확인 및 세대별 동의 집계, 회원 등록, 공지 · 의견수렴 · 투표 안내"],
    ["보유 기간", "입주자대표회의 업무 인계 완료 시까지. 그 전에 본 동의 철회 · 회원 탈퇴 · 계약자 지위 상실로 수집 목적이 종료되면 지체 없이 파기"],
    ["거부 권리", "동의를 거부할 수 있습니다. 거부 시 이 동의서에 의한 계약자 확인 · 회원 등록 · 위임 집계가 불가능합니다. 주요 협의 결과의 열람은 가능합니다."]
  ];
  var CONSENT_PROTECT = ["계약 확인 자료는 성명 · 동호수 외 정보를 가려 제출하며, 확인 후 즉시 삭제합니다. 명부와 동의서는 접근 권한을 제한하여 관리하고, 주민등록번호 · 계좌번호는 수집하지 않습니다. 입주자대표회의 인계 시 개인정보 명부 대신 개인을 식별할 수 없는 집계 결과만 제공합니다.",
    "본 동의서에는 개인정보의 제3자 제공 동의가 포함되지 않습니다. LH 등 외부기관에 명부나 서명 원본을 제공할 필요가 생기면 제공 대상 · 목적 · 항목 · 보유 기간 · 거부 시 영향을 알리고 별도 동의를 받습니다.",
    "개인정보 관리책임자 · 문의 및 철회 접수: 입예협 회장(구성 전에는 준비위원회) · 카페 쪽지 또는 협의회 공식 메일 changneung.s4@gmail.com"];
  var CONSENT_OATH = "본인은 위 내용과 별도로 제공된 회칙을 확인하고, 입예협 구성 및 명시된 범위의 위임에 동의합니다. 공동명의자는 본인이 직접 확인 · 서명하며, 미서명 공동명의자의 개별 권한까지 위임되는 것은 아닙니다.";
  var CONSENT_TO = "고양창릉 S4블록 입주예정자협의회 (구성 전 접수: 입주예정자협의회 준비위원회)";
  function consentPrivHtml(cls) {
    return '<p>' + esc(CONSENT_PRIV_INTRO) + '</p><table class="spec ' + (cls || "c-priv") + '">' + CONSENT_PRIV.map(function (r) { return "<tr><th>" + esc(r[0]) + '</th><td class="body">' + esc(r[1]) + "</td></tr>"; }).join("") + "</table>" +
      '<div class="c-protect"><b>개인정보 보호 및 외부 제공 안내</b>' + CONSENT_PROTECT.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") + "</div>";
  }
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
    return consentHeroHtml() + '<a class="btn jump-side" href="#consentSide">아래 제출 칸으로 이동 ↓</a><div class="two consent-grid"><div>' + form + '</div><div id="consentSide">' + side + "</div></div>";
  }
  R.consent = async function () {
    var form = '<article class="consent-doc"><p class="eyebrow">CONSENT · 동의서</p><h2>' + esc(CONSENT_TITLE) + '</h2><p class="muted small">양식 버전 ' + esc(API.formVersion || "2026-11-v1") + "</p>" +
      '<p class="c-intro">' + esc(CONSENT_INTRO) + "</p>" +
      '<h3 class="c-step"><span>01</span> 구성 및 위임 동의</h3>' + consentSecs("h4") +
      '<p class="c-bylaw">회칙: 고양창릉 S4블록 입주예정자협의회 회칙 (36개 조) · <a href="bylaws.html" target="_blank" rel="noopener">회칙 전문 보기 →</a></p>' +
      '<h3 class="c-step"><span>02</span> 개인정보 수집 및 이용 <span class="tag hot">필수</span></h3>' + consentPrivHtml() +
      '<h3 class="c-step"><span>03</span> 확인 및 서명</h3><p class="c-oath">' + esc(CONSENT_OATH) + '</p><p class="c-to">' + esc(CONSENT_TO) + "</p>" +
      '<p class="cta-row" style="margin:8px 0 0"><button type="button" class="btn" id="docPdf">동의서 PDF로 저장</button></p></article>' +
      '<div class="panel paper-box"><b>온라인이 어려우신가요?</b><p class="muted small" style="margin:6px 0 10px">공급계약을 마친 뒤 서면 위임장 양식을 인쇄해 작성 · 서명하고, 사진이나 스캔본을 협의회 공식 메일 <b>changneung.s4@gmail.com</b> 으로 보내 주세요. 운영진이 확인해 등록합니다. 주민등록번호는 적지 마세요.</p><button type="button" class="btn" id="blankForm">서면 양식 인쇄 · PDF 저장</button></div>';
    function bindBlank() {
      var b = el("blankForm"); if (b) b.addEventListener("click", window.S4_showBlankForm);
      var d = el("docPdf"); if (d) d.addEventListener("click", function () {
        showPrint('<article class="wi-doc"><h1>' + esc(CONSENT_TITLE) + "</h1><p>" + esc(CONSENT_INTRO) + "</p><section><h2>01 구성 및 위임 동의</h2>" +
          CONSENT.map(function (c) { return "<h3>" + esc(c[0]) + "</h3><p>" + esc(c[1]) + "</p>"; }).join("") + "</section><section><h2>02 개인정보 수집 및 이용</h2>" + consentPrivHtml("wi-priv") + "</section>" +
          '<section><h2>03 확인 및 서명</h2><p class="wi-oath">' + esc(CONSENT_OATH) + '</p></section><p class="wi-to">' + esc(CONSENT_TO) + "</p></article>", "동의서 전문");
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
        "<li>회원이 위임동의서에 네이버 카페 닉네임을 적으면 아래 <b>등업 대기</b>에 나옵니다. 계약서는 홈페이지에서 이미 확인했습니다.</li>" +
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
        '<form class="panel" id="fDues" novalidate><h3>회비 설정 <span class="muted small">운영위원회에서 정한 대로 (회칙 제25조)</span></h3>' +
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
    el("unCsv").addEventListener("click", function () { dl("미납세대.csv", [["세대", "입금"]].concat(unpaidMem.map(function (p) { return [p.unit_id, (byU[p.unit_id] || {}).paid || 0]; }))); });

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
    var TABS = [["pending", "가입 승인"], ["members", "회원"], ["agreements", "위임동의 명단"], ["dues", "회비"], ["petition", "민원 · 투표"], ["visits", "현장 방문"], ["news", "자동 수집"]];
    var TAB_ALIAS = { polls: "petition", campaigns: "petition", photos: "visits" };   // 예전 주소
    var cur = (location.hash || "#pending").slice(1); cur = TAB_ALIAS[cur] || cur; if (!TABS.some(function (t) { return t[0] === cur; })) cur = "pending";
    C.innerHTML = '<div class="tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '<span class="cnt" id="cnt-' + t[0] + '"></span></button>'; }).join("") + "</div>" +
      '<p class="notice-box" id="admMsg" role="status" hidden></p><div id="adminBody"></div>';
    C.querySelector(".tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (!b) return; cur = b.dataset.t; history.replaceState(null, "", "#" + cur); C.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); }); show(); });
    var B = el("adminBody");
    function err(e) { say("admMsg", API.errorText(e), true); }
    function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n"); }
    // 오늘 아침 자동 수집 결과 (collect_runs). 07:13 예약 · 150초 제한
    function collectStatus(runs) {
      if (!runs) return { lv: "none", text: "실행 기록을 보려면 SQL Editor에서 수집 기록 설정(2026-11-13b)을 실행하세요." };
      var kd = function (t) { return new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(0, 10); };
      var now = new Date(), today = kd(now), hm = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
      var c = runs.filter(function (r) { return r.source === "cron" && kd(r.started_at) === today; })[0];
      if (!c) return hm >= "07:20" ? { lv: "bad", text: "오늘 아침 자동 수집 기록이 없습니다. 예약 실행이 되지 않았을 수 있습니다. \"지금 수집\"으로 가져오세요." } : { lv: "none", text: "오늘 자동 수집은 07:13에 실행됩니다." };
      var at = fmtTime(c.started_at);
      if (!c.finished_at) return (now - new Date(c.started_at)) > 180e3 ? { lv: "bad", text: "오늘 아침 자동 수집(" + at + ")이 시간 제한으로 중단됐습니다. \"지금 수집\"으로 다시 가져오세요." } : { lv: "none", text: "자동 수집 진행 중 (" + at + " 시작)" };
      if (!c.ok) return { lv: "bad", text: "오늘 아침 자동 수집(" + at + ")이 실패했습니다: " + arr(c.errors).slice(0, 2).join(" / ") };
      return { lv: "ok", text: "오늘 아침 자동 수집 완료 (" + at + ") · 찾은 소식 " + n(c.found || 0) + "건 · 새로 올린 소식 " + n(c.inserted || 0) + "건" + (arr(c.errors).length ? " · 일부 검색 실패 " + arr(c.errors).length + "건" : "") };
    }
    async function counts() {
      try { var cs = collectStatus(await API.admin.collectRuns()); el("cnt-news").textContent = cs.lv === "bad" ? " !" : ""; } catch (e) {}
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
          var OWNER = await API.admin.ownerUnit().catch(function () { return null; }), meOwner = !!OWNER && API.profile && API.profile.unit_id === OWNER;
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
            '<form class="find" id="mFind"><label for="mQ" class="sr">검색</label><input id="mQ" placeholder="동-호, 카페 닉네임"></form></div><div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>타입</th><th>카페 닉네임</th><th>상태</th><th>위임동의</th><th>가입</th><th></th></tr></thead><tbody id="mList"></tbody></table></div>' +
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
              return okS && (!q || (p.unit_id + ((agOf(p) || {}).cafe_nick || "")).indexOf(q) >= 0);
            }).map(function (p) {
              var ag = agOf(p);
              return '<tr><td class="num">' + esc(p.unit_id) + "</td><td>" + esc((UNIT[p.unit_id] || {}).type || "") + "</td><td>" + esc((agOf(p) || {}).cafe_nick || "-") + "</td><td>" + ({ approved: "승인", pending: "대기", rejected: "반려" })[p.status] + (p.unit_id === OWNER ? " · 최고 관리자" : p.is_admin ? " · 운영진" : "") + "</td><td>" + (ag ? '<span class="tag">' + (ag.source === "paper" ? "서면" : "온라인") + '</span> <span class="num small">' + fmtDate(ag.signed_at) + "</span>" : '<span class="tag off">미제출</span>') + '</td><td class="num">' + fmtDate(p.created_at) + "</td><td>" +
                (p.unit_id === OWNER ? '<span class="muted small">다른 운영진이 바꿀 수 없음</span>' : "") +
                (p.status === "approved" && p.id !== API.session.user.id && p.unit_id !== OWNER ? '<button type="button" class="linkbtn revoke" data-id="' + p.id + '">승인 취소</button>' : "") +
                (p.status === "approved" && p.id !== API.session.user.id && p.unit_id !== OWNER && (meOwner || !OWNER) ? ' <button type="button" class="linkbtn setadm" data-id="' + p.id + '" data-on="' + (p.is_admin ? "0" : "1") + '">' + (p.is_admin ? "운영진 해제" : "운영진 지정") + "</button>" : "") +
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
          var rows = [["세대", "동", "호", "타입", "계약자 성명", "방식", "제출일시", "현황 반영", "휴대전화", "공동명의자", "대표 회원", "문서 번호"]].concat(A.map(function (a) { var u = UNIT[a.unit_id] || {};
            return [a.unit_id, u.dong, u.ho, u.type, a.signer_name || "", how(a), fmtTime(a.signed_at), counted(a) ? "반영" : "승인 전", a.agree_contact ? a.phone || "" : "", a.co_name || "", a.rep_name || "", String(a.doc_hash || "").slice(0, 16)]; }));
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
              '</tbody></table><p class="wi-foot">회칙 제32조에 따라 세대별 성명 · 연락처 등 회원 정보는 외부에 제공하지 않습니다. 세대별 위임장 원문은 협의회가 보관합니다.</p></article>', "기관 제출용 위임 현황");
          });
          el("csvCopy").addEventListener("click", function () { var o = el("csvOut"), b = this; o.value = text; o.hidden = false; try { navigator.clipboard.writeText(text).then(function () { b.textContent = "복사했습니다"; }, function () { o.select(); }); } catch (e) { o.select(); } });
          el("csvDl").addEventListener("click", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })); a.download = "위임동의_" + fmtDate(new Date()).replace(/\./g, "") + ".csv"; document.body.appendChild(a); a.click(); a.remove(); });
        }
        if (cur === "cafe") await adminCafe(B, err, show, csv);
        if (cur === "dues") await adminDues(B, err, show, csv);
        if (cur === "news") {
          var NW = await API.admin.newsAll(), RUNS = await API.admin.collectRuns().catch(function () { return null; }), CS = collectStatus(RUNS);
          el("cnt-news").textContent = CS.lv === "bad" ? " !" : "";
          var runRow = function (r) {
            var st = r.finished_at ? (r.ok ? "완료" : "실패") : ((Date.now() - new Date(r.started_at)) > 180e3 ? "중단" : "진행 중");
            return '<tr><td class="num">' + fmtTime(r.started_at) + "</td><td>" + (r.source === "cron" ? "자동" : "수동") + '</td><td><span class="tag' + (st === "완료" ? "" : " hot") + '">' + st + '</span></td><td class="num r">' + (r.finished_at ? n(r.found || 0) + " / " + n(r.inserted || 0) : "-") + '</td><td class="muted small">' + esc(arr(r.errors).join(" / ").slice(0, 160)) + "</td></tr>";
          };
          B.innerHTML = '<div class="collect-st ' + CS.lv + '" role="status"><b>' + (CS.lv === "ok" ? "✓ " : CS.lv === "bad" ? "⚠ " : "") + esc(CS.text) + "</b>" +
            (RUNS && RUNS.length ? '<details><summary>최근 실행 기록</summary><div class="tablebox"><table class="spec"><thead><tr><th>시각</th><th>방식</th><th>결과</th><th class="r">찾음 / 새로</th><th>메모</th></tr></thead><tbody>' + RUNS.map(runRow).join("") + "</tbody></table></div></details>" : "") +
            "</div>" + '<div class="toolbar"><span class="muted small">매일 07:13에 자동 수집합니다. 실패하면 협의회 메일로 알림이 갑니다. 엉뚱한 기사는 숨기면 사이트에서 빠집니다.</span><button type="button" class="btn solid" id="collectNow">지금 수집</button></div>' +
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
        if (cur === "visits") {
          var VS = await API.visits(), PH = await API.photos(), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
          var catOpts = function (sel) { return API.photoCats.map(function (c) { return "<option" + (c === sel ? " selected" : "") + ">" + c + "</option>"; }).join(""); };
          var warn = '<p class="muted small" style="margin:0 0 10px">사진은 누구나 볼 수 있습니다. <b>사람 얼굴 · 차량 번호판 · 서류</b>가 보이면 올리지 마세요. 올릴 때 자동으로 줄이고(긴 변 1600px) 촬영 위치 정보는 지웁니다. 한 번에 30장까지.</p>';
          B.innerHTML = '<div class="two">' +
            '<form class="panel" id="fVisit" novalidate><h3 style="margin-bottom:10px" id="vHead">현장 방문 기록 쓰기</h3>' +
            '<div class="two" style="gap:12px"><div class="field"><label for="vDate">방문 날짜</label><input id="vDate" type="date" value="' + today + '"></div><div class="field"><label for="vTitle">제목</label><input id="vTitle" maxlength="120" placeholder="예: 11월 정기 현장 방문"></div></div>' +
            '<div class="field"><label for="vBody">내용</label><textarea id="vBody" maxlength="5000" style="min-height:120px" placeholder="확인한 공정, LH 답변, 다음 확인할 것"></textarea></div>' +
            '<div class="field"><label for="vFiles">사진 <span class="muted small">선택 · 여러 장 · 공사현황에 함께 보임</span></label><input id="vFiles" type="file" accept="image/*" multiple></div>' + warn +
            '<p class="cta-row" style="margin:0"><button class="btn solid" type="submit" id="vSave">기록 올리기</button><button class="btn" type="button" id="vCancel" hidden>수정 취소</button></p><input type="hidden" id="vId"></form>' +
            '<div class="panel"><h3 style="margin-bottom:8px">어디에 보이나요?</h3><p class="muted small" style="margin:0">방문 기록과 사진은 <a href="progress.html">우리 단지 › 공사현황</a>의 현장 기록에 날짜순으로 보입니다. 사진관 메뉴는 없어졌고, 예전에 올린 사진은 아래에서 정리할 수 있습니다.</p></div>' + '</div>' +
            head("현장 방문 기록", '<span class="note">' + n(VS.length) + "건</span>") +
            (VS.length ? '<div class="tablebox"><table class="spec"><tbody>' + VS.map(function (v) { return '<tr><td class="num">' + dotDate(v.visited_on) + "</td><td><b>" + esc(v.title) + '</b><br><span class="muted small">' + esc(String(v.body || "").slice(0, 80)) + '</span></td><td class="num">사진 ' + arr(v.photos).length + '장</td><td><button type="button" class="linkbtn editv" data-id="' + v.id + '">수정</button> <button type="button" class="linkbtn delv" data-id="' + v.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("아직 방문 기록이 없습니다", "위 칸에 첫 기록을 남겨 보세요.")) +
            head("올린 사진", '<span class="note">' + n(PH.length) + "장 · 제목을 고치거나 지울 수 있습니다</span>") +
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
        if (cur === "petition") {
          B.innerHTML = '<p class="muted small" style="margin:0 0 14px">민원 페이지(협의회 › 민원)에 보이는 내용을 관리합니다. 도래울역 민원의 문구 · 연락처는 홈페이지 자료 파일(assets/petition-kit.js)에 있고, 여기서는 회원 전용 안내를 고칩니다.</p><div id="admPN"></div><div id="admCP"></div><div id="admPL"></div>';
          var Y = el("admCP");
          var CP = await API.campaigns(), ST = ["의견 모집", "접수 완료", "답변 완료"];
          Y.innerHTML = head("단체민원", '<span class="note">\'의견 모집\' 중인 민원은 민원 페이지 아래에서 위임 세대가 참여합니다</span>') + '<form class="panel" id="fCamp" novalidate><h3 style="margin-bottom:10px">새 단체민원</h3><div class="field"><label for="cT">제목</label><input id="cT" maxlength="120"></div><div class="field"><label for="cTo">대상 기관</label><input id="cTo" maxlength="60" placeholder="예: 고양시, LH 경기북부지역본부"></div><div class="field"><label for="cD">설명</label><textarea id="cD" style="min-height:90px"></textarea></div><button class="btn solid" type="submit">민원 열기</button></form>' +
            head("민원 목록") + (CP.length ? '<div class="tablebox"><table class="spec"><tbody>' + CP.map(function (c) { return "<tr><td>" + esc(c.title) + '</td><td class="num">' + n(c.joined) + '세대</td><td><select class="cst" data-id="' + c.id + '" aria-label="상태">' + ST.map(function (s) { return "<option" + (s === c.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select></td><td><button type="button" class="linkbtn delcamp" data-id="' + c.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("민원이 없습니다", ""));
          el("fCamp").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.admin.createCampaign({ title: el("cT").value, target: el("cTo").value, description: el("cD").value }); show(); } catch (er) { err(er); } });
          Y.querySelectorAll(".cst").forEach(function (s) { s.addEventListener("change", async function () { try { await API.admin.setCampaignStatus(Number(s.dataset.id), s.value); say("admMsg", "상태를 바꿨습니다."); } catch (er) { err(er); } }); });
          Y.querySelectorAll(".delcamp").forEach(function (b) { b.addEventListener("click", async function () { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; } try { await API.admin.deleteCampaign(Number(b.dataset.id)); show(); } catch (er) { err(er); } }); });
          // 메인 '민원 참여'의 회원 전용 안내 (외부 유출 금지 내용)
          var PT = arr(S.petitions).filter(function (x) { return x.privateKey; });
          if (PT.length) {
            var notes = await Promise.all(PT.map(function (x) { return API.privateNote(x.privateKey).catch(function () { return null; }); }));
            el("admPN").insertAdjacentHTML("afterbegin", PT.map(function (x, i) {
              return '<form class="panel pn-form" data-key="' + esc(x.privateKey) + '" novalidate><h3 style="margin-bottom:6px">회원 전용 안내 · ' + esc(x.title) + '</h3>' +
                '<p class="muted small" style="margin:0 0 8px">민원 페이지 맨 위에 승인 회원에게만 보입니다. 안건 정보, 의원 연락처처럼 외부에 나가면 안 되는 내용을 적으세요. 주소 · 전화번호는 자동으로 링크가 됩니다.</p>' +
                '<textarea class="pn-body" rows="10" maxlength="5000">' + esc((notes[i] || {}).body || "") + '</textarea>' +
                '<p class="cta-row" style="margin:8px 0 0"><button class="btn solid" type="submit">저장</button>' + (notes[i] && notes[i].updated_at ? '<span class="muted small">마지막 저장 ' + fmtTime(notes[i].updated_at) + "</span>" : "") + "</p></form>";
            }).join("") + '<div style="height:24px"></div>');
            el("admPN").querySelectorAll(".pn-form").forEach(function (f) { f.addEventListener("submit", async function (ev) { ev.preventDefault();
              try { await API.admin.setPrivateNote(f.dataset.key, f.querySelector(".pn-body").value); say("admMsg", "회원 전용 안내를 저장했습니다."); } catch (er) { err(er); } }); });
          }
        }
        if (cur === "petition") {
          var X = el("admPL");
          var P = await API.polls();
          X.innerHTML = head("투표", '<span class="note">열려 있는 투표는 민원 페이지 아래에 회원에게 보입니다 · 1세대 1표</span>') + '<form class="panel" id="fPoll" novalidate><h3 style="margin-bottom:10px">새 투표</h3><div class="field"><label for="pQ">질문</label><input id="pQ" maxlength="200"></div><div class="field"><label for="pO">선택지 (한 줄에 하나, 2~10개)</label><textarea id="pO" style="min-height:90px"></textarea></div><div class="field"><label for="pE">마감일</label><input id="pE" type="date"></div><button class="btn solid" type="submit">투표 열기</button></form>' +
            head("투표 목록") + (P.length ? '<div class="tablebox"><table class="spec"><tbody>' + P.map(function (p) { var t = p.votes.reduce(function (s, v) { return s + v; }, 0); return "<tr><td>" + esc(p.question) + '</td><td class="num">' + n(t) + "표</td><td>" + (p.closed ? "마감" : fmtDate(p.ends_at) + " 마감") + '</td><td><button type="button" class="linkbtn delpoll" data-id="' + p.id + '">삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : empty("투표가 없습니다", ""));
          el("fPoll").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.admin.createPoll({ question: el("pQ").value, options: el("pO").value.split("\n"), ends: el("pE").value }); show(); } catch (er) { err(er); } });
          X.querySelectorAll(".delpoll").forEach(function (b) { b.addEventListener("click", async function () { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "한 번 더 누르면 삭제"; return; } try { await API.admin.deletePoll(Number(b.dataset.id)); show(); } catch (er) { err(er); } }); });
        }
      } catch (e) { B.innerHTML = ""; err(e); }
    }
    window.addEventListener("hashchange", function () {
      var h = location.hash.slice(1);
      h = TAB_ALIAS[h] || h;
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
