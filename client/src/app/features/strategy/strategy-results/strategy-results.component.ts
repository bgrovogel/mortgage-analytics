import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, signal } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { MarketScenario, PayoffStrategy, STRATEGIES, StrategyComparison } from '../../../core/models/strategy.models';
import { CrossoverChartComponent } from '../strategy-charts/crossover-chart.component';
import { NetWorthChartComponent, NetWorthView } from '../strategy-charts/net-worth-chart.component';
import { closeness, crossover, facts, monthOf, pct, recommendation, scenarioLabel, signedUsd, usd } from '../strategy-text';

/** The years the milestone table shows. */
export const MILESTONES = [5, 10, 15, 30] as const;

const SCENARIOS: readonly MarketScenario[] = ['riskAdjusted', 'expected', 'badDecade'];

/**
 * Presentational: the recommended path first, in plain words and with what could reverse it; then each
 * strategy, net worth over time, the milestones, debt against wealth, and the reasons behind the answer.
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

  /** The market path the charts, cards and table show. Strategies are ranked on the risk-adjusted one. */
  readonly scenario = signal<MarketScenario>('riskAdjusted');

  /** True to show net worth in today's dollars. */
  readonly todaysDollars = signal(false);

  /**
   * Each strategy's lead over paying off first, or net worth itself. The difference comes first: most of net
   * worth is the same in every strategy, so the totals alone look identical.
   */
  readonly view = signal<NetWorthView>('gap');

  protected readonly views: readonly { value: NetWorthView; label: string }[] = [
    { value: 'gap', label: 'Difference' },
    { value: 'total', label: 'Net worth' },
  ];

  /** The strategy the debt-vs-wealth chart shows; follows the recommendation until the user picks another. */
  readonly crossoverStrategy = linkedSignal<PayoffStrategy>(() => this.result().recommended);

  protected readonly scenarios = SCENARIOS;
  protected readonly milestones = MILESTONES;
  protected readonly strategies = STRATEGIES;
  protected readonly usd = usd;
  protected readonly signedUsd = signedUsd;
  protected readonly pct = pct;
  protected readonly monthOf = monthOf;
  protected readonly months = formatMonths;

  readonly recommendation = computed(() => recommendation(this.result()));
  readonly facts = computed(() => facts(this.result()));
  readonly closeness = computed(() => closeness(this.result()));
  readonly scenarioLabels = computed(() => SCENARIOS.map((s) => ({ value: s, label: scenarioLabel(this.result(), s) })));

  /** One card per strategy, in the chosen scenario, with how far each is behind the leader. */
  readonly cards = computed(() => {
    const result = this.result();
    const scenario = this.scenario();
    const finals = result.strategies.map((o) => o[scenario].years[o[scenario].years.length - 1].netWorth);
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
        netWorth: finals[i],
        leads: Math.round(behind) === 0,
        standing: Math.round(behind) === 0 ? 'Highest after 30 years' : `${usd(behind)} behind ${STRATEGIES[leader].short}`,
        payoff: projection.payoffDate ? `Mortgage-free ${monthOf(projection.payoffDate)}` : 'Mortgage still owed after 30 years',
        interest: projection.totalInterest,
      };
    });
  });

  /** Net worth at each milestone year, per strategy: the best of each row marked, and each one's difference from paying off first. */
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

  /** Where each strategy's net worth sits after the last year: the home, what is still owed, and the investments. */
  readonly breakdown = computed(() => {
    const scenario = this.scenario();
    const last = this.result().strategies.map((o) => o[scenario].years[o[scenario].years.length - 1]);
    return [
      { label: 'Home value', values: last.map((y) => y.homeValue), total: false },
      { label: 'Mortgage still owed', values: last.map((y) => y.mortgageBalance), total: false },
      { label: 'Investments, after tax', values: last.map((y) => y.investments), total: false },
      { label: 'Net worth', values: last.map((y) => y.netWorth), total: true },
    ].map((row) => ({ ...row, same: row.values.every((v) => Math.round(v) === Math.round(row.values[0])) }));
  });

  /** The projection the debt-vs-wealth chart shows. */
  readonly crossoverProjection = computed(() =>
    this.result().strategies.find((s) => s.strategy === this.crossoverStrategy())![this.scenario()]);

  /** The sentence under the debt-vs-wealth chart. */
  readonly crossoverNote = computed(() => crossover(this.crossoverStrategy(), this.crossoverProjection()));
}
