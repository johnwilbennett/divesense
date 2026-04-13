// STATIONS DATA with correct WorldTides station IDs
const stations = [
  { name: "Cobh", county: "Co. Cork", lat: 51.8489, lon: -8.2995, worldtidesId: "cobh" },
  { name: "Kinsale", county: "Co. Cork", lat: 51.7075, lon: -8.5225, worldtidesId: "kinsale" },
  { name: "Baltimore", county: "Co. Cork", lat: 51.4833, lon: -9.3667, worldtidesId: "baltimore" },
  { name: "Dunmanus Harbour", county: "Co. Cork", lat: 51.55, lon: -9.6833, worldtidesId: "dunmanus" },
  { name: "Castletownbere", county: "Co. Cork", lat: 51.65, lon: -9.9167, worldtidesId: "castletownbere" },
  { name: "Valentia Harbour", county: "Co. Kerry", lat: 51.9333, lon: -10.35, worldtidesId: "valentia" },
  { name: "Dingle Harbour", county: "Co. Kerry", lat: 52.1333, lon: -10.2667, worldtidesId: "dingle" }
];

let currentStation = stations[1];
let currentDate = new Date();
let selectedChips = new Set();
let currentRisk = "Moderate";
let currentHour = new Date().getHours();
let currentMinute = new Date().getMinutes();
let currentCalendarMonth = new Date();

// Tide cache with 6-hour expiry
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

function getMoonPhase(date) {
  const lunarCycle = 29.53058867;
  const knownNewMoon = new Date(2024, 0, 11);
  const diffDays = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = (diffDays % lunarCycle) / lunarCycle;
  
  if (phase < 0.0625) return "New Moon 🌑";
  if (phase < 0.1875) return "Waxing Crescent 🌒";
  if (phase < 0.3125) return "First Quarter 🌓";
  if (phase < 0.4375) return "Waxing Gibbous 🌔";
  if (phase < 0.5625) return "Full Moon 🌕";
  if (phase < 0.6875) return "Waning Gibbous 🌖";
  if (phase < 0.8125) return "Last Quarter 🌗";
  if (phase < 0.9375) return "Waning Crescent 🌘";
  return "New Moon 🌑";
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
  if (timeLabel) {
    timeLabel.innerHTML = prefix + ': <span style="color: #2FFFEF; font-weight: bold;">' + getSelectedTime() + '</span>';
  }
}

