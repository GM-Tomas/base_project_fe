// The projection as the API runs it (base_project_go: domain/service.simulate), for the mock: month by month,
// the portfolio earns the yield's monthly rate (yearly/12), then the month's contribution goes in; the
// contribution rises by contributionGrowthPct every 12 months, and inflation deflates each month into today's
// dollars. Without a raise it matches FV = P(1+r)ⁿ + PMT((1+r)ⁿ − 1)/r.

export interface SimulationInput {
  principal: number;
  contribution: number;
  yieldPct: number;
  years: number;
  contributionGrowthPct?: number;
  inflationPct?: number;
}

export interface ProjectedMonth {
  /** The portfolio. */
  value: number;
  /** The principal and every contribution so far. */
  contributed: number;
  /** What a dollar then is worth today: (1 + inflation/12)^month. */
  deflator: number;
}

/** years*12 + 1 months, month 0 (the principal) first. */
export function simulate({ principal, contribution, yieldPct, years, contributionGrowthPct = 0, inflationPct = 0 }: SimulationInput) {
  const rate = yieldPct / 100 / 12;
  const monthlyInflation = 1 + inflationPct / 100 / 12;
  const months: ProjectedMonth[] = [{ value: principal, contributed: principal, deflator: 1 }];
  let [value, contributed, deflator, payment] = [principal, principal, 1, contribution];
  for (let m = 1; m <= years * 12; m++) {
    if (m > 12 && (m - 1) % 12 === 0) payment *= 1 + contributionGrowthPct / 100; // a new year: the raise
    value = Math.max(0, value * (1 + rate) + payment);
    contributed += payment;
    deflator *= monthlyInflation;
    months.push({ value, contributed, deflator });
  }
  return months;
}
