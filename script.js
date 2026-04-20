// IMMEDIATE SCROLL PREVENTION - Runs before anything else
(function() {
  // Disable browser scroll restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  
  // Scroll to top immediately
  window.scrollTo(0, 0);
  
  // Prevent any focus on spinners
  document.addEventListener('DOMContentLoaded', function() {
    window.scrollTo(0, 0);
    
    // Remove focus from any element that might cause scroll
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });
})();

// STATIONS DATA with updated coordinates
const stations = [
  { name: "Cobh", county: "Co. Cork", lat: 51.85, lon: -8.3, worldtidesId: "cobh" },
  { name: "Kinsale", county: "Co. Cork", lat: 51.7, lon: -8.517, worldtidesId: "kinsale" },
  { name: "Baltimore", county: "Co. Cork", lat: 51.483, lon: -9.367, worldtidesId: "baltimore" },
  { name: "Dunmanus Harbour", county: "Co. Cork", lat: 51.533, lon: -9.667, worldtidesId: "dunmanus" },
  { name: "Castletownbere", county: "Co. Cork", lat: 51.65, lon: -9.9, worldtidesId: "castletownbere" },
  { name: "Valentia Harbour", county: "Co. Kerry", lat: 51.933, lon: -10.3, worldtidesId: "valentia" },
  { name: "Dingle Harbour", county: "Co. Kerry", lat: 52.117, lon: -10.25, worldtidesId: "dingle" }
];

let currentStation = stations[1];
let currentDate = new Date();
let selectedChips = new Set();
let currentHour = new Date().getHours();
let currentMinute = new Date().getMinutes();
let currentCalendarMonth = new Date();

let tideCache = new Map();

const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const weatherIcons = {
  clear: '☀️',
  partlyCloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️'
};

function getWeatherIcon(cloudCover, rain) {
  if (rain > 0.5) return weatherIcons.rain;
  if (cloudCover > 70) return weatherIcons.cloudy;
  if (cloudCover > 30) return weatherIcons.partlyCloudy;
  return weatherIcons.clear;
}

function degreesToDirection(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return windDirections[index];
}

function formatDateForAPI(date) {
  return date.getFullYear() + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getDate().toString().padStart(2, '0');
}

function formatDateDisplay(date) {
  return date.getDate().toString().padStart(2, '0') + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getFullYear();
}

// Check if Ireland is in Daylight Savings Time (GMT+1)
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
  if (isDaylightSavingsTime(now)) {
    return "GMT+1 (IST)";
  } else {
    return "GMT (GMT)";
  }
}

function convertUTCToIrishTime(utcHour, utcMinute, tideDateUTC) {
  const utcTimestamp = Date.UTC(
    tideDateUTC.getUTCFullYear(),
    tideDateUTC.getUTCMonth(),
    tideDateUTC.getUTCDate(),
    utcHour,
    utcMinute,
    0
  );
  
  const localDate = new Date(utcTimestamp);
  const localHour = localDate.getHours();
  const localMinute = localDate.getMinutes();
  
  return {
    hour: localHour,
    minute: localMinute,
    timeStr: localHour.toString().padStart(2, '0') + ":" + localMinute.toString().padStart(2, '0')
  };
}

// Get moon icon based on phase
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

// Calculate Spring/Neap from moon phase
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

function getSelectedTime() {
  return currentHour.toString().padStart(2, '0') + ":" + currentMinute.toString().padStart(2, '0');
}

function updateTimeLabel() {
  const timeLabel = document.getElementById('timeLabel');
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  const prefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  const timezone = getIrishTimezone();
  if (timeLabel) {
    timeLabel.innerHTML = prefix + ': <span style="color: #2FFFEF; font-weight: bold;">' + getSelectedTime() + '</span> <span style="color: #1AA7A7; font-size: 10px;">(' + timezone + ')</span>';
  }
}

function hapticFeedback() {
  const element = document.activeElement;
  if (element) {
    element.classList.add('haptic-feedback');
    setTimeout(function() { element.classList.remove('haptic-feedback'); }, 100);
  }
}

function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function saveUserPreferences() {
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  
  const boatDeparture = document.getElementById('boatDeparture') ? document.getElementById('boatDeparture').value : '';
  const kittedBriefLocation = document.getElementById('kittedBriefLocation') ? document.getElementById('kittedBriefLocation').value : '';
  
  const preferences = {
    stationName: currentStation.name,
    diveType: diveType,
    selectedChips: Array.from(selectedChips),
    boatDeparture: boatDeparture,
    kittedBriefLocation: kittedBriefLocation
  };
  localStorage.setItem('divesense_preferences', JSON.stringify(preferences));
}

function loadUserPreferences() {
  const saved = localStorage.getItem('divesense_preferences');
  if (saved) {
    const prefs = JSON.parse(saved);
    const savedStation = stations.find(function(s) { return s.name === prefs.stationName; });
    if (savedStation) currentStation = savedStation;
    if (prefs.diveType) {
      const radios = document.querySelectorAll('input[name="diveType"]');
      for (let i = 0; i < radios.length; i++) {
        if (radios[i].value === prefs.diveType) {
          radios[i].checked = true;
          break;
        }
      }
    }
    if (prefs.selectedChips) {
      prefs.selectedChips.forEach(function(chip) { selectedChips.add(chip); });
    }
    
    // Restore new fields
    if (prefs.boatDeparture && document.getElementById('boatDeparture')) {
      document.getElementById('boatDeparture').value = prefs.boatDeparture;
    }
    if (prefs.kittedBriefLocation && document.getElementById('kittedBriefLocation')) {
      document.getElementById('kittedBriefLocation').value = prefs.kittedBriefLocation;
    }
  }
}

let savedPlans = [];

function loadSavedPlans() {
  const saved = localStorage.getItem('divesense_plans');
  if (saved) {
    savedPlans = JSON.parse(saved);
  }
  renderSavedPlans();
}

