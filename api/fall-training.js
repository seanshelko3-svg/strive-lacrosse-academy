import { createClient } from '@supabase/supabase-js';

// These come from Vercel Environment Variables — never hardcode keys here.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILERLITE_GROUP_ID = '197529879398319288'; // Fall Training Interest

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Save to Supabase first — our own record of every lead,
  // independent of whatever email tool we're using.
  try {
    const { error } = await supabase
      .from('fall_training_signups')
      .insert([{ name: name || null, email: cleanEmail }]);

    if (error && error.code !== '23505') {
      // 23505 = duplicate email, that's fine, not a real failure
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Something went wrong saving your signup' });
    }
  } catch (err) {
    console.error('Supabase handler error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }

  // Add to MailerLite — this is what puts them in the Fall Training
  // Interest group so we can email them once the schedule is live.
  try {
    const mlResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify({
        email: cleanEmail,
        fields: { name: name || '' },
        groups: [MAILERLITE_GROUP_ID],
      }),
    });

    if (!mlResponse.ok) {
      const errText = await mlResponse.text();
      console.error('MailerLite error:', errText);
      // Don't fail the whole request — the lead is already saved in Supabase.
    }
  } catch (err) {
    console.error('MailerLite request failed:', err);
  }

  return res.status(200).json({ success: true });
}
