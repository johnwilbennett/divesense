// ======================== IMMEDIATE SCROLL PREVENTION ========================
(function() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  document.addEventListener('DOMContentLoaded', function() {
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
})();

// ======================== STATIONS DATA ========================
const stations = [
  { name: "Cobh", county: "Co. Cork", lat: 51.85, lon: -8.3, worldtidesId: "cobh" },
  { name: "Kinsale", county: "Co. Cork", lat: 51.7, lon: -8.517, worldtidesId: "kinsale" },
  { name: "Baltimore", county: "Co. Cork", lat: 51.483, lon: -9.367, worldtidesId: "baltimore" },
  { name: "Dunmanus Harbour", county: "Co. Cork", lat: 51.533, lon: -9.667, worldtidesId: "dunmanus" },
  { name: "Castletownbere", county: "Co. Cork", lat: 51.65, lon: -9.9, worldtidesId: "castletownbere" },
  { name: "Valentia Harbour", county: "Co. Kerry", lat: 51.933, lon: -10.3, worldtidesId: "valentia" },
  { name: "Dingle Harbour", county: "Co. Kerry", lat: 52.117, lon: -10.25, worldtidesId: "dingle" }
];

// Global state
let currentStation = stations[1];
let currentDate = new Date();
let selectedChips = new Set();
let currentHour = new Date().getHours();
let currentMinute = new Date().getMinutes();
let currentCalendarMonth = new Date();

// Caches
let tideCache = new Map();        // key: stationId_dateStr
let weatherCache = new Map();     // key: stationName_dateStr
let swellCache = new Map();       // key: stationName_dateStr

// ======================== UTILITY FUNCTIONS ========================
function formatDateForAPI(date) {
  return date.getFullYear() + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getDate().toString().padStart(2, '0');
}

function formatDateDisplay(date) {
  return date.getDate().toString().padStart(2, '0') + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getFullYear();
}

function getSelectedTime() {
  return currentHour.toString().padStart(2, '0') + ":" + currentMinute.toString().padStart(2, '0');
}

// Ireland DST detection
function isDaylightSavingsTime(date) {
  const year = date.getFullYear();
  const lastMarch = new Date(year, 2, 31);
  const lastSundayMarch = new Date(lastMarch);
  lastSundayMarch.setDate(lastMarch.getDate() - lastMarch.getDay());
  lastSundayMarch.setHours(1, 0, 0, 0);
  const lastOctober = new Date(year, 9, 31);
  const lastSundayOctober = new Date(lastOctober);
  lastSundayOctober.setDate(lastOctober.getDate() - lastOctober.getDay());
  lastSundayOctober.setHours(1, 0, 0, 0);
  return date >= lastSundayMarch && date < lastSundayOctober;
}

function getIrishTimezone() {
  const now = new Date();
  return isDaylightSavingsTime(now) ? "GMT+1 (IST)" : "GMT (GMT)";
}

function convertUTCToIrishTime(utcHour, utcMinute, tideDateUTC) {
  const utcTimestamp = Date.UTC(tideDateUTC.getUTCFullYear(), tideDateUTC.getUTCMonth(), tideDateUTC.getUTCDate(), utcHour, utcMinute, 0);
  const localDate = new Date(utcTimestamp);
  return {
    hour: localDate.getHours(),
    minute: localDate.getMinutes(),
    timeStr: localDate.getHours().toString().padStart(2, '0') + ":" + localDate.getMinutes().toString().padStart(2, '0')
  };
}

function getMoonIcon(phaseName) {
  const icons = {
    "New Moon": "🌑",
    "Waxing Crescent": "🌒",
    "First Quarter": "🌓",
    "Waxing Gibbous": "🌔",
    "Full Moon": "🌕",
    "Waning Gibbous": "🌖",
    "Last Quarter": "🌗",
    "Waning Crescent": "🌘"
  };
  return icons[phaseName] || "🌙";
}

function getMoonPhase(date) {
  const lunarCycle = 29.53058867;
  const knownNewMoon = new Date(2024, 0, 11);
  const diffDays = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = (diffDays % lunarCycle) / lunarCycle;
  if (phase < 0.0625) return "New Moon";
  if (phase < 0.1875) return "Waxing Crescent";
  if (phase < 0.3125) return "First Quarter";
  if (phase < 0.4375) return "Waxing Gibbous";
  if (phase < 0.5625) return "Full Moon";
  if (phase < 0.6875) return "Waning Gibbous";
  if (phase < 0.8125) return "Last Quarter";
  if (phase < 0.9375) return "Waning Crescent";
  return "New Moon";
}

function getTideTypeFromMoonPhase(date) {
  const knownNewMoon = new Date(2024, 0, 11);
  const diffDays = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const lunarCycle = 29.53058867;
  const phase = (diffDays % lunarCycle) / lunarCycle;
  const distanceToNew = Math.min(phase, 1 - phase);
  const distanceToFull = Math.abs(phase - 0.5);
  const distanceToSpring = Math.min(distanceToNew, distanceToFull);
  const daysToSpring = distanceToSpring * lunarCycle;
  if (daysToSpring < 2) return "Springs";
  if (daysToSpring > 5) return "Neaps";
  return daysToSpring < 3.5 ? "Springs" : "Neaps";
}

// Wind & swell arrows
const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function degreesToDirection(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return windDirections[index];
}
function getWindArrow(deg) {
  if (deg>=337.5 || deg<22.5) return "↓";
  if (deg>=22.5 && deg<67.5) return "↙";
  if (deg>=67.5 && deg<112.5) return "←";
  if (deg>=112.5 && deg<157.5) return "↖";
  if (deg>=157.5 && deg<202.5) return "↑";
  if (deg>=202.5 && deg<247.5) return "↗";
  if (deg>=247.5 && deg<292.5) return "→";
  return "↘";
}
const getSwellArrow = getWindArrow;

const weatherIcons = { clear: '☀️', partlyCloudy: '⛅', cloudy: '☁️', rain: '🌧️' };
function getWeatherIcon(cloudCover, rain) {
  if (rain > 0.5) return weatherIcons.rain;
  if (cloudCover > 70) return weatherIcons.cloudy;
  if (cloudCover > 30) return weatherIcons.partlyCloudy;
  return weatherIcons.clear;
}

function hapticFeedback() {
  const el = document.activeElement;
  if (el) { el.classList.add('haptic-feedback'); setTimeout(() => el.classList.remove('haptic-feedback'), 100); }
}
function showLoading() { const ov = document.getElementById('loadingOverlay'); if (ov) ov.style.display = 'flex'; }
function hideLoading() { const ov = document.getElementById('loadingOverlay'); if (ov) ov.style.display = 'none'; }

function updateTimeLabel() {
  const timeLabel = document.getElementById('timeLabel');
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let r of diveTypeRadios) if (r.checked) { diveType = r.value; break; }
  const prefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  const tz = getIrishTimezone();
  if (timeLabel) timeLabel.innerHTML = prefix + ': <span style="color: #2FFFEF; font-weight: bold;">' + getSelectedTime() + '</span> <span style="color: #1AA7A7; font-size: 10px;">(' + tz + ')</span>';
}

