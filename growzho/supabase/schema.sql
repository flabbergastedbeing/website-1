-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- 1) Change the e-mail in is_admin() below to the e-mail of your admin account.
-- 2) Create that account in Authentication -> Users -> Add user (set its password there), tick "Auto confirm user".
-- 3) Then switch off Authentication -> Sign In / Providers -> "Allow new users to sign up" so nobody else can register.

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  full_name   text   not null check (char_length(btrim(full_name))  between 1 and 120),
  email       text   not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text   not null check (char_length(btrim(phone))      between 6 and 30),
  company     text   not null check (char_length(btrim(company))    between 1 and 160),
  instagram   text   not null check (char_length(btrim(instagram))  between 2 and 40),
  services    text[] not null default '{}' check (cardinality(services) <= 10),
  message     text   not null check (char_length(btrim(message))    between 1 and 4000)
);

create index if not exists submissions_created_at_idx on public.submissions (created_at desc);

-- who is the admin: ONE e-mail address (change it!)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('admin@example.com');
$$;

alter table public.submissions enable row level security;

drop policy if exists "anyone can submit"      on public.submissions;
drop policy if exists "admin can read"         on public.submissions;
drop policy if exists "admin can delete"       on public.submissions;

-- visitors (not signed in) may only ADD a row
create policy "anyone can submit" on public.submissions for insert to anon, authenticated with check (true);
-- only the admin may read or delete
create policy "admin can read"    on public.submissions for select to authenticated using (public.is_admin());
create policy "admin can delete"  on public.submissions for delete to authenticated using (public.is_admin());

-- belt and braces: take away every right the visitor role does not need
revoke all on public.submissions from anon, authenticated;
grant insert on public.submissions to anon, authenticated;
grant select, delete on public.submissions to authenticated;