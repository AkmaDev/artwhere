-- Le dédoublonnage ne rapproche que des événements entre eux (jamais un événement et un lieu permanent).
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
    and e.kind = 'event'
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