// REAL TIDE DATA with fixed date filtering for 10+ days
async function fetchRealTideData(station, date) {
  const cacheKey = station.worldtidesId + "_" + formatDateForAPI(date);
  const now = Date.now();
  
  if (tideCache.has(cacheKey)) {
    const cached = tideCache.get(cacheKey);
    if (now - cached.timestamp < 21600000) {
      return cached.data;
    } else {
      tideCache.delete(cacheKey);
    }
  }
  
  try {
    const formattedDate = formatDateForAPI(date);
    const apiUrl = "/api/tides?station=" + station.worldtidesId + "&date=" + formattedDate;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      return { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
    }
    
    if (!data.extremes || data.extremes.length === 0) {
      return { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
    }
    
    // Determine Spring or Neaps
    let tideType = "Unknown";
    if (data.spring !== undefined) {
      tideType = data.spring === 1 ? "Springs" : "Neaps";
    } else {
      tideType = getTideTypeFromMoonPhase(date);
    }
    
    const selectedYear = date.getFullYear();
    const selectedMonth = date.getMonth();
    const selectedDay = date.getDate();
    
    // Fixed: Correct UTC date boundaries
    const selectedDateStart = new Date(Date.UTC(selectedYear, selectedMonth, selectedDay, 0, 0, 0));
    const selectedDateEnd = new Date(Date.UTC(selectedYear, selectedMonth, selectedDay, 23, 59, 59));
    
    let tideEvents = [];
    for (let i = 0; i < data.extremes.length; i++) {
      const extreme = data.extremes[i];
      const tideDateUTC = new Date(extreme.dt * 1000);
      
      // Check if tide falls on the selected date
      if (tideDateUTC >= selectedDateStart && tideDateUTC <= selectedDateEnd) {
        const utcHour = tideDateUTC.getUTCHours();
        const utcMinute = tideDateUTC.getUTCMinutes();
        const localTime = convertUTCToIrishTime(utcHour, utcMinute, tideDateUTC);
        
        tideEvents.push({
          type: extreme.type === "High" ? "High" : "Low",
          time: localTime.timeStr,
          height: extreme.height,
          timestamp: extreme.dt * 1000
        });
      }
    }
    
    // If no tides found for the selected date, try to get data from the API response
    if (tideEvents.length === 0 && data.extremes && data.extremes.length > 0) {
      for (let i = 0; i < data.extremes.length; i++) {
        const extreme = data.extremes[i];
        const tideDateUTC = new Date(extreme.dt * 1000);
        const utcHour = tideDateUTC.getUTCHours();
        const utcMinute = tideDateUTC.getUTCMinutes();
        const localTime = convertUTCToIrishTime(utcHour, utcMinute, tideDateUTC);
        
        const localDate = new Date(Date.UTC(selectedYear, selectedMonth, selectedDay, localTime.hour, localTime.minute, 0));
        if (localDate.getUTCFullYear() === selectedYear && 
            localDate.getUTCMonth() === selectedMonth && 
            localDate.getUTCDate() === selectedDay) {
          tideEvents.push({
            type: extreme.type === "High" ? "High" : "Low",
            time: localTime.timeStr,
            height: extreme.height,
            timestamp: extreme.dt * 1000
          });
        }
      }
    }
    
    tideEvents.sort(function(a, b) { return a.timestamp - b.timestamp; });
    
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

// REAL WEATHER DATA (wind, temp, etc.) WITH SUNRISE/SUNSET
async function fetchRealWeather(station, date) {
  try {
    const lat = station.lat;
    const lon = station.lon;
    const dateStr = formatDateForAPI(date);
    
    // Add daily parameters for sunrise/sunset
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,rain,cloudcover,temperature_2m,uv_index&daily=sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      throw new Error("Weather API error");
    }
    
    const data = await response.json();
    
    function kmhToBft(kmh) {
      if (kmh < 1) return 0;
      if (kmh < 6) return 1;
      if (kmh < 12) return 2;
      if (kmh < 20) return 3;
      if (kmh < 29) return 4;
      if (kmh < 39) return 5;
      if (kmh < 50) return 6;
      if (kmh < 62) return 7;
      if (kmh < 75) return 8;
      if (kmh < 89) return 9;
      if (kmh < 103) return 10;
      if (kmh < 118) return 11;
      return 12;
    }
    
    const hourly = [];
    for (let i = 0; i < data.hourly.time.length && i < 24; i++) {
      const time = new Date(data.hourly.time[i]);
      const hour = time.getHours();
      
      hourly.push({
        time: hour.toString().padStart(2, '0') + ":00",
        windSpeed: kmhToBft(data.hourly.wind_speed_10m[i]),
        windDir: data.hourly.wind_direction_10m[i] || 0,
        gusts: kmhToBft(data.hourly.wind_gusts_10m[i] || 0),
        visibility: (data.hourly.visibility[i] || 20000) / 1000,
        rain: data.hourly.rain[i] || 0,
        cloudCover: data.hourly.cloudcover[i] || 0,
        airTemp: data.hourly.temperature_2m[i] || 12,
        uvIndex: data.hourly.uv_index[i] || 0
      });
    }
    
    // Extract sunrise and sunset times
    let sunrise = null;
    let sunset = null;
    if (data.daily && data.daily.sunrise && data.daily.sunrise.length > 0) {
      const sunriseUTC = new Date(data.daily.sunrise[0]);
      const sunsetUTC = new Date(data.daily.sunset[0]);
      
      // Convert to local Irish time
      sunrise = sunriseUTC.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin' });
      sunset = sunsetUTC.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin' });
    }
    
    return { hourly: hourly, sunrise: sunrise, sunset: sunset };
    
  } catch (error) {
    console.error("Error fetching weather:", error);
    const emptyHourly = [];
    for (let hour = 0; hour < 24; hour++) {
      emptyHourly.push({
        time: hour.toString().padStart(2, '0') + ":00",
        windSpeed: 0,
        windDir: 0,
        gusts: 0,
        visibility: 0,
        rain: 0,
        cloudCover: 0,
        airTemp: 0,
        uvIndex: 0,
        error: true
      });
    }
    return { hourly: emptyHourly, sunrise: null, sunset: null };
  }
}

// REAL SWELL DATA from Open-Meteo Marine API
async function fetchRealSwellData(station, date) {
  try {
    const lat = station.lat;
    const lon = station.lon;
    const dateStr = formatDateForAPI(date);
    
    const swellUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_direction,wave_period&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    
    const response = await fetch(swellUrl);
    
    if (!response.ok) {
      throw new Error("Swell API error");
    }
    
    const data = await response.json();
    
    const hourly = [];
    for (let i = 0; i < data.hourly.time.length && i < 24; i++) {
      const time = new Date(data.hourly.time[i]);
      const hour = time.getHours();
      
      hourly.push({
        time: hour.toString().padStart(2, '0') + ":00",
        swellHeight: data.hourly.wave_height[i] || 0.5,
        swellDir: data.hourly.wave_direction[i] || 0,
        swellPeriod: data.hourly.wave_period[i] || 5
      });
    }
    return hourly;
    
  } catch (error) {
    console.error("Error fetching swell data:", error);
    const fallback = [];
    for (let hour = 0; hour < 24; hour++) {
      fallback.push({
        time: hour.toString().padStart(2, '0') + ":00",
        swellHeight: 0.8,
        swellDir: 180,
        swellPeriod: 6,
        error: true
      });
    }
    return fallback;
  }
}

function isSlackWaterTime(tideEvents, hour, minute) {
  if (!tideEvents || tideEvents.length === 0) return false;
  const totalMinutes = hour * 60 + minute;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    const diff = Math.abs(totalMinutes - tideMinutes);
    if (diff <= 40) return true;
  }
  return false;
}

// Arrow functions
function getWindArrow(windDirDeg) {
  if (windDirDeg >= 337.5 || windDirDeg < 22.5) return "↓";
  if (windDirDeg >= 22.5 && windDirDeg < 67.5) return "↙";
  if (windDirDeg >= 67.5 && windDirDeg < 112.5) return "←";
  if (windDirDeg >= 112.5 && windDirDeg < 157.5) return "↖";
  if (windDirDeg >= 157.5 && windDirDeg < 202.5) return "↑";
  if (windDirDeg >= 202.5 && windDirDeg < 247.5) return "↗";
  if (windDirDeg >= 247.5 && windDirDeg < 292.5) return "→";
  if (windDirDeg >= 292.5 && windDirDeg < 337.5) return "↘";
  return "→";
}

function getSwellArrow(swellDirDeg) {
  if (swellDirDeg >= 337.5 || swellDirDeg < 22.5) return "↓";
  if (swellDirDeg >= 22.5 && swellDirDeg < 67.5) return "↙";
  if (swellDirDeg >= 67.5 && swellDirDeg < 112.5) return "←";
  if (swellDirDeg >= 112.5 && swellDirDeg < 157.5) return "↖";
  if (swellDirDeg >= 157.5 && swellDirDeg < 202.5) return "↑";
  if (swellDirDeg >= 202.5 && swellDirDeg < 247.5) return "↗";
  if (swellDirDeg >= 247.5 && swellDirDeg < 292.5) return "→";
  if (swellDirDeg >= 292.5 && swellDirDeg < 337.5) return "↘";
  return "→";
}

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
  for (let i = 0; i < coxModeRadios.length; i++) {
    if (coxModeRadios[i].checked) {
      coxMode = coxModeRadios[i].value;
      break;
    }
  }
  
  const participationRadios = document.querySelectorAll('input[name="participation"]');
  let participation = "Open to All";
  for (let i = 0; i < participationRadios.length; i++) {
    if (participationRadios[i].checked) {
      participation = participationRadios[i].value;
      break;
    }
  }
  
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  
  const timePrefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  
  const weatherData = await fetchRealWeather(currentStation, currentDate);
  const weather = weatherData.hourly;
  const swell = await fetchRealSwellData(currentStation, currentDate);
  let hourWeather = null;
  let hourSwell = null;
  for (let i = 0; i < weather.length; i++) {
    if (parseInt(weather[i].time) === currentHour) {
      hourWeather = weather[i];
      break;
    }
  }
  for (let i = 0; i < swell.length; i++) {
    if (parseInt(swell[i].time) === currentHour) {
      hourSwell = swell[i];
      break;
    }
  }
  if (!hourWeather) hourWeather = weather[12];
  if (!hourSwell) hourSwell = { swellHeight: 0, swellPeriod: 0, swellDir: 0 };
  
  const tides = await fetchRealTideData(currentStation, currentDate);
  
  let prevTide = null;
  let nextTide = null;
  const targetMinutes = currentHour * 60 + currentMinute;
  for (let i = 0; i < tides.events.length; i++) {
    const tideParts = tides.events[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tides.events[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tides.events[i];
  }
  
  const highWater = (prevTide && prevTide.type === 'High') ? prevTide : ((nextTide && nextTide.type === 'High') ? nextTide : null);
  const lowWater = (prevTide && prevTide.type === 'Low') ? prevTide : ((nextTide && nextTide.type === 'Low') ? nextTide : null);
  
  const categories = Array.from(selectedChips).join(', ');
  const windArrow = getWindArrow(hourWeather.windDir);
  const swellArrow = getSwellArrow(hourSwell.swellDir);
  
  // Build weather text with each item on its own line
  let weatherText = '';
  if (hourWeather && !hourWeather.error) {
    weatherText = getWeatherIcon(hourWeather.cloudCover, hourWeather.rain) + " Wind: " + hourWeather.windSpeed + " Bft " + hourWeather.windDir + "° " + degreesToDirection(hourWeather.windDir) + " " + windArrow + " (Gusts " + hourWeather.gusts + " Bft)\n";
    weatherText += "   Swell: " + hourSwell.swellHeight.toFixed(1) + "m / " + hourSwell.swellPeriod + "s " + hourSwell.swellDir + "° " + degreesToDirection(hourSwell.swellDir) + " " + swellArrow + "\n";
    weatherText += "   Visibility: " + hourWeather.visibility.toFixed(1) + " km\n";
    weatherText += "   Rain: " + hourWeather.rain.toFixed(1) + " mm\n";
    weatherText += "   Cloud Cover: " + hourWeather.cloudCover + "%\n";
    weatherText += "   Air Temp: " + hourWeather.airTemp.toFixed(1) + "°C\n";
    weatherText += "   UV Index: " + hourWeather.uvIndex;
  } else {
    weatherText = 'Weather data unavailable';
  }
  
  // Build the export text with nice formatting
  let text = "═══════════════════════════════════\n";
  text += "        🌊 DIVESENSE DIVE PLAN 🌊\n";
  text += "═══════════════════════════════════\n\n";
  
  text += "📅 DATE & TIME\n";
  text += "─────────────────────────────────\n";
  text += "Date: " + formatDateDisplay(currentDate) + "\n";
  text += "Time: " + getSelectedTime() + " (" + timePrefix + ")\n\n";
  
  text += "📍 LOCATION\n";
  text += "─────────────────────────────────\n";
  text += "Base Station: " + currentStation.name + "\n";
  text += "Coordinates: " + currentStation.lat + ", " + currentStation.lon + "\n";
  text += "Google Maps: https://www.google.com/maps?q=" + currentStation.lat + "," + currentStation.lon + "\n";
  text += "Dive Site: " + (diveSite || 'Not specified') + "\n";
  text += "Dive Type: " + diveType + "\n\n";
  
  text += "🌊 TIDES\n";
  text += "─────────────────────────────────\n";
  text += "High Water: " + (highWater ? highWater.time + " (" + highWater.height.toFixed(2) + "m)" : 'N/A') + "\n";
  text += "Low Water: " + (lowWater ? lowWater.time + " (" + lowWater.height.toFixed(2) + "m)" : 'N/A') + "\n\n";
  
  text += "🌡️ CONDITIONS AT DIVE TIME\n";
  text += "─────────────────────────────────\n";
  text += weatherText + "\n";
  if (weatherData.sunrise && weatherData.sunset) {
    text += "\nSunrise: " + weatherData.sunrise + "\n";
    text += "Sunset: " + weatherData.sunset + "\n";
  }
  text += "\n";
  
  text += "👥 CREW\n";
  text += "─────────────────────────────────\n";
  text += "DOD: " + (dod || 'Not specified') + "\n";
  text += "Assistant DOD: " + (dodAsst || 'None') + "\n";
  
  // Only show Cox field for Boat dives
  if (diveType === 'Boat') {
    text += "Cox'n: " + (coxName || 'N/A') + (coxMode ? " (" + coxMode + " Cox'n)" : "") + "\n";
    
    // Show Boat Departure for Boat dives
    const boatDeparture = document.getElementById('boatDeparture') ? document.getElementById('boatDeparture').value : '';
    text += "Boat Departure Location: " + (boatDeparture || 'Not specified') + "\n";
  } else {
    // Show Kitted Brief Location for Shore dives
    const kittedBriefLocation = document.getElementById('kittedBriefLocation') ? document.getElementById('kittedBriefLocation').value : '';
    text += "Kitted Brief Location: " + (kittedBriefLocation || 'Not specified') + "\n";
  }
  
  // Update participation text
  let participationText = participation;
  if (participation === "Open to All") {
    participationText = "Open to All (with appropriate buddy pairs)";
  } else if (participation === "Restricted to D2+") {
    participationText = "Restricted to D2+ (with appropriate buddy pairs)";
  }
  text += "Participation: " + participationText + "\n";
  text += "Max Depth: " + (maxDepth || 'N/A') + "m\n\n";
  
  text += "⚙️ EQUIPMENT & CATEGORIES\n";
  text += "─────────────────────────────────\n";
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

function buildCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let selectedDate = new Date(currentDate);
  selectedDate.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 10);
  const minDate = today;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  let html = '<div class="calendar-header"><div class="calendar-month-year">' + monthNames[month] + ' ' + year + '</div><div class="calendar-nav"><button class="calendar-nav-btn" data-prev-month>&lt;</button><button class="calendar-nav-btn" data-next-month>&gt;</button></div></div><div class="calendar-weekdays"><div class="calendar-weekday">Su</div><div class="calendar-weekday">Mo</div><div class="calendar-weekday">Tu</div><div class="calendar-weekday">We</div><div class="calendar-weekday">Th</div><div class="calendar-weekday">Fr</div><div class="calendar-weekday">Sa</div></div><div class="calendar-days">';
  
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day other-month"></div>';
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDateObj = new Date(year, month, day);
    currentDateObj.setHours(0, 0, 0, 0);
    const isSelected = currentDateObj.getTime() === selectedDate.getTime();
    const isToday = currentDateObj.getTime() === today.getTime();
    const isDisabled = currentDateObj < minDate || currentDateObj > maxDate;
    
    let classes = 'calendar-day';
    if (isSelected) classes += ' selected';
    if (isToday) classes += ' today';
    if (isDisabled) classes += ' disabled';
    
    html += '<div class="' + classes + '" data-date="' + currentDateObj.toISOString() + '">' + day + '</div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
  
  const days = document.querySelectorAll('.calendar-day:not(.disabled):not(.other-month)');
  for (let i = 0; i < days.length; i++) {
    days[i].addEventListener('click', function() {
      hapticFeedback();
      const date = new Date(this.dataset.date);
      currentDate = date;
      buildCalendar();
      loadAllData();
    });
  }
  
  const navBtns = document.querySelectorAll('.calendar-nav-btn');
  for (let i = 0; i < navBtns.length; i++) {
    navBtns[i].addEventListener('click', function() {
      if (this.dataset.prevMonth !== undefined) {
        currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
      } else if (this.dataset.nextMonth !== undefined) {
        currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
      }
      buildCalendar();
    });
  }
}

function initStations() {
  const container = document.getElementById('stationScroll');
  if (!container) return;
  
  let html = '';
  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const activeClass = (station.name === currentStation.name) ? 'active' : '';
    html += '<div class="station-card ' + activeClass + '" data-idx="' + i + '">' + station.name + '<br><small>' + station.county + '</small></div>';
  }
  container.innerHTML = html;
  
  const cards = document.querySelectorAll('.station-card');
  for (let i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', function() {
      hapticFeedback();
      const idx = parseInt(this.dataset.idx);
      currentStation = stations[idx];
      initStations();
      loadAllData();
    });
  }
}

