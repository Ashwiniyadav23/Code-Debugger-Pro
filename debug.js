let requestCounts = {};
const WINDOW_SIZE_IN_MINUTES = 1;
const MAX_REQUESTS_PER_WINDOW = 20;  // increased limit for testing

const allowedOrigins = [
  'https://code-debugger-frontend.vercel.app',
  'https://ashwiniyadav23.github.io',
];

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // CORS header - allow only allowed origins dynamically
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'API is working!' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Extract IP safely for rate limiting
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ip = ipRaw.split(',')[0].trim();

  // -- RATE LIMITING START --
  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, startTime: Date.now() };
  } else {
    const timeElapsed = (Date.now() - requestCounts[ip].startTime) / 60000; // minutes
    if (timeElapsed < WINDOW_SIZE_IN_MINUTES) {
      if (requestCounts[ip].count >= MAX_REQUESTS_PER_WINDOW) {
        console.log(`Rate limit exceeded for IP ${ip}`);
        return res.status(429).json({ error: 'Too many requests, please wait a minute.' });
      }
      requestCounts[ip].count++;
    } else {
      // Reset window
      requestCounts[ip] = { count: 1, startTime: Date.now() };
    }
  }
  console.log(`IP: ${ip}, Count: ${requestCounts[ip].count}`);
  // -- RATE LIMITING END --

  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language required' });
  }

  const prompt = `Debug this ${language} code:\n\n${code}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 700,
      }),
    });

    if (response.status === 429) {
      return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again later.' });
    }

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.status(200).json({ message: data.choices?.[0]?.message?.content || 'No response from AI' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}
