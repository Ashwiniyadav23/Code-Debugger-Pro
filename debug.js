export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://code-debugger-frontend.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.status(200).json({ message: data.choices?.[0]?.message?.content || 'No answer from AI' });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
}
