import type { CityConfig, Connector } from "../types";
import { openagenda } from "./openagenda";
import { parisOpenData } from "./paris-opendata";
import { ticketmaster } from "./ticketmaster";

// Ajouter une source : créer un fichier qui exporte un Connector, puis l'ajouter ici.
// Ordre = priorité de fusion (la première source qui crée un événement fixe son titre).
export const CONNECTORS: Connector[] = [parisOpenData, openagenda, ticketmaster];

// Ajouter une ville : une ligne ici + une ligne dans la table `cities` (active = true).
export const INGEST_CITIES: CityConfig[] = [
  { slug: "paris", name: "Paris", country: "FR", timezone: "Europe/Paris", lat: 48.8566, lng: 2.3522, radiusKm: 15 },
];
