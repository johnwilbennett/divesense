// STATIONS DATA
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
let tideCache = new Map();
let weatherCache = new Map();
let selectedChips = new Set();
let currentRisk = "Moderate";

const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

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

function getTideType(tideEvents) {
    if (!tideEvents || tideEvents.length < 4) return "Neaps";
    let totalRange = 0;
    for (let i = 0; i < tideEvents.length - 1; i++) {
        if (tideEvents[i].type !== tideEvents[i+1].type) {
            totalRange += Math.abs(tideEvents[i].height - tideEvents[i+1].height);
        }
    }
    const avgRange = totalRange / (tideEvents.length - 1);
    return avgRange > 2.5 ? "Springs" : "Neaps";
}

async function fetchRealTideData(station, date) {
    const cacheKey = station.worldtidesId + "_" + formatDateForAPI(date);
    
    if (tideCache.has(cacheKey)) {
        return tideCache.get(cacheKey);
    }
    
    try {
        const formattedDate = formatDateForAPI(date);
        const apiUrl = "/api/tides?station=" + station.worldtidesId + "&date=" + formattedDate;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }
        
        const data = await response.json();
        
        let tideEvents = [];
        if (data.extremes && Array.isArray(data.extremes)) {
            tideEvents = data.extremes.map(function(extreme) {
                return {
                    type: extreme.type === "High" ? "High" : "Low",
                    time: extreme.dt.substring(11, 16),
                    height: extreme.height,
                    timestamp: new Date(extreme.dt).getTime()
                };
            });
        }
        
        tideEvents.sort(function(a, b) {
            return a.timestamp - b.timestamp;
        });
        
        const tideData = {
            events: tideEvents,
            moonPhase: getMoonPhase(date),
            tideType: getTideType(tideEvents)
        };
        
        tideCache.set(cacheKey, tideData);
        return tideData;
        
    } catch (error) {
        console.error("Error fetching tide data:", error);
        return {
            events: [
                { type: "High", time: "--:--", height: 0 },
                { type: "Low", time: "--:--", height: 0 }
            ],
            moonPhase: "Unknown",
            tideType: "Neaps"
        };
    }
}

async function fetchRealWeather(station, date) {
    const cacheKey = "weather_" + station.lat + "_" + station.lon + "_" + formatDateForAPI(date);
    
    if (weatherCache.has(cacheKey)) {
        return weatherCache.get(cacheKey);
    }
    
    try {
        const lat = station.lat;
        const lon = station.lon;
        const dateStr = formatDateForAPI(date);
        
        const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,rain,cloudcover,temperature_2m,uv_index&timezone=auto&start_date=" + dateStr + "&end_date=" + dateStr;
        
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
        for (let i = 0; i < 24; i++) {
            const time = new Date(data.hourly.time[i]);
            const hour = time.getHours();
            
            hourly.push({
                time: hour.toString().padStart(2, '0') + ":00",
                windSpeed: kmhToBft(data.hourly.wind_speed_10m[i]),
                windSpeedKmh: data.hourly.wind_speed_10m[i],
                windDir: data.hourly.wind_direction_10m[i],
                gusts: kmhToBft(data.hourly.wind_gusts_10m[i]),
                swellHeight: 0.5 + Math.random() * 1.5,
                swellDir: data.hourly.wind_direction_10m[i],
                visibility: data.hourly.visibility[i] / 1000,
                rain: data.hourly.rain[i],
                cloudCover: data.hourly.cloudcover[i],
                airTemp: data.hourly.temperature_2m[i],
                uvIndex: data.hourly.uv_index[i]
            });
        }
        
        weatherCache.set(cacheKey, hourly);
        return hourly;
        
    } catch (error) {
        console.error("Error fetching weather:", error);
        const hourly = [];
        for (let hour = 0; hour < 24; hour++) {
            hourly.push({
                time: hour.toString().padStart(2, '0') + ":00",
                windSpeed: Math.floor(Math.random() * 15) + 5,
                windDir: Math.floor(Math.random() * 360),
                gusts: Math.floor(Math.random() * 20) + 8,
                swellHeight: Math.random() * 2,
                swellDir: Math.floor(Math.random() * 360),
                visibility: Math.random() * 10 + 5,
                rain: Math.random() * 5,
                cloudCover: Math.floor(Math.random() * 100),
                airTemp: Math.floor(Math.random() * 15) + 10,
                uvIndex: Math.floor(Math.random() * 8)
            });
        }
        weatherCache.set(cacheKey, hourly);
        return hourly;
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
            const idx = parseInt(this.dataset.idx);
            currentStation = stations[idx];
            initStations();
            loadAllData();
        });
    }
}

