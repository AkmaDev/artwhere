create extension if not exists postgis;
create extension if not exists pg_trgm;

create type event_status as enum ('available', 'almost_full', 'full', 'closed', 'cancelled');

create table cities (
  slug text primary key,
  name text not null,
  country text not null,
  timezone text not null default 'Europe/Paris',
  center geography(Point) not null,
  radius_km numeric not null default 15,
  active boolean not null default false
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_norm text not null,
  description text,
  image_url text,
  categories text[] not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Séances précises quand la source les fournit ; sinon on s'appuie sur start_at/end_at.
  occurrences tstzrange[],
  all_day boolean not null default false,
  hours_text text,
  duration_text text,
  venue_name text,
  venue_norm text,
  address text,
  location geography(Point),
  city text not null references cities(slug),
  country text not null,
  price_min numeric,
  price_max numeric,
  status event_status not null default 'available',
  ticket_url text,
  official_url text,
  lang text not null default 'fr',
  first_detected_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create index events_city_dates on events (city, end_at, start_at);
create index events_categories on events using gin (categories);
create index events_location on events using gist (location);
create index events_title_trgm on events using gin (title_norm gin_trgm_ops);
create index events_detected on events (first_detected_at);

create table event_sources (
  id bigint generated always as identity primary key,
  event_id uuid not null references events(id) on delete cascade,
  source text not null,
  source_id text not null,
  source_url text,
  status event_status not null default 'available',
  raw jsonb,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);
create index event_sources_event on event_sources (event_id);
create index event_sources_fetched on event_sources (source, fetched_at);

create table push_subscriptions (
  endpoint text primary key,
  device_id uuid not null,
  keys jsonb not null,
  city text not null references cities(slug),
  date_from date not null,
  date_to date not null,
  categories text[] not null,
  moments text[] not null default '{}',
  frequency text not null default 'now' check (frequency in ('now', 'daily')),
  created_at timestamptz not null default now(),
  last_notified_at timestamptz not null default now()
);
create index push_subscriptions_device on push_subscriptions (device_id);

alter table cities enable row level security;
alter table events enable row level security;
alter table event_sources enable row level security;
alter table push_subscriptions enable row level security;

create policy "public read cities" on cities for select using (true);
create policy "public read events" on events for select using (true);
-- event_sources contient le JSON brut des sources : lecture via service role uniquement.
-- push_subscriptions : aucune policy, accès uniquement via service role (routes API).

create or replace function moment_of(t timestamptz, tz text)
returns text language sql immutable as $$
  select case
    when extract(hour from t at time zone tz) < 12 then 'm'
    when extract(hour from t at time zone tz) < 18 then 'a'
    else 's' end;
$$;

-- Première séance d'un événement qui tombe dans [p_from, p_to] (et dans les moments demandés).
create or replace function next_slot(
  e events, p_from timestamptz, p_to timestamptz, p_moments text[], tz text
)
returns timestamptz language sql stable as $$
  select case
    when e.all_day then greatest(e.start_at, p_from)
    when e.occurrences is null then
      case when e.end_at >= p_from and e.start_at <= p_to
        and (coalesce(array_length(p_moments, 1), 0) = 0 or moment_of(e.start_at, tz) = any (p_moments))
      then e.start_at end
    else (
      select min(lower(o)) from unnest(e.occurrences) o
      where upper(o) >= p_from and lower(o) <= p_to
        and (coalesce(array_length(p_moments, 1), 0) = 0 or moment_of(lower(o), tz) = any (p_moments))
    )
  end;
$$;

create or replace function search_events(
  p_city text,
  p_from timestamptz,
  p_to timestamptz,
  p_cats text[],
  p_moments text[] default '{}',
  p_free boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_km numeric default null
)
returns table (
  id uuid, title text, description text, image_url text, categories text[],
  start_at timestamptz, end_at timestamptz, next_at timestamptz, all_day boolean, hours_text text, duration_text text,
  venue_name text, address text, lat double precision, lng double precision,
  price_min numeric, price_max numeric, status event_status,
  ticket_url text, official_url text, first_detected_at timestamptz, last_checked_at timestamptz,
  sources text[], distance_km double precision
)
language sql stable
as $$
  with c as (select timezone from cities where slug = p_city),
  me as (
    select case when p_lat is null or p_lng is null then null
      else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end as pt
  ),
  hits as (
    select e.*, next_slot(e, greatest(now(), p_from), p_to, p_moments, c.timezone) as next_at, me.pt
    from events e, c, me
    where e.city = p_city
      and e.status <> 'cancelled'
      and e.end_at >= greatest(now(), p_from)
      and e.start_at <= p_to
      and e.categories && p_cats
      and (not p_free or e.price_min = 0)
      and (p_max_km is null or me.pt is null
           or (e.location is not null and st_dwithin(e.location, me.pt, p_max_km * 1000)))
  )
  select h.id, h.title, h.description, h.image_url, h.categories,
    h.start_at, h.end_at, h.next_at, h.all_day, h.hours_text, h.duration_text,
    h.venue_name, h.address, st_y(h.location::geometry), st_x(h.location::geometry),
    h.price_min, h.price_max, h.status,
    h.ticket_url, h.official_url, h.first_detected_at, h.last_checked_at,
    (select array_agg(distinct s.source) from event_sources s where s.event_id = h.id),
    case when h.pt is null or h.location is null then null else st_distance(h.location, h.pt) / 1000 end
  from hits h
  where h.next_at is not null
  order by h.all_day desc, h.next_at, h.title
  limit 500;
$$;

create or replace function get_events(p_ids uuid[])
returns table (
  id uuid, title text, description text, image_url text, categories text[],
  start_at timestamptz, end_at timestamptz, next_at timestamptz, all_day boolean, hours_text text, duration_text text,
  venue_name text, address text, lat double precision, lng double precision,
  price_min numeric, price_max numeric, status event_status,
  ticket_url text, official_url text, first_detected_at timestamptz, last_checked_at timestamptz,
  sources text[], distance_km double precision
)
language sql stable
as $$
  select e.id, e.title, e.description, e.image_url, e.categories,
    e.start_at, e.end_at,
    case when e.all_day or e.occurrences is null then greatest(e.start_at, now())
      else (select min(lower(o)) from unnest(e.occurrences) o where upper(o) >= now()) end,
    e.all_day, e.hours_text, e.duration_text,
    e.venue_name, e.address, st_y(e.location::geometry), st_x(e.location::geometry),
    e.price_min, e.price_max, e.status,
    e.ticket_url, e.official_url, e.first_detected_at, e.last_checked_at,
    (select array_agg(distinct s.source) from event_sources s where s.event_id = e.id),
    null::double precision
  from events e
  where e.id = any (p_ids);
$$;

create or replace function find_duplicate(
  p_city text,
  p_title_norm text,
  p_venue_norm text,
  p_lat double precision,
  p_lng double precision,
  p_start timestamptz,
  p_end timestamptz
)
returns uuid
language sql stable
as $$
  select e.id
  from events e
  where e.city = p_city
    and e.title_norm % p_title_norm
    and similarity(e.title_norm, p_title_norm) > 0.6
    and e.start_at::date <= p_end::date
    and e.end_at::date >= p_start::date
    and (
      (p_venue_norm is not null and e.venue_norm = p_venue_norm)
      or (p_lat is not null and e.location is not null
          and st_dwithin(e.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 200))
    )
  order by similarity(e.title_norm, p_title_norm) desc
  limit 1;
$$;

-- Nombre de nouveaux événements disponibles correspondant à un abonnement depuis p_since.
create or replace function count_new_for_subscription(p_endpoint text, p_since timestamptz)
returns integer language sql stable as $$
  select count(*)::int
  from push_subscriptions p
  join cities c on c.slug = p.city
  join events e on e.city = p.city
  where p.endpoint = p_endpoint
    and e.first_detected_at > p_since
    and e.status in ('available', 'almost_full')
    and e.categories && p.categories
    and next_slot(
      e,
      greatest(now(), (p.date_from::timestamp at time zone c.timezone)),
      ((p.date_to + 1)::timestamp at time zone c.timezone),
      p.moments,
      c.timezone
    ) is not null;
$$;

insert into cities (slug, name, country, timezone, center, radius_km, active) values
  ('paris', 'Paris', 'FR', 'Europe/Paris', st_setsrid(st_makepoint(2.3522, 48.8566), 4326)::geography, 15, true),
  ('lyon', 'Lyon', 'FR', 'Europe/Paris', st_setsrid(st_makepoint(4.8357, 45.7640), 4326)::geography, 12, false),
  ('bordeaux', 'Bordeaux', 'FR', 'Europe/Paris', st_setsrid(st_makepoint(-0.5792, 44.8378), 4326)::geography, 12, false),
  ('marseille', 'Marseille', 'FR', 'Europe/Paris', st_setsrid(st_makepoint(5.3698, 43.2965), 4326)::geography, 15, false);
