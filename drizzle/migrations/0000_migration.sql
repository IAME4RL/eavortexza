create type public.app_role as enum ('admin','mentor','client');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  mentor_requested boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique (mentor_id, client_id)
);
grant select, insert, delete on public.mentor_assignments to authenticated;
grant all on public.mentor_assignments to service_role;
alter table public.mentor_assignments enable row level security;

create or replace function public.is_mentor_of(_mentor uuid, _client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mentor_assignments where mentor_id=_mentor and client_id=_client)
    and public.has_role(_mentor,'mentor')
$$;

-- profiles policies
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_mentor_of(auth.uid(), id));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- roles policies: only admins write
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin insert roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "assignments read" on public.mentor_assignments for select to authenticated
  using (mentor_id = auth.uid() or client_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "assignments admin insert" on public.mentor_assignments for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "assignments admin delete" on public.mentor_assignments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- settings (single row)
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  daily_scan_limit int not null default 5 check (daily_scan_limit >= 0 and daily_scan_limit <= 1000),
  scanner_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings read" on public.app_settings for select to authenticated using (true);
create policy "settings admin update" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.app_settings (id) values (1);

-- scans
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  instrument text not null,
  timeframe text not null,
  trading_style text not null,
  image_path text,
  status text not null default 'completed',
  analysis jsonb,
  error text,
  saved boolean not null default false,
  created_at timestamptz not null default now()
);
create index scans_user_created on public.scans(user_id, created_at desc);
grant select, insert, update, delete on public.scans to authenticated;
grant all on public.scans to service_role;
alter table public.scans enable row level security;
create policy "scans own read" on public.scans for select to authenticated
  using (user_id = auth.uid() or (saved and public.is_mentor_of(auth.uid(), user_id)));
create policy "scans own insert" on public.scans for insert to authenticated with check (user_id = auth.uid());
create policy "scans own update" on public.scans for update to authenticated using (user_id = auth.uid());
create policy "scans own delete" on public.scans for delete to authenticated using (user_id = auth.uid());

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sender_id uuid,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif own read" on public.notifications for select to authenticated using (user_id = auth.uid() or sender_id = auth.uid());
create policy "notif send" on public.notifications for insert to authenticated with check (
  sender_id = auth.uid() and (public.has_role(auth.uid(),'admin') or public.is_mentor_of(auth.uid(), user_id)));
create policy "notif own update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif own delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- watchlist
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  instrument text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, instrument)
);
grant select, insert, update, delete on public.watchlist to authenticated;
grant all on public.watchlist to service_role;
alter table public.watchlist enable row level security;
create policy "watch own" on public.watchlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trading accounts (no passwords stored)
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null check (platform in ('MT4','MT5')),
  broker_server text not null,
  account_login text not null,
  label text,
  connection_status text not null default 'pending_integration',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.trading_accounts to authenticated;
grant all on public.trading_accounts to service_role;
alter table public.trading_accounts enable row level security;
create policy "acct own read" on public.trading_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_mentor_of(auth.uid(), user_id) or public.has_role(auth.uid(),'admin'));
create policy "acct own insert" on public.trading_accounts for insert to authenticated with check (user_id = auth.uid() and connection_status = 'pending_integration');
create policy "acct own delete" on public.trading_accounts for delete to authenticated using (user_id = auth.uid());

-- signup trigger: profile + client role; very first user becomes admin (bootstrap)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email, mentor_requested)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'mentor_requested')::boolean, false));
  insert into public.user_roles (user_id, role) values (new.id, 'client');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin stats
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'mentors', (select count(*) from public.user_roles where role='mentor'),
    'mentor_requests', (select count(*) from public.profiles p where mentor_requested and not public.has_role(p.id,'mentor')),
    'scans_total', (select count(*) from public.scans),
    'scans_today', (select count(*) from public.scans where created_at > date_trunc('day', now())),
    'scans_failed', (select count(*) from public.scans where status='failed'),
    'accounts', (select count(*) from public.trading_accounts)
  );
end; $$;

-- storage policies for private chart bucket (bucket created via tool)
create policy "charts own read" on storage.objects for select to authenticated
  using (bucket_id = 'charts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "charts own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'charts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "charts own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'charts' and (storage.foldername(name))[1] = auth.uid()::text);