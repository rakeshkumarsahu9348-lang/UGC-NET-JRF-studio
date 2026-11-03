-- NET JRF Studio: Supabase database setup
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,24}$'),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.is_username_available(username_in text)
returns boolean language sql stable security definer set search_path = public
as $$
  select length(trim(coalesce(username_in,''))) between 3 and 24
     and not exists (select 1 from public.profiles where lower(username) = lower(trim(username_in)));
$$;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare uname text;
begin
  uname := lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))));
  if uname = '' then uname := 'candidate_' || substr(new.id::text,1,8); end if;
  insert into public.profiles (id, username, role) values (new.id, uname, 'user');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  unit smallint not null check (unit between 1 and 10),
  question_en text not null,
  question_hi text not null,
  options_en jsonb not null check (jsonb_typeof(options_en) = 'array' and jsonb_array_length(options_en) = 4),
  options_hi jsonb not null check (jsonb_typeof(options_hi) = 'array' and jsonb_array_length(options_hi) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation_en text not null,
  explanation_hi text not null,
  source_note text,
  source_type text not null default 'ai_practice',
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists question_bank_unit_created_idx on public.question_bank(unit, created_at);

-- Database guard: no unit can contain more than 500 questions.
create or replace function public.enforce_unit_question_limit()
returns trigger language plpgsql set search_path = public
as $$
declare current_count integer;
begin
  perform pg_advisory_xact_lock(824611, new.unit);
  select count(*) into current_count from public.question_bank where unit = new.unit;
  if current_count >= 500 then
    raise exception 'Unit % has reached its 500-question limit.', new.unit;
  end if;
  return new;
end;
$$;
drop trigger if exists question_bank_limit_trigger on public.question_bank;
create trigger question_bank_limit_trigger before insert on public.question_bank
for each row execute procedure public.enforce_unit_question_limit();

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit smallint not null check (unit between 1 and 10),
  set_number integer not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_seconds integer,
  total_questions smallint not null default 5 check (total_questions = 5),
  correct_count smallint,
  score smallint,
  grade text,
  status text not null default 'in_progress' check (status in ('in_progress','completed'))
);
create index if not exists practice_sessions_user_date_idx on public.practice_sessions(user_id, started_at desc);
create unique index if not exists one_open_session_per_user_unit_uidx
  on public.practice_sessions(user_id, unit) where status = 'in_progress';

create table if not exists public.session_questions (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.question_bank(id),
  position smallint not null check (position between 1 and 5),
  selected_index smallint check (selected_index between 0 and 3),
  is_correct boolean,
  primary key (session_id, question_id),
  unique (session_id, position)
);

-- A question is permanently marked as seen for each user as soon as a set is opened.
create table if not exists public.user_question_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.question_bank(id),
  unit smallint not null check (unit between 1 and 10),
  first_seen_at timestamptz not null default now(),
  last_session_id uuid references public.practice_sessions(id) on delete set null,
  primary key (user_id, question_id)
);
create index if not exists user_question_history_user_unit_idx on public.user_question_history(user_id, unit);

-- Atomic reservation: protects against two devices requesting a set at the same time.
create or replace function public.reserve_practice_set(p_user_id uuid, p_unit smallint, p_question_ids uuid[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
  next_number integer;
  question_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_unit::text, 0));

  select id into existing_id from public.practice_sessions
   where user_id = p_user_id and unit = p_unit and status = 'in_progress'
   order by started_at desc limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  if p_unit < 1 or p_unit > 10 or coalesce(array_length(p_question_ids, 1), 0) <> 5 then
    raise exception 'invalid_practice_set';
  end if;
  select count(distinct value) into question_total from unnest(p_question_ids) as t(value);
  if question_total <> 5 then raise exception 'duplicate_questions_in_set'; end if;
  select count(*) into question_total from public.question_bank where id = any(p_question_ids) and unit = p_unit;
  if question_total <> 5 then raise exception 'invalid_question_bank_selection'; end if;
  if exists (select 1 from public.user_question_history h where h.user_id = p_user_id and h.question_id = any(p_question_ids)) then
    raise exception 'questions_already_seen';
  end if;

  select coalesce(max(set_number), 0) + 1 into next_number
    from public.practice_sessions where user_id = p_user_id and unit = p_unit;
  insert into public.practice_sessions(user_id, unit, set_number, total_questions, status)
    values (p_user_id, p_unit, next_number, 5, 'in_progress') returning id into new_id;
  insert into public.session_questions(session_id, question_id, position)
    select new_id, qid, ordinality::smallint from unnest(p_question_ids) with ordinality as t(qid, ordinality);
  insert into public.user_question_history(user_id, question_id, unit, last_session_id)
    select p_user_id, value, p_unit, new_id from unnest(p_question_ids) as t(value);
  return new_id;
end;
$$;
revoke all on function public.reserve_practice_set(uuid, smallint, uuid[]) from public, anon, authenticated;
grant execute on function public.reserve_practice_set(uuid, smallint, uuid[]) to service_role;

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('page_open','signup','login')),
  user_id uuid references public.profiles(id) on delete set null,
  client_id text,
  created_at timestamptz not null default now()
);
create index if not exists site_events_created_idx on public.site_events(created_at desc);

-- Activity updates last_seen_at without allowing a user to edit their own role/profile.
create or replace function public.update_profile_last_seen()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.profiles set last_seen_at = new.created_at where id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists site_events_touch_profile on public.site_events;
create trigger site_events_touch_profile after insert on public.site_events
for each row execute procedure public.update_profile_last_seen();

alter table public.profiles enable row level security;
alter table public.question_bank enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.session_questions enable row level security;
alter table public.user_question_history enable row level security;
alter table public.site_events enable row level security;

-- Profile: users can read their own profile; only an admin can read the user directory.
drop policy if exists "profile owner or admin read" on public.profiles;
create policy "profile owner or admin read" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

-- Questions are sent to candidates only by authenticated Edge Functions.
drop policy if exists "admin read question bank" on public.question_bank;
create policy "admin read question bank" on public.question_bank for select to authenticated
using (public.is_admin());

-- Candidate can only read their own practice history; writes are performed by verified Edge Functions.
drop policy if exists "owner reads own sessions" on public.practice_sessions;
create policy "owner reads own sessions" on public.practice_sessions for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "owner reads own session questions" on public.session_questions;
create policy "owner reads own session questions" on public.session_questions for select to authenticated
using (exists (select 1 from public.practice_sessions s where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())));

drop policy if exists "owner reads own question history" on public.user_question_history;
create policy "owner reads own question history" on public.user_question_history for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Anonymous page-open counts are intentionally limited to non-sensitive event records.
drop policy if exists "record basic website events" on public.site_events;
create policy "record basic website events" on public.site_events for insert to anon, authenticated
with check ((user_id is null or user_id = auth.uid()) and event_name in ('page_open','signup','login'));
drop policy if exists "admin reads website events" on public.site_events;
create policy "admin reads website events" on public.site_events for select to authenticated
using (public.is_admin());

grant select on public.profiles to authenticated;
grant select on public.practice_sessions, public.session_questions, public.user_question_history to authenticated;
grant select on public.question_bank to authenticated;
grant insert on public.site_events to anon, authenticated;
grant select on public.site_events to authenticated;

-- No client-side UPDATE/INSERT/DELETE grants are given on answer keys or attempts.

-- The Edge Functions use this elevated role only on the server, never in the browser.
grant all on public.profiles, public.question_bank, public.practice_sessions, public.session_questions, public.user_question_history, public.site_events to service_role;