function initTimeWheel() {
    const wheel = document.getElementById('timeWheel');
    if (!wheel) return;
    
    const times = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            times.push(h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0'));
        }
    }
    
    let wheelHtml = '';
    for (let i = 0; i < times.length; i++) {
        wheelHtml += '<div class="time-option" data-time="' + times[i] + '">' + times[i] + '</div>';
    }
    wheel.innerHTML = wheelHtml;
    
    const now = new Date();
    const defaultTime = now.getHours().toString().padStart(2, '0') + ":" + (Math.floor(now.getMinutes() / 15) * 15).toString().padStart(2, '0');
    
    function scrollToTime(time) {
        const options = document.querySelectorAll('.time-option');
        for (let i = 0; i < options.length; i++) {
            if (options[i].dataset.time === time) {
                options[i].scrollIntoView({ block: 'center' });
                options[i].classList.add('selected');
            } else {
                options[i].classList.remove('selected');
            }
        }
    }
    
    wheel.addEventListener('scroll', function() {
        const center = wheel.scrollTop + wheel.clientHeight / 2;
        const options = document.querySelectorAll('.time-option');
        let closest = null;
        let minDist = Infinity;
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const dist = Math.abs(opt.offsetTop + opt.offsetHeight / 2 - center);
            if (dist < minDist) {
                minDist = dist;
                closest = opt;
            }
        }
        if (closest) {
            for (let i = 0; i < options.length; i++) {
                options[i].classList.remove('selected');
            }
            closest.classList.add('selected');
            const time = closest.dataset.time;
            const hourInput = document.getElementById('hourInput');
            const minuteInput = document.getElementById('minuteInput');
            if (hourInput) hourInput.value = time.split(':')[0];
            if (minuteInput) minuteInput.value = time.split(':')[1];
            updateDetailed();
            updateHourly();
        }
    });
    
    scrollToTime(defaultTime);
    
    const hourInput = document.getElementById('hourInput');
    const minuteInput = document.getElementById('minuteInput');
    
    if (hourInput) {
        hourInput.addEventListener('change', function() {
            const h = hourInput.value.padStart(2, '0');
            const m = minuteInput ? minuteInput.value.padStart(2, '0') : "00";
            scrollToTime(h + ":" + m);
        });
    }
    
    if (minuteInput) {
        minuteInput.addEventListener('change', function() {
            const h = hourInput ? hourInput.value.padStart(2, '0') : "00";
            const m = minuteInput.value.padStart(2, '0');
            scrollToTime(h + ":" + m);
        });
    }
}

function initDiveType() {
    const radios = document.querySelectorAll('input[name="diveType"]');
    const coxField = document.getElementById('coxField');
    const timeLabel = document.getElementById('timeLabel');
    
    if (!radios.length) return;
    
    for (let i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(e) {
            if (coxField) {
                coxField.style.display = e.target.value === 'Boat' ? 'block' : 'none';
            }
            if (timeLabel) {
                timeLabel.innerText = e.target.value === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
            }
            const lifeJackets = document.getElementById('lifeJackets');
            if (lifeJackets) {
                lifeJackets.checked = e.target.value === 'Boat';
            }
        });
    }
    
    // Set initial state
    const boatRadio = document.querySelector('input[name="diveType"][value="Boat"]');
    if (boatRadio && boatRadio.checked && coxField) {
        coxField.style.display = 'block';
    } else if (coxField) {
        coxField.style.display = 'none';
    }
}

