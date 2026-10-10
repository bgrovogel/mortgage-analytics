import { buildLineChart, compactCurrency, currency, withAlpha } from './line-chart';

describe('buildLineChart', () => {
  const host = document.createElement('div');
  const spec = {
    labels: ['Year 1', 'Year 2'],
    series: [
      { label: 'Market value', color: '--series-1', data: [100, 110] },
      { label: 'Taxable value', color: '--series-2', data: [100, 105], dashed: true },
    ],
    title: (index: number, label: string) => `#${index} ${label}`,
    footer: (index: number) => `Total ${index}`,
  };

  // Chart.js callbacks are typed loosely; these helpers call them the way Chart.js would.
  const callbacks = () => buildLineChart(spec, host).options!.plugins!.tooltip!.callbacks! as unknown as Record<string, (items: unknown) => string>;

  it('creates one 2px line per series, without point markers', () => {
    const datasets = buildLineChart(spec, host).data.datasets;

    expect(datasets.map((d) => d.label)).toEqual(['Market value', 'Taxable value']);
    expect(datasets.every((d) => d.borderWidth === 2 && d.pointRadius === 0)).toBe(true);
  });

  it('dashes only the series marked dashed, so overlapping lines stay visible', () => {
    const [solid, dashed] = buildLineChart(spec, host).data.datasets;

    expect(solid.borderDash).toEqual([]);
    expect(dashed.borderDash).toEqual([6, 4]);
  });

  it('uses a crosshair tooltip over every series at once', () => {
    const interaction = buildLineChart(spec, host).options!.interaction!;

    expect(interaction.mode).toBe('index');
    expect(interaction.intersect).toBe(false);
  });

  it('builds tooltip text from the spec', () => {
    const { title, label, footer } = callbacks();

    expect(title([{ dataIndex: 1, label: 'Year 2' }])).toBe('#1 Year 2');
    expect(label({ dataset: { label: 'Market value' }, parsed: { y: 1234 } })).toBe(` Market value: ${currency.format(1234)}`);
    expect(label({ dataset: { label: 'Gap' }, parsed: { y: null } })).toBe(` Gap: ${currency.format(0)}`);
    expect(footer([{ dataIndex: 0 }])).toBe('Total 0');
  });

  it('draws plain lines by default', () => {
    const config = buildLineChart(spec, host);

    expect(config.options!.scales!['y']!.stacked).toBeFalsy();
    expect(config.data.datasets.every((d) => !d.fill)).toBe(true);
  });

  it('stacks filled areas when asked, so the top edge is the total', () => {
    const config = buildLineChart({ ...spec, stacked: true }, host);

    expect(config.options!.scales!['y']!.stacked).toBe(true);
    // Each band fills down to the one below it (not to $0), so bands never overlap and muddy each other.
    expect(config.data.datasets.map((d) => d.fill)).toEqual(['origin', '-1']);
  });

  it('can shade the area between a series and the one before it', () => {
    const config = buildLineChart(
      { ...spec, series: [spec.series[0], { ...spec.series[1], dashed: false, fillToPrevious: true }] },
      host,
    );

    expect(config.data.datasets[1].fill).toBe('-1');
    expect(config.data.datasets[0].fill).toBeFalsy();
  });

  it('omits the tooltip footer when the spec has none', () => {
    const config = buildLineChart({ ...spec, footer: undefined }, host);

    expect(config.options!.plugins!.tooltip!.callbacks!.footer).toBeUndefined();
  });

  it('formats the y-axis in compact currency on a single axis from zero', () => {
    const y = buildLineChart(spec, host).options!.scales!['y']!;
    const tick = (y.ticks as unknown as { callback: (v: number) => string }).callback;

    expect((y as { beginAtZero?: boolean }).beginAtZero).toBe(true);
    expect(tick(250_000)).toBe(compactCurrency.format(250_000));
  });
});

describe('withAlpha', () => {
  it('turns a hex colour into rgba with the given opacity', () => {
    expect(withAlpha('#2a78d6', 0.28)).toBe('rgba(42, 120, 214, 0.28)');
  });

  it('leaves anything that is not #rrggbb unchanged', () => {
    expect(withAlpha('', 0.5)).toBe('');
  });
});
