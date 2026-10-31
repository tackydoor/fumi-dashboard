'use strict';

// ITセキュリティニュース（セキュリティ専門サイトの記事と、主要紙・IT 系ニュースのうちキーワードを含む見出しを新しい順に並べる）
(function (DASH) {
  function keywordFeeds() {
    if (!DASH.news.keywordFilter(DASH.settings.secNews.keywords)) return [];
    return [
      ...Object.values(DASH.TECH_SOURCES).map((s) => ({ url: s.url, source: s })),
      ...DASH.news.allGenreFeeds(),
    ];
  }

  function feeds() {
    return [...DASH.news.pickFeeds(DASH.SECURITY_NEWS_FEEDS, DASH.settings.secNews.sources), ...keywordFeeds()];
  }

  DASH.secNews = DASH.news.createPanel({
    list: '#secnews-list',
    status: '#secnews-status',
    feeds,
    check: () => (feeds().length ? null : '⚙設定で表示する提供元かキーワードを指定してください。'),
    filter: () => DASH.news.keywordFilter(DASH.settings.secNews.keywords),
    // 一般紙の記事が多い日でも専門サイトの記事が埋もれないよう、提供元ごとの件数を抑える
    perSource: 3,
  });
})(window.DASH);
