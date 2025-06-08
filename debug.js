let requestCounts = {};
const WINDOW_SIZE_IN_MINUTES = 1;
const MAX_REQUESTS_PER_WINDOW = 5;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://code-debugger-frontend.vercel.app');
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

  // Only allow POST for debugging
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Basic rate limiter by IP (in-memory, resets on redeploy)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, startTime: Date.now() };
  } else {
    const timeElapsed = (Date.now() - requestCounts[ip].startTime) / 60000; // minutes
    if (timeElapsed < WINDOW_SIZE_IN_MINUTES) {
      if (requestCounts[ip].count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many requests, please wait a minute.' });
      }
      requestCounts[ip].count++;
    } else {
      // Reset window
      requestCounts[ip] = { count: 1, startTime: Date.now() };
    }
  }

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
      // OpenAI rate limit hit
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
