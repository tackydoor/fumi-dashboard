'use strict';

// 生成AIニュース（主要紙と IT 系ニュースの見出しをキーワードで絞り込む）
(function (DASH) {
  const { $, hhmm } = DASH.util;
  let timer = null;
  let renderSeq = 0;

  // 全角英数字・大文字小文字・空白の違いを無視して比べる
  function normalize(text) {
    return text.normalize('NFKC').toLowerCase().replace(/\s/g, '');
  }

  function feeds() {
    const it = Object.values(DASH.AI_NEWS_SOURCES).map((s) => ({ url: s.url, source: s }));
    return [...it, ...DASH.news.allGenreFeeds()];
  }

  async function render() {
    const list = $('#ainews-list');
    const status = $('#ainews-status');
    const keywords = DASH.settings.aiNews.keywords.map(normalize).filter(Boolean);
    if (!keywords.length) {
      list.innerHTML = '<li class="empty">⚙設定で絞り込みのキーワードを指定してください。</li>';
      status.textContent = '';
      return;
    }
    const seq = ++renderSeq;
    if (!list.children.length) list.innerHTML = '<li class="empty">読み込み中…</li>';

    const { items, failed, total } = await DASH.news.collect(feeds(), (title) => {
      const t = normalize(title);
      return keywords.some((k) => t.includes(k));
    });
    if (seq !== renderSeq) return;

    list.innerHTML = items.length
      ? DASH.news.itemsHtml(items)
      : '<li class="empty">' + (failed === total ? 'ニュースを取得できませんでした。' : '該当する記事がありません。') + '</li>';
    status.textContent = '更新 ' + hhmm(new Date()) + (failed ? '（' + failed + '件のフィードを取得できませんでした）' : '');
  }

  DASH.aiNews = {
    start() {
      clearInterval(timer);
      render();
      timer = setInterval(render, DASH.REFRESH.newsMs);
    },

    refresh: render,
  };
})(window.DASH);
