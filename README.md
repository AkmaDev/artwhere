# Artwhere — l'art là où tu es

Web app (PWA) de veille d'événements culturels : expos, musées, concerts, théâtre, danse, cinéma, festivals, visites, patrimoine, ateliers. Pas de compte : préférences et favoris restent sur l'appareil.

Ville pilote : **Paris**.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind v4, textes dans `messages/fr.json` (next-intl)
- Supabase Postgres + PostGIS + pg_trgm (`supabase/migrations/0001_init.sql`)
- Carte : MapLibre + tuiles OpenFreeMap
- Alertes : Web Push (VAPID) via `public/sw.js`
- Collecte : `ingest/` (un connecteur par source), lancée par GitHub Actions toutes les 3 h

## Démarrer en local
```bash
npm install
cp .env.example .env.local   # sans Supabase, l'app tourne sur 12 événements de démo
npm run dev
```

## Mise en route Supabase
1. Créer le projet, puis exécuter les fichiers de `supabase/migrations/` dans l'ordre :
   `npx supabase db query --linked --project-ref <ref> -f supabase/migrations/000X_….sql`
2. Remplir `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run vapid` → copier les deux clés dans `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
4. `npm run ingest` (première collecte, quelques minutes).

## Collecte
```bash
npm run ingest -- --dry-run                    # ne touche pas la base
npm run ingest -- --city=paris --source=ticketmaster
npm run notify:daily -- --force                # résumé quotidien à la main
```
| Source | Clé | Statut |
|---|---|---|
| Que faire à Paris (open data Ville de Paris) | non | actif |
| Ticketmaster Discovery | `TICKETMASTER_API_KEY` | actif si clé |
| OpenAgenda | `OPENAGENDA_API_KEY` + `OPENAGENDA_AGENDAS_PARIS` (UID séparés par des virgules) | actif si clé |

Agendas OpenAgenda suivis à Paris : Philharmonie (504556), FICEP (61665301), Centre tchèque (6899331), Institut Liszt (23559850), Centre culturel de Taïwan (12120678), Journées de l'architecture IDF (1388317). La recherche sur tous les agendas d'une zone demande le droit `events:transverse`, à obtenir auprès d'OpenAgenda.

- **Nouvelle source** : un fichier dans `ingest/connectors/` qui exporte un `Connector`, ajouté à `CONNECTORS`.
- **Nouvelle ville** : une ligne dans `INGEST_CITIES` (`ingest/connectors/index.ts`), dans `lib/cities.ts` et dans la table `cities` (`active = true`).
- **Dédoublonnage** : titre proche (trigrammes > 0,6) + même lieu (nom ou < 200 m) + dates qui se chevauchent → fusion, sources cumulées.
- **Fraîcheur** : la recherche exclut ce qui est terminé ; un événement qui disparaît de sa source est masqué ; les statuts complet / clôturé l'emportent.

## GitHub Actions
Secrets à créer : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TICKETMASTER_API_KEY`, `OPENAGENDA_API_KEY`. Variable : `OPENAGENDA_AGENDAS_PARIS`.
