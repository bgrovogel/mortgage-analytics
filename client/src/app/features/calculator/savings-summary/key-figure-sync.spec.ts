import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, User } from '../../../core/auth/auth.service';
import { KeyFigureSync, SYNC_DELAY_MS } from './key-figure-sync';
import { KPI_STORAGE_KEY, KpiPreferences } from './kpi-preferences';

describe('KeyFigureSync', () => {
  const URL = '/api/v1/account/key-figures';
  const DEFAULT = { order: ['cash', 'payoff', 'afford', 'savings', 'pmi'], hidden: [] as string[] };
  let user: ReturnType<typeof signal<User | null>>;
  let http: HttpTestingController;
  let prefs: KpiPreferences;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.removeItem(KPI_STORAGE_KEY);
    user = signal<User | null>(null);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { user } }],
    });
    http = TestBed.inject(HttpTestingController);
    prefs = TestBed.inject(KpiPreferences);
    TestBed.inject(KeyFigureSync);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    jest.useRealTimers();
    localStorage.removeItem(KPI_STORAGE_KEY);
  });

  const signIn = () => {
    user.set({ email: 'a@example.com' });
    TestBed.tick();
  };
  const served = (body: { order: string[]; hidden: string[] }) => {
    http.expectOne({ method: 'GET', url: URL }).flush(body);
    TestBed.tick();
  };
  const later = () => {
    jest.advanceTimersByTime(SYNC_DELAY_MS + 1);
    TestBed.tick();
  };

  it('says nothing to the API while nobody is signed in, however the figures are arranged', () => {
    prefs.move('pmi', -1);
    TestBed.tick();
    later();

    http.expectNone(URL);
  });

  it('takes the arrangement the account has, on signing in', () => {
    signIn();

    served({ order: ['pmi', 'cash', 'payoff', 'afford', 'savings'], hidden: ['afford'] });

    expect(prefs.visible()).toEqual(['pmi', 'cash', 'payoff', 'savings']);
  });

  it('does not send back what it was just given', () => {
    signIn();
    served({ order: ['pmi', 'cash', 'payoff', 'afford', 'savings'], hidden: [] });

    later();

    http.expectNone({ method: 'PUT', url: URL });
  });

  it('gives the account the arrangement this device has, when the account has none', () => {
    prefs.toggle('afford');
    signIn();

    served({ order: [], hidden: [] });
    later();

    http.expectOne({ method: 'PUT', url: URL }).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('leaves the account alone when neither has an arrangement', () => {
    signIn();

    served({ order: [], hidden: [] });
    later();

    http.expectNone({ method: 'PUT', url: URL });
  });

  it('sends a change made while signed in, once things have settled, as the arrangement', () => {
    signIn();
    served({ order: [], hidden: [] });
    prefs.move('pmi', -1);
    TestBed.tick();
    prefs.toggle('cash');
    TestBed.tick();
    http.expectNone({ method: 'PUT', url: URL });

    later();

    const put = http.expectOne({ method: 'PUT', url: URL });
    expect(put.request.body).toEqual({ order: ['cash', 'payoff', 'afford', 'pmi', 'savings'], hidden: ['cash'] });
    put.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('keeps the figures as they are here when the account cannot be reached', () => {
    prefs.toggle('pmi');
    signIn();

    http.expectOne({ method: 'GET', url: URL }).flush('no', { status: 500, statusText: 'Server Error' });
    TestBed.tick();
    later();

    expect(prefs.arrangement()).toEqual({ order: DEFAULT.order, hidden: ['pmi'] });
    http.expectNone({ method: 'PUT', url: URL });
  });

  it('waits to hear from the account before sending anything, so an early change cannot overwrite it', () => {
    signIn();
    prefs.toggle('pmi'); // before the account has answered
    TestBed.tick();
    later();

    http.expectNone({ method: 'PUT', url: URL });
    served({ order: ['payoff', 'cash', 'afford', 'savings', 'pmi'], hidden: [] });
  });
});