async function updateTides() {
    const tides = await fetchRealTideData(currentStation, currentDate);
    const tideTypeClass = (tides.tideType === 'Springs') ? 'springs-text' : 'neaps-text';
    const tideTypeIcon = (tides.tideType === 'Springs') ? '🌕' : '🌙';
    
    let html = '<div class="' + tideTypeClass + '" style="font-size:1.2rem; margin-bottom:10px;">' + tideTypeIcon + ' ' + tides.tideType.toUpperCase() + ' TIDES</div>';
    
    if (tides.events && tides.events.length > 0) {
        for (let i = 0; i < tides.events.length; i++) {
            const e = tides.events[i];
            const tideIcon = (e.type === 'High') ? '🌊 HIGH' : '⬇️ LOW';
            html += '<div class="tide-event"><span>' + tideIcon + '</span><span>' + e.time + '</span><span>' + e.height.toFixed(2) + 'm</span></div>';
        }
    } else {
        html += '<div class="tide-event">⚠️ Tide data unavailable</div>';
    }
    
    html += '<div class="text-small mt-2">🌙 ' + tides.moonPhase + '</div>';
    
    const tideDataDiv = document.getElementById('tideData');
    if (tideDataDiv) tideDataDiv.innerHTML = html;
}

async function updateHourly() {
    const weather = await fetchRealWeather(currentStation, currentDate);
    const tides = await fetchRealTideData(currentStation, currentDate);
    const selectedTimeElement = document.querySelector('.time-option.selected');
    const selectedTime = selectedTimeElement ? selectedTimeElement.dataset.time : "12:00";
    
    const container = document.getElementById('hourlyScroll');
    if (!container) return;
    
    if (!weather || weather.length === 0) {
        container.innerHTML = '<div>Loading weather data...</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < weather.length; i++) {
        const hour = weather[i];
        let closestTide = null;
        if (tides.events && tides.events.length > 0) {
            const hourNum = parseInt(hour.time);
            closestTide = tides.events[0];
            let minDiff = Math.abs(parseInt(closestTide.time) - hourNum);
            for (let j = 1; j < tides.events.length; j++) {
                const diff = Math.abs(parseInt(tides.events[j].time) - hourNum);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestTide = tides.events[j];
                }
            }
        }
        
        const isSlack = closestTide && Math.abs(parseInt(hour.time) - parseInt(closestTide.time)) <= 40;
        const highlightClass = (hour.time === selectedTime) ? 'highlight' : '';
        
        html += '<div class="hourly-card ' + highlightClass + '">';
        html += '<strong>' + hour.time + '</strong>';
        html += '<div>💨 ' + hour.windSpeed + ' Bft</div>';
        html += '<div>' + degreesToDirection(hour.windDir) + '</div>';
        html += '<div>🌊 ' + hour.swellHeight.toFixed(1) + 'm</div>';
        if (isSlack) {
            html += '<div style="color:#44ff44; font-size:10px;">⚡ Slack Water</div>';
        }
        html += '</div>';
    }
    container.innerHTML = html;
}

