// _worker.js - WorldTides API proxy with LAT datum and Spring/Neap detection
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
    
    // Handle API requests
    if (url.pathname === '/api/tides') {
      try {
        const stationName = url.searchParams.get('station');
        const date = url.searchParams.get('date');
        const WT_API_KEY = env.WORLDTIDES_API_KEY;
        
        // Check if API key exists
        if (!WT_API_KEY) {
          return new Response(JSON.stringify({ 
            error: 'API key not configured',
            message: 'Please set WORLDTIDES_API_KEY in environment variables'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
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
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // Build WorldTides API URL with:
        // - extremes: Get high/low tide times
        // - height: Get tide heights
        // - datum=LAT: Lowest Astronomical Tide (conservative for diving)
        // - timezone=UTC: Get UTC times (we'll convert to local)
        // - spring: Get Spring/Neap tide prediction
        const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}&datum=LAT&timezone=UTC&spring`;
        
        console.log(`Fetching tides for ${stationName} on ${date}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`WorldTides API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Log Spring/Neap data if available
        if (data.spring !== undefined) {
          console.log(`Spring/Neap detection: spring=${data.spring} (${data.spring === 1 ? 'Springs' : 'Neaps'})`);
        }
        
        // Return the data with cache headers (6-hour cache)
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=21600',
            'CDN-Cache-Control': 'public, max-age=21600'
          }
        });
        
      } catch (error) {
        console.error('Error fetching from WorldTides:', error);
        
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch tide data',
          message: error.message
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // For all other requests (HTML, CSS, JS files), serve your static website
    return env.ASSETS.fetch(request);
  }
};