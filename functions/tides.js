export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  const url = new URL(request.url);
  const station = url.searchParams.get('station');
  const date = url.searchParams.get('date');
  
  if (!station || !date) {
    return new Response('Missing station or date parameter', { status: 400 });
  }
  
  const WT_API_KEY = env.WORLDTIDES_API_KEY;
  
  if (!WT_API_KEY) {
    console.error('WorldTides API key not configured');
    return new Response(JSON.stringify({ 
      error: 'API key not configured',
      message: 'Please set WORLDTIDES_API_KEY in Cloudflare Pages environment variables'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const apiUrl = `https://www.worldtides.info/api/v3?extremes&height&date=${date}&station=${station}&key=${WT_API_KEY}`;
    
    console.log(`Fetching tides for ${station} on ${date}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`WorldTides API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600' // 6-hour cache at CDN level
      }
    });
    
  } catch (error) {
    console.error('Error fetching from WorldTides:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tide data',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}