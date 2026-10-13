import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, signal } from '@angular/core';
import { MarketScenario, PayoffStrategy, STRATEGIES, StrategyComparison } from '../../../core/models/strategy.models';
import { CrossoverChartComponent } from '../strategy-charts/crossover-chart.component';
import { NetWorthChartComponent, NetWorthView } from '../strategy-charts/net-worth-chart.component';
import { monthOf, pct, signedUsd, usd } from '../../../core/formatting/format';
import { closeness, crossover, facts, recommendation, scenarioLabel } from '../strategy-text';

/** The years the milestone table shows. */
export const MILESTONES = [5, 10, 15, 30] as const;

const SCENARIOS: readonly MarketScenario[] = ['riskAdjusted', 'expected', 'badDecade'];

/** The detail views, one shown at a time so the page stays readable. */
export type DetailTab = 'overTime' | 'milestones' | 'crossover' | 'why';

export const DETAIL_TABS: readonly { value: DetailTab; label: string }[] = [
  { value: 'overTime', label: 'Over time' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'crossover', label: 'Debt vs. investments' },
  { value: 'why', label: 'Why' },
];

/**
 * Presentational: the answer first (the recommended path, and what could reverse it), then one card per
 * strategy, then the details behind tabs: the difference over time, the milestones, debt against
 * investments, and the reasons.
 */
@Component({
  selector: 'app-strategy-results',
  imports: [NetWorthChartComponent, CrossoverChartComponent],
  templateUrl: './strategy-results.component.html',
  styleUrl: './strategy-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyResultsComponent {
  /** The comparison to show. */
  readonly result = input.required<StrategyComparison>();

  /** The market path the cards, charts and table show. Strategies are ranked on the risk-adjusted one. */
  readonly scenario = signal<MarketScenario>('riskAdjusted');

  /** The detail view shown. */
  readonly tab = signal<DetailTab>('overTime');

  /** True to show net worth in today's dollars, everywhere below the scenario picker. */
  readonly todaysDollars = signal(false);

  /**
   * Each strategy's lead over paying off first, or net worth itself. The difference comes first: most of net
   * worth is the same in every strategy, so the totals alone look identical.
   */
  readonly view = signal<NetWorthView>('gap');

  /** The strategy the debt-vs-investments chart shows; follows the recommendation until the user picks another. */
  readonly crossoverStrategy = linkedSignal<PayoffStrategy>(() => this.result().recommended);

  protected readonly tabs = DETAIL_TABS;
  protected readonly views: readonly { value: NetWorthView; label: string }[] = [
    { value: 'gap', label: 'Difference' },
    { value: 'total', label: 'Net worth' },
  ];
  protected readonly milestones = MILESTONES;
  protected readonly strategies = STRATEGIES;
  protected readonly usd = usd;
  protected readonly signedUsd = signedUsd;

  readonly recommendation = computed(() => recommendation(this.result()));
  readonly facts = computed(() => facts(this.result()));
  readonly closeness = computed(() => closeness(this.result(), this.scenario(), this.todaysDollars()));
  readonly scenarioLabels = computed(() => SCENARIOS.map((s) => ({ value: s, label: scenarioLabel(this.result(), s) })));

  /** One card per strategy, in the chosen scenario and dollars, led by how far each ends behind the leader. */
  readonly cards = computed(() => {
    const result = this.result();
    const scenario = this.scenario();
    const real = this.todaysDollars();
    const finals = result.strategies.map((o) => {
      const last = o[scenario].years[o[scenario].years.length - 1];
      return real ? last.netWorthInTodaysDollars : last.netWorth;
    });
    const best = Math.max(...finals);
    const leader = result.strategies[finals.indexOf(best)].strategy;
    return result.strategies.map((o, i) => {
      const projection = o[scenario];
      const behind = best - finals[i];
      return {
        strategy: o.strategy,
        recommended: o.strategy === result.recommended,
        split: o.investPercent === 0 ? 'All extra cash to the mortgage'
          : o.investPercent === 100 ? 'All extra cash invested'
            : `${pct(o.investPercent)} invested, ${pct(100 - o.investPercent)} to the mortgage`,
        leads: Math.round(behind) === 0,
        standing: Math.round(behind) === 0 ? 'Highest after 30 years' : `${usd(behind)} behind ${STRATEGIES[leader].short}`,
        netWorth: finals[i],
        payoff: projection.payoffDate ? `mortgage-free ${monthOf(projection.payoffDate)}` : 'mortgage still owed at year 30',
      };
    });
  });

  /** Net worth at each milestone year: the best of each row marked, and each value's difference from paying off first. */
  readonly milestoneRows = computed(() => {
    const result = this.result();
    const scenario = this.scenario();
    const real = this.todaysDollars();
    return MILESTONES.map((year) => {
      const values = result.strategies.map((o) => {
        const y = o[scenario].years[year];
        return real ? y.netWorthInTodaysDollars : y.netWorth;
      });
      const best = Math.max(...values);
      return { year, cells: values.map((value, i) => ({ value, best: value === best, gap: i === 0 ? null : value - values[0] })) };
    });
  });

  /** The projection the debt-vs-investments chart shows. */
  readonly crossoverProjection = computed(() =>
    this.result().strategies.find((s) => s.strategy === this.crossoverStrategy())![this.scenario()]);

  /** The sentence under the debt-vs-investments chart. */
  readonly crossoverNote = computed(() => crossover(this.crossoverStrategy(), this.crossoverProjection()));
}
