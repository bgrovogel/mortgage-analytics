import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AccountExportService } from '../../core/services/account-export.service';
import { DataExportComponent } from './data-export.component';

describe('DataExportComponent', () => {
  let fixture: ComponentFixture<DataExportComponent>;
  let download: jest.Mock;

  beforeEach(() => {
    download = jest.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({ providers: [{ provide: AccountExportService, useValue: { download } }] });
    fixture = TestBed.createComponent(DataExportComponent);
    fixture.detectChanges();
  });

  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string) => el(testId)?.textContent?.replace(/\s+/g, ' ').trim();

  it('says what a download holds, and what it leaves out', () => {
    const intro = fixture.nativeElement.textContent.replace(/\s+/g, ' ');

    expect(intro).toContain('email');
    expect(intro).toContain('saved calculations');
    expect(intro).toContain('passkeys');
    expect(intro).toContain('never includes your password');
  });

  it('downloads the data, and says it has', () => {
    (el('data-download') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(download).toHaveBeenCalledTimes(1);
    expect(text('data-status')).toBe('Your data was downloaded.');
  });

  it('cannot be pressed again while it is on its way', () => {
    download.mockReturnValue(new Subject<void>());
    (el('data-download') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((el('data-download') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says why when the download fails', () => {
    download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { title: 'Something went wrong on our side.' } })));

    (el('data-download') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text('data-error')).toBe('Something went wrong on our side.');
    expect(el('data-status')).toBeNull();
  });
});