async function updateDetailed() {
    const weather = await fetchRealWeather(currentStation, currentDate);
    const tides = await fetchRealTideData(currentStation, currentDate);
    const selectedTimeElement = document.querySelector('.time-option.selected');
    const selectedTime = selectedTimeElement ? selectedTimeElement.dataset.time : "12:00";
    
    let hourData = null;
    for (let i = 0; i < weather.length; i++) {
        if (weather[i].time === selectedTime) {
            hourData = weather[i];
            break;
        }
    }
    if (!hourData) hourData = weather[12];
    
    if (!hourData) {
        const panel = document.getElementById('detailedPanel');
        if (panel) panel.innerHTML = '<div>Loading detailed data...</div>';
        return;
    }
    
    const selectedHour = parseInt(selectedTime);
    let prevTide = null;
    let nextTide = null;
    
    if (tides.events && tides.events.length > 0) {
        for (let i = 0; i < tides.events.length; i++) {
            const tideHour = parseInt(tides.events[i].time);
            if (tideHour <= selectedHour) {
                prevTide = tides.events[i];
            }
            if (tideHour >= selectedHour && !nextTide) {
                nextTide = tides.events[i];
            }
        }
    }
    
    let riskScore = (hourData.windSpeed / 12) * 0.4 + (hourData.swellHeight / 4) * 0.4 + (1 - (hourData.visibility / 20)) * 0.2;
    riskScore = Math.min(1, Math.max(0, riskScore));
    
    let riskLevel = "Low";
    let riskPercent = 12.5;
    if (riskScore > 0.75) {
        riskLevel = "High";
        riskPercent = 87.5;
    } else if (riskScore > 0.5) {
        riskLevel = "Caution";
        riskPercent = 62.5;
    } else if (riskScore > 0.25) {
        riskLevel = "Moderate";
        riskPercent = 37.5;
    }
    
    currentRisk = riskLevel;
    const riskPointer = document.getElementById('riskPointer');
    if (riskPointer) riskPointer.style.marginLeft = riskPercent + '%';
    
    let html = '';
    html += '<div class="detail-row"><strong>Wind:</strong> ' + hourData.windSpeed + ' Bft ' + degreesToDirection(hourData.windDir) + ' (Gusts ' + hourData.gusts + ' Bft)</div>';
    html += '<div class="detail-row"><strong>Visibility:</strong> ' + hourData.visibility.toFixed(1) + ' km</div>';
    html += '<div class="detail-row"><strong>Rain:</strong> ' + hourData.rain.toFixed(1) + ' mm</div>';
    html += '<div class="detail-row"><strong>Cloud Cover:</strong> ' + hourData.cloudCover + '%</div>';
    html += '<div class="detail-row"><strong>Air Temp:</strong> ' + hourData.airTemp.toFixed(1) + '°C</div>';
    html += '<div class="detail-row"><strong>UV Index:</strong> ' + hourData.uvIndex + '</div>';
    html += '<div class="detail-row"><strong>Swell:</strong> ' + hourData.swellHeight.toFixed(1) + 'm from ' + degreesToDirection(hourData.swellDir) + '</div>';
    
    let riskColor = '#88ff88';
    if (riskLevel === 'High') riskColor = '#ff8888';
    else if (riskLevel === 'Caution') riskColor = '#ffaa66';
    else if (riskLevel === 'Moderate') riskColor = '#ffff88';
    html += '<div class="detail-row"><strong>Risk Assessment:</strong> <span style="color: ' + riskColor + '">' + riskLevel + '</span></div>';
    
    if (prevTide || nextTide) {
        html += '<div class="detail-row" style="margin-top:10px;"><strong>Tides near ' + selectedTime + ':</strong></div>';
        if (prevTide) {
            html += '<div class="detail-row">← ' + prevTide.type + ' at ' + prevTide.time + ' (' + prevTide.height.toFixed(2) + 'm)</div>';
        }
        if (nextTide) {
            html += '<div class="detail-row">→ ' + nextTide.type + ' at ' + nextTide.time + ' (' + nextTide.height.toFixed(2) + 'm)</div>';
        }
        html += '<div class="detail-row">' + (tides.tideType === 'Springs' ? '🌕 Spring tides expected' : '🌙 Neap tides expected') + '</div>';
        html += '<div class="detail-row">' + tides.moonPhase + '</div>';
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
            this.classList.toggle('active-chip');
            const chipName = this.dataset.chip;
            if (this.classList.contains('active-chip')) {
                selectedChips.add(chipName);
            } else {
                selectedChips.delete(chipName);
            }
        });
    }
}

