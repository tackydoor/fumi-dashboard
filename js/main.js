'use strict';

// 起動処理
(function (DASH) {
  const { $ } = DASH.util;

  DASH.settings = DASH.util.loadSettings();
  DASH.util.applyTheme();
  DASH.layout.init();

  DASH.clock.start();
  DASH.weather.start();
  DASH.news.start();
  DASH.aiNews.start();
  DASH.techNews.start();
  DASH.secNews.start();
  DASH.market.start();

  $('#btn-settings').addEventListener('click', () => DASH.settingsUI.open());
  $('#btn-layout').addEventListener('click', () => DASH.layout.enter());

  $('#btn-refresh').addEventListener('click', () => {
    DASH.weather.refresh();
    DASH.news.refresh().then(() => { DASH.aiNews.refresh(); DASH.techNews.refresh(); DASH.secNews.refresh(); });
    DASH.market.refresh();
  });

  // ホーム画面から全画面で起動したときは全画面ボタンが不要
  // （起動時点ではページから全画面にはできないので、ここで一致すればアプリとしての起動）
  if (window.matchMedia('(display-mode: fullscreen)').matches) $('#btn-fullscreen').hidden = true;

  $('#btn-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  // ホーム画面に追加できるようにする（http(s) で開いたときだけ。file:// では使えない）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // スリープ復帰やタブ復帰時に古い表示を更新
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000) {
      DASH.weather.refresh();
      DASH.news.refresh().then(() => { DASH.aiNews.refresh(); DASH.techNews.refresh(); DASH.secNews.refresh(); });
    }
  });
})(window.DASH);
