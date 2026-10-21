import { expect, test } from './fixtures';

// The reference loans start in the future: a first payment in the past would make them loans already being paid,
// whose extra payments start with the next payment instead of the first.

/** $250,000 home with 20% down: a $200,000 loan at 6%, whose reference values the unit tests verify. */
const TWENTY_PERCENT_DOWN = { homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2036-01-01' };

/** The same home with 5% down at 6.5%, which needs PMI. */
const FIVE_PERCENT_DOWN = { homePrice: 250_000, downPayment: 12_500, rate: 6.5, years: 30, firstPayment: '2036-01-01' };

test.describe('Mortgage calculator', () => {
  test('shows a worked example with taxes, insurance and PMI on first load', async ({ calculator, page }) => {
    await expect(calculator.breakdown, 'the breakdown starts with principal and interest').toContainText('Principal & interest');
    await expect(calculator.breakdown, 'the default example includes property tax, as one rate').toContainText('Property tax');
    await expect(calculator.breakdown, 'the default example has 9% down, so PMI').toContainText('PMI');
    // An average US purchase: $415,000 with 9% down at 6.25%, 0.9% property tax, $3,100 of insurance, $50 of HOA dues.
    // $377,650 borrowed: $2,325.26 of principal and interest, plus $311.25 + $258.33 + $157.35 + $50 = $3,102.19.
    await expect(calculator.totalMonthlyPayment, 'every cost of the average example, each month').toHaveText('$3,102.19');
    await expect(page.getByTestId('page-lead'), 'the page leads with the payment, under its question').toHaveText('$3,102.19 a month');
    await expect(page.getByTestId('page-answer'), 'and says what is behind it in a sentence')
      .toContainText('$2,325 goes to the loan and $777 to taxes, insurance and the rest. You would bring $48,129 to closing.');
    await expect(calculator.pmiEnd, 'the PMI end date is shown when PMI applies').toBeVisible();
    await expect(calculator.chart, 'the balance chart renders').toBeVisible();
    await calculator.showResults('schedule');
    await expect(calculator.scheduleRows.first(), 'the schedule table has rows').toBeVisible();
  });

  test('prices a half point more on the rate, and goes back to the rate as it is', async ({ calculator, page }) => {
    await expect(page.getByTestId('what-if-payment'), 'it starts at the example loan: $377,650 at 6.25%').toHaveText('$2,325.26/mo');

    await page.getByTestId('what-if-slider').fill('0.5');

    await expect(page.getByTestId('what-if-rate'), 'a half point above 6.25%').toHaveText('6.75%');
    await expect(page.getByTestId('what-if-payment'), 'the payment at that rate').toHaveText('$2,449.43/mo');
    await expect(page.getByTestId('what-if-payment-change'), 'and what it adds each month').toHaveText('+$124.17 a month');
    await expect(calculator.monthlyPayment, 'the loan itself is unchanged').toHaveText('$2,325.26');

    await page.getByTestId('what-if-reset').click();

    await expect(page.getByTestId('what-if-rate'), 'back to the loan as it is').toHaveText('6.25%');
  });

  test('keeps advanced options collapsed, each summarized in one line', async ({ calculator }) => {
    for (const id of ['section-loan', 'section-costs', 'section-closing', 'section-income', 'section-options', 'section-growth']) {
      await expect(calculator.section(id), `${id} should start closed`).not.toHaveAttribute('open');
    }
    await expect(calculator.sectionSummary('taxes-summary'), 'a closed section summarizes its values')
      .toHaveText('Tax 0.9% · Homestead');
    await expect(calculator.field('property-tax-rate'), 'fields inside a closed section are hidden').toBeHidden();

    await calculator.openSection('section-costs');

    await expect(calculator.field('property-tax-rate'), 'opening the section reveals its fields').toBeVisible();
  });

  // At 1100px the page links wrap onto a second line, making the header taller.
  for (const width of [1280, 1100]) {
    test(`the whole form is part of the page: no section hides in a box that scrolls on its own (${width}px)`, async ({ calculator, page }) => {
      await page.setViewportSize({ width, height: 800 });
      await calculator.openAllSections();

      const inner = await calculator.formPanel.evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(inner, 'the open form shows all of itself, rather than scrolling inside the page').toBeLessThanOrEqual(1);

      const last = calculator.section('section-options').locator('summary');
      await last.scrollIntoViewIfNeeded();
      await last.click();
      await expect(calculator.section('section-options'), 'the last section is reached by scrolling the page, and toggles').not.toHaveAttribute('open');
    });
  }

  test('a 2-1 buydown: lower payments for two years, its cost, and the same loan underneath', async ({ calculator, page }) => {
    // $375,000 with 5% down at 5.99%: the reference buydown in tools/rate-check/rate_model.py.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.chooseRateType('buydown');
    await calculator.calculate();

    const years = page.getByTestId('buydown-years').locator('tbody tr');
    await expect(years, 'every year: its rate, its principal and interest, and what the buydown pays that year').toHaveText([
      /Year 1\s*3\.99%.*\$1,698\.74 P&I\s*\$5,218\s*\$434\.87\/mo/,
      /Year 2\s*4\.99%.*\$1,910\.25 P&I\s*\$2,680\s*\$223\.36\/mo/,
      /From year 3\s*5\.99%.*\$2,133\.61 P&I\s*Nothing/,
    ]);
    await expect(page.getByTestId('buydown-years').locator('tfoot'), 'and the whole cost').toContainText('$7,899');
    await expect(page.getByTestId('buydown-cost'), 'what the subsidy costs').toContainText('$7,899');
    await expect(page.getByTestId('buydown-first-year'), 'the payment tile shows year 1, and where it ends up').toContainText(/In year 1, with the buydown; \$[\d,.]+ from year 3/);
  });

  test('cash to close: the down payment, the fees, prepaid interest and escrow from the loan, credits, and a buydown you pay for', async ({ calculator, page }) => {
    // The example's $4,000 + $1,000 of fees, 15 days of interest and 3 months of escrow, on the reference buydown loan
    // with a 2.2% tax, a $50,000 homestead exemption and $2,400 of insurance:
    // 356,250 × 5.99% ÷ 365 is $58.46 a day; (7,150 of tax + 2,400 of insurance) ÷ 12 is $795.83 a month.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.calculate();
    await calculator.showResults('closing');
    const lines = page.getByTestId('cash-to-close');
    const total = page.getByTestId('cash-to-close-total');

    await expect(lines.locator('tbody th'), 'each line, with how prepaid interest and escrow are worked out').toHaveText([
      'Down payment', 'Loan costs', 'Other fees', /Prepaid interest\s*15 days at \$58\.46/, /Homeowners insurance\s*the first year/,
      /Escrow deposit\s*3 months at \$795\.83/,
    ]);
    await expect(total, '18,750 + 5,000 + 876.90 + 2,400 + 2,387.49').toHaveText('$29,414.39');

    await calculator.set('closing-credits', 3_000);
    await calculator.calculate();
    await expect(total, 'credits come off').toHaveText('$26,414.39');

    await calculator.chooseRateType('buydown');
    await page.getByTestId('buydown-paid-by-you').check();
    await calculator.calculate();
    await expect(total, 'a 2-1 buydown you pay for is paid at closing: $7,898.76 more').toHaveText('$34,313.15');
  });

  test("a builder's offer against the most they may pay, which more down raises", async ({ calculator, page }) => {
    // The same $375,000 home with 5% down: on a conventional loan the seller may pay 3% of the price, $11,250. A 2-1
    // buydown they pay for ($7,898.76) and $5,000 of credits is $1,648.76 more, so only $3,351.24 of the credits count.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.set('closing-credits', 5_000);
    await calculator.chooseRateType('buydown');
    await calculator.calculate();
    await calculator.showResults('closing');

    await expect(page.getByTestId('concession-limit'), 'the limit, why, and what the builder offers')
      .toHaveText('A seller or builder may pay up to $11,250 of your costs: 3% of the price, with less than 10% down. Here they pay $12,899, with the buydown.');
    await expect(page.getByTestId('concessions-over'), 'what is over it')
      .toHaveText("That is $1,649 over the limit, which can't pay your costs: ask for it off the price instead.");
    await expect(page.getByTestId('cash-to-close-total'), '29,414.39 − 3,351.24 of credits').toHaveText('$26,063.15');
    await expect(page.getByTestId('concession-next'), 'what 10% down would allow').toHaveText('With $37,500 down (10%), it would be 6%: $22,500.');

    await calculator.set('down-payment', 37_500);
    await calculator.calculate();
    await expect(page.getByTestId('concessions-over'), 'with 10% down, the whole offer is allowed').toBeHidden();
  });

  test('an investment property: 15% down, a 2% seller limit, and no FHA, VA or homestead', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 37_500, rate: 6.75, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('closing-credits', 10_000);
    await calculator.setChecked('occupancy-InvestmentProperty', true);

    await expect(page.getByTestId('down-payment-error'), '10% down is not enough')
      .toHaveText('A conventional loan can be at most 85% of the price of an investment property: put at least 15% down.');
    await calculator.set('down-payment', 56_250);
    await calculator.calculate();
    await calculator.showResults('closing');
    await expect(page.getByTestId('concession-limit'), '2% of $375,000')
      .toContainText('A seller or builder may pay up to $7,500 of your costs: 2% of the price, for an investment property.');
    await expect(page.getByTestId('concession-next'), 'more down does not raise it').toBeHidden();

    await calculator.setChecked('program-fha', true);
    await expect(page.getByTestId('occupancy-error'), 'FHA is for a home you live in')
      .toHaveText('FHA and VA loans are only for a home you will live in.');
    await expect(calculator.field('is-homestead'), 'and so is a homestead').toBeDisabled();
  });

  test("the best use of a builder's money: off the price, toward closing, a 2-1 buydown or points", async ({ calculator, page }) => {
    // The same $375,000 home with 5% down at 5.99%, and a builder offering $10,000: within the 3% ($11,250) limit and
    // the closing costs, so every way can use all of it. Each is costed over the seven years the loan is kept
    // (tools/calculator-check models each way independently).
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.set('closing-credits', 10_000);
    await calculator.calculate();
    await calculator.showResults('closing');
    await page.getByTestId('open-seller-offer').click(); // the ways to take it are one step away, in a dialog

    const offer = page.getByTestId('seller-offer');
    await expect(offer.locator('thead th'), 'a column for each way, the cheapest marked')
      .toHaveText(['', 'Off the price', 'Toward closing', '2-1 buydown', 'Points Least']);
    await expect(offer.locator('tr', { hasText: 'Rate' }).locator('td'), 'points: $10,000 is 2.807 points, each a quarter off 5.99%')
      .toHaveText(['5.99%', '5.99%', '5.99%', '5.288% 2.807 points']);
    await expect(offer.locator('tfoot td'), 'the cash to close, seven years of payments and what is still owed')
      .toHaveText(['$606,432', '$612,608', '$612,608', '$605,063']);
    await expect(page.getByTestId('offer-best'), 'the way that costs the least')
      .toHaveText('Taking it as points costs the least: $1,369 less over 7 years than off the price, the next best.');
    await expect(page.getByTestId('offer-not-used'), 'all of the offer can pay costs').toBeHidden();

    // A lender that takes ⅜ of a point off for each point makes points cheaper still.
    await calculator.set('rate-cut-per-point', 0.375);
    await calculator.calculate();
    await expect(page.getByTestId('offer-best'), 'points win by more')
      .toHaveText('Taking it as points costs the least: $10,089 less over 7 years than off the price, the next best.');
  });

  test('an FHA loan: the upfront MIP borrowed, the annual MIP instead of PMI, and its end with the loan', async ({ calculator, page }) => {
    // $300,000 with FHA's 3.5% minimum down at 6.5%: $5,066.25 of upfront MIP makes the loan $294,566.25, and the
    // annual MIP is 0.55% for the whole term, $134.33 a month in year 1 (tools/calculator-check).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 10_500, rate: 6.5, years: 30, firstPayment: '2036-01-01' });
    await calculator.setChecked('program-fha', true);
    await calculator.calculate();

    await expect(calculator.monthlyPayment, 'principal and interest on the loan with its upfront MIP').toHaveText('$1,861.86');
    await expect(calculator.breakdownAmount('FHA MIP'), 'the annual MIP, named as such').toHaveText('$134.33');
    await expect(page.getByTestId('program-note'), 'what the loan program adds')
      .toHaveText('The 1.75% upfront MIP, $5,066.25, is added to the loan, so you borrow $294,566.25. The annual MIP is 0.55% of the balance, $134.33 a month in year 1, for the whole loan: with 10% or more down it would end after 11 years.');

    // The county: HUD's 2026 limit in Bexar County, Texas, is $557,750.
    await page.getByTestId('fha-state').selectOption('TX');
    await page.getByTestId('fha-county').selectOption('48029');
    await calculator.calculate();
    await expect(page.getByTestId('fha-limit'), 'the most FHA insures there').toHaveText("FHA's 2026 limit in Bexar County, TX: $557,750.");
    await expect(page.getByTestId('program-note'), 'and the results say it too').toContainText("FHA's 2026 limit in Bexar County, TX is $557,750.");

    await calculator.set('home-price', 600_000);
    await calculator.set('down-payment', 21_000);
    await expect(page.getByTestId('fha-over-limit'), 'a $579,000 loan is over it').toContainText('This loan, $579,000, is over it');
  });

  test('a VA loan: nothing down, the funding fee borrowed, and no mortgage insurance', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 400_000, downPayment: 0, rate: 6.5, years: 30, firstPayment: '2036-01-01' });
    await calculator.setChecked('program-va', true);
    await calculator.calculate();

    await expect(calculator.monthlyPayment, 'principal and interest on $408,600').toHaveText('$2,582.63');
    await expect(page.getByTestId('program-note'), 'a 2.15% first-use fee, and no mortgage insurance')
      .toHaveText('The 2.15% funding fee, $8,600.00, is added to the loan, so you borrow $408,600.00. There is no mortgage insurance, whatever the down payment.');
    await expect(calculator.breakdown, 'no PMI with nothing down').not.toContainText('PMI');
  });

  test('compares two homes side by side: Home B starts as a copy, and each keeps its own numbers', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 415_000, downPayment: 37_350, rate: 6.25, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.compareHomes();
    await calculator.calculate();
    await expect(page.getByTestId('compare-headline'), 'a copy costs the same').toHaveText('Home B costs the same a month, needs the same at closing, and costs the same over the first 5 years.');

    await calculator.editHome('B');
    await calculator.set('home-price', 450_000);
    await calculator.set('down-payment', 90_000);
    await calculator.calculate();

    await expect(page.getByTestId('compare-headline'), 'the second home, with 20% down and no PMI, costs less a month but more at closing')
      // $108.68 less principal and interest (on $17,650 less), $157.35 of PMI gone, $26.25 more property tax.
      .toHaveText('Home B costs $239.78 a month less, needs $52,683 more at closing, and costs $13,115 less over the first 5 years.');
    await calculator.editHome('A');
    await expect(calculator.field('home-price'), 'Home A is as it was').toHaveValue('415,000');
  });

  test('can you afford it: this home against income and debts, and the most each limit reaches', async ({ calculator, page }) => {
    // $375,000 with 5% down at 5.99%, and a household earning $120,000 a year with $500 of other debts.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.set('annual-income', 120_000);
    await calculator.set('monthly-debts', 500);
    await calculator.calculate();
    await calculator.showResults('affordability');

    await expect(page.getByTestId('afford-budget'), 'the most first, whatever home is in the form')
      .toHaveText('You could buy a home up to $333,595 and stay within the comfortable limits, or up to $485,133 at the most a conventional loan allows.');
    await expect(page.getByTestId('afford-intro'), 'the payment as a share of $10,000 a month')
      .toHaveText('This home’s payment, $3,128 a month with taxes, insurance and mortgage insurance, is 31.28% of your $10,000 monthly income, and 36.28% with your $500 of other debts.');
    await expect(page.getByTestId('afford-verdict'), 'past 28/36, within 45%')
      .toHaveText('This home is past the comfortable 28% and 36%, but within the most a conventional loan allows, 45%.');
    const rows = page.getByTestId('affordability').locator('tbody tr');
    await expect(rows.nth(0).locator('td'), 'comfortable: $2,800 for housing reaches $333,595').toHaveText(['28% · 36%', '$2,800', '$333,595', 'Past it']);
    await expect(rows.nth(1).locator('td'), 'conventional: 45% less the debts is $4,000').toHaveText(['45% in all', '$4,000', '$485,133', 'Fits']);

    // As an FHA loan, the upfront MIP borrowed and the annual MIP make it $3,167: past FHA's 31% for housing alone.
    await calculator.setChecked('program-fha', true);
    await calculator.calculate();
    await expect(page.getByTestId('afford-verdict'), 'FHA holds housing to 31%')
      .toHaveText('This home is past the most an FHA loan allows, 31% and 43%: a lender would not lend this much on this income.');
    await expect(rows.nth(1).locator('td'), 'FHA: 31% is $3,100').toHaveText(['31% · 43%', '$3,100', '$366,653', 'Past it']);
  });

  test('the key figures keep the order you gave them in your account, on another device', async ({ signedIn, account, page, browser }) => {
    // Signed in, on the calculator: put "when the mortgage insurance ends" first.
    expect(signedIn, 'the calculator is open, signed in').toBeTruthy();
    await page.getByTestId('arrange-rail').click();
    // Each move is saved on its own: wait for every one, or the other device could sign in before the last arrives.
    for (let i = 0; i < 4; i++) {
      const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/account/key-figures') && r.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Move When the mortgage insurance ends earlier' }).click();
      expect((await saved).ok(), `move ${i + 1} is sent to the account`).toBe(true);
    }

    // Another browser with nothing remembered: signing in brings the order with it.
    const other = await browser.newContext();
    const there = await other.newPage();
    await there.addInitScript(() => localStorage.setItem('first-visit-hints', '1'));
    await expect(await there.request.post('/api/v1/account/login?useCookies=true', { data: account }), 'signed in on the other device').toBeOK();
    await there.goto('/calculator');
    await there.getByTestId('arrange-rail').click();

    await expect(there.getByTestId('arrange-list').locator('li').first(), 'the insurance figure is first here too').toContainText('When the mortgage insurance ends');
    await other.close();
  });

  test('the balance chart can be read as a table, and back', async ({ calculator, page }) => {
    await expect(page.getByTestId('balance-chart'), 'the balance chart is drawn').toBeVisible();

    await page.getByTestId('balance-as-table').click();

    const table = page.getByTestId('balance-table');
    await expect(table.locator('tbody tr').first().locator('th'), 'the first row is the end of the first year of payments').toHaveText('Oct 2027 · payment 12');
    await expect(table.locator('thead th'), 'with extra payments, both balances and the interest are listed')
      .toHaveText(['After', 'With extra payments', 'Scheduled', 'Interest paid so far']);
    await expect(page.getByTestId('balance-chart'), 'the drawing makes way for the table').toHaveCount(0);

    await page.getByTestId('balance-as-table').click();

    await expect(page.getByTestId('balance-chart'), 'and comes back').toBeVisible();
    await expect(table, 'with the table gone').toHaveCount(0);
  });

  test('co-buyers: their income and debts count together, and who pays what is shown', async ({ calculator, page }) => {
    // The $415,000 example with 9% down: you earn $90,000 with $400 of debts, and a co-buyer $60,000 with $200, putting in 40% of the down payment.
    await calculator.set('annual-income', 90_000);
    await calculator.set('monthly-debts', 400);
    await page.getByTestId('add-co-buyer').click();
    await calculator.set('co-buyer-income', 60_000);
    await calculator.set('co-buyer-debts', 200);
    await calculator.set('co-buyer-share', 40);
    await calculator.calculate();
    await expect(page.getByTestId('income-summary'), 'the section counts both buyers').toHaveText('2 buyers · Income $150,000/yr · Debts $600/mo');
    await calculator.showResults('affordability');

    await expect(page.getByTestId('afford-intro'), 'the ratios are for the two of them together')
      .toContainText('of your combined $12,500 monthly income, and');
    const buyers = page.getByTestId('afford-buyers').locator('tbody tr, tfoot tr');
    await expect(buyers.nth(0).locator('th, td'), 'you put in the 60% the co-buyer leaves, and pay by income').toHaveText(['You', '$7,500', '$400', '60% · $22,410', /^\$[\d,]+$/]);
    await expect(buyers.nth(1).locator('th, td'), 'the co-buyer puts in 40%').toHaveText(['Co-buyer 1', '$5,000', '$200', '40% · $14,940', /^\$[\d,]+$/]);
    await expect(buyers.nth(2).locator('th, td'), 'together').toHaveText(['Together', '$12,500', '$600', '$37,350', /^\$[\d,]+$/]);

    await calculator.set('co-buyer-income', '');
    await expect(page.getByTestId('afford-buyers'), 'a co-buyer with no income is left out, so the buyer is alone again and the table goes').toHaveCount(0);
  });

  test('price a home at the most that stays comfortable: the home price follows, with the same share down', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.set('annual-income', 120_000);
    await calculator.set('monthly-debts', 500);
    await calculator.calculate();
    await calculator.showResults('affordability');

    await page.getByTestId('price-at-comfortable').click();

    await expect(calculator.field('home-price'), 'the most that stays comfortable, from the lender view').toHaveValue('333,595');
    await expect(page.getByTestId('afford-verdict'), 'and that home is within the comfortable limits')
      .toContainText('within the comfortable 28% and 36%');
  });

  test('starting from a budget: the most that could be bought, then switching back to a home in mind', async ({ calculator, page }) => {
    await calculator.set('annual-income', 150_000);
    await calculator.set('monthly-debts', 600);
    await calculator.calculate();
    await calculator.showResults('affordability');

    await expect(page.getByTestId('page-lead'), 'a home in mind: does it fit').toHaveText('Yes, comfortably');

    await page.getByText('My budget', { exact: true }).click();

    await expect(page.getByTestId('page-lead'), 'a budget: the most that could be bought').toHaveText(/\$[\d,]+ comfortably/);
    await expect(page.getByRole('heading', { name: 'How much house can you afford?' }), 'under its own question').toBeVisible();

    await page.getByText('A home in mind', { exact: true }).click();
    await expect(page.getByTestId('page-lead'), 'and back').toHaveText('Yes, comfortably');
  });

  test('undo takes back the last change to the numbers', async ({ calculator, page }) => {
    await calculator.set('home-price', 500_000);
    await expect(page.getByTestId('undo'), 'once the typing pauses, there is a change to take back').toBeVisible();

    await page.getByTestId('undo').click();

    await expect(calculator.field('home-price'), 'the price before it').toHaveValue('415,000');
    await expect(page.getByTestId('undo'), 'and nothing further to undo').toBeHidden();
  });

  test('saving up the cash to close: how long it takes at what you can put away', async ({ calculator, page }) => {
    await calculator.showResults('closing');

    await expect(page.getByTestId('saving-up-answer'), 'starts from $1,000 a month at 4%')
      .toContainText('At $1,000 a month, earning 4%, you would have $48,129 in 3 yr 9 mo.');

    await page.getByTestId('saved-so-far').fill('30000');

    await expect(page.getByTestId('saving-up-answer'), 'sooner with $30,000 already saved')
      .toContainText('you would have $48,129 in 1 yr');
  });

  test('a monthly budget: the highest price it reaches, with no income given', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('monthly-budget', 2_500);
    await calculator.calculate();
    await calculator.showResults('affordability');

    await expect(page.getByTestId('budget-answer'), 'what $2,500 a month reaches, keeping the 5% down')
      .toContainText('A payment of $2,500 a month, with taxes and insurance, reaches a home up to $');
    await expect(page.getByTestId('affordability-empty'), 'the lender view still asks for an income').toBeVisible();

    await calculator.set('monthly-budget', 1);
    await expect(page.getByTestId('budget-answer'), 'a budget no home can have a payment as low as')
      .toContainText('does not reach a home');
  });

  test('rent or buy: how long to stay for buying to come out ahead', async ({ calculator, page }) => {
    // $375,000 with 5% down at 5.99%, against renting a similar home for $2,400 a month, rising 3.5% a year.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('homestead-exemption', 50_000);
    await calculator.set('annual-insurance', 2_400);
    await calculator.calculate();
    await calculator.showResults('rent-or-buy');
    await expect(page.getByTestId('rent-or-buy-empty'), 'it asks for the rent first').toBeVisible();

    await page.getByTestId('monthly-rent').fill('2400');
    await calculator.calculate();
    await expect(page.getByTestId('rent-or-buy-verdict'), 'the year buying pulls ahead for good')
      .toHaveText('Buying comes out ahead if you stay 7 years or more; before that, renting leaves you better off.');
    const rows = page.getByTestId('rent-or-buy').locator('tbody tr');
    await expect(rows.nth(2).locator('td'), 'year 5: renting still ahead, its head start and savings growing at 7%')
      .toHaveText(['$44,083', '$33,049', '$103,627', '$112,196', 'Rent by $8,569']);
    await expect(rows.nth(3).locator('td'), `year 7: buying ahead, the equity outgrowing the renter's investments`)
      .toHaveText(['$45,672', '$35,403', '$154,031', '$151,407', 'Buy by $2,623']);
  });

  test('rent or buy: counting the federal tax owning saves, which only the ticked box brings in', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('property-tax-rate', 2.2);
    await calculator.set('annual-insurance', 2_400);
    await calculator.calculate();
    await calculator.showResults('rent-or-buy');
    await page.getByTestId('monthly-rent').fill('2400');
    await calculator.calculate();
    await expect(page.getByTestId('rent-or-buy-note'), 'tax is left out until asked for').not.toContainText('counts the federal tax');

    await page.getByTestId('count-tax').check();
    await page.getByTestId('filing-status').selectOption('MarriedFilingJointly');
    await page.getByTestId('other-deductions').fill('20000');
    await calculator.calculate();
    await expect(page.getByTestId('rent-or-buy-note'), 'the note says the saving is counted')
      .toContainText('counts the federal tax owning saves');
  });

  test('a state starts its rate, and where the rules are known, the cap and the exemption', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 500_000, downPayment: 100_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.openSection('section-costs');
    await page.getByTestId('state-tax-rate').selectOption('California');

    await expect(page.getByTestId('property-tax-rate'), 'a new buyer pays on the price').toHaveValue('1.1');
    await expect(page.getByTestId('assessment-cap'), 'Proposition 13 allows 2% a year').toHaveValue('2');
    await expect(page.getByTestId('homestead-exemption'), 'the homeowners exemption').toHaveValue('7,000');
    await expect(page.getByTestId('state-rules'), 'the note says why').toContainText('purchase price');

    await calculator.calculate();
    await calculator.showResults('projection');
    await expect(page.getByTestId('state-rules'), 'the form is still beside the results').toBeVisible();
  });

  test('a second loan instead of PMI: tried from Closing, weighed over the years kept, and the cheaper way named', async ({ calculator, page }) => {
    // $250,000 with 10% down at 6.5% pays PMI; a $25,000 second loan brings the first loan to 80% of the price.
    await calculator.fillLoan({ homePrice: 250_000, downPayment: 25_000, rate: 6.5, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.showResults('closing');
    await expect(page.getByTestId('second-loan-summary'), 'PMI is paid, so a way round it is offered')
      .toHaveText('Paying PMI? Compare it with a smaller first loan and a second loan for the rest.');

    await page.getByTestId('open-second-loan').click();
    await expect(page.getByTestId('try-second-loan'), 'the usual second loan, sized to reach 80%').toContainText('Try $25,000 at 8.5% for 15 years');
    await page.getByTestId('try-second-loan').click();

    const table = page.getByTestId('second-loan');
    await expect(table.locator('tbody tr').first().locator('td'), 'the first loan is $25,000 smaller').toHaveText(['$225,000', '$200,000']);
    await expect(table.locator('tbody tr').nth(1).locator('td'), 'and the second loan is the difference').toHaveText(['None', '$25,000']);
    await expect(page.getByTestId('second-loan-verdict'), 'it says which costs less over seven years').toContainText('Over 7 years');

    await page.getByTestId('second-loan-rate').fill('14');
    await expect(page.getByTestId('second-loan-verdict'), 'a dear second loan costs more than PMI').toContainText('more than paying PMI');
    await page.getByTestId('second-loan-stop').click();
    await expect(page.getByTestId('try-second-loan'), 'stopping goes back to the offer').toBeVisible();
  });

  test('as a rental: a rent measures the home as an investment, and the rent that breaks even carries the loan', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 400_000, downPayment: 80_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.showResults('rental');
    await expect(page.getByTestId('rental-empty'), 'it asks for the rent first').toBeVisible();

    await page.getByTestId('rental-rent').fill('2800');
    await expect(page.getByTestId('rental-stat-cap'), 'the cap rate is measured').toContainText('Cap rate');
    await expect(page.getByTestId('rental-stat-cash'), 'a $320,000 loan at 6% costs about $23,000 a year').toContainText('each month');
    await expect(page.getByTestId('rental-table').locator('tbody tr'), 'the milestone years').toHaveCount(9);
    await expect(page.getByTestId('rental-measures'), 'what rent breaks even').toContainText('Rent that breaks even');
  });

  test('as a rental: trying a rent fills the box and measures the home', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 400_000, downPayment: 80_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.showResults('rental');

    await page.getByTestId('try-rental-rent').click();

    await expect(page.getByTestId('rental-rent'), 'about 0.8% of $400,000').toHaveValue('3,200');
    await expect(page.getByTestId('rental-verdict'), 'a verdict is given').toBeVisible();
  });

  test('if you sell: what a sale would leave each year, after the loan, the costs and the tax on the gain', async ({ calculator, page }) => {
    // $375,000 with 5% down at 5.99%, the home rising 3% a year: sold after five years it leaves the buyer's equity, less 6%.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.set('home-value-growth', 3);
    await calculator.calculate();
    await calculator.showResults('sale');
    await expect(page.getByTestId('sale-stat-net'), 'a sale after five years leaves some money').toContainText('You walk away with');
    await expect(page.getByTestId('sale-breakdown'), 'from the price down to what is kept').toContainText('The home sells for');
    await expect(page.getByTestId('sale-stat-tax'), 'the gain is under the $250,000 exclusion').toContainText('$0');

    await page.getByTestId('sale-year').selectOption('1');
    await expect(page.getByTestId('sale-stat-gain'), 'after one year, 3% growth does not cover the 6% to sell')
      .toContainText('The loss');
    await expect(page.getByTestId('sale-stat-tax'), 'a loss is not taxed').toContainText('A loss is not taxed');
    await expect(page.getByTestId('sale-table').locator('tbody tr'), 'the milestone years').toHaveCount(9);
  });

  test('if you sell: a higher cost to sell leaves less', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 75_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.showResults('sale');
    const before = await page.getByTestId('sale-stat-net').locator('strong').innerText();

    await page.getByTestId('sale-costs').fill('10');
    await expect(page.getByTestId('sale-breakdown'), 'the costs are 10% now').toContainText('Selling costs (10%)');
    const after = await page.getByTestId('sale-stat-net').locator('strong').innerText();

    expect(Number(after.replace(/[^0-9.]/g, '')), `${after} is less than ${before}`).toBeLessThan(Number(before.replace(/[^0-9.]/g, '')));
  });

  test('compares up to four homes: the cheapest named, each measured against Home A, the best on each line shaded', async ({ calculator, page }) => {
    await calculator.fillLoan({ homePrice: 415_000, downPayment: 37_350, rate: 6.25, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.compareHomes();
    await calculator.editHome('B');
    await calculator.set('home-price', 450_000);
    await calculator.set('down-payment', 90_000);
    await calculator.addHome('C');
    await calculator.set('home-price', 380_000);
    await calculator.addHome('D');
    await calculator.set('interest-rate', 5.75);
    await calculator.calculate();

    const table = page.getByTestId('compare-table');
    await expect(table.locator('thead th'), 'a column for each home').toHaveText(['Home A', 'Home B', 'Home C', 'Home D']);
    await expect(page.getByTestId('add-home'), 'four is the most').toBeHidden();
    // Home C, $380,000 with the same $37,350 down, pays the least interest and nearly the least each month.
    await expect(page.getByTestId('compare-headline'), 'the cheapest over five years')
      .toHaveText('Home C costs the least over the first 5 years: $165 less than Home B, the next.');
    await expect(page.getByTestId('compare-each').locator('li'), 'each measured against Home A').toHaveText([
      'Home B costs $239.78 a month less, needs $52,683 more at closing, and costs $13,115 less over the first 5 years.',
      'Home C costs $256.34 a month less, needs $169 less at closing, and costs $13,279 less over the first 5 years.',
      'Home D costs $121.40 a month less, needs $78 less at closing, and costs $9,354 less over the first 5 years.',
    ]);
    await expect(table.locator('tr', { hasText: 'Monthly payment' }).locator('td.best'), 'the lowest payment is shaded, with its difference from Home A')
      .toHaveText(['$2,845.85 −$256.34']);
    await expect(table.locator('tr', { hasText: 'Equity after' }).locator('td.best'), 'and the most equity: Home B, with 20% down')
      .toHaveText(['$233,466 +$59,674']);

    await page.getByTestId('remove-home').click();
    await expect(table.locator('thead th'), 'Home D is gone').toHaveText(['Home A', 'Home B', 'Home C']);
    await expect(page.getByTestId('loan-heading'), 'and the form edits Home C').toHaveText('Home C');
  });

  test('discount points: what they cost, when they pay for themselves, and their line in the cash to close', async ({ calculator, page }) => {
    // The reference loan, $200,000 at 6%, bought down with one point from 6.25% (tools/calculator-check).
    await calculator.fillLoan({ homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.setChecked('use-points', true);
    await calculator.set('points', 1);
    await calculator.set('rate-without-points', 6.25);
    await calculator.calculate();

    await expect(page.getByTestId('points-summary').locator('li'), 'the payment without the point, then with it')
      .toHaveText([/Without points\s*6\.25%\s*\$1,231\.43\/mo/, /With 1 point\s*6%\s*\$1,199\.10\/mo/]);
    await expect(page.getByTestId('points-verdict'), 'it pays for itself by payment 48')
      .toContainText('1 point costs $2,000 at closing and lowers the payment $32.33 a month. The interest it saves covers that by payment 48 (Dec 2039)');
    await calculator.showResults('closing');
    await expect(page.getByTestId('cash-to-close'), 'and is paid at closing').toContainText('Discount points$2,000.00');
  });

  test('each buydown saves a different amount of interest when the seller pays, and none when you do', async ({ calculator, page }) => {
    // The same loan, with its $200 a month extra: the loan's interest is $316,575 whatever the buydown
    // (tools/calculator-check/calculator_model.py).
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.chooseRateType('buydown');
    await calculator.calculate();
    const note = page.getByTestId('interest-you-pay');

    await expect(calculator.totalInterest, 'the loan charges the same interest').toHaveText('$316,575');
    await expect(note, 'the seller pays by default, and a 2-1 pays $7,899 of it').toHaveText("The seller's buydown pays $7,899 of it, so you pay $308,676.");

    await page.getByTestId('buydown-plan').selectOption('3-2-1');
    await calculator.calculate();
    await expect(calculator.totalInterest, 'still the same loan underneath').toHaveText('$316,575');
    await expect(note, 'a 3-2-1 pays more of it').toHaveText("The seller's buydown pays $15,502 of it, so you pay $301,073.");

    await page.getByTestId('buydown-paid-by-you').check();
    await calculator.calculate();
    await expect(note, 'bought with your own money, it saves no interest').toHaveText('Your buydown, paid for at closing, lowers the early payments, not the interest.');
    await expect(page.getByTestId('buydown-cost'), 'it only moves your money earlier').toContainText('You pay $15,502 at closing');
  });

  test('a 7/1 adjustable rate: the reset, the new payment, and the worst case the caps allow', async ({ calculator, page }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.chooseRateType('arm');
    await calculator.set('arm-expected-rate', 7.5);
    await calculator.calculate();

    const plan = page.getByTestId('rate-plan');
    await expect(plan.locator('li'), 'seven years at 6%, then 7.5% re-amortized').toHaveText([
      /Jan 2036 to Dec 2042\s*6%\s*\$1,199\.10\/mo/, /From Jan 2043\s*7\.5%\s*\$1,365\.01\/mo/,
    ]);
    await expect(page.getByTestId('arm-worst-case'), '5/2/5 caps allow 11% at the first reset').toContainText('reaches 11% by Jan 2043 and the payment $1,787.42 a month');
  });

  test("an adjustable rate's margin is its floor: a falling rate stops there", async ({ calculator, page }) => {
    // 6% falling toward 2% within 2/2/5 caps: 4% at the first reset, then 2.75%, the margin, not 2%.
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.chooseRateType('arm');
    await calculator.set('arm-expected-rate', 2);
    await calculator.set('arm-initial-cap', 2);
    await calculator.set('arm-periodic-cap', 2);
    await calculator.calculate();

    await expect(page.getByTestId('rate-plan').locator('li'), 'down to the margin, and no further').toHaveText([
      /6%\s*\$1,199\.10\/mo/, /From Jan 2043\s*4%\s*\$994\.55\/mo/, /From Jan 2044\s*2\.75%\s*\$881\.34\/mo/,
    ]);
  });

  test('recalculates as you type, without a Calculate button', async ({ calculator }) => {
    await expect(calculator.calculateButton, 'there is no Calculate button any more').toHaveCount(0);

    await calculator.set('monthly-extra', 1_000);
    await calculator.calculate();

    await expect(calculator.timeSaved, 'a bigger extra payment saves more time').not.toHaveText('6 yr 1 mo');
  });

  test('takes the down payment as a percentage too', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.field('down-payment-mode-percent').check();

    await expect(calculator.field('down-payment'), '$50,000 of $250,000 converts to 20%').toHaveValue('20');
    await calculator.set('down-payment', 10);
    await calculator.calculate();

    await expect(calculator.field('loan-summary'), '10% of $250,000').toContainText('$25,000 down (10%)');
    await expect(calculator.monthlyPayment, '$225,000 at 6% over 30 years').toHaveText('$1,348.99');
  });

  test('without extra payments, leads with the total interest instead of a $0 saving', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.calculate();

    await expect(calculator.totalInterest, 'total interest on $200,000 at 6% over 30 years').toHaveText('$231,677');
    await expect(calculator.netSavings, 'no $0 savings headline').toBeHidden();
  });

  test('calculates interest savings for a recurring monthly extra payment', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(200);

    await calculator.calculate();

    await expect(calculator.monthlyPayment, '$200,000 at 6% over 30 years').toHaveText('$1,199.10');
    await expect(calculator.netSavings, 'interest saved by $200 a month').toHaveText('$79,801');
    await expect(calculator.timeSaved, '108 payments sooner').toHaveText('9 yr');
    await expect(calculator.payoffDate, 'payment 252').toHaveText('Dec 2056');
    await expect(calculator.totalInterest, 'the new total interest').toHaveText('$151,876');
    await calculator.showAllPayments();
    await expect(calculator.scheduleRows, 'one row per payment').toHaveCount(252);
  });

  test('adds housing costs to the monthly payment but never counts them as savings', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('local-tax-rate', 2.1);
    await calculator.set('monthly-hoa', 75);
    await calculator.setExtras(200);

    await calculator.calculate();

    await expect(calculator.totalMonthlyPayment, '$1,199.10 + $437.50 tax + $75 HOA').toHaveText('$1,711.60');
    await expect(calculator.breakdownTotal, 'the breakdown agrees with the headline').toHaveText('$1,711.60');
    await expect(calculator.netSavings, 'taxes and dues continue after payoff, so savings are interest only').toHaveText('$79,801');
  });

  test('PMI removal on request by default: extra payments end PMI sooner and count as savings', async ({ calculator }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('pmi-rate', 0.5);
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd, 'requested removal uses the actual balance: payment 62').toHaveText('Feb 2041');
    await expect(calculator.message('5 yr 2 mo sooner, instead of Apr 2046'), 'payment 62 instead of 124').toBeVisible();
    await expect(calculator.savingsDetail, 'the PMI saved is part of net savings').toContainText('+ $6,136 PMI');
    await expect(calculator.pmiOtherChoice, 'not asking would keep it to payment 135: $13,359.60 - $6,135.52 more')
      .toHaveText("If you don't ask, your servicer only has to remove it in Mar 2047, costing $7,224 more");
  });

  test('automatic PMI removal follows the original schedule, so extra payments do not move it', async ({ calculator }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('pmi-rate', 0.5);
    await calculator.choose('pmi-cancellation', 'Automatic');
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd, 'automatic removal stays at payment 135').toHaveText('Mar 2047');
    await expect(calculator.savingsDetail, 'so no PMI is saved: the savings are all interest, which the headline already says').toBeHidden();
    await expect(calculator.pmiOtherChoice, 'but asking at 80% would end it at payment 62, saving $13,359.60 - $6,135.52')
      .toHaveText('Ask your lender at 80%: ends Feb 2041, saving $7,224');
  });

  test('applies the Texas school homestead exemption only to a homestead', async ({ calculator }) => {
    // $300,000 home, 1% school rate: homestead taxes $160,000 ($133.33/mo); otherwise $300,000 ($250.00/mo).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'taxed on $160,000 as a homestead').toHaveText('$133.33');

    await calculator.setChecked('is-homestead', false);
    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'taxed on the full $300,000 otherwise').toHaveText('$250.00');
  });

  test('one property tax rate: the homestead exemption comes off the value, and the form says what it saves', async ({ calculator, page }) => {
    // $300,000 home at 2%: a homestead pays on $250,000 ($5,000 a year, $416.67 a month); without it, on all of it ($500.00).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('property-tax-rate', 2);
    await calculator.set('homestead-exemption', 50_000);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('Property tax'), 'taxed on $250,000 as a homestead').toHaveText('$416.67');
    await expect(page.getByTestId('homestead-savings'), 'the exemption saves 2% of $50,000').toHaveText('In year 1 the exemption saves $1,000 in tax.');

    await calculator.setChecked('is-homestead', false);
    await calculator.calculate();
    await expect(calculator.breakdownAmount('Property tax'), 'taxed on the full $300,000 otherwise').toHaveText('$500.00');
  });

  test('each homestead exemption lowers its own tax, and the form says what they save', async ({ calculator, page }) => {
    // $300,000 home: school 1% with $140,000 exempt; county/city 1% with 20% exempt; MUD 1% with 10% exempt.
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('local-tax-rate', 1);
    await calculator.set('mud-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);
    await calculator.set('local-exemption', 20);
    await calculator.set('mud-exemption', 10);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'school: taxed on $160,000').toHaveText('$133.33');
    await expect(calculator.breakdownAmount('County & city tax'), 'county/city: taxed on $240,000').toHaveText('$200.00');
    await expect(calculator.breakdownAmount('MUD tax'), 'MUD: taxed on $270,000').toHaveText('$225.00');
    await expect(page.getByTestId('homestead-savings'), 'the form sums up what the exemptions save')
      .toHaveText('In year 1 these save $2,300 in tax: school $1,400 · county/city $600 · MUD $300.');
  });

  test('over 65: adds the extra school exemption and freezes school tax', async ({ calculator }) => {
    // $300,000 home, 1% school rate: ($300,000 - $140,000 - $60,000) x 1% = $1,000 a year = $83.33 a month.
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);
    await calculator.set('home-value-growth', 10);
    await calculator.setChecked('is-over-65', true);
    await calculator.set('over-65-year', 1);
    await calculator.set('over-65-school-exemption', 60_000);

    await calculator.calculate();

    await expect(calculator.breakdownAmount('School tax'), '$140,000 + $60,000 exempt').toHaveText('$83.33');
    await calculator.showYearlyCosts();
    await expect(calculator.projectionNote, 'values rise 10% a year, but the ceiling holds the tax flat')
      .toContainText('go from $1,000 in year 1 to $1,000 in year 30');
  });

  test('projects yearly costs and shows the appraisal cap holding taxable value down', async ({ calculator }) => {
    await calculator.set('home-value-growth', 15);
    await calculator.set('assessment-cap', 10);
    await calculator.calculate();
    await calculator.showYearlyCosts();

    await expect(calculator.projectionChart, 'the projection chart renders').toBeVisible();
    await expect(calculator.projectionNote, 'the costs view summarizes the change').toContainText('Yearly taxes & costs go from');

    await calculator.showHomeValueProjection();
    await expect(calculator.homeValueNote, 'a 15% market against a 10% cap opens a gap').toContainText('the homestead cap keeps');
  });

  test('shows the equity growing, and the whole home yours once the loan is paid off', async ({ calculator, page }) => {
    // The reference loan, $200,000 of a $250,000 home at 6%, with the form's $200 a month extra: paid off after 252
    // payments, so nothing is owed from the start of year 22.
    await calculator.fillLoan({ homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    await calculator.showYearlyCosts();

    await expect(page.getByTestId('projection-chart-equity'), 'the equity chart renders').toBeVisible();
    await expect(page.getByTestId('projection-note-equity'), 'it starts with the down payment, and ends with the loan paid off')
      .toContainText(/^Your equity grows from \$50,000 \(the down payment\) to \$[\d,]+ by year 30\. The loan is paid off by year 22,/);
  });

  test('a tax rate change applies from its year: the quick numbers show the new tax', async ({ calculator, page }) => {
    // $250,000, not a homestead, no growth: 2% is $5,000 a year, cut to 1.5% ($3,750) from year 3.
    await calculator.fillLoan({ homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2036-01-01' });
    await calculator.clearHousingCosts();
    await calculator.set('property-tax-rate', 2);
    await calculator.setChecked('is-homestead', false);
    await calculator.set('home-value-growth', 0);
    await page.getByTestId('add-rate-change').click();
    await calculator.set('rate-change-year', 3);
    await calculator.set('rate-change-property', 1.5);
    await calculator.calculate();
    await expect(calculator.sectionSummary('taxes-summary'), 'the section counts it').toHaveText('Tax 2% · 1 rate change');

    await calculator.showResults('projection');
    const propertyTax = page.getByTestId('cost-totals').locator('tbody tr').filter({ hasText: 'Property tax' }).locator('td').first();
    await page.getByTestId('cost-totals-year').selectOption('2');
    await expect(propertyTax, 'year 2 at 2%').toHaveText('$5,000');
    await page.getByTestId('cost-totals-year').selectOption('3');
    await expect(propertyTax, 'year 3 at the new 1.5%').toHaveText('$3,750');
  });

  test('gives the quick numbers for any year, from the same figures as the chart', async ({ calculator, page }) => {
    // A fresh calculation, so the test has the very response the page shows.
    const answer = page.waitForResponse((r) => r.url().includes('/api/v1/amortization/calculate') && r.ok());
    await calculator.set('home-price', 400_000);
    const projection: { costs: { total: number } }[] = (await (await answer).json()).projection;
    await calculator.calculate();
    await calculator.showResults('projection');
    const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    const sum = (years: { costs: { total: number } }[]) => years.reduce((s, y) => s + y.costs.total, 0);
    const total = page.getByTestId('cost-totals-total');

    await page.getByTestId('cost-totals-year').selectOption('10');

    await expect(page.getByTestId('cost-totals').locator('thead th'), 'the year, everything through it, and the whole loan')
      .toHaveText(['Cost', /^Year 10 \(\d{4}\)$/, 'Through year 10', 'All 30 years']);
    await expect(total.locator('td').nth(0), "year 10's costs, and a month of them").toContainText(usd(projection[9].costs.total));
    await expect(total.locator('td').nth(1), 'years 1 to 10 added up').toHaveText(usd(sum(projection.slice(0, 10))));
    await expect(total.locator('td').nth(2), 'all 30 years added up').toHaveText(usd(sum(projection)));

    // A click on the chart (through the locator, which scrolls it into view) picks that year for the numbers.
    const chart = (await calculator.projectionChart.boundingBox())!;
    await calculator.projectionChart.click({ position: { x: chart.width / 2, y: chart.height / 2 } });
    await expect(page.getByTestId('cost-totals-year'), 'a year in the middle of the loan is picked').not.toHaveValue('10');
    const picked = await page.getByTestId('cost-totals-year').inputValue();
    await expect(page.getByTestId('cost-totals').locator('thead th').nth(2), 'and the numbers follow it').toHaveText(`Through year ${picked}`);
  });

  test('splits the results into tabs with their own URLs, and keeps the form as it was', async ({ calculator, page }) => {
    await calculator.set('home-price', 300_000);
    await calculator.calculate();
    await expect(page, 'the calculator opens on the overview').toHaveURL(/\/calculator\/overview$/);

    await calculator.showResults('projection');
    await expect(calculator.projectionChart, 'the projection tab shows the yearly costs').toBeVisible();
    await expect(calculator.chart, 'and not the overview charts').toHaveCount(0);
    await expect(calculator.field('home-price'), 'the form is unchanged').toHaveValue('300,000');

    await page.goBack();
    await expect(page, 'the back button returns to the overview').toHaveURL(/\/calculator\/overview$/);
    await expect(calculator.chart, 'with its balance chart').toBeVisible();
  });

  test('fits the result tabs without a scrollbar of their own', async ({ calculator, page }) => {
    await expect(calculator.results, 'the calculator is open').toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Results' });

    // Headless Chromium hides scrollbars, so check the cause: content taller than the strip, with
    // vertical scrolling allowed, is what puts up/down arrows next to the tabs on Windows.
    const canScrollVertically = await tabs.evaluate(
      (nav) => nav.scrollHeight > nav.clientHeight && getComputedStyle(nav).overflowY !== 'hidden');
    expect(canScrollVertically, 'the tab strip never scrolls up and down').toBe(false);
  });

  test('shows no PMI with 20% down', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.calculate();

    await expect(calculator.pmiHint, 'the form explains why there is no PMI').toContainText('No PMI');
    await expect(calculator.pmiEnd, 'and the PMI tile disappears').toBeHidden();
  });

  test('recasts after a qualifying lump sum: same payoff date, lower payment, fee charged', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(50_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts, 're-amortized over the remaining 348 months').toContainText('payment drops from $1,199.10 to $895.60');
    await expect(calculator.recasts, 'the lender fee is shown').toContainText('$250 fee');
    await expect(calculator.samePayoff, 'a recast keeps the payoff date').toHaveText('Same date: a recast lowers the payment instead');
    await calculator.showAllPayments();
    await expect(calculator.scheduleRows, 'all 360 payments remain').toHaveCount(360);
    await expect(await calculator.cell(12, 'Extra'), 'the triggering payment is tagged').toContainText('recast');
    await expect(await calculator.cell(13, 'Payment'), 'the next payment is the new amount').toHaveText('$895.60');
  });

  test('does not recast a lump sum below the lender minimum', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(9_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts, '$9,000 is below the $10,000 minimum').toBeHidden();
    await expect(await calculator.cell(13, 'Payment'), 'the payment is unchanged').toHaveText('$1,199.10');
    await calculator.showAllPayments();
    await expect(calculator.scheduleRows, 'the lump sum shortens the term instead').not.toHaveCount(360);
  });

  test('applies a lump sum on the chosen payment', async ({ calculator }) => {
    await calculator.fillLoan({ homePrice: 125_000, downPayment: 25_000, rate: 5, years: 15 });
    await calculator.setExtras(0);
    await calculator.addLumpSum(25_000, 12);

    await calculator.calculate();

    await expect(await calculator.cell(12, 'Extra'), 'the lump sum lands on payment 12').toHaveText('$25,000.00');
    await expect(await calculator.cell(11, 'Extra'), 'and nowhere else').toHaveText('—');
  });

  test('shows amounts with thousands separators, and the plain number while editing', async ({ calculator }) => {
    await calculator.set('home-price', 250000);
    await calculator.field('interest-rate').click(); // move on, as a user would

    await expect(calculator.field('home-price'), 'formatted once editing ends').toHaveValue('250,000');

    await calculator.field('home-price').click();
    await expect(calculator.field('home-price'), 'plain while editing, so the caret never jumps').toHaveValue('250000');
  });

  test('can roll the schedule up into one row per year', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.setExtras(0);
    await calculator.calculate();

    await calculator.showYearlySchedule();

    await expect(calculator.scheduleRows, 'a 30-year loan has 30 yearly rows').toHaveCount(30);
    await expect(await calculator.cell(1, 'Starts'), 'year 1 starts in 2036').toHaveText('2036');
    await expect(await calculator.cell(30, 'Balance'), 'the loan ends at zero').toHaveText('$0.00');
  });

  test('totals every cost over the whole schedule, and lets you add each as a column', async ({ calculator, page }) => {
    await calculator.showResults('schedule');
    const totals = page.getByTestId('lifetime-totals');
    await expect(totals, 'the lifetime totals include the tax').toContainText('Property tax');
    await expect(totals, 'what everything adds up to').toContainText('Everything paid');
    await expect(totals, 'and how much of the loan was repaid, extra payments included').toContainText('Loan repaid');
    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'categories start rolled up into Housing costs').toHaveCount(0);

    await page.getByTestId('column-picker').locator('summary').click();
    await page.getByRole('checkbox', { name: 'Property tax' }).check();

    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'the chosen column appears').toBeVisible();
    await calculator.showResults('overview');
    await calculator.showResults('schedule');
    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'and the choice is remembered').toBeVisible();
  });

  test('shows the payments a loan year at a time, and steps through the years', async ({ calculator, page }) => {
    await calculator.showResults('schedule');

    await expect(calculator.scheduleRows, 'a loan year is twelve payments').toHaveCount(12);
    await expect(page.getByTestId('page-caption'), 'says which payments these are').toContainText('Payments 1–12 of 291, loan year 1');

    await page.getByTestId('page-next').click();

    await expect(page.getByTestId('page-caption'), 'the next year').toContainText('Payments 13–24 of 291, loan year 2');
    await expect(await calculator.cell(13, 'Payment'), 'its first row is payment 13').toBeVisible();
  });

  test('can switch the table to the standard schedule', async ({ calculator }) => {
    await calculator.showStandardSchedule();
    await calculator.showAllPayments();

    await expect(calculator.scheduleRows, 'the standard schedule runs the full term').toHaveCount(360);
  });

  test('never sends invalid input to the API, and explains the problem', async ({ calculator }) => {
    const apiWasCalled = calculator.watchApiCalls();

    await calculator.set('interest-rate', 45);
    await calculator.set('down-payment', 500_000); // more than the $415,000 price

    await expect(calculator.formPanel.getByText('Interest rate must be between 0% and 30%.'), 'the rate error is shown on the field').toBeVisible();
    await expect(calculator.formPanel.getByText('The down payment must be less than the home price.'), 'the down payment error is shown').toBeVisible();
    await expect(calculator.staleResults.locator('li'), 'the results say they are for the last valid inputs, and why')
      .toHaveText(['Interest rate must be between 0% and 30%.', 'The down payment must be less than the home price.']);
    await calculator.waitPastRecalculationPause();
    expect(apiWasCalled(), 'invalid input must not reach the API').toBe(false);
  });

  test('shows server validation messages', async ({ calculator }) => {
    // The client rules mirror the server's, so a real 400 is hard to trigger from the UI.
    // Mock one to prove ProblemDetails responses reach the user.
    await calculator.rejectCalculationsWith({
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { 'extraPayments.lumpSums[0].amount': ["'Lump sum' cannot exceed the loan amount."] },
    });

    await calculator.set('monthly-extra', 250);

    await expect(calculator.errorSummary, 'the server message is shown to the user').toContainText("'Lump sum' cannot exceed the loan amount.");
  });

  test('recovers after a failed request', async ({ calculator, page }) => {
    await calculator.failNextCalculation();
    await calculator.set('monthly-extra', 250);
    await expect(calculator.errorSummary, 'a network failure is explained').toContainText("couldn't reach the server");

    await page.getByTestId('retry').click();

    await expect(calculator.errorSummary, 'trying again clears the error').toBeHidden();
    await expect(calculator.monthlyPayment, 'and results show again').toBeVisible();
  });
});

