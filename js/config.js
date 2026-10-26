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

  // 位置情報が使えないときの地点
  DASH.FALLBACK_LOCATION = { name: '東京都 千代田区', lat: 35.6812, lon: 139.7671 };

  DASH.DEFAULT_SETTINGS = {
    theme: 'auto', // auto | dark | light
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
