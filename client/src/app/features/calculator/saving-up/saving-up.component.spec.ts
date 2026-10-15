import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SavingUpComponent } from './saving-up.component';

describe('SavingUpComponent', () => {
  let fixture: ComponentFixture<SavingUpComponent>;

  const render = (target = 48_128.79) => {
    fixture = TestBed.createComponent(SavingUpComponent);
    fixture.componentRef.setInput('target', target);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement.querySelector('[data-testid="saving-up-answer"]') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
  const set = (testId: string, value: number | null) => {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    input.value = value === null ? '' : String(value);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('starts from what a typical household might put away, and says how long it takes', () => {
    render();

    // $1,000 a month at 4% from nothing, toward $48,128.79.
    expect(text()).toMatch(/^At \$1,000 a month, earning 4%, you would have \$48,129 in \d yr( \d+ mo)?\.$/);
  });

  it('says how long, in years and months, for what was entered', () => {
    render(48_000);
    set('saved-so-far', 10_000);
    set('saved-monthly', 1_000);
    set('saved-rate', 0);

    expect(text()).toBe('At $1,000 a month, earning 0%, you would have $48,000 in 3 yr 2 mo.');
  });

  it('says so when the money is already saved', () => {
    render(48_000);
    set('saved-so-far', 50_000);

    expect(text()).toBe('You already have it: $50,000 saved covers the $48,000 to close.');
  });

  it('says so when it would take more than fifty years', () => {
    render(48_000);
    set('saved-monthly', 0);
    set('saved-rate', 0);

    expect(text()).toBe('Saving nothing a month, you would not get there in fifty years.');
  });

  it('asks for a figure instead of guessing when one is blank', () => {
    render();
    set('saved-monthly', null);

    expect(text()).toBe('Enter what you can save each month.');
  });
});
