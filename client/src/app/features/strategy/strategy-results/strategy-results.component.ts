import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, signal } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { MarketScenario, PayoffStrategy, STRATEGIES, StrategyComparison } from '../../../core/models/strategy.models';
import { CrossoverChartComponent } from '../strategy-charts/crossover-chart.component';
import { NetWorthChartComponent, NetWorthView } from '../strategy-charts/net-worth-chart.component';
import { crossover, facts, monthOf, pct, recommendation, scenarioLabel, usd } from '../strategy-text';

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

  /** Net worth itself, or each strategy's lead over paying off first. */
  readonly view = signal<NetWorthView>('total');

  protected readonly views: readonly { value: NetWorthView; label: string }[] = [
    { value: 'total', label: 'Net worth' },
    { value: 'gap', label: 'Gap vs. Debt free ASAP' },
  ];

  /** The strategy the debt-vs-wealth chart shows; follows the recommendation until the user picks another. */
  readonly crossoverStrategy = linkedSignal<PayoffStrategy>(() => this.result().recommended);

  protected readonly scenarios = SCENARIOS;
  protected readonly milestones = MILESTONES;
  protected readonly strategies = STRATEGIES;
  protected readonly usd = usd;
  protected readonly pct = pct;
  protected readonly monthOf = monthOf;
  protected readonly months = formatMonths;

  readonly recommendation = computed(() => recommendation(this.result()));
  readonly facts = computed(() => facts(this.result()));
  readonly scenarioLabels = computed(() => SCENARIOS.map((s) => ({ value: s, label: scenarioLabel(this.result(), s) })));

  /** One card per strategy, in the chosen scenario. */
  readonly cards = computed(() => {
    const result = this.result();
    const scenario = this.scenario();
    return result.strategies.map((o) => {
      const projection = o[scenario];
      return {
        strategy: o.strategy,
        recommended: o.strategy === result.recommended,
        split: o.investPercent === 0 ? 'All extra cash to the mortgage'
          : o.investPercent === 100 ? 'All extra cash invested'
            : `${pct(o.investPercent)} invested, ${pct(100 - o.investPercent)} to the mortgage`,
        netWorth: projection.years[projection.years.length - 1].netWorth,
        payoff: projection.payoffDate ? `Mortgage-free ${monthOf(projection.payoffDate)}` : 'Mortgage still owed after 30 years',
        interest: projection.totalInterest,
      };
    });
  });

  /** Net worth at each milestone year, per strategy, with the best of each row marked. */
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
      return { year, cells: values.map((value) => ({ value, best: value === best })) };
    });
  });

  /** The projection the debt-vs-wealth chart shows. */
  readonly crossoverProjection = computed(() =>
    this.result().strategies.find((s) => s.strategy === this.crossoverStrategy())![this.scenario()]);

  /** The sentence under the debt-vs-wealth chart. */
  readonly crossoverNote = computed(() => crossover(this.crossoverStrategy(), this.crossoverProjection()));
}