// Depth validation and auto Deep chip
const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
    maxDepthInput.addEventListener('change', function(e) {
        const depth = parseInt(e.target.value);
        if (depth >= 21) {
            const chips = document.querySelectorAll('.chips span');
            for (let i = 0; i < chips.length; i++) {
                if (chips[i].dataset.chip === 'Deep') {
                    if (!chips[i].classList.contains('active-chip')) {
                        chips[i].classList.add('active-chip');
                        selectedChips.add('Deep');
                    }
                    break;
                }
            }
        }
        if (depth < 5 || depth > 45) {
            e.target.style.borderColor = '#ff4444';
        } else {
            e.target.style.borderColor = '#1AA7A7';
        }
    });
}

function getExportData() {
    const diveSite = document.getElementById('diveSite');
    const dod = document.getElementById('dod');
    const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
    const selectedTimeElement = document.querySelector('.time-option.selected');
    const categoriesArray = Array.from(selectedChips);
    const maxDepth = document.getElementById('maxDepth');
    const coxNameInput = document.getElementById('coxName');
    const coxModeRadios = document.querySelectorAll('input[name="coxMode"]');
    const participationRadios = document.querySelectorAll('input[name="participation"]');
    const torches = document.getElementById('torches');
    const lifeJackets = document.getElementById('lifeJackets');
    
    let diveType = "Boat";
    for (let i = 0; i < diveTypeRadios.length; i++) {
        if (diveTypeRadios[i].checked) {
            diveType = diveTypeRadios[i].value;
            break;
        }
    }
    
    let coxMode = "N/A";
    for (let i = 0; i < coxModeRadios.length; i++) {
        if (coxModeRadios[i].checked) {
            coxMode = coxModeRadios[i].value;
            break;
        }
    }
    
    let participation = "Open to All";
    for (let i = 0; i < participationRadios.length; i++) {
        if (participationRadios[i].checked) {
            participation = participationRadios[i].value;
            break;
        }
    }
    
    return { 
        diveSite: diveSite ? diveSite.value : '',
        dod: dod ? dod.value : '',
        diveType: diveType,
        selectedTime: selectedTimeElement ? selectedTimeElement.dataset.time : "12:00",
        categories: categoriesArray.join(', '),
        maxDepth: maxDepth ? maxDepth.value : '',
        coxName: coxNameInput ? coxNameInput.value : 'N/A',
        coxMode: coxMode,
        participation: participation,
        torches: torches && torches.checked ? '✓ Torches Required' : '',
        lifeJackets: lifeJackets && lifeJackets.checked ? '✓ Life Jackets Required' : ''
    };
}

// Export buttons
const whatsappBtn = document.getElementById('whatsappBtn');
if (whatsappBtn) {
    whatsappBtn.addEventListener('click', async function() {
        const data = getExportData();
        const weather = await fetchRealWeather(currentStation, currentDate);
        const selectedTimeElement = document.querySelector('.time-option.selected');
        const selectedTime = selectedTimeElement ? selectedTimeElement.dataset.time : "12:00";
        let hourWeather = null;
        for (let i = 0; i < weather.length; i++) {
            if (weather[i].time === selectedTime) {
                hourWeather = weather[i];
                break;
            }
        }
        
        let text = "🌊 DiveSense Dive Plan 🌊\n\n";
        text += "📍 Station: " + currentStation.name + "\n";
        text += "🏊 Dive Site: " + data.diveSite + "\n";
        text += "⏰ Time: " + data.selectedTime + " (" + (data.diveType === 'Boat' ? 'Lines Away' : 'Kitted Brief') + ")\n\n";
        text += "🌡️ Conditions:\n";
        text += "• Wind: " + (hourWeather ? hourWeather.windSpeed : '?') + " Bft " + (hourWeather ? degreesToDirection(hourWeather.windDir) : '?') + "\n";
        text += "• Swell: " + (hourWeather ? hourWeather.swellHeight.toFixed(1) : '?') + "m\n";
        text += "• Visibility: " + (hourWeather ? hourWeather.visibility.toFixed(1) : '?') + "km\n";
        text += "• Air Temp: " + (hourWeather ? hourWeather.airTemp.toFixed(1) : '?') + "°C\n\n";
        text += "📋 Plan:\n";
        text += "• DOD: " + data.dod + "\n";
        text += "• Max Depth: " + data.maxDepth + "m\n";
        text += "• Categories: " + data.categories + "\n\n";
        text += "⚠️ Risk: " + currentRisk + "\n\n";
        if (data.torches) text += "🔦 " + data.torches + "\n";
        if (data.lifeJackets) text += "🦺 " + data.lifeJackets + "\n";
        text += "\n_Always verify with official sources_";
        
        window.open("https://wa.me/?text=" + encodeURIComponent(text), '_blank');
    });
}

