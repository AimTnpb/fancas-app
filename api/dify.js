// Vercel Serverless Function: /api/dify
// รับ POST จาก frontend → เติม API key → ส่งไปยัง Dify

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'DIFY_API_KEY environment variable not set'
    });
  }

  const difyEndpoint = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1/workflows/run';

  try {
    const response = await fetch(difyEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Dify proxy error:', err);
    return res.status(502).json({
      error: 'Failed to reach Dify',
      detail: err.message
    });
  }
}
