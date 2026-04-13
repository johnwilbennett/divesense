// _worker.js - Using LAT (Lowest Astronomical Tide) datum
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const stationCoords = {
      cobh: { lat: 51.85, lon: -8.3 },
      kinsale: { lat: 51.7, lon: -8.517 },
      baltimore: { lat: 51.483, lon: -9.367 },
      dunmanus: { lat: 51.533, lon: -9.667 },
      castletownbere: { lat: 51.65, lon: -9.9 },
      valentia: { lat: 51.933, lon: -10.3 },
      dingle: { lat: 52.117, lon: -10.25 }
    };
    
    if (url.pathname === '/api/tides') {
      try {
        const stationName = url.searchParams.get('station');
        const date = url.searchParams.get('date');
        const WT_API_KEY = env.WORLDTIDES_API_KEY;
        
        if (!WT_API_KEY) {
          return new Response(JSON.stringify({ error: 'API key not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const coords = stationCoords[stationName.toLowerCase()];
        if (!coords) {
          return new Response(JSON.stringify({ error: 'Unknown station' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Use datum=LAT (Lowest Astronomical Tide) - the lowest predicted tide level
        // This represents the worst-case scenario for depth planning
        const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}&datum=LAT&timezone=UTC`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=21600'
          }
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