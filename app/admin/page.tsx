import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { isAdmin, loadStats } from "@/lib/admin";
import { CATEGORY_IDS } from "@/lib/categories";
import { AGE_RANGES, GENDERS } from "@/lib/profile";
import { login, logout } from "./actions";

export const metadata: Metadata = { title: "Statistiques", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ e?: string }> };

type Row = { key: string; label: string; n: number };

// Barres horizontales à une seule teinte (magnitude) : pas de légende, valeur en bout de barre.
function Bars({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 text-[16px] leading-[1.3] font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <span className="text-[13px] text-muted">Pas encore de données.</span>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((r) => {
            const pct = total ? Math.round((r.n / total) * 100) : 0;
            return (
              <li key={r.key} title={`${r.label} : ${r.n} (${pct} %)`} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
                <span className="truncate text-[13px] leading-tight text-ink">{r.label}</span>
                <span className="flex items-center gap-2">
                  <span className="h-[18px] rounded-r-[4px] bg-accent" style={{ width: `${Math.max((r.n / max) * 75, 1.5)}%` }} />
                  <span className="flex-none text-[12.5px] leading-none text-muted tabular-nums">
                    {r.n} · {pct} %
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPage({ searchParams }: Props) {
  // Toujours rendue à la requête : jamais de version statique de cette page.
  await connection();
  if (!process.env.ADMIN_PASSWORD) {
    return <p className="m-0 p-6 text-[15px] text-muted">Page non configurée : ajouter ADMIN_PASSWORD dans les variables d&apos;environnement.</p>;
  }

  if (!(await isAdmin())) {
    const failed = (await searchParams).e === "1";
    return (
      <form action={login} className="flex flex-1 flex-col justify-center gap-3.5 px-6">
        <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-[-.02em]">Statistiques Artwhere</h1>
        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="Mot de passe"
          aria-label="Mot de passe"
          className="h-[52px] rounded-xl border border-border-3 px-4 text-[16px] outline-none focus:border-ink"
        />
        {failed && <span className="text-[13.5px] text-heart">Mot de passe incorrect.</span>}
        <button type="submit" className="h-[50px] cursor-pointer rounded-xl border-0 bg-ink text-[16px] font-semibold text-white">
          Se connecter
        </button>
      </form>
    );
  }

  const [s, tc, tp] = await Promise.all([loadStats(), getTranslations("categories"), getTranslations("profile")]);
  const rows = (order: readonly string[], counts: Record<string, number>, label: (k: string) => string): Row[] =>
    [...order, "unknown"]
      .filter((k) => counts[k])
      .map((k) => ({ key: k, label: k === "unknown" ? "Non renseigné" : label(k), n: counts[k] }));
  const byCount = (counts: Record<string, number>, label: (k: string) => string): Row[] =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => ({ key: k, label: label(k), n }));

  const ages = [...AGE_RANGES, "unknown"].filter((a) => Object.keys(s.catByAge).some((k) => k.endsWith(`|${a}`)));
  const cross = Object.values(s.catByAge);
  const crossMax = Math.max(1, ...cross);

  return (
    <div className="no-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-5 pt-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-.02em]">Statistiques</h1>
          <span className="text-[13.5px] text-muted">Profils anonymes ayant donné leur accord</span>
        </div>
        <form action={logout}>
          <button type="submit" className="h-9 cursor-pointer rounded-lg border border-border-2 bg-white px-3 text-[13px] font-semibold">
            Déconnexion
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-0.5 rounded-2xl bg-sand px-4 py-3.5">
        <span className="text-[34px] leading-none font-semibold tabular-nums">{s.total}</span>
        <span className="text-[13.5px] text-muted">profils enregistrés</span>
      </div>

      <Bars title="Centres d'intérêt" total={s.total} rows={byCount(s.categories, (k) => tc(`${k}.name`))} />
      <Bars title="Tranches d'âge" total={s.total} rows={rows(AGE_RANGES, s.age, (k) => tp(`ages.${k}`))} />
      <Bars title="Genre" total={s.total} rows={rows(GENDERS, s.gender, (k) => tp(`genders.${k}`))} />
      <Bars title="Villes les plus consultées" total={s.total} rows={byCount(s.cities, (k) => s.cityNames[k] ?? k)} />

      {cross.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="m-0 text-[16px] leading-[1.3] font-semibold">Centres d&apos;intérêt par tranche d&apos;âge</h2>
          <div className="no-scrollbar overflow-x-auto">
            <table className="border-collapse text-[12.5px] tabular-nums">
              <thead>
                <tr>
                  <th />
                  {ages.map((a) => (
                    <th key={a} className="px-1.5 pb-1.5 text-center font-semibold whitespace-nowrap text-muted">
                      {a === "unknown" ? "?" : tp(`ages.${a}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORY_IDS.filter((c) => s.categories[c]).map((c) => (
                  <tr key={c}>
                    <th className="pr-2 text-left font-medium whitespace-nowrap">{tc(`${c}.name`)}</th>
                    {ages.map((a) => {
                      const n = s.catByAge[`${c}|${a}`] ?? 0;
                      const k = n / crossMax;
                      return (
                        <td
                          key={a}
                          title={`${tc(`${c}.name`)}, ${a === "unknown" ? "âge non renseigné" : tp(`ages.${a}`)} : ${n}`}
                          className="h-8 min-w-10 border-2 border-white text-center"
                          style={{ background: n ? `rgba(46,59,214,${0.1 + k * 0.8})` : "#f3f2ee", color: k > 0.5 ? "#fff" : "#1e1e1c" }}
                        >
                          {n || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <a
        href="/admin/export"
        className="flex h-11 items-center justify-center rounded-[10px] border border-ink text-[14px] font-semibold text-ink no-underline"
      >
        Télécharger les agrégats (CSV)
      </a>
    </div>
  );
}
