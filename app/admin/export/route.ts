import { isAdmin, loadStats } from "@/lib/admin";

// Agrégats uniquement : aucune ligne individuelle n'est exportée.
export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const s = await loadStats();
  const lines = ["dimension;valeur;profils"];
  const add = (dim: string, counts: Record<string, number>, label: (k: string) => string = (k) => k) => {
    for (const [k, n] of Object.entries(counts)) lines.push(`${dim};${label(k).replaceAll(";", ",")};${n}`);
  };
  lines.push(`total;;${s.total}`);
  add("age", s.age);
  add("genre", s.gender);
  add("centre_interet", s.categories);
  add("ville", s.cities, (k) => s.cityNames[k] ?? k);
  add("centre_interet|age", s.catByAge);
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artwhere-stats-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
