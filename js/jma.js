'use strict';

// 気象庁の降水確率（府県天気予報の6時間ごと・週間天気予報の日ごと）
(function (DASH) {
  const { fetchJson, load, save } = DASH.util;
  const BASE = 'https://www.jma.go.jp/bosai/';
  const AREA_KEY = 'mydashboard.jmaArea.';
  const MUNI_KEY = 'mydashboard.muni.';
  // 予報が隣の地方の予報ファイルにまとめて載っている地域
  const FILE_OFFICE = { '014030': '014100', '460040': '460100' };

  let areaJson = null; // area.json は大きいので一度だけ取得する

  // 緯度経度 → 市区町村コード（国土地理院 逆ジオコーダー）。日本国外・海上は null
  // 応答に数十秒かかることがあるため、約100m単位の地点ごとに結果を保存しておく
  async function muniCode(lat, lon) {
    const key = MUNI_KEY + lat.toFixed(3) + ',' + lon.toFixed(3);
    const cached = load(key, null);
    if (cached) return cached.muni;
    const j = await fetchJson('https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=' + lat + '&lon=' + lon, 45000);
    const muni = (j && j.results && j.results.muniCd) || null;
    save(key, { muni });
    return muni;
  }

  // 市区町村コード → 一次細分区域（予報区）と府県予報区
  async function resolveArea(muni) {
    const cached = load(AREA_KEY + muni, null);
    if (cached) return cached;

    areaJson = areaJson || await fetchJson(BASE + 'common/const/area.json', 20000);
    const c20 = areaJson.class20s;
    let code = c20[muni + '00'] ? muni + '00' : null;
    if (!code) {
      // 政令指定都市の区は市の単位（例: 横浜市北部）で登録されているため、同じ県内で手前にある市のコードを使う
      const prefix = Object.keys(c20)
        .map((c) => c.slice(0, 5))
        .filter((p) => p.slice(0, 3) === muni.slice(0, 3) && p <= muni)
        .sort()
        .pop();
      code = prefix ? Object.keys(c20).find((c) => c.startsWith(prefix)) : null;
    }
    if (!code) return null;

    const class10 = areaJson.class15s[c20[code].parent].parent;
    const office = areaJson.class10s[class10].parent;
    const officeName = areaJson.offices[office].name;
    const c10Name = areaJson.class10s[class10].name;
    const area = {
      class10,
      office,
      file: FILE_OFFICE[office] || office,
      // 「東部」のような区域名だけでは分かりにくいので府県名を添える
      name: c10Name === officeName || c10Name.endsWith('地方') ? c10Name : officeName + ' ' + c10Name,
    };
    save(AREA_KEY + muni, area);
    return area;
  }

  function popNum(v) {
    return v === '' || v == null ? null : Number(v);
  }

  async function fetchPops(area) {
    const [forecast, weekArea] = await Promise.all([
      fetchJson(BASE + 'forecast/data/forecast/' + area.file + '.json', 15000),
      fetchJson(BASE + 'forecast/const/week_area.json', 15000),
    ]);
    const withPops = (part) => part && part.timeSeries.find((t) => t.areas.some((a) => a.pops));

    // [0] 府県天気予報: 一次細分区域ごとの6時間降水確率
    const ts = withPops(forecast[0]);
    const shortArea = ts && ts.areas.find((a) => a.area.code === area.class10);
    if (!shortArea) throw new Error('予報区が見つかりません');
    const blocks = ts.timeDefines.map((t, i) => ({ start: Date.parse(t) / 1000, pop: popNum(shortArea.pops[i]) }));

    // [1] 週間天気予報: 週間予報の区域ごとの日降水確率（初日は府県天気予報に任せて空欄）
    const wts = withPops(forecast[1]);
    let days = [];
    let weekName = '';
    if (wts) {
      const codes = (weekArea[area.office] || weekArea[area.file] || [])
        .filter((x) => x.srf === area.class10)
        .map((x) => x.week);
      const wa = wts.areas.find((a) => codes.includes(a.area.code)) || (wts.areas.length === 1 ? wts.areas[0] : null);
      if (wa) {
        weekName = wa.area.name;
        days = wts.timeDefines.map((t, i) => ({ date: t.slice(0, 10), pop: popNum(wa.pops[i]) }));
      }
    }
    return { name: area.name, weekName, blocks, days };
  }

  DASH.jma = {
    // 日本国内なら { name, weekName, blocks: [{ start, pop }], days: [{ date, pop }] }、対象外なら null
    async pops(lat, lon) {
      const muni = await muniCode(lat, lon);
      if (!muni) return null;
      const area = await resolveArea(muni);
      return area ? fetchPops(area) : null;
    },
  };
})(window.DASH);
