// Deterministic feasibility + financial engine.
// All math is computed here; no AI/hallucinated numbers.

export type CategoryKey =
  | "dairy"
  | "poultry"
  | "kirana"
  | "flourmill"
  | "tailoring"
  | "teastall";

export interface Category {
  key: CategoryKey;
  label: string;
  /** base local demand strength 0-100 */
  demandBase: number;
  /** typical competing units per 10,000 residents */
  competitorsPer10k: number;
  /** typical total project cost multiplier over monthly revenue */
  costFactor: number;
  /** seasonality / input-price volatility 0-100 (higher = riskier) */
  volatility: number;
  /** unit label + reference cost per unit (₹) */
  unit: string;
  unitCost: number;
  /** required own margin as share of project cost under most schemes */
  seasonal: string;
}

export const CATEGORIES: Category[] = [
  { key: "dairy", label: "Dairy & milk collection", demandBase: 84, competitorsPer10k: 6, costFactor: 9, volatility: 46, unit: "litre", unitCost: 38, seasonal: "Feed cost peaks Jun–Sep" },
  { key: "poultry", label: "Poultry & egg unit", demandBase: 80, competitorsPer10k: 4, costFactor: 11, volatility: 58, unit: "dozen", unitCost: 34, seasonal: "Disease + feed inflation risk" },
  { key: "kirana", label: "Kirana / general store", demandBase: 88, competitorsPer10k: 14, costFactor: 6, volatility: 24, unit: "basket", unitCost: 210, seasonal: "Stable year-round" },
  { key: "flourmill", label: "Flour mill / atta chakki", demandBase: 74, competitorsPer10k: 5, costFactor: 8, volatility: 30, unit: "quintal", unitCost: 2450, seasonal: "Peaks post-harvest" },
  { key: "tailoring", label: "Tailoring & garment unit", demandBase: 68, competitorsPer10k: 9, costFactor: 5, volatility: 34, unit: "piece", unitCost: 180, seasonal: "Festival-led demand" },
  { key: "teastall", label: "Tea stall & snacks", demandBase: 82, competitorsPer10k: 18, costFactor: 4, volatility: 28, unit: "cup", unitCost: 6, seasonal: "Stable, weather sensitive" },
];

export type Density = "village" | "block" | "town";

export const DENSITIES: { key: Density; label: string; population: number; access: number }[] = [
  { key: "village", label: "Village (gram panchayat)", population: 5200, access: 58 },
  { key: "block", label: "Block headquarters", population: 24000, access: 76 },
  { key: "town", label: "District town", population: 92000, access: 88 },
];

export interface Inputs {
  village: string;
  block: string;
  district: string;
  category: CategoryKey;
  density: Density;
  capital: number;
  revenue: number;
  operatingCost: number;
  supplierDistanceKm: number;
}