function hapticFeedback() {
  const element = document.activeElement;
  if (element) {
    element.classList.add('haptic-feedback');
    setTimeout(() => element.classList.remove('haptic-feedback'), 100);
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
  const diveType = document.querySelector('input[name="diveType"]:checked')?.value || 'Boat';
  const preferences = {
    stationName: currentStation.name,
    diveType: diveType,
    selectedChips: Array.from(selectedChips)
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
      const radio = document.querySelector(`input[name="diveType"][value="${prefs.diveType}"]`);
      if (radio) radio.checked = true;
    }
    if (prefs.selectedChips) {
      prefs.selectedChips.forEach(chip => selectedChips.add(chip));
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

// REAL WORLD TIDES API with 6-hour cache - NO MOCK FALLBACK
// REAL WORLD TIDES API - Updated to parse correct WorldTides format
a// REAL WORLD TIDES API - Filter to selected date only
async function fetchRealTideData(station, date) {
  const cacheKey = `${station.worldtidesId}_${formatDateForAPI(date)}`;
  const now = Date.now();
  
  // Check cache first (6-hour expiry)
  if (tideCache.has(cacheKey)) {
    const cached = tideCache.get(cacheKey);
    if (now - cached.timestamp < 21600000) {
      console.log("Returning cached tide data for", cacheKey);
      return cached.data;
    } else {
      tideCache.delete(cacheKey);
    }
  }
  
  try {
    const formattedDate = formatDateForAPI(date);
    const apiUrl = `/api/tides?station=${station.worldtidesId}&date=${formattedDate}`;
    
    console.log("Fetching tide data from:", apiUrl);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Tide API response received", data);
    
    if (data.error) {
      console.warn("API error:", data.error);
      return { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
    }
    
    if (!data.extremes || data.extremes.length === 0) {
      console.warn("No tide data available");
      return { events: [], moonPhase: getMoonPhase(date), tideType: "Unknown", error: true };
    }
    
    // Get the selected date in UTC (start of day)
    const selectedDateStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
    const selectedDateEnd = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59));
    
    // Filter tides to ONLY the selected date
    let tideEvents = [];
    for (let i = 0; i < data.extremes.length; i++) {
      const extreme = data.extremes[i];
      const tideDate = new Date(extreme.dt * 1000);
      
      // Only include tides that fall on the selected date
      if (tideDate >= selectedDateStart && tideDate <= selectedDateEnd) {
        const hours = tideDate.getUTCHours();
        const minutes = tideDate.getUTCMinutes();
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        tideEvents.push({
          type: extreme.type === "High" ? "High" : "Low",
          time: timeStr,
          height: extreme.height,
          timestamp: extreme.dt * 1000
        });
      }
    }
    
    // Sort by time
    tideEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Determine Spring or Neap tides
    function getTideType(events) {
      if (!events || events.length < 4) return "Unknown";
      let totalRange = 0;
      for (let i = 0; i < events.length - 1; i++) {
        if (events[i].type !== events[i+1].type) {
          totalRange += Math.abs(events[i].height - events[i+1].height);
        }
      }
      const avgRange = totalRange / (events.length - 1);
      return avgRange > 2.5 ? "Springs" : "Neaps";
    }
    
    const tideData = {
      events: tideEvents,
      moonPhase: getMoonPhase(date),
      tideType: getTideType(tideEvents),
      rawData: data
    };
    
    // Cache the data
    tideCache.set(cacheKey, {
      data: tideData,
      timestamp: now
    });
    
    console.log("Tide data cached for", cacheKey, `(${tideEvents.length} events for selected date)`);
    return tideData;
    
  } catch (error) {
    console.error("Error fetching tide data:", error);
    return { 
      events: [], 
      moonPhase: getMoonPhase(date), 
      tideType: "Unknown", 
      error: true, 
      errorMessage: error.message 
    };
  }
}

// REAL WEATHER API - Open-Meteo (free, no API key required)
async function fetchRealWeather(station, date) {
  try {
    const lat = station.lat;
    const lon = station.lon;
    const dateStr = formatDateForAPI(date);
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,rain,cloudcover,temperature_2m,uv_index&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    
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
      
      const windSpeedKmh = data.hourly.wind_speed_10m[i];
      const estimatedSwell = windSpeedKmh * 0.03 + 0.3;
      
      hourly.push({
        time: hour.toString().padStart(2, '0') + ":00",
        windSpeed: kmhToBft(windSpeedKmh),
        windSpeedKmh: windSpeedKmh,
        windDir: data.hourly.wind_direction_10m[i] || 0,
        gusts: kmhToBft(data.hourly.wind_gusts_10m[i] || 0),
        swellHeight: Math.min(3, Math.max(0.2, estimatedSwell)),
        swellPeriod: Math.floor(5 + (windSpeedKmh / 10)),
        swellDir: data.hourly.wind_direction_10m[i] || 0,
        visibility: (data.hourly.visibility[i] || 20000) / 1000,
        rain: data.hourly.rain[i] || 0,
        cloudCover: data.hourly.cloudcover[i] || 0,
        airTemp: data.hourly.temperature_2m[i] || 12,
        uvIndex: data.hourly.uv_index[i] || 0
      });
    }
    return hourly;
    
  } catch (error) {
    console.error("Error fetching weather:", error);
    // Return empty weather data on API failure
    const emptyHourly = [];
    for (let hour = 0; hour < 24; hour++) {
      emptyHourly.push({
        time: hour.toString().padStart(2, '0') + ":00",
        windSpeed: 0,
        windDir: 0,
        gusts: 0,
        swellHeight: 0,
        swellPeriod: 0,
        swellDir: 0,
        visibility: 0,
        rain: 0,
        cloudCover: 0,
        airTemp: 0,
        uvIndex: 0,
        error: true
      });
    }
    return emptyHourly;
  }
}

async function getFormattedExportText() {
  const diveSite = document.getElementById('diveSite')?.value || '';
  const dod = document.getElementById('dod')?.value || '';
  const dodAsst = document.getElementById('dodAsst')?.value || '';
  const coxName = document.getElementById('coxName')?.value || '';
  const coxMode = document.querySelector('input[name="coxMode"]:checked')?.value || '';
  const participation = document.querySelector('input[name="participation"]:checked')?.value || 'Open to All';
  const maxDepth = document.getElementById('maxDepth')?.value || '';
  const torches = document.getElementById('torches')?.checked || false;
  const lifeJackets = document.getElementById('lifeJackets')?.checked || false;
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  const timePrefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  
  const weather = await fetchRealWeather(currentStation, currentDate);
  const hourWeather = weather.find(w => parseInt(w.time) === currentHour) || weather[12];
  const tides = await fetchRealTideData(currentStation, currentDate);
  const { prev: prevTide, next: nextTide } = getClosestTides(tides.events, currentHour, currentMinute);
  
  const highWater = prevTide?.type === 'High' ? prevTide : (nextTide?.type === 'High' ? nextTide : null);
  const lowWater = prevTide?.type === 'Low' ? prevTide : (nextTide?.type === 'Low' ? nextTide : null);
  
  const categories = Array.from(selectedChips).join(', ');
  
  let weatherText = '';
  if (hourWeather && !hourWeather.error) {
    weatherText = `${getWeatherIcon(hourWeather.cloudCover, hourWeather.rain)} Wind: ${hourWeather.windSpeed} Bft ${degreesToDirection(hourWeather.windDir)}, Gusts: ${hourWeather.gusts} Bft, Swell: ${hourWeather.swellHeight.toFixed(1)}m / ${hourWeather.swellPeriod}s, Visibility: ${hourWeather.visibility.toFixed(1)}km, Rain: ${hourWeather.rain.toFixed(1)}mm, Temp: ${hourWeather.airTemp.toFixed(1)}°C`;
  } else {
    weatherText = 'Weather data unavailable';
  }
  
  let text = `Date: ${formatDateDisplay(currentDate)}\n`;
  text += `Station Name: ${currentStation.name}\n`;
  text += `Station Map Co-ordinates: ${currentStation.lat}, ${currentStation.lon}\n`;
  text += `Google Maps Link: https://www.google.com/maps?q=${currentStation.lat},${currentStation.lon}\n`;
  text += `Dive Site Name: ${diveSite || 'Not specified'}\n`;
  text += `Dive Type: ${diveType}\n`;
  text += `Time: ${getSelectedTime()} (${timePrefix})\n`;
  text += `High Water: ${highWater ? `${highWater.time} (${highWater.height.toFixed(2)}m)` : 'N/A'}\n`;
  text += `Low Water: ${lowWater ? `${lowWater.time} (${lowWater.height.toFixed(2)}m)` : 'N/A'}\n`;
  text += `Weather at Dive Time: ${weatherText}\n`;
  text += `DOD: ${dod || 'Not specified'}\n`;
  text += `Assistant DOD: ${dodAsst || 'None'}\n`;
  text += `Cox: ${coxName || 'N/A'} ${coxMode ? `(${coxMode} Cox'n)` : ''}\n`;
  text += `Participation: ${participation}\n`;
  text += `Max Depth: ${maxDepth || 'N/A'}m\n`;
  if (torches) text += `Torches Required: ✓\n`;
  if (lifeJackets) text += `Life Jackets Required: ✓\n`;
  text += `Dive Categories: ${categories || 'None selected'}\n`;
  text += `\n---\nCreated with DiveSense - Always verify with official sources`;
  
  return text;
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

function getClosestTides(tideEvents, targetHour, targetMinute) {
  if (!tideEvents || tideEvents.length === 0) return { prev: null, next: null };
  const targetMinutes = targetHour * 60 + targetMinute;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  return { prev: prevTide, next: nextTide };
}

function getTideDirectionForHour(tideEvents, hour) {
  if (!tideEvents || tideEvents.length < 2) return "No Data";
  const targetMinutes = hour * 60;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  if (!prevTide || !nextTide) return "No Data";
  const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
  const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
  if (timeToPrev <= 40 || timeToNext <= 40) return "Slack Water ⚡";
  if (prevTide.type === "High" && nextTide.type === "Low") return "Ebbing 🌊⬇️";
  if (prevTide.type === "Low" && nextTide.type === "High") return "Flooding 🌊⬆️";
  return "Slack Water ⚡";
}

function getTideDirection(tideEvents, targetHour, targetMinute) {
  if (!tideEvents || tideEvents.length < 2) return "No Data";
  const targetMinutes = targetHour * 60 + targetMinute;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  if (!prevTide || !nextTide) return "No Data";
  const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
  const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
  if (timeToPrev <= 40 || timeToNext <= 40) return "Slack Water ⚡";
  if (prevTide.type === "High" && nextTide.type === "Low") return "Ebbing (Outgoing) 🌊⬇️";
  if (prevTide.type === "Low" && nextTide.type === "High") return "Flooding (Incoming) 🌊⬆️";
  return "Slack Water ⚡";
}

function buildCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let selectedDate = new Date(currentDate); selectedDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 10);
  const minDate = today;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let html = `<div class="calendar-header"><div class="calendar-month-year">${monthNames[month]} ${year}</div><div class="calendar-nav"><button class="calendar-nav-btn" data-prev-month>&lt;</button><button class="calendar-nav-btn" data-next-month>&gt;</button></div></div><div class="calendar-weekdays"><div class="calendar-weekday">Su</div><div class="calendar-weekday">Mo</div><div class="calendar-weekday">Tu</div><div class="calendar-weekday">We</div><div class="calendar-weekday">Th</div><div class="calendar-weekday">Fr</div><div class="calendar-weekday">Sa</div></div><div class="calendar-days">`;
  for (let i = 0; i < startDay; i++) html += '<div class="calendar-day other-month"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDateObj = new Date(year, month, day); currentDateObj.setHours(0, 0, 0, 0);
    const isSelected = currentDateObj.getTime() === selectedDate.getTime();
    const isToday = currentDateObj.getTime() === today.getTime();
    const isDisabled = currentDateObj < minDate || currentDateObj > maxDate;
    let classes = 'calendar-day';
    if (isSelected) classes += ' selected';
    if (isToday) classes += ' today';
    if (isDisabled) classes += ' disabled';
    html += `<div class="${classes}" data-date="${currentDateObj.toISOString()}">${day}</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  document.querySelectorAll('.calendar-day:not(.disabled):not(.other-month)').forEach(day => {
    day.addEventListener('click', () => {
      hapticFeedback();
      const date = new Date(day.dataset.date);
      currentDate = date;
      buildCalendar();
      loadAllData();
    });
  });
  document.querySelectorAll('.calendar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.prevMonth !== undefined) currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
      else if (btn.dataset.nextMonth !== undefined) currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
      buildCalendar();
    });
  });
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
  document.querySelectorAll('.station-card').forEach(card => {
    card.addEventListener('click', () => {
      hapticFeedback();
      const idx = parseInt(card.dataset.idx);
      currentStation = stations[idx];
      initStations();
      loadAllData();
    });
  });
}

function initTimeSpinners() {
  const hourWheel = document.getElementById('hourWheel');
  const minuteWheel = document.getElementById('minuteWheel');
  if (!hourWheel || !minuteWheel) return;
  hourWheel.innerHTML = '';
  minuteWheel.innerHTML = '';
  
  const hourValues = [22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
  for (let h of hourValues) {
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = h.toString().padStart(2, '0');
    option.dataset.value = h;
    hourWheel.appendChild(option);
  }
  
  const minuteValues = [58, 59, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 0, 1];
  for (let m of minuteValues) {
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = m.toString().padStart(2, '0');
    option.dataset.value = m;
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
    document.querySelectorAll('#hourWheel .spinner-option').forEach(opt => {
      if (parseInt(opt.dataset.value) === currentHour) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
    document.querySelectorAll('#minuteWheel .spinner-option').forEach(opt => {
      if (parseInt(opt.dataset.value) === currentMinute) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
    updateTimeLabel();
  }
  
  function scrollToValue(wheel, value) {
    const option = Array.from(wheel.children).find(opt => parseInt(opt.dataset.value) === value);
    if (option) {
      option.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  
  let scrollTimeout;
  
  hourWheel.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      Array.from(hourWheel.children).forEach(opt => {
        const rect = opt.getBoundingClientRect();
        const wheelRect = hourWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      });
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
    }, 30);
  });
  
  minuteWheel.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const center = minuteWheel.scrollTop + minuteWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      Array.from(minuteWheel.children).forEach(opt => {
        const rect = opt.getBoundingClientRect();
        const wheelRect = minuteWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      });
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
    }, 30);
  });
  
  updateHighlights();
  setTimeout(() => {
    scrollToValue(hourWheel, currentHour);
    scrollToValue(minuteWheel, currentMinute);
  }, 100);
}

function initDiveType() {
  const radios = document.querySelectorAll('input[name="diveType"]');
  const coxField = document.getElementById('coxField');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (coxField) coxField.style.display = e.target.value === 'Boat' ? 'block' : 'none';
      document.getElementById('lifeJackets').checked = e.target.value === 'Boat';
      updateTimeLabel();
      saveUserPreferences();
    });
  });
  if (coxField) coxField.style.display = 'block';
  updateTimeLabel();
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
    const tideDiv = document.getElementById('tideData');
    if (tideDiv) tideDiv.innerHTML = '<div class="tide-event">⚠️ Tide data unavailable for this station/date</div>';
    return;
  }
  
  const tideTypeClass = tides.tideType === 'Springs' ? 'springs-text' : (tides.tideType === 'Neaps' ? 'neaps-text' : '');
  const tideTypeIcon = tides.tideType === 'Springs' ? '🌕' : (tides.tideType === 'Neaps' ? '🌙' : '');
  
  let html = '';
  if (tides.tideType !== 'Unknown') {
    html += `<div class="${tideTypeClass}" style="font-size:1.2rem; margin-bottom:10px;">${tideTypeIcon} ${tides.tideType.toUpperCase()} TIDES</div>`;
  }
  
  tides.events.forEach(e => {
    const tideIcon = e.type === 'High' ? '🌊 HIGH' : '⬇️ LOW';
    html += `<div class="tide-event"><span>${tideIcon}</span><span>${e.time}</span><span>${e.height.toFixed(2)}m</span></div>`;
  });
  
  html += `<div class="text-small mt-2">🌙 ${tides.moonPhase}</div>`;
  const tideDiv = document.getElementById('tideData');
  if (tideDiv) tideDiv.innerHTML = html;
}

async function updateHourly() {
  const weather = await fetchRealWeather(currentStation, currentDate);
  const tides = await fetchRealTideData(currentStation, currentDate);
  const selectedHour = currentHour;
  const container = document.getElementById('hourlyScroll');
  if (!container) return;
  
  if (weather.length === 0 || (weather[0] && weather[0].error)) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">⚠️ Weather data unavailable</div>';
    return;
  }
  
  let html = '';
  for (const hour of weather) {
    const hourNum = parseInt(hour.time);
    const tideDirection = getTideDirectionForHour(tides.events, hourNum);
    let tideIcon = '';
    if (tideDirection.includes('Flooding')) tideIcon = '⬆️';
    else if (tideDirection.includes('Ebbing')) tideIcon = '⬇️';
    else if (tideDirection.includes('Slack')) tideIcon = '⚡';
    else tideIcon = '❓';
    
    const weatherIcon = getWeatherIcon(hour.cloudCover, hour.rain);
    const highlightClass = hourNum === selectedHour ? 'highlight' : '';
    html += `<div class="hourly-card ${highlightClass}">
      <strong>${hour.time}</strong>
      <div>${weatherIcon} ${hour.windSpeed} Bft</div>
      <div>${degreesToDirection(hour.windDir)}</div>
      <div>🌊 ${hour.swellHeight.toFixed(1)}m / ${hour.swellPeriod}s</div>
      <div style="font-size: 10px; margin-top: 4px;">${tideIcon} ${tideDirection}</div>
    </div>`;
  }
  container.innerHTML = html;
}

async function updateDetailed() {
  const weather = await fetchRealWeather(currentStation, currentDate);
  const tides = await fetchRealTideData(currentStation, currentDate);
  const selectedHour = currentHour, selectedMinute = currentMinute;
  let hourData = weather.find(w => parseInt(w.time) === selectedHour) || weather[12];
  const { prev: prevTide, next: nextTide } = getClosestTides(tides.events, selectedHour, selectedMinute);
  const isSlackWater = isSlackWaterTime(tides.events, selectedHour, selectedMinute);
  const tideDirection = getTideDirection(tides.events, selectedHour, selectedMinute);
  
  let riskScore = 0;
  let riskLevel = "Low";
  let riskPercent = 12.5;
  
  if (hourData && !hourData.error) {
    riskScore = (hourData.windSpeed / 12) * 0.4 + (hourData.swellHeight / 4) * 0.4 + (1 - (hourData.visibility / 20)) * 0.2;
    riskScore = Math.min(1, Math.max(0, riskScore));
    if (riskScore > 0.75) { riskLevel = "High"; riskPercent = 87.5; }
    else if (riskScore > 0.5) { riskLevel = "Caution"; riskPercent = 62.5; }
    else if (riskScore > 0.25) { riskLevel = "Moderate"; riskPercent = 37.5; }
  }
  currentRisk = riskLevel;
  
  const riskBar = document.getElementById('riskBarGradient');
  if (riskBar) {
    riskBar.style.background = `linear-gradient(90deg, #1f8a4c 0%, #1f8a4c ${Math.max(0, riskPercent - 15)}%, #e0b01a ${Math.max(0, riskPercent - 5)}%, #e67e22 ${Math.min(100, riskPercent + 5)}%, #c0392b ${Math.min(100, riskPercent + 20)}%)`;
  }
  const riskPointer = document.getElementById('riskPointer');
  if (riskPointer) riskPointer.style.marginLeft = riskPercent + '%';
  
  let riskColor = '#88ff88';
  if (riskLevel === 'High') riskColor = '#ff8888';
  else if (riskLevel === 'Caution') riskColor = '#ffaa66';
  else if (riskLevel === 'Moderate') riskColor = '#ffff88';
  
  let html = '';
  
  if (hourData && !hourData.error) {
    const weatherIcon = getWeatherIcon(hourData.cloudCover, hourData.rain);
    html = `
      <div class="detail-row"><strong>Wind:</strong> ${weatherIcon} ${hourData.windSpeed} Bft ${degreesToDirection(hourData.windDir)} (Gusts ${hourData.gusts} Bft)</div>
      <div class="detail-row"><strong>Visibility:</strong> ${hourData.visibility.toFixed(1)} km</div>
      <div class="detail-row"><strong>Rain:</strong> ${hourData.rain.toFixed(1)} mm</div>
      <div class="detail-row"><strong>Cloud Cover:</strong> ${hourData.cloudCover}%</div>
      <div class="detail-row"><strong>Air Temp:</strong> ${hourData.airTemp.toFixed(1)}°C</div>
      <div class="detail-row"><strong>UV Index:</strong> ${hourData.uvIndex}</div>
      <div class="detail-row"><strong>Swell:</strong> ${hourData.swellHeight.toFixed(1)}m / ${hourData.swellPeriod}s from ${degreesToDirection(hourData.swellDir)}</div>`;
  } else {
    html = `<div class="detail-row">⚠️ Weather data unavailable</div>`;
  }
  
  if (isSlackWater && tides.events.length > 0) {
    html += `<div class="detail-row" style="background: rgba(47, 255, 238, 0.15); border-radius: 8px; margin-top: 5px; padding: 8px;"><strong>⚡ Slack Water Alert:</strong> Current time is within 40 minutes of a tide change</div>`;
  }
  
  html += `<div class="detail-row"><strong>Risk Assessment:</strong> <span style="color: ${riskColor}; font-weight: bold;">${riskLevel}</span></div>`;
  
  if ((prevTide || nextTide) && tides.events.length > 0) {
    html += `<div class="detail-row" style="margin-top:12px;"><strong>📊 Relevant tides for this dive:</strong></div>`;
    if (prevTide) {
      const timeDiff = Math.abs((selectedHour * 60 + selectedMinute) - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
      html += `<div class="detail-row">← Previous ${prevTide.type} at ${prevTide.time} (${prevTide.height.toFixed(2)}m) - ${Math.floor(timeDiff / 60)}h ${timeDiff % 60}m before</div>`;
    }
    if (nextTide) {
      const timeDiff = Math.abs((parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])) - (selectedHour * 60 + selectedMinute));
      html += `<div class="detail-row">→ Next ${nextTide.type} at ${nextTide.time} (${nextTide.height.toFixed(2)}m) - ${Math.floor(timeDiff / 60)}h ${timeDiff % 60}m after</div>`;
    }
    html += `<div class="detail-row"><strong>🌊 Tide Direction:</strong> ${tideDirection}</div>`;
    if (tides.tideType !== 'Unknown') {
      html += `<div class="detail-row">${tides.tideType === 'Springs' ? '🌕 Spring tides expected (larger ranges)' : '🌙 Neap tides expected (smaller ranges)'}</div>`;
    }
    html += `<div class="detail-row">🌙 ${tides.moonPhase}</div>`;
  } else if (tides.events.length === 0) {
    html += `<div class="detail-row">⚠️ Tide data unavailable for this station/date</div>`;
  }
  
  const panel = document.getElementById('detailedPanel');
  if (panel) panel.innerHTML = html;
}

