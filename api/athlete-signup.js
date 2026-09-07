// api/athlete-signup.js
// Unified "Become a Strive Athlete" intake endpoint.
// Saves every submission to Supabase (athlete_signups) for reporting, then
// routes the lead into the right MailerLite group based on what they said
// they're interested in. Each group can carry its own automation.

const { createClient } = require('@supabase/supabase-js');

const MAILERLITE_GROUPS = {
  fall_training: '197529879398319288',   // '26 Fall Training Interest
  online_course: '197514160168240737',   // Strive Online Leads (triggers "Strive Online Info")
  virtual_calls: '197981965183354801',   // Virtual Coaching Interest
  not_sure: '197981966178452495',        // General Interest - Not Sure
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, interest, position, gradYear } = req.body || {};

  if (!name || !email || !interest) {
    return res.status(400).json({ error: 'name, email, and interest are required' });
  }
  if (!MAILERLITE_GROUPS[interest]) {
    return res.status(400).json({ error: 'invalid interest value' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Supabase first — must succeed before we touch MailerLite.
  const { error: dbError } = await supabase.from('athlete_signups').insert({
    name,
    email,
    interest,
    position: position || null,
    grad_year: gradYear || null,
  });

  if (dbError) {
    console.error('Supabase insert failed:', dbError);
    return res.status(500).json({ error: 'Could not save signup' });
  }

  // 2. MailerLite — add/update subscriber into the group matching their interest.
  try {
    const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify({
        email,
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
};