test.describe('On a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows the answer first, with the form out of the way until asked for', async ({ calculator }) => {
    await expect(calculator.headline, 'the headline numbers are on screen without scrolling').toBeInViewport();
    await expect(calculator.formPanel, 'the form is not in the way').toBeHidden();
  });

  test('one tap opens the form as a sheet over the answer, and Done gives the answer back', async ({ calculator, page }) => {
    await page.getByTestId('edit-inputs').click();

    await expect(calculator.formPanel, 'the form is brought into view').toBeInViewport();
    await expect(calculator.formPanel, 'and focus goes with it, for keyboard and screen-reader users').toBeFocused();
    await expect(page.getByTestId('sheet-lead'), 'the payment stays in view while editing').toContainText('a month');

    await calculator.set('home-price', 500_000);
    await expect(page.getByTestId('sheet-lead'), 'and follows what is typed').toContainText('$');

    await page.getByTestId('close-sheet').click();

    await expect(calculator.formPanel, 'the sheet closes').toBeHidden();
    await expect(calculator.headline, 'on the answer').toBeInViewport();
  });

  test('says the payment in the sheet is the last valid one while the form has something to fix', async ({ calculator, page }) => {
    await page.getByTestId('edit-inputs').click();
    await expect(calculator.formPanel, 'the sheet is open').toBeInViewport();
    await calculator.set('home-price', 0);

    await expect(page.getByTestId('sheet-lead'), 'not presented as the payment for the price now on screen').toContainText('Last valid: $3,102.19 a month');
    await expect(page.getByTestId('calc-status'), 'and the status says the same').toHaveText('Last valid numbers');

    await calculator.set('home-price', 415_000);

    await expect(page.getByTestId('sheet-lead'), 'fixed, it is the payment again').not.toContainText('Last valid');
  });

  test('the payments ledger under the balance chart fits without scrolling sideways', async ({ calculator, page }) => {
    await expect(calculator.headline, 'the page has loaded').toBeVisible();
    await page.getByTestId('ledger').scrollIntoViewIfNeeded();

    const { scroll, shown } = await page.getByTestId('ledger').evaluate((el) => ({ scroll: el.scrollWidth, shown: el.clientWidth }));

    expect(scroll, 'the date, principal, interest and balance are all in view').toBeLessThanOrEqual(shown + 1);
  });

  test('the rent-or-buy table shows what you would have, and who is ahead, without scrolling sideways', async ({ calculator, page }) => {
    await calculator.showResults('rent-or-buy');
    await calculator.set('monthly-rent', 2_700);
    await page.getByTestId('close-sheet').click();
    await expect(page.getByTestId('rent-or-buy'), 'the table is shown').toBeVisible();

    const { scroll, shown } = await page.getByTestId('rent-or-buy').evaluate((table) => {
      const wrap = table.closest('.table-wrap') as HTMLElement;
      return { scroll: wrap.scrollWidth, shown: wrap.clientWidth };
    });

    expect(scroll, 'the buy, rent and ahead columns are all in view').toBeLessThanOrEqual(shown + 1);
  });

  test('shows every page link, wrapping onto a second row rather than hiding past the edge', async ({ calculator, page }) => {
    await expect(calculator.headline, 'the page has loaded').toBeVisible();
    const links = page.getByRole('navigation', { name: 'Pages' }).getByRole('link');
    const header = await page.locator('.app-header').boundingBox();

    for (const link of await links.all()) {
      await expect(link, `${await link.textContent()} is on screen, not scrolled out of sight`).toBeInViewport({ ratio: 1 });
    }
    expect(header!.height, 'the name and Sign in, then the page links on at most two rows').toBeLessThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the page itself never scrolls sideways').toBeLessThanOrEqual(390);
  });

  test('hides the summary bar while the headline numbers are on screen', async ({ calculator }) => {
    await expect(calculator.headline, 'the headline is in view at the top').toBeInViewport();
    await expect(calculator.summaryBar, 'so the bar would only repeat it').toBeHidden();
  });

  test('keeps the payment and savings in view once the answer has scrolled away', async ({ calculator, page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(calculator.summaryBar, 'the summary bar shows on small screens').toBeVisible();
    await expect(calculator.summaryBar, 'it shows the monthly payment').toContainText('/mo');
    await expect(calculator.summaryBar, 'and the savings').toContainText('Net savings $');
    await expect(calculator.summaryBar, 'it stays pinned in view while the form scrolls').toBeInViewport();
  });
});

