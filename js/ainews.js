'use strict';

// 生成AIニュース（主要紙と IT 系ニュースの見出しをキーワードで絞り込む）
(function (DASH) {
  DASH.aiNews = DASH.news.createPanel({
    list: '#ainews-list',
    status: '#ainews-status',
    feeds: () => [
      ...Object.values(DASH.TECH_SOURCES).map((s) => ({ url: s.url, source: s })),
      ...DASH.news.allGenreFeeds(),
    ],
    check: () => (DASH.news.keywordFilter(DASH.settings.aiNews.keywords) ? null : '⚙設定で絞り込みのキーワードを指定してください。'),
    filter: () => DASH.news.keywordFilter(DASH.settings.aiNews.keywords),
  });
})(window.DASH);
