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
let selectedChips = new Set();
let currentRisk = "Moderate";

// Get ACTUAL current time
const now = new Date();
let currentHour = now.getHours();
let currentMinute = now.getMinutes();

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

// MOCK DATA
function getMockTideData(station, date) {
    const tideTypes = ["High", "Low", "High", "Low"];
    const times = ["02:30", "08:45", "15:00", "21:15"];
    const heights = [4.2, 1.1, 4.5, 0.9];
    
    const stationVariation = stations.findIndex(s => s.name === station.name) * 0.1;
    
    const events = tideTypes.map((type, i) => ({
        type: type,
        time: times[i],
        height: heights[i] + stationVariation,
        timestamp: new Date(date).setHours(parseInt(times[i].split(':')[0]), parseInt(times[i].split(':')[1]))
    }));
    
    const dayOfMonth = date.getDate();
    const isSpring = dayOfMonth < 7 || (dayOfMonth > 14 && dayOfMonth < 21);
    
    return {
        events: events,
        moonPhase: getMoonPhase(date),
        tideType: isSpring ? "Springs" : "Neaps"
    };
}

function getMockWeatherData(station, date) {
    const hourly = [];
    const baseWindSpeed = Math.floor(Math.random() * 10) + 8;
    const baseSwell = 0.8 + Math.random() * 1.2;
    const baseTemp = 12 + Math.random() * 6;
    
    for (let hour = 0; hour < 24; hour++) {
        const variation = Math.sin(hour * Math.PI / 12) * 0.3;
        
        hourly.push({
            time: hour.toString().padStart(2, '0') + ":00",
            windSpeed: Math.max(1, Math.floor(baseWindSpeed + variation * 5)),
            windSpeedKmh: (baseWindSpeed + variation * 5) * 3.6,
            windDir: (hour * 15) % 360,
            gusts: Math.max(2, Math.floor(baseWindSpeed + variation * 8 + 3)),
            swellHeight: Math.max(0.3, baseSwell + variation * 0.5),
            swellDir: (hour * 20) % 360,
            visibility: 8 + Math.random() * 7,
            rain: Math.random() > 0.7 ? Math.random() * 2 : 0,
            cloudCover: Math.floor(30 + Math.random() * 60),
            airTemp: baseTemp + variation * 3,
            uvIndex: hour > 8 && hour < 17 ? Math.floor(2 + Math.random() * 6) : 0
        });
    }
    return hourly;
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

function initTimeSpinners() {
    const hourWheel = document.getElementById('hourWheel');
    const minuteWheel = document.getElementById('minuteWheel');
    
    if (!hourWheel || !minuteWheel) return;
    
    // Create hours 0-23
    let hourHtml = '';
    for (let h = 0; h < 24; h++) {
        const hourStr = h.toString().padStart(2, '0');
        const isSelected = (h === currentHour);
        hourHtml += '<div class="spinner-option' + (isSelected ? ' selected' : '') + '" data-value="' + h + '">' + hourStr + '</div>';
    }
    hourWheel.innerHTML = hourHtml;
    
    // Create minutes 0-59
    let minuteHtml = '';
    for (let m = 0; m < 60; m++) {
        const minuteStr = m.toString().padStart(2, '0');
        const isSelected = (m === currentMinute);
        minuteHtml += '<div class="spinner-option' + (isSelected ? ' selected' : '') + '" data-value="' + m + '">' + minuteStr + '</div>';
    }
    minuteWheel.innerHTML = minuteHtml;
    
    // Function to scroll to a specific value without animation
    function scrollToValue(wheelElement, targetValue) {
        const options = wheelElement.querySelectorAll('.spinner-option');
        for (let i = 0; i < options.length; i++) {
            if (parseInt(options[i].dataset.value) === targetValue) {
                options[i].scrollIntoView({ block: 'center', behavior: 'auto' });
                break;
            }
        }
    }
    
    // Function to update highlight only
    function updateHighlightOnly() {
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
    
    // Prevent touch/mouse drag that moves the wheel position
    function preventDragMovement(wheelElement) {
        wheelElement.addEventListener('touchstart', function(e) {
            // Allow scrolling but prevent page drag
            e.stopPropagation();
        }, { passive: false });
        
        wheelElement.addEventListener('mousedown', function(e) {
            // Prevent default to avoid accidental text selection
            e.preventDefault();
        });
    }
    
    // Hour wheel scroll handler - only updates on scroll end
    let hourScrollTimeout;
    hourWheel.addEventListener('scroll', function() {
        // Prevent the wheel from being moved by dragging - keep it anchored
        if (hourScrollTimeout) clearTimeout(hourScrollTimeout);
        hourScrollTimeout = setTimeout(() => {
            const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
            const options = document.querySelectorAll('#hourWheel .spinner-option');
            let closest = null;
            let minDist = Infinity;
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
                const newHour = parseInt(closest.dataset.value);
                if (newHour !== currentHour) {
                    currentHour = newHour;
                    updateHighlightOnly();
                    updateDetailed();
                    updateHourly();
                }
                // Snap to the closest value
                closest.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }, 50);
    });
    
    // Minute wheel scroll handler
    let minuteScrollTimeout;
    minuteWheel.addEventListener('scroll', function() {
        if (minuteScrollTimeout) clearTimeout(minuteScrollTimeout);
        minuteScrollTimeout = setTimeout(() => {
            const center = minuteWheel.scrollTop + minuteWheel.clientHeight / 2;
            const options = document.querySelectorAll('#minuteWheel .spinner-option');
            let closest = null;
            let minDist = Infinity;
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
                const newMinute = parseInt(closest.dataset.value);
                if (newMinute !== currentMinute) {
                    currentMinute = newMinute;
                    updateHighlightOnly();
                    updateDetailed();
                    updateHourly();
                }
                // Snap to the closest value
                closest.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }, 50);
    });
    
    // Apply drag prevention
    preventDragMovement(hourWheel);
    preventDragMovement(minuteWheel);
    
    // Initial highlight
    updateHighlightOnly();
    
    // Scroll to current values
    setTimeout(() => {
        scrollToValue(hourWheel, currentHour);
        scrollToValue(minuteWheel, currentMinute);
        updateHighlightOnly();
    }, 100);
}

function initDiveType() {
    const radios = document.querySelectorAll('input[name="diveType"]');
    const coxField = document.getElementById('coxField');
    
    if (!radios.length) return;
    
    for (let i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(e) {
            if (coxField) {
                coxField.style.display = e.target.value === 'Boat' ? 'block' : 'none';
            }
            const lifeJackets = document.getElementById('lifeJackets');
            if (lifeJackets) {
                lifeJackets.checked = e.target.value === 'Boat';
            }
            updateTimeLabel();
        });
    }
    
    const boatRadio = document.querySelector('input[name="diveType"][value="Boat"]');
    if (boatRadio && boatRadio.checked && coxField) {
        coxField.style.display = 'block';
    } else if (coxField) {
        coxField.style.display = 'none';
    }
    updateTimeLabel();
}

function updateTides() {
    const tides = getMockTideData(currentStation, currentDate);
    const tideTypeClass = (tides.tideType === 'Springs') ? 'springs-text' : 'neaps-text';
    const tideTypeIcon = (tides.tideType === 'Springs') ? '🌕' : '🌙';
    
    let html = '<div class="' + tideTypeClass + '" style="font-size:1.2rem; margin-bottom:10px;">' + tideTypeIcon + ' ' + tides.tideType.toUpperCase() + ' TIDES</div>';
    
    for (let i = 0; i < tides.events.length; i++) {
        const e = tides.events[i];
        const tideIcon = (e.type === 'High') ? '🌊 HIGH' : '⬇️ LOW';
        html += '<div class="tide-event"><span>' + tideIcon + '</span><span>' + e.time + '</span><span>' + e.height.toFixed(2) + 'm</span></div>';
    }
    
    html += '<div class="text-small mt-2">🌙 ' + tides.moonPhase + '</div>';
    
    const tideDataDiv = document.getElementById('tideData');
    if (tideDataDiv) tideDataDiv.innerHTML = html;
}

function updateHourly() {
    const weather = getMockWeatherData(currentStation, currentDate);
    const tides = getMockTideData(currentStation, currentDate);
    const selectedTime = getSelectedTime();
    const selectedHour = parseInt(selectedTime.split(':')[0]);
    
    const container = document.getElementById('hourlyScroll');
    if (!container) return;
    
    let html = '';
    for (let i = 0; i < weather.length; i++) {
        const hour = weather[i];
        const hourNum = parseInt(hour.time);
        
        let closestTide = tides.events[0];
        let minDiff = Math.abs(parseInt(closestTide.time) - hourNum);
        for (let j = 1; j < tides.events.length; j++) {
            const diff = Math.abs(parseInt(tides.events[j].time) - hourNum);
            if (diff < minDiff) {
                minDiff = diff;
                closestTide = tides.events[j];
            }
        }
        
        const isSlack = Math.abs(hourNum - parseInt(closestTide.time)) <= 40;
        const highlightClass = (hourNum === selectedHour) ? 'highlight' : '';
        
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

function updateDetailed() {
    const weather = getMockWeatherData(currentStation, currentDate);
    const tides = getMockTideData(currentStation, currentDate);
    const selectedTime = getSelectedTime();
    const selectedHour = parseInt(selectedTime.split(':')[0]);
    
    let hourData = null;
    for (let i = 0; i < weather.length; i++) {
        if (parseInt(weather[i].time) === selectedHour) {
            hourData = weather[i];
            break;
        }
    }
    if (!hourData) hourData = weather[selectedHour] || weather[12];
    
    let prevTide = null;
    let nextTide = null;
    
    for (let i = 0; i < tides.events.length; i++) {
        const tideHour = parseInt(tides.events[i].time);
        if (tideHour <= selectedHour) {
            prevTide = tides.events[i];
        }
        if (tideHour >= selectedHour && !nextTide) {
            nextTide = tides.events[i];
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
    const categoriesArray = Array.from(selectedChips);
    const maxDepth = document.getElementById('maxDepth');
    const coxNameInput = document.getElementById('coxName');
    const coxModeRadios = document.querySelectorAll('input[name="coxMode"]');
    const participationRadios = document.querySelectorAll('input[name="participation"]');
    const torches = document.getElementById('torches');
    const lifeJackets = document.getElementById('lifeJackets');
    const selectedTime = getSelectedTime();
    
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
        selectedTime: selectedTime,
        categories: categoriesArray.join(', '),
        maxDepth: maxDepth ? maxDepth.value : '',
        coxName: coxNameInput ? coxNameInput.value : 'N/A',
        coxMode: coxMode,
        participation: participation,
        torches: torches && torches.checked ? '✓ Torches Required' : '',
        lifeJackets: lifeJackets && lifeJackets.checked ? '✓ Life Jackets Required' : ''
    };
}

const whatsappBtn = document.getElementById('whatsappBtn');
if (whatsappBtn) {
    whatsappBtn.addEventListener('click', function() {
        const data = getExportData();
        const weather = getMockWeatherData(currentStation, currentDate);
        const selectedTime = getSelectedTime();
        const selectedHour = parseInt(selectedTime.split(':')[0]);
        let hourWeather = null;
        for (let i = 0; i < weather.length; i++) {
            if (parseInt(weather[i].time) === selectedHour) {
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
    emailBtn.addEventListener('click', function() {
        const data = getExportData();
        const weather = getMockWeatherData(currentStation, currentDate);
        const selectedTime = getSelectedTime();
        const selectedHour = parseInt(selectedTime.split(':')[0]);
        let hourWeather = null;
        for (let i = 0; i < weather.length; i++) {
            if (parseInt(weather[i].time) === selectedHour) {
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

function loadAllData() {
    updateTides();
    updateHourly();
    updateDetailed();
}

const datePicker = document.getElementById('datePicker');
if (datePicker) {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    datePicker.value = year + "-" + month + "-" + day;
    datePicker.min = formatDateForAPI(today);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 10);
    datePicker.max = formatDateForAPI(maxDate);
    
    datePicker.addEventListener('change', function(e) {
        currentDate = new Date(e.target.value);
        loadAllData();
    });
}

function init() {
    initStations();
    initTimeSpinners();
    initDiveType();
    initChips();
    loadAllData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}