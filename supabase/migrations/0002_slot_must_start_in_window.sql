-- Une séance compte pour un créneau si elle commence dans le créneau et n'est pas encore terminée
-- (avant : une séance commencée la veille et finissant après minuit remontait).
create or replace function next_slot(
  e events, p_from timestamptz, p_to timestamptz, p_moments text[], tz text
)
returns timestamptz language sql stable as $$
  select case
    when e.all_day then greatest(e.start_at, p_from, now())
    when e.occurrences is null then
      case when e.start_at >= p_from and e.start_at <= p_to and e.end_at >= now()
        and (coalesce(array_length(p_moments, 1), 0) = 0 or moment_of(e.start_at, tz) = any (p_moments))
      then e.start_at end
    else (
      select min(lower(o)) from unnest(e.occurrences) o
      where lower(o) >= p_from and lower(o) <= p_to and upper(o) >= now()
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
    select e.*, next_slot(e, p_from, p_to, p_moments, c.timezone) as next_at, me.pt
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
      (p.date_from::timestamp at time zone c.timezone),
      ((p.date_to + 1)::timestamp at time zone c.timezone),
      p.moments,
      c.timezone
    ) is not null;
$$;