// FIXED: Extended spinner values with smooth scrolling and current time centered (Mobile + Desktop)
function initTimeSpinners() {
  const hourWheel = document.getElementById('hourWheel');
  const minuteWheel = document.getElementById('minuteWheel');
  if (!hourWheel || !minuteWheel) return;
  
  hourWheel.innerHTML = '';
  minuteWheel.innerHTML = '';
  
  // HOURS: Extended values to allow scrolling to 00, 01, 22, 23
  const hourValues = [22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
  for (let h = 0; h < hourValues.length; h++) {
    const val = hourValues[h];
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = val.toString().padStart(2, '0');
    option.dataset.value = val;
    hourWheel.appendChild(option);
  }
  
  // MINUTES: Extended values to allow scrolling to 00, 01, 58, 59
  const minuteValues = [58, 59, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 0, 1];
  for (let m = 0; m < minuteValues.length; m++) {
    const val = minuteValues[m];
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = val.toString().padStart(2, '0');
    option.dataset.value = val;
    minuteWheel.appendChild(option);
  }
  
  function getRealHourFromValue(val) {
    if (val < 0) return 0;
    if (val > 23) return 23;
    return val;
  }
  
  function getRealMinuteFromValue(val) {
    if (val < 0) return 0;
    if (val > 59) return 59;
    return val;
  }
  
  function updateHighlights() {
    const hourOptions = document.querySelectorAll('#hourWheel .spinner-option');
    for (let i = 0; i < hourOptions.length; i++) {
      if (parseInt(hourOptions[i].dataset.value) === currentHour) {
        hourOptions[i].classList.add('selected');
      } else {
        hourOptions[i].classList.remove('selected');
      }
    }
    const minuteOptions = document.querySelectorAll('#minuteWheel .spinner-option');
    for (let i = 0; i < minuteOptions.length; i++) {
      if (parseInt(minuteOptions[i].dataset.value) === currentMinute) {
        minuteOptions[i].classList.add('selected');
      } else {
        minuteOptions[i].classList.remove('selected');
      }
    }
    updateTimeLabel();
  }
  
  // IMPROVED: Smoother scrolling with requestAnimationFrame
  let scrollTimeout;
  let isScrolling = false;
  
  hourWheel.addEventListener('scroll', function() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(function() {
      const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      const options = hourWheel.children;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const rect = opt.getBoundingClientRect();
        const wheelRect = hourWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      }
      if (closest) {
        let newHour = parseInt(closest.dataset.value);
        newHour = getRealHourFromValue(newHour);
        if (newHour !== currentHour) {
          currentHour = newHour;
          updateHighlights();
          updateDetailed();
          updateHourly();
        }
      }
    }, 50);
  });
  
  minuteWheel.addEventListener('scroll', function() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(function() {
      const center = minuteWheel.scrollTop + minuteWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      const options = minuteWheel.children;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const rect = opt.getBoundingClientRect();
        const wheelRect = minuteWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      }
      if (closest) {
        let newMinute = parseInt(closest.dataset.value);
        newMinute = getRealMinuteFromValue(newMinute);
        if (newMinute !== currentMinute) {
          currentMinute = newMinute;
          updateHighlights();
          updateDetailed();
          updateHourly();
        }
      }
    }, 50);
  });
  
  updateHighlights();
  
  // FIXED: Scroll to current time with smooth behavior and ensure it's centered (Mobile + Desktop)
  function scrollToCurrentValue() {
    const hourOptions = document.querySelectorAll('#hourWheel .spinner-option');
    const minuteOptions = document.querySelectorAll('#minuteWheel .spinner-option');
    let hourElement = null;
    let minuteElement = null;
    
    // Find the hour element
    for (let i = 0; i < hourOptions.length; i++) {
      if (parseInt(hourOptions[i].dataset.value) === currentHour) {
        hourElement = hourOptions[i];
        break;
      }
    }
    
    // Find the minute element
    for (let i = 0; i < minuteOptions.length; i++) {
      if (parseInt(minuteOptions[i].dataset.value) === currentMinute) {
        minuteElement = minuteOptions[i];
        break;
      }
    }
    
    // Scroll to hour with center alignment
    if (hourElement) {
      hourElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    
    // Scroll to minute with center alignment
    if (minuteElement) {
      minuteElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  
  // Multiple attempts to ensure centering works on all devices
  // Short delay for initial render
  setTimeout(scrollToCurrentValue, 50);
  // Medium delay for images/fonts
  setTimeout(scrollToCurrentValue, 200);
  // Long delay for any async content
  setTimeout(scrollToCurrentValue, 500);
  // Final attempt after everything is fully loaded
  window.addEventListener('load', function() {
    setTimeout(scrollToCurrentValue, 100);
  });
}

// UPDATED: Show/hide fields based on dive type (Boat vs Shore)
function initDiveType() {
  const radios = document.querySelectorAll('input[name="diveType"]');
  const coxField = document.getElementById('coxField');
  const boatDepartureField = document.getElementById('boatDepartureField');
  const kittedBriefField = document.getElementById('kittedBriefField');
  const lifeJackets = document.getElementById('lifeJackets');
  
  for (let i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', function(e) {
      const isBoat = e.target.value === 'Boat';
      
      // Show/hide Cox field
      if (coxField) {
        coxField.style.display = isBoat ? 'block' : 'none';
      }
      
      // Show/hide Boat Departure field (only for Boat)
      if (boatDepartureField) {
        boatDepartureField.style.display = isBoat ? 'block' : 'none';
      }
      
      // Show/hide Kitted Brief Location field (only for Shore)
      if (kittedBriefField) {
        kittedBriefField.style.display = isBoat ? 'none' : 'block';
      }
      
      // Life Jackets default: ON for Boat, OFF for Shore
      if (lifeJackets) {
        lifeJackets.checked = isBoat;
      }
      
      updateTimeLabel();
      saveUserPreferences();
    });
  }
  
  // Set initial state (default is Boat)
  if (coxField) coxField.style.display = 'block';
  if (boatDepartureField) boatDepartureField.style.display = 'block';
  if (kittedBriefField) kittedBriefField.style.display = 'none';
  updateTimeLabel();
}

