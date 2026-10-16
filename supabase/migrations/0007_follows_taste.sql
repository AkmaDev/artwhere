-- Lieux suivis (alertes « {lieu} a publié un nouvel événement ») et goûts agrégés (Quick Match).

-- Clés « ville|venue_norm » des lieux suivis par l'appareil abonné.
alter table push_subscriptions add column venues text[] not null default '{}';

-- Scores de goûts par catégorie, envoyés seulement avec le consentement du profil.
alter table user_profiles add column taste jsonb not null default '{}';

-- get_events renvoie aussi la ville (identifiant de lieu = ville + venue_norm).
drop function if exists get_events(uuid[]);
create function get_events(p_ids uuid[])
returns table (
  id uuid, kind text, title text, description text, image_url text, categories text[],
  start_at timestamptz, end_at timestamptz, next_at timestamptz, all_day boolean, hours_text text, duration_text text,
  venue_name text, address text, lat double precision, lng double precision,
  price_min numeric, price_max numeric, status event_status,
  ticket_url text, official_url text, first_detected_at timestamptz, last_checked_at timestamptz,
  sources text[], distance_km double precision, timezone text, currency text, city text
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
    null::double precision, c.timezone, c.currency, e.city
  from events e join cities c on c.slug = e.city
  where e.id = any (p_ids);
$$;

-- Page lieu : événements à venir du lieu (100 au plus, par date), puis le lieu culturel s'il existe.
create or replace function venue_event_ids(p_city text, p_norm text)
returns uuid[] language sql stable as $$
  select coalesce(array_agg(id), '{}') from (
    (select e.id from events e
      where e.city = p_city and e.venue_norm = p_norm and e.kind = 'event'
        and e.status <> 'cancelled' and e.end_at >= now()
      order by e.start_at
      limit 100)
    union all
    (select e.id from events e
      where e.city = p_city and e.venue_norm = p_norm and e.kind = 'place'
      limit 1)
  ) s;
$$;

-- Notifications : événements apparus depuis p_since dans les lieux suivis (clés « ville|venue_norm »).
create or replace function new_venue_events(p_keys text[], p_since timestamptz)
returns table (city text, venue_name text, title text) language sql stable as $$
  select e.city, e.venue_name, e.title
  from events e
  where coalesce(array_length(p_keys, 1), 0) > 0
    and e.kind = 'event'
    and e.first_detected_at > p_since
    and e.status in ('available', 'almost_full')
    and e.end_at >= now()
    and (e.city || '|' || e.venue_norm) = any (p_keys)
  order by e.first_detected_at desc
  limit 20;
$$;
