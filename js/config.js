'use strict';

// 定数と初期設定
window.DASH = window.DASH || {};

(function (DASH) {
  const WOR = 'https://assets.wor.jp/rss/rdf/';

  // ニュース提供元（CORS で直接取得できるフィード）
  DASH.NEWS_SOURCES = {
    nikkei: { name: '日経', className: 'src-nikkei' },
    yomiuri: { name: '読売', className: 'src-yomiuri' },
    sankei: { name: '産経', className: 'src-sankei' },
    cnn: { name: 'CNN', className: 'src-cnn' },
  };

  // 生成AIニュースと ITテックニュースで使う IT 系の提供元
  DASH.TECH_SOURCES = {
    cnet: { name: 'CNET', className: 'src-cnet', url: 'https://feeds.japan.cnet.com/rss/cnet/all.rdf' },
    zdnet: { name: 'ZDNET', className: 'src-zdnet', url: 'https://feeds.japan.zdnet.com/rss/zdnet/all.rdf' },
    wired: { name: 'WIRED', className: 'src-wired', url: 'https://wired.jp/feed/rss' },
  };

  // ITテックニュースのフィード（key は設定での選択に使う）
  // relay: CORS に対応していないため、設定した中継サーバー（relay/cloudflare-worker.js）経由で取得する
  DASH.TECH_NEWS_FEEDS = [
    { key: 'cnet', label: 'CNET Japan', url: DASH.TECH_SOURCES.cnet.url, source: DASH.TECH_SOURCES.cnet },
    { key: 'zdnet', label: 'ZDNET Japan', url: DASH.TECH_SOURCES.zdnet.url, source: DASH.TECH_SOURCES.zdnet },
    { key: 'wired', label: 'WIRED.jp', url: DASH.TECH_SOURCES.wired.url, source: DASH.TECH_SOURCES.wired },
    { key: 'itmedia', label: 'ITmedia NEWS', url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml', source: { name: 'ITmedia', className: 'src-itmedia' }, relay: true },
    { key: 'publickey', label: 'Publickey', url: 'https://www.publickey1.jp/atom.xml', source: { name: 'Publickey', className: 'src-publickey' }, relay: true },
    { key: 'nikkei', label: '日経（テクノロジー）', url: WOR + 'nikkei/technology.rdf', source: DASH.NEWS_SOURCES.nikkei },
    { key: 'yomiuri', label: '読売（テクノロジー）', url: WOR + 'yomiuri/science.rdf', source: DASH.NEWS_SOURCES.yomiuri },
  ];

  // 生成AIニュースの見出しの絞り込み（いずれかを含む記事。大文字小文字・全角半角・空白は区別しない）
  DASH.AI_NEWS_KEYWORDS = [
    '生成AI', 'ChatGPT', 'GPT', 'OpenAI', 'オープンAI', 'Gemini', 'ジェミニ', 'Claude', 'Anthropic', 'アンソロピック',
    'LLM', '言語モデル', 'Copilot', 'コパイロット', 'AIエージェント', 'エージェント型AI', '画像生成', '動画生成',
    'DeepSeek', 'ディープシーク', 'Grok', 'xAI', 'Perplexity', 'Midjourney', 'Stable Diffusion', 'Sora', 'Llama', 'Mistral',
  ];

  // ニュースジャンル: feeds は [提供元キー, フィードURL]
  DASH.NEWS_GENRES = [
    { id: 'top', name: '主要', feeds: [['nikkei', WOR + 'nikkei/news.rdf'], ['yomiuri', WOR + 'yomiuri/latestnews.rdf'], ['sankei', WOR + 'sankei/flash.rdf']] },
    { id: 'politics', name: '政治', feeds: [['yomiuri', WOR + 'yomiuri/politics.rdf'], ['sankei', WOR + 'sankei/politics.rdf']] },
    { id: 'economy', name: '経済', feeds: [['nikkei', WOR + 'nikkei/economy.rdf'], ['yomiuri', WOR + 'yomiuri/economy.rdf'], ['sankei', WOR + 'sankei/economy.rdf']] },
    { id: 'business', name: 'ビジネス', feeds: [['nikkei', WOR + 'nikkei/business.rdf']] },
    { id: 'markets', name: 'マーケット', feeds: [['nikkei', WOR + 'nikkei/markets.rdf']] },
    { id: 'world', name: '国際', feeds: [['nikkei', WOR + 'nikkei/international.rdf'], ['yomiuri', WOR + 'yomiuri/world.rdf'], ['sankei', WOR + 'sankei/world.rdf'], ['cnn', 'https://feeds.cnn.co.jp/rss/cnn/cnn.rdf']] },
    { id: 'society', name: '社会', feeds: [['nikkei', WOR + 'nikkei/society.rdf'], ['yomiuri', WOR + 'yomiuri/national.rdf'], ['sankei', WOR + 'sankei/affairs.rdf']] },
    { id: 'tech', name: 'テクノロジー', feeds: [['nikkei', WOR + 'nikkei/technology.rdf'], ['yomiuri', WOR + 'yomiuri/science.rdf']] },
    { id: 'sports', name: 'スポーツ', feeds: [['nikkei', WOR + 'nikkei/sports.rdf'], ['sankei', WOR + 'sankei/sports.rdf']] },
    { id: 'culture', name: 'エンタメ・文化', feeds: [['yomiuri', WOR + 'yomiuri/culture.rdf'], ['sankei', WOR + 'sankei/entertainments.rdf']] },
    { id: 'life', name: 'ライフ', feeds: [['sankei', WOR + 'sankei/life.rdf']] },
  ];

  // TradingView のウィジェットで表示できる銘柄（動作確認済み）
  DASH.MARKET_PRESETS = [
    { label: '日経225先物', symbol: 'OSE:NK2251!' },
    { label: '日経225mini', symbol: 'OSE:NK225M1!' },
    { label: '日経225 CFD', symbol: 'FOREXCOM:JP225' },
    { label: 'ドル/円', symbol: 'FX_IDC:USDJPY' },
    { label: 'ユーロ/円', symbol: 'FX_IDC:EURJPY' },
    { label: 'NYダウ', symbol: 'FOREXCOM:DJI' },
    { label: 'S&P500', symbol: 'FOREXCOM:SPXUSD' },
    { label: 'NASDAQ100', symbol: 'FOREXCOM:NSXUSD' },
    { label: '金', symbol: 'OANDA:XAUUSD' },
    { label: 'ビットコイン', symbol: 'BITSTAMP:BTCUSD' },
  ];

  // レイアウト編集の対象パネル（id は index.html の data-panel）
  DASH.PANELS = [
    { id: 'clock', name: '時計' },
    { id: 'now', name: '現在の天気' },
    { id: 'hourly', name: '直近12時間の予報' },
    { id: 'weekly', name: '週間天気予報' },
    { id: 'news', name: 'ニュース' },
    { id: 'market', name: 'マーケット' },
    // optional: 自動レイアウトでは表示せず、設定やレイアウト編集で追加するパネル
    { id: 'ainews', name: '生成AIニュース', optional: true },
    { id: 'technews', name: 'ITテックニュース', optional: true },
  ];

  // 位置情報が使えないときの地点
  DASH.FALLBACK_LOCATION = { name: '東京都 千代田区', lat: 35.6812, lon: 139.7671 };

  DASH.DEFAULT_SETTINGS = {
    theme: 'auto', // auto | dark | light
    // null は画面サイズごとの自動レイアウト。編集すると [{ id, visible, w, h }] を並び順で持つ
    layout: null,
    location: { mode: 'auto', name: '', lat: null, lon: null },
    news: {
      // 表示するタブ（並び順どおりに表示）
      tabs: DASH.NEWS_GENRES.map((g) => ({
        type: 'genre',
        id: g.id,
        enabled: ['top', 'economy', 'markets', 'world', 'tech', 'sports'].includes(g.id),
      })),
      sources: { nikkei: true, yomiuri: true, sankei: true, cnn: true },
      perTab: 15,
      rotateSec: 0,
    },
    aiNews: {
      keywords: DASH.AI_NEWS_KEYWORDS.slice(),
    },
    techNews: {
      sources: { cnet: true, zdnet: true, wired: true, itmedia: true, publickey: true, nikkei: true, yomiuri: true },
      relayUrl: '', // 中継サーバーの URL（空なら relay のフィードは取得しない）
    },
    market: {
      range: '1D',
      symbols: [
        { label: '日経225先物', symbol: 'OSE:NK2251!' },
        { label: 'ドル/円', symbol: 'FX_IDC:USDJPY' },
        { label: 'NYダウ', symbol: 'FOREXCOM:DJI' },
        { label: 'S&P500', symbol: 'FOREXCOM:SPXUSD' },
        { label: 'NASDAQ100', symbol: 'FOREXCOM:NSXUSD' },
      ],
    },
  };

  DASH.REFRESH = {
    weatherMs: 15 * 60 * 1000,
    newsMs: 10 * 60 * 1000,
  };
})(window.DASH);