function initChips() {
  const categories = ["Reef", "Wreck", "Drift", "Deep", "Night", "Snorkel", "Kelp", "Photography", "Navigation", "Training", "Citizen Science", "Fitness Test"];
  const container = document.getElementById('chipsContainer');
  if (!container) return;
  let html = '';
  categories.forEach(cat => { html += `<span data-chip="${cat}">${cat}</span>`; });
  container.innerHTML = html;
  document.querySelectorAll('.chips span').forEach(chip => {
    chip.addEventListener('click', () => {
      hapticFeedback();
      chip.classList.toggle('active-chip');
      const chipName = chip.dataset.chip;
      if (chip.classList.contains('active-chip')) selectedChips.add(chipName);
      else selectedChips.delete(chipName);
      saveUserPreferences();
    });
  });
  renderChips();
}

function saveCurrentPlan() {
  (async () => {
    const diveSite = document.getElementById('diveSite')?.value || 'Unnamed Dive';
    const planName = prompt('Enter a name for this dive plan:', diveSite);
    if (!planName) return;
    
    const exportText = await getFormattedExportText();
    const plan = {
      id: Date.now(),
      name: planName,
      exportText: exportText,
      station: currentStation.name,
      date: formatDateDisplay(currentDate),
      time: getSelectedTime(),
      diveType: document.querySelector('input[name="diveType"]:checked')?.value,
      maxDepth: document.getElementById('maxDepth')?.value,
      categories: Array.from(selectedChips),
      risk: currentRisk
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
  const [hour, minute] = plan.time.split(':');
  currentHour = parseInt(hour);
  currentMinute = parseInt(minute);
  
  const radio = document.querySelector(`input[name="diveType"][value="${plan.diveType}"]`);
  if (radio) radio.checked = true;
  
  if (document.getElementById('maxDepth')) {
    document.getElementById('maxDepth').value = plan.maxDepth;
  }
  
  selectedChips.clear();
  plan.categories.forEach(cat => selectedChips.add(cat));
  
  initStations();
  initTimeSpinners();
  buildCalendar();
  loadAllData();
  
  setTimeout(() => {
    renderChips();
    showNotification(`Loaded: ${plan.name}`);
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
  savedPlans.forEach(plan => {
    html += `
      <div class="saved-plan-item" data-plan-id="${plan.id}">
        <div>
          <div class="saved-plan-name">${escapeHtml(plan.name)}</div>
          <div class="saved-plan-details">${plan.station} | ${plan.date} | ${plan.time} | Risk: ${plan.risk}</div>
        </div>
        <button class="delete-plan-btn" data-plan-id="${plan.id}">🗑️</button>
      </div>
    `;
  });
  container.innerHTML = html;
  
  container.querySelectorAll('.saved-plan-item').forEach(item => {
    const planId = parseInt(item.dataset.planId);
    const plan = savedPlans.find(p => p.id === planId);
    if (plan) {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-plan-btn')) {
          loadSavedPlan(plan);
        }
      });
    }
  });
  
  container.querySelectorAll('.delete-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const planId = parseInt(btn.dataset.planId);
      deleteSavedPlan(planId);
    });
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
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(47, 255, 238, 0.9);
    color: #020B24;
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: bold;
    z-index: 2000;
    animation: fadeOut 2s forwards;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
  maxDepthInput.addEventListener('change', (e) => {
    const depth = parseInt(e.target.value);
    if (depth >= 21) {
      const deepChip = Array.from(document.querySelectorAll('.chips span')).find(c => c.dataset.chip === 'Deep');
      if (deepChip && !deepChip.classList.contains('active-chip')) {
        deepChip.classList.add('active-chip');
        selectedChips.add('Deep');
        renderChips();
      }
    }
    e.target.style.borderColor = (depth < 5 || depth > 45) ? '#ff4444' : '#1AA7A7';
  });
}

document.getElementById('whatsappBtn')?.addEventListener('click', async () => {
  const text = await getFormattedExportText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

document.getElementById('emailBtn')?.addEventListener('click', async () => {
  const text = await getFormattedExportText();
  const subject = `Dive Plan - ${document.getElementById('diveSite')?.value || 'Dive Plan'} - ${formatDateDisplay(currentDate)}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
  const text = await getFormattedExportText();
  await navigator.clipboard.writeText(text);
  showNotification('Plan copied to clipboard!');
});

document.getElementById('savePlanBtn')?.addEventListener('click', () => {
  saveCurrentPlan();
});

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

function init() {
  loadUserPreferences();
  loadSavedPlans();
  initStations();
  initTimeSpinners();
  initDiveType();
  initChips();
  buildCalendar();
  loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}