// ======================== API CALLS WITH CACHING ========================
async function fetchRealTideData(station, date) {
  const cacheKey = station.worldtidesId + "_" + formatDateForAPI(date);
  const now = Date.now();
  if (tideCache.has(cacheKey)) {
    const cached = tideCache.get(cacheKey);
    if (now - cached.timestamp < 21600000) return cached.data;
    else tideCache.delete(cacheKey);
  }
  try {
    const formattedDate = formatDateForAPI(date);
    const apiUrl = "/api/tides?station=" + station.worldtidesId + "&date=" + formattedDate;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error || !data.extremes || !data.extremes.length) {
      const fallback = { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
      tideCache.set(cacheKey, { data: fallback, timestamp: now });
      return fallback;
    }
    let tideType = "Unknown";
    if (data.spring !== undefined) tideType = data.spring === 1 ? "Springs" : "Neaps";
    else tideType = getTideTypeFromMoonPhase(date);

    const selectedDateStr = date.toLocaleDateString('en-GB', { timeZone: 'Europe/Dublin' });
    let tideEvents = [];

    for (let extreme of data.extremes) {
      const tideUTC = new Date(extreme.dt * 1000);
      // Get the local (Irish) date of this tide
      const localDateStr = tideUTC.toLocaleDateString('en-GB', { timeZone: 'Europe/Dublin' });
      if (localDateStr !== selectedDateStr) continue; // only keep tides that fall on the selected date in Irish time

      const local = convertUTCToIrishTime(tideUTC.getUTCHours(), tideUTC.getUTCMinutes(), tideUTC);
      tideEvents.push({
        type: extreme.type === "High" ? "High" : "Low",
        time: local.timeStr,
        height: extreme.height,
        timestamp: extreme.dt * 1000
      });
    }
    tideEvents.sort((a,b) => a.timestamp - b.timestamp);
    const tideData = {
      events: tideEvents,
      moonPhase: getMoonPhase(date),
      moonIcon: getMoonIcon(getMoonPhase(date)),
      tideType: tideType,
      timezone: getIrishTimezone()
    };
    tideCache.set(cacheKey, { data: tideData, timestamp: now });
    return tideData;
  } catch (error) {
    console.error("Error fetching tide data:", error);
    return { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
  }
}

async function fetchRealWeather(station, date) {
  try {
    const lat = station.lat, lon = station.lon, dateStr = formatDateForAPI(date);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,rain,cloudcover,temperature_2m,uv_index&daily=sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    const resp = await fetch(weatherUrl);
    if (!resp.ok) throw new Error("Weather API error");
    const data = await resp.json();
    const kmhToBft = (kmh) => { if (kmh<1) return 0; if (kmh<6) return 1; if (kmh<12) return 2; if (kmh<20) return 3; if (kmh<29) return 4; if (kmh<39) return 5; if (kmh<50) return 6; if (kmh<62) return 7; if (kmh<75) return 8; if (kmh<89) return 9; if (kmh<103) return 10; if (kmh<118) return 11; return 12; };
    const hourly = [];
    for (let i=0; i<data.hourly.time.length && i<24; i++) {
      const hour = new Date(data.hourly.time[i]).getHours();
      hourly.push({
        time: hour.toString().padStart(2,'0')+":00",
        windSpeed: kmhToBft(data.hourly.wind_speed_10m[i]),
        windDir: data.hourly.wind_direction_10m[i] || 0,
        gusts: kmhToBft(data.hourly.wind_gusts_10m[i] || 0),
        visibility: (data.hourly.visibility[i] || 20000)/1000,
        rain: data.hourly.rain[i] || 0,
        cloudCover: data.hourly.cloudcover[i] || 0,
        airTemp: data.hourly.temperature_2m[i] || 12,
        uvIndex: data.hourly.uv_index[i] || 0
      });
    }
    let sunrise = null, sunset = null;
    if (data.daily && data.daily.sunrise && data.daily.sunrise.length) {
      sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Dublin' });
      sunset = new Date(data.daily.sunset[0]).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Dublin' });
    }
    return { hourly, sunrise, sunset };
  } catch(e) { console.error(e); const empty = []; for (let h=0;h<24;h++) empty.push({ time:h.toString().padStart(2,'0')+":00", windSpeed:0, windDir:0, gusts:0, visibility:0, rain:0, cloudCover:0, airTemp:0, uvIndex:0, error:true }); return { hourly:empty, sunrise:null, sunset:null }; }
}

async function fetchRealSwellData(station, date) {
  try {
    const lat = station.lat, lon = station.lon, dateStr = formatDateForAPI(date);
    const swellUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction,wave_period&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    const resp = await fetch(swellUrl);
    if (!resp.ok) throw new Error("Swell API error");
    const data = await resp.json();
    const hourly = [];
    for (let i=0; i<data.hourly.time.length && i<24; i++) {
      const hour = new Date(data.hourly.time[i]).getHours();
      hourly.push({ time: hour.toString().padStart(2,'0')+":00", swellHeight: data.hourly.wave_height[i] || 0.5, swellDir: data.hourly.wave_direction[i] || 0, swellPeriod: data.hourly.wave_period[i] || 5 });
    }
    return hourly;
  } catch(e) { console.error(e); const fall = []; for (let h=0;h<24;h++) fall.push({ time:h.toString().padStart(2,'0')+":00", swellHeight:0.8, swellDir:180, swellPeriod:6, error:true }); return fall; }
}

// Cached versions
async function fetchWeatherWithCache(station, date) {
  const key = `${station.name}_${formatDateForAPI(date)}`;
  if (weatherCache.has(key)) return weatherCache.get(key);
  const data = await fetchRealWeather(station, date);
  weatherCache.set(key, data);
  return data;
}
async function fetchSwellWithCache(station, date) {
  const key = `${station.name}_${formatDateForAPI(date)}`;
  if (swellCache.has(key)) return swellCache.get(key);
  const data = await fetchRealSwellData(station, date);
  swellCache.set(key, data);
  return data;
}

// ======================== ROBUST CLOSEST EXTREMES (prev & next, any type) ========================
async function getClosestExtremes(station, diveDate, diveHour, diveMinute) {
  // Helper to fetch tides for a date range and convert to absolute minutes
  async function fetchTidesForRange(startDelta, endDelta) {
    const all = [];
    for (let delta = startDelta; delta <= endDelta; delta++) {
      const d = new Date(diveDate);
      d.setDate(diveDate.getDate() + delta);
      const tideData = await fetchRealTideData(station, d);
      for (const e of tideData.events) {
        const [h, m] = e.time.split(':').map(Number);
        const minutesInDay = h * 60 + m;
        const absoluteMinutes = delta * 1440 + minutesInDay;
        all.push({
          ...e,
          dayOffset: delta,
          minutesInDay: minutesInDay,
          absoluteMinutes: absoluteMinutes,
          date: d
        });
      }
    }
    return all;
  }

  // First try -1, 0, +1 days
  let allTides = await fetchTidesForRange(-1, 1);
  if (allTides.length === 0) return { prev: null, next: null };
  allTides.sort((a,b) => a.absoluteMinutes - b.absoluteMinutes);
  const targetAbsolute = diveHour * 60 + diveMinute;
  let prev = null, next = null;
  for (let i = 0; i < allTides.length; i++) {
    if (allTides[i].absoluteMinutes <= targetAbsolute) prev = allTides[i];
    if (allTides[i].absoluteMinutes >= targetAbsolute && next === null) next = allTides[i];
  }

  // If both prev and next exist and have the same type, we are missing an opposite extreme.
  // This can happen if the API did not return a tide due to date boundary issues.
  // Fetch an extra day on the side where the missing tide should be.
  if (prev && next && prev.type === next.type) {
    console.warn("Both prev and next have same type, fetching additional day...");
    let extraDelta = (prev.type === "High") ? -2 : 2; // if both High, the missing Low is after next? Actually after High comes Low, so check +2 days.
    // Better: fetch both -2 and +2
    const extraTides = await fetchTidesForRange(-2, 2);
    extraTides.sort((a,b) => a.absoluteMinutes - b.absoluteMinutes);
    // Recompute prev/next using the larger set
    let newPrev = null, newNext = null;
    for (let i = 0; i < extraTides.length; i++) {
      if (extraTides[i].absoluteMinutes <= targetAbsolute) newPrev = extraTides[i];
      if (extraTides[i].absoluteMinutes >= targetAbsolute && newNext === null) newNext = extraTides[i];
    }
    if (newPrev && newNext && newPrev.type !== newNext.type) {
      prev = newPrev;
      next = newNext;
    } else {
      // Fallback: keep original but log error
      console.error("Still missing opposite extreme after expanding range");
    }
  }

  return { prev, next };
}

// Tide direction using the closest extremes (physics-based)
async function getTideDirection(station, date, hour, minute) {
  const { prev, next } = await getClosestExtremes(station, date, hour, minute);
  const targetAbsolute = hour * 60 + minute;
  // Slack within 40 minutes of any extreme
  if (prev && Math.abs(targetAbsolute - prev.absoluteMinutes) <= 40) return "Slack Water ⚡";
  if (next && Math.abs(targetAbsolute - next.absoluteMinutes) <= 40) return "Slack Water ⚡";
  // If we have a previous extreme, direction is determined by its type
  if (prev) {
    if (prev.type === "High") return "Ebbing 🌊⬇️";
    if (prev.type === "Low") return "Flooding 🌊⬆️";
  }
  // Fallback (should not happen)
  if (next) {
    if (next.type === "High") return "Flooding 🌊⬆️";
    if (next.type === "Low") return "Ebbing 🌊⬇️";
  }
  return "No Data";
}

// ======================== UI BUILDING (unchanged except using new tide functions) ========================
function buildCalendar() { /* same as before */ 
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  let selectedDate = new Date(currentDate); selectedDate.setHours(0,0,0,0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate()+10);
  const minDate = today;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let html = `<div class="calendar-header"><div class="calendar-month-year">${monthNames[month]} ${year}</div><div class="calendar-nav"><button class="calendar-nav-btn" data-prev-month>&lt;</button><button class="calendar-nav-btn" data-next-month>&gt;</button></div></div><div class="calendar-weekdays"><div class="calendar-weekday">Su</div><div class="calendar-weekday">Mo</div><div class="calendar-weekday">Tu</div><div class="calendar-weekday">We</div><div class="calendar-weekday">Th</div><div class="calendar-weekday">Fr</div><div class="calendar-weekday">Sa</div></div><div class="calendar-days">`;
  for (let i=0; i<startDay; i++) html += '<div class="calendar-day other-month"></div>';
  for (let d=1; d<=daysInMonth; d++) {
    const cur = new Date(year, month, d); cur.setHours(0,0,0,0);
    const isSelected = cur.getTime() === selectedDate.getTime();
    const isToday = cur.getTime() === today.getTime();
    const isDisabled = cur < minDate || cur > maxDate;
    let classes = 'calendar-day';
    if (isSelected) classes += ' selected';
    if (isToday) classes += ' today';
    if (isDisabled) classes += ' disabled';
    html += `<div class="${classes}" data-date="${cur.toISOString()}">${d}</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  document.querySelectorAll('.calendar-day:not(.disabled):not(.other-month)').forEach(day => {
    day.addEventListener('click', () => { hapticFeedback(); currentDate = new Date(day.dataset.date); buildCalendar(); loadAllData(); });
  });
  document.querySelectorAll('.calendar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.prevMonth !== undefined) currentCalendarMonth.setMonth(currentCalendarMonth.getMonth()-1);
      else currentCalendarMonth.setMonth(currentCalendarMonth.getMonth()+1);
      buildCalendar();
    });
  });
}

function initStations() { /* same */
  const container = document.getElementById('stationScroll');
  if (!container) return;
  let html = '';
  stations.forEach((s,i) => {
    const active = s.name === currentStation.name ? 'active' : '';
    html += `<div class="station-card ${active}" data-idx="${i}">${s.name}<br><small>${s.county}</small></div>`;
  });
  container.innerHTML = html;
  document.querySelectorAll('.station-card').forEach(card => {
    card.addEventListener('click', () => { hapticFeedback(); currentStation = stations[parseInt(card.dataset.idx)]; initStations(); loadAllData(); });
  });
}

function initTimeSpinners() { /* same as corrected version */
  const hourWheel = document.getElementById('hourWheel');
  const minuteWheel = document.getElementById('minuteWheel');
  if (!hourWheel || !minuteWheel) return;
  hourWheel.innerHTML = ''; minuteWheel.innerHTML = '';
  const hourVals = [22,23,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1];
  for (let v of hourVals) { const opt = document.createElement('div'); opt.className = 'spinner-option'; opt.textContent = v.toString().padStart(2,'0'); opt.dataset.value = v; hourWheel.appendChild(opt); }
  const minuteVals = [58,59,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,0,1];
  for (let v of minuteVals) { const opt = document.createElement('div'); opt.className = 'spinner-option'; opt.textContent = v.toString().padStart(2,'0'); opt.dataset.value = v; minuteWheel.appendChild(opt); }
  function getRealHour(v) { if (v<0) return 0; if (v>23) return 23; return v; }
  function getRealMinute(v) { if (v<0) return 0; if (v>59) return 59; return v; }
  function updateHighlights() {
    document.querySelectorAll('#hourWheel .spinner-option').forEach(opt => { if (parseInt(opt.dataset.value) === currentHour) opt.classList.add('selected'); else opt.classList.remove('selected'); });
    document.querySelectorAll('#minuteWheel .spinner-option').forEach(opt => { if (parseInt(opt.dataset.value) === currentMinute) opt.classList.add('selected'); else opt.classList.remove('selected'); });
    updateTimeLabel();
  }
  let scrollTimeout;
  const handleScroll = () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(async () => {
      // hour
      const hourCenter = hourWheel.scrollTop + hourWheel.clientHeight/2;
      let closestHour = null, minHourDist = Infinity;
      for (let opt of hourWheel.children) {
        const rect = opt.getBoundingClientRect(), wheelRect = hourWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height/2, wheelCenter = wheelRect.top + wheelRect.height/2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minHourDist) { minHourDist = dist; closestHour = opt; }
      }
      if (closestHour) {
        let newHour = parseInt(closestHour.dataset.value);
        newHour = getRealHour(newHour);
        if (newHour !== currentHour) { currentHour = newHour; updateHighlights(); await updateDetailed(); }
      }
      // minute
      const minuteCenter = minuteWheel.scrollTop + minuteWheel.clientHeight/2;
      let closestMin = null, minMinDist = Infinity;
      for (let opt of minuteWheel.children) {
        const rect = opt.getBoundingClientRect(), wheelRect = minuteWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height/2, wheelCenter = wheelRect.top + wheelRect.height/2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minMinDist) { minMinDist = dist; closestMin = opt; }
      }
      if (closestMin) {
        let newMinute = parseInt(closestMin.dataset.value);
        newMinute = getRealMinute(newMinute);
        if (newMinute !== currentMinute) { currentMinute = newMinute; updateHighlights(); await updateDetailed(); }
      }
    }, 150);
  };
  hourWheel.addEventListener('scroll', handleScroll);
  minuteWheel.addEventListener('scroll', handleScroll);
  updateHighlights();
  function scrollToCurrentValue() {
    const hourOpt = Array.from(hourWheel.children).find(o => parseInt(o.dataset.value) === currentHour);
    const minOpt = Array.from(minuteWheel.children).find(o => parseInt(o.dataset.value) === currentMinute);
    if (hourOpt) hourOpt.scrollIntoView({ block: 'center' });
    if (minOpt) minOpt.scrollIntoView({ block: 'center' });
  }
  setTimeout(scrollToCurrentValue, 100);
  setTimeout(scrollToCurrentValue, 300);
}

function initDiveType() { /* same */
  const radios = document.querySelectorAll('input[name="diveType"]');
  const coxField = document.getElementById('coxField');
  const boatDepartureField = document.getElementById('boatDepartureField');
  const kittedBriefField = document.getElementById('kittedBriefField');
  const lifeJackets = document.getElementById('lifeJackets');
  const update = () => {
    const isBoat = document.querySelector('input[name="diveType"]:checked').value === 'Boat';
    if (coxField) coxField.style.display = isBoat ? 'block' : 'none';
    if (boatDepartureField) boatDepartureField.style.display = isBoat ? 'block' : 'none';
    if (kittedBriefField) kittedBriefField.style.display = isBoat ? 'none' : 'block';
    if (lifeJackets) lifeJackets.checked = isBoat;
    updateTimeLabel();
  };
  radios.forEach(r => r.addEventListener('change', update));
  update();
}

function initChips() { /* same */
  const categories = ["Reef","Wreck","Drift","Deep","Night","Snorkel","Kelp","Photography","Navigation","Training","Citizen Science","Fitness Test"];
  const container = document.getElementById('chipsContainer');
  if (!container) return;
  let html = '';
  categories.forEach(c => html += `<span data-chip="${c}">${c}</span>`);
  container.innerHTML = html;
  document.querySelectorAll('.chips span').forEach(chip => {
    chip.addEventListener('click', () => {
      hapticFeedback();
      chip.classList.toggle('active-chip');
      const name = chip.dataset.chip;
      if (chip.classList.contains('active-chip')) selectedChips.add(name);
      else selectedChips.delete(name);
      saveUserPreferences();
    });
  });
  renderChips();
}

function renderChips() {
  document.querySelectorAll('.chips span').forEach(chip => {
    if (selectedChips.has(chip.dataset.chip)) chip.classList.add('active-chip');
    else chip.classList.remove('active-chip');
  });
}

async function updateTides() {
  const tides = await fetchRealTideData(currentStation, currentDate);
  if (tides.error || !tides.events || tides.events.length === 0) {
    document.getElementById('tideData').innerHTML = '<div class="tide-event">⚠️ Tide data unavailable for this station/date</div>';
    return;
  }
  const tideTypeClass = tides.tideType === 'Springs' ? 'springs-text' : (tides.tideType === 'Neaps' ? 'neaps-text' : '');
  const tideTypeIcon = tides.tideType === 'Springs' ? '🌕' : (tides.tideType === 'Neaps' ? '🌙' : '');
  let html = '';
  if (tides.tideType !== 'Unknown') html += `<div class="${tideTypeClass}" style="font-size:1.2rem; margin-bottom:10px;">${tideTypeIcon} ${tides.tideType.toUpperCase()} TIDES</div>`;
  html += `<div class="text-small mb-2" style="text-align:center;">⏰ Times shown in ${tides.timezone}</div>`;
  tides.events.forEach(e => { html += `<div class="tide-event"><span>${e.type === 'High' ? '🌊 HIGH' : '⬇️ LOW'}</span><span>${e.time}</span><span>${e.height.toFixed(2)}m</span></div>`; });
  html += `<div class="text-small mt-2" style="background: rgba(47, 255, 238, 0.05); padding: 8px; border-radius: 8px;">📐 Heights relative to LAT (Lowest Astronomical Tide)</div>`;
  html += `<div class="text-small mt-2">${tides.moonIcon} ${tides.moonPhase}</div>`;
  document.getElementById('tideData').innerHTML = html;
}

async function updateHourly() {
  const weather = await fetchWeatherWithCache(currentStation, currentDate);
  const swell = await fetchSwellWithCache(currentStation, currentDate);
  const selectedHour = currentHour;
  const container = document.getElementById('hourlyScroll');
  if (!container) return;
  if (weather.hourly.length === 0 || (weather.hourly[0] && weather.hourly[0].error)) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">⚠️ Weather data unavailable</div>';
    return;
  }
  let html = '';
  for (let hour of weather.hourly) {
    const hourNum = parseInt(hour.time);
    const swellHour = swell.find(s => s.time === hour.time) || { swellHeight:0.5, swellPeriod:5, swellDir:0 };
    const tideDir = await getTideDirection(currentStation, currentDate, hourNum, 0);
    let tideIcon = tideDir.includes('Flooding') ? '⬆️' : (tideDir.includes('Ebbing') ? '⬇️' : (tideDir.includes('Slack') ? '⚡' : '❓'));
    const weatherIcon = getWeatherIcon(hour.cloudCover, hour.rain);
    const windArrow = getWindArrow(hour.windDir);
    const swellArrow = getSwellArrow(swellHour.swellDir);
    const highlight = hourNum === selectedHour ? 'highlight' : '';
    html += `<div class="hourly-card ${highlight}">
      <strong>${hour.time}</strong>
      <div>${weatherIcon} ${hour.windSpeed} Bft ${hour.windDir}° ${degreesToDirection(hour.windDir)} ${windArrow}</div>
      <div>🌊 ${swellHour.swellHeight.toFixed(1)}m / ${swellHour.swellPeriod}s ${swellHour.swellDir}° ${degreesToDirection(swellHour.swellDir)} ${swellArrow}</div>
      <div style="font-size: 10px; margin-top: 4px;">${tideIcon} ${tideDir}</div>
    </div>`;
  }
  container.innerHTML = html;
}

async function updateDetailed() {
  const weatherData = await fetchWeatherWithCache(currentStation, currentDate);
  const swell = await fetchSwellWithCache(currentStation, currentDate);
  const tides = await fetchRealTideData(currentStation, currentDate);
  const selectedHour = currentHour, selectedMinute = currentMinute;
  let hourWeather = weatherData.hourly.find(w => parseInt(w.time) === selectedHour) || weatherData.hourly[12];
  let hourSwell = swell.find(s => parseInt(s.time) === selectedHour) || { swellHeight:0.5, swellPeriod:5, swellDir:0 };
  const tideDir = await getTideDirection(currentStation, currentDate, selectedHour, selectedMinute);
  const weatherIcon = getWeatherIcon(hourWeather.cloudCover, hourWeather.rain);
  const windArrow = getWindArrow(hourWeather.windDir);
  const swellArrow = getSwellArrow(hourSwell.swellDir);

  let html = '';
  if (hourWeather && !hourWeather.error) {
    html = `<div class="detail-row"><strong>Wind:</strong> ${weatherIcon} ${hourWeather.windSpeed} Bft ${hourWeather.windDir}° ${degreesToDirection(hourWeather.windDir)} ${windArrow} (Gusts ${hourWeather.gusts} Bft)</div>`;
    html += `<div class="detail-row"><strong>Swell:</strong> ${hourSwell.swellHeight.toFixed(1)}m / ${hourSwell.swellPeriod}s ${hourSwell.swellDir}° ${degreesToDirection(hourSwell.swellDir)} ${swellArrow}</div>`;
    html += `<div class="detail-row"><strong>Rain:</strong> ${hourWeather.rain.toFixed(1)} mm</div>`;
    html += `<div class="detail-row"><strong>Visibility:</strong> ${hourWeather.visibility.toFixed(1)} km</div>`;
    html += `<div class="detail-row"><strong>Cloud Cover:</strong> ${hourWeather.cloudCover}%</div>`;
    html += `<div class="detail-row"><strong>Air Temp:</strong> ${hourWeather.airTemp.toFixed(1)}°C</div>`;
    html += `<div class="detail-row"><strong>UV Index:</strong> ${hourWeather.uvIndex}</div>`;
    if (weatherData.sunrise && weatherData.sunset) {
      html += `<div class="detail-row"><strong>Sunrise:</strong> ${weatherData.sunrise}</div>`;
      html += `<div class="detail-row"><strong>Sunset:</strong> ${weatherData.sunset}</div>`;
    }
  } else html = '<div class="detail-row">⚠️ Weather data unavailable</div>';

  const { prev, next } = await getClosestExtremes(currentStation, currentDate, selectedHour, selectedMinute);
  if (prev || next) {
    html += `<div class="detail-row" style="margin-top:12px;"><strong>📊 Relevant tides for this dive:</strong></div>`;
    if (prev) {
      let daySuffix = '';
      if (prev.dayOffset === -1) daySuffix = ' (previous day)';
      else if (prev.dayOffset === 1) daySuffix = ' (next day)';
      const diffMinutes = (selectedHour*60+selectedMinute) - prev.minutesInDay;
      const absDiff = Math.abs(diffMinutes);
      html += `<div class="detail-row">← Previous ${prev.type} at ${prev.time} (${prev.height.toFixed(2)}m)${daySuffix} - ${Math.floor(absDiff/60)}h ${absDiff%60}m before</div>`;
    }
    if (next) {
      let daySuffix = '';
      if (next.dayOffset === -1) daySuffix = ' (previous day)';
      else if (next.dayOffset === 1) daySuffix = ' (next day)';
      const diffMinutes = next.minutesInDay - (selectedHour*60+selectedMinute);
      const absDiff = Math.abs(diffMinutes);
      html += `<div class="detail-row">→ Next ${next.type} at ${next.time} (${next.height.toFixed(2)}m)${daySuffix} - ${Math.floor(absDiff/60)}h ${absDiff%60}m after</div>`;
    }
    html += `<div class="detail-row"><strong>🌊 Tide Direction:</strong> ${tideDir}</div>`;
    if (tides.tideType !== 'Unknown') html += `<div class="detail-row">${tides.tideType === 'Springs' ? '🌕 Spring tides expected (larger ranges)' : '🌙 Neap tides expected (smaller ranges)'}</div>`;
    html += `<div class="detail-row">${tides.moonIcon} ${tides.moonPhase}</div>`;
  } else if (tides.events.length === 0) html += '<div class="detail-row">⚠️ Tide data unavailable for this station/date</div>';
  document.getElementById('detailedPanel').innerHTML = html;
}

// ======================== EXPORT ========================
async function getFormattedExportText() {
  const diveSiteElem = document.getElementById('diveSite');
  const dodElem = document.getElementById('dod');
  const dodAsstElem = document.getElementById('dodAsst');
  const coxNameElem = document.getElementById('coxName');
  const maxDepthElem = document.getElementById('maxDepth');
  const torchesElem = document.getElementById('torches');
  const lifeJacketsElem = document.getElementById('lifeJackets');

  const diveSite = diveSiteElem ? diveSiteElem.value : '';
  const dod = dodElem ? dodElem.value : '';
  const dodAsst = dodAsstElem ? dodAsstElem.value : '';
  const coxName = coxNameElem ? coxNameElem.value : '';
  const maxDepth = maxDepthElem ? maxDepthElem.value : '';
  const torches = torchesElem ? torchesElem.checked : false;
  const lifeJackets = lifeJacketsElem ? lifeJacketsElem.checked : false;

  const coxModeRadios = document.querySelectorAll('input[name="coxMode"]');
  let coxMode = '';
  for (let r of coxModeRadios) if (r.checked) coxMode = r.value;
  const partRadios = document.querySelectorAll('input[name="participation"]');
  let participation = "Open to All";
  for (let r of partRadios) if (r.checked) participation = r.value;
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let r of diveTypeRadios) if (r.checked) diveType = r.value;
  const timePrefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';

  const weatherData = await fetchWeatherWithCache(currentStation, currentDate);
  const weather = weatherData.hourly;
  const swell = await fetchSwellWithCache(currentStation, currentDate);
  let hourWeather = weather.find(w => parseInt(w.time) === currentHour) || weather[12];
  let hourSwell = swell.find(s => parseInt(s.time) === currentHour) || { swellHeight:0, swellPeriod:0, swellDir:0 };

  const { prev, next } = await getClosestExtremes(currentStation, currentDate, currentHour, currentMinute);

  function formatTide(tide) {
    if (!tide) return 'N/A';
    let daySuffix = '';
    if (tide.dayOffset === -1) daySuffix = ' (previous day)';
    else if (tide.dayOffset === 1) daySuffix = ' (next day)';
    return `${tide.time} (${tide.height.toFixed(2)}m)${daySuffix}`;
  }

  const categories = Array.from(selectedChips).join(', ');
  const windArrow = getWindArrow(hourWeather.windDir);
  const swellArrow = getSwellArrow(hourSwell.swellDir);

  let weatherText = '';
  if (hourWeather && !hourWeather.error) {
    weatherText = getWeatherIcon(hourWeather.cloudCover, hourWeather.rain) + " Wind: " + hourWeather.windSpeed + " Bft " + hourWeather.windDir + "° " + degreesToDirection(hourWeather.windDir) + " " + windArrow + " (Gusts " + hourWeather.gusts + " Bft)\n";
    weatherText += "   Swell: " + hourSwell.swellHeight.toFixed(1) + "m / " + hourSwell.swellPeriod + "s " + hourSwell.swellDir + "° " + degreesToDirection(hourSwell.swellDir) + " " + swellArrow + "\n";
    weatherText += "   Visibility: " + hourWeather.visibility.toFixed(1) + " km\n";
    weatherText += "   Rain: " + hourWeather.rain.toFixed(1) + " mm\n";
    weatherText += "   Cloud Cover: " + hourWeather.cloudCover + "%\n";
    weatherText += "   Air Temp: " + hourWeather.airTemp.toFixed(1) + "°C\n";
    weatherText += "   UV Index: " + hourWeather.uvIndex;
  } else weatherText = 'Weather data unavailable';

  let text = "═══════════════════════════════════\n";
  text += "        🌊 DIVESENSE DIVE PLAN 🌊\n";
  text += "═══════════════════════════════════\n\n";
  text += "📅 DATE & TIME\n─────────────────────────────────\n";
  text += "Date: " + formatDateDisplay(currentDate) + "\n";
  text += "Time: " + getSelectedTime() + " (" + timePrefix + ")\n\n";
  text += "📍 LOCATION\n─────────────────────────────────\n";
  text += "Base Station: " + currentStation.name + "\n";
  text += "Coordinates: " + currentStation.lat + ", " + currentStation.lon + "\n";
  text += "Google Maps: https://www.google.com/maps?q=" + currentStation.lat + "," + currentStation.lon + "\n";
  text += "Dive Site: " + (diveSite || 'Not specified') + "\n";
  text += "Dive Type: " + diveType + "\n\n";
  text += "🌊 TIDES\n─────────────────────────────────\n";
  text += "Previous extreme: " + formatTide(prev) + "\n";
  text += "Next extreme:     " + formatTide(next) + "\n\n";
  text += "🌡️ CONDITIONS AT DIVE TIME\n─────────────────────────────────\n";
  text += weatherText + "\n";
  if (weatherData.sunrise && weatherData.sunset) text += "\nSunrise: " + weatherData.sunrise + "\nSunset: " + weatherData.sunset + "\n";
  text += "\n👥 CREW\n─────────────────────────────────\n";
  text += "DOD: " + (dod || 'Not specified') + "\n";
  text += "Assistant DOD: " + (dodAsst || 'None') + "\n";
  if (diveType === 'Boat') {
    text += "Cox'n: " + (coxName || 'N/A') + (coxMode ? " (" + coxMode + " Cox'n)" : "") + "\n";
    const boatDeparture = document.getElementById('boatDeparture')?.value || '';
    text += "Boat Departure Location: " + (boatDeparture || 'Not specified') + "\n";
  } else {
    const kittedBrief = document.getElementById('kittedBriefLocation')?.value || '';
    text += "Kitted Brief Location: " + (kittedBrief || 'Not specified') + "\n";
  }
  let partText = participation === "Open to All" ? "Open to All (with appropriate buddy pairs)" : "Restricted to D2+ (with appropriate buddy pairs)";
  text += "Participation: " + partText + "\n";
  text += "Max Depth: " + (maxDepth || 'N/A') + "m\n\n";
  text += "⚙️ EQUIPMENT & CATEGORIES\n─────────────────────────────────\n";
  if (torches) text += "✓ Torches Required\n";
  if (lifeJackets) text += "✓ Life Jackets Required\n";
  text += "Dive Categories: " + (categories || 'None selected') + "\n\n";
  text += "═══════════════════════════════════\n";
  text += "📚 DIVE BUDDIES, GRADES & DEPTHS\n";
  text += "═══════════════════════════════════\n";
  text += "Please see: https://drive.google.com/drive/folders/139b1VxbTvLtw-i1fd7CBdL_MhM5mCDdW?usp=sharing\n";
  text += "for DIVE BUDDIES, GRADES AND MAXIMUM DEPTHS\n\n";
  text += "─────────────────────────────────\n";
  text += "⚠️ Always verify with official sources\n";
  text += "Created with DiveSense - Dive Planning tool available on https://www.sultansofsurf.com\n";
  return text;
}

// ======================== SAVED PLANS ========================
let savedPlans = [];
function loadSavedPlans() { const s = localStorage.getItem('divesense_plans'); if (s) savedPlans = JSON.parse(s); renderSavedPlans(); }
function saveCurrentPlan() {
  const diveSite = document.getElementById('diveSite')?.value || 'Unnamed Dive';
  const planName = prompt('Enter a name for this dive plan:', diveSite);
  if (!planName) return;
  (async function() {
    const exportText = await getFormattedExportText();
    const diveType = document.querySelector('input[name="diveType"]:checked')?.value || 'Boat';
    const maxDepthElem = document.getElementById('maxDepth');
    const plan = {
      id: Date.now(), name: planName, exportText: exportText,
      station: currentStation.name, date: formatDateDisplay(currentDate), time: getSelectedTime(),
      diveType, maxDepth: maxDepthElem ? maxDepthElem.value : '',
      categories: Array.from(selectedChips)
    };
    savedPlans.unshift(plan);
    if (savedPlans.length > 10) savedPlans.pop();
    localStorage.setItem('divesense_plans', JSON.stringify(savedPlans));
    renderSavedPlans();
    showNotification('Plan saved successfully!');
  })();
}
function deleteSavedPlan(planId) {
  savedPlans = savedPlans.filter(p => p.id !== planId);
  localStorage.setItem('divesense_plans', JSON.stringify(savedPlans));
  renderSavedPlans();
  showNotification('Plan deleted');
}
function loadSavedPlan(plan) {
  const savedStation = stations.find(s => s.name === plan.station);
  if (savedStation) currentStation = savedStation;
  currentDate = new Date(plan.date.split('-').reverse().join('-'));
  const parts = plan.time.split(':');
  currentHour = parseInt(parts[0]); currentMinute = parseInt(parts[1]);
  const radios = document.querySelectorAll('input[name="diveType"]');
  for (let r of radios) if (r.value === plan.diveType) r.checked = true;
  const maxDepthElem = document.getElementById('maxDepth');
  if (maxDepthElem) maxDepthElem.value = plan.maxDepth;
  selectedChips.clear();
  plan.categories.forEach(cat => selectedChips.add(cat));
  initStations(); initTimeSpinners(); buildCalendar(); loadAllData();
  setTimeout(() => { renderChips(); showNotification('Loaded: ' + plan.name); }, 100);
}
function renderSavedPlans() {
  const container = document.getElementById('savedPlansContainer');
  if (!container) return;
  if (savedPlans.length === 0) { container.innerHTML = '<div class="saved-plans-empty">No saved plans yet. Save a plan below.</div>'; return; }
  let html = '';
  savedPlans.forEach(plan => {
    html += `<div class="saved-plan-item" data-plan-id="${plan.id}"><div><div class="saved-plan-name">${escapeHtml(plan.name)}</div><div class="saved-plan-details">${plan.station} | ${plan.date} | ${plan.time}</div></div><button class="delete-plan-btn" data-plan-id="${plan.id}">🗑️</button></div>`;
  });
  container.innerHTML = html;
  document.querySelectorAll('.saved-plan-item').forEach(item => {
    const planId = parseInt(item.dataset.planId);
    const plan = savedPlans.find(p => p.id === planId);
    if (plan) item.addEventListener('click', e => { if (!e.target.classList.contains('delete-plan-btn')) loadSavedPlan(plan); });
  });
  document.querySelectorAll('.delete-plan-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteSavedPlan(parseInt(btn.dataset.planId)); });
  });
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(47, 255, 238, 0.9); color: #020B24; padding: 10px 20px; border-radius: 30px; font-size: 12px; font-weight: bold; z-index: 2000; animation: fadeOut 2s forwards;';
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

// ======================== PREFERENCES ========================
function saveUserPreferences() {
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let r of diveTypeRadios) if (r.checked) { diveType = r.value; break; }
  const boatDeparture = document.getElementById('boatDeparture') ? document.getElementById('boatDeparture').value : '';
  const kittedBriefLocation = document.getElementById('kittedBriefLocation') ? document.getElementById('kittedBriefLocation').value : '';
  const preferences = {
    stationName: currentStation.name, diveType, selectedChips: Array.from(selectedChips),
    boatDeparture, kittedBriefLocation
  };
  localStorage.setItem('divesense_preferences', JSON.stringify(preferences));
}
function loadUserPreferences() {
  const saved = localStorage.getItem('divesense_preferences');
  if (saved) {
    const prefs = JSON.parse(saved);
    const savedStation = stations.find(s => s.name === prefs.stationName);
    if (savedStation) currentStation = savedStation;
    if (prefs.diveType) {
      const radios = document.querySelectorAll('input[name="diveType"]');
      for (let r of radios) if (r.value === prefs.diveType) r.checked = true;
    }
    if (prefs.selectedChips) prefs.selectedChips.forEach(chip => selectedChips.add(chip));
    if (prefs.boatDeparture && document.getElementById('boatDeparture')) document.getElementById('boatDeparture').value = prefs.boatDeparture;
    if (prefs.kittedBriefLocation && document.getElementById('kittedBriefLocation')) document.getElementById('kittedBriefLocation').value = prefs.kittedBriefLocation;
  }
}

// ======================== MAIN LOAD FUNCTION ========================
async function loadAllData() {
  showLoading();
  try {
    await updateTides();
    await updateHourly();
    await updateDetailed();
    saveUserPreferences();
  } catch(e) { console.error(e); }
  finally { hideLoading(); }
}

// ======================== EVENT LISTENERS ========================
const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
  maxDepthInput.addEventListener('change', function(e) {
    const depth = parseInt(e.target.value);
    if (depth >= 21) {
      const deepChip = Array.from(document.querySelectorAll('.chips span')).find(c => c.dataset.chip === 'Deep');
      if (deepChip && !deepChip.classList.contains('active-chip')) { deepChip.classList.add('active-chip'); selectedChips.add('Deep'); renderChips(); }
    }
    e.target.style.borderColor = (depth < 5 || depth > 45) ? '#ff4444' : '#1AA7A7';
  });
}
const whatsappBtn = document.getElementById('whatsappBtn');
if (whatsappBtn) {
  whatsappBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    const text = await getFormattedExportText();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      await navigator.clipboard.writeText(text);
      if (confirm("✅ Dive plan copied to clipboard!\n\nTap 'OK' to open WhatsApp, then paste the message."))
        window.location.href = "whatsapp://";
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  });
}
const emailBtn = document.getElementById('emailBtn');
if (emailBtn) {
  emailBtn.addEventListener('click', async function() {
    const text = await getFormattedExportText();
    const subject = `Dive Plan - ${document.getElementById('diveSite')?.value || 'Dive Plan'} - ${formatDateDisplay(currentDate)}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  });
}
const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
  copyBtn.addEventListener('click', async function() {
    const text = await getFormattedExportText();
    await navigator.clipboard.writeText(text);
    showNotification('Plan copied to clipboard!');
  });
}
const savePlanBtn = document.getElementById('savePlanBtn');
if (savePlanBtn) {
  savePlanBtn.addEventListener('click', function() { saveCurrentPlan(); });
}

// ======================== INITIALISATION ========================
function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0,0);
  loadUserPreferences();
  loadSavedPlans();
  initStations();
  initTimeSpinners();
  initDiveType();
  initChips();
  buildCalendar();
  loadAllData();
  setTimeout(() => window.scrollTo(0,0), 100);
  setTimeout(() => window.scrollTo(0,0), 500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();