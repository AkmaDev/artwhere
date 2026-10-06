// Turbopack ne résout pas l'URL du worker module de MapLibre : on le sert depuis /public.
import { copyFileSync, mkdirSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist/";
const dst = "public/maplibre/";
mkdirSync(dst, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(src + f, dst + f);
