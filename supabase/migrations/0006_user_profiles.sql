-- Profils anonymes (identifiant d'appareil), créés uniquement après consentement explicite.

create table user_profiles (
  device_id uuid primary key,
  consent_at timestamptz not null default now(),
  categories text[] not null default '{}',
  age_range text check (age_range in ('<18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+')),
  gender text check (gender in ('f', 'm', 'other', 'na')),
  -- slugs de `cities`, 3 au plus, du plus au moins consulté
  top_cities text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;
-- user_profiles : aucune policy, accès uniquement via service role (routes API).

-- Agrégats pour la page /admin : jamais de ligne individuelle.
create or replace function profile_stats()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'total', (select count(*) from user_profiles),
    'age', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(age_range, 'unknown') k, count(*) n from user_profiles group by 1) s),
    'gender', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(gender, 'unknown') k, count(*) n from user_profiles group by 1) s),
    'categories', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select c k, count(*) n from user_profiles, unnest(categories) c group by 1) s),
    'cities', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select c k, count(*) n from user_profiles, unnest(top_cities) c group by 1) s),
    'catByAge', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select c || '|' || coalesce(age_range, 'unknown') k, count(*) n from user_profiles, unnest(categories) c group by 1) s)
  );
$$;

-- Les fonctions de `public` sont exécutables par anon via l'API REST : on restreint au service role.
revoke execute on function profile_stats() from public, anon, authenticated;
