import { createClient } from '@supabase/supabase-js';

// These come from Vercel Environment Variables — never hardcode keys here.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  try {
    const { error } = await supabase
      .from('waitlist_signups')
      .insert([{ name: name || null, email: email.toLowerCase().trim() }]);

    if (error) {
      // Duplicate email is fine — treat as a successful "already on the list"
      if (error.code === '23505') {
        return res.status(200).json({ success: true, alreadyExists: true });
      }
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Something went wrong saving your signup' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Waitlist handler error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
