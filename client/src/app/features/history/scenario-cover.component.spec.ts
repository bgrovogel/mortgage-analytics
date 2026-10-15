import { TestBed } from '@angular/core/testing';
import { ScenarioCoverComponent, coverShares } from './scenario-cover.component';

describe('coverShares', () => {
  it('shows a purchase as what is put down against what is borrowed', () => {
    expect(coverShares({ kind: 'Purchase', price: 400_000, down: 80_000 })).toEqual([0.8, 0.2]);
  });

  it('shows a refinance as the old rate against the new, in proportion', () => {
    const [old, next] = coverShares({ kind: 'Refinance', currentRate: 7, newRate: 6 });

    expect(old).toBe(1);
    expect(next).toBeCloseTo(6 / 7, 5);
  });

  it('has nothing to show for a comparison that has no single set of figures', () => {
    expect(coverShares({ kind: 'Strategy' })).toEqual([]);
  });
});

describe('ScenarioCoverComponent', () => {
  const render = (shares: number[], figure: string | null) => {
    const fixture = TestBed.createComponent(ScenarioCoverComponent);
    fixture.componentRef.setInput('shares', shares);
    fixture.componentRef.setInput('figure', figure);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('is a small decorative picture: a bar for each share, and the leading amount in serif', () => {
    const root = render([0.8, 0.2], '$2,251.74 a month, principal and interest');

    expect(root.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('rect.bar')).toHaveLength(2);
    expect(root.querySelector('text')!.textContent).toBe('$2,252');
  });

  it('says the amount as it was given when it is masked, so the picture hides what the card hides', () => {
    const root = render([0.8, 0.2], '$•,•••.•• a month, principal and interest');

    expect(root.querySelector('text')!.textContent).toBe('$•,•••.••');
  });
});
