'use strict';

// ITテックニュース（IT 系ニュースサイトと主要紙のテクノロジー面の見出しを新しい順に並べる）
(function (DASH) {
  function feeds() {
    return DASH.news.pickFeeds(DASH.TECH_NEWS_FEEDS, DASH.settings.techNews.sources);
  }

  DASH.techNews = DASH.news.createPanel({
    list: '#technews-list',
    status: '#technews-status',
    feeds,
    check: () => (feeds().length ? null : '⚙設定で表示する提供元を選んでください。'),
  });
})(window.DASH);
