create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('admin', 'assistant')) default 'assistant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'soft', 'dark')),
  accent text not null default 'green' check (accent in ('green', 'blue', 'rose', 'graphite')),
  background text not null default 'plain' check (background in ('plain', 'warm', 'cool', 'paper', 'contrast')),
  density text not null default 'compact' check (density in ('compact', 'comfortable')),
  text_size text not null default 'compact' check (text_size in ('compact', 'normal', 'large')),
  surface_style text not null default 'flat' check (surface_style in ('flat', 'outlined', 'soft')),
  sidebar_density text not null default 'compact' check (sidebar_density in ('compact', 'roomy')),
  card_style text not null default 'simple' check (card_style in ('simple', 'detailed')),
  focus_mode text not null default 'off' check (focus_mode in ('off', 'on')),
  mell_enabled boolean not null default true,
  mell_position text not null default 'right' check (mell_position in ('right', 'left')),
  dashboard_layout jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.call_lists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  source text,
  status text not null default 'aktiivne',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  call_list_id uuid references public.call_lists(id),
  property_address text not null,
  region text,
  portal text,
  property_link text,
  property_type text,
  deal_type text,
  price numeric,
  area numeric,
  contact_name text,
  phone text,
  email text,
  no_brokers_note text default 'ei',
  listing_note text,
  image_url text,
  show_image text default 'jah',
  object_display_mode text default 'automaatne',
  client_type text default 'eraklient',
  company_name text,
  registry_code text,
  vat_number text,
  decision_maker text,
  business_need text,
  required_area numeric,
  budget numeric,
  technical_requirements text,
  status text not null default 'uus',
  next_action_at date,
  last_call_result text,
  last_contact_at timestamptz,
  ai_summary text,
  ai_summary_at timestamptz,
  lead_score integer default 20,
  next_best_action text,
  archived_at timestamptz
);

