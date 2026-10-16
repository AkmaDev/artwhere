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
cp .env.example .env.local   # remplir les clés Supabase (obligatoires)
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
- **Nouvelle ville** : rien à faire. Quand un utilisateur cherche une ville inconnue, `/api/areas/resolve` crée la zone (fuseau, devise) et déclenche la collecte via GitHub Actions (`GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO` côté Vercel). Sans token, la zone est collectée au passage suivant du cron (toutes les 3 h).
- **Lieux culturels** (`ingest/connectors/osm-places.ts`) : OpenStreetMap (rayon de la zone + sites notables à 80 km) enrichi par Wikidata, rafraîchis tous les 7 jours. Les serveurs Overpass publics sont parfois saturés : une collecte partielle ne retire rien et est retentée.
- **Dédoublonnage** : titre proche (trigrammes > 0,6) + même lieu (nom ou < 200 m) + dates qui se chevauchent → fusion, sources cumulées.
- **Fraîcheur** : la recherche exclut ce qui est terminé ; un événement qui disparaît de sa source est masqué ; les statuts complet / clôturé l'emportent.

## Profils anonymes et statistiques
- **Collecte progressive** : centres d'intérêt à l'accueil ; tranche d'âge et genre proposés (facultatifs) au premier favori ; les 3 villes les plus consultées sont déduites des recherches. Modifiable dans Alertes › Mes données.
- **Consentement** : rien n'est envoyé tant que la case n'est pas cochée. Le profil est lié à l'identifiant aléatoire de l'appareil (table `user_profiles`, migration `0006`), jamais à un nom ou un email. Retirer son accord efface la ligne immédiatement (`DELETE /api/profile`). Texte : `/confidentialite` (contact via `NEXT_PUBLIC_CONTACT_EMAIL`).
- **Statistiques** : `/admin`, protégée par `ADMIN_PASSWORD` (variable Vercel). Uniquement des agrégats (fonction SQL `profile_stats()`, non exposée à l'API publique) et un export CSV des agrégats.
- **Goûts** (`lib/taste.ts`) : un score par catégorie (favori +1, Quick Match Garder +2 / Passer −1, bornes −10/+20), stocké sur l'appareil ; il ordonne les rangées d'Explorer. Envoyé (colonne `user_profiles.taste`, migration `0007`) seulement avec le consentement, jamais la liste des événements vus.

## Lieux suivis
- Identifiant de lieu : `{ville}--{venue_norm}` (`lib/venue.ts`), page `/l/[id]`, API `/api/venues/[id]`.
- Les lieux suivis restent sur l'appareil ; avec les alertes actives, leurs clés sont envoyées avec l'abonnement (`push_subscriptions.venues`) et `ingest/notify.ts` prévient des nouveaux événements de ces lieux. **Nécessite la migration `0007`.**

## Drapeaux
- `NEXT_PUBLIC_QUICK_MATCH=1` : carte Quick Match dans Explorer (désactivée par défaut).
- `NEXT_PUBLIC_SYNC=1` : carte de synchro dans Favoris, **interface seule** (aucun e-mail envoyé, pas de serveur).

## GitHub Actions
Secrets à créer : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TICKETMASTER_API_KEY`, `OPENAGENDA_API_KEY`. Variable : `OPENAGENDA_AGENDAS_PARIS`.
