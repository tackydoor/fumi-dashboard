'use strict';

// ITテックニュース（IT 系ニュースサイトと主要紙のテクノロジー面の見出しを新しい順に並べる）
(function (DASH) {
  // 中継サーバー経由の URL（中継サーバーが未設定なら null）
  function relayed(url) {
    const relay = DASH.settings.techNews.relayUrl;
    if (!relay) return null;
    const u = new URL(relay);
    u.searchParams.set('url', url);
    return u.href;
  }

  function enabledFeeds() {
    return DASH.TECH_NEWS_FEEDS
      .filter((f) => DASH.settings.techNews.sources[f.key] !== false)
      .map((f) => ({ url: f.relay ? relayed(f.url) : f.url, source: f.source }))
      .filter((f) => f.url);
  }

  DASH.techNews = DASH.news.createPanel({
    list: '#technews-list',
    status: '#technews-status',
    feeds: enabledFeeds,
    check: () => (enabledFeeds().length ? null : '⚙設定で表示する提供元を選んでください。'),
  });

  // 設定画面での中継サーバーの接続確認用
  DASH.techNews.testRelay = (relayUrl) => {
    const u = new URL(relayUrl);
    u.searchParams.set('url', DASH.TECH_NEWS_FEEDS.find((f) => f.relay).url);
    return DASH.news.test(u.href);
  };
})(window.DASH);
