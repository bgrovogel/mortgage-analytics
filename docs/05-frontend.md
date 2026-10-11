# 5. Frontend

An Angular 22 single-page app in `client/`. Standalone components, signals for state, RxJS for timing, typed
reactive forms, and `OnPush` everywhere.

## Folder map

```
client/src/app/
  app.routes.ts, app.config.ts, app.component.*      routes, providers, the shell (header, page tabs)
  core/                     used by every feature; knows nothing about any one page
    auth/                   AuthService (who is signed in, as a signal), signedInGuard, safe return URLs
    charts/                 buildLineChart, hostChart, the injectable ChartFactory
    errors/                 toErrorMessages: any HTTP failure → readable lines
    formatting/             format.ts (usd, pct, monthOf…), duration, describe-inputs (names for saved items)
    forms/                  FieldRule tables, app-number-field, the appNumber directive, setChanged
    layout/                 header-height and in-view directives
    loans/                  loan-progress: payments made, balance after n payments, the date helpers
    models/                 TypeScript mirrors of the API contracts
    services/               one thin HTTP service per API area
    state/                  latestRequest, CalculationStore (base class), SharedLoanStore
  shared/                   UI pieces several pages use
    calculation-page/       the layout every calculator page shares
    rate-options/           fixed / buydown / ARM controls, used by all three forms
    save-calculation/       the Save button and dialog
  features/                 one folder per page
    calculator/             page, store, loan-form (+ loan-form.model.ts, loan-fields.ts), result tabs and charts
    refinance/  strategy/   page, store, form (+ *-fields.ts), results
    history/                saved calculations: search, filter, open, rename, delete
    account/                sign in / up, confirm email, forgot / reset password, dev mailbox
    calculation-stores.ts   every page's store, for History and sign-out
client/e2e/                 Playwright specs, page objects and fixtures
```

## The patterns, one by one

### Standalone components + OnPush + signals

Every component is `standalone` (it lists its own `imports`) and uses `ChangeDetectionStrategy.OnPush`. State
lives in **signals**:

```ts
readonly loanAmount = computed(() => Math.max(0, (this.values().homePrice ?? 0) - this.downPaymentAmount()));
```

`computed` re-evaluates only when a signal it read changes, and the template re-renders only the parts that read
it. Inputs and outputs use the signal APIs (`input<T>()`, `output<T>()`). A form's values become a signal with
`toSignal(form.valueChanges, …)`.

### Container and presentational components

- **Pages** (`*-page.component.ts`) are containers: they inject the store and wire it to the children.
- **Forms and result components** are presentational: they take `input()`s and emit `output()`s, and know
  nothing about HTTP. That makes them easy to test (set inputs, check outputs).

### Stores: `CalculationStore` and its three subclasses

`core/state/calculation-store.ts` is an **abstract base class** holding everything a calculator page needs:

| Member | What it is |
|---|---|
| `request`, `result`, `errors`, `busy` | Signals: the latest inputs, the latest answer, the latest failure, "waiting" |
| `saved` | The saved calculation this page is linked to (so Save can update it in place) |
| `send(request)` | Queue a request (debounced, see below) and share its loan if the user changed it |
| `open(saved)` | Load a saved calculation of this page's kind |
| `loanToApply()` | The loan another page changed since this page last sent one |
| `savePayload`, `suggestedName` | Computed: what Save stores, and the name it suggests |

Each page's store (`CalculatorStore`, `RefinanceStore`, `StrategyStore`) says only what differs: `kind`, `route`,
`pageName`, how to call the API (`send$`), how to describe and name its inputs, and where its loan is (`loanOf`).
This is the **Template Method** pattern: the base class runs the algorithm, the subclasses fill in the steps.

The stores are `providedIn: 'root'`, so they live for the whole app: leave a page and come back, and its
numbers are still there.

`CalculationStores` (`features/calculation-stores.ts`) lists the three stores, so History can open, describe,
rename or unlink a saved item of any kind without a `switch` on its kind.

### Results as you type: `latestRequest`

`core/state/latest-request.ts`, used by every store:

```ts
queue.pipe(
  debounceTime(400),                               // wait for a pause in typing
  switchMap(({ request, id }) =>                   // cancel the previous request when a new one starts
    call(request).pipe(
      map((response) => ({ response, id })),
      catchError((error) => { errors.set(toErrorMessages(error)); settle(id); return EMPTY; }),  // per request
    )),
  takeUntilDestroyed(destroyRef),
)
```

Three details matter:
- **`switchMap`, not `mergeMap`**, so an old response can never overwrite a newer one.
- **`catchError` inside** the `switchMap`: if it were outside, the first error would end the stream and the page
  would stop updating.
- **Numbered requests:** `busy` clears only when the answer to the *latest* request arrives, not an older one.

### One loan, typed once: `SharedLoanStore`

`core/state/shared-loan.store.ts`. The three pages ask about the same mortgage, so its key facts are shared:

```ts
interface SharedLoan {
  balance: number; annualInterestRate: number; remainingTermInMonths: number;
  homeValue: number | null;          // when the page knows it
  start?: OriginalLoan | null;       // the loan as taken out, when known
  rate?: SharedRate | null;          // fixed, a buydown, or an ARM (its next reset counted from today)
}
```

