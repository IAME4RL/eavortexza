-- Persistent mentor bots and secure one-time client license redemption.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mentor_bots (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  mentor_name text not null default 'Mentor',
  description text not null default '',
  strategies text not null default '',
  avatar_url text,
  background_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentor_bot_licenses (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.mentor_bots(id) on delete cascade,
  license_key text not null unique,
  license_hash text not null unique,
  client_name text not null,
  client_email text not null,
  client_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','redeemed','revoked')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists mentor_bots_mentor_id_idx on public.mentor_bots(mentor_id);
create index if not exists mentor_bot_licenses_mentor_id_idx on public.mentor_bot_licenses(mentor_id);
create index if not exists mentor_bot_licenses_client_id_idx on public.mentor_bot_licenses(client_id);

alter table public.mentor_bots enable row level security;
alter table public.mentor_bot_licenses enable row level security;

drop policy if exists "Mentors manage their own bots" on public.mentor_bots;
create policy "Mentors manage their own bots" on public.mentor_bots
  for all to authenticated using (
    mentor_id = auth.uid() and exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('mentor','admin')
    )
  ) with check (
    mentor_id = auth.uid() and exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('mentor','admin')
    )
  );
drop policy if exists "Clients read their assigned mentor bot" on public.mentor_bots;
create policy "Clients read their assigned mentor bot" on public.mentor_bots
  for select to authenticated using (
    exists (select 1 from public.mentor_bot_licenses l
      where l.bot_id = mentor_bots.id and l.client_id = auth.uid() and l.status = 'redeemed')
  );

drop policy if exists "Mentors read their issued licenses" on public.mentor_bot_licenses;
create policy "Mentors read their issued licenses" on public.mentor_bot_licenses
  for select to authenticated using (mentor_id = auth.uid());
drop policy if exists "Clients read their redeemed license" on public.mentor_bot_licenses;
create policy "Clients read their redeemed license" on public.mentor_bot_licenses
  for select to authenticated using (client_id = auth.uid() and status = 'redeemed');

-- Only a masked key is stored for display; the full key is returned to the mentor
-- once at creation. Redemption uses its SHA-256 hash and is email-bound/one-time.
create or replace function public.issue_mentor_bot_license(
  p_license_key text, p_bot_id uuid, p_client_name text, p_client_email text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_mentor uuid := auth.uid();
begin
  if v_mentor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from user_roles where user_id = v_mentor and role in ('mentor','admin')) then
    raise exception 'Mentor access required';
  end if;
  if not exists (select 1 from mentor_bots where id = p_bot_id and mentor_id = v_mentor) then
    raise exception 'You can only assign your own bots';
  end if;
  if length(trim(coalesce(p_client_name,''))) = 0 or position('@' in coalesce(p_client_email,'')) = 0 then
    raise exception 'Valid client name and email are required';
  end if;
  insert into mentor_bot_licenses(mentor_id, bot_id, license_key, license_hash, client_name, client_email)
  values (v_mentor, p_bot_id, '••••-' || right(upper(trim(p_license_key)), 4), encode(digest(upper(trim(p_license_key)), 'sha256'), 'hex'), trim(p_client_name), lower(trim(p_client_email)));
end; $$;

create or replace function public.redeem_mentor_bot_license(p_license_key text)
returns table(bot_id uuid, bot_name text, mentor_name text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid := auth.uid(); v_email text;
begin
  if v_user is null then raise exception 'Please sign in first'; end if;
  select lower(email) into v_email from auth.users where id = v_user;
  return query
  with claimed as (
    update mentor_bot_licenses l
       set client_id = v_user, status = 'redeemed', redeemed_at = now()
     where l.license_hash = encode(digest(upper(trim(p_license_key)), 'sha256'), 'hex')
       and l.status = 'active' and l.client_id is null and lower(l.client_email) = v_email
    returning l.bot_id
  )
  select b.id, b.name, b.mentor_name from claimed c join mentor_bots b on b.id = c.bot_id;
  if not found then raise exception 'Invalid, already used, or email-mismatched license key'; end if;
end; $$;

revoke all on function public.issue_mentor_bot_license(text,uuid,text,text) from public;
revoke all on function public.redeem_mentor_bot_license(text) from public;
grant execute on function public.issue_mentor_bot_license(text,uuid,text,text) to authenticated;
grant execute on function public.redeem_mentor_bot_license(text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('mentor-bot-media','mentor-bot-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "Mentors upload bot media" on storage.objects;
create policy "Mentors upload bot media" on storage.objects for insert to authenticated
with check (bucket_id = 'mentor-bot-media' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('mentor','admin')));
drop policy if exists "Public read mentor bot media" on storage.objects;
create policy "Public read mentor bot media" on storage.objects for select to public using (bucket_id = 'mentor-bot-media');
drop policy if exists "Mentors delete own bot media" on storage.objects;
create policy "Mentors delete own bot media" on storage.objects for delete to authenticated
using (bucket_id = 'mentor-bot-media' and (storage.foldername(name))[1] = auth.uid()::text);
