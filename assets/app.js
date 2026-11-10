(function () {
  "use strict";
  var S = window.SITE;
  var main = document.getElementById("main");
  if (!S || !main) return;
  var page = main.dataset.page;
  var API = window.API || { enabled: false };
  var LIVE = API.enabled;
  async function boot() {
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
  var LIVE_AGREED = null;
  function agreedCount() { return LIVE_AGREED != null ? LIVE_AGREED : Object.keys(AGREED).length; }

  /* ── 메뉴 ── */
  var GROUPS = [
    { name: "소식", items: [["notice.html", "공지사항", "notice", "협의회 · LH 안내"], ["schedule.html", "주요일정", "schedule", "청약부터 입주까지"], ["news.html", "언론보도", "news", "S-4 관련 기사"]] },
    { name: "우리 단지", items: [["floorplan.html", "단지 · 평면", "floorplan", "7개 타입과 단지 개요"], ["progress.html", "공사현황", "progress", "공정률과 현장 기록"], ["gallery.html", "사진관", "gallery", "현장과 주변 모습"]] },
    { name: "협의회", items: [["association.html", "협의회 소개", "association", "인사말 · 조직 · 회계"], ["consent.html", "위임동의서", "consent", "공급계약 후 제출"], ["agreement.html", "위임동의 현황판", "agreement", "동·호수별 한눈에"], ["participate.html", "민원 · 투표", "participate", "함께 내는 목소리"]] },
    { name: "커뮤니티", items: [["board.html", "자유게시판", "board", "입주예정자 이야기"], ["links.html", "카페 · 바로가기", "links", "가입 · 인증 안내"]] },
    { name: "입주 준비", items: [["calculator.html", "납부 · 취득세 계산기", "calculator", "회차별 금액"], ["checklist.html", "사전점검", "checklist", "공간별 체크리스트"], ["documents.html", "자료실", "documents", "공고문 · 정리 자료"], ["faq.html", "자주 묻는 질문", "faq", "FAQ"]] }
  ];
  var myGroup = GROUPS.filter(function (g) { return g.items.some(function (x) { return x[2] === page; }); })[0];
  var HEAD = {
    login: ["MEMBERS", "로그인 · 회원가입", "입주예정자 인증을 거친 회원만 위임동의, 게시판, 투표에 참여할 수 있습니다."],
    account: ["MY PAGE", "내 정보", "가입 상태와 위임동의 내역을 확인합니다."],
    consent: ["CONSENT", "위임동의서", "공급계약을 마친 계약자가 제출합니다."],
    privacy: ["PRIVACY", "개인정보처리방침", "협의회가 어떤 정보를 왜 받고, 언제 지우는지 안내합니다."],
    admin: ["ADMIN", "운영진", "가입 승인, 위임동의 명단, 투표 · 민원을 관리합니다."],
    notice: ["NOTICE", "공지사항", "협의회와 LH의 안내입니다."],
    schedule: ["SCHEDULE", "주요 일정", "청약부터 입주까지의 흐름입니다."],
    news: ["MEDIA", "언론보도", "고양창릉 S-4블록 관련 언론 보도입니다."],
    floorplan: ["FLOOR PLAN", "단지 · 평면", "7개 주택형의 공급 정보와 단지 개요입니다. 평면도 원본은 모집공고 첨부를 확인하세요."],
    progress: ["CONSTRUCTION", "공사현황", "공정률과 현장 방문 기록입니다."],
    gallery: ["PHOTO", "우리 단지 사진관", "현장과 주변 모습입니다."],
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
  function cur(x) { return x[2] === page ? ' aria-current="page"' : ""; }
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
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".grp")) closeAll(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var a = document.activeElement; if (a && a.closest && a.closest(".grp")) a.blur(); closeAll(); } });

  /* ── 운영진 알림: 승인 대기 가입 신청 ── */
  if (LIVE && API.isAdmin && page !== "admin") {
    API.admin.profiles("pending").then(function (L) {
      if (!L || !L.length) return;
      var ab = document.createElement("div");
      ab.className = "banner admin-alert";
      ab.setAttribute("role", "status");
      ab.innerHTML = '<div class="wrap"><span><b>운영진 알림</b> · 가입 신청 ' + L.length + '건이 승인을 기다리고 있습니다. <a href="admin.html#pending">확인하기 →</a></span></div>';
      header.after(ab);
      document.title = "(" + L.length + ") " + document.title;
      var al = el("acctLink"); if (al) al.insertAdjacentHTML("beforeend", ' <span class="dot" aria-label="가입 신청 ' + L.length + '건">' + L.length + "</span>");
    }).catch(function () {});
  }

  /* ── banner ── */
  if (S.banner && store("hide:" + S.banner.id) !== new Date().toDateString()) {
    var bn = document.createElement("div");
    bn.className = "banner";
    bn.innerHTML = '<div class="wrap"><span>' + esc(S.banner.text) + (S.banner.link ? ' <a href="' + esc(safeUrl(S.banner.link)) + '">' + esc(S.banner.linkText || "자세히") + " →</a>" : "") + '</span><button type="button" id="bnClose">오늘 하루 보지 않기</button></div>';
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

  /* ── page head ── */
  if (HEAD[page]) {
    var h = HEAD[page], ph = document.createElement("section");
    var sub = myGroup && myGroup.items.length > 1 ? '<nav class="subnav" aria-label="' + myGroup.name + ' 메뉴">' + myGroup.items.map(function (x) { return '<a href="' + x[0] + '"' + cur(x) + ">" + x[1] + "</a>"; }).join("") + "</nav>" : "";
    ph.className = "page-head" + (sub ? "" : " solo");
    ph.innerHTML = '<div class="wrap"><div class="eyebrow">' + (myGroup ? myGroup.name + " · " : "") + h[0] + "</div><h1>" + h[1] + "</h1><p>" + h[2] + "</p>" + sub + "</div>";
    main.insertBefore(ph, main.firstChild);
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
      agreeMeter(true) + progressMeter() +
      '<a class="go" href="agreement.html">동·호수별 현황판 보기 →</a></aside>' +
      "</div>" + ridge + "</section>" +

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
  };

  async function homeNews() {
    if (!LIVE || page !== "home") return;
    try {
      var L = await API.news(null, 4); if (!L.length) return;
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
  function autoRows(list) {
    return '<ul class="list news">' + list.map(function (x) {
      var d = x.published_at ? fmtDate(x.published_at) : "";
      return '<li><span class="src">' + esc(x.source) + '<br><span class="num">' + esc(d) + '</span></span><span class="t"><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a>" +
        '<p><span class="tag' + (x.topic === "S-4" || (x.extra && x.extra.s4) ? " hot" : "") + '">' + esc(x.kind === "lh" ? (x.extra && x.extra.status ? x.extra.status : "LH 공고") : x.topic === "S-4" ? "S-4" : "창릉") + "</span>" + (x.kind === "lh" && x.extra && x.extra.closes ? ' <span class="muted small">마감 ' + esc(x.extra.closes) + "</span>" : "") + "</p>" + (x.kind === "lh" ? '<p class="small"><a href="notice.html">공지사항에서 공고 요약 보기 →</a></p>' : "") + "</span></li>";
    }).join("") + "</ul>";
  }
  R.news = async function () {
    var L = arr(S.news), auto = [];
    if (LIVE) { try { auto = await API.news("news"); } catch (e) { auto = []; } }
    var known = {}; L.forEach(function (x) { known[x.url] = 1; });
    auto = auto.filter(function (x) { return !known[x.url]; });
    C.innerHTML = (LIVE ? "<div>" + head("관련 기사") +
        '<div class="toolbar">' + chips("nwTopic", ["S-4", "창릉"], "주제") + "</div>" +
        (auto.length ? '<div id="nwList">' + autoRows(auto) + "</div>" : empty("아직 관련 기사가 없습니다", "")) + "</div>" : "") +
      "<div>" + head(LIVE ? "주요 보도 (협의회 정리)" : "언론 보도", '<span class="note">' + L.length + "건 · 최신순</span>") + newsRows(L) + "</div>";
    if (LIVE && auto.length) bindChips("nwTopic", function (t) {
      el("nwList").innerHTML = autoRows(t === "전체" ? auto : auto.filter(function (x) { return x.topic === t; }));
    });
  };

  R.floorplan = function () {
    var cnt = {}; UNITS.forEach(function (u) { cnt[u.type] = (cnt[u.type] || 0) + 1; });
    var cards = arr(S.types).map(function (t) {
      return '<div class="ftype"><div class="code">' + esc(t.type) + "</div>" +
        "<dl><dt>전용면적</dt><dd>" + esc(t.area) + "</dd><dt>공급면적</dt><dd>" + Number(t.supply).toFixed(2) + "㎡</dd>" +
        "<dt>최고 분양가</dt><dd>" + eok(t.maxPrice) + "</dd>" + (t.units ? "<dt>공급 세대</dt><dd>" + n(t.units) + "</dd>" : cnt[t.type] ? "<dt>배치표 세대</dt><dd>" + n(cnt[t.type]) + "</dd>" : "") + "</dl></div>";
    }).join("");
    C.innerHTML = "<div>" + head("주택형 7개", '<a class="more" href="https://apply.lh.or.kr" target="_blank" rel="noopener">평면도 원본 (LH 청약플러스) →</a>') + '<div class="ftypes">' + cards + "</div>" +
      '<p class="muted small" style="margin-top:12px">최고 분양가는 모집공고의 주택형별 최고가입니다. 층과 동에 따라 낮아집니다. 공급 세대는 모집공고(LH) 기준입니다.</p></div>' +
      '<div class="two"><div>' + head("면적별 세대수", '<span class="note">모집공고 기준</span>') + areaBars() + "</div><div>" + head("단지 개요") + complexTable(arr(S.complex)) + "</div></div>";
  };

  R.progress = async function () {
    var p = S.progress || {}, M = arr(S.progressMonthly), chart;
    var V = LIVE ? arr(await API.visits().catch(function () { return []; })) : [];
    var logs = V.map(function (v) { return { date: dotDate(v.visited_on), title: v.title, text: v.body, photos: livePhotos(arr(v.photos).sort(function (a, b) { return a.id - b.id; }).map(function (x) { return { id: x.id, cat: "현장 방문", title: v.title, taken_on: v.visited_on, path: x.path, width: x.width, height: x.height }; })) }; })
      .concat(arr(p.logs)).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (M.length) {
      var W = 560, H = 200, pl = 36, pb = 28, pt = 16;
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
    C.innerHTML =
      (g && g.text ? '<div class="greeting"><div class="eyebrow">인사말</div><p class="content">' + esc(g.text) + '</p><p class="muted small">— ' + esc(g.from) + "</p></div>" : "") +
      '<div class="two"><div>' + head("위임동의 현황", more("agreement.html", "동·호수별 현황판")) + agreeMeter() + (LIVE ? '<p class="cta-row" style="margin:0 0 12px">' + (API.loggedIn ? '<a class="btn" href="consent.html">위임동의서 보기</a>' : '<a class="btn solid" href="login.html#signup">회원가입</a>') + "</p>" : "") +
      '<p class="muted">협의회는 법적 권한이 있는 단체가 아닌 자발적 모임입니다. 그래서 위임 세대 수가 곧 대표성입니다. 위임이 모일수록 LH와의 협의에서 목소리가 커집니다.</p></div>' +
      "<div>" + head("위임동의 절차") + '<ol class="steps">' +
      "<li><div><b>공급계약 후 회원가입</b><span>" + esc(consentOpenLabel()) + " 계약이 시작되면 동·호수를 고르고 계약서 첫 장 사진을 올립니다. 동·호수가 아이디가 되며, 한 세대에는 한 계정만 만들 수 있습니다.</span></div></li>" +
      "<li><div><b>운영진 승인</b><span>운영진이 사진으로 세대를 확인합니다. 사진은 확인 후 바로 삭제합니다. 승인되면 게시판을 쓸 수 있습니다.</span></div></li>" +
      '<li><div><b>위임장 · 서명</b><span>가입한 뒤 <a href="consent.html">위임동의서</a>를 읽고 계약자 성명과 서명으로 냅니다. 주민등록번호는 받지 않습니다. 온라인이 어려우면 서면 위임장을 공식 메일로 보내도 됩니다.</span></div></li>' +
      "<li><div><b>현황판 반영 · 참여</b><span>위임동의 현황판에 바로 반영되고, 투표와 단체민원에 참여할 수 있습니다. 언제든 내 정보에서 철회할 수 있습니다.</span></div></li>" +
      "</ol></div></div>" +
      (o.head ? "<div>" + head("조직 구성(안)", '<span class="note">운영진 선출 전</span>') +
        '<div class="org">' + role(o.head, "head") + '<span class="link-line"></span><div class="lvl">' + arr(o.officers).map(function (r) { return role(r); }).join("") + '</div><span class="link-line"></span><div class="lvl">' + arr(o.teams).map(function (r) { return role(r); }).join("") + "</div>" +
        '<span class="link-line"></span><div class="lvl">' + role({ role: "동대표", name: "각 동 1인" }) + "</div></div></div>" : "") +
      "<div>" + head("운영 원칙(안)") + '<div class="three"><div><h3>투명한 운영</h3><p class="muted">회의록과 회계 내역을 공개합니다. 회비는 전체 투표 없이 걷지 않습니다.</p></div>' +
      '<div><h3>현장 중심 활동</h3><p class="muted">정기 현장 방문으로 공정과 품질을 확인하고, 하자 우려 사항을 LH에 공식 전달합니다.</p></div>' +
      '<div><h3>개인정보 최소 수집</h3><p class="muted">위임 증빙에 필요한 동·호수 · 계약자 성명 · 서명만 받고(연락처는 선택), 가입 계약서 사진은 확인 즉시 삭제합니다.</p></div></div></div>' +
      "<div>" + head("회계 공개", ac.asOf ? '<span class="note">' + esc(ac.asOf) + " 기준</span>" : "") +
      (rows.length ? '<div class="tablebox"><table class="spec"><thead><tr><th>날짜</th><th>항목</th><th class="r">수입</th><th class="r">지출</th><th>비고</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="num">' + esc(r.date) + "</td><td>" + esc(r.item) + '</td><td class="r num">' + n(r.in) + '</td><td class="r num">' + n(r.out) + "</td><td>" + esc(r.by) + "</td></tr>"; }).join("") +
        '<tr class="total"><td colspan="2">합계</td><td class="r num">' + n(tin) + '</td><td class="r num">' + n(tout) + "</td><td></td></tr></tbody></table></div>"
        : empty("수입 · 지출 내역이 없습니다", "협의회는 현재 회비를 걷지 않습니다.")) +
      (ac.note ? '<p class="muted small">' + esc(ac.note) + "</p>" : "") + "</div>";
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
  function say(id, msg, bad) { var m = el(id); if (!m) return; m.hidden = !msg; m.textContent = msg || ""; m.classList.toggle("bad", !!bad); }
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
  R.agreement = async function () {
    if (!UNITS.length) { C.innerHTML = empty("배치표가 없습니다", "data.js의 layout에 동별 라인을 넣어주세요."); return; }
    var TYPES = uniq(UNITS.map(function (u) { return u.type; })).sort(), filt = "전체", stats = null, canSee = true, myUnit = null;
    if (LIVE) {
      stats = await API.stats();
      canSee = API.isDelegate || API.isAdmin;
      AGREED = {};
      if (canSee) arr(await API.agreedUnits()).forEach(function (id) { AGREED[id] = 1; });
      myUnit = API.isMember ? API.profile.unit_id : null;
    }
    var sDong = {}; arr(stats).forEach(function (r) { sDong[r.dong] = r; });
    var liveTotal = stats ? stats.reduce(function (s, r) { return s + r.agreed; }, 0) : null;

    C.innerHTML =
      '<div class="ag-summary" id="agSum"></div>' +
      (LIVE && !canSee ? '<div class="notice-box">동별 집계는 누구나 볼 수 있습니다. 세대별 현황은 위임장을 낸 세대에게만 보입니다. ' + (API.loggedIn ? '<a href="consent.html">위임동의서 →</a>' : '<a href="login.html">로그인</a>') + "</div>" : "") +
      (LIVE && API.isMember ? '<div class="notice-box' + (API.hasAgreement ? " good" : "") + '">' + (API.hasAgreement ? "우리 세대(" + esc(unitLabel(myUnit)) + ")는 위임동의를 마쳤습니다." : '우리 세대(' + esc(unitLabel(myUnit)) + ')는 아직 위임동의 전입니다. ' + (API.consentOpen ? '<a href="consent.html">위임동의서 제출 →</a>' : esc(consentOpenLabel()) + " 공급계약 후 제출할 수 있습니다.")) + "</div>" : "") +
      (canSee ? '<div class="toolbar">' + chips("agTypes", TYPES, "타입") +
        '<form class="find" id="agFind" role="search"><label for="agQ" class="small muted">세대 찾기</label><input id="agQ" placeholder="예: 403-1803" autocomplete="off"><button class="btn" type="submit">찾기</button></form></div>' +
        '<div class="legend small"><span><i class="sw on"></i>위임동의 완료</span><span><i class="sw off"></i>미제출</span><span><i class="sw none"></i>필로티 · 비주거</span>' + (myUnit ? '<span><i class="sw mine"></i>우리 세대</span>' : "") + "</div>" : "") +
      '<div class="dongs' + (canSee ? "" : " compact") + '" id="agDongs"></div>' +
      '<div class="panel ag-info" id="agInfo" hidden></div>' +
      (canSee ? "<div>" + head("타입별 현황") + '<div class="tablebox"><table class="spec"><thead><tr><th>타입</th><th class="r">세대</th><th class="r">동의</th><th class="r">동의율</th><th style="width:40%"><span class="sr">막대</span></th></tr></thead><tbody id="agTypeTbl"></tbody></table></div></div>' : "") +
      '<p class="muted small">' + esc(S.layoutNote || "") + " 배치표 집계 " + n(UNITS.length) + "세대, 공고 " + n(T) + "세대.</p>" +
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
        "<small>" + (a >= NEED ? "목표 과반(" + n(NEED) + "세대)을 넘었습니다" : "목표 과반(" + n(NEED) + "세대)까지 " + n(NEED - a) + "세대") + (LIVE ? " · 실시간" : (S.agreementAsOf ? " · " + esc(S.agreementAsOf) + " 기준" : "")) + "</small></div>";

      el("agDongs").innerHTML = arr(S.layout).map(function (d) {
        var st = byDong[d.dong] || [0, 0], dp = pct(st[0], st[1]);
        var top = '<header><h3>' + d.dong + '동</h3><span class="num">' + st[0] + "/" + st[1] + " · " + dp.toFixed(0) + "%</span></header>" + '<div class="mini"><i style="width:' + dp.toFixed(1) + '%"></i></div>';
        if (!canSee) return '<section class="dong" aria-label="' + d.dong + '동">' + top + "</section>";
        var maxF = Math.max.apply(null, d.lines.map(function (l) { return l[2]; })), cells = "";
        for (var f = maxF; f >= 1; f--) {
          cells += '<span class="fl num">' + (f % 5 === 0 || f === 1 ? f : "") + "</span>";
          d.lines.forEach(function (l, li) {
            var ho = f * 100 + li + 1, id = d.dong + "-" + ho, dim = filt !== "전체" && l[0] !== filt;
            if (f < l[1] || f > l[2]) cells += '<span class="c' + (f < l[1] ? " none" : " sky") + (dim ? " dim" : "") + '"></span>';
            else cells += '<button type="button" class="c ' + (AGREED[id] ? "on" : "off") + (id === myUnit ? " mine" : "") + (dim ? " dim" : "") + '" data-id="' + id + '" title="' + d.dong + "동 " + ho + '호" aria-label="' + d.dong + "동 " + ho + "호 " + l[0] + (AGREED[id] ? " 위임동의 완료" : " 미제출") + '"></button>';
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
      b.innerHTML = '<div class="row-info"><b>' + u.dong + "동 " + u.ho + "호</b><span>" + u.type + " · " + u.floor + '층</span><span class="tag' + (AGREED[id] ? "" : " off") + '">' + (AGREED[id] ? "위임동의 완료" : "미제출") + '</span><button type="button" class="linkbtn" id="agInfoClose">닫기</button></div>';
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
          return '<tr data-no="' + b.id + '" data-cat="' + esc(b.cat) + '" tabindex="0"><td class="r num">' + b.id + '</td><td><span class="tag">' + esc(b.cat) + '</span></td><td class="title">' + esc(b.title) + (cc ? ' <span class="muted num">[' + cc + "]</span>" : "") + "</td><td>" + esc(b.author_label) + '</td><td class="r num">' + fmtDate(b.created_at).slice(5) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : empty("아직 게시글이 없습니다", "첫 글을 남겨주세요.")) + "</div>" +
      '<div id="write">' + head("글쓰기", '<span class="note">작성자: ' + esc(API.profile.nickname ? API.profile.nickname + " · " + API.profile.unit_id.split("-")[0] + "동" : API.profile.unit_id.split("-")[0] + "동 입주예정자") + ' · <a href="account.html">닉네임 설정</a></span>') +
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

  R.links = function () {
    var CT = arr(S.contacts);
    C.innerHTML = "<div>" + head("바로가기") + '<div class="tiles">' + arr(S.links).map(tile).join("") + "</div></div>" +
      (CT.length ? "<div>" + head("문의처") + '<div class="tablebox"><table class="spec kv">' + CT.map(function (c) { return "<tr><th>" + esc(c[0]) + '</th><td class="num sel-all">' + esc(c[1]) + "</td></tr>"; }).join("") + "</table></div></div>" : "") +
      '<div class="two"><div>' + (arr(S.links).some(function (l) { return /카페/.test(l.title) && l.url; })
        ? head("공식 카페 가입") + '<ol class="steps">' +
          "<li><div><b>카페 가입</b><span>닉네임은 \"동-호수 끝자리/닉네임\" 형식을 권장합니다. 예: 403-18xx/창릉새집</span></div></li>" +
          '<li><div><b>입주예정자 확인</b><span>입주예정자 확인은 <a href="login.html#signup">이 홈페이지 회원가입</a>으로 합니다. 카페에 계약서를 따로 올리지 않아도 됩니다.</span></div></li>' +
          "<li><div><b>오픈채팅 참여</b><span>공지에 있는 참여 코드로 입장합니다.</span></div></li></ol>"
        : head("입주예정자 확인") + '<p class="muted">입주예정자 확인은 <a href="login.html#signup">이 홈페이지 회원가입</a>으로 합니다. 동·호수를 고르고 계약서 사진을 올리면 운영진이 확인합니다. 공식 카페와 오픈채팅은 개설되면 이곳에 연결합니다.</p>') + "</div>" +
      "<div>" + head("휴대폰 홈 화면에 추가") +
      '<p class="muted"><b class="fg">아이폰(사파리)</b> 하단 공유 버튼을 누르고 "홈 화면에 추가"를 선택합니다.</p>' +
      '<p class="muted"><b class="fg">안드로이드(크롬)</b> 오른쪽 위 메뉴에서 "홈 화면에 추가"를 선택합니다.</p></div></div>';
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
      ["위임동의서", "동 · 호수, 계약자 성명, 서명, 동의 일시, 제3자 제공 동의 여부 (서면 접수 시 위임장 스캔본)", "위임 현황 집계, 관계 기관 협의 시 위임 세대수 증빙", "철회 또는 협의회 해산 시 즉시 파기 (제출 · 철회 기록은 분쟁 대비로 해산 시까지)"],
      ["연락처 (선택)", "휴대전화 번호 (6항에 동의한 세대만)", "협의회 공지 · 긴급 연락", "철회 · 탈퇴 · 협의회 해산 시 즉시 파기"],
      ["게시판 · 투표 · 민원", "작성 글과 댓글, 세대별 투표 · 참여 여부", "커뮤니티 운영, 1세대 1표 집계", "삭제 시 또는 협의회 해산 시까지"]
    ];
    var LB = ["구분", "항목", "목적", "보유 기간"];
    C.innerHTML = "<div>" + head("수집 항목과 보유 기간") + '<div class="tablebox"><table class="spec stack"><thead><tr><th>구분</th><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead><tbody>' +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return '<td data-label="' + LB[i] + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></div>" +
      '<div class="two"><div>' + head("제3자 제공") + '<p class="muted">위임동의서에서 제3자 제공에 동의한 세대에 한해, 한국토지주택공사(LH) · 고양시 · 시공사(요진건설산업)와 협의 · 민원을 할 때 위임 사실 증빙을 위해 동 · 호수, 계약자 성명과 서명이 담긴 위임장, 위임 세대수를 제공할 수 있습니다. 연락처는 제공하지 않습니다. 제공받는 곳은 해당 협의 · 민원 처리가 끝날 때까지 보유합니다. 그 밖에는 제3자에게 제공하지 않습니다.</p>' +
      head("처리 위탁 · 국외 이전") + '<ul class="muted plain-list"><li><b>Supabase Inc.</b> (미국, support@supabase.com) — 회원 정보 · 위임동의 · 게시글 · 계약서 사진 저장과 로그인 처리. 데이터는 서울(대한민국) 리전에 저장되며, 회원가입 · 이용 시 인터넷으로 전송됩니다. 보유 기간은 위 표와 같습니다.</li>' +
      '<li><b>GitHub Inc.</b> (미국) — 홈페이지 호스팅과 LH 공고문 자동 읽기. 회원 개인정보는 다루지 않으며, 접속 기록(IP 등)이 남을 수 있습니다.</li></ul>' +
      '<p class="muted small">위 이전은 서비스 제공에 필요한 처리로, 원하지 않으면 회원가입을 하지 않거나 탈퇴하면 됩니다.</p></div>' +
      "<div>" + head("공개 범위") + '<p class="muted">누구나 볼 수 있는 것은 동별 위임 세대수뿐입니다. 세대별 위임 여부는 승인된 회원과 운영진에게만 보입니다. 게시판 작성자는 "닉네임 · 동"으로만 표시하고 호수는 보여주지 않습니다.</p>' +
      head("권리 행사") + '<p class="muted">위임동의 철회는 내 정보 화면에서 바로 할 수 있습니다. 회원 정보 열람 · 정정 · 삭제(탈퇴)는 운영진에게 요청하면 지체 없이 처리합니다.</p>' +
      head("파기 · 안전 조치") + '<p class="muted">보유 기간이 끝나거나 철회 · 탈퇴하면 데이터베이스에서 즉시 삭제합니다. 비밀번호는 암호화해 저장하고, 계약서 사진은 운영진만 열람할 수 있는 비공개 저장소에 두었다가 확인 즉시 삭제합니다. 로그인 상태 유지를 위해 브라우저 저장소에 로그인 정보를 저장합니다.</p>' +
      head("개인정보 보호책임자") + '<p class="muted">' + esc((S.privacyOfficer && S.privacyOfficer.role) || "협의회 운영진 대표") + (S.privacyOfficer && S.privacyOfficer.contact ? " · " + esc(S.privacyOfficer.contact) : " · 연락처는 공지사항으로 안내합니다") + '</p></div></div>' +
      '<p class="muted small">시행일: ' + esc(S.updated) + ". 내용이 바뀌면 이 페이지와 공지사항으로 알립니다.</p>";
  };

  /* ── 로그인 · 회원가입 ── */
  /* 위임동의 입력칸 (가입 화면 p="c", 위임동의서 화면 p="a") */
  function consentFields(p, withDoc) {
    return '<fieldset class="consent-in"><legend>위임동의서 <span class="tag hot">필수</span></legend>' +
      (withDoc ? '<p class="muted small" style="margin:0 0 8px">입주예정자협의회는 위임한 세대의 뜻을 모아 LH · 시공사와 협의합니다. 가입할 때 함께 제출하며, 운영진 승인 후 위임동의 현황판에 반영됩니다. 철회는 언제든 내 정보에서 할 수 있습니다.</p>' +
        '<details class="terms"><summary>위임동의서 전문 보기</summary><div class="body">' + CONSENT.map(function (c, i) { return "<b>" + (i + 1) + ". " + esc(c[0]) + "</b>\n" + esc(c[1]); }).join("\n\n") + "</div></details>" : "") +
      '<div class="field"><label for="' + p + 'Name">계약자 성명 <span class="muted small">공동명의면 대표자 1명</span></label><input id="' + p + 'Name" maxlength="30" autocomplete="name"></div>' +
      '<div class="field"><label for="' + p + 'Sig">서명 <span class="muted small">손가락이나 마우스로 이름을 쓰듯 서명하세요</span></label>' +
      '<div class="sigpad"><canvas id="' + p + 'Sig" width="600" height="200" aria-label="서명 칸"></canvas><button type="button" class="linkbtn" id="' + p + 'SigClear">지우기</button></div></div>' +
      '<label class="check" for="' + p + 'Del"><input type="checkbox" id="' + p + 'Del"> 1~3항의 위임 내용에 동의합니다 (필수)</label>' +
      '<label class="check" for="' + p + 'Priv"><input type="checkbox" id="' + p + 'Priv"> 4항 개인정보 수집 · 이용에 동의합니다 (필수)</label>' +
      '<label class="check" for="' + p + '3rd"><input type="checkbox" id="' + p + '3rd"> 5항 제3자 제공에 동의합니다 (선택)</label>' +
      '<label class="check" for="' + p + 'Contact"><input type="checkbox" id="' + p + 'Contact"> 6항 연락처 수집 · 이용에 동의합니다 (선택)</label>' +
      '<div class="field" id="' + p + 'PhoneBox" hidden><label for="' + p + 'Phone">휴대전화</label><input id="' + p + 'Phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13"></div>' +
      '<label class="check" for="' + p + 'Id"><input type="checkbox" id="' + p + 'Id"> 본인은 이 세대의 계약자 본인 또는 공동명의자임을 확인합니다 (필수)</label></fieldset>';
  }
  var SIG = {};
  function bindConsent(p) {
    var c = el(p + "Sig"), ctx = c.getContext("2d"), drawing = false, strokes = 0, last = null;
    function pt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
    function clear() { ctx.clearRect(0, 0, c.width, c.height); strokes = 0; }
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a1a1a";
    c.addEventListener("pointerdown", function (e) { e.preventDefault(); drawing = true; last = pt(e); try { c.setPointerCapture(e.pointerId); } catch (er) {} });
    c.addEventListener("pointermove", function (e) { if (!drawing) return; e.preventDefault(); var q = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x, q.y); ctx.stroke(); last = q; strokes++; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { c.addEventListener(t, function () { drawing = false; }); });
    el(p + "SigClear").addEventListener("click", clear);
    el(p + "Contact").addEventListener("change", function () { el(p + "PhoneBox").hidden = !this.checked; });
    SIG[p] = { empty: function () { return strokes < 8; }, data: function () { return strokes < 8 ? null : c.toDataURL("image/png"); } };
  }
  function consentValues(p) {
    return { signer: el(p + "Name").value, signature: SIG[p] ? SIG[p].data() : null, delegation: el(p + "Del").checked, privacy: el(p + "Priv").checked,
      thirdParty: el(p + "3rd").checked, contact: el(p + "Contact").checked, phone: el(p + "Contact").checked ? el(p + "Phone").value : "", identity: el(p + "Id").checked };
  }

  /* 위임장 보기 · 인쇄 (본인 사본 · 운영진 출력 · 빈 서면 양식) */
  function wiDoc(a) {
    var blank = !a;
    var box = function (on) { return '<span class="pbox">' + (on ? "✓" : "") + "</span>"; };
    return '<article class="wi-doc"><h1>고양창릉 S-4블록 입주예정자협의회 위임장</h1>' +
      '<table class="wi-head"><tr><th>세대</th><td>' + (blank ? "_______ 동 _______ 호" : esc(unitLabel(a.unit_id))) + "</td></tr>" +
      "<tr><th>계약자 성명</th><td>" + (blank ? "" : esc(a.signer_name || "")) + "</td></tr>" +
      "<tr><th>휴대전화 (선택)</th><td>" + (blank ? "" : a.agree_contact ? "6항 동의 (연락처는 외부에 제공하지 않음)" : "-") + "</td></tr></table>" +
      CONSENT.map(function (c, i) { return "<section><h2>" + (i + 1) + ". " + esc(c[0]) + "</h2><p>" + esc(c[1]) + "</p></section>"; }).join("") +
      '<ul class="wi-checks"><li>' + box(!blank) + " 1~3항 위임 내용에 동의합니다 (필수)</li><li>" + box(!blank) + " 4항 개인정보 수집 · 이용에 동의합니다 (필수)</li><li>" + box(!blank && a.agree_third_party) + " 5항 제3자 제공에 동의합니다 (선택)</li><li>" + box(!blank && a.agree_contact) + " 6항 연락처 수집 · 이용에 동의합니다 (선택)</li><li>" + box(!blank) + " 본인은 이 세대의 계약자 본인 또는 공동명의자임을 확인합니다 (필수)</li></ul>" +
      '<div class="wi-sign"><div><span class="muted">일시</span> ' + (blank ? "20___ 년 ___ 월 ___ 일" : esc(fmtTime(a.signed_at))) + "</div>" +
      '<div><span class="muted">서명</span> ' + (blank ? '<span class="sigline"></span> (서명 또는 인)' : a.signature ? '<img src="' + esc(a.signature) + '" alt="서명">' : "서면 위임장 원본 보관") + "</div></div>" +
      '<p class="wi-foot">' + (blank ? "작성 후 사진 또는 스캔하여 changneung.s4@gmail.com 으로 보내 주세요. 주민등록번호는 적지 마세요." :
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
      '<table class="spec kv"><tr><th>아이디</th><td class="num">' + esc(p.unit_id) + "</td></tr><tr><th>게시판 표시</th><td>" + esc(p.nickname ? p.nickname + " · " + dongLabel : dongLabel + " 입주예정자") + "</td></tr><tr><th>가입 신청</th><td>" + fmtDate(p.created_at) + "</td></tr>" +
      (p.reviewed_at ? "<tr><th>" + (p.status === "approved" ? "승인일" : "처리일") + "</th><td>" + fmtDate(p.reviewed_at) + "</td></tr>" : "") + "</table>" +
      (p.status === "pending" ? '<p class="notice-box">운영진이 올려주신 사진으로 세대를 확인하고 있습니다. 승인되면 게시판을 이용할 수 있습니다.</p>' : "") +
      (p.status === "rejected" ? '<p class="notice-box bad">반려 사유: ' + esc(p.reject_reason || "-") + "</p>" : "") +
      '<p class="cta-row">' + (API.isAdmin ? '<a class="btn solid" href="admin.html">운영진 페이지</a>' : "") + '<button type="button" class="btn" id="logout">로그아웃</button></p></div>' +

      "<div>" + (p.status !== "rejected" ? head("위임동의") + (ag ? '<div class="panel"><p style="margin-top:0">' + fmtTime(ag.signed_at) + "에 위임동의서를 제출했습니다." + (p.status === "pending" ? " 운영진 승인 후 현황판에 반영됩니다." : "") + '</p><p class="muted small">제3자 제공 동의: ' + (ag.agree_third_party ? "동의" : "동의 안 함") + '</p><p class="cta-row"><a class="btn" href="agreement.html">현황판 보기</a><button type="button" class="btn" id="accWi">내 위임장 보기 · 인쇄</button> <button type="button" class="btn danger" id="withdraw">위임동의 철회</button></p><p class="muted small" style="margin:0">철회하면 현황판에서 바로 빠지고 투표 · 민원 참여와 세대별 현황 보기가 중지됩니다. 게시판은 계속 쓸 수 있고, 위임동의서를 다시 내면 바로 회복됩니다.</p><p class="notice-box" id="aMsg" role="status" hidden></p></div>'
        : delegateNote(true)) : "") +
      (p.status === "rejected" ? head("계약서 사진 다시 내기") + '<form class="panel" id="fRe" novalidate>' +
        '<div class="field"><label for="rFile">계약서 사진 <span class="muted small">첫 장 · 주민등록번호는 가리세요</span></label><input id="rFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required></div>' +
        '<button class="btn solid" type="submit">재신청</button><p class="notice-box" id="rMsg" role="alert" hidden></p>' +
        '<p class="muted small" style="margin:10px 0 0">세대를 잘못 골랐다면 운영진에게 계정 삭제를 요청한 뒤 맞는 세대로 다시 가입하세요.</p></form>' : "") +
      "</div></div>" +

      '<div class="two"><form class="panel" id="fNick" novalidate><h3 style="margin-bottom:10px">게시판 닉네임 <span class="muted small">선택</span></h3><div class="field"><label for="nNick">닉네임 <span class="muted small">비워 두면 "' + esc(dongLabel) + ' 입주예정자"로 표시</span></label><input id="nNick" maxlength="20" value="' + esc(p.nickname || "") + '"></div><button class="btn" type="submit">저장</button><p class="notice-box" id="nMsg" role="status" hidden></p></form>' +
      '<form class="panel" id="fPw" novalidate><h3 style="margin-bottom:10px">비밀번호 바꾸기</h3><div class="field"><label for="pPw">새 비밀번호</label><input id="pPw" type="password" autocomplete="new-password"></div><div class="field"><label for="pPw2">새 비밀번호 확인</label><input id="pPw2" type="password" autocomplete="new-password"></div><button class="btn" type="submit">변경</button><p class="notice-box" id="pMsg2" role="status" hidden></p></form></div>';
    el("logout").addEventListener("click", async function () { await API.signOut(); location.href = "index.html"; });
    if (el("accWi") && ag) el("accWi").addEventListener("click", function () { showPrint(wiDoc(ag), "내 위임장"); });
    if (el("withdraw")) el("withdraw").addEventListener("click", async function () {
      var btn = this;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "한 번 더 누르면 철회 (투표 · 민원 참여 중지)"; return; }
      busy(btn, true); try { await API.withdrawAgreement(); await R.account(); } catch (err) { busy(btn, false); say("aMsg", API.errorText(err), true); }
    });
    if (el("fRe")) el("fRe").addEventListener("submit", async function (e) {
      e.preventDefault(); var btn = this.querySelector("button"); busy(btn, true);
      try { await API.reapply({ file: el("rFile").files[0] }); await R.account(); } catch (err) { busy(btn, false); say("rMsg", API.errorText(err), true); }
    });
    el("fNick").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.updateNickname(el("nNick").value); await R.account(); say("nMsg", "저장했습니다."); } catch (err) { say("nMsg", API.errorText(err), true); } });
    el("fPw").addEventListener("submit", async function (e) { e.preventDefault(); try { await API.changePassword(el("pPw").value, el("pPw2").value); el("pPw").value = el("pPw2").value = ""; say("pMsg2", "비밀번호를 바꿨습니다."); } catch (err) { say("pMsg2", API.errorText(err), true); } });
  };

  /* ── 위임동의서 ── */
  var CONSENT = [
    ["위임 범위", "본인은 고양창릉 S-4블록 공공분양주택의 계약자(입주예정자)로서, 이 세대를 대표하여 아래 사항을 고양창릉 S-4블록 입주예정자협의회에 위임합니다. 위임한 세대는 협의회의 투표와 단체민원에 참여합니다.\n1. LH · 시공사 · 관계 기관과의 협의와 의견 전달 (공사 품질, 하자, 설계 변경, 입주 일정 등)\n2. 입주예정자 공동의 이익을 위한 민원 제기와 정보공개 청구\n3. 사전점검 · 입주 과정의 공동 대응\n4. 중도금 집단대출 등 입주 관련 금융기관 협의 (추진하는 경우)\n5. 입주 관련 공동구매 추진 (추진하는 경우 · 실제 구매 여부는 세대별로 선택)"],
    ["위임하지 않는 사항", "개인의 계약 체결 · 변경 · 해지, 분양대금 납부, 개별 재산권의 처분, 소송 등 개인의 권리 · 의무에 관한 사항은 위임하지 않습니다. 소송이 필요하면 따로 위임을 받습니다.\n현재 회비는 걷지 않습니다. 회비를 걷게 되면 금액과 사용처를 공개하고 별도로 동의를 받습니다."],
    ["위임 기간 · 철회", "동의한 날부터 입주자대표회의가 구성될 때까지 유효합니다. 언제든지 내 정보 화면(서면 위임은 공식 메일)에서 철회할 수 있으며, 철회하면 현황판에서 즉시 빠지고, 투표 · 단체민원 참여와 세대별 현황 보기가 중지됩니다(게시판은 계속 이용). 다시 동의하면 바로 회복됩니다.\n철회 전에 이미 관계 기관에 제출된 협의 · 민원 자료의 위임 세대수는 바뀌지 않습니다."],
    ["개인정보 수집 · 이용 (필수)", "수집 항목: 동 · 호수, 계약자 성명, 서명, 동의 일시 (서면 접수 시 위임장 스캔본)\n목적: 위임 사실 확인 · 증빙, 위임 현황 집계\n보유 기간: 철회 또는 협의회 해산 시 즉시 파기\n동의를 거부할 수 있으나, 이 경우 위임동의서를 낼 수 없습니다. (가입 회원으로 게시판은 이용할 수 있습니다)"],
    ["제3자 제공 (선택)", "제공받는 자: 한국토지주택공사(LH), 고양시, 시공사(요진건설산업)\n목적: 협의 · 민원 시 위임 사실 증빙\n항목: 위임한 세대의 동 · 호수, 계약자 성명과 서명이 담긴 위임장, 위임 세대수 (연락처는 제공하지 않습니다)\n제공받는 자의 보유 기간: 해당 협의 · 민원 처리가 끝날 때까지\n동의하지 않아도 위임은 유효하며, 이 세대는 세대수 집계에만 포함되고 위임장은 제출하지 않습니다."],
    ["연락처 수집 · 이용 (선택)", "수집 항목: 휴대전화 번호\n목적: 협의회 공지와 긴급 연락 (사전점검 · 입주 일정 등)\n보유 기간: 철회 · 탈퇴 · 협의회 해산 시 즉시 파기\n동의하지 않아도 위임에는 영향이 없습니다."]
  ];

  R.consent = async function () {
    var form = '<article class="consent-doc"><h2>고양창릉 S-4블록 입주예정자협의회 위임동의서</h2><p class="muted small">양식 버전 ' + esc(API.formVersion || "2026-11-v1") + "</p>" +
      CONSENT.map(function (c, i) { return "<section><h3>" + (i + 1) + ". " + esc(c[0]) + '</h3><p class="body">' + esc(c[1]) + "</p></section>"; }).join("") + "</article>" +
      '<div class="panel paper-box"><b>온라인이 어려우신가요?</b><p class="muted small" style="margin:6px 0 10px">공급계약을 마친 뒤 서면 위임장 양식을 인쇄해 작성 · 서명하고, 사진이나 스캔본을 협의회 공식 메일 <b>changneung.s4@gmail.com</b> 으로 보내 주세요. 운영진이 확인해 등록합니다. 주민등록번호는 적지 마세요.</p><button type="button" class="btn" id="blankForm">서면 양식 인쇄 · PDF 저장</button></div>';
    function bindBlank() { var b = el("blankForm"); if (b) b.addEventListener("click", window.S4_showBlankForm); }
    if (!LIVE) { C.innerHTML = '<div class="two consent-grid"><div>' + form + "</div><div>" + gate("member") + "</div></div>"; bindBlank(); return; }
    var pf = API.profile, g = !API.loggedIn || !pf || pf.status === "rejected" ? gate("member") : "";
    if (g) { C.innerHTML = '<div class="two consent-grid"><div>' + form + "</div><div>" + g + "</div></div>"; bindBlank(); return; }
    var ag = await API.myAgreement(), p = API.profile;
    if (!ag && !API.consentOpen) { C.innerHTML = '<div class="two consent-grid"><div>' + form + "</div><div>" + delegateNote(true) + "</div></div>"; bindBlank(); return; }
    var side = ag
      ? '<div class="panel done"><div class="eyebrow">제출 완료</div><h3>' + esc(unitLabel(p.unit_id)) + '</h3><p>' + fmtTime(ag.signed_at) + ' 제출</p><p class="muted small">' + (p.status === "approved" ? "위임동의 현황판에 반영되었습니다." : "운영진이 가입을 승인하면 위임동의 현황판에 반영됩니다.") +  ' 철회는 내 정보에서 할 수 있습니다.</p><p class="cta-row"><button type="button" class="btn solid" id="myWi">내 위임장 보기 · 인쇄</button><a class="btn" href="agreement.html">현황판 보기</a><a class="btn" href="account.html">내 정보</a></p></div>'
      : '<form class="panel" id="fAg" novalidate><div class="eyebrow">제출 세대</div><h3 style="margin:4px 0 14px">' + esc(unitLabel(p.unit_id)) + "</h3>" + consentFields("a", false) +
        '<button class="btn solid wide" type="submit">위임동의서 제출</button><p class="notice-box" id="aMsg" role="alert" hidden></p>' +
        '<p class="muted small" style="margin:10px 0 0">제출 일시 · 세대 · 문서 번호는 서버가 기록합니다. 제출 후 내 위임장을 PDF로 저장할 수 있습니다.</p></form>';
    C.innerHTML = '<div class="two consent-grid"><div>' + form + "</div><div>" + side + "</div></div>";
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
  R.admin = async function () {
    if (!LIVE || !API.loggedIn) { C.innerHTML = gate("login"); return; }
    if (!API.isAdmin) { C.innerHTML = empty("운영진만 볼 수 있습니다", ""); return; }
    var TABS = [["pending", "가입 승인"], ["members", "회원"], ["agreements", "위임동의 명단"], ["polls", "투표"], ["campaigns", "민원"], ["photos", "사진 · 방문"], ["news", "자동 수집"]];
    var cur = (location.hash || "#pending").slice(1); if (!TABS.some(function (t) { return t[0] === cur; })) cur = "pending";
    C.innerHTML = '<div class="tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '<span class="cnt" id="cnt-' + t[0] + '"></span></button>'; }).join("") + "</div>" +
      '<div id="adminBody"></div><p class="notice-box" id="admMsg" role="status" hidden></p>';
    C.querySelector(".tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-t]"); if (!b) return; cur = b.dataset.t; history.replaceState(null, "", "#" + cur); C.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); }); show(); });
    var B = el("adminBody");
    function err(e) { say("admMsg", API.errorText(e), true); }
    function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n"); }
    async function counts() { try { var pd = await API.admin.profiles("pending"); el("cnt-pending").textContent = pd.length ? " " + pd.length : ""; } catch (e) {} }

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
          var M = await API.admin.profiles(), O = await API.admin.orphans(), q = "";
          B.innerHTML = '<div class="toolbar"><div class="chips" id="mSt"><button type="button" class="chip" data-s="" aria-pressed="true">전체 ' + M.length + '</button><button type="button" class="chip" data-s="approved" aria-pressed="false">승인</button><button type="button" class="chip" data-s="pending" aria-pressed="false">대기</button><button type="button" class="chip" data-s="rejected" aria-pressed="false">반려</button></div>' +
            '<form class="find" id="mFind"><label for="mQ" class="sr">검색</label><input id="mQ" placeholder="동-호, 닉네임"></form></div><div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>타입</th><th>닉네임</th><th>상태</th><th>가입</th><th></th></tr></thead><tbody id="mList"></tbody></table></div>' +
            head("가입 · 승인 기록", '<span class="note">최근 100건 · 지우지 않고 보관</span>') + '<div class="tablebox"><table class="spec"><tbody id="mLog"><tr><td class="muted">불러오는 중…</td></tr></tbody></table></div>' +
            (O.length ? head("가입 중단 계정", '<span class="note">계정만 있고 계약서 사진이 없는 세대</span>') + '<div class="tablebox"><table class="spec"><tbody>' + O.map(function (o) { return '<tr><td class="num">' + esc(o.unit_id) + '</td><td class="num">' + fmtTime(o.created_at) + '</td><td><button type="button" class="linkbtn delorphan" data-id="' + o.id + '">계정 삭제</button></td></tr>'; }).join("") + "</tbody></table></div>" : "");
          var sf = "", WHO = {}; M.forEach(function (p) { WHO[p.id] = p.unit_id; });
          var ACT = { signup: "가입 신청", approve: "승인", reject: "반려", reapply: "재신청", revoke: "승인 취소", admin_on: "운영진 지정", admin_off: "운영진 해제", "delete": "계정 삭제" };
          API.admin.memberLog().then(function (L) {
            el("mLog").innerHTML = L.slice(0, 100).map(function (x) {
              var by = !x.by_user ? "시스템" : x.by_user === x.profile_id ? "본인" : "운영진 " + (WHO[x.by_user] || "");
              return '<tr><td class="num">' + fmtTime(x.at) + '</td><td class="num">' + esc(x.unit_id) + "</td><td>" + esc(ACT[x.action] || x.action) + (x.note ? ' <span class="muted small">(' + esc(x.note) + ")</span>" : "") + '</td><td class="muted small">' + esc(by) + "</td></tr>";
            }).join("") || '<tr><td class="muted">기록이 없습니다.</td></tr>';
          }).catch(function (e) { el("mLog").innerHTML = '<tr><td class="muted">기록을 불러오지 못했습니다.</td></tr>'; });
          function draw() {
            el("mList").innerHTML = M.filter(function (p) { return (!sf || p.status === sf) && (!q || (p.unit_id + (p.nickname || "")).indexOf(q) >= 0); }).map(function (p) {
              return '<tr><td class="num">' + esc(p.unit_id) + "</td><td>" + esc((UNIT[p.unit_id] || {}).type || "") + "</td><td>" + esc(p.nickname || "-") + "</td><td>" + ({ approved: "승인", pending: "대기", rejected: "반려" })[p.status] + (p.is_admin ? " · 운영진" : "") + '</td><td class="num">' + fmtDate(p.created_at) + "</td><td>" +
                (p.status === "approved" && p.id !== API.session.user.id ? '<button type="button" class="linkbtn revoke" data-id="' + p.id + '">승인 취소</button>' : "") +
                (p.status === "approved" && p.id !== API.session.user.id ? ' <button type="button" class="linkbtn setadm" data-id="' + p.id + '" data-on="' + (p.is_admin ? "0" : "1") + '">' + (p.is_admin ? "운영진 해제" : "운영진 지정") + "</button>" : "") +
                (!p.is_admin && p.id !== API.session.user.id ? ' <button type="button" class="linkbtn delacct" data-id="' + p.id + '">계정 삭제</button>' : "") + "</td></tr>";
            }).join("") || '<tr><td colspan="6" class="muted">해당하는 회원이 없습니다.</td></tr>';
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
          var A = await API.admin.agreements(), lg = await API.admin.log(), PS = {};
          try { arr(await API.admin.profiles()).forEach(function (p) { PS[p.id] = p.status; }); } catch (e) {}
          var counted = function (a) { return a.source === "paper" || PS[a.user_id] === "approved"; };
          var how = function (a) { return a.source === "paper" ? "서면" : "온라인"; };
          var rows = [["세대", "동", "호", "타입", "계약자 성명", "방식", "제출일시", "현황 반영", "제3자 제공", "연락처(동의 세대)", "문서 번호"]].concat(A.map(function (a) { var u = UNIT[a.unit_id] || {};
            return [a.unit_id, u.dong, u.ho, u.type, a.signer_name || "", how(a), fmtTime(a.signed_at), counted(a) ? "반영" : "승인 전", a.agree_third_party ? "동의" : "미동의", a.agree_contact ? a.phone || "" : "", String(a.doc_hash || "").slice(0, 16)]; }));
          var text = csv(rows), OK3 = A.filter(function (a) { return counted(a) && a.agree_third_party; });
          B.innerHTML = '<div class="toolbar"><b>' + n(A.filter(counted).length) + "세대 반영</b> <span class=\"muted small\">(제출 " + n(A.length) + "세대 · 서면 " + n(A.filter(function (a) { return a.source === "paper"; }).length) + ')</span>' +
            '<div class="cta-row" style="margin:0"><button type="button" class="btn" id="wiAll">기관 제출용 위임장 출력 (' + OK3.length + ')</button><button type="button" class="btn" id="csvCopy">CSV 복사</button><button type="button" class="btn" id="csvDl">CSV 내려받기</button></div></div>' +
            '<details class="panel lh-more" id="paperBox"><summary>서면 위임장 등록 <span class="muted small">공식 메일로 받은 위임장</span></summary><form id="fPaper" novalidate style="margin-top:12px">' + unitPicker("pp") +
            '<div class="two" style="gap:12px"><div class="field"><label for="ppName">계약자 성명</label><input id="ppName" maxlength="30"></div><div class="field"><label for="ppDate">서명일</label><input id="ppDate" type="date"></div></div>' +
            '<div class="field"><label for="ppFile">위임장 스캔본 <span class="muted small">사진 · PDF, 10MB 이하 · 주민등록번호가 보이면 등록하지 말고 다시 받으세요</span></label><input id="ppFile" type="file" accept="image/*,application/pdf"></div>' +
            '<label class="check"><input type="checkbox" id="pp3rd"> 위임장에 5항 제3자 제공 동의 표시가 있음</label><label class="check"><input type="checkbox" id="ppContact"> 위임장에 6항 연락처 동의 표시가 있음</label>' +
            '<div class="field" id="ppPhoneBox" hidden><label for="ppPhone">휴대전화</label><input id="ppPhone" inputmode="tel" placeholder="010-0000-0000" maxlength="13"></div>' +
            '<button class="btn solid" type="submit">서면 위임장 등록</button></form></details>' +
            '<div class="tablebox"><table class="spec"><thead><tr><th>세대</th><th>성명</th><th>방식</th><th>제출</th><th>제3자</th><th>연락처</th><th></th></tr></thead><tbody id="agList">' +
            (A.map(function (a) { var u = UNIT[a.unit_id] || {};
              return '<tr' + (counted(a) ? "" : ' class="muted"') + '><td class="num">' + esc(a.unit_id) + ' <span class="muted small">' + esc(u.type || "") + "</span></td><td>" + esc(a.signer_name || "-") + "</td><td>" + how(a) + (counted(a) ? "" : " · 승인 전") + '</td><td class="num">' + fmtTime(a.signed_at) + "</td><td>" + (a.agree_third_party ? "동의" : "-") + '</td><td class="num">' + (a.agree_contact ? esc(a.phone || "") : "-") + "</td><td>" +
                '<button type="button" class="linkbtn wiOne" data-u="' + esc(a.unit_id) + '">위임장</button>' + (a.paper_path ? ' <button type="button" class="linkbtn paperView" data-u="' + esc(a.unit_id) + '">원본</button>' : "") +
                (a.source === "paper" ? ' <button type="button" class="linkbtn paperDel" data-u="' + esc(a.unit_id) + '">서면 철회</button>' : "") + "</td></tr>"; }).join("") || '<tr><td colspan="7" class="muted">아직 제출된 위임동의서가 없습니다.</td></tr>') +
            "</tbody></table></div>" + head("최근 기록") + '<div class="tablebox"><table class="spec"><tbody>' + (lg.slice(0, 50).map(function (x) { return '<tr><td class="num">' + fmtTime(x.at) + '</td><td class="num">' + esc(x.unit_id) + "</td><td>" + (x.action === "sign" ? "제출" : "철회") + '</td><td class="muted small">' + (!x.by_user ? "시스템" : x.by_user === x.user_id ? "본인" : "운영진") + "</td></tr>"; }).join("") || '<tr><td class="muted">기록이 없습니다.</td></tr>') + "</tbody></table></div>" +
            '<textarea class="out" id="csvOut" readonly hidden aria-label="CSV"></textarea>';
          var byU = {}; A.forEach(function (a) { byU[a.unit_id] = a; });
          bindUnitPicker("pp");
          el("ppContact").addEventListener("change", function () { el("ppPhoneBox").hidden = !this.checked; });
          el("fPaper").addEventListener("submit", async function (e) {
            e.preventDefault(); var b = this.querySelector("button[type=submit]"); busy(b, true, "등록 중…");
            try { await API.admin.registerPaper({ unit: el("ppHo").value, signer: el("ppName").value, signedOn: el("ppDate").value, file: el("ppFile").files[0], thirdParty: el("pp3rd").checked, contact: el("ppContact").checked, phone: el("ppPhone").value });
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
          el("wiAll").addEventListener("click", function () {
            if (!OK3.length) { say("admMsg", "제3자 제공에 동의한 세대가 없습니다."); return; }
            showPrint('<article class="wi-doc wi-list"><h1>고양창릉 S-4블록 입주예정자협의회 위임 세대 명단</h1><p class="muted">위임 반영 ' + n(A.filter(counted).length) + "세대 중 제3자 제공 동의 " + n(OK3.length) + "세대 · 출력 " + esc(fmtTime(new Date().toISOString())) + "</p>" +
              '<table><thead><tr><th>세대</th><th>계약자</th><th>서명</th><th>일시</th><th>방식</th></tr></thead><tbody>' + OK3.map(function (a) {
                return "<tr><td>" + esc(unitLabel(a.unit_id)) + "</td><td>" + esc(a.signer_name || "") + "</td><td>" + (a.signature ? '<img src="' + esc(a.signature) + '" alt="서명">' : "서면 원본") + "</td><td>" + esc(fmtTime(a.signed_at)) + "</td><td>" + how(a) + "</td></tr>"; }).join("") +
              '</tbody></table><p class="wi-foot">연락처는 포함하지 않습니다. 세대별 위임장 원문은 협의회가 보관합니다.</p></article>', "기관 제출용 위임 세대 명단");
          });
          el("csvCopy").addEventListener("click", function () { var o = el("csvOut"), b = this; o.value = text; o.hidden = false; try { navigator.clipboard.writeText(text).then(function () { b.textContent = "복사했습니다"; }, function () { o.select(); }); } catch (e) { o.select(); } });
          el("csvDl").addEventListener("click", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })); a.download = "위임동의_" + fmtDate(new Date()).replace(/\./g, "") + ".csv"; document.body.appendChild(a); a.click(); a.remove(); });
        }
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
            try { var res = await API.admin.collectNow(); await show(); say("admMsg", "찾은 소식 " + res.found + "건, 새로 올린 소식 " + res.inserted + "건" + (res.errors && res.errors.length ? " · 일부 실패: " + res.errors.join(" / ") : "")); }
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
  if (["home", "progress"].indexOf(page) >= 0 && location.protocol !== "file:") {
    try {
      var lr = await fetch("assets/lh-progress.json?h=" + Math.floor(Date.now() / 600000), { cache: "no-cache" });
      if (lr.ok) LHP = await lr.json();
    } catch (e) { LHP = null; }
    if (LHP && LHP.info && LHP.info.rate != null) {
      var rp = arr(LHP.reports), last = rp[0];
      S.progress = Object.assign({}, S.progress, { overall: LHP.info.rate, asOf: "LH 공사진행현황 " + (last ? last.date : "") + " 기준" });
      var byYm = {};
      rp.slice().reverse().forEach(function (r) { if (typeof r.rate === "number") byYm[r.date.slice(0, 7)] = r.rate; });
      var ms = Object.keys(byYm).sort().map(function (k) { return { ym: k, rate: byYm[k] }; });
      if (ms.length) S.progressMonthly = ms;
    }
  }
  if (LIVE && ["home", "association"].indexOf(page) >= 0) {
    try { var sts = await API.stats(); LIVE_AGREED = sts.reduce(function (s, r) { return s + r.agreed; }, 0); } catch (e) { LIVE_AGREED = null; }
  }
  if (R[page]) {
    try { await R[page](); if (page === "home") await homeNews(); }
    catch (e) { if (C) C.innerHTML = '<div class="notice-box">' + esc(API.errorText ? API.errorText(e) : e.message) + "</div>"; }
  }
  }
  boot();
})();
