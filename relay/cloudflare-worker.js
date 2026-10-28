// ダッシュボード用の RSS 中継サーバー（Cloudflare Workers）
//
// CORS に対応していないフィードを取得し、ブラウザから読めるように
// Access-Control-Allow-Origin を付けて返す。
//   GET https://<このワーカーのURL>/?url=<フィードのURL>
//
// 誰でも任意のサイトを取得できる「踏み台」にならないよう、
// 中継するのは ALLOWED_HOSTS のホストだけにしている。

const ALLOWED_HOSTS = [
  'rss.itmedia.co.jp',
  'www.publickey1.jp',
];

const CACHE_SECONDS = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function error(status, message) {
  return new Response(message, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== 'GET') return error(405, 'Method Not Allowed');

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url'));
    } catch (e) {
      return error(400, 'url パラメーターにフィードの URL を指定してください。');
    }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
      return error(403, 'このホストは中継できません: ' + target.hostname);
    }

    let res;
    try {
      res = await fetch(target.href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dashboard-feed-relay)' },
        // Cloudflare のキャッシュを使い、取得元へのアクセスを減らす
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });
    } catch (e) {
      return error(502, '取得できませんでした: ' + e.message);
    }
    if (!res.ok) return error(502, '取得元が HTTP ' + res.status + ' を返しました。');

    return new Response(res.body, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': res.headers.get('Content-Type') || 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=' + CACHE_SECONDS,
      },
    });
  },
};