create table if not exists public.calls (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  caller_id uuid references public.users(id) on delete set null,
  call_time timestamptz not null default now(),
  call_result text,
  time_on_market text,
  inquiries_count text,
  viewings_count text,
  offers text,
  price_change text,
  obstacle text,
  buyer_feedback text,
  urgency text,
  attitude text,
  no_help_reason text,
  no_broker_reason text,
  talk_reason text,
  specialist_contact text,
  next_action text,
  next_action_at date,
  next_action_time time,
  call_comment text,
  important_quote text,
  other_detail text,
  next_step text,
  ai_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  type text not null,
  due_date date,
  due_time time,
  status text not null default 'tegemata',
  comment text,
  reminder_email_sent boolean not null default false,
  calendar_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.summaries (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  call_id uuid references public.calls(id) on delete set null,
  generated_by uuid references public.users(id) on delete set null,
  summary text not null,
  recommended_next_step text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default uuid_generate_v4(),
  file_name text,
  source text,
  status text not null default 'valmis',
  row_count integer not null default 0,
  inserted_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists leads_assigned_to_idx on public.leads(assigned_to);
create unique index if not exists call_lists_name_key on public.call_lists(name);
create index if not exists leads_call_list_idx on public.leads(call_list_id);
create index if not exists leads_archived_idx on public.leads(archived_at);
create index if not exists calls_lead_id_idx on public.calls(lead_id);
create index if not exists tasks_due_idx on public.tasks(due_date, status);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read);
create index if not exists import_jobs_created_idx on public.import_jobs(created_at desc);

alter table public.leads add column if not exists client_type text default 'eraklient';
alter table public.leads add column if not exists call_list_id uuid references public.call_lists(id);
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists company_name text;
alter table public.leads add column if not exists registry_code text;
alter table public.leads add column if not exists vat_number text;
alter table public.leads add column if not exists decision_maker text;
alter table public.leads add column if not exists business_need text;
alter table public.leads add column if not exists required_area numeric;
alter table public.leads add column if not exists budget numeric;
alter table public.leads add column if not exists technical_requirements text;
alter table public.calls add column if not exists next_action_time time;
alter table public.user_preferences add column if not exists surface_style text not null default 'flat';
alter table public.user_preferences add column if not exists sidebar_density text not null default 'compact';
alter table public.user_preferences add column if not exists card_style text not null default 'simple';
alter table public.user_preferences add column if not exists focus_mode text not null default 'off';
alter table public.user_preferences add column if not exists mell_enabled boolean not null default true;
alter table public.user_preferences add column if not exists mell_position text not null default 'right';
alter table public.user_preferences add column if not exists dashboard_layout jsonb;
alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.call_lists drop constraint if exists call_lists_created_by_fkey;
alter table public.call_lists add constraint call_lists_created_by_fkey foreign key (created_by) references public.users(id) on delete set null;
alter table public.leads drop constraint if exists leads_created_by_fkey;
alter table public.leads add constraint leads_created_by_fkey foreign key (created_by) references public.users(id) on delete set null;
alter table public.leads drop constraint if exists leads_assigned_to_fkey;
alter table public.leads add constraint leads_assigned_to_fkey foreign key (assigned_to) references public.users(id) on delete set null;
alter table public.calls drop constraint if exists calls_caller_id_fkey;
alter table public.calls add constraint calls_caller_id_fkey foreign key (caller_id) references public.users(id) on delete set null;
alter table public.tasks drop constraint if exists tasks_assigned_to_fkey;
alter table public.tasks add constraint tasks_assigned_to_fkey foreign key (assigned_to) references public.users(id) on delete set null;
alter table public.summaries drop constraint if exists summaries_generated_by_fkey;
alter table public.summaries add constraint summaries_generated_by_fkey foreign key (generated_by) references public.users(id) on delete set null;
alter table public.import_jobs drop constraint if exists import_jobs_created_by_fkey;
alter table public.import_jobs add constraint import_jobs_created_by_fkey foreign key (created_by) references public.users(id) on delete set null;

alter table public.users enable row level security;
alter table public.user_preferences enable row level security;
alter table public.call_lists enable row level security;
alter table public.leads enable row level security;
alter table public.calls enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.summaries enable row level security;
alter table public.settings enable row level security;
alter table public.import_jobs enable row level security;

create or replace function public.current_role()
returns text language sql stable security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

drop policy if exists "users see themselves and admins see all" on public.users;
create policy "users see themselves and admins see all" on public.users
  for select using (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "preferences own or admin select" on public.user_preferences;
drop policy if exists "preferences own insert" on public.user_preferences;
drop policy if exists "preferences own update" on public.user_preferences;

create policy "preferences own or admin select" on public.user_preferences
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

create policy "preferences own insert" on public.user_preferences
  for insert with check (user_id = auth.uid() or public.current_role() = 'admin');

create policy "preferences own update" on public.user_preferences
  for update using (user_id = auth.uid() or public.current_role() = 'admin')
  with check (user_id = auth.uid() or public.current_role() = 'admin');

insert into public.user_preferences (user_id)
select id from public.users
on conflict (user_id) do nothing;

drop policy if exists "call lists read authenticated" on public.call_lists;
drop policy if exists "call lists insert authenticated" on public.call_lists;
drop policy if exists "call lists update admins or creator" on public.call_lists;

create policy "call lists read authenticated" on public.call_lists
  for select using (auth.uid() is not null);

create policy "call lists insert authenticated" on public.call_lists
  for insert with check (auth.uid() is not null);

create policy "call lists update admins or creator" on public.call_lists
  for update using (public.current_role() = 'admin' or created_by = auth.uid())
  with check (public.current_role() = 'admin' or created_by = auth.uid());

drop policy if exists "leads read by admins or assignees" on public.leads;
create policy "leads read by admins or assignees" on public.leads
  for select using (archived_at is null and (public.current_role() = 'admin' or assigned_to = auth.uid() or created_by = auth.uid()));

drop policy if exists "leads insert authenticated" on public.leads;
create policy "leads insert authenticated" on public.leads
  for insert with check (auth.uid() is not null);

drop policy if exists "leads update admins or assignees" on public.leads;
create policy "leads update admins or assignees" on public.leads
  for update using (public.current_role() = 'admin' or assigned_to = auth.uid() or created_by = auth.uid());

drop policy if exists "leads delete admins only" on public.leads;
create policy "leads delete admins only" on public.leads
  for delete using (public.current_role() = 'admin');

drop policy if exists "calls visible through lead access" on public.calls;
create policy "calls visible through lead access" on public.calls
  for select using (exists (
    select 1 from public.leads l
    where l.id = calls.lead_id
    and (public.current_role() = 'admin' or l.assigned_to = auth.uid() or l.created_by = auth.uid())
  ));

drop policy if exists "calls insert authenticated" on public.calls;
drop policy if exists "calls insert through lead access" on public.calls;
create policy "calls insert through lead access" on public.calls
  for insert with check (exists (
    select 1 from public.leads l
    where l.id = calls.lead_id
    and (public.current_role() = 'admin' or l.assigned_to = auth.uid() or l.created_by = auth.uid())
  ));

drop policy if exists "tasks visible to admins or assignee" on public.tasks;
create policy "tasks visible to admins or assignee" on public.tasks
  for select using (public.current_role() = 'admin' or assigned_to = auth.uid());

drop policy if exists "tasks manage authenticated" on public.tasks;
drop policy if exists "tasks insert through lead access" on public.tasks;
drop policy if exists "tasks update admins or assignee" on public.tasks;
drop policy if exists "tasks delete admins or assignee" on public.tasks;

create policy "tasks insert through lead access" on public.tasks
  for insert with check (
    exists (
      select 1 from public.leads l
      where l.id = tasks.lead_id
      and (public.current_role() = 'admin' or l.assigned_to = auth.uid() or l.created_by = auth.uid())
    )
  );

create policy "tasks update admins or assignee" on public.tasks
  for update using (public.current_role() = 'admin' or assigned_to = auth.uid())
  with check (public.current_role() = 'admin' or assigned_to = auth.uid());

create policy "tasks delete admins or assignee" on public.tasks
  for delete using (public.current_role() = 'admin' or assigned_to = auth.uid());

drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "summaries through lead access" on public.summaries;
create policy "summaries through lead access" on public.summaries
  for select using (exists (
    select 1 from public.leads l
    where l.id = summaries.lead_id
    and (public.current_role() = 'admin' or l.assigned_to = auth.uid() or l.created_by = auth.uid())
  ));

drop policy if exists "settings admins" on public.settings;
create policy "settings admins" on public.settings
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "import jobs read authenticated" on public.import_jobs;
drop policy if exists "import jobs insert authenticated" on public.import_jobs;

create policy "import jobs read authenticated" on public.import_jobs
  for select using (auth.uid() is not null);

create policy "import jobs insert authenticated" on public.import_jobs
  for insert with check (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('lead-images', 'lead-images', true)
on conflict (id) do nothing;

insert into public.call_lists (name, description, source, status)
values
  ('Maakleritel palun mitte tülitada', 'Kontaktid, kelle kuulutuses või vestluses on maaklerite vältimise märge.', 'käsitsi', 'aktiivne'),
  ('Seisnud müügikuulutused', 'Pikalt üleval olnud müügikuulutused.', 'käsitsi', 'aktiivne'),
  ('Omaniku müük', 'Otse omanikult müüdavad objektid.', 'käsitsi', 'aktiivne'),
  ('Nõrga kuulutusega objektid', 'Kontaktid, kus kuulutuse pildid või tekst vajavad tõenäoliselt parandamist.', 'käsitsi', 'aktiivne')
on conflict do nothing;

drop policy if exists "lead images read public" on storage.objects;
drop policy if exists "lead images upload authenticated" on storage.objects;
drop policy if exists "lead images update authenticated" on storage.objects;
drop policy if exists "lead images delete admins" on storage.objects;

create policy "lead images read public" on storage.objects
  for select using (bucket_id = 'lead-images');

create policy "lead images upload authenticated" on storage.objects
  for insert with check (bucket_id = 'lead-images' and auth.uid() is not null);

create policy "lead images update authenticated" on storage.objects
  for update using (bucket_id = 'lead-images' and auth.uid() is not null)
  with check (bucket_id = 'lead-images' and auth.uid() is not null);

create policy "lead images delete admins" on storage.objects
  for delete using (bucket_id = 'lead-images' and public.current_role() = 'admin');
