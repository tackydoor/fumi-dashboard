'use strict';

// 生成AIニュース（主要紙と IT 系ニュースの見出しをキーワードで絞り込む）
(function (DASH) {
  // 全角英数字・大文字小文字・空白の違いを無視して比べる
  function normalize(text) {
    return text.normalize('NFKC').toLowerCase().replace(/\s/g, '');
  }

  function keywords() {
    return DASH.settings.aiNews.keywords.map(normalize).filter(Boolean);
  }

  DASH.aiNews = DASH.news.createPanel({
    list: '#ainews-list',
    status: '#ainews-status',
    feeds: () => [
      ...Object.values(DASH.TECH_SOURCES).map((s) => ({ url: s.url, source: s })),
      ...DASH.news.allGenreFeeds(),
    ],
    check: () => (keywords().length ? null : '⚙設定で絞り込みのキーワードを指定してください。'),
    filter: () => {
      const words = keywords();
      return (title) => {
        const t = normalize(title);
        return words.some((k) => t.includes(k));
      };
    },
  });
})(window.DASH);
