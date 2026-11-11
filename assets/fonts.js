/* 웹글꼴을 화면 그리기를 막지 않고 불러옴 (글꼴이 오기 전에는 기본 글꼴로 먼저 보임) */
(function () {
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=IBM+Plex+Sans+KR:wght@400;700&family=IBM+Plex+Mono:wght@500&display=swap";
  document.head.appendChild(l);
})();
