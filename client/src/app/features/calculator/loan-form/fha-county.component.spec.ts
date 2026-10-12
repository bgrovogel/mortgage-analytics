import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { FHA_LIMITS as LIMITS } from '../../../../testing/builders';
import { FhaLimitsService } from '../../../core/services/fha-limits.service';
import { FhaCountyComponent } from './fha-county.component';

describe('FhaCountyComponent', () => {
  let fixture: ComponentFixture<FhaCountyComponent>;
  let county: FormControl<string>;

  const render = (fips = '', loanAmount = 300_000) => {
    TestBed.configureTestingModule({ providers: [{ provide: FhaLimitsService, useValue: { limits: () => of(LIMITS) } }] });
    county = new FormControl(fips, { nonNullable: true });
    fixture = TestBed.createComponent(FhaCountyComponent);
    fixture.componentRef.setInput('county', county);
    fixture.componentRef.setInput('loanAmount', loanAmount);
    fixture.detectChanges();
  };
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const choose = (id: string, value: string) => {
    const select = el(id) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('lists the states, then the chosen state\'s counties', () => {
    render();

    choose('fha-state', 'TX');

    expect([...(el('fha-county') as HTMLSelectElement).options].map((o) => o.textContent!.trim())).toEqual(['Choose a county', 'Bexar County', 'Harris County']);
  });

  it("sets the county, and says the most FHA insures there", () => {
    render();
    choose('fha-state', 'TX');

    choose('fha-county', '48029');

    expect(county.value).toBe('48029');
    expect(el('fha-limit')!.textContent!.replace(/\s+/g, ' ').trim()).toBe("FHA's 2026 limit in Bexar County, TX: $557,750.");
  });

  it('warns when the loan is over the limit', () => {
    render('48029', 600_000);

    expect(el('fha-over-limit')!.textContent).toContain('This loan, $600,000, is over it: put more down, or choose another loan type.');
  });

  it('opens on the county a saved loan had, with its state', () => {
    render('12086');

    expect((el('fha-state') as HTMLSelectElement).value).toBe('FL');
    expect((el('fha-county') as HTMLSelectElement).value).toBe('12086');
  });

  it('changing the state clears the county', () => {
    render('48029');

    choose('fha-state', 'FL');

    expect(county.value).toBe('');
  });
});
