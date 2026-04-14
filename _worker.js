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
    
    if (url.pathname === '/api/tides') {
      try {
        const stationName = url.searchParams.get('station');
        const date = url.searchParams.get('date');
        const WT_API_KEY = env.WORLDTIDES_API_KEY;
        
        if (!WT_API_KEY) {
          return new Response(JSON.stringify({ 
            error: 'API key not configured'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        const coords = stationCoords[stationName.toLowerCase()];
        if (!coords) {
          return new Response(JSON.stringify({ error: 'Unknown station' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Try v2 API which has better Spring/Neap support
        const apiUrlV2 = `https://www.worldtides.info/api?extremes&height&date=${date}&lat=${coords.lat}&lon=${coords.lon}&key=${WT_API_KEY}&datum=LAT&spring`;
        
        console.log(`Fetching tides for ${stationName} on ${date} using v2 API`);
        
        const response = await fetch(apiUrlV2);
        
        if (!response.ok) {
          throw new Error(`WorldTides API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log Spring/Neap data if available
        if (data.spring !== undefined) {
          console.log(`Spring/Neap detection: spring=${data.spring} (${data.spring === 1 ? 'Springs' : 'Neaps'})`);
        } else {
          console.log(`No spring data in response, will calculate from tidal range`);
        }
        
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=21600'
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
    
    return env.ASSETS.fetch(request);
  }
};