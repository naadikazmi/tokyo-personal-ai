create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.activity_logs') is not null then
    execute 'drop policy if exists "Activity logs are user owned" on public.activity_logs';
  end if;
  if to_regclass('public.memories') is not null then
    execute 'drop policy if exists "Memories are user owned" on public.memories';
  end if;
  if to_regclass('public.permissions') is not null then
    execute 'drop policy if exists "Permissions are user owned" on public.permissions';
  end if;
  if to_regclass('public.chat_history') is not null then
    execute 'drop policy if exists "Chat history is user owned" on public.chat_history';
  end if;
  if to_regclass('public.research_history') is not null then
    execute 'drop policy if exists "Research history is user owned" on public.research_history';
  end if;
  if to_regclass('public.assistant_settings') is not null then
    execute 'drop policy if exists "Assistant settings are user owned" on public.assistant_settings';
  end if;
end $$;

do $$
declare
  item record;
begin
  for item in
    select c.oid::regclass as table_name, con.conname
    from pg_constraint
    con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f'
      and n.nspname = 'public'
      and c.relname in (
        'activity_logs',
        'memories',
        'chat_messages',
        'research_history',
        'avatars',
        'permissions',
        'settings'
      )
  loop
    execute format('alter table %s drop constraint if exists %I', item.table_name, item.conname);
  end loop;
end $$;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  action_type text,
  detail text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.activity_logs add column if not exists action_type text;
alter table public.activity_logs add column if not exists detail text;
alter table public.activity_logs add column if not exists metadata jsonb;
alter table public.activity_logs alter column user_id type text using user_id::text;
do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'action'
  ) then
    execute 'update public.activity_logs set action_type = coalesce(action_type, action) where action_type is null';
  end if;
  if exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'details'
  ) then
    execute 'update public.activity_logs set detail = coalesce(detail, details) where detail is null';
  end if;
end $$;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text,
  content text,
  tags text[],
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.memories alter column user_id type text using user_id::text;
alter table public.memories add column if not exists tags text[];
alter table public.memories add column if not exists source text;
do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'memories' and column_name = 'category'
  ) then
    execute 'update public.memories set tags = array[category] where tags is null';
  end if;
end $$;
update public.memories set source = 'supabase' where source is null;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  role text,
  content text,
  created_at timestamptz default now()
);

alter table public.chat_messages alter column user_id type text using user_id::text;

create table if not exists public.research_history (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  query text,
  result jsonb,
  sources jsonb,
  confidence text,
  created_at timestamptz default now()
);

alter table public.research_history alter column user_id type text using user_id::text;
alter table public.research_history add column if not exists query text;
alter table public.research_history add column if not exists result jsonb;
alter table public.research_history add column if not exists sources jsonb;
do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'research_history' and column_name = 'topic'
  ) then
    execute 'update public.research_history set query = topic where query is null';
  end if;
end $$;

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  name text,
  personality text,
  appearance jsonb,
  voice_style text,
  is_active boolean default false,
  created_at timestamptz default now()
);

alter table public.avatars alter column user_id type text using user_id::text;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  permission_key text,
  enabled boolean default false,
  risk_level text,
  updated_at timestamptz default now()
);

alter table public.permissions alter column user_id type text using user_id::text;
alter table public.permissions add column if not exists permission_key text;
alter table public.permissions add column if not exists enabled boolean default false;
alter table public.permissions add column if not exists risk_level text;
create unique index if not exists permissions_user_key_idx on public.permissions(user_id, permission_key);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  key text,
  value jsonb,
  updated_at timestamptz default now()
);

alter table public.settings alter column user_id type text using user_id::text;
create unique index if not exists settings_user_key_idx on public.settings(user_id, key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_memories_updated_at on public.memories;
create trigger set_memories_updated_at before update on public.memories
for each row execute function public.set_updated_at();

drop trigger if exists set_permissions_updated_at on public.permissions;
create trigger set_permissions_updated_at before update on public.permissions
for each row execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at before update on public.settings
for each row execute function public.set_updated_at();

alter table public.activity_logs enable row level security;
alter table public.memories enable row level security;
alter table public.chat_messages enable row level security;
alter table public.research_history enable row level security;
alter table public.avatars enable row level security;
alter table public.permissions enable row level security;
alter table public.settings enable row level security;

drop policy if exists "activity_logs_user_owned" on public.activity_logs;
create policy "activity_logs_user_owned" on public.activity_logs for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "memories_user_owned" on public.memories;
create policy "memories_user_owned" on public.memories for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "chat_messages_user_owned" on public.chat_messages;
create policy "chat_messages_user_owned" on public.chat_messages for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "research_history_user_owned" on public.research_history;
create policy "research_history_user_owned" on public.research_history for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "avatars_user_owned" on public.avatars;
create policy "avatars_user_owned" on public.avatars for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "permissions_user_owned" on public.permissions;
create policy "permissions_user_owned" on public.permissions for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "settings_user_owned" on public.settings;
create policy "settings_user_owned" on public.settings for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
