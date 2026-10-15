import { TestBed } from '@angular/core/testing';
import { SchedulePage, SchedulePagerComponent } from './schedule-pager.component';

describe('SchedulePagerComponent', () => {
  const render = (page: SchedulePage, years = [1, 2, 3]) => {
    const fixture = TestBed.createComponent(SchedulePagerComponent);
    fixture.componentRef.setInput('years', years);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('caption', 'Payments 13–24 of 36, loan year 2');
    const asked: SchedulePage[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => asked.push(p));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
    return { root, asked, button, select: root.querySelector('[data-testid="page-year"]') as HTMLSelectElement };
  };

  it('says which payments are shown, and lists each year and then all of them', () => {
    const { root, select } = render(2);

    expect(root.querySelector('[data-testid="page-caption"]')!.textContent).toBe('Payments 13–24 of 36, loan year 2');
    expect([...select.options].map((o) => o.textContent!.trim())).toEqual(['Year 1', 'Year 2', 'Year 3', 'All payments']);
    expect(select.value).toBe('2');
  });

  it('asks for the year before or after', () => {
    const { button, asked } = render(2);

    button('page-previous').click();
    button('page-next').click();

    expect(asked).toEqual([1, 3]);
  });

  it('has nowhere to step from the first year back, or the last year on, or when it shows all of them', () => {
    expect([render(1).button('page-previous').disabled, render(1).button('page-next').disabled]).toEqual([true, false]);
    expect([render(3).button('page-previous').disabled, render(3).button('page-next').disabled]).toEqual([false, true]);
    expect([render('all').button('page-previous').disabled, render('all').button('page-next').disabled]).toEqual([true, true]);
  });

  it('asks for the year chosen, or all of them, and ignores anything else', () => {
    const { select, asked } = render(1);
    const choose = (value: string) => {
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };

    choose('3');
    choose('all');
    choose('');

    expect(asked).toEqual([3, 'all']);
  });
});