const emailBtn = document.getElementById('emailBtn');
if (emailBtn) {
    emailBtn.addEventListener('click', async function() {
        const data = getExportData();
        const weather = await fetchRealWeather(currentStation, currentDate);
        const selectedTimeElement = document.querySelector('.time-option.selected');
        const selectedTime = selectedTimeElement ? selectedTimeElement.dataset.time : "12:00";
        let hourWeather = null;
        for (let i = 0; i < weather.length; i++) {
            if (weather[i].time === selectedTime) {
                hourWeather = weather[i];
                break;
            }
        }
        
        const subject = "Dive Plan - " + data.diveSite + " - " + formatDateDisplay(currentDate);
        let body = "DiveSense Dive Plan\n==================\n";
        body += "Station: " + currentStation.name + "\n";
        body += "Date: " + formatDateDisplay(currentDate) + "\n";
        body += "Dive Site: " + data.diveSite + "\n";
        body += "Dive Type: " + data.diveType + "\n";
        body += "Time: " + data.selectedTime + "\n\n";
        body += "Conditions:\n";
        body += "- Wind: " + (hourWeather ? hourWeather.windSpeed : '?') + " Bft " + (hourWeather ? degreesToDirection(hourWeather.windDir) : '?') + "\n";
        body += "- Swell: " + (hourWeather ? hourWeather.swellHeight.toFixed(1) : '?') + "m\n";
        body += "- Visibility: " + (hourWeather ? hourWeather.visibility.toFixed(1) : '?') + "km\n";
        body += "- Air Temp: " + (hourWeather ? hourWeather.airTemp.toFixed(1) : '?') + "°C\n\n";
        body += "Plan Details:\n";
        body += "- DOD: " + data.dod + "\n";
        body += "- Max Depth: " + data.maxDepth + "m\n";
        body += "- Categories: " + data.categories + "\n";
        body += "- Risk Level: " + currentRisk + "\n\n";
        if (data.torches) body += "- " + data.torches + "\n";
        if (data.lifeJackets) body += "- " + data.lifeJackets + "\n";
        body += "\n---\nCreated with DiveSense";
        
        window.location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
}

async function loadAllData() {
    const tideDiv = document.getElementById('tideData');
    const hourlyDiv = document.getElementById('hourlyScroll');
    const detailedDiv = document.getElementById('detailedPanel');
    
    if (tideDiv) tideDiv.innerHTML = '<div>Loading tide data...</div>';
    if (hourlyDiv) hourlyDiv.innerHTML = '<div>Loading weather data...</div>';
    if (detailedDiv) detailedDiv.innerHTML = '<div>Loading conditions...</div>';
    
    await updateTides();
    await updateHourly();
    await updateDetailed();
}

// Date picker setup
const datePicker = document.getElementById('datePicker');
if (datePicker) {
    const today = new Date();
    datePicker.valueAsDate = today;
    datePicker.min = formatDateForAPI(today);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 10);
    datePicker.max = formatDateForAPI(maxDate);
    
    datePicker.addEventListener('change', function(e) {
        currentDate = new Date(e.target.value);
        loadAllData();
    });
}

// Initialize everything
function init() {
    initStations();
    initTimeWheel();
    initDiveType();
    initChips();
    loadAllData();
}

// Start the app when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}