- Each change gets a **version number**. A page remembers the last version it saw; `loanToApply()` returns the
  shared loan only if it's newer, and the form then fills itself from it and says where it came from.
- **Only a loan the user changes is shared** (or a saved one they open). Opening a page with its example never
  overwrites the user's loan.
- **No echo:** the calculator rounds the term to whole years. `matchesShared` recognises "this is the shared loan,
  as close as I can hold it", so the rounding doesn't get shared back to the other pages.
- **Merging:** a page that doesn't know the home's value, the original loan or the rate type keeps what was
  already shared instead of erasing it.

### Forms

**Typed reactive forms.** `NonNullableFormBuilder` gives every control a compile-time type. The calculator's form
lives in `loan-form.model.ts`: `loanForm(fb)` builds it with its defaults, `toLoanRequest()` turns it into the
API request, `restoreLoanForm()` fills it back from one. The component (`loan-form.component.ts`) keeps what the
page shows: the section summaries, the hints, the problems list.

**One rules table per form** (`loan-fields.ts`, `refinance-fields.ts`, `strategy-fields.ts`, plus
`RATE_OPTION_RULES`):

```ts
annualInterestRate: { label: 'Interest rate', unit: '%', min: 0, max: 30, decimals: 4 },
```

From that one line come the validators (`validatorsFor`), the message under the field ("Interest rate must be
between 0% and 30%."), the line in the "results are for your last valid inputs" notice (`problemsIn`), and the
box's `$` or `%`. The limits mirror the API's validator by hand; on Pay off or invest, an e2e test sends every
field at the edge of its range and checks that the form and the API agree.

**`app-number-field` + `appNumber`.** Every number box is one component. The `appNumber` directive is a
`ControlValueAccessor`: it shows "375,000" with the `$` inside the box, switches to "375000" while you edit,
selects the text on focus, and marks unreadable text invalid instead of reading it as 0.

**Collapsible sections with summaries.** Each `<details>` section shows a one-line summary when closed
("Tax 2.2% · Homestead $50,000 off"), and says "Check the values in this section" if a closed section holds an
invalid value, so a problem is never hidden.

**Only the active options are validated.** Switching "One tax rate" / "Separate taxes", or fixed / ARM, enables
one set of controls and disables the other. Disabled controls are neither validated nor sent.

**Every form follows the same lifecycle:**
1. `ngOnInit`: restore from `initial` (the store's last request or a saved one), then apply the shared loan,
   then send once.
2. While `restoring` is true, value changes update what the page shows but don't send requests.
3. After that, every change that leaves `canSend()` true emits a request.

### Rate options (`shared/rate-options/`)

Fixed, temporary buydown (1-0, 2-1, 3-2-1, 1-1), or ARM (5/1, 7/1, 10/1, 5/6, 7/6, 10/6, or other). One
`rateOptionsForm()` builder, one `app-rate-options` component, and helpers (`rateOptionsRequest`,
`setRateOptions`, `applySharedRate`, `rateSummary`) used by all three forms. An ARM is given either by its type
(a new loan: "7/1" means 84 payments fixed) or by the payments until its next reset (a loan already being paid).

### The shared page layout (`shared/calculation-page/`)

`<app-calculation-page>` gives every calculator page the same structure through **content projection**: the
form goes in the `form` slot, results in the default slot. It handles the header and Save, API errors, the
"results are for your last valid inputs" notice, and the placeholder before the first result. The form card is
capped to the window and scrolls on its own.

### Charts

`core/charts/line-chart.ts` builds every line chart's Chart.js configuration (`buildLineChart`), and
`hostChart` owns one chart per component: it rebuilds when inputs or the OS theme change and destroys it with the
component. Charts are created through an injected `ChartFactory`, so Jest tests (jsdom has no canvas) provide a
fake and assert on the configuration. Every chart has a written takeaway and a data table, and colors come from a
palette checked for colorblind safety in light and dark mode.

### Routing and auth

`app.routes.ts`: `/calculator` (with child routes `overview`, `projection`, `schedule`), `/refinance`,
`/strategy`, `/history` (behind `signedInGuard`), and the account pages (a focused layout without page tabs).
An app initializer asks the API who is signed in before the first navigation, so the guard already knows. The
guard redirects to `/sign-in?returnUrl=…`, and only same-site paths are accepted as return URLs (no open
redirect).

### Talking to the API

One service per area (`AmortizationApiService`, `RefinanceApiService`, `StrategyApiService`,
`SavedCalculationsApiService`, `AuthService`), each a thin wrapper over `HttpClient` with the URL and types.
Models in `core/models/` mirror the C# contracts by hand; the e2e consistency suite and the API tests keep them
honest.

## Testing the frontend

- **Jest + `TestBed`**: create a component, set inputs with `fixture.componentRef.setInput()`, change controls,
  and assert on emitted requests and rendered text (`data-testid` attributes). HTTP is tested with
  `HttpTestingController`; time with Jest fake timers (the 400 ms debounce).
- **Playwright** drives the real app in Chromium through **page objects** (`e2e/calculator.page.ts`,
  `history.page.ts`) and **fixtures** (`e2e/fixtures.ts`: each History test signs up a brand-new user and reads
  the confirmation email from the dev mailbox).

See [Testing and quality](07-testing.md) for the whole picture.
