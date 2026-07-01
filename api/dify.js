// ============================================================================
// FANCAS-AI Backend Proxy v2 — with Supabase persistence
// ============================================================================
// Deploy to: /api/dify.js in your Vercel project
//
// Environment variables required (set in Vercel Dashboard → Settings → Env):
//   DIFY_API_KEY        — your Dify workflow API key (from previous setup)
//   SUPABASE_URL        — e.g. https://xxxxx.supabase.co (optional)
//   SUPABASE_ANON_KEY   — Supabase anon/public key (optional)
//   DIFY_ENDPOINT       — defaults to https://api.dify.ai/v1/workflows/run
//
// If SUPABASE_URL or SUPABASE_ANON_KEY is missing, the proxy still works —
// it just won't save cases. Useful for incremental rollout.
// ============================================================================

export default async function handler(req, res) {
  // CORS — same as v1
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read env vars
  const DIFY_API_KEY = process.env.DIFY_API_KEY;
  const DIFY_ENDPOINT = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1/workflows/run';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!DIFY_API_KEY) {
    return res.status(500).json({ error: 'DIFY_API_KEY not configured on server' });
  }

  try {
    // ----------------------------------------------------------------------
    // 1. Forward request to Dify
    // ----------------------------------------------------------------------
    const difyResponse = await fetch(DIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const result = await difyResponse.json();

    // ----------------------------------------------------------------------
    // 2. If successful AND Supabase configured, save the case
    //    (non-blocking — we don't make user wait for DB write to fail)
    // ----------------------------------------------------------------------
    const supabaseConfigured = SUPABASE_URL && SUPABASE_KEY;
    const difySucceeded = difyResponse.ok && result.data?.status === 'succeeded';

    if (difySucceeded && supabaseConfigured) {
      // Extract assessment + AI output from request and Dify response
      const assessment = req.body?.inputs?.fancas_assessment || {};
      const aiOutput = result.data?.outputs || {};

      // Insert case into Supabase
      try {
        const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/cases`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            hn: String(assessment.patient_id || 'unknown'),
            shift_date: assessment.shift_date || null,
            assessment_time: assessment.assessment_time || null,
            nurse: assessment.nurse || null,
            assessment: assessment,
            ai_output: aiOutput
          })
        });

        if (supabaseRes.ok) {
          const saved = await supabaseRes.json();
          // Attach the saved case ID to the response so the frontend can show
          // a "View in Expert Review" link if desired
          if (Array.isArray(saved) && saved[0]?.id) {
            result._fancas_case_id = saved[0].id;
          }
        } else {
          const errorText = await supabaseRes.text();
          console.error('Supabase save failed:', supabaseRes.status, errorText);
          // Attach error to response for debugging — doesn't affect user experience
          result._fancas_save_error = `Save failed (${supabaseRes.status})`;
        }
      } catch (saveErr) {
        console.error('Supabase save error:', saveErr);
        result._fancas_save_error = saveErr.message;
      }
    } else if (difySucceeded && !supabaseConfigured) {
      // User hasn't set up Supabase yet — that's fine, just note it
      result._fancas_save_status = 'supabase_not_configured';
    }

    // ----------------------------------------------------------------------
    // 3. Return Dify response to client
    // ----------------------------------------------------------------------
    return res.status(difyResponse.status).json(result);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal proxy error' });
  }
}