function renderChips() {
  const chips = document.querySelectorAll('.chips span');
  for (let i = 0; i < chips.length; i++) {
    if (selectedChips.has(chips[i].dataset.chip)) {
      chips[i].classList.add('active-chip');
    } else {
      chips[i].classList.remove('active-chip');
    }
  }
}

async function updateTides() {
  const tides = await fetchRealTideData(currentStation, currentDate);
  
  if (tides.error || !tides.events || tides.events.length === 0) {
    const tideDiv = document.getElementById('tideData');
    if (tideDiv) tideDiv.innerHTML = '<div class="tide-event">⚠️ Tide data unavailable for this station/date</div>';
    return;
  }
  
  const tideTypeClass = (tides.tideType === 'Springs') ? 'springs-text' : (tides.tideType === 'Neaps' ? 'neaps-text' : '');
  const tideTypeIcon = (tides.tideType === 'Springs') ? '🌕' : (tides.tideType === 'Neaps' ? '🌙' : '');
  
  let html = '';
  if (tides.tideType !== 'Unknown') {
    html += '<div class="' + tideTypeClass + '" style="font-size:1.2rem; margin-bottom:10px;">' + tideTypeIcon + ' ' + tides.tideType.toUpperCase() + ' TIDES</div>';
  }
  
  html += '<div class="text-small mb-2" style="text-align:center;">⏰ Times shown in ' + tides.timezone + '</div>';
  
  for (let i = 0; i < tides.events.length; i++) {
    const e = tides.events[i];
    const tideIcon = (e.type === 'High') ? '🌊 HIGH' : '⬇️ LOW';
    html += '<div class="tide-event"><span>' + tideIcon + '</span><span>' + e.time + '</span><span>' + e.height.toFixed(2) + 'm</span></div>';
  }
  
  html += '<div class="text-small mt-2" style="background: rgba(47, 255, 238, 0.05); padding: 8px; border-radius: 8px;">';
  html += '📐 Heights relative to LAT (Lowest Astronomical Tide) - the lowest predicted tide level over a full nodal cycle';
  html += '</div>';
  html += '<div class="text-small mt-2">' + tides.moonIcon + ' ' + tides.moonPhase + '</div>';
  
  const tideDiv = document.getElementById('tideData');
  if (tideDiv) tideDiv.innerHTML = html;
}

