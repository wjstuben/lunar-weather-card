// Lunar Weather Card
// Designed and written by Grok in Cursor. The publisher of this repository did not design it.
//
// A moon-phase card for Home Assistant. Temperature, humidity, wind, rain,
// and gust come from the weather entity, or from an outdoor station when
// station_prefix is set. The forecast stays on its own card.
//
// type: custom:lunar-weather-card
// entity: weather.home
// station_prefix: optional
//
// Optional holiday: auto (default), none, halloween, christmas, easter, valentine, newyear, patrick, thanksgiving, groundhog, cinco
// Icicles when the reading is below 32°F (0°C).
// Frost crystals when the day is above freezing and the coming night drops to it, and when the reading is below 0°F (-18°C).
// Thunderstorms add a storm cloud and flashing bolts over the moon.
// Clear meteor-shower nights get shooting stars. Strong gusts blow leaves.
// Hot days put sunglasses on the moon. Warm summer evenings get fireflies.
// July 4 has fireworks. Blood moons turn the moon red.
// A rainbow shows when the sun is out and the station has rain today.
// Snow adds corner drifts and falling flakes.
// Rain leans an umbrella and boots in the bottom right, with drops and a splash.

const LitElement = customElements.get("hui-masonry-view")
  ? Object.getPrototypeOf(customElements.get("hui-masonry-view"))
  : Object.getPrototypeOf(customElements.get("hui-view"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const FULL_MOONS = ["Wolf Moon", "Snow Moon", "Worm Moon", "Pink Moon", "Flower Moon", "Strawberry Moon", "Buck Moon", "Sturgeon Moon", "Harvest Moon", "Hunter's Moon", "Beaver Moon", "Cold Moon"];
const BLOOD_MOONS = ["2025-03-14", "2025-09-07", "2026-03-03", "2028-12-31", "2029-06-26", "2029-12-20"];

function fire(node, type, detail) {
  const event = new Event(type, { bubbles: true, composed: true });
  event.detail = detail === undefined ? {} : detail;
  node.dispatchEvent(event);
}

function moonAge(date) {
  let age = ((date.getTime() - NEW_MOON) / 86400000) % SYNODIC;
  if (age < 0) age += SYNODIC;
  return age;
}

function fullMoonDate(date, phase) {
  return new Date(date.getTime() + (0.5 - phase) * SYNODIC * 86400000);
}

function isBloodMoon(full) {
  return BLOOD_MOONS.some((day) => Math.abs(full - new Date(day + "T12:00:00Z")) < 20 * 3600000);
}

function isBlueMoon(full) {
  const prev = new Date(full.getTime() - SYNODIC * 86400000);
  return prev.getMonth() === full.getMonth() && prev.getFullYear() === full.getFullYear();
}

function fullMoonName(full) {
  const equinox = new Date(full.getFullYear(), 8, 22, 12);
  const day = 86400000;
  const dist = (d) => Math.abs(d - equinox);
  const prev = new Date(full.getTime() - SYNODIC * day);
  const next = new Date(full.getTime() + SYNODIC * day);
  if (dist(full) <= dist(prev) && dist(full) <= dist(next)) return "Harvest Moon";
  if (dist(prev) < dist(new Date(prev.getTime() - SYNODIC * day)) && dist(prev) <= dist(full)) return "Hunter's Moon";
  return FULL_MOONS[full.getMonth()];
}

function moonPhase(date) {
  const age = moonAge(date);
  const phase = age / SYNODIC;
  const full = fullMoonDate(date, phase);
  let name = "Waning crescent";
  if (phase < 0.03 || phase >= 0.97) name = "New Moon";
  else if (phase < 0.22) name = "Waxing crescent";
  else if (phase < 0.28) name = "First quarter";
  else if (phase < 0.47) name = "Waxing gibbous";
  else if (phase < 0.53) name = isBloodMoon(full) ? "Blood Moon" : isBlueMoon(full) ? "Blue Moon" : fullMoonName(full);
  else if (phase < 0.72) name = "Waning gibbous";
  else if (phase < 0.78) name = "Last quarter";
  return { phase, name };
}

function cloudCover(stateObj) {
  const condition = String(stateObj?.state || "").toLowerCase();
  const coverage = Number(stateObj?.attributes?.cloud_coverage);
  if (["cloudy", "fog", "hail", "lightning", "lightning-rainy", "pouring", "rainy", "snowy", "snowy-rainy"].includes(condition) || coverage >= 75) return 2;
  if (["partlycloudy", "windy-variant"].includes(condition) || coverage >= 25) return 1;
  return 0;
}

function moonClouds(cover) {
  const puff = (x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})" opacity="0.94">
      <ellipse cx="0" cy="8" rx="20" ry="11" fill="url(#cloud)"/>
      <ellipse cx="-16" cy="10" rx="13" ry="9" fill="#d5e2ff"/>
      <ellipse cx="16" cy="9" rx="14" ry="9" fill="#f3f7ff"/>
      <ellipse cx="-1" cy="3" rx="12" ry="8" fill="#fff"/>
    </g>`;
  if (cover >= 2) return puff(48, 62, 1.2) + puff(82, 50, 0.95) + puff(34, 78, 0.8);
  if (cover >= 1) return puff(70, 74, 1.05);
  return "";
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
}

function holidayFor(date) {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 9 && day === 31) return "halloween";
  if (month === 2 && day === 17) return "patrick";
  if (isThanksgiving(date)) return "thanksgiving";
  if (month === 11 && (day === 24 || day === 25)) return "christmas";
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) return "newyear";
  if (month === 1 && day === 2) return "groundhog";
  if (month === 1 && day === 14) return "valentine";
  if (month === 4 && day === 5) return "cinco";
  const easter = easterSunday(date.getFullYear());
  if (month === easter.month && day === easter.day) return "easter";
  return "";
}

function isThanksgiving(date) {
  if (date.getMonth() !== 10) return false;
  const first = new Date(date.getFullYear(), 10, 1).getDay();
  return date.getDate() === 1 + ((4 - first + 7) % 7) + 21;
}

function pieGraphic() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <ellipse cx="64" cy="102" rx="40" ry="8" fill="#000" opacity="0.18"/>
    <path d="M64 28 L92 78 A36 36 0 0 1 36 78 Z" fill="#f2d2a2"/>
    <path d="M64 34 L86 74 A30 30 0 0 1 42 74 Z" fill="#c4473a"/>
    <path d="M64 34 L75 74 L64 70 L53 74 Z" fill="#f6e2b8" opacity="0.35"/>
    <path d="M28 74 A36 36 0 1 0 100 74 L92 78 A36 36 0 1 1 36 78 Z" fill="#e7b56a"/>
    <path d="M34 78 A32 28 0 0 0 94 78" fill="none" stroke="#f6e2b8" stroke-width="2"/>
    <path d="M40 70 Q52 62 64 70 Q76 62 88 70" fill="none" stroke="#c48a3a" stroke-width="2"/>
    <path d="M46 78 Q58 68 70 78" fill="none" stroke="#f6e2b8" stroke-width="1.6"/>
    <path d="M78 46 Q84 40 90 46" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/>
    <circle cx="64" cy="24" r="10" fill="#f2d2a2"/>
    <path d="M58 24 L64 16 L70 24" fill="#c4473a"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function earthGraphic() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <circle cx="64" cy="58" r="46" fill="#1f6fbf"/>
    <path d="M38 34 C44 28 52 32 50 40 C46 48 36 46 34 40 C32 36 34 32 38 34Z" fill="#3e9a4a"/>
    <path d="M42 52 C50 48 56 56 52 66 C46 74 36 70 34 62 C32 56 36 52 42 52Z" fill="#57b15a"/>
    <path d="M70 30 C78 26 86 32 84 40 C80 46 72 44 70 38 C68 34 68 32 70 30Z" fill="#3e9a4a"/>
    <path d="M74 46 C84 44 90 54 86 64 C80 72 70 68 68 58 C66 50 68 46 74 46Z" fill="#2f8a45"/>
    <path d="M86 70 C94 68 100 76 96 84 C90 90 80 86 80 78 C80 72 82 70 86 70Z" fill="#57b15a"/>
    <ellipse cx="48" cy="40" rx="10" ry="4" fill="#fff" opacity="0.55"/>
    <ellipse cx="78" cy="72" rx="12" ry="4.5" fill="#fff" opacity="0.5"/>
    <circle cx="64" cy="58" r="46" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function moonGraphic(phase, cover, tone) {
  if (tone === "pie") return pieGraphic();
  if (tone === "earth") return earthGraphic();
  const cx = 64;
  const cy = 58;
  const r = 34;
  const p = ((phase % 1) + 1) % 1;
  const waxing = p < 0.5;
  const mag = Math.cos(2 * Math.PI * p);
  const rx = Math.max(0.6, Math.abs(mag) * r);
  const sweepLimb = waxing ? 1 : 0;
  const sweepTerm = mag > 0 ? (waxing ? 0 : 1) : (waxing ? 1 : 0);
  const lit = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweepLimb} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${sweepTerm} ${cx} ${cy - r} Z`;
  const palettes = {
    halloween: { sky0: "#6a2a86", sky1: "#2a1248", halo0: "#ff8a1e", halo1: "#ff4d1a", lit0: "#ffe7b0", lit1: "#ffb15a", lit2: "#ef6a22", shade0: "#5c3d86", shade1: "#1a1028", rim: "rgba(255,140,40,.9)", stars: ["#ffb020", "#f3e27a", "#d27bff", "#ff8f6b", "#ffe08a"] },
    blood: { sky0: "#7a2430", sky1: "#2a1014", halo0: "#ff6d6d", halo1: "#d23a3a", lit0: "#ffd2c6", lit1: "#ef5a4a", lit2: "#a82424", shade0: "#6a3038", shade1: "#1a0c10", rim: "rgba(255,140,120,.9)", stars: ["#ffb0a0", "#fff", "#ff8a7a", "#ffd0c8", "#ffe0a8"] },
  };
  const palette = palettes[tone] || { sky0: "#4d62b8", sky1: "#2a3568", halo0: "#ffd28a", halo1: "#ff9d6e", lit0: "#fff6dd", lit1: "#ffd98a", lit2: "#f0a35c", shade0: "#4e629e", shade1: "#161c34", rim: "rgba(255,214,150,.85)", stars: ["#ffe7a8", "#fff", "#9ec0ff", "#ffd0e8", "#fff4c8"] };
  const stars = cover < 2
    ? [[18, 30, 1.3], [108, 24, 1.1], [112, 72, 1.5], [16, 86, 1.1], [98, 16, 0.9]]
        .map(([x, y, rad], i) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${palette.stars[i]}"/>`)
        .join("")
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs>
      <radialGradient id="sky" cx="50%" cy="46%" r="58%">
        <stop offset="0%" stop-color="${palette.sky0}"/>
        <stop offset="48%" stop-color="${palette.sky1}"/>
        <stop offset="100%" stop-color="${palette.sky1}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${palette.halo0}" stop-opacity="0.75"/>
        <stop offset="62%" stop-color="${palette.halo1}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${palette.halo1}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lit" x1="28%" y1="0%" x2="82%" y2="100%">
        <stop offset="0%" stop-color="${palette.lit0}"/>
        <stop offset="46%" stop-color="${palette.lit1}"/>
        <stop offset="100%" stop-color="${palette.lit2}"/>
      </linearGradient>
      <radialGradient id="shade" cx="32%" cy="30%" r="78%">
        <stop offset="0%" stop-color="${palette.shade0}"/>
        <stop offset="100%" stop-color="${palette.shade1}"/>
      </radialGradient>
      <linearGradient id="cloud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f7f9ff"/>
        <stop offset="100%" stop-color="#b9c8f0"/>
      </linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="54" fill="url(#sky)"/>
    <circle cx="${cx}" cy="${cy}" r="46" fill="url(#halo)"/>
    ${stars}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#shade)"/>
    <path d="${lit}" fill="url(#lit)"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 0.4}" fill="none" stroke="${palette.rim}" stroke-width="1.4"/>
    ${moonClouds(cover)}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const batSvg = html`<svg class="bat" viewBox="0 0 64 32" aria-hidden="true"><g class="wing left"><path d="M32 16 C24 16 14 8 4 6 C10 12 8 20 2 24 C14 20 22 18 32 16Z"/></g><g class="wing right"><path d="M32 16 C40 16 50 8 60 6 C54 12 56 20 62 24 C50 20 42 18 32 16Z"/></g><ellipse cx="32" cy="17" rx="3.4" ry="4.4"/><circle cx="30.6" cy="16.2" r="0.7" fill="#ffb020"/><circle cx="33.4" cy="16.2" r="0.7" fill="#ffb020"/></svg>`;
const wolfSvg = html`<svg class="wolf" viewBox="0 0 64 80" aria-hidden="true"><path d="M8 68 Q32 50 56 68 L58 80 L6 80Z" fill="#241833"/><ellipse cx="32" cy="42" rx="18" ry="20" fill="#6d5a88"/><path d="M16 30 L9 8 L27 22Z" fill="#6d5a88"/><path d="M48 30 L55 8 L37 22Z" fill="#6d5a88"/><path d="M17 27 L14 14 L25 22Z" fill="#f0a0b8"/><path d="M47 27 L50 14 L39 22Z" fill="#f0a0b8"/><ellipse cx="32" cy="52" rx="9" ry="7" fill="#d5cbe4"/><ellipse cx="32" cy="50" rx="3" ry="2.2" fill="#241833"/><ellipse cx="24" cy="40" rx="3.3" ry="3.8" fill="#ffb020"/><ellipse cx="40" cy="40" rx="3.3" ry="3.8" fill="#ffb020"/><circle cx="24.4" cy="40.6" r="1.5" fill="#1a1020"/><circle cx="40.4" cy="40.6" r="1.5" fill="#1a1020"/><path d="M20 34 L28 36" stroke="#241833" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M44 34 L36 36" stroke="#241833" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;

function isSnowing(stateObj) {
  const condition = String(stateObj?.state || "").toLowerCase();
  return condition === "snowy" || condition === "snowy-rainy";
}

function isRaining(stateObj) {
  const condition = String(stateObj?.state || "").toLowerCase();
  return ["rainy", "pouring", "lightning-rainy", "hail"].includes(condition);
}

function isStorm(stateObj) {
  const condition = String(stateObj?.state || "").toLowerCase();
  return condition === "lightning" || condition === "lightning-rainy";
}

const SHOWERS = [[0, 3], [0, 4], [7, 11], [7, 12], [7, 13], [9, 21], [9, 22], [10, 17], [10, 18], [11, 13], [11, 14]];

function meteorNight(date, cover, sunState) {
  if (cover !== 0 || sunState !== "below_horizon") return false;
  return SHOWERS.some(([month, day]) => date.getMonth() === month && date.getDate() === day);
}

function strongGust(gust, unit) {
  if (!Number.isFinite(gust)) return false;
  const u = String(unit || "").toLowerCase();
  if (u.includes("km")) return gust >= 40;
  if (u.includes("m/s")) return gust >= 11;
  return gust >= 25;
}

function isHot(shown, unit) {
  if (!Number.isFinite(shown)) return false;
  return unit === "°C" ? shown >= 29 : shown >= 85;
}

function fireflyEvening(date, shown, unit, sunState, wet) {
  if (sunState !== "below_horizon" || wet) return false;
  const month = date.getMonth();
  if (month < 5 || month > 7) return false;
  if (!Number.isFinite(shown)) return false;
  return unit === "°C" ? shown >= 18 : shown >= 65;
}

function showRainbow(sunState, rain, wet) {
  return sunState === "above_horizon" && Number.isFinite(rain) && rain > 0 && !wet;
}

function isFreezing(shown, unit) {
  if (!Number.isFinite(shown)) return false;
  return unit === "°C" ? shown < 0 : shown < 32;
}

function isSubzero(shown, unit) {
  if (!Number.isFinite(shown)) return false;
  return unit === "°C" ? shown < -18 : shown < 0;
}

function freezePoint(unit) {
  return unit === "°C" ? 0 : 32;
}

function localDay(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function frostDue(hours, days, unit, now, current) {
  const freeze = freezePoint(unit);
  const upcoming = (hours || [])
    .map((row) => ({ at: new Date(row.datetime), temp: Number(row.temperature) }))
    .filter((row) => Number.isFinite(row.temp) && row.at.getTime() >= now.getTime() - 30 * 60000)
    .sort((a, b) => a.at - b.at);
  if (!upcoming.length) return false;

  const hour = now.getHours();
  const nightStart = new Date(now);
  const nightEnd = new Date(now);
  if (hour < 8) {
    nightStart.setTime(now.getTime() - 60 * 60000);
    nightEnd.setHours(8, 0, 0, 0);
  } else {
    nightStart.setHours(17, 0, 0, 0);
    nightEnd.setTime(nightStart.getTime());
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(8, 0, 0, 0);
  }

  const nightTemps = upcoming.filter((row) => row.at >= nightStart && row.at <= nightEnd).map((row) => row.temp);
  if (!nightTemps.length) return false;
  let low = Math.min(...nightTemps);

  const dayKey = localDay(hour < 8 ? now : nightStart);
  const match = (days || [])
    .map((row) => ({ at: new Date(row.datetime), high: Number(row.temperature), low: Number(row.templow) }))
    .find((row) => !Number.isNaN(row.at.getTime()) && localDay(row.at) === dayKey);
  if (hour < 8 && match && Number.isFinite(match.low)) low = Math.min(low, match.low);

  let high = match ? match.high : NaN;
  if (!Number.isFinite(high)) {
    const daytime = upcoming.filter((row) => localDay(row.at) === dayKey && row.at.getHours() >= 8 && row.at.getHours() < 17);
    high = daytime.length ? Math.max(...daytime.map((row) => row.temp)) : Number(current);
  }
  return Number.isFinite(high) && Number.isFinite(low) && high > freeze && low <= freeze;
}

const icicleSvg = html`<svg viewBox="0 0 160 28" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="160" height="2.4" fill="#f4fbff"/><path d="M8 2 L12 15 L16 2 Z" fill="#e7f4ff"/><path class="drip" d="M28 2 L33 25 L38 2 Z" fill="#f7fbff"/><path d="M50 2 L53 12 L56 2 Z" fill="#d5ebf8"/><path d="M70 2 L75 19 L80 2 Z" fill="#f4f9ff"/><path class="drip slow" d="M98 2 L104 27 L110 2 Z" fill="#e9f6ff"/><path d="M124 2 L128 14 L132 2 Z" fill="#f7fbff"/><path d="M144 2 L148 21 L152 2 Z" fill="#d7eef8"/></svg>`;
const frostSvg = html`<svg class="frost" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="lwFrost" cx="50%" cy="48%" r="72%"><stop offset="42%" stop-color="#f3f9ff" stop-opacity="0"/><stop offset="78%" stop-color="#e7f3ff" stop-opacity="0.34"/><stop offset="100%" stop-color="#f7fbff" stop-opacity="0.7"/></radialGradient></defs><rect class="veil" width="400" height="260" fill="url(#lwFrost)"/><g class="crystal" fill="none" stroke="#f7fbff" stroke-linecap="round"><path d="M0 52 C24 42 38 22 42 0" stroke-width="1.7"/><path d="M8 42 C16 28 18 16 15 2" stroke-width="1.15"/><path d="M16 36 C28 28 32 16 34 4" stroke-width="1.15"/><path d="M0 86 C18 76 24 64 22 50" stroke-width="1"/><path d="M400 56 C374 46 360 24 356 0" stroke-width="1.7"/><path d="M392 46 C382 32 380 18 383 4" stroke-width="1.15"/><path d="M384 40 C370 32 366 18 364 6" stroke-width="1.15"/><path d="M400 92 C382 82 376 70 378 56" stroke-width="1"/><path d="M0 206 C26 192 36 214 50 260" stroke-width="1.7"/><path d="M10 220 C20 210 22 228 16 250" stroke-width="1.15"/><path d="M20 214 C32 220 36 236 32 254" stroke-width="1.15"/><path d="M400 198 C370 184 358 214 344 260" stroke-width="1.7"/><path d="M388 212 C376 204 374 224 380 248" stroke-width="1.15"/><path d="M378 206 C364 214 360 232 364 252" stroke-width="1.15"/><path d="M96 0 C102 18 92 26 80 30" stroke-width="1.05"/><path d="M150 0 C154 14 146 18 138 16" stroke-width="1"/><path d="M292 0 C286 20 298 28 312 32" stroke-width="1.05"/><path d="M78 260 C86 242 76 232 62 226" stroke-width="1.05"/><path d="M318 260 C310 240 322 230 338 224" stroke-width="1.05"/><path d="M0 146 C20 138 26 152 16 166" stroke-width="1.05"/><path d="M400 136 C380 128 374 144 386 158" stroke-width="1.05"/></g></svg>`;
const driftSvg = html`<svg viewBox="0 0 120 40" aria-hidden="true"><ellipse cx="26" cy="36" rx="38" ry="16" fill="#f7fbff"/><ellipse cx="72" cy="38" rx="48" ry="15" fill="#e4eef8"/><ellipse cx="16" cy="34" rx="24" ry="13" fill="#ffffff"/><circle cx="18" cy="20" r="1.7" fill="#fff"/><circle cx="42" cy="16" r="1.2" fill="#fff" opacity="0.85"/><circle cx="74" cy="18" r="1.5" fill="#fff"/></svg>`;
const umbrellaSvg = html`<svg class="umbrella" viewBox="0 0 96 100" aria-hidden="true"><path d="M10 42 Q10 14 48 12 Q86 14 86 42 Q76 52 66 42 Q56 52 48 42 Q40 52 30 42 Q20 52 10 42 Z" fill="#e85d4c"/><path d="M18 40 Q28 30 38 40 Q48 30 58 40 Q68 30 78 40 Q84 32 86 42 Q76 34 66 42 Q56 34 48 42 Q40 34 30 42 Q20 34 10 42 Q14 34 18 40 Z" fill="#ffb1a3"/><path d="M48 14 L48 42 M30 18 L34 42 M66 18 L62 42" stroke="#a33b32" stroke-width="1.3" fill="none"/><circle cx="48" cy="12" r="2.6" fill="#f0c14a"/><path d="M48 42 L62 84" stroke="#6b4a32" stroke-width="3" stroke-linecap="round"/><path d="M62 84 Q74 90 78 80" fill="none" stroke="#6b4a32" stroke-width="3" stroke-linecap="round"/></svg>`;
const bootsSvg = html`<svg class="boots" viewBox="0 0 70 40" aria-hidden="true"><ellipse class="puddle" cx="40" cy="36" rx="26" ry="4" fill="#8eb4c9"/><path d="M14 6 H28 V24 H42 V34 H10 V16 Q10 6 14 6 Z" fill="#e2b043"/><path d="M10 30 H42 V34 H10 Z" fill="#b7842c"/><path d="M14 6 H28 V9 H14 Z" fill="#fff1c2"/><path d="M26 10 H40 V26 H58 V36 H22 V18 Q22 10 26 10 Z" fill="#ffd56a"/><path d="M22 32 H58 V36 H22 Z" fill="#c49234"/><path d="M26 10 H40 V13 H26 Z" fill="#fff6d4"/></svg>`;
const stormSvg = html`<svg class="storm" viewBox="0 0 96 84" aria-hidden="true"><ellipse cx="30" cy="24" rx="24" ry="15" fill="#3c4760"/><ellipse cx="52" cy="18" rx="28" ry="17" fill="#2a3346"/><ellipse cx="74" cy="26" rx="18" ry="13" fill="#515c76"/><ellipse cx="46" cy="28" rx="22" ry="11" fill="#1c2433"/><path class="bolt b1" d="M34 30 L27 48 H36 L29 66"/><path class="bolt b2" d="M54 28 L61 44 H51 L59 62"/><path class="bolt b3" d="M74 32 L68 46 H75 L70 58"/></svg>`;
const shadesSvg = html`<svg class="shades" viewBox="0 0 74 28" aria-hidden="true"><rect x="6" y="6" width="26" height="16" rx="6" fill="#1a1c24"/><rect x="42" y="6" width="26" height="16" rx="6" fill="#1a1c24"/><path d="M32 14 H42" stroke="#1a1c24" stroke-width="3"/><path d="M6 13 H1 M68 13 H73" stroke="#1a1c24" stroke-width="2"/><rect x="10" y="9" width="12" height="4" rx="2" fill="#8fd4ff" opacity="0.7"/></svg>`;
const rainbowSvg = html`<svg class="rainbow" viewBox="0 0 90 46" aria-hidden="true"><path d="M6 42 A39 39 0 0 1 84 42" stroke="#ff5a5a" stroke-width="4" fill="none"/><path d="M12 42 A33 33 0 0 1 78 42" stroke="#ffb020" stroke-width="4" fill="none"/><path d="M18 42 A27 27 0 0 1 72 42" stroke="#ffe14a" stroke-width="4" fill="none"/><path d="M24 42 A21 21 0 0 1 66 42" stroke="#5dce7a" stroke-width="4" fill="none"/><path d="M30 42 A15 15 0 0 1 60 42" stroke="#4aa3e8" stroke-width="4" fill="none"/></svg>`;
const leafSvg = (color) => html`<svg viewBox="0 0 22 16" aria-hidden="true"><path d="M2 9 C7 1 18 2 20 8 C13 7 8 12 2 14 C5 11 4 10 2 9Z" fill="${color}"/></svg>`;
const burstSvg = (color) => html`<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 V14 M20 26 V37 M3 20 H14 M26 20 H37 M8 8 L15 15 M25 25 L32 32 M32 8 L25 15 M15 25 L8 32" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const turkeySvg = html`<svg class="turkey" viewBox="0 0 90 78" aria-hidden="true"><g class="tail"><ellipse cx="20" cy="34" rx="12" ry="18" fill="#8a3020"/><ellipse cx="70" cy="34" rx="12" ry="18" fill="#a33b32"/><ellipse cx="34" cy="22" rx="10" ry="16" fill="#d4652f"/><ellipse cx="56" cy="22" rx="10" ry="16" fill="#e07a3a"/><ellipse cx="45" cy="16" rx="9" ry="14" fill="#f0a35c"/></g><ellipse cx="45" cy="48" rx="18" ry="14" fill="#8a4b2a"/><ellipse cx="45" cy="40" rx="12" ry="10" fill="#c45a2a"/><circle cx="45" cy="28" r="8" fill="#d4652f"/><circle cx="42" cy="27" r="1.3" fill="#1a1020"/><circle cx="48" cy="27" r="1.3" fill="#1a1020"/><path d="M45 30 L52 33 L45 34" fill="#f0c14a"/><path d="M45 22 Q50 14 47 12" stroke="#e23d3d" stroke-width="2" fill="none"/><path d="M38 60 L36 72 M52 60 L54 72" stroke="#e2b043" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const cornSvg = html`<svg class="corn" viewBox="0 0 110 64" aria-hidden="true"><path d="M86 44 C100 30 78 8 52 16 C32 22 16 42 28 52 C44 64 76 58 86 44 Z" fill="#c48a3a"/><path d="M78 40 C64 26 42 24 34 36" stroke="#e2b043" stroke-width="4" fill="none"/><circle cx="22" cy="30" r="8" fill="#e23d3d"/><circle cx="14" cy="42" r="7" fill="#f0c14a"/><circle cx="30" cy="48" r="7" fill="#6aaa4a"/><circle cx="16" cy="24" r="5" fill="#7a3e9d"/><circle cx="36" cy="28" r="5" fill="#e07a3a"/></svg>`;
const potSvg = html`<svg class="pot" viewBox="0 0 54 40" aria-hidden="true"><ellipse cx="27" cy="32" rx="22" ry="7" fill="#000" opacity="0.35"/><path d="M8 16 H46 L42 32 Q42 38 27 38 Q12 38 12 32 Z" fill="#3d3424"/><path d="M12 20 H42" stroke="#f0c14a" stroke-width="3"/><ellipse cx="27" cy="16" rx="18" ry="6" fill="#5c4a2a"/><ellipse cx="27" cy="14" rx="12" ry="5" fill="#f0c14a"/><circle cx="20" cy="12" r="3.4" fill="#ffe08a"/><circle cx="27" cy="11" r="3.6" fill="#fff1b8"/><circle cx="34" cy="13" r="3" fill="#ffe08a"/></svg>`;
const bowSvg = html`<svg class="bow" viewBox="0 0 120 64" aria-hidden="true"><path d="M8 58 A52 52 0 0 1 112 58" stroke="#ff5a5a" stroke-width="5" fill="none"/><path d="M16 58 A44 44 0 0 1 104 58" stroke="#ffb020" stroke-width="5" fill="none"/><path d="M24 58 A36 36 0 0 1 96 58" stroke="#ffe14a" stroke-width="5" fill="none"/><path d="M32 58 A28 28 0 0 1 88 58" stroke="#5dce7a" stroke-width="5" fill="none"/><path d="M40 58 A20 20 0 0 1 80 58" stroke="#4aa3e8" stroke-width="5" fill="none"/></svg>`;
const hogSvg = html`<svg class="hog" viewBox="0 0 80 52" aria-hidden="true"><ellipse cx="40" cy="46" rx="26" ry="7" fill="#3a2a18"/><ellipse cx="40" cy="28" rx="16" ry="13" fill="#c48a5a"/><ellipse cx="40" cy="32" rx="8" ry="6" fill="#f0d2a8"/><circle cx="34" cy="26" r="1.7" fill="#1a140e"/><circle cx="46" cy="26" r="1.7" fill="#1a140e"/><ellipse cx="40" cy="32" rx="3.2" ry="2.2" fill="#6b4224"/><path d="M37 34 L36 39 M43 34 L44 39" stroke="#f7f4ee" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="24" cy="34" rx="6" ry="4" fill="#a86b3c"/><ellipse cx="56" cy="34" rx="6" ry="4" fill="#a86b3c"/></svg>`;
const catSvg = html`<svg class="cat" viewBox="0 0 72 56" aria-hidden="true"><path class="tail" d="M54 40 Q68 36 64 22" fill="none" stroke="#c9c4d6" stroke-width="4" stroke-linecap="round"/><ellipse cx="34" cy="40" rx="16" ry="12" fill="#2a2438" stroke="#c9c4d6" stroke-width="1.6"/><circle cx="28" cy="24" r="10" fill="#2a2438" stroke="#c9c4d6" stroke-width="1.6"/><path d="M20 22 L16 8 L28 18Z" fill="#2a2438" stroke="#c9c4d6" stroke-width="1.2" stroke-linejoin="round"/><path d="M36 22 L42 8 L30 18Z" fill="#2a2438" stroke="#c9c4d6" stroke-width="1.2" stroke-linejoin="round"/><ellipse cx="24" cy="24" rx="2.2" ry="2.6" fill="#ffe14a"/><ellipse cx="33" cy="24" rx="2.2" ry="2.6" fill="#ffe14a"/><circle cx="24" cy="24.4" r="1" fill="#1a140e"/><circle cx="33" cy="24.4" r="1" fill="#1a140e"/><path d="M28 28 L30 30 L26 30" fill="#f0a0b8"/><path d="M22 46 L20 52 M40 46 L42 52" stroke="#c9c4d6" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const pinataSvg = html`<svg class="pinata" viewBox="0 0 64 70" aria-hidden="true"><path d="M32 4 V16" stroke="#f6e2b8" stroke-width="2"/><path d="M32 18 L46 30 L40 48 L24 48 L18 30 Z" fill="#e23d3d"/><path d="M32 18 L40 32 L32 46 L24 32 Z" fill="#ffd24a"/><path d="M24 32 L32 46 L22 44 Z" fill="#5dce7a"/><path d="M40 32 L32 46 L42 44 Z" fill="#4aa3e8"/><path d="M22 48 L18 60 M28 48 L26 62 M34 48 L36 62 M42 48 L46 58" stroke="#f0c14a" stroke-width="2" stroke-linecap="round"/></svg>`;
const maracasSvg = html`<svg class="maracas" viewBox="0 0 78 48" aria-hidden="true"><g class="rattle left"><circle cx="18" cy="16" r="10" fill="#e23d3d"/><path d="M18 8 V16 M12 16 H24" stroke="#ffd24a" stroke-width="1.6"/><path d="M24 24 L40 42" stroke="#c48a3a" stroke-width="4" stroke-linecap="round"/></g><g class="rattle right"><circle cx="58" cy="14" r="10" fill="#5dce7a"/><path d="M58 6 V14 M52 14 H64" stroke="#fff" stroke-width="1.6"/><path d="M50 22 L34 42" stroke="#c48a3a" stroke-width="4" stroke-linecap="round"/></g></svg>`;
const flakeSvg = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 V15 M1 8 H15 M3.2 3.2 L12.8 12.8 M12.8 3.2 L3.2 12.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function skyFall(kind) {
  if (kind === "snow") {
    const flakes = ["a s1", "b s2", "a s3", "b s4", "a s5", "b s6", "a s7"].map(
      (cls) => html`<span class="flake ${cls}">${flakeSvg}</span>`
    );
    return html`<span class="sky" aria-hidden="true">${flakes}</span>`;
  }
  const drops = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"].map((cls) => html`<span class="drop ${cls}"></span>`);
  return html`<span class="sky" aria-hidden="true">${drops}<span class="splash p1"></span><span class="splash p2"></span><span class="splash p3"></span></span>`;
}

function holidayDecor(holiday) {
  if (holiday === "halloween") return html`<span class="bats" aria-hidden="true"><span class="flyer f1">${batSvg}</span><span class="flyer f2">${batSvg}</span><span class="flyer f3">${batSvg}</span></span>${wolfSvg}`;
  if (holiday === "christmas") return html`<svg class="santa" viewBox="0 0 70 52" aria-hidden="true"><path d="M8 40 C18 18 36 6 62 16 L54 34 C36 20 20 28 12 40Z" fill="#e23d3d"/><ellipse cx="16" cy="40" rx="14" ry="6.5" fill="#fff"/><circle cx="60" cy="16" r="7" fill="#fff"/></svg>`;
  if (holiday === "easter") return html`<svg class="ears" viewBox="0 0 90 78" aria-hidden="true"><g class="ear left"><ellipse cx="28" cy="42" rx="11" ry="30" fill="#f6f1e8"/><ellipse cx="28" cy="44" rx="5.5" ry="20" fill="#f4b4c8"/></g><g class="ear right"><ellipse cx="62" cy="42" rx="11" ry="30" fill="#f6f1e8"/><ellipse cx="62" cy="44" rx="5.5" ry="20" fill="#f4b4c8"/></g></svg>`;
  if (holiday === "valentine") return html`<span class="hearts" aria-hidden="true"><svg class="heart h1" viewBox="0 0 32 30"><path d="M16 26 C4 16 2 8 8 5 C12 3 16 7 16 7 C16 7 20 3 24 5 C30 8 28 16 16 26Z" fill="#ff4d6d"/></svg><svg class="heart h2" viewBox="0 0 32 30"><path d="M16 26 C4 16 2 8 8 5 C12 3 16 7 16 7 C16 7 20 3 24 5 C30 8 28 16 16 26Z" fill="#ff8fab"/></svg></span>`;
  if (holiday === "newyear") return html`<svg class="party" viewBox="0 0 48 64" aria-hidden="true"><path d="M24 6 L42 50 L6 50 Z" fill="#5b6ee1"/><path d="M24 6 L34 50 L28 50 Z" fill="#ffd24a"/><path d="M24 6 L16 50 L20 50 Z" fill="#f04a7a"/><ellipse cx="24" cy="50" rx="18" ry="6" fill="#3d4db5"/><circle cx="24" cy="7" r="4.5" fill="#fff"/></svg>`;
  return "";
}

function chosenHoliday(config, date) {
  const pick = config.holiday;
  if (!pick || pick === "auto") return holidayFor(date);
  if (pick === "none") return "";
  return pick;
}

class LunarWeatherCard extends LitElement {
  static get properties() {
    return { _config: {}, hass: {} };
  }

  static getConfigElement() {
    return document.createElement("lunar-weather-card-editor");
  }

  static getStubConfig(hass, unusedEntities, allEntities) {
    const pool = [...(unusedEntities || []), ...(allEntities || [])];
    return { entity: pool.find((eid) => eid.startsWith("weather.")) || "" };
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Please choose a weather entity");
    this._config = config;
    this._forecastEntity = undefined;
    this._dropForecast();
  }

  connectedCallback() {
    super.connectedCallback();
    this._ensureForecast();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._dropForecast();
  }

  _dropForecast() {
    const jobs = this._forecastUnsubs || [];
    this._forecastUnsubs = [];
    jobs.forEach((unsub) => {
      if (typeof unsub === "function") unsub();
    });
  }

  _ensureForecast() {
    const entity = this._config?.entity;
    const hass = this._hass;
    if (!entity || !hass?.connection?.subscribeMessage) return;
    if (this._forecastEntity === entity && this._forecastUnsubs?.length) return;
    this._dropForecast();
    this._forecastEntity = entity;
    this._forecastUnsubs = [];
    for (const kind of ["hourly", "daily"]) {
      const pending = hass.connection.subscribeMessage(
        (msg) => {
          const rows = Array.isArray(msg) ? msg : msg?.forecast || [];
          if (kind === "hourly") this._hours = rows;
          else this._days = rows;
          this.requestUpdate();
        },
        { type: "weather/subscribe_forecast", forecast_type: kind, entity_id: entity }
      );
      Promise.resolve(pending).then((unsub) => {
        if (this._forecastEntity !== entity) {
          if (typeof unsub === "function") unsub();
          return;
        }
        this._forecastUnsubs.push(unsub);
      }).catch(() => {});
    }
  }

  getCardSize() {
    return 4;
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    this._ensureForecast();
    if (!old || !this._config) {
      this.requestUpdate();
      return;
    }
    const station = String(this._config.station_prefix || "").trim();
    const ids = [this._config.entity, "sun.sun"];
    if (station) ids.push(`sensor.${station}_temp`, `sensor.${station}_humidity`, `sensor.${station}_daily_rain`, `sensor.${station}_wind_gust`, `sensor.${station}_wind_speed`, `sensor.${station}_wind_direction_cardinal`);
    if (ids.some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }

  get hass() {
    return this._hass;
  }

  _num(kind, fallback) {
    const station = String(this._config.station_prefix || "").trim();
    if (!station) return fallback;
    const n = Number(this.hass.states[`sensor.${station}_${kind}`]?.state);
    return Number.isFinite(n) ? n : fallback;
  }

  _text(kind) {
    const station = String(this._config.station_prefix || "").trim();
    if (!station) return "";
    const s = this.hass.states[`sensor.${station}_${kind}`]?.state;
    if (!s || s === "unknown" || s === "unavailable" || s === "none") return "";
    return s;
  }

  _unit(kind, fallback) {
    const station = String(this._config.station_prefix || "").trim();
    if (!station) return fallback;
    return this.hass.states[`sensor.${station}_${kind}`]?.attributes?.unit_of_measurement || fallback;
  }

  _clock(date) {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  _open() {
    fire(this, "hass-more-info", { entityId: this._config.entity });
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) {
      return html`<ha-card><div class="missing">Entity not available: ${this._config.entity}</div></ha-card>`;
    }

    const today = new Date();
    const holiday = chosenHoliday(this._config, today);
    const { phase, name } = moonPhase(today);
    const pie = today.getMonth() === 2 && today.getDate() === 14;
    const earth = today.getMonth() === 3 && today.getDate() === 22;
    const friday = today.getDate() === 13 && today.getDay() === 5;
    const cover = cloudCover(stateObj);
    const icon = moonGraphic(phase, cover, holiday === "halloween" ? "halloween" : name === "Blood Moon" ? "blood" : pie ? "pie" : earth ? "earth" : "");
    const temp = this._num("temp", stateObj.attributes.temperature);
    const unit = this.hass.config.unit_system.temperature || "";
    const shown = unit === "°F" ? Math.round(temp) : temp;
    const sun = this.hass.states["sun.sun"];
    const rising = sun?.attributes?.next_rising ? this._clock(new Date(sun.attributes.next_rising)) : "";
    const setting = sun?.attributes?.next_setting ? this._clock(new Date(sun.attributes.next_setting)) : "";
    const humidity = Math.round(this._num("humidity", stateObj.attributes.humidity));
    const rain = this._num("daily_rain", null);
    const rainText = Number.isFinite(rain) ? rain.toFixed(rain >= 1 ? 1 : 2) : "—";
    const speed = this._num("wind_speed", Number(stateObj.attributes.wind_speed));
    const dir = this._text("wind_direction_cardinal");
    const gustN = this._num("wind_gust", speed);
    const gust = Number.isFinite(gustN) ? `${Math.round(gustN)}${dir ? ` ${dir}` : ""}` : "—";
    const wind = Number.isFinite(speed) && dir
      ? html`${dir} ${Math.round(speed)}<span class="dim"> ${this._unit("wind_speed", "mph")}</span>`
      : html`${stateObj.attributes.wind_speed || "—"}`;
    const freezing = isFreezing(shown, unit);
    const subzero = isSubzero(shown, unit);
    const snowing = isSnowing(stateObj);
    const raining = isRaining(stateObj);
    const storm = isStorm(stateObj);
    const wet = raining || snowing || storm;
    const sunState = sun?.state || "";
    const hot = isHot(shown, unit);
    const gusty = strongGust(gustN, this._unit("wind_gust", "mph"));
    const meteors = meteorNight(today, cover, sunState);
    const bugs = fireflyEvening(today, shown, unit, sunState, wet);
    const july4 = today.getMonth() === 6 && today.getDate() === 4;
    const rainbow = showRainbow(sunState, rain, wet) && holiday !== "patrick";
    const frost = frostDue(this._hours, this._days, unit, today, shown) || subzero;

    return html`
      <ha-card class="${holiday}" @click="${this._open}">
        ${snowing ? html`<span class="drifts" aria-hidden="true"><span class="drift bl">${driftSvg}</span><span class="drift br">${driftSvg}</span><span class="drift tl">${driftSvg}</span><span class="drift tr">${driftSvg}</span></span>${skyFall("snow")}` : ""}
        ${raining ? html`<span class="rain-kit" aria-hidden="true">${umbrellaSvg}${bootsSvg}</span>${skyFall("rain")}` : ""}
        ${storm ? stormSvg : ""}
        ${frost ? frostSvg : ""}
        ${rainbow ? rainbowSvg : ""}
        ${gusty ? html`<span class="blow" aria-hidden="true"><span class="leaf l1">${leafSvg("#d4652f")}</span><span class="leaf l2">${leafSvg("#e2b043")}</span><span class="leaf l3">${leafSvg("#6aaa4a")}</span><span class="leaf l4">${leafSvg("#c4493a")}</span></span>` : ""}
        ${meteors ? html`<span class="meteors" aria-hidden="true"><span class="meteor m1"></span><span class="meteor m2"></span></span>` : ""}
        ${bugs ? html`<span class="bugs" aria-hidden="true"><span class="bug g1"></span><span class="bug g2"></span><span class="bug g3"></span></span>` : ""}
        ${july4 ? html`<span class="works" aria-hidden="true"><span class="fw w1">${burstSvg("#ff5a6a")}</span><span class="fw w2">${burstSvg("#ffd24a")}</span><span class="fw w3">${burstSvg("#7eb6ff")}</span></span>` : ""}
        ${holiday === "patrick" ? html`<span class="patr" aria-hidden="true">${bowSvg}${potSvg}</span>` : ""}
        ${holiday === "thanksgiving" ? html`<span class="feast" aria-hidden="true">${cornSvg}${turkeySvg}</span>` : ""}
        ${holiday === "groundhog" ? html`<span class="den" aria-hidden="true">${hogSvg}</span>` : ""}
        ${friday && holiday !== "cinco" ? html`<span class="omen" aria-hidden="true">${catSvg}</span>` : ""}
        ${holiday === "cinco" ? html`<span class="fiesta" aria-hidden="true">${pinataSvg}${maracasSvg}</span>` : ""}
        <div class="hero">
          <div class="moon${hot ? " hot" : ""}" style="background-image: url('${icon}')" role="img" aria-label="${name}">${holidayDecor(holiday)}${hot ? shadesSvg : ""}</div>
          <div class="phase">${name}</div>
          <div class="temp">${freezing ? html`<span class="icicles" aria-hidden="true">${icicleSvg}</span>` : ""}${shown}<span class="unit">${unit}</span></div>
        </div>
        <ul class="stats">
          <li><ha-icon icon="mdi:water-percent"></ha-icon>${humidity}<span class="dim"> %</span></li>
          <li><ha-icon icon="mdi:weather-windy"></ha-icon>${wind}</li>
          <li><ha-icon icon="mdi:weather-rainy"></ha-icon>Rain ${rainText}<span class="dim">"</span></li>
          <li><ha-icon icon="mdi:windsock"></ha-icon>Gust ${gust}</li>
          ${rising ? html`<li><ha-icon icon="mdi:weather-sunset-up"></ha-icon>${rising}</li>` : ""}
          ${setting ? html`<li><ha-icon icon="mdi:weather-sunset-down"></ha-icon>${setting}</li>` : ""}
        </ul>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      ha-card { cursor: pointer; padding: 14px 16px 16px; position: relative; overflow: hidden; }
      .missing { padding: 12px; }
      .hero {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-areas: "moon temp" "phase temp";
        align-items: center;
        column-gap: 8px;
        margin-bottom: 14px;
        position: relative;
        z-index: 2;
      }
      .moon {
        grid-area: moon;
        position: relative;
        width: 108px;
        height: 108px;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
      }
      .phase {
        grid-area: phase;
        width: 108px;
        margin-top: 2px;
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--secondary-text-color);
      }
      ha-card.halloween .phase { color: #f0a35c; }
      .temp {
        grid-area: temp;
        justify-self: end;
        position: relative;
        font-weight: 300;
        font-size: 60px;
        line-height: 0.85;
        color: var(--primary-text-color);
      }
      .icicles {
        position: absolute;
        left: -4px;
        right: -2px;
        bottom: 100%;
        height: 20px;
        margin-bottom: -7px;
        pointer-events: none;
      }
      .icicles svg { display: block; width: 100%; height: 100%; overflow: visible; }
      .icicles .drip { transform-box: fill-box; transform-origin: center top; animation: drip 3.6s ease-in-out infinite; }
      .icicles .slow { animation-duration: 4.8s; animation-delay: -1.4s; }
      .drifts { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
      .drift { position: absolute; display: block; }
      .drift svg { display: block; width: 100%; height: 100%; }
      .drift.bl { left: -6px; bottom: -8px; width: 108px; height: 38px; }
      .drift.br { right: -8px; bottom: -8px; width: 124px; height: 34px; transform: scaleX(-1); }
      .drift.tl { left: -4px; top: -6px; width: 64px; height: 22px; transform: scaleY(-1); }
      .drift.tr { right: -4px; top: -6px; width: 78px; height: 20px; transform: scale(-1); }
      .rain-kit { position: absolute; right: 0; bottom: 0; width: 118px; height: 96px; pointer-events: none; z-index: 0; }
      .storm { position: absolute; top: 10px; left: 22px; width: 92px; height: 74px; pointer-events: none; z-index: 5; overflow: visible; }
      .shades { position: absolute; width: 62px; height: 24px; left: 24px; top: 40px; z-index: 3; pointer-events: none; }
      .moon.hot::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent 28%, rgba(255, 214, 120, 0.34) 50%, transparent 72%);
        background-size: 100% 220%;
        animation: heat 2.6s ease-in-out infinite;
        pointer-events: none;
        z-index: 2;
      }
      .rainbow { position: absolute; width: 70px; height: 32px; left: 30px; top: 68px; z-index: 3; pointer-events: none; }
      .blow, .meteors, .bugs, .works { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
      .leaf, .meteor, .bug, .fw { position: absolute; pointer-events: none; }
      .leaf svg, .fw svg { display: block; width: 100%; height: 100%; }
      .l1 { top: 18%; width: 18px; height: 13px; animation: blow 5.2s linear infinite; }
      .l2 { top: 42%; width: 14px; height: 10px; animation: blow 6.4s linear infinite; animation-delay: -2s; }
      .l3 { top: 64%; width: 16px; height: 12px; animation: blow 4.6s linear infinite; animation-delay: -3.1s; }
      .l4 { top: 30%; width: 12px; height: 9px; animation: blow 7s linear infinite; animation-delay: -1.2s; }
      .meteor { width: 46px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, #fff); opacity: 0; }
      .m1 { top: 18%; left: 8%; animation: shoot 6.5s ease-in infinite; }
      .m2 { top: 36%; left: 30%; animation: shoot 8s ease-in infinite; animation-delay: -3.4s; }
      .bug { width: 7px; height: 7px; border-radius: 50%; background: #d6ff6a; box-shadow: 0 0 8px #d6ff6a; }
      .g1 { left: 18%; top: 46%; animation: glow 3.4s ease-in-out infinite; }
      .g2 { left: 58%; top: 28%; animation: glow 4.1s ease-in-out infinite; animation-delay: -1.4s; }
      .g3 { left: 74%; top: 62%; animation: glow 3.8s ease-in-out infinite; animation-delay: -2.2s; }
      .fw { width: 28px; height: 28px; }
      .fw path { fill: none; }
      .patr, .feast, .den, .omen, .fiesta { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
      .bow { position: absolute; left: 26%; bottom: 6px; width: 32%; height: 64px; }
      .pot { position: absolute; left: 56%; bottom: 0; width: 48px; height: 36px; }
      .corn { position: absolute; left: 37%; bottom: 2px; width: 58px; height: 34px; }
      .turkey { position: absolute; left: 50%; bottom: 0; width: 52px; height: 44px; transform-origin: 50% 90%; animation: waddle 1.5s ease-in-out infinite; }
      .turkey .tail { transform-box: fill-box; transform-origin: center bottom; animation: fan 1.5s ease-in-out infinite; }
      .hog { position: absolute; left: 42%; bottom: 0; width: 64px; height: 42px; transform-origin: 50% 100%; animation: peek 2.4s ease-in-out infinite; }
      .cat { position: absolute; left: 44%; bottom: 0; width: 62px; height: 48px; }
      .cat .tail { transform-box: fill-box; transform-origin: left bottom; animation: swish 1.6s ease-in-out infinite; }
      .pinata { position: absolute; left: 34%; bottom: 2px; width: 46px; height: 50px; transform-origin: 50% 0%; animation: sway 2.8s ease-in-out infinite; }
      .maracas { position: absolute; left: 48%; bottom: 0; width: 70px; height: 42px; }
      .maracas .rattle { transform-box: fill-box; transform-origin: 70% 90%; animation: shake 0.45s ease-in-out infinite; }
      .maracas .right { animation-delay: -0.2s; }
      .w1 { left: 16%; top: 8%; animation: pop 2.8s ease-out infinite; }
      .w2 { left: 46%; top: 16%; animation: pop 3.4s ease-out infinite; animation-delay: -1.1s; }
      .w3 { left: 70%; top: 6%; animation: pop 3s ease-out infinite; animation-delay: -2s; }
      .bolt { fill: none; stroke: #ffe56a; stroke-width: 3.2; stroke-linejoin: round; stroke-linecap: round; opacity: 0; filter: drop-shadow(0 0 3px #fff3b0); }
      .b1 { animation: bolt 2.6s ease-in-out infinite; }
      .b2 { animation: bolt 3.1s ease-in-out infinite; animation-delay: -1.2s; }
      .b3 { animation: bolt 2.2s ease-in-out infinite; animation-delay: -0.55s; }
      .umbrella { position: absolute; width: 86px; height: 90px; right: 2px; bottom: 2px; transform: rotate(-14deg); transform-origin: 78% 96%; animation: sway 3.4s ease-in-out infinite; }
      .boots { position: absolute; width: 58px; height: 34px; right: 4px; bottom: 2px; }
      .boots .puddle { transform-box: fill-box; transform-origin: center; animation: puddle 2.2s ease-in-out infinite; }
      .frost { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
      .frost .veil { animation: frostBreath 6.4s ease-in-out infinite; }
      .frost .crystal { animation: frostBreath 7.6s ease-in-out infinite; animation-delay: -2s; }
      .sky { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
      .flake, .drop, .splash { position: absolute; pointer-events: none; }
      .flake { top: -14px; }
      .flake svg { display: block; width: 100%; height: 100%; }
      .flake path { fill: none; }
      .s1 { left: 6%; width: 14px; height: 14px; animation: flakeA 6.2s linear infinite; }
      .s2 { left: 20%; width: 9px; height: 9px; animation: flakeB 7.4s linear infinite; animation-delay: -2s; }
      .s3 { left: 36%; width: 12px; height: 12px; animation: flakeA 5.6s linear infinite; animation-delay: -3.2s; }
      .s4 { left: 50%; width: 8px; height: 8px; animation: flakeB 6.8s linear infinite; animation-delay: -1.1s; }
      .s5 { left: 66%; width: 13px; height: 13px; animation: flakeA 7.8s linear infinite; animation-delay: -4.4s; }
      .s6 { left: 78%; width: 9px; height: 9px; animation: flakeB 5.4s linear infinite; animation-delay: -2.6s; }
      .s7 { left: 90%; width: 11px; height: 11px; animation: flakeA 6.6s linear infinite; animation-delay: -5s; }
      .drop {
        top: -18px;
        width: 6px;
        height: 10px;
        border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
        background: linear-gradient(#eef8ff, #3d9adf);
        opacity: 0;
      }
      .d1 { left: 8%; animation: rain 1.8s linear infinite; }
      .d2 { left: 22%; width: 5px; height: 8px; animation: rain 2.3s linear infinite; animation-delay: -0.7s; }
      .d3 { left: 36%; animation: rain 1.6s linear infinite; animation-delay: -1.2s; }
      .d4 { left: 48%; width: 7px; height: 11px; animation: rain 2.1s linear infinite; animation-delay: -0.4s; }
      .d5 { left: 62%; animation: rain 1.9s linear infinite; animation-delay: -1.6s; }
      .d6 { left: 76%; width: 5px; height: 8px; animation: rain 2.4s linear infinite; animation-delay: -0.9s; }
      .d7 { left: 88%; animation: rain 1.7s linear infinite; animation-delay: -1.4s; }
      .splash {
        bottom: 7px;
        height: 7px;
        border: 2px solid rgba(126, 198, 240, 0.95);
        border-radius: 50%;
        animation: splash 1.7s ease-out infinite;
      }
      .p1 { left: 12%; width: 16px; }
      .p2 { left: 42%; width: 22px; animation-delay: -0.6s; }
      .p3 { right: 28%; width: 14px; animation-delay: -1.15s; }
      .temp .unit {
        font-size: 22px;
        vertical-align: super;
        margin-left: 2px;
      }
      .stats {
        display: flex;
        flex-flow: row wrap;
        list-style: none;
        margin: 0;
        padding: 4px 2px 0;
        color: var(--primary-text-color);
        font-size: 17px;
        font-weight: 400;
        position: relative;
        z-index: 2;
      }
      .stats li { width: 50%; line-height: 1.85; box-sizing: border-box; }
      .stats li:nth-child(2n) { text-align: right; }
      .stats ha-icon { height: 24px; width: 24px; margin-right: 6px; color: var(--paper-item-icon-color); vertical-align: text-bottom; }
      .stats li:nth-child(2n) ha-icon { margin: 0 0 0 8px; float: right; }
      .dim { font-size: 0.8em; }
      .bats, .wolf, .santa, .ears, .hearts, .party, .flyer { position: absolute; pointer-events: none; }
      .bats { inset: 0; overflow: hidden; z-index: 3; }
      .flyer svg { display: block; width: 100%; height: auto; fill: #1a1028; }
      .f1 { width: 38px; top: 4px; left: 0; animation: drift1 6.4s ease-in-out infinite; }
      .f2 { width: 28px; top: 34px; left: 8px; animation: drift2 8s ease-in-out infinite; }
      .f3 { width: 22px; top: 56px; left: 2px; animation: drift3 5.6s ease-in-out infinite; }
      .bat .wing { transform-box: fill-box; animation: flap 0.42s ease-in-out infinite; }
      .bat .left { transform-origin: right center; }
      .bat .right { transform-origin: left center; animation-direction: reverse; }
      .wolf { width: 46px; height: 58px; right: -2px; bottom: -4px; z-index: 2; animation: howl 2.6s ease-in-out infinite; }
      .santa, .party { z-index: 2; transform-origin: 50% 90%; animation: tip 3s ease-in-out infinite; }
      .santa { width: 58px; height: 44px; top: 2px; left: 30px; }
      .party { width: 38px; height: 50px; top: 0; left: 36px; }
      .ears { width: 76px; height: 64px; top: -2px; left: 10px; z-index: 2; }
      .ears .ear { transform-box: fill-box; transform-origin: center bottom; }
      .ears .left { animation: earL 2.8s ease-in-out infinite; }
      .ears .right { animation: earR 2.8s ease-in-out infinite; }
      .hearts { inset: 0; overflow: hidden; }
      .heart { position: absolute; width: 16px; height: 15px; }
      .h1 { left: 16px; top: 28px; animation: floaty 3.2s ease-in-out infinite; }
      .h2 { left: 46px; top: 44px; width: 12px; animation: floaty 3.8s ease-in-out infinite; animation-delay: -1.2s; }
      @keyframes flap { 0%, 100% { transform: rotate(14deg); } 50% { transform: rotate(-24deg); } }
      @keyframes drift1 { 0%, 100% { transform: translate(0, 4px); } 50% { transform: translate(56px, 12px); } }
      @keyframes drift2 { 0%, 100% { transform: translate(50px, 0); } 50% { transform: translate(0, 10px); } }
      @keyframes drift3 { 0%, 100% { transform: translate(6px, 0); } 50% { transform: translate(46px, -8px); } }
      @keyframes howl { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-4px) rotate(5deg); } }
      @keyframes tip { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(6deg); } }
      @keyframes earL { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(4deg); } }
      @keyframes earR { 0%, 100% { transform: rotate(10deg); } 50% { transform: rotate(-4deg); } }
      @keyframes floaty { 0% { transform: translateY(6px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
      @keyframes drip { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(1.08); } }
      @keyframes sway { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(-6deg); } }
      @keyframes puddle { 0%, 100% { transform: scaleX(0.86); opacity: 0.45; } 50% { transform: scaleX(1.08); opacity: 0.8; } }
      @keyframes flakeA { 0% { transform: translate3d(0, -8px, 0) rotate(0deg); opacity: 0; } 14% { opacity: 0.95; } 100% { transform: translate3d(16px, 320px, 0) rotate(36deg); opacity: 0; } }
      @keyframes flakeB { 0% { transform: translate3d(0, -8px, 0) rotate(0deg); opacity: 0; } 14% { opacity: 0.9; } 100% { transform: translate3d(-18px, 320px, 0) rotate(-28deg); opacity: 0; } }
      @keyframes rain { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 0.95; } 86% { opacity: 0.8; } 100% { transform: translateY(320px); opacity: 0; } }
      @keyframes splash { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes frostBreath { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
      @keyframes bolt { 0%, 72%, 100% { opacity: 0; } 76% { opacity: 1; } 80% { opacity: 0.15; } 84% { opacity: 1; } 90% { opacity: 0; } }
      @keyframes heat { 0%, 100% { background-position: 0 0; opacity: 0.4; } 50% { background-position: 0 100%; opacity: 0.95; } }
      @keyframes blow { 0% { transform: translate3d(-30px, 8px, 0) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translate3d(460px, -24px, 0) rotate(200deg); opacity: 0; } }
      @keyframes shoot { 0%, 55% { transform: translate3d(0, 0, 0) rotate(24deg); opacity: 0; } 60% { opacity: 1; } 78% { transform: translate3d(210px, 80px, 0) rotate(24deg); opacity: 0; } 100% { opacity: 0; } }
      @keyframes glow { 0%, 100% { transform: translate(0, 0); opacity: 0.25; } 40% { opacity: 1; } 70% { transform: translate(10px, -14px); opacity: 0.7; } }
      @keyframes pop { 0%, 100% { transform: scale(0.2); opacity: 0; } 18% { opacity: 1; } 55% { transform: scale(1.35); opacity: 0; } }
      @keyframes waddle { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg) translateY(-3px); } }
      @keyframes peek { 0%, 100% { transform: translateY(1px); } 45%, 70% { transform: translateY(-3px); } }
      @keyframes swish { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(18deg); } }
      @keyframes shake { 0%, 100% { transform: rotate(-12deg); } 50% { transform: rotate(14deg); } }
      @keyframes fan { 0%, 100% { transform: scaleX(0.92); } 50% { transform: scaleX(1.06); } }
      @media (prefers-reduced-motion: reduce) {
        .flyer, .bat .wing, .wolf, .santa, .party, .ears .ear, .heart, .icicles .drip, .umbrella, .boots .puddle, .flake, .drop, .splash, .frost .veil, .frost .crystal, .bolt, .moon.hot::after, .leaf, .meteor, .bug, .fw, .turkey, .turkey .tail, .hog, .cat .tail, .pinata, .maracas .rattle { animation: none; }
        .bolt, .bug, .fw, .leaf { opacity: 0.9; }
      }
      @media (max-width: 460px) {
        .moon, .phase { width: 92px; }
        .moon { height: 92px; }
        .temp { font-size: 46px; }
        .rain-kit { transform: scale(0.86); transform-origin: bottom right; }
      }
    `;
  }
}

class LunarWeatherCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: {} };
  }

  setConfig(config) {
    this._config = config;
  }

  _entity(ev) {
    const value = ev.detail?.value;
    if (!this._config || value === undefined || value === this._config.entity) return;
    fire(this, "config-changed", { config: { ...this._config, entity: value } });
  }

  _prefix(ev) {
    const value = ev.target.value;
    if (!this._config || value === (this._config.station_prefix || "")) return;
    fire(this, "config-changed", { config: { ...this._config, station_prefix: value } });
  }

  render() {
    if (!this.hass || !this._config) return html``;
    return html`
      <div class="wrap">
        <ha-entity-picker
          label="Weather entity"
          .hass=${this.hass}
          .value=${this._config.entity || ""}
          .includeDomains=${["weather"]}
          allow-custom-entity
          @value-changed=${this._entity}
        ></ha-entity-picker>
        <ha-textfield
          label="Station prefix"
          helper="Optional. Leave blank to use the weather entity. Otherwise sensors named sensor.PREFIX_temp, _humidity, _daily_rain, _wind_speed, _wind_gust, and _wind_direction_cardinal."
          .value=${this._config.station_prefix || ""}
          @input=${this._prefix}
        ></ha-textfield>
      </div>
    `;
  }

  static get styles() {
    return css`
      .wrap { display: flex; flex-direction: column; gap: 16px; }
    `;
  }
}

if (!customElements.get("lunar-weather-card")) {
  customElements.define("lunar-weather-card-editor", LunarWeatherCardEditor);
  customElements.define("lunar-weather-card", LunarWeatherCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "lunar-weather-card",
    name: "Lunar Weather",
    description: "Moon phase, outdoor station readings, clouds, and holiday costumes.",
    preview: true,
  });
}
