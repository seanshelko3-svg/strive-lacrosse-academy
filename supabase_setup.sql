-- Run this in Supabase: SQL Editor → New query

create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null unique,
  created_at timestamp with time zone default now()
);

-- Row Level Security: locked down by default, only the service_role key
-- (used by the serverless function, never exposed to the browser) can write.
alter table waitlist_signups enable row level security;