test('spaces the overview evenly: no empty row adds a second gap above the charts', async ({ calculator, page }) => {
  const headline = await calculator.headline.boundingBox();
  const whatIf = await page.getByTestId('rate-what-if').boundingBox();
  const charts = await page.locator('app-overview-tab app-balance-chart').boundingBox();

  expect(whatIf!.y - (headline!.y + headline!.height), 'one 1.25rem gap between the headline and the rate slider, for a fixed-rate loan')
    .toBeLessThanOrEqual(21);
  expect(charts!.y - (whatIf!.y + whatIf!.height), 'and one more between the slider and the charts, with no empty row in between')
    .toBeLessThanOrEqual(21);
});

test('hides the phone summary bar on a desktop, where the tiles are in view', async ({ calculator }) => {
  await expect(calculator.summaryBar, 'desktop shows the tiles instead').toBeHidden();
});

test('serves interactive API documentation', async ({ page }) => {
  await page.goto('/swagger');

  await expect(page.getByRole('heading', { name: /Mortgage Analytics API/ }), 'Swagger UI loads').toBeVisible();
  await expect(page.getByText('/api/v1/amortization/calculate'), 'the endpoint is listed').toBeVisible();
});

test('shows the arithmetic behind the payment, with the loan itself', async ({ calculator, page }) => {
  await expect(page.getByTestId('exact-chip'), 'the schedule is exact to the cent').toContainText('ends at $0.00');

  await page.getByTestId('show-math').click();

  const math = page.getByTestId('math');
  await expect(math, 'the formula').toContainText('payment = balance × r ÷ (1 − (1 + r)');
  await expect(math, 'with the example loan balance').toContainText('$377,650');
  await expect(math, 'and its payment').toContainText('$2,325.26');
  await page.keyboard.press('Escape');
  await expect(math, 'Escape closes it').toBeHidden();
  await expect(calculator.headline, 'back on the page').toBeVisible();
});
