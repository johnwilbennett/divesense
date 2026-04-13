// _worker.js - Debug version
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const stationCoords = {
      cobh: { lat: 51.8489, lon: -8.2995 },
      kinsale: { lat: 51.7075, lon: -8.5225 },
      baltimore: { lat: 51.4833, lon: -9.3667 },
      dunmanus: { lat: 51.55, lon: -9.6833 },
      castletownbere: { lat: 51.65, lon: -9.9167 },
      valentia: { lat: 51.9333, lon: -10.35 },
      dingle: { lat: 52.1333, lon: -10.2667 }
    };
    
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({ message: 'Worker is working!' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/tides') {
      try {
        const stationName = url.searchParams.get('station');
        const date = url.searchParams.get('date');
        const WT_API_KEY = env.WORLDTIDES_API_KEY;
        
        const coords = stationCoords[stationName.toLowerCase()];
        if (!coords) {
          return new Response(JSON.stringify({ error: 'Unknown station' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Try different API versions
        const apiUrlV3 = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}`;
        const apiUrlV2 = `https://www.worldtides.info/api?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}`;
        
        // Try v3 first
        let response = await fetch(apiUrlV3);
        let data = await response.json();
        
        // If v3 fails, try v2
        if (data.error || data.status === 400) {
          response = await fetch(apiUrlV2);
          data = await response.json();
        }
        
        // Return the full response for debugging
        return new Response(JSON.stringify({
          station: stationName,
          coords: coords,
          date: date,
          apiResponse: data,
          urlsTried: {
            v3: apiUrlV3.replace(WT_API_KEY, 'HIDDEN'),
            v2: apiUrlV2.replace(WT_API_KEY, 'HIDDEN')
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return env.ASSETS.fetch(request);
  }
};