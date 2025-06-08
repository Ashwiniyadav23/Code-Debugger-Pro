const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: 'https://ashwiniyadav23.github.io'
}));

app.use(express.json());

const fetch = global.fetch || require('node-fetch');

// Root health-check
app.get('/', (req, res) => {
  res.send('✅ AI Debugger API is working!');
});

app.post('/api/debug', async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  const prompt = `Debug this ${language} code:\n\n${code}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `OpenAI error: ${errText}` });
    }

    const json = await response.json();
    const aiResponse = json.choices?.[0]?.message?.content || 'No response';
    res.json({ message: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
