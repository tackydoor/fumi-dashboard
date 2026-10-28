'use strict';

// 天気（Open-Meteo）と現在地の取得
(function (DASH) {
  const { $, esc, fetchJson, load, save, hhmm } = DASH.util;
  const POS_KEY = 'mydashboard.lastPosition';
  const WDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];

  // WMO 天気コード → [昼アイコン, 夜アイコン, 表記]
  const CODES = {
    0: ['☀️', '🌙', '快晴'],
    1: ['🌤️', '🌙', '晴れ'],
    2: ['⛅', '☁️', '晴れ時々曇り'],
    3: ['☁️', '☁️', '曇り'],
    45: ['🌫️', '🌫️', '霧'],
    48: ['🌫️', '🌫️', '霧（着氷）'],
    51: ['🌦️', '🌧️', '弱い霧雨'],
    53: ['🌦️', '🌧️', '霧雨'],
    55: ['🌧️', '🌧️', '強い霧雨'],
    56: ['🌧️', '🌧️', '着氷性の霧雨'],
    57: ['🌧️', '🌧️', '着氷性の霧雨'],
    61: ['🌦️', '🌧️', '小雨'],
    63: ['🌧️', '🌧️', '雨'],
    65: ['🌧️', '🌧️', '大雨'],
    66: ['🌧️', '🌧️', '着氷性の雨'],
    67: ['🌧️', '🌧️', '着氷性の強い雨'],
    71: ['🌨️', '🌨️', '小雪'],
    73: ['🌨️', '🌨️', '雪'],
    75: ['❄️', '❄️', '大雪'],
    77: ['🌨️', '🌨️', '霧雪'],
    80: ['🌦️', '🌧️', 'にわか雨'],
    81: ['🌧️', '🌧️', 'にわか雨'],
    82: ['⛈️', '⛈️', '激しいにわか雨'],
    85: ['🌨️', '🌨️', 'にわか雪'],
    86: ['❄️', '❄️', '強いにわか雪'],
    95: ['⛈️', '⛈️', '雷雨'],
    96: ['⛈️', '⛈️', '雷雨（ひょう）'],
    99: ['⛈️', '⛈️', '激しい雷雨（ひょう）'],
  };

  function codeInfo(code, isDay) {
    const c = CODES[code] || ['❔', '❔', '不明'];
    return { icon: isDay === 0 ? c[1] : c[0], label: c[2] };
  }

  let current = null; // { name, lat, lon }
  let timer = null;
  let jmaCache = null; // { key: '緯度,経度', data } 直前に取得した気象庁の降水確率

  function setStatus(text) {
    $('#weather-status').textContent = text;
  }

  // 位置情報 → 地名（BigDataCloud の無料逆ジオコーディング）
  async function reverseGeocode(lat, lon) {
    try {
      const j = await fetchJson('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=ja', 10000);
      const parts = [j.principalSubdivision, j.city || j.locality].filter(Boolean);
      return [...new Set(parts)].join(' ') || '現在地';
    } catch (e) {
      return '現在地';
    }
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('このブラウザは位置情報に対応していません'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 },
      );
    });
  }

  async function resolveLocation() {
    const loc = DASH.settings.location;
    if (loc.mode === 'manual' && loc.lat != null && loc.lon != null) {
      return { name: loc.name || '指定地点', lat: loc.lat, lon: loc.lon };
    }

    const cached = load(POS_KEY, null);
    // 先にキャッシュ位置で描画し、取得後に必要なら描き直す
    if (cached && !current) {
      current = cached;
      fetchWeather();
    }
    try {
      const pos = await getPosition();
      const moved = !cached || Math.abs(cached.lat - pos.lat) > 0.02 || Math.abs(cached.lon - pos.lon) > 0.02;
      const name = moved || !cached.name ? await reverseGeocode(pos.lat, pos.lon) : cached.name;
      const result = { name, lat: pos.lat, lon: pos.lon };
      save(POS_KEY, result);
      return result;
    } catch (e) {
      if (cached) return cached;
      DASH.weather.notice = '位置情報を取得できないため' + DASH.FALLBACK_LOCATION.name + 'を表示中（⚙設定で地点を指定できます）';
      return DASH.FALLBACK_LOCATION;
    }
  }

  function statusText(popSource) {
    return (DASH.weather.notice ? DASH.weather.notice + ' ・ ' : '') + '更新 ' + hhmm(new Date()) + ' ・ Open-Meteo ・ 降水確率: ' + popSource;
  }

  async function fetchWeather() {
    if (!current) return;
    const loc = current;
    const params = new URLSearchParams({
      latitude: loc.lat.toFixed(4),
      longitude: loc.lon.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto',
      timeformat: 'unixtime',
      wind_speed_unit: 'ms',
      forecast_days: '8',
    });
    let data;
    try {
      data = await fetchJson('https://api.open-meteo.com/v1/forecast?' + params, 15000);
    } catch (e) {
      setStatus('天気を取得できませんでした（' + e.message + '）');
      return;
    }

    // 降水確率は日本国内なら気象庁を使う。取得に時間がかかることがあるので、
    // 先に前回の気象庁の値（なければ Open-Meteo）で描画し、届いたら描き直す
    const key = loc.lat + ',' + loc.lon;
    const prev = jmaCache && jmaCache.key === key ? jmaCache.data : null;
    render(data, prev);
    setStatus(statusText(prev ? '気象庁（' + prev.name + '）' : '気象庁の予報を取得中…'));

    try {
      const jma = await DASH.jma.pops(loc.lat, loc.lon);
      if (current !== loc) return; // 待っている間に地点が変わった
      jmaCache = { key, data: jma };
      render(data, jma);
      setStatus(statusText(jma ? '気象庁（' + jma.name + '）' : 'Open-Meteo'));
    } catch (e) {
      if (current !== loc || prev) return;
      setStatus(statusText('Open-Meteo（気象庁の予報を取得できませんでした）'));
    }
  }

  function fmtTemp(v) {
    return v == null ? '--' : Math.round(v);
  }

  const BLOCK_SEC = 6 * 3600;

  // 時間ごとの欄の下に、気象庁の6時間ごとの降水確率を該当する時間にまたがる帯で並べる
  function popSegments(jma, times, hourOf) {
    const blockAt = (t) => jma.blocks.find((b) => t >= b.start && t < b.start + BLOCK_SEC) || null;
    const segs = [];
    times.forEach((t, k) => {
      const b = blockAt(t);
      const last = segs[segs.length - 1];
      if (last && last.block === b) last.to = k;
      else segs.push({ block: b, from: k, to: k });
    });
    return segs.map((s) => {
      const col = 'grid-column:' + (s.from + 1) + ' / ' + (s.to + 2);
      if (!s.block || s.block.pop == null) {
        return '<div class="pop-seg none" style="' + col + '" title="発表済みの気象庁の予報に含まれない時間帯です">—</div>';
      }
      const from = hourOf(s.block.start);
      const range = from + '–' + (from + 6) + '時';
      return '<div class="pop-seg" style="' + col + ';--p:' + Math.round(s.block.pop / 2) + '%" title="' + range + 'の降水確率（1mm以上） ' + s.block.pop + '%">' +
        '<span class="seg-range">' + range + '</span><span class="seg-val">' + s.block.pop + '%</span></div>';
    });
  }

  // 気象庁の日ごとの降水確率。今日・明日は週間予報に値がないので6時間ごと（0–6/6–12/12–18/18–24時）を並べる
  function jmaDayPop(jma, key, hourOf, dateOf) {
    const day = jma.days.find((x) => x.date === key);
    if (day && day.pop != null) return { text: day.pop + '%', title: '降水確率（気象庁 ' + jma.weekName + '）' };
    const slots = [0, 6, 12, 18].map((hr) => jma.blocks.find((b) => dateOf(b.start) === key && hourOf(b.start) === hr));
    const val = (b) => (b && b.pop != null ? b.pop : null);
    if (!slots.some((b) => val(b) != null)) return { text: '-', title: '気象庁の予報期間外です' };
    return {
      text: slots.map((b) => (val(b) == null ? '-' : val(b))).join('/') + '%',
      title: '6時間ごとの降水確率（気象庁 ' + jma.name + '）: ' +
        slots.map((b, k) => k * 6 + '–' + (k * 6 + 6) + '時 ' + (val(b) == null ? '-' : val(b) + '%')).join('、'),
      blocks: true,
    };
  }

  function render(data, jma) {
    const tz = data.timezone;
    const fmtHour = new Intl.DateTimeFormat('ja-JP', { hour: 'numeric', hourCycle: 'h23', timeZone: tz });
    const fmtKey = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }); // YYYY-MM-DD
    const hourOf = (sec) => Number(fmtHour.formatToParts(new Date(sec * 1000)).find((p) => p.type === 'hour').value);
    const dateOf = (sec) => fmtKey.format(new Date(sec * 1000));
    const fmtTime = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const fmtMD = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: tz });
    const fmtDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz });
    const dayIdx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    $('#loc-name').textContent = '📍 ' + current.name;

    // 現在
    const c = data.current;
    const info = codeInfo(c.weather_code, c.is_day);
    const d = data.daily;
    $('#now-icon').textContent = info.icon;
    $('#now-temp').textContent = c.temperature_2m.toFixed(1);
    $('#now-desc').textContent = info.label;
    $('#now-hi').textContent = fmtTemp(d.temperature_2m_max[0]) + '℃';
    $('#now-lo').textContent = fmtTemp(d.temperature_2m_min[0]) + '℃';
    const stats = [
      ['体感', Math.round(c.apparent_temperature) + '℃'],
      ['湿度', c.relative_humidity_2m + '%'],
      ['風', DIRS[Math.round(c.wind_direction_10m / 22.5) % 16] + ' ' + c.wind_speed_10m.toFixed(1) + 'm/s'],
      ['降水量', c.precipitation + 'mm'],
      ['日の出', fmtTime.format(new Date(d.sunrise[0] * 1000))],
      ['日の入', fmtTime.format(new Date(d.sunset[0] * 1000))],
    ];
    $('#now-stats').innerHTML = stats.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');

    // 直近12時間（現在の時間帯から）
    const h = data.hourly;
    const nowSec = Date.now() / 1000;
    let start = h.time.findIndex((t) => t + 3600 > nowSec);
    if (start < 0) start = 0;
    const end = Math.min(start + 12, h.time.length - 1);
    const cells = [];
    for (let i = start; i < end; i++) {
      const hi = codeInfo(h.weather_code[i], h.is_day[i]);
      // Open-Meteo の降水確率は「その時刻までの1時間」の値なので、i時台（i時〜i+1時）の値は次の時刻に入っている
      const pop = h.precipitation_probability[i + 1];
      cells.push(
        '<div class="hour' + (i === start ? ' current' : '') + '" style="grid-column:' + (i - start + 1) + '" title="' + esc(hi.label) + '">' +
          '<div class="h-time">' + (i === start ? '今' : hourOf(h.time[i]) + '時') + '</div>' +
          '<div class="h-icon">' + hi.icon + '</div>' +
          '<div class="h-temp">' + fmtTemp(h.temperature_2m[i]) + '°</div>' +
          (jma ? '' : '<div class="h-pop" title="この1時間の降水確率（0.1mm以上）"><span class="pop-bar" style="--p:' + (pop || 0) + '%"></span>' + (pop == null ? '-' : pop + '%') + '</div>') +
        '</div>',
      );
    }
    if (jma) cells.push(...popSegments(jma, h.time.slice(start, end), hourOf));
    $('#hourly').innerHTML = cells.join('');
    $('#hourly-src').textContent = jma ? '降水確率: 気象庁・6時間ごと' : '降水確率: 1時間ごと（Open-Meteo）';

    // 週間
    const weekMin = Math.min(...d.temperature_2m_min);
    const weekMax = Math.max(...d.temperature_2m_max);
    const span = Math.max(1, weekMax - weekMin);
    const days = d.time.map((t, i) => {
      const date = new Date(t * 1000 + 12 * 3600 * 1000); // 当地の正午で曜日を判定
      const wd = dayIdx[fmtDay.format(date)];
      const di = codeInfo(d.weather_code[i], 1);
      const lo = d.temperature_2m_min[i];
      const hi = d.temperature_2m_max[i];
      const label = i === 0 ? '今日' : i === 1 ? '明日' : WDAYS[wd];
      const left = ((lo - weekMin) / span) * 100;
      const width = Math.max(4, ((hi - lo) / span) * 100);
      const pop = jma
        ? jmaDayPop(jma, dateOf(t + 12 * 3600), hourOf, dateOf)
        : { text: (d.precipitation_probability_max[i] ?? '-') + '%', title: 'その日の1時間ごとの降水確率の最大値（Open-Meteo）' };
      return (
        '<div class="day' + (i === 0 ? ' today' : '') + '">' +
          '<div class="d-label' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + '">' + label + '</div>' +
          '<div class="d-date">' + fmtMD.format(date) + '（' + WDAYS[wd] + '）</div>' +
          '<div class="d-icon" title="' + esc(di.label) + '">' + di.icon + '</div>' +
          '<div class="d-desc">' + esc(di.label) + '</div>' +
          '<div class="d-temp"><span class="hi">' + fmtTemp(hi) + '°</span><span class="lo">' + fmtTemp(lo) + '°</span></div>' +
          '<div class="d-range"><span style="left:' + left + '%;width:' + width + '%"></span></div>' +
          '<div class="d-pop' + (pop.blocks ? ' blocks' : '') + '" title="' + esc(pop.title) + '">☂ ' + pop.text + '</div>' +
        '</div>'
      );
    });
    $('#weekly').innerHTML = days.join('');
    $('#weekly-src').textContent = jma ? '降水確率: 気象庁（今日・明日は6時間ごと）' : '降水確率: 1時間ごとの最大（Open-Meteo）';
  }

  DASH.weather = {
    notice: '',

    async start() {
      clearInterval(timer);
      DASH.weather.notice = '';
      current = null;
      setStatus('位置情報を取得中…');
      current = await resolveLocation();
      await fetchWeather();
      timer = setInterval(fetchWeather, DASH.REFRESH.weatherMs);
    },

    refresh() {
      return fetchWeather();
    },

    // 地名検索（国土地理院 地名検索API）
    async search(query) {
      const list = await fetchJson('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(query), 10000);
      // dataSource のない結果が住所・地名、ある結果は施設なので後ろに回す
      const ranked = [...list.filter((f) => !f.properties.dataSource), ...list.filter((f) => f.properties.dataSource)];
      return ranked.slice(0, 8).map((f) => ({
        name: f.properties.title,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
    },
  };
})(window.DASH);
