// _worker.js - Using coordinates instead of station names
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Station coordinates (latitude, longitude)
    const stationCoords = {
      cobh: { lat: 51.8489, lon: -8.2995 },
      kinsale: { lat: 51.7075, lon: -8.5225 },
      baltimore: { lat: 51.4833, lon: -9.3667 },
      dunmanus: { lat: 51.55, lon: -9.6833 },
      castletownbere: { lat: 51.65, lon: -9.9167 },
      valentia: { lat: 51.9333, lon: -10.35 },
      dingle: { lat: 52.1333, lon: -10.2667 }
    };
    
    // Test endpoint
    if (url.pathname === '/api/test') {
      return new Response(JSON.stringify({ 
        message: 'Worker is working!'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check API key endpoint
    if (url.pathname === '/api/check-key') {
      const hasKey = !!env.WORLDTIDES_API_KEY;
      return new Response(JSON.stringify({ 
        hasApiKey: hasKey,
        message: hasKey ? 'API key is set' : 'API key is NOT set'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Tides endpoint
    if (url.pathname === '/api/tides') {
      try {
        const stationName = url.searchParams.get('station');
        const date = url.searchParams.get('date');
        const WT_API_KEY = env.WORLDTIDES_API_KEY;
        
        // Check if API key exists
        if (!WT_API_KEY) {
          return new Response(JSON.stringify({ 
            error: 'API key not configured'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Get coordinates for the station
        const coords = stationCoords[stationName.toLowerCase()];
        if (!coords) {
          return new Response(JSON.stringify({ 
            error: 'Unknown station',
            message: `Station "${stationName}" not found`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Build URL with lat/lon instead of station name
        const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}`;
        
        console.log(`Calling WorldTides for ${stationName} (${coords.lat}, ${coords.lon})`);
        
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
        return new Response(JSON.stringify({ 
          error: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Serve static files
    return env.ASSETS.fetch(request);
  }
};