async function updateHourly() {
  const weatherData = await fetchRealWeather(currentStation, currentDate);
  const weather = weatherData.hourly;
  const swell = await fetchRealSwellData(currentStation, currentDate);
  const tides = await fetchRealTideData(currentStation, currentDate);
  const selectedHour = currentHour;
  const container = document.getElementById('hourlyScroll');
  if (!container) return;
  
  if (weather.length === 0 || (weather[0] && weather[0].error)) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">⚠️ Weather data unavailable</div>';
    return;
  }
  
  function getTideDirectionWithFallback(tideEvents, hour) {
    if (!tideEvents || tideEvents.length === 0) return "No Data";
    
    const targetMinutes = hour * 60;
    let prevTide = null;
    let nextTide = null;
    
    for (let i = 0; i < tideEvents.length; i++) {
      const tideParts = tideEvents[i].time.split(':');
      const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
      if (tideMinutes <= targetMinutes) {
        prevTide = tideEvents[i];
      }
      if (tideMinutes >= targetMinutes && !nextTide) {
        nextTide = tideEvents[i];
      }
    }
    
    if (!prevTide && nextTide) {
      return nextTide.type === "High" ? "Flooding 🌊⬆️" : "Ebbing 🌊⬇️";
    }
    
    if (prevTide && !nextTide) {
      return prevTide.type === "High" ? "Ebbing 🌊⬇️" : "Flooding 🌊⬆️";
    }
    
    if (prevTide && nextTide) {
      const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
      const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
      
      if (timeToPrev <= 40 || timeToNext <= 40) return "Slack Water ⚡";
      
      if (prevTide.type === "High" && nextTide.type === "Low") return "Ebbing 🌊⬇️";
      if (prevTide.type === "Low" && nextTide.type === "High") return "Flooding 🌊⬆️";
    }
    
    return "No Data";
  }
  
  let html = '';
  for (let i = 0; i < weather.length; i++) {
    const hour = weather[i];
    const swellHour = swell.find(s => s.time === hour.time) || { swellHeight: 0.5, swellPeriod: 5, swellDir: 0 };
    const hourNum = parseInt(hour.time);
    const tideDirection = getTideDirectionWithFallback(tides.events, hourNum);
    let tideIcon = '';
    if (tideDirection.includes('Flooding')) tideIcon = '⬆️';
    else if (tideDirection.includes('Ebbing')) tideIcon = '⬇️';
    else if (tideDirection.includes('Slack')) tideIcon = '⚡';
    else tideIcon = '❓';
    
    const weatherIcon = getWeatherIcon(hour.cloudCover, hour.rain);
    const windArrow = getWindArrow(hour.windDir);
    const swellArrow = getSwellArrow(swellHour.swellDir);
    const highlightClass = (hourNum === selectedHour) ? 'highlight' : '';
    
    html += '<div class="hourly-card ' + highlightClass + '">';
    html += '<strong>' + hour.time + '</strong>';
    html += '<div>' + weatherIcon + ' ' + hour.windSpeed + ' Bft ' + hour.windDir + '° ' + degreesToDirection(hour.windDir) + ' ' + windArrow + '</div>';
    html += '<div>🌊 ' + swellHour.swellHeight.toFixed(1) + 'm / ' + swellHour.swellPeriod + 's ' + swellHour.swellDir + '° ' + degreesToDirection(swellHour.swellDir) + ' ' + swellArrow + '</div>';
    html += '<div style="font-size: 10px; margin-top: 4px;">' + tideIcon + ' ' + tideDirection + '</div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

async function updateDetailed() {
  const weatherData = await fetchRealWeather(currentStation, currentDate);
  const weather = weatherData.hourly;
  const swell = await fetchRealSwellData(currentStation, currentDate);
  const tides = await fetchRealTideData(currentStation, currentDate);
  const selectedHour = currentHour;
  const selectedMinute = currentMinute;
  
  let hourWeather = null;
  let hourSwell = null;
  for (let i = 0; i < weather.length; i++) {
    if (parseInt(weather[i].time) === selectedHour) {
      hourWeather = weather[i];
      break;
    }
  }
  for (let i = 0; i < swell.length; i++) {
    if (parseInt(swell[i].time) === selectedHour) {
      hourSwell = swell[i];
      break;
    }
  }
  if (!hourWeather) hourWeather = weather[12];
  if (!hourSwell) hourSwell = { swellHeight: 0.5, swellPeriod: 5, swellDir: 0 };
  
  let prevTide = null;
  let nextTide = null;
  const targetMinutes = selectedHour * 60 + selectedMinute;
  for (let i = 0; i < tides.events.length; i++) {
    const tideParts = tides.events[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tides.events[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tides.events[i];
  }
  
  const isSlackWater = isSlackWaterTime(tides.events, selectedHour, selectedMinute);
  
  let tideDirection = "No Data";
  if (!prevTide && nextTide) {
    tideDirection = nextTide.type === "High" ? "Flooding (Incoming) 🌊⬆️" : "Ebbing (Outgoing) 🌊⬇️";
  } else if (prevTide && !nextTide) {
    tideDirection = prevTide.type === "High" ? "Ebbing (Outgoing) 🌊⬇️" : "Flooding (Incoming) 🌊⬆️";
  } else if (prevTide && nextTide) {
    const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
    const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
    if (timeToPrev <= 40 || timeToNext <= 40) {
      tideDirection = "Slack Water ⚡";
    } else if (prevTide.type === "High" && nextTide.type === "Low") {
      tideDirection = "Ebbing (Outgoing) 🌊⬇️";
    } else if (prevTide.type === "Low" && nextTide.type === "High") {
      tideDirection = "Flooding (Incoming) 🌊⬆️";
    }
  }
  
  const weatherIcon = getWeatherIcon(hourWeather.cloudCover, hourWeather.rain);
  const windArrow = getWindArrow(hourWeather.windDir);
  const swellArrow = getSwellArrow(hourSwell.swellDir);
  
  let html = '';
  if (hourWeather && !hourWeather.error) {
    html = '<div class="detail-row"><strong>Wind:</strong> ' + weatherIcon + ' ' + hourWeather.windSpeed + ' Bft ' + hourWeather.windDir + '° ' + degreesToDirection(hourWeather.windDir) + ' ' + windArrow + ' (Gusts ' + hourWeather.gusts + ' Bft)</div>';
    html += '<div class="detail-row"><strong>Swell:</strong> ' + hourSwell.swellHeight.toFixed(1) + 'm / ' + hourSwell.swellPeriod + 's ' + hourSwell.swellDir + '° ' + degreesToDirection(hourSwell.swellDir) + ' ' + swellArrow + '</div>';
    html += '<div class="detail-row"><strong>Rain:</strong> ' + hourWeather.rain.toFixed(1) + ' mm</div>';
    html += '<div class="detail-row"><strong>Visibility:</strong> ' + hourWeather.visibility.toFixed(1) + ' km</div>';
    html += '<div class="detail-row"><strong>Cloud Cover:</strong> ' + hourWeather.cloudCover + '%</div>';
    html += '<div class="detail-row"><strong>Air Temp:</strong> ' + hourWeather.airTemp.toFixed(1) + '°C</div>';
    html += '<div class="detail-row"><strong>UV Index:</strong> ' + hourWeather.uvIndex + '</div>';
    
    // Add sunrise and sunset to detailed conditions
    if (weatherData.sunrise && weatherData.sunset) {
      html += '<div class="detail-row"><strong>Sunrise:</strong> ' + weatherData.sunrise + '</div>';
      html += '<div class="detail-row"><strong>Sunset:</strong> ' + weatherData.sunset + '</div>';
    }
  } else {
    html = '<div class="detail-row">⚠️ Weather data unavailable</div>';
  }
  
  if (isSlackWater && tides.events.length > 0) {
    html += '<div class="detail-row" style="background: rgba(47, 255, 238, 0.15); border-radius: 8px; margin-top: 5px; padding: 8px;"><strong>⚡ Slack Water Alert:</strong> Current time is within 40 minutes of a tide change</div>';
  }
  
  if ((prevTide || nextTide) && tides.events.length > 0) {
    html += '<div class="detail-row" style="margin-top:12px;"><strong>📊 Relevant tides for this dive:</strong></div>';
    if (prevTide) {
      const timeDiff = Math.abs((selectedHour * 60 + selectedMinute) - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
      html += '<div class="detail-row">← Previous ' + prevTide.type + ' at ' + prevTide.time + ' (' + prevTide.height.toFixed(2) + 'm) - ' + Math.floor(timeDiff / 60) + 'h ' + (timeDiff % 60) + 'm before</div>';
    }
    if (nextTide) {
      const timeDiff = Math.abs((parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])) - (selectedHour * 60 + selectedMinute));
      html += '<div class="detail-row">→ Next ' + nextTide.type + ' at ' + nextTide.time + ' (' + nextTide.height.toFixed(2) + 'm) - ' + Math.floor(timeDiff / 60) + 'h ' + (timeDiff % 60) + 'm after</div>';
    }
    html += '<div class="detail-row"><strong>🌊 Tide Direction:</strong> ' + tideDirection + '</div>';
    if (tides.tideType !== 'Unknown') {
      html += '<div class="detail-row">' + (tides.tideType === 'Springs' ? '🌕 Spring tides expected (larger ranges)' : '🌙 Neap tides expected (smaller ranges)') + '</div>';
    }
    html += '<div class="detail-row">' + tides.moonIcon + ' ' + tides.moonPhase + '</div>';
  } else if (tides.events.length === 0) {
    html += '<div class="detail-row">⚠️ Tide data unavailable for this station/date</div>';
  }
  
  const panel = document.getElementById('detailedPanel');
  if (panel) panel.innerHTML = html;
}

function initChips() {
  const categories = ["Reef", "Wreck", "Drift", "Deep", "Night", "Snorkel", "Kelp", "Photography", "Navigation", "Training", "Citizen Science", "Fitness Test"];
  const container = document.getElementById('chipsContainer');
  if (!container) return;
  
  let html = '';
  for (let i = 0; i < categories.length; i++) {
    html += '<span data-chip="' + categories[i] + '">' + categories[i] + '</span>';
  }
  container.innerHTML = html;
  
  const chips = document.querySelectorAll('.chips span');
  for (let i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function() {
      hapticFeedback();
      this.classList.toggle('active-chip');
      const chipName = this.dataset.chip;
      if (this.classList.contains('active-chip')) {
        selectedChips.add(chipName);
      } else {
        selectedChips.delete(chipName);
      }
      saveUserPreferences();
    });
  }
  renderChips();
}

function saveCurrentPlan() {
  const diveSiteElem = document.getElementById('diveSite');
  const diveSite = diveSiteElem ? diveSiteElem.value : 'Unnamed Dive';
  const planName = prompt('Enter a name for this dive plan:', diveSite);
  if (!planName) return;
  
  (async function() {
    const exportText = await getFormattedExportText();
    const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
    let diveType = "Boat";
    for (let i = 0; i < diveTypeRadios.length; i++) {
      if (diveTypeRadios[i].checked) {
        diveType = diveTypeRadios[i].value;
        break;
      }
    }
    const maxDepthElem = document.getElementById('maxDepth');
    const plan = {
      id: Date.now(),
      name: planName,
      exportText: exportText,
      station: currentStation.name,
      date: formatDateDisplay(currentDate),
      time: getSelectedTime(),
      diveType: diveType,
      maxDepth: maxDepthElem ? maxDepthElem.value : '',
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
  savedPlans = savedPlans.filter(function(p) { return p.id !== planId; });
  localStorage.setItem('divesense_plans', JSON.stringify(savedPlans));
  renderSavedPlans();
  showNotification('Plan deleted');
}

function loadSavedPlan(plan) {
  const savedStation = stations.find(function(s) { return s.name === plan.station; });
  if (savedStation) currentStation = savedStation;
  currentDate = new Date(plan.date.split('-').reverse().join('-'));
  const timeParts = plan.time.split(':');
  currentHour = parseInt(timeParts[0]);
  currentMinute = parseInt(timeParts[1]);
  
  const radios = document.querySelectorAll('input[name="diveType"]');
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].value === plan.diveType) {
      radios[i].checked = true;
      break;
    }
  }
  
  const maxDepthElem = document.getElementById('maxDepth');
  if (maxDepthElem) maxDepthElem.value = plan.maxDepth;
  
  selectedChips.clear();
  for (let i = 0; i < plan.categories.length; i++) {
    selectedChips.add(plan.categories[i]);
  }
  
  initStations();
  initTimeSpinners();
  buildCalendar();
  loadAllData();
  
  setTimeout(function() {
    renderChips();
    showNotification('Loaded: ' + plan.name);
  }, 100);
}

function renderSavedPlans() {
  const container = document.getElementById('savedPlansContainer');
  if (!container) return;
  
  if (savedPlans.length === 0) {
    container.innerHTML = '<div class="saved-plans-empty">No saved plans yet. Save a plan below.</div>';
    return;
  }
  
  let html = '';
  for (let i = 0; i < savedPlans.length; i++) {
    const plan = savedPlans[i];
    html += '<div class="saved-plan-item" data-plan-id="' + plan.id + '">';
    html += '<div><div class="saved-plan-name">' + escapeHtml(plan.name) + '</div>';
    html += '<div class="saved-plan-details">' + plan.station + ' | ' + plan.date + ' | ' + plan.time + '</div></div>';
    html += '<button class="delete-plan-btn" data-plan-id="' + plan.id + '">🗑️</button>';
    html += '</div>';
  }
  container.innerHTML = html;
  
  const items = document.querySelectorAll('.saved-plan-item');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const planId = parseInt(item.dataset.planId);
    const plan = savedPlans.find(function(p) { return p.id === planId; });
    if (plan) {
      item.addEventListener('click', function(e) {
        if (!e.target.classList.contains('delete-plan-btn')) {
          loadSavedPlan(plan);
        }
      });
    }
  }
  
  const deleteBtns = document.querySelectorAll('.delete-plan-btn');
  for (let i = 0; i < deleteBtns.length; i++) {
    deleteBtns[i].addEventListener('click', function(e) {
      e.stopPropagation();
      const planId = parseInt(this.dataset.planId);
      deleteSavedPlan(planId);
    });
  }
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
  setTimeout(function() { notification.remove(); }, 2000);
}

