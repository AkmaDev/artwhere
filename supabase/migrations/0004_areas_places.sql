-- Zones créées à la demande (n'importe quelle ville) + lieux culturels permanents.
-- La table garde son nom `cities` ; chaque ligne est désormais une zone.

alter table cities add column currency text not null default 'EUR';
alter table cities add column status text not null default 'ready' check (status in ('pending', 'ready'));
alter table cities add column created_at timestamptz not null default now();
alter table cities add column last_requested_at timestamptz not null default now();
alter table cities add column last_ingested_at timestamptz;
alter table cities add column places_ingested_at timestamptz;

delete from cities where slug in ('lyon', 'bordeaux', 'marseille')
  and not exists (select 1 from events e where e.city = cities.slug);
update cities set active = true, status = 'ready', last_ingested_at = now() where slug = 'paris';

alter table events add column kind text not null default 'event' check (kind in ('event', 'place'));
create index events_kind on events (city, kind);

create or replace function nearest_city(p_lat double precision, p_lng double precision)
returns text language sql stable as $$
  select slug from cities
  where st_dwithin(center, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, radius_km * 1000)
  order by st_distance(center, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;

create or replace function city_coords(p_slug text)
returns table (lat double precision, lng double precision) language sql stable as $$
  select st_y(center::geometry), st_x(center::geometry) from cities where slug = p_slug;
$$;

drop function if exists search_events(text, timestamptz, timestamptz, text[], text[], boolean, double precision, double precision, numeric);
create function search_events(
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
  id uuid, kind text, title text, description text, image_url text, categories text[],
  start_at timestamptz, end_at timestamptz, next_at timestamptz, all_day boolean, hours_text text, duration_text text,
  venue_name text, address text, lat double precision, lng double precision,
  price_min numeric, price_max numeric, status event_status,
  ticket_url text, official_url text, first_detected_at timestamptz, last_checked_at timestamptz,
  sources text[], distance_km double precision, timezone text, currency text
)
language sql stable
as $$
  with c as (select timezone, currency from cities where slug = p_city),
  me as (
    select case when p_lat is null or p_lng is null then null
      else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end as pt
  ),
  hits as (
    select e.*, next_slot(e, p_from, p_to, p_moments, c.timezone) as next_at, me.pt,
      case when me.pt is null or e.location is null then null else st_distance(e.location, me.pt) / 1000 end as dist
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
  select h.id, h.kind, h.title, null::text, h.image_url, h.categories,
    h.start_at, h.end_at, h.next_at, h.all_day, h.hours_text, h.duration_text,
    h.venue_name, h.address, st_y(h.location::geometry), st_x(h.location::geometry),
    h.price_min, h.price_max, h.status,
    h.ticket_url, h.official_url, h.first_detected_at, h.last_checked_at,
    (select array_agg(distinct s.source) from event_sources s where s.event_id = h.id),
    h.dist, c.timezone, c.currency
  from hits h, c
  where h.next_at is not null
  order by h.kind = 'place', h.all_day desc,
    case when h.kind = 'place' then null else h.next_at end,
    h.dist nulls last, h.image_url is null, h.title
  limit 5000;
$$;

drop function if exists get_events(uuid[]);
create function get_events(p_ids uuid[])
returns table (
  id uuid, kind text, title text, description text, image_url text, categories text[],
  start_at timestamptz, end_at timestamptz, next_at timestamptz, all_day boolean, hours_text text, duration_text text,
  venue_name text, address text, lat double precision, lng double precision,
  price_min numeric, price_max numeric, status event_status,
  ticket_url text, official_url text, first_detected_at timestamptz, last_checked_at timestamptz,
  sources text[], distance_km double precision, timezone text, currency text
)
language sql stable
as $$
  select e.id, e.kind, e.title, e.description, e.image_url, e.categories,
    e.start_at, e.end_at,
    case when e.all_day or e.occurrences is null then greatest(e.start_at, now())
      else (select min(lower(o)) from unnest(e.occurrences) o where upper(o) >= now()) end,
    e.all_day, e.hours_text, e.duration_text,
    e.venue_name, e.address, st_y(e.location::geometry), st_x(e.location::geometry),
    e.price_min, e.price_max, e.status,
    e.ticket_url, e.official_url, e.first_detected_at, e.last_checked_at,
    (select array_agg(distinct s.source) from event_sources s where s.event_id = e.id),
    null::double precision, c.timezone, c.currency
  from events e join cities c on c.slug = e.city
  where e.id = any (p_ids);
$$;

create or replace function count_new_for_subscription(p_endpoint text, p_since timestamptz)
returns integer language sql stable as $$
  select count(*)::int
  from push_subscriptions p
  join cities c on c.slug = p.city
  join events e on e.city = p.city
  where p.endpoint = p_endpoint
    and e.kind = 'event'
    and e.first_detected_at > p_since
    and e.status in ('available', 'almost_full')
    and e.categories && p.categories
    and next_slot(
      e,
      (p.date_from::timestamp at time zone c.timezone),
      ((p.date_to + 1)::timestamp at time zone c.timezone),
      p.moments,
      c.timezone
    ) is not null;
$$;
