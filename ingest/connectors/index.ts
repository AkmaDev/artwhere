import type { Connector } from "../types";
import { openagenda } from "./openagenda";
import { osmPlaces } from "./osm-places";
import { parisOpenData } from "./paris-opendata";
import { ticketmaster } from "./ticketmaster";

// Ajouter une source : créer un fichier qui exporte un Connector, puis l'ajouter ici.
// Ordre = priorité de fusion (la première source qui crée un événement fixe son titre).
// Les zones (villes) viennent de la table `cities`, créées à la demande par l'appli.
export const CONNECTORS: Connector[] = [parisOpenData, openagenda, ticketmaster];

/** Lieux permanents : rafraîchis moins souvent (tous les PLACES_REFRESH_DAYS jours). */
export const PLACE_CONNECTORS: Connector[] = [osmPlaces];
export const PLACES_REFRESH_DAYS = 7;
