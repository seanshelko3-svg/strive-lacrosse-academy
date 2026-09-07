import { createClient } from '@supabase/supabase-js';

// These come from Vercel Environment Variables — never hardcode keys here.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Which MailerLite group each "interest" answer routes into.
const MAILERLITE_GROUPS = {
  fall_training: '197529879398319288', // '26 Fall Training Interest
  online_course: '197514160168240737', // Strive Online Leads (triggers "Strive Online Info")
  virtual_calls: '197981965183354801', // Virtual Coaching Interest
  not_sure: '197981966178452495',      // General Interest - Not Sure
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, interest, position, gradYear } = req.body || {};

  if (!name || !email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid name and email are required' });
  }
  if (!interest || !MAILERLITE_GROUPS[interest]) {
    return res.status(400).json({ error: 'A valid interest is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Save to Supabase first — this is our own record of every lead.
  const { error: dbError } = await supabase.from('athlete_signups').insert({
    name,
    email: cleanEmail,
    interest,
    position: position || null,
    grad_year: gradYear || null,
  });

  if (dbError) {
    console.error('Supabase insert failed:', dbError);
    return res.status(500).json({ error: 'Could not save signup' });
  }

  // Then add/update the subscriber in the MailerLite group for their interest.
  try {
    const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify({
        email: cleanEmail,
        fields: { name, position: position || null, grad_year: gradYear || null },
        groups: [MAILERLITE_GROUPS[interest]],
      }),
    });

    if (!mlRes.ok) {
      const body = await mlRes.text();
      console.error('MailerLite add_subscriber failed:', mlRes.status, body);
      // Don't fail the request — the lead is already saved in Supabase.
    }
  } catch (err) {
    console.error('MailerLite request error:', err);
  }

  return res.status(200).json({ ok: true });
}