const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
  maxDepthInput.addEventListener('change', function(e) {
    const depth = parseInt(e.target.value);
    if (depth >= 21) {
      const deepChip = Array.from(document.querySelectorAll('.chips span')).find(function(c) { return c.dataset.chip === 'Deep'; });
      if (deepChip && !deepChip.classList.contains('active-chip')) {
        deepChip.classList.add('active-chip');
        selectedChips.add('Deep');
        renderChips();
      }
    }
    e.target.style.borderColor = (depth < 5 || depth > 45) ? '#ff4444' : '#1AA7A7';
  });
}

const whatsappBtn = document.getElementById('whatsappBtn');
if (whatsappBtn) {
  whatsappBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    const text = await getFormattedExportText();
    const encodedText = encodeURIComponent(text);
    
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
      // For iOS: Copy to clipboard first, then open WhatsApp
      await navigator.clipboard.writeText(text);
      
      // Show confirmation before opening
      const userConfirmed = confirm(
        "✅ Dive plan copied to clipboard!\n\n" +
        "Tap 'OK' to open WhatsApp, then paste the message."
      );
      
      if (userConfirmed) {
        window.location.href = "whatsapp://";
      }
    } else {
      // For Android/Desktop: Use web whatsapp with pre-filled message
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  });
}

const emailBtn = document.getElementById('emailBtn');
if (emailBtn) {
  emailBtn.addEventListener('click', async function() {
    const text = await getFormattedExportText();
    const diveSiteElem = document.getElementById('diveSite');
    const subject = 'Dive Plan - ' + (diveSiteElem ? diveSiteElem.value : 'Dive Plan') + ' - ' + formatDateDisplay(currentDate);
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
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
  savePlanBtn.addEventListener('click', function() {
    saveCurrentPlan();
  });
}

async function loadAllData() {
  showLoading();
  try {
    await updateTides();
    await updateHourly();
    await updateDetailed();
    saveUserPreferences();
  } catch (error) {
    console.error("Error loading data:", error);
  } finally {
    hideLoading();
  }
}

// Force page to scroll to top on load
function scrollToTopOnLoad() {
  window.scrollTo(0, 0);
  setTimeout(function() {
    window.scrollTo(0, 0);
  }, 0);
  setTimeout(function() {
    window.scrollTo(0, 0);
  }, 50);
  window.addEventListener('load', function() {
    window.scrollTo(0, 0);
  });
}

// Prevent any scroll restoration
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// SINGLE init() function - FIXED (removed duplicate)
function init() {
  // Disable scroll restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  
  // Force scroll to top
  window.scrollTo(0, 0);
  
  loadUserPreferences();
  loadSavedPlans();
  initStations();
  initTimeSpinners();
  initDiveType();
  initChips();
  buildCalendar();
  loadAllData();
  
  // Force scroll to top again after all data loads
  setTimeout(function() {
    window.scrollTo(0, 0);
  }, 100);
  
  setTimeout(function() {
    window.scrollTo(0, 0);
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}