export const DEFAULT_INPUTS: Inputs = {
  village: "Rampur",
  block: "Baripada",
  district: "Mayurbhanj",
  category: "poultry",
  density: "village",
  capital: 240000,
  revenue: 48000,
  operatingCost: 31200,
  supplierDistanceKm: 12,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export interface FactorRow {
  label: string;
  weight: number;
  score: number;
  weighted: number;
  tone: "aurora" | "glow" | "amber" | "rose";
}

export interface Feasibility {
  category: Category;
  population: number;
  households: number;
  competitors: number;
  competitorsPer1000: number;
  demandScore: number;
  competitionScore: number;
  opportunityScore: number;
  profitScore: number;
  riskScore: number;
  riskSafety: number;
  factors: FactorRow[];
  total: number;
  band: string;
  surplus: number;
  marginPct: number;
  priceLow: number;
  priceHigh: number;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  verdict: string;
}

export function computeFeasibility(i: Inputs): Feasibility {
  const category: Category = CATEGORIES.find((c) => c.key === i.category) ?? CATEGORIES[0]!;
  const den = DENSITIES.find((d) => d.key === i.density) ?? DENSITIES[0]!;
  const population = den.population;
  const households = Math.round(population / 4.6);
  const competitors = Math.max(1, Math.round((population / 10000) * category.competitorsPer10k));
  const competitorsPer1000 = +((competitors / population) * 1000).toFixed(2);

  // Demand: base category pull adjusted by household depth.
  const demandScore = clamp(category.demandBase * (0.72 + Math.min(households / 6000, 0.42)));

  // Competition: fewer units per 1,000 residents = better.
  const competitionScore = clamp(100 - competitorsPer1000 * 55);

  // Profit potential from actual surplus margin.
  const surplus = i.revenue - i.operatingCost;
  const marginPct = i.revenue > 0 ? (surplus / i.revenue) * 100 : 0;
  const profitScore = clamp(marginPct * 2.4);

  // Risk: volatility + supplier distance + thin margin, converted to a safety score.
  const riskScore = clamp(
    category.volatility * 0.6 +
      Math.min(i.supplierDistanceKm, 60) * 0.55 +
      (marginPct < 20 ? 22 : marginPct < 30 ? 12 : 4),
  );
  const riskSafety = clamp(100 - riskScore);

  // Opportunity: unmet demand per competitor + location access.
  const demandPerCompetitor = population / competitors;
  const opportunityScore = clamp(
    Math.min(demandPerCompetitor / 45, 62) + den.access * 0.4,
  );

  const projectCost = Math.max(i.revenue * category.costFactor, i.capital);
  const capitalCoverage = projectCost > 0 ? (i.capital / projectCost) * 100 : 0;

  const rawFactors: Omit<FactorRow, "weighted">[] = [
    { label: "Market demand", weight: 25, score: Math.round(demandScore), tone: "aurora" },
    { label: "Opportunity gap", weight: 20, score: Math.round(opportunityScore), tone: "glow" },
    { label: "Profit potential", weight: 20, score: Math.round(profitScore), tone: "amber" },
    { label: "Risk safety (100 − risk)", weight: 20, score: Math.round(riskSafety), tone: "rose" },
    { label: "Competition level", weight: 15, score: Math.round(competitionScore), tone: "aurora" },
  ];
  const factors: FactorRow[] = rawFactors.map((f) => ({
    ...f,
    weighted: +((f.score * f.weight) / 100).toFixed(2),
  }));

  const total = +factors.reduce((s, f) => s + f.weighted, 0).toFixed(2);
  const band =
    total >= 80 ? "Excellent" : total >= 65 ? "Good" : total >= 50 ? "Moderate" : "Weak";

  // Recommended price band: unit cost + target margin, nudged by demand/competition.
  const pressure = (demandScore - competitionScore) / 400; // −0.25 … +0.25
  const priceLow = Math.round(category.unitCost * (1.16 + pressure) * 100) / 100;
  const priceHigh = Math.round(category.unitCost * (1.34 + pressure) * 100) / 100;

  const swot = {
    strengths: [
      `${households.toLocaleString("en-IN")} households within the ${den.label.toLowerCase()} catchment.`,
      marginPct >= 25
        ? `Operating surplus of ₹${Math.round(surplus).toLocaleString("en-IN")}/month (${marginPct.toFixed(0)}% margin).`
        : `Category demand index ${Math.round(demandScore)}/100 in this locality.`,
    ],
    weaknesses: [
      capitalCoverage < 25
        ? `Own margin covers only ${capitalCoverage.toFixed(0)}% of estimated project cost.`
        : `Working-capital buffer limited to ~${(i.capital / Math.max(i.operatingCost, 1)).toFixed(1)} months of operating cost.`,
      marginPct < 30 ? "Thin surplus leaves little cushion for EMI shocks." : "Scale limited by single-location operation.",
    ],
    opportunities: [
      `${competitors} competing unit${competitors === 1 ? "" : "s"} for ${population.toLocaleString("en-IN")} residents — ${competitorsPer1000} per 1,000.`,
      "Scheme-linked capital subsidy can reduce loan requirement materially.",
    ],
    threats: [
      `${category.seasonal}.`,
      i.supplierDistanceKm > 15
        ? `Supplier ${i.supplierDistanceKm} km away — logistics cost and stock-out risk.`
        : "New entrants attracted by the same demand gap.",
    ],
  };

  const verdict =
    total >= 65
      ? `Feasible in ${i.village}: demand and opportunity outweigh the ${Math.round(riskScore)}/100 risk load.`
      : total >= 50
        ? `Borderline in ${i.village}: proceed only with a larger buffer or lower operating cost.`
        : `Not advisable at these numbers in ${i.village}; revise cost, scale or category.`;

  return {
    category, population, households, competitors, competitorsPer1000,
    demandScore, competitionScore, opportunityScore, profitScore,
    riskScore, riskSafety, factors, total, band, surplus, marginPct,
    priceLow, priceHigh, swot, verdict,
  };
}

/* ---------------- Module 2: schemes + finance ---------------- */

export interface Scheme {
  code: string;
  name: string;
  authority: string;
  maxProjectCost: number;
  subsidyPct: number;
  contributionPct: number;
  interestRate: number;
  tenureMonths: number;
  moratoriumMonths: number;
  categories: CategoryKey[] | "all";
  note: string;
}

export const SCHEMES: Scheme[] = [
  { code: "PMEGP", name: "PMEGP (KVIC)", authority: "MoMSME / KVIC", maxProjectCost: 2500000, subsidyPct: 35, contributionPct: 5, interestRate: 11, tenureMonths: 84, moratoriumMonths: 6, categories: "all", note: "Rural, special category — 35% margin money subsidy" },
  { code: "NBCFDC", name: "NBCFDC Term Loan", authority: "MoSJE / NBCFDC", maxProjectCost: 1500000, subsidyPct: 0, contributionPct: 10, interestRate: 6, tenureMonths: 60, moratoriumMonths: 6, categories: "all", note: "Concessional credit for backward-class entrepreneurs" },
  { code: "MUDRA-K", name: "PM MUDRA — Kishor", authority: "MoF / SIDBI", maxProjectCost: 500000, subsidyPct: 0, contributionPct: 10, interestRate: 9.5, tenureMonths: 60, moratoriumMonths: 3, categories: "all", note: "Collateral-free loan ₹50k–₹5L" },
  { code: "NLM", name: "National Livestock Mission", authority: "DAHD", maxProjectCost: 5000000, subsidyPct: 50, contributionPct: 10, interestRate: 10, tenureMonths: 84, moratoriumMonths: 12, categories: ["poultry", "dairy"], note: "50% capital subsidy for poultry / dairy units" },
  { code: "AIF", name: "Agri Infrastructure Fund", authority: "MoA&FW", maxProjectCost: 20000000, subsidyPct: 0, contributionPct: 10, interestRate: 6, tenureMonths: 84, moratoriumMonths: 12, categories: ["dairy", "flourmill"], note: "3% interest subvention on post-harvest infra" },
];

export interface SchemeMatch {
  scheme: Scheme;
  fit: number;
  projectCost: number;
  subsidy: number;
  ownContribution: number;
  loan: number;
  emi: number;
  totalInterest: number;
  totalRepayment: number;
  dscr: number;
  riskBand: string;
  eligible: boolean;
  reason: string;
}

export function emiFor(principal: number, annualRate: number, months: number) {
  if (principal <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export function riskBandFor(dscr: number) {
  if (dscr >= 1.5) return "Low stress";
  if (dscr >= 1.2) return "Moderate stress";
  if (dscr >= 1.0) return "High stress";
  return "Very high stress";
}

export function routeSchemes(i: Inputs, f: Feasibility): SchemeMatch[] {
  const baseCost = Math.max(Math.round(i.revenue * f.category.costFactor), i.capital);

  return SCHEMES.map((scheme) => {
    const catOk = scheme.categories === "all" || scheme.categories.includes(i.category);
    const projectCost = Math.min(baseCost, scheme.maxProjectCost);
    const subsidy = Math.round((projectCost * scheme.subsidyPct) / 100);
    const requiredOwn = Math.round((projectCost * scheme.contributionPct) / 100);
    const ownContribution = Math.min(Math.max(i.capital, requiredOwn), projectCost - subsidy);
    const loan = Math.max(0, projectCost - subsidy - ownContribution);
    const emi = emiFor(loan, scheme.interestRate, scheme.tenureMonths);
    const totalRepayment = emi * scheme.tenureMonths;
    const totalInterest = totalRepayment - loan;
    const surplus = i.revenue - i.operatingCost;
    const dscr = emi > 0 ? surplus / emi : surplus > 0 ? 99 : 0;
    const capitalOk = i.capital >= requiredOwn;
    const costOk = baseCost <= scheme.maxProjectCost * 1.0001;
    const eligible = catOk && capitalOk;

    // Fit: category match, cost headroom, subsidy value, repayment comfort.
    let fit = 0;
    fit += catOk ? 34 : 0;
    fit += capitalOk ? 18 : 0;
    fit += costOk ? 14 : 6;
    fit += Math.min(scheme.subsidyPct / 2, 20);
    fit += Math.min(Math.max(dscr, 0) * 7, 14);
    fit = Math.round(Math.min(fit, 99));

    const reason = !catOk
      ? `Not open to ${f.category.label.toLowerCase()}`
      : !capitalOk
        ? `Needs ₹${requiredOwn.toLocaleString("en-IN")} own margin (${scheme.contributionPct}%)`
        : scheme.subsidyPct > 0
          ? `${scheme.subsidyPct}% subsidy · cap ₹${(scheme.maxProjectCost / 100000).toFixed(0)}L · ${scheme.interestRate}% p.a.`
          : `${scheme.interestRate}% p.a. · ${scheme.tenureMonths / 12} yr · cap ₹${(scheme.maxProjectCost / 100000).toFixed(0)}L`;

    return {
      scheme, fit, projectCost, subsidy, ownContribution, loan,
      emi: Math.round(emi), totalInterest: Math.round(totalInterest),
      totalRepayment: Math.round(totalRepayment),
      dscr: +dscr.toFixed(2), riskBand: riskBandFor(dscr), eligible, reason,
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.fit - a.fit);
}

export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
