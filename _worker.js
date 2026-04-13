// _worker.js - Handles both API requests and serves your website
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle API requests for tides
    if (url.pathname === '/api/tides') {
      // Get station and date from the URL parameters
      const station = url.searchParams.get('station');
      const date = url.searchParams.get('date');
      
      // Check if parameters are missing
      if (!station || !date) {
        return new Response(JSON.stringify({ 
          error: 'Missing station or date parameter' 
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Get your WorldTides API key from environment variables
      const WT_API_KEY = env.WORLDTIDES_API_KEY;
      
      // Check if API key is configured
      if (!WT_API_KEY) {
        return new Response(JSON.stringify({ 
          error: 'API key not configured',
          message: 'Please set WORLDTIDES_API_KEY in Cloudflare Pages environment variables'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      try {
        // Build the WorldTides API URL
        const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&station=${station}&key=${WT_API_KEY}`;
        
        console.log(`Fetching tides for ${station} on ${date}`);
        
        // Call WorldTides API
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`WorldTides API returned ${response.status}`);
        }
        
        // Get the tide data
        const data = await response.json();
        
        // Return the tide data as JSON
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=21600' // Cache for 6 hours
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