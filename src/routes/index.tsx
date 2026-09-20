import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { findCompetitors, type CompetitorResult } from "@/lib/competitors.functions";

const CompetitorMapLazy = lazy(() => import("@/components/CompetitorMap"));
const CompetitorMap = (props: { data: CompetitorResult }) => (
  <Suspense
    fallback={<div className="h-[360px] w-full rounded-[12px] bg-ink/40 ring-1 ring-line" />}
  >
    <CompetitorMapLazy {...props} />
  </Suspense>
);
import {
  CATEGORIES,
  DENSITIES,
  computeFeasibility,
  routeSchemes,
  rankAlternatives,
  SCHEME_GUIDES,
  inr,
  type Inputs,
  type CategoryKey,
  type Density,
} from "@/lib/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hyper-Local Business Feasibility & Scheme Router" },
      {
        name: "description",
        content:
          "Score a rural business idea 0–100 on demand, competition, profit and risk, then compute EMI, DSCR and matched government schemes.",
      },
      { property: "og:title", content: "Hyper-Local Business Feasibility & Scheme Router" },
      {
        property: "og:description",
        content:
          "Village-level feasibility scoring with deterministic financials: project cost, subsidy, EMI, DSCR and matched government schemes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const toneClass: Record<string, string> = {
  aurora: "bg-aurora",
  glow: "bg-glow",
  amber: "bg-amber",
  rose: "bg-rose",
};
const toneText: Record<string, string> = {
  aurora: "text-aurora",
  glow: "text-glow",
  amber: "text-amber",
  rose: "text-rose",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-mist/50">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

type Draft = Omit<Inputs, "category" | "density"> & {
  category: CategoryKey | "";
  density: Density | "";
};

const EMPTY_INPUTS: Draft = {
  village: "",
  block: "",
  district: "",
  category: "",
  density: "",
  capital: 0,
  revenue: 0,
  operatingCost: 0,
  supplierDistanceKm: 0,
};

function Index() {
  const [draft, setDraft] = useState<Draft>(EMPTY_INPUTS);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v.replace(/[^\d.]/g, ""))));

  const missing: string[] = [];
  if (!draft.village.trim()) missing.push("Village");
  if (!draft.district.trim()) missing.push("District");
  if (!draft.category) missing.push("Business category");
  if (!draft.density) missing.push("Settlement type");
  if (draft.capital <= 0) missing.push("Margin capital");
  if (draft.revenue <= 0) missing.push("Monthly revenue");
  if (draft.operatingCost <= 0) missing.push("Operating cost");
  const ready = missing.length === 0;

  const f = useMemo(() => (ready ? computeFeasibility(draft as Inputs) : null), [draft, ready]);
  const matches = useMemo(() => (f ? routeSchemes(draft as Inputs, f) : null), [draft, f]);
  const alternatives = useMemo(() => (f ? rankAlternatives(draft as Inputs, f) : null), [draft, f]);
  const better = alternatives?.filter((a) => a.delta > 0.5) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const active = matches
    ? (matches.find((m) => m.scheme.code === selected) ?? matches[0]!)
    : null;

  const [radiusKm, setRadiusKm] = useState(10);
  const [mapData, setMapData] = useState<CompetitorResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setMapError(null);
    try {
      const res = await findCompetitors({
        data: {
          village: draft.village,
          block: draft.block,
          district: draft.district,
          category: draft.category as CategoryKey,
          radiusKm,
        },
      });
      setMapData(res);
    } catch (err) {
      setMapError(
        err instanceof Error ? err.message : "Could not load nearby competitors right now.",
      );
    } finally {
      setScanning(false);
    }
  };

  const gaugeDeg = ((f?.total ?? 0) / 100) * 360;
  const dscrPos = Math.min(Math.max(active?.dscr ?? 0, 0), 1) * 100;

  return (
    <div className="relative min-h-screen bg-ink text-mist font-sans antialiased selection:bg-aurora/30">
      <div className="absolute inset-0 bg-aurora-field" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-aurora/40" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex max-w-[1320px] items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[10px] bg-aurora/15 text-aurora ring-1 ring-aurora/30">
            <span className="font-display text-sm font-semibold">M</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-white/90">Mukhyata</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mist/50">
              MoSJE Advisory Console
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-xs text-mist/70">
          <span className="hidden sm:inline">Deterministic engine · INR</span>
          <div className="flex items-center gap-2 rounded-full bg-panel/60 px-3 py-1.5 ring-1 ring-line">
            <span className="size-1.5 rounded-full bg-aurora" />
            <span className="text-mist/80">
              Ref FEAS-{inputs.district.slice(0, 3).toUpperCase() || "GEN"}-
              {String(Math.round((f?.total ?? 0) * 100)).padStart(4, "0")}
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1320px] px-6 pt-2 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-glow/70">
          Module 1 · Feasibility Certificate
        </p>
        <h1 className="mt-3 max-w-[40ch] font-display text-4xl font-semibold leading-tight text-white text-balance sm:text-5xl">
          Village-level business feasibility, scored and evidence-backed.
        </h1>
        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-mist/80 text-pretty sm:text-base">
          Hyper-local scoring across location, category, capital, revenue and cost. Every claim in
          the report carries a numeric basis so a field officer can defend it.
        </p>
      </div>

      <main className="relative z-10 mx-auto grid max-w-[1320px] grid-cols-1 gap-5 px-6 pb-16 lg:grid-cols-12">
        {/* LEFT: live inputs */}
        <section className="lg:col-span-4">
          <div className="glass h-full rounded-[18px] p-5 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white/90">
                Submission inputs
              </h2>
              <span className="rounded-full bg-aurora/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-aurora ring-1 ring-aurora/25">
                Live
              </span>
            </div>

            <div className="mt-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Village">
                  <input
                    className="field"
                    value={inputs.village}
                    onChange={(e) => set("village", e.target.value)}
                  />
                </Field>
                <Field label="Block">
                  <input
                    className="field"
                    value={inputs.block}
                    onChange={(e) => set("block", e.target.value)}
                  />
                </Field>
                <Field label="District">
                  <input
                    className="field"
                    value={inputs.district}
                    onChange={(e) => set("district", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Business category">
                <select
                  className="field"
                  value={inputs.category}
                  onChange={(e) => set("category", e.target.value as CategoryKey)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Settlement type">
                <select
                  className="field"
                  value={inputs.density}
                  onChange={(e) => set("density", e.target.value as Density)}
                >
                  {DENSITIES.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Margin capital ₹">
                  <input
                    className="field"
                    inputMode="numeric"
                    value={inputs.capital}
                    onChange={(e) => set("capital", num(e.target.value))}
                  />
                </Field>
                <Field label="Supplier distance (km)">
                  <input
                    className="field"
                    inputMode="numeric"
                    value={inputs.supplierDistanceKm}
                    onChange={(e) => set("supplierDistanceKm", num(e.target.value))}
                  />
                </Field>
                <Field label="Monthly revenue ₹">
                  <input
                    className="field"
                    inputMode="numeric"
                    value={inputs.revenue}
                    onChange={(e) => set("revenue", num(e.target.value))}
                  />
                </Field>
                <Field label="Operating cost ₹">
                  <input
                    className="field"
                    inputMode="numeric"
                    value={inputs.operatingCost}
                    onChange={(e) => set("operatingCost", num(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 rounded-[10px] bg-ink/40 p-3 ring-1 ring-line">
              <p className="text-[11px] uppercase tracking-wider text-mist/50">
                Operating surplus / month
              </p>
              <p
                className={`mt-1 font-display text-lg font-semibold ${
                  f.surplus >= 0 ? "text-aurora" : "text-rose"
                }`}
              >
                {inr(f.surplus)} · {f.marginPct.toFixed(0)}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInputs(DEFAULT_INPUTS)}
              className="mt-3 w-full rounded-[10px] px-3 py-2 text-xs font-medium text-mist/70 ring-1 ring-line transition-colors hover:bg-panel/60 hover:text-white"
            >
              Reset to sample case
            </button>
          </div>
        </section>

        {/* CENTER: gauge + weighted factors */}
        <section className="lg:col-span-5">
          <div className="glass h-full rounded-[18px] p-5 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white/90">
                Weighted feasibility score
              </h2>
              <span className="text-[11px] text-mist/50">Max 100</span>
            </div>

            <div className="mt-5 flex items-center gap-6">
              <div className="relative grid size-36 shrink-0 place-items-center">
                <div
                  className="absolute inset-0 rounded-full transition-all duration-500"
                  style={{
                    background: `conic-gradient(#2dd4bf 0deg, #7dd3fc ${gaugeDeg}deg, #242c40 ${gaugeDeg}deg, #242c40 360deg)`,
                  }}
                />
                <div className="absolute inset-[10px] rounded-full bg-ink" />
                <div className="relative text-center">
                  <p className="font-display text-4xl font-semibold leading-none text-white">
                    {Math.round(f.total)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-aurora">
                    {f.band}
                  </p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-mist/80">{f.verdict}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-aurora/12 px-2.5 py-1 text-aurora ring-1 ring-aurora/25">
                    Score {f.total.toFixed(2)} / 100
                  </span>
                  <span className="rounded-full bg-panel/60 px-2.5 py-1 text-mist/70 ring-1 ring-line">
                    Risk load {Math.round(f.riskScore)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] uppercase tracking-wider text-mist/45">
                <span>Factor</span>
                <span className="text-right">Weight</span>
                <span className="w-8 text-right">Score</span>
                <span className="w-12 text-right">Wtd</span>
              </div>
              <div className="divide-y divide-line/70">
                {f.factors.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white/85">{row.label}</p>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-line">
                        <div
                          className={`h-1 rounded-full transition-all duration-500 ${toneClass[row.tone]}`}
                          style={{ width: `${row.score}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-mist/60">{row.weight}%</span>
                    <span
                      className={`w-8 text-right font-display text-sm ${toneText[row.tone]}`}
                    >
                      {row.score}
                    </span>
                    <span className="w-12 text-right font-display text-sm text-mist/70">
                      {row.weighted.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: metric cards */}
        <section className="lg:col-span-3">
          <div className="grid content-start gap-5 sm:grid-cols-3 lg:grid-cols-1">
            <div className="glass rounded-[18px] p-4 ring-1 ring-line">
              <p className="text-[11px] uppercase tracking-wider text-mist/50">Demand index</p>
              <p className="mt-2 font-display text-2xl font-semibold text-white">
                {(f.demandScore / 10).toFixed(1)}
                <span className="text-sm text-mist/50">/10</span>
              </p>
              <p className="mt-1 text-xs text-mist/70">
                {f.households.toLocaleString("en-IN")} households ·{" "}
                {f.population.toLocaleString("en-IN")} residents
              </p>
            </div>
            <div className="glass rounded-[18px] p-4 ring-1 ring-line">
              <p className="text-[11px] uppercase tracking-wider text-mist/50">Competition</p>
              <p className="mt-2 font-display text-2xl font-semibold text-white">
                {f.competitionScore >= 70 ? "Low" : f.competitionScore >= 45 ? "Medium" : "High"}
              </p>
              <p className="mt-1 text-xs text-mist/70">
                {f.competitors} unit{f.competitors === 1 ? "" : "s"} · {f.competitorsPer1000} per
                1,000 residents
              </p>
            </div>
            <div className="glass rounded-[18px] p-4 ring-1 ring-line">
              <p className="text-[11px] uppercase tracking-wider text-mist/50">
                Recommended price band
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-aurora">
                ₹{f.priceLow.toFixed(0)} – ₹{f.priceHigh.toFixed(0)} / {f.category.unit}
              </p>
              <p className="mt-1 text-xs text-mist/70">
                Reference cost ₹{f.category.unitCost} · {f.category.seasonal}
              </p>
            </div>
          </div>
        </section>

        {/* SWOT */}
        <section className="lg:col-span-12">
          <div className="glass rounded-[18px] p-5 ring-1 ring-line">
            <h2 className="font-display text-sm font-semibold text-white/90">SWOT snapshot</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["Strengths", f.swot.strengths, "text-aurora"],
                  ["Weaknesses", f.swot.weaknesses, "text-glow"],
                  ["Opportunities", f.swot.opportunities, "text-amber"],
                  ["Threats", f.swot.threats, "text-rose"],
                ] as const
              ).map(([title, items, tone]) => (
                <div key={title} className="rounded-[10px] bg-ink/40 p-3.5 ring-1 ring-line">
                  <p className={`text-[11px] font-medium uppercase tracking-wider ${tone}`}>
                    {title}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-mist/80">
                    {items.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ALTERNATIVE CATEGORIES */}
        <section className="lg:col-span-12">
          <div className="glass rounded-[18px] p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-white/90">
                  Better-scoring alternatives in {inputs.village}
                </h2>
                <p className="mt-1 text-xs text-mist/60">
                  Same location, capital, revenue and cost — re-scored for every other category.
                </p>
              </div>
              <span className="text-[11px] text-mist/50">
                Current: {f.category.label} · {f.total.toFixed(1)}
              </span>
            </div>

            {better.length === 0 ? (
              <p className="mt-4 rounded-[10px] bg-aurora/10 p-3 text-xs text-aurora ring-1 ring-aurora/25">
                {f.category.label} already scores highest of the {CATEGORIES.length} categories on
                these inputs — no stronger alternative found.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {better.map((a) => (
                  <button
                    key={a.category.key}
                    type="button"
                    onClick={() => set("category", a.category.key)}
                    className="rounded-[10px] bg-ink/40 p-3.5 text-left ring-1 ring-line transition-colors hover:ring-aurora/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white/90">{a.category.label}</p>
                      <span className="shrink-0 rounded-full bg-aurora/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-aurora">
                        +{a.delta.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-display text-lg font-semibold text-white">
                      {a.total.toFixed(1)}
                      <span className="ml-1.5 text-[11px] font-normal text-mist/60">{a.band}</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-mist/70">{a.reason}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-glow/70">
                      Tap to re-score with this category
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* MODULE 2 */}
        <section className="lg:col-span-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-glow/70">
                Module 2 · Financing
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white text-balance">
                Smart calculator &amp; scheme router
              </h2>
            </div>
            <span className="hidden text-xs text-mist/50 sm:block">All figures in INR</span>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            {/* cost split */}
            <div className="glass rounded-[18px] p-5 ring-1 ring-line lg:col-span-4">
              <h3 className="font-display text-sm font-semibold text-white/90">
                Project cost &amp; subsidy split
              </h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-mist/70">Total project cost</span>
                  <span className="font-display text-white">{inr(active.projectCost)}</span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-1.5 bg-aurora"
                    style={{ width: `${(active.subsidy / active.projectCost) * 100}%` }}
                  />
                  <div
                    className="h-1.5 bg-glow"
                    style={{ width: `${(active.ownContribution / active.projectCost) * 100}%` }}
                  />
                  <div
                    className="h-1.5 bg-amber"
                    style={{ width: `${(active.loan / active.projectCost) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mist/70">
                    Capital subsidy ({active.scheme.subsidyPct}%)
                  </span>
                  <span className="font-display text-aurora">−{inr(active.subsidy)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mist/70">Margin / own contribution</span>
                  <span className="font-display text-white">{inr(active.ownContribution)}</span>
                </div>
                <div className="rounded-[10px] bg-ink/40 p-3 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-mist/50">
                      Loan required
                    </span>
                    <span className="font-display text-base font-semibold text-white">
                      {inr(active.loan)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-mist/60">
                    At {active.scheme.interestRate}% p.a. · {active.scheme.tenureMonths / 12}-year
                    tenure · {active.scheme.moratoriumMonths}-month moratorium
                  </p>
                </div>
              </div>
            </div>

            {/* EMI + DSCR */}
            <div className="glass rounded-[18px] p-5 ring-1 ring-line lg:col-span-4">
              <h3 className="font-display text-sm font-semibold text-white/90">
                Repayment &amp; DSCR
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[10px] bg-ink/40 p-3 ring-1 ring-line">
                  <p className="text-[11px] uppercase tracking-wider text-mist/50">Monthly EMI</p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-white">
                    {inr(active.emi)}
                  </p>
                </div>
                <div className="rounded-[10px] bg-ink/40 p-3 ring-1 ring-line">
                  <p className="text-[11px] uppercase tracking-wider text-mist/50">DSCR</p>
                  <p
                    className={`mt-1.5 font-display text-xl font-semibold ${
                      active.dscr >= 1.5
                        ? "text-aurora"
                        : active.dscr >= 1.2
                          ? "text-amber"
                          : "text-rose"
                    }`}
                  >
                    {active.dscr >= 99 ? "—" : active.dscr.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-mist/50">
                  <span>High stress</span>
                  <span>Low stress</span>
                </div>
                <div
                  className="relative mt-1.5 h-2 rounded-full"
                  style={{ background: "linear-gradient(90deg, #f08a8a, #f5b85e, #2dd4bf)" }}
                >
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-ink transition-all duration-500"
                    style={{ left: `${dscrPos}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-mist/70">
                  Risk band: <span className="text-aurora">{active.riskBand}</span> · surplus{" "}
                  {inr(f.surplus)} vs EMI {inr(active.emi)}
                </p>
              </div>
              <p className="mt-4 text-[11px] text-mist/50">
                Amortization: principal {inr(active.loan)} + interest {inr(active.totalInterest)}{" "}
                over {active.scheme.tenureMonths} months. Total repayment{" "}
                {inr(active.totalRepayment)}.
              </p>
            </div>

            {/* matched schemes */}
            <div className="lg:col-span-4">
              <div className="glass h-full rounded-[18px] p-5 ring-1 ring-line">
                <h3 className="font-display text-sm font-semibold text-white/90">
                  Matched schemes
                </h3>
                <div className="mt-4 space-y-3">
                  {matches.map((m) => {
                    const isActive = m.scheme.code === active.scheme.code;
                    return (
                      <button
                        key={m.scheme.code}
                        type="button"
                        onClick={() => setSelected(m.scheme.code)}
                        className={`block w-full rounded-[10px] bg-ink/40 p-3.5 text-left ring-1 transition-colors ${
                          isActive ? "ring-aurora/50" : "ring-line hover:ring-mist/30"
                        } ${m.eligible ? "" : "opacity-60"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white/90">{m.scheme.name}</p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              m.eligible
                                ? "bg-aurora/12 text-aurora"
                                : "bg-panel/60 text-mist/70 ring-1 ring-line"
                            }`}
                          >
                            {m.eligible ? `${m.fit}% fit` : "Not eligible"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-mist/70">
                          {m.scheme.authority} · {m.reason}
                        </p>
                        <p className="mt-1 text-[11px] text-mist/50">
                          Loan {inr(m.loan)} · EMI {inr(m.emi)} ·{" "}
                          {m.dscr >= 99 ? "no loan" : `DSCR ${m.dscr.toFixed(2)}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* APPLICATION GUIDANCE */}
          {(() => {
            const guide = SCHEME_GUIDES[active.scheme.code];
            if (!guide) return null;
            return (
              <div className="glass mt-5 rounded-[18px] p-5 ring-1 ring-line">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-glow/70">
                      How to apply
                    </p>
                    <h3 className="mt-1.5 font-display text-base font-semibold text-white">
                      {active.scheme.name} · application guide
                    </h3>
                    <p className="mt-1 text-xs text-mist/60">
                      {guide.portal} · {guide.processingWeeks}
                    </p>
                  </div>
                  <a
                    href={guide.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[10px] bg-aurora/15 px-4 py-2 text-xs font-medium uppercase tracking-wider text-aurora ring-1 ring-aurora/30 transition-colors hover:bg-aurora/25"
                  >
                    Open official portal
                  </a>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <p className="text-[11px] uppercase tracking-wider text-mist/50">
                      Step-by-step process
                    </p>
                    <ol className="mt-3 space-y-2.5">
                      {guide.steps.map((s, idx) => (
                        <li key={s} className="flex gap-3">
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-aurora/12 text-[10px] font-semibold text-aurora ring-1 ring-aurora/25">
                            {idx + 1}
                          </span>
                          <span className="text-[13px] leading-relaxed text-mist/80">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-[10px] bg-ink/40 p-3.5 ring-1 ring-line">
                      <p className="text-[11px] uppercase tracking-wider text-amber">
                        Documents to keep ready
                      </p>
                      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-mist/75">
                        {guide.documents.map((d) => (
                          <li key={d}>· {d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[10px] bg-ink/40 p-3.5 ring-1 ring-line">
                      <p className="text-[11px] uppercase tracking-wider text-glow">
                        Field officer tips
                      </p>
                      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-mist/75">
                        {guide.tips.map((t) => (
                          <li key={t}>· {t}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-mist/50">
                  Steps reflect the published scheme process; confirm current rules and ceilings on
                  the official portal before submission.
                </p>
              </div>
            );
          })()}
        </section>

        <section className="lg:col-span-12">
          <div className="glass rounded-[18px] p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-glow/70">
                  Module 3 · Competitor map
                </p>
                <h3 className="mt-1.5 font-display text-sm font-semibold text-white/90">
                  Nearby {f.category.label.toLowerCase()} around {inputs.village}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="field w-auto"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                >
                  {[5, 10, 20, 35, 50].map((r) => (
                    <option key={r} value={r}>
                      {r} km radius
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={scan}
                  disabled={scanning}
                  className="rounded-[10px] bg-aurora/15 px-4 py-2 text-xs font-medium uppercase tracking-wider text-aurora ring-1 ring-aurora/30 transition-colors hover:bg-aurora/25 disabled:opacity-50"
                >
                  {scanning ? "Scanning…" : "Scan area"}
                </button>
              </div>
            </div>

            {mapError ? (
              <p className="mt-4 rounded-[10px] bg-rose/10 p-3 text-xs text-rose ring-1 ring-rose/25">
                {mapError}
              </p>
            ) : null}

            {mapData ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <CompetitorMap data={mapData} />
                  <p className="mt-2 text-[11px] text-mist/50">
                    Centred on {mapData.placeLabel} · {mapData.competitors.length} matching
                    business{mapData.competitors.length === 1 ? "" : "es"} found within{" "}
                    {mapData.radiusKm} km (Google Maps data).
                  </p>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  <p className="text-[10px] uppercase tracking-wider text-amber">
                    Competitors ({mapData.competitors.length})
                  </p>
                  {mapData.competitors.length === 0 ? (
                    <p className="text-xs text-mist/60">
                      No listed competitors found in this radius — treat as an unserved pocket, or
                      widen the radius.
                    </p>
                  ) : (
                    mapData.competitors.map((c) => (
                      <div key={c.id} className="rounded-[10px] bg-ink/40 p-3 ring-1 ring-line">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-white/90">{c.name}</p>
                          <span className="shrink-0 text-[11px] text-amber">{c.distanceKm} km</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-mist/60">{c.address}</p>
                        {c.rating ? (
                          <p className="mt-1 text-[11px] text-mist/70">
                            ★ {c.rating} · {c.reviews ?? 0} reviews
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}

                  <p className="pt-2 text-[10px] uppercase tracking-wider text-glow">
                    Suppliers ({mapData.suppliers.length})
                  </p>
                  {mapData.suppliers.length === 0 ? (
                    <p className="text-xs text-mist/60">
                      No listed suppliers nearby — plan for sourcing from the district town.
                    </p>
                  ) : (
                    mapData.suppliers.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-[10px] bg-ink/40 p-3 ring-1 ring-glow/25"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-white/90">{s.name}</p>
                          <span className="shrink-0 text-[11px] text-glow">{s.distanceKm} km</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-mist/60">{s.address}</p>
                        <button
                          type="button"
                          onClick={() => set("supplierDistanceKm", Math.round(s.distanceKm))}
                          className="mt-2 rounded-[8px] px-2 py-1 text-[10px] uppercase tracking-wider text-glow ring-1 ring-glow/30 transition-colors hover:bg-glow/10"
                        >
                          Use {Math.round(s.distanceKm)} km in scoring
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-mist/60">
                Press “Scan area” to plot real businesses in the same category around{" "}
                {inputs.village}, {inputs.district}.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
