export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  const url = new URL(request.url);
  const station = url.searchParams.get('station');
  const date = url.searchParams.get('date');
  
  if (!station || !date) {
    return new Response(JSON.stringify({ error: 'Missing station or date parameter' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  const WT_API_KEY = env.WORLDTIDES_API_KEY;
  
  if (!WT_API_KEY) {
    console.error('WorldTides API key not configured');
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
    const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&station=${station}&key=${WT_API_KEY}`;
    
    console.log(`Fetching tides for ${station} on ${date}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`WorldTides API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
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