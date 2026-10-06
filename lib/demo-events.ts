import "server-only";
import { addDays, todayIn, zonedDayStart } from "./dates";
import type { EventItem, EventStatus } from "./types";
import type { CategoryId } from "./categories";

// Données de démonstration (issues du design) : utilisées en dev tant que Supabase n'est pas configuré.
interface Seed {
  id: string;
  cat: CategoryId;
  title: string;
  venue: string;
  addr: string;
  from: number;
  to: number;
  h?: number;
  durH?: number;
  allDay?: boolean;
  hours: string;
  dur: string;
  price: number;
  priceMax?: number;
  status: EventStatus;
  isNew?: boolean;
  src: string[];
  lat: number;
  lng: number;
  desc: string;
  url: string;
}

const SEEDS: Seed[] = [
  { id: "demo-1", cat: "expo", title: "Estampes du Japon, 1760–1860", venue: "Musée Guimet", addr: "6 place d'Iéna, 75016 Paris", from: -20, to: 90, allDay: true, hours: "10h–18h, fermé le mardi", dur: "1 h 30 conseillée", price: 14, status: "available", src: ["openagenda"], lat: 48.8652, lng: 2.2936, desc: "Plus de 200 estampes rarement montrées, de Harunobu à Hiroshige. Les œuvres tournent chaque mois pour des raisons de conservation.", url: "https://www.guimet.fr" },
  { id: "demo-2", cat: "concert", title: "Quatuor à cordes — Beethoven, op. 131", venue: "Philharmonie de Paris", addr: "221 av. Jean-Jaurès, 75019 Paris", from: 4, to: 4, h: 20, durH: 1.75, hours: "20h00", dur: "1 h 45 avec entracte", price: 25, priceMax: 60, status: "almost_full", isNew: true, src: ["ticketmaster"], lat: 48.8919, lng: 2.3936, desc: "Un des derniers quatuors de Beethoven, joué en intégralité. Moins de 30 places restantes au moment de la vérification.", url: "https://philharmoniedeparis.fr" },
  { id: "demo-3", cat: "theatre", title: "Les Fourberies de Scapin", venue: "Comédie-Française", addr: "1 place Colette, 75001 Paris", from: 3, to: 5, h: 20.5, durH: 2, hours: "20h30 (dimanche 14h00)", dur: "2 h sans entracte", price: 15, priceMax: 45, status: "available", src: ["openagenda"], lat: 48.8634, lng: 2.3363, desc: "La comédie de Molière dans une mise en scène rythmée, accessible dès 10 ans.", url: "https://www.comedie-francaise.fr" },
  { id: "demo-4", cat: "visite", title: "Le Marais secret, visite à pied", venue: "Départ place des Vosges", addr: "Place des Vosges, 75004 Paris", from: 4, to: 5, h: 10.5, durH: 2, hours: "10h30", dur: "2 h", price: 18, status: "available", isNew: true, src: ["datatourisme"], lat: 48.8556, lng: 2.3655, desc: "Cours d'hôtels particuliers, passages et jardins qu'on ne voit pas depuis la rue. Groupe de 15 personnes maximum.", url: "https://www.parisinfo.com" },
  { id: "demo-5", cat: "patrimoine", title: "Crypte archéologique de l'île de la Cité", venue: "Crypte archéologique", addr: "7 parvis Notre-Dame, 75004 Paris", from: -100, to: 300, allDay: true, hours: "10h–18h, fermé le lundi", dur: "45 min", price: 9, status: "available", src: ["datatourisme", "officiel"], lat: 48.8535, lng: 2.3478, desc: "Les vestiges de Lutèce sous le parvis de Notre-Dame : quais gallo-romains, remparts et thermes.", url: "https://www.crypte.paris.fr" },
  { id: "demo-6", cat: "danse", title: "Corps célestes, création", venue: "Théâtre de la Ville", addr: "2 place du Châtelet, 75004 Paris", from: 5, to: 5, h: 15, durH: 1.2, hours: "15h00", dur: "1 h 10", price: 32, status: "full", src: ["openagenda"], lat: 48.8577, lng: 2.3473, desc: "Pièce pour neuf danseurs sur une musique jouée en direct. Toutes les places sont vendues.", url: "https://www.theatredelaville-paris.com" },
  { id: "demo-7", cat: "atelier", title: "Atelier gravure en famille", venue: "La Fabrique à estampes", addr: "14 rue Keller, 75011 Paris", from: 4, to: 4, h: 14, durH: 2, hours: "14h00", dur: "2 h", price: 25, status: "almost_full", isNew: true, src: ["openagenda"], lat: 48.8545, lng: 2.3757, desc: "On grave, on encre, on imprime : chacun repart avec ses tirages. Dès 7 ans, matériel fourni.", url: "https://openagenda.com" },
  { id: "demo-8", cat: "festival", title: "La Nuit des cuivres", venue: "Parc de la Villette", addr: "211 av. Jean-Jaurès, 75019 Paris", from: 4, to: 4, h: 19, durH: 4, hours: "19h00–23h00", dur: "4 h", price: 0, status: "available", src: ["openagenda", "paris-opendata"], lat: 48.8938, lng: 2.3906, desc: "Fanfares et brass bands sur trois scènes en plein air. Entrée libre, sans réservation.", url: "https://lavillette.com" },
  { id: "demo-9", cat: "cinema", title: "Ciné-concert : Nosferatu", venue: "Cinémathèque française", addr: "51 rue de Bercy, 75012 Paris", from: 5, to: 5, h: 18.5, durH: 1.6, hours: "18h30", dur: "1 h 35", price: 12, status: "available", src: ["officiel"], lat: 48.8372, lng: 2.3822, desc: "Le film de Murnau (1922) accompagné au piano en direct.", url: "https://www.cinematheque.fr" },
  { id: "demo-10", cat: "concert", title: "Trio Lune Rousse", venue: "Club de jazz des Halles", addr: "42 rue des Lombards, 75001 Paris", from: 3, to: 3, h: 21, durH: 1.5, hours: "21h00", dur: "1 h 30", price: 28, status: "closed", src: ["ticketmaster"], lat: 48.8597, lng: 2.3495, desc: "Jazz acoustique, compositions originales. Vente en ligne terminée, quelques places possibles au guichet.", url: "https://www.ticketmaster.fr" },
  { id: "demo-11", cat: "musee", title: "Nocturne au musée d'Orsay", venue: "Musée d'Orsay", addr: "1 rue de la Légion d'Honneur, 75007 Paris", from: 2, to: 2, h: 18, durH: 3.75, hours: "18h00–21h45", dur: "Libre", price: 16, status: "available", src: ["officiel"], lat: 48.86, lng: 2.3266, desc: "Les collections ouvertes en soirée, avec moins de monde qu'en journée.", url: "https://www.musee-orsay.fr" },
  { id: "demo-12", cat: "expo", title: "Paris la nuit, photographies 1930–1960", venue: "Musée Carnavalet", addr: "23 rue de Sévigné, 75003 Paris", from: -10, to: 180, allDay: true, hours: "10h–18h, fermé le lundi", dur: "1 h", price: 0, status: "available", isNew: true, src: ["openagenda", "paris-opendata"], lat: 48.8575, lng: 2.3627, desc: "Brassaï, Kertész et des photographes anonymes : la ville éclairée au gaz puis au néon. Entrée gratuite.", url: "https://www.carnavalet.paris.fr" },
];

const TZ = "Europe/Paris";

export function demoEvents(): EventItem[] {
  const today = todayIn(TZ);
  const now = Date.now();
  return SEEDS.map((s) => {
    const fromDay = addDays(today, s.from);
    const toDay = addDays(today, s.to);
    const start = s.allDay
      ? zonedDayStart(fromDay, TZ)
      : new Date(zonedDayStart(fromDay, TZ).getTime() + (s.h ?? 0) * 3600e3);
    const end = s.allDay
      ? new Date(zonedDayStart(addDays(toDay, 1), TZ).getTime() - 1)
      : new Date(zonedDayStart(toDay, TZ).getTime() + ((s.h ?? 0) + (s.durH ?? 2)) * 3600e3);
    return {
      id: s.id,
      title: s.title,
      description: s.desc,
      imageUrl: null,
      categories: [s.cat],
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      nextAt: start.toISOString(),
      allDay: !!s.allDay,
      hoursText: s.hours,
      durationText: s.dur,
      venueName: s.venue,
      address: s.addr,
      lat: s.lat,
      lng: s.lng,
      priceMin: s.price,
      priceMax: s.priceMax ?? s.price,
      status: s.status,
      ticketUrl: s.price > 0 ? s.url : null,
      officialUrl: s.url,
      firstDetectedAt: new Date(s.isNew ? now - 2 * 3600e3 : now - 20 * 86400e3).toISOString(),
      lastCheckedAt: new Date(now - 3600e3).toISOString(),
      sources: s.src,
      distanceKm: null,
    };
  });
}
