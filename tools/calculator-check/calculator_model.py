"""
An independent model of the purchase calculator, written in Python Decimal from the rules (not translated from the
C# engine): the amortization schedule with extra payments, recasts and rate changes; temporary buydowns; PMI and its
two removal rules; property taxes (one combined rate, or school / county-city / MUD with their own exemptions, the
appraisal cap and over-65 relief); PID, insurance and HOA with yearly growth; the yearly projection; and the savings.

compare_with_api.py checks the live API against it.
"""
import os
import sys
import json
import pathlib
from datetime import date
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal as D, getcontext

# More precision than the engine's decimal: if the two disagree at the cent, it is the rules that differ.
getcontext().prec = 40

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'rate-check'))
from rate_model import arm_path  # noqa: E402  the independent ARM model

CENT = D('0.01')
CATEGORIES = ['schoolTax', 'localTax', 'mudTax', 'pidAssessment', 'homeownersInsurance', 'mortgageInsurance', 'hoaDues', 'propertyTax']


def money(x):
    """Rounds to cents, half away from zero, as US lenders do."""
    return D(x).quantize(CENT, rounding=ROUND_HALF_UP)


def payment(principal, annual_rate, n):
    """The level payment that repays `principal` over `n` months: M = P r (1+r)^n / ((1+r)^n - 1)."""
    r = D(annual_rate) / 1200
    if r == 0:
        return money(principal / n)
    g = (1 + r) ** n
    return money(principal * r * g / (g - 1))


def grow(amount, percent, years):
    """`amount` compounded by `percent` a year for whole `years`, to the cent."""
    return D(amount) if percent == 0 or years == 0 else money(D(amount) * (1 + D(percent) / 100) ** years)


def add_months(d, months):
    m = d.month - 1 + months
    return date(d.year + m // 12, m % 12 + 1, d.day)


def first_of_next_month(today):
    return add_months(date(today.year, today.month, 1), 1)


# ---------------------------------------------------------------------------------------------- the loan schedule

def amortize(principal, rate, term, changes=(), extra=lambda p: (D(0), D(0)), recast=None):
    """
    Month by month: re-amortize at a rate change; interest on the opening balance; principal is the payment less
    interest (the last month takes the whole balance); extra principal is capped at what is left; a single extra
    payment of at least the lender's minimum recasts the loan over the months left.
    `extra(p)` returns (the month's total extra, its largest single extra payment).
    """
    resets = dict(changes)
    pay = initial = payment(principal, rate, term)
    balance = principal
    rows, recasts, rate_changes = [], [], []
    for p in range(1, term + 1):
        if balance <= 0:
            break
        if p in resets and resets[p] != rate:
            new = payment(balance, resets[p], term - p + 1)
            rate_changes.append({'paymentNumber': p, 'previousRate': rate, 'newRate': resets[p], 'previousPayment': pay, 'newPayment': new})
            rate, pay = resets[p], new
        opening = balance
        interest = money(balance * rate / 1200)
        principal_paid = balance if p == term else min(pay - interest, balance)
        balance -= principal_paid
        total_extra, largest = extra(p)
        extra_paid = min(total_extra, balance)
        balance -= extra_paid
        rows.append({'p': p, 'opening': opening, 'interest': interest, 'principal': principal_paid, 'extra': extra_paid,
                     'balance': balance, 'rate': rate, 'scheduled': interest + principal_paid})
        if balance > 0 and recast and largest >= recast[0]:
            new = payment(balance, rate, term - p)
            recasts.append({'afterPaymentNumber': p, 'previousPayment': pay, 'newPayment': new, 'fee': recast[1]})
            pay = new
    return {'initial': initial, 'rows': rows, 'recasts': recasts, 'rateChanges': rate_changes}


def extras_of(request):
    """The month's extra principal, and its largest single payment (what a recast looks at)."""
    e = request.get('extraPayments') or {}
    monthly, start = D(str(e.get('monthlyAmount') or 0)), e.get('monthlyStartingPaymentNumber') or 1
    annual = e.get('annual')
    lumps = e.get('lumpSums') or []

    def extra(p):
        amounts = []
        if monthly > 0 and p >= start:
            amounts.append(monthly)
        if annual and p >= annual['firstPaymentNumber'] and (p - annual['firstPaymentNumber']) % 12 == 0:
            amounts.append(D(str(annual['amount'])))
        amounts += [D(str(l['amount'])) for l in lumps if l['paymentNumber'] == p]
        return (money(sum(amounts, D(0))), max(amounts, default=D(0)))
    return extra


# ---------------------------------------------------------------------------------------------- housing costs

def installment(annual, p):
    """Twelve installments that add up to the yearly bill: the twelfth takes what is left."""
    share = money(annual / 12)
    return annual - share * 11 if p % 12 == 0 else share


def taxable(assessed, amount=D(0), percent=D(0)):
    """Assessed value less a dollar exemption and a percentage one (at least $5,000, Texas Tax Code 11.13(n))."""
    pct = max(money(assessed * percent / 100), D(5000)) if percent > 0 else D(0)
    return max(D(0), assessed - pct - amount)


class Costs:
    """Every recurring cost of owning the home, by payment number, and the yearly projection."""

    def __init__(self, request, years, fha_mip=None):
        c = request.get('housingCosts')
        self.c = c
        # FHA and VA loans have no PMI: FHA's own MIP (any housing costs or none), or none at all for VA.
        self.government_mip = fha_mip
        price = D(str(request['homePrice']))
        loan = price - D(str(request['downPayment']))
        self.price, self.loan = price, loan
        if not c:
            self.market = self.assessed = [price] * years
            return
        num = lambda k: D(str(c.get(k) or 0))  # noqa: E731
        growth = num('homeValueGrowthRate')
        homestead = c.get('isHomestead')
        cap = num('homesteadAssessmentCap') if homestead else None
        self.market, self.assessed = [], []
        for y in range(years):
            m = grow(price, growth, y)
            a = m if y == 0 or cap is None else min(m, money(self.assessed[y - 1] * (1 + cap / 100)))
            self.market.append(m)
            self.assessed.append(a)

        senior = c.get('over65OrDisabled') if homestead else None
        z = D(0)
        changes = sorted(c.get('rateChanges') or [], key=lambda ch: ch['fromYear'])

        def schedule(key, first):
            """The rate by 0-based year: `first`, then each change to `key` from its year until the next."""
            steps = [(0, first)] + [(ch['fromYear'] - 1, D(str(ch[key]))) for ch in changes if ch.get(key) is not None]
            return lambda year: [rate for start, rate in steps if start <= year][-1]
        # A school ceiling brought from a former home keeps the share of tax paid there (Texas Tax Code 11.26(g)).
        share = D(str(senior['transferredCeilingPercent'])) / 100 if senior and senior.get('transferredCeilingPercent') else D(1)
        # Each tax: rate, its exemption (amount, percent), and over-65 relief (start year, extra, ceiling).
        self.taxes = {}
        if num('propertyTaxRate') > 0:
            self.taxes['propertyTax'] = (schedule('propertyTaxRate', num('propertyTaxRate')), (num('propertyTaxHomesteadExemption') if homestead else z, z), None)
        if num('schoolTaxRate') > 0:
            self.taxes['schoolTax'] = (schedule('schoolTaxRate', num('schoolTaxRate')), (num('schoolHomesteadExemption') if homestead else z, z),
                                       (senior['qualifiesInYear'] - 1, D(str(senior['schoolExemption'])), True, share) if senior else None)
        if num('localTaxRate') > 0:
            self.taxes['localTax'] = (schedule('localTaxRate', num('localTaxRate')), (z, num('localHomesteadExemptionPercent') if homestead else z),
                                      (senior['qualifiesInYear'] - 1, D(str(senior['localExemption'])), senior['localTaxCeiling'], D(1)) if senior else None)
        if num('mudTaxRate') > 0:
            self.taxes['mudTax'] = (schedule('mudTaxRate', num('mudTaxRate')), (z, num('mudHomesteadExemptionPercent') if homestead else z), None)

        pid = c.get('pid')
        self.pid = (D(str(pid['annualAssessment'])), pid.get('remainingYears')) if pid and pid['annualAssessment'] > 0 else None
        self.insurance = (num('annualHomeownersInsurance'), num('insuranceIncreaseRate'))
        self.hoa = (money(num('monthlyHoaDues')), num('hoaIncreaseRate'))
        rate = num('pmiRate')
        self.pmi_required = loan > price * 80 / 100
        self.pmi_premium = money(loan * rate / 100 / 12) if self.pmi_required and rate > 0 else D(0)
        self.pmi_by_request = c.get('pmiCancellation', 'BorrowerRequested') == 'BorrowerRequested'
        self.pmi_threshold = price * (80 if self.pmi_by_request else 78) / 100
        # The Homeowners Protection Act ends PMI at the loan's midpoint whatever the balance (rounded up for an odd term).
        self.pmi_last = (request['termInMonths'] + 1) // 2

    def taxable_value(self, category, year):
        rate, (amount, percent), senior = self.taxes[category]
        if senior and year >= senior[0]:
            amount += senior[1]
        return taxable(self.assessed[year], amount, percent)

    def tax(self, category, year):
        rate, (amount, percent), senior = self.taxes[category]
        # Each year's bill at that year's rate; a ceiling is the qualifying year's bill at its own rate (times the share
        # of a transferred ceiling).
        bill = lambda y, extra: money(taxable(self.assessed[y], amount + extra, percent) * rate(y) / 100)  # noqa: E731
        if not senior or year < senior[0]:
            return bill(year, D(0))
        start, extra, ceiling, share = senior
        return min(bill(year, extra), money(bill(start, extra) * share)) if ceiling else bill(year, extra)

    def for_payment(self, p, opening, scheduled_opening):
        """Each category's charge with payment `p`, given the actual and the original schedule's opening balance."""
        out = dict.fromkeys(CATEGORIES, D(0))
        if self.government_mip:
            out['mortgageInsurance'] = self.government_mip(p)
        if not self.c:
            return out
        year = (p - 1) // 12
        for category in self.taxes:
            out[category] = installment(self.tax(category, year), p)
        if self.pid and (self.pid[1] is None or p <= self.pid[1] * 12):
            out['pidAssessment'] = installment(self.pid[0], p)
        if self.insurance[0] > 0:
            out['homeownersInsurance'] = installment(grow(self.insurance[0], self.insurance[1], year), p)
        if self.hoa[0] > 0:
            out['hoaDues'] = grow(self.hoa[0], self.hoa[1], year)
        if not self.government_mip:
            tested = opening if self.pmi_by_request else scheduled_opening
            out['mortgageInsurance'] = self.pmi_premium if tested > self.pmi_threshold and p <= self.pmi_last else D(0)
        return out


# ---------------------------------------------------------------------------------------------- FHA and VA

# The national conforming loan limit (FHFA), by year. Since HUD Mortgagee Letter 2023-05 (case numbers endorsed from
# 20 March 2023) it is the base loan amount above which FHA's annual MIP is higher.
CONFORMING_LIMITS = {2023: D(726_200), 2024: D(766_550), 2025: D(806_500), 2026: D(832_750)}


# HUD's county limits, as the app ships them (tools/fha-limits builds the file from HUD's): data, not logic, so shared.
_LIMITS_FILE = pathlib.Path(__file__).resolve().parents[2] / 'src' / 'MortgageAnalytics.Application' / 'Data' / 'fha-loan-limits.json'
_limits = json.loads(_LIMITS_FILE.read_text(encoding='utf-8'))
FHA_LIMITS = {'year': _limits['year'], 'counties': {c['fips']: c for c in _limits['counties']}}


def conforming_limit(year):
    """The limit for `year`: the latest known for later years, the first (2023) for earlier ones."""
    known = [y for y in CONFORMING_LIMITS if y <= year]
    return CONFORMING_LIMITS[max(known)] if known else CONFORMING_LIMITS[min(CONFORMING_LIMITS)]


def fha_annual_mip(base_loan, price, term, closing_year):
    """HUD ML 2023-05's table: the annual MIP rate (percent) and whether it lasts 11 years or the whole term."""
    ltv = base_loan / price  # exact, against 0.90, 0.95, 0.78
    big = base_loan > conforming_limit(closing_year)
    if term > 180:
        rate = (D('0.70') if big else D('0.50')) if ltv <= D('0.95') else (D('0.75') if big else D('0.55'))
    elif not big:
        rate = D('0.15') if ltv <= D('0.90') else D('0.40')
    else:
        rate = D('0.15') if ltv <= D('0.78') else D('0.40') if ltv <= D('0.90') else D('0.65')
    return rate, ltv <= D('0.90')


def va_funding_fee_rate(down, price, use):
    """The VA funding fee for a purchase (percent), by down payment and first or later use, since 7 April 2023."""
    if use == 'Exempt':
        return D(0)
    share = down / price
    if share >= D('0.10'):
        return D('1.25')
    if share >= D('0.05'):
        return D('1.5')
    return D('2.15') if use == 'FirstUse' else D('3.3')


def program_of(request, price, down, rate, term, first):
    """The loan program: the upfront fee, the loan with it, and FHA's annual MIP by payment number."""
    base = price - down
    program = request.get('program') or {}
    kind = program.get('type', 'Conventional')
    if kind == 'Conventional':
        return None, base, lambda p: D(0)
    financed = program.get('financeUpfrontFee', True)
    fee_rate = D('1.75') if kind == 'Fha' else va_funding_fee_rate(down, price, program.get('vaUse') or 'FirstUse')
    fee = money(base * fee_rate / 100)
    loan = base + fee if financed else base
    out = {'type': kind, 'upfrontFeePercent': fee_rate, 'upfrontFee': fee, 'upfrontFeeFinanced': financed,
           'loanAmount': loan, 'annualMipPercent': D(0), 'mipPayments': 0,
           'countyName': None, 'countyLoanLimit': None, 'loanLimitYear': None}
    county = FHA_LIMITS['counties'].get(program.get('countyFips')) if kind == 'Fha' else None
    if county:
        out['countyName'] = f"{county['name']}, {county['state']}"
        out['countyLoanLimit'], out['loanLimitYear'] = D(county['limit']), FHA_LIMITS['year']
    if kind == 'Va':
        return out, loan, lambda p: D(0)

    # FHA: the annual rate on each loan year's average balance on the original schedule, at the starting rate, a
    # twelfth of it a month, for 11 years (132 payments) at 90% LTV or less, otherwise the whole term.
    closing_year = add_months(first, -1).year
    mip_rate, eleven_years = fha_annual_mip(base, price, term, closing_year)
    original = amortize(loan, rate, term)
    openings = [r['opening'] for r in original['rows']]
    mip_payments = min(132, term) if eleven_years else term
    out['annualMipPercent'], out['mipPayments'] = mip_rate, mip_payments

    def monthly(p):
        if p > mip_payments:
            return D(0)
        year = openings[(p - 1) // 12 * 12:(p - 1) // 12 * 12 + 12]
        return money(money(sum(year, D(0)) / len(year) * mip_rate / 100) / 12)
    return out, loan, monthly


# ---------------------------------------------------------------------------------------------- the whole analysis

def analyze(request, today, other_choice=True):
    price, down = D(str(request['homePrice'])), D(str(request['downPayment']))
    rate, term = D(str(request['annualInterestRate'])), request['termInMonths']
    first = date.fromisoformat(request['firstPaymentDate']) if request.get('firstPaymentDate') else first_of_next_month(today)
    program, loan, fha_mip = program_of(request, price, down, rate, term, first)
    arm = request.get('adjustableRate')
    changes = arm_path(rate, term, arm['initialFixedMonths'], arm['adjustmentIntervalMonths'], D(str(arm['expectedRate'])),
                       D(str(arm['initialCap'])), D(str(arm['periodicCap'])), D(str(arm['lifetimeCap'])),
                       D(str(arm['margin'])) if arm.get('margin') is not None else None) if arm else []
    recast = None
    if request.get('strategy') == 'Recast':
        r = request.get('recast') or {'minimumLumpSum': 10000, 'fee': 250}
        recast = (D(str(r['minimumLumpSum'])), D(str(r['fee'])))

    baseline = amortize(loan, rate, term, changes)
    accelerated = amortize(loan, rate, term, changes, extras_of(request), recast)
    costs = Costs(request, (term + 11) // 12, fha_mip if program else None)

    buydown = request.get('buydown')
    note_payment = payment(loan, rate, term)
    # Paid for by the seller or builder, the subsidy pays interest the borrower would otherwise pay; paid for by the
    # borrower at closing, it is their own money, so they pay all of the interest.
    paid_by = request.get('buydownPaidBy') or 'Seller'

    def subsidy(row):
        if not buydown:
            return D(0)
        year = (row['p'] - 1) // 12 + 1
        reductions = [D(str(x)) for x in buydown['yearlyReductions']]
        if year > len(reductions):
            return D(0)
        return min(note_payment - payment(loan, max(D(0), rate - reductions[year - 1]), term), row['scheduled'])

    def schedule_out(s, scheduled_openings):
        rows = []
        for row in s['rows']:
            c = costs.for_payment(row['p'], row['opening'], scheduled_openings[row['p'] - 1])
            c['total'] = sum(c.values(), D(0))
            sub = subsidy(row)
            rows.append({
                'paymentNumber': row['p'], 'dueDate': add_months(first, row['p'] - 1).isoformat(),
                'scheduledPayment': row['scheduled'], 'principal': row['principal'], 'interest': row['interest'],
                'extraPrincipal': row['extra'], 'housingCosts': c['total'], 'costs': c,
                'totalOutlay': row['scheduled'] + row['extra'] + c['total'] - sub,
                'remainingBalance': row['balance'], 'annualInterestRate': row['rate'], 'buydownSubsidy': sub,
            })
        totals = {k: sum((r['costs'][k] for r in rows), D(0)) for k in CATEGORIES + ['total']}
        pmi_rows = [r for r in rows if r['costs']['mortgageInsurance'] > 0]
        total_interest = sum((r['interest'] for r in rows), D(0))
        subsidy_total = sum((r['buydownSubsidy'] for r in rows), D(0))
        return {
            'monthlyPayment': s['initial'],
            'monthlyHousingCosts': rows[0]['costs'],
            'totalMonthlyPayment': s['initial'] + rows[0]['costs']['total'],
            'numberOfPayments': len(rows),
            'totalInterest': sum((r['interest'] for r in rows), D(0)),
            'totalPaid': sum((r['scheduledPayment'] + r['extraPrincipal'] for r in rows), D(0)),
            'totalHousingCosts': totals,
            'mortgageInsuranceEndDate': pmi_rows[-1]['dueDate'] if pmi_rows else None,
            'payoffDate': rows[-1]['dueDate'],
            # A recast takes effect with the next payment.
            'recasts': [dict(r, effectiveDate=add_months(first, r['afterPaymentNumber']).isoformat()) for r in s['recasts']],
            'rateChanges': [dict(c, effectiveDate=add_months(first, c['paymentNumber'] - 1).isoformat()) for c in s['rateChanges']],
            'payments': rows,
            'buydownSubsidy': subsidy_total,
            'interestYouPay': total_interest - (subsidy_total if paid_by == 'Seller' else D(0)),
        }

    base_openings = [r['opening'] for r in baseline['rows']]
    base = schedule_out(baseline, base_openings)
    acc = schedule_out(accelerated, base_openings)

    # Owed at the start of each year, on the plan with its extra payments: the loan, then each year's closing balance.
    def owed_at_start(y):
        if y == 0:
            return loan
        return acc['payments'][y * 12 - 1]['remainingBalance'] if y * 12 <= len(acc['payments']) else D(0)

    projection = []
    for y in range(len(costs.market)):
        year_rows = base['payments'][y * 12:(y + 1) * 12]
        tv = lambda cat: costs.taxable_value(cat, y) if costs.c and cat in costs.taxes else None  # noqa: E731
        totals = {k: sum((r['costs'][k] for r in year_rows), D(0)) for k in CATEGORIES}
        # Mortgage insurance stops with the loan actually paid: the plan with its extra payments.
        totals['mortgageInsurance'] = sum((r['costs']['mortgageInsurance'] for r in acc['payments'][y * 12:(y + 1) * 12]), D(0))
        totals['total'] = sum(totals.values(), D(0))
        projection.append({
            'year': y + 1, 'startDate': add_months(first, y * 12).isoformat(),
            'marketValue': costs.market[y], 'assessedValue': costs.assessed[y],
            'schoolTaxableValue': tv('schoolTax'), 'localTaxableValue': tv('localTax'), 'mudTaxableValue': tv('mudTax'),
            'propertyTaxableValue': tv('propertyTax'), 'costs': totals,
            'loanBalance': owed_at_start(y), 'equity': costs.market[y] - owed_at_start(y),
        })

    interest_saved = base['totalInterest'] - acc['totalInterest']
    pmi_saved = base['totalHousingCosts']['mortgageInsurance'] - acc['totalHousingCosts']['mortgageInsurance']
    fees = sum((r['fee'] for r in accelerated['recasts']), D(0))
    dp_percent = (down / price * 10000).to_integral_value(rounding='ROUND_DOWN') / 100

    out = {
        'purchase': {'homePrice': price, 'downPayment': down, 'downPaymentPercent': dp_percent, 'loanAmount': price - down,
                     'loanToValuePercent': 100 - dp_percent,
                     'mortgageInsuranceRequired': program is None and price - down > price * 80 / 100,
                     'conformingLoanLimit': conforming_limit(add_months(first, -1).year),
                     'isJumbo': program is None and price - down > conforming_limit(add_months(first, -1).year)},
        'baseline': base, 'accelerated': acc,
        'savings': {'interestSaved': interest_saved, 'mortgageInsuranceSaved': pmi_saved, 'recastFees': fees,
                    'netSavings': interest_saved + pmi_saved - fees,
                    'paymentsSaved': base['numberOfPayments'] - acc['numberOfPayments'],
                    'totalExtraPrincipal': sum((r['extraPrincipal'] for r in acc['payments']), D(0)),
                    'originalPayoffDate': base['payoffDate'], 'acceleratedPayoffDate': acc['payoffDate']},
        'projection': projection,
        'buydown': None, 'adjustableRate': None,
    }
    if buydown:
        reductions = [D(str(x)) for x in buydown['yearlyReductions']]
        years = []
        for year in range(1, len(reductions) + 2):
            r = max(D(0), rate - reductions[year - 1]) if year <= len(reductions) else rate
            # What the subsidy pays that year: the gaps of that year's payments on the standard schedule.
            subsidy = sum((p['buydownSubsidy'] for p in base['payments'] if (p['paymentNumber'] - 1) // 12 + 1 == year), D(0))
            years.append({'year': year, 'annualInterestRate': r, 'monthlyPayment': payment(loan, r, term), 'subsidy': subsidy})
        out['buydown'] = {'noteRate': rate, 'years': years,
                          'totalSubsidy': base['buydownSubsidy'], 'paidBy': paid_by}
    out['program'] = program
    points = request.get('discountPoints')
    out['discountPoints'] = discount_points(points, loan, term, first, baseline) if points else None
    closing = request.get('closingCosts')
    out['cashToClose'] = cash_to_close(closing, down, loan, rate, projection[0]['costs'],
                                       base['buydownSubsidy'] if paid_by == 'Borrower' else D(0),
                                       out['discountPoints']['cost'] if points else D(0),
                                       program['upfrontFee'] if program and not program['upfrontFeeFinanced'] else D(0),
                                       base['buydownSubsidy'] if buydown and paid_by == 'Seller' else D(0),
                                       program['type'] if program else 'Conventional', price,
                                       request.get('occupancy', 'PrimaryResidence')) if closing else None
    if arm:
        worst_rate = min(D(30), rate + D(str(arm['lifetimeCap'])))
        worst_changes = arm_path(rate, term, arm['initialFixedMonths'], arm['adjustmentIntervalMonths'], worst_rate,
                                 D(str(arm['initialCap'])), D(str(arm['periodicCap'])), D(str(arm['lifetimeCap'])),
                                 D(str(arm['margin'])) if arm.get('margin') is not None else None)
        worst = amortize(loan, rate, term, worst_changes)
        out['adjustableRate'] = {
            'worstCaseRateChanges': [dict(c, effectiveDate=add_months(first, c['paymentNumber'] - 1).isoformat()) for c in worst['rateChanges']],
            'worstCasePeakPayment': max([worst['initial']] + [c['newPayment'] for c in worst['rateChanges']]),
            'worstCaseTotalInterest': sum((r['interest'] for r in worst['rows']), D(0)),
        }
    out['pmiOtherChoice'] = pmi_other_choice(request, today, acc) if program is None and other_choice else None
    out['sellerOffer'] = seller_offer(request, today, out)
    out['affordability'] = affordability(request, today)
    out['rentOrBuy'] = rent_or_buy(request, out)
    out['sale'] = sale(request, out)
    out['rental'] = rental(request, out)
    out['secondLoan'] = second_loan(request, today, out)
    out['annualPercentageRate'] = annual_percentage_rate(out)
    out['inFiveYears'], out['totalInterestPercentage'] = loan_estimate_figures(out)
    return out


def loan_estimate_figures(out):
    """
    A Loan Estimate's comparison box, from the standard schedule: "in 5 years" is the first 60 payments with their
    mortgage insurance, plus the lender's loan costs, and the principal they pay off; the total interest percentage is
    the interest over the whole loan as a percentage of the amount borrowed, to a thousandth.
    """
    payments = out['baseline']['payments'][:60]
    cash, program = out['cashToClose'], out['program']
    paid = sum((p['scheduledPayment'] + p['costs']['mortgageInsurance'] for p in payments), D(0)) + (cash['loanCosts'] if cash else D(0))
    borrowed = program['loanAmount'] if program else out['purchase']['loanAmount']
    tip = (out['baseline']['totalInterest'] / borrowed * 100).quantize(D('0.001'), rounding=ROUND_HALF_UP) if borrowed > 0 else None
    return {'totalPaid': paid, 'principalPaidOff': sum((p['principal'] for p in payments), D(0))}, tip


def annual_percentage_rate(out):
    """
    The APR (Regulation Z's actuarial method, a monthly unit period): the yearly rate at which the payments, each
    discounted by a month's interest, add up to what the borrower received, which is the amount borrowed less the
    finance charges paid up front: the lender's loan costs, prepaid interest, discount points and an FHA or VA upfront
    fee (borrowed or paid at closing). Each payment is the starting rate's payment plus that month's mortgage
    insurance. None when nothing was received or the payments return less than was.
    """
    program, cash, points = out['program'], out['cashToClose'], out['discountPoints']
    borrowed = program['loanAmount'] if program else out['purchase']['loanAmount']
    charges = D(0)
    if cash:
        charges += cash['loanCosts'] + cash['prepaidInterest']
    if points:
        charges += points['cost']
    if program:
        charges += program['upfrontFee']
    amount = borrowed - charges
    level = out['baseline']['monthlyPayment']
    payments = [level + p['costs']['mortgageInsurance'] for p in out['baseline']['payments']]
    if amount <= 0 or not payments or sum(payments, D(0)) < amount:
        return None
    if sum(payments, D(0)) == amount:
        return D(0)
    low, high = D(0), D(1)
    for _ in range(200):
        middle = (low + high) / 2
        discount, factor, value = 1 / (1 + middle), D(1), D(0)
        for payment in payments:
            factor *= discount
            value += payment * factor
        low, high = (middle, high) if value > amount else (low, middle)
    return ((low + high) / 2 * 12 * 100).quantize(D('0.001'), rounding=ROUND_HALF_UP)


# Federal income tax, 2026: the standard deduction by filing status, the most state and local taxes that can be deducted,
# how fast prices (and the standard deduction) are taken to rise, and the mortgage debt interest can be deducted on.
STANDARD_DEDUCTION = {'Single': D(16_100), 'MarriedFilingJointly': D(32_200), 'HeadOfHousehold': D(24_150)}
SALT_LIMIT, DEDUCTION_INDEX, DEBT_LIMIT = D(40_400), D('2.5'), D(750_000)


def tax_saved_by_owning(owner, year, payments):
    """
    What owning saves in federal income tax in a year over renting: the extra the owner deducts (mortgage interest, up to
    the debt limit, and the property tax, within the limit on state and local taxes) beyond what the same person deducts
    as a renter (the standard deduction, or their other deductions when larger), at their tax rate. The standard deduction
    and the person's other amounts rise with prices; the limit on state and local taxes does not.
    """
    months = payments[(year - 1) * 12:year * 12]
    # What was owed at the start of the year: the last year's end, or, in the first, what was borrowed.
    opening = payments[(year - 1) * 12 - 1]['remainingBalance'] if year > 1 else payments[0]['remainingBalance'] + payments[0]['principal']
    interest = sum((p['interest'] for p in months), D(0))
    if opening > DEBT_LIMIT:
        interest = money(interest * DEBT_LIMIT / opening)
    prop = sum((p['costs']['propertyTax'] + p['costs']['schoolTax'] + p['costs']['localTax'] + p['costs']['mudTax'] for p in months), D(0))
    standard = money(grow(STANDARD_DEDUCTION[owner['filingStatus']], DEDUCTION_INDEX, year - 1))
    taxes = money(grow(D(str(owner['otherStateAndLocalTaxes'])), DEDUCTION_INDEX, year - 1))
    other = money(grow(D(str(owner['otherItemizedDeductions'])), DEDUCTION_INDEX, year - 1))
    renting = max(standard, other + min(taxes, SALT_LIMIT))
    owning = max(standard, other + min(taxes + prop, SALT_LIMIT) + interest)
    return money((owning - renting) * D(str(owner['marginalTaxRatePercent'])) / 100)


def rent_or_buy(request, out):
    """
    Buying against renting a similar home, year by year, up to 30 years (or the loan's term): each month the cheaper of
    owning (the standard schedule's outlay, less any buydown subsidy, plus upkeep on that year's value) and renting (the
    rent, rising each year) invests the difference at the return a year compounded monthly; the renter also invests
    what buying takes to close. The buyer has the home after a sale (its value less what is owed and the selling
    costs) and their investments; the renter, their investments. With an owner's tax profile, the year's federal tax
    saving is felt a twelfth a month, as owning costing that much less.
    """
    a = request.get('rentOrBuy')
    if not a:
        return None
    rent0, rise = D(str(a['monthlyRent'])), D(str(a.get('rentIncreasePercent', 3.5)))
    ret, upkeep_pct = D(str(a.get('investmentReturnPercent', 7))), D(str(a.get('maintenancePercent', 1)))
    selling = D(str(a.get('sellingCostPercent', 6)))
    price = D(str(request['homePrice']))
    growth = D(str((request.get('housingCosts') or {}).get('homeValueGrowthRate', 0)))
    cash = out['cashToClose']['total'] if out['cashToClose'] else D(str(request['downPayment']))
    payments = out['baseline']['payments']
    monthly = 1 + ret / 100 / 12
    owner = a.get('ownerTaxes')
    buyer, renter, years = D(0), cash, []
    for year in range(1, min(30, len(payments) // 12) + 1):
        upkeep = money(grow(price, growth, year - 1) * upkeep_pct / 100 / 12)
        rent = grow(rent0, rise, year - 1)
        owned = rented = D(0)
        saved = tax_saved_by_owning(owner, year, payments) if owner else D(0)
        for p in payments[(year - 1) * 12:year * 12]:
            owning = p['totalOutlay'] + upkeep
            felt = owning - saved / 12
            buyer = buyer * monthly + max(D(0), rent - felt)
            renter = renter * monthly + max(D(0), felt - rent)
            owned += owning
            rented += rent
        sold = grow(price, growth, year)
        equity = sold - payments[year * 12 - 1]['remainingBalance'] - money(sold * selling / 100)
        b, r = money(buyer), money(renter)
        years.append({'year': year, 'ownershipCost': owned, 'rent': rented, 'homeEquity': equity, 'buyerInvestments': b,
                      'buyerNetWorth': equity + b, 'renterNetWorth': r, 'advantage': equity + b - r, 'taxSaved': saved})
    since = None
    for y in years:
        since = (since or y['year']) if y['advantage'] >= 0 else None
    return {'monthlyRent': rent0, 'rentIncreasePercent': rise, 'investmentReturnPercent': ret, 'maintenancePercent': upkeep_pct,
            'sellingCostPercent': selling, 'cashToClose': cash, 'breakEvenYear': since, 'years': years, 'countsTaxSavings': bool(owner)}


def second_loan(request, today, out):
    """
    A second loan against paying PMI. Each way is the request analyzed again, without extra payments or a buydown: as made
    (one loan), and with the second loan's amount added to the down payment, so the first loan is smaller. Each is costed
    over the years kept on its standard schedule: the cash to close (the second loan's amount is not cash, so the down
    payment is the buyer's own in both), every payment of both loans, and what both still owe.
    """
    a = request.get('secondLoan')
    if not a:
        return None
    amount, rate = D(str(a['amount'])), D(str(a['annualInterestRate']))
    term, years = a.get('termInMonths', 180), a.get('yearsKept', 7)
    down = D(str(request['downPayment']))
    base = {k: v for k, v in request.items() if k not in ('secondLoan', 'rentOrBuy', 'sale', 'rental', 'affordability', 'sellerOffer', 'monthlyBudget')}
    plain = dict(base, extraPayments=None, buydown=None)
    as_made = analyze(plain, today, other_choice=False)
    smaller = analyze(dict(plain, downPayment=down + amount), today, other_choice=False)
    second = amortize(amount, rate, term)['rows']

    def option(a_, second_amount, schedule):
        cash = (a_['cashToClose']['total'] if a_['cashToClose'] else D(str(a_['purchase']['downPayment']))) - second_amount
        kept = a_['baseline']['payments'][:years * 12]
        second_kept = schedule[:years * 12] if schedule else []
        payments = sum((p['totalOutlay'] for p in kept), D(0)) + sum((r['scheduled'] for r in second_kept), D(0))
        balance = kept[-1]['remainingBalance'] + (second_kept[-1]['balance'] if second_kept else D(0))
        first = a_['baseline']['payments'][0]
        second_payment = schedule[0]['scheduled'] if schedule else D(0)
        return {'firstLoan': a_['purchase']['loanAmount'], 'secondLoan': second_amount, 'firstLoanPayment': first['scheduledPayment'],
                'secondLoanPayment': second_payment, 'mortgageInsurance': first['costs']['mortgageInsurance'],
                'monthlyPayment': first['scheduledPayment'] + first['extraPrincipal'] + first['costs']['total'] + second_payment,
                'cashToClose': cash, 'payments': payments, 'balance': balance, 'cost': cash + payments + balance}

    without, with_ = option(as_made, D(0), None), option(smaller, amount, second)
    return {'amount': amount, 'annualInterestRate': rate, 'termInMonths': term, 'yearsKept': years,
            'withMortgageInsurance': without, 'withSecondLoan': with_, 'saved': without['cost'] - with_['cost']}


def rental(request, out):
    """
    The home let out, year by year (up to 30, or the loan's term), on the standard schedule. Collected rent is the year's
    rent (the monthly rent after its yearly rises, times 12) less vacancy; less the manager's share of that, upkeep on the
    home's value at the year's start, and the year's property taxes, assessments, insurance and dues, it is the net
    operating income. The loan takes the year's principal, interest and mortgage insurance less any buydown subsidy. The
    measures are the first year's; the break-even rent is the one whose first year leaves nothing after the loan.
    """
    a = request.get('rental')
    if not a:
        return None
    rent0, rise = D(str(a['monthlyRent'])), D(str(a.get('rentIncreasePercent', 3)))
    vacancy, mgmt = D(str(a.get('vacancyPercent', 5))), D(str(a.get('managementPercent', 8)))
    upkeep_pct = D(str(a.get('maintenancePercent', 1)))
    price = D(str(request['homePrice']))
    growth = D(str((request.get('housingCosts') or {}).get('homeValueGrowthRate', 0)))
    cash = out['cashToClose']['total'] if out['cashToClose'] else D(str(request['downPayment']))
    payments = out['baseline']['payments']
    operating_keys = ['propertyTax', 'schoolTax', 'localTax', 'mudTax', 'pidAssessment', 'homeownersInsurance', 'hoaDues']
    years = []
    for year in range(1, min(30, len(payments) // 12) + 1):
        months = payments[(year - 1) * 12:year * 12]
        gross = grow(rent0, rise, year - 1) * 12
        lost = money(gross * vacancy / 100)
        collected = gross - lost
        fee = money(collected * mgmt / 100)
        upkeep = money(grow(price, growth, year - 1) * upkeep_pct / 100)
        operating = sum((p['costs'][k] for p in months for k in operating_keys), D(0))
        debt = sum((p['scheduledPayment'] + p['costs']['mortgageInsurance'] - p['buydownSubsidy'] for p in months), D(0))
        noi = collected - fee - upkeep - operating
        years.append({'year': year, 'grossRent': gross, 'vacancyLoss': lost, 'managementFee': fee, 'maintenance': upkeep,
                      'operatingCosts': operating, 'netOperatingIncome': noi, 'debtService': debt, 'cashFlow': noi - debt})
    first = years[0]
    kept = (1 - vacancy / 100) * (1 - mgmt / 100)
    return {'monthlyRent': rent0, 'vacancyPercent': vacancy, 'managementPercent': mgmt, 'maintenancePercent': upkeep_pct,
            'rentIncreasePercent': rise, 'cashInvested': cash,
            'capRatePercent': money(first['netOperatingIncome'] / price * 100),
            'cashOnCashPercent': money(first['cashFlow'] / cash * 100) if cash > 0 else None,
            'debtServiceCoverage': money(first['netOperatingIncome'] / first['debtService']) if first['debtService'] > 0 else None,
            'grossRentMultiplier': money(price / first['grossRent']), 'rentToPricePercent': money(rent0 / price * 100),
            'breakEvenMonthlyRent': money((first['maintenance'] + first['operatingCosts'] + first['debtService']) / kept / 12),
            'years': years}


# Gain on a home lived in for two years that is free of tax (IRC 121): a couple filing jointly, and anyone else.
EXCLUSION = {'MarriedFilingJointly': D(500_000)}
EXCLUSION_DEFAULT = D(250_000)


def sale(request, out):
    """
    What selling leaves at the end of each year of the loan (up to 30): the home's value, less what the plan still owes
    (nothing once it is paid off), the selling costs and the tax on the gain. The gain is the value less the costs, over
    the price paid; a loss is not taxed. A home lived in has the first $250,000 of gain ($500,000 for a couple filing
    jointly) free of tax once owned two years; any other home has none.
    """
    a = request.get('sale')
    if not a:
        return None
    selling, rate = D(str(a.get('sellingCostPercent', 6))), D(str(a.get('gainsTaxRatePercent', 15)))
    primary = request.get('occupancy', 'PrimaryResidence') == 'PrimaryResidence'
    exclusion = EXCLUSION.get(a.get('filingStatus', 'Single'), EXCLUSION_DEFAULT) if primary else D(0)
    price = D(str(request['homePrice']))
    growth = D(str((request.get('housingCosts') or {}).get('homeValueGrowthRate', 0)))
    owed = out['accelerated']['payments']
    years = []
    for year in range(1, min(30, len(out['baseline']['payments']) // 12) + 1):
        value = grow(price, growth, year)
        balance = owed[year * 12 - 1]['remainingBalance'] if year * 12 <= len(owed) else D(0)
        costs = money(value * selling / 100)
        gain = value - costs - price
        free = min(max(gain, D(0)), exclusion) if year >= 2 else D(0)
        tax = money((max(gain, D(0)) - free) * rate / 100)
        years.append({'year': year, 'homeValue': value, 'loanBalance': balance, 'sellingCosts': costs, 'gain': gain,
                      'taxFreeGain': free, 'taxOnGain': tax, 'netProceeds': value - balance - costs - tax})
    return {'sellingCostPercent': selling, 'gainsTaxRatePercent': rate, 'exclusionPerSale': exclusion, 'years': years}


# Debt-to-income limits, as percentages of gross monthly income: (housing, total). Comfortable is the classic 28/36;
# the most allowed is the program's (Fannie Mae B3-6-02's 45% total; HUD's 31/43 for FHA; VA's 41% total).
COMFORTABLE = (D(28), D(36))
MOST_ALLOWED = {'Conventional': (None, D(45)), 'Fha': (D(31), D(43)), 'Va': (None, D(41))}


def qualifying_rate(request):
    """
    The rate a lender qualifies the loan at, and why. Fixed: the note rate. An ARM, by program: conventional (Fannie Mae
    B3-6-04) fixed 3 years or less, the highest rate the caps allow by payment 60, rising as fast as they let it;
    fixed 5 years or less, the note rate plus the first cap (within the lifetime cap) or the expected rate, whichever is
    higher; longer, the note rate. FHA (HUD 4000.1): a 1-year ARM with a loan of 95% or more, a point above the start.
    VA: the note rate.
    """
    rate, arm = D(str(request['annualInterestRate'])), request.get('adjustableRate')
    if not arm:
        return rate, 'NoteRate'
    kind = (request.get('program') or {}).get('type', 'Conventional')
    fixed, interval = arm['initialFixedMonths'], arm['adjustmentIntervalMonths']
    first, each, life = D(str(arm['initialCap'])), D(str(arm['periodicCap'])), D(str(arm['lifetimeCap']))
    ceiling = min(D(30), rate + life)
    if kind == 'Fha':
        price, down = D(str(request['homePrice'])), D(str(request['downPayment']))
        if fixed <= 12 and (price - down) * 100 >= price * 95:
            return min(D(30), rate + 1), 'StartPlusOnePoint'
        return rate, 'NoteRate'
    if kind == 'Va' or fixed > 60:
        return rate, 'NoteRate'
    if fixed > 36:
        return max(min(ceiling, rate + first), D(str(arm['expectedRate']))), 'FirstResetOrFullyIndexed'
    # The first change after the fixed months, then one each interval, while it is still within the first 60 payments.
    later_changes = (60 - (fixed + 1)) // interval
    return min(ceiling, rate + first + each * later_changes), 'MostInFirstFiveYears'


def qualifying_payment(request, today, qualifying=None):
    """
    The first month's payment as a lender qualifies it, or None when no loan can be had (an FHA loan past its county's
    limit): principal and interest at the qualifying rate (this request's, unless given), and every housing cost
    charged with the first payment.
    """
    price, down = D(str(request['homePrice'])), D(str(request['downPayment']))
    rate, term = D(str(request['annualInterestRate'])), request['termInMonths']
    first = date.fromisoformat(request['firstPaymentDate']) if request.get('firstPaymentDate') else first_of_next_month(today)
    program, loan, fha_mip = program_of(request, price, down, rate, term, first)
    if program and program['countyLoanLimit'] is not None and price - down > program['countyLoanLimit']:
        return None
    costs = Costs(request, (term + 11) // 12, fha_mip if program else None)
    at = qualifying if qualifying is not None else qualifying_rate(request)[0]
    return payment(loan, at, term) + sum(costs.for_payment(1, loan, loan).values(), D(0))


def payment_at_price(request, today, price):
    """
    The qualifying payment at another price, with the same down payment share rounded up to the cent, at this home's
    qualifying rate: the share borrowed is the same, so the rate is too.
    """
    share = D(str(request['downPayment'])) / D(str(request['homePrice']))
    down = (price * share * 100).to_integral_value(rounding='ROUND_CEILING') / 100
    return qualifying_payment(dict(request, homePrice=price, downPayment=down), today, qualifying_rate(request)[0])


def affordability(request, today):
    """
    The home against a household's income and debts: its debt-to-income ratios, and for each limit the most the housing
    payment may be and whether this home fits. The highest price is not worked out here: the API's is checked at its
    edge instead (price_edge_problems), so a search written the same way twice cannot hide a mistake in both.
    """
    household = request.get('affordability')
    if not household:
        return None
    # A lender counts everyone on the loan together: the first buyer, then each co-buyer.
    buyers = [household] + household.get('coBuyers', [])
    income = money(sum(D(str(b['annualIncome'])) for b in buyers) / 12)
    debts = sum(D(str(b['monthlyDebts'])) for b in buyers)
    housing = qualifying_payment(request, today)
    percent = lambda x: (x / income * 100).quantize(CENT, rounding=ROUND_HALF_UP)  # noqa: E731

    def limit(housing_percent, total_percent):
        most = income * total_percent / 100 - debts
        if housing_percent is not None:
            most = min(most, income * housing_percent / 100)
        most = max(D(0), (most * 100).to_integral_value(rounding='ROUND_FLOOR') / 100)
        return {'housingPercent': housing_percent, 'totalPercent': total_percent, 'maxHousingPayment': most, 'fits': housing <= most}

    kind = (request.get('program') or {}).get('type', 'Conventional')
    qualifying, basis = qualifying_rate(request)
    return {'monthlyIncome': income, 'monthlyDebts': debts, 'housingPayment': housing,
            'housingPercent': percent(housing), 'totalPercent': percent(housing + debts),
            'comfortable': limit(*COMFORTABLE), 'mostAllowed': limit(*MOST_ALLOWED[kind]),
            'qualifyingRate': qualifying, 'qualifyingRateBasis': basis,
            'buyers': buyers_of(request, today, buyers) if len(buyers) > 1 else None}


def buyers_of(request, today, buyers):
    """
    Each buyer, the first first: their own income and debts, their share of the down payment (the first buyer puts in
    what the co-buyers leave) and their share of the first month's payment in proportion to income, the odd cents going
    to the largest remainders.
    """
    down = D(str(request['downPayment']))
    percents = [D(str(b.get('downPaymentPercent', 0))) for b in buyers[1:]]
    co_downs = [money(down * pct / 100) for pct in percents]
    downs = [down - sum(co_downs)] + co_downs
    percents = [100 - sum(percents)] + percents

    incomes = [D(str(b['annualIncome'])) for b in buyers]
    cents = int((qualifying_payment(request, today, D(str(request['annualInterestRate']))) * 100).to_integral_value(rounding=ROUND_HALF_UP))
    exact = [cents * income / sum(incomes) for income in incomes]
    shares = [int(x.to_integral_value(rounding='ROUND_FLOOR')) for x in exact]
    for i in sorted(range(len(shares)), key=lambda i: (-(exact[i] - shares[i]), i))[:cents - sum(shares)]:
        shares[i] += 1

    return [{'monthlyIncome': money(incomes[i] / 12), 'monthlyDebts': D(str(b['monthlyDebts'])), 'downPaymentPercent': percents[i],
             'downPayment': downs[i], 'monthlyPayment': D(shares[i]) / 100} for i, b in enumerate(buyers)]


def price_edge_problems(request, today, affordability_response, cap=D(100_000_000)):
    """
    Checks each highest price the API found by its edge: the payment there fits the limit's budget (or the price is 0),
    and a dollar more does not (or is past what any loan can have, or the price is the cap).
    """
    for name in ('comfortable', 'mostAllowed'):
        a = affordability_response[name]
        price, budget = D(a['maxHomePrice']), D(a['maxHousingPayment'])
        at = payment_at_price(request, today, price) if price > 0 else None
        if price > 0 and (at is None or at > budget):
            yield f'$.affordability.{name}.maxHomePrice: {price} costs {at}, past the budget {budget}'
        if price < cap:
            above = payment_at_price(request, today, price + 1)
            if above is not None and above <= budget:
                yield f'$.affordability.{name}.maxHomePrice: {price + 1} costs {above}, within the budget {budget}, so {price} is not the highest'



def budget_edge_problems(request, today, budget_response, cap=D(100_000_000)):
    """
    Checks the highest price a monthly budget reaches by its edge, as price_edge_problems does for the limits: the whole
    payment at the note rate (not a lender's qualifying rate) fits the budget, a dollar more does not, and the down
    payment keeps the request's share, rounded up to the cent.
    """
    price, budget = D(budget_response['maxHomePrice']), D(budget_response['monthlyBudget'])
    note = D(str(request['annualInterestRate']))
    share = D(str(request['downPayment'])) / D(str(request['homePrice']))
    paying = lambda p: qualifying_payment(  # noqa: E731
        dict(request, homePrice=p, downPayment=(p * share * 100).to_integral_value(rounding='ROUND_CEILING') / 100), today, note)
    if price > 0 and ((at := paying(price)) is None or at > budget):
        yield f'$.budget.maxHomePrice: {price} costs {at}, past the budget {budget}'
    if price < cap:
        above = paying(price + 1)
        if above is not None and above <= budget:
            yield f'$.budget.maxHomePrice: {price + 1} costs {above}, within the budget {budget}, so {price} is not the highest'
    expected_down = (price * share * 100).to_integral_value(rounding='ROUND_CEILING') / 100 if price > 0 else D(0)
    if D(budget_response['downPayment']) != expected_down:
        yield f'$.budget.downPayment: expected {expected_down}, got {budget_response["downPayment"]}'



def seller_offer(request, today, out):
    """
    The seller's or builder's offer (their credits, and a buydown they pay for) taken each way it can be, each the
    request analyzed again as it would be, on its standard schedule: off the price (the same down payment, so a smaller
    loan); as credits; for a 2-1 buydown the seller pays as far as the offer and the limit go, the rest as credits and
    any shortfall paid by the buyer at closing; and for discount points, as many thousandths of a point as the offer
    pays within the limit (VA's leaves points out), at most 5, each lowering the rate by the cut per point. Each is
    costed over the years kept: the cash to close, every payment, and the balance still owed.
    """
    weigh, closing = request.get('sellerOffer'), request.get('closingCosts')
    if not weigh or not closing or request.get('adjustableRate') or request.get('discountPoints'):
        return None
    sellers = out['buydown']['totalSubsidy'] if out['buydown'] and out['buydown']['paidBy'] == 'Seller' else D(0)
    offer = D(str(closing['credits'])) + sellers
    if offer == 0:
        return None
    years, cut = weigh['yearsKept'], D(str(weigh['rateCutPerPoint']))
    price, down, rate = D(str(request['homePrice'])), D(str(request['downPayment'])), D(str(request['annualInterestRate']))
    kind = (request.get('program') or {}).get('type', 'Conventional')
    occupancy = request.get('occupancy', 'PrimaryResidence')
    plain = dict(request, extraPayments=None, buydown=None, sellerOffer=None, closingCosts=dict(closing, credits=0))
    credited = lambda r, c: dict(r, closingCosts=dict(closing, credits=c))  # noqa: E731
    loan_of = lambda a: a['program']['loanAmount'] if a['program'] else a['purchase']['loanAmount']  # noqa: E731

    def way(use, r, split=None):
        a = analyze(r, today, other_choice=False)
        cash = a['cashToClose']
        if split:
            subsidy = a['buydown']['totalSubsidy']
            share = min(offer, subsidy, concession_limit(kind, a['purchase']['homePrice'], down, occupancy)[1])
            program = a['program']
            cash = cash_to_close(dict(closing, credits=offer - share), down, loan_of(a), rate, a['projection'][0]['costs'],
                                 subsidy - share, D(0), program['upfrontFee'] if program and not program['upfrontFeeFinanced'] else D(0),
                                 share, kind, a['purchase']['homePrice'], occupancy)
        kept = a['baseline']['payments'][:years * 12]
        first = kept[0]
        payments = sum((p['totalOutlay'] for p in kept), D(0))
        return {
            'use': use, 'homePrice': a['purchase']['homePrice'], 'loanAmount': loan_of(a),
            'annualInterestRate': D(str(r['annualInterestRate'])),
            'points': D(str(r['discountPoints']['points'])) if r.get('discountPoints') else D(0),
            'firstPayment': first['totalOutlay'], 'laterPayment': first['totalOutlay'] + first['buydownSubsidy'],
            'cashToClose': cash['total'], 'payments': payments, 'balance': kept[-1]['remainingBalance'],
            'cost': cash['total'] + payments + kept[-1]['remainingBalance'],
            'notUsed': D(0) if use == 'PriceCut' else offer - cash['sellerCredits'] - cash['concessions']['sellerBuydown'],
        }

    ways = []
    if price - offer > down:
        ways.append(way('PriceCut', dict(plain, homePrice=price - offer)))
    ways.append(way('ClosingCosts', credited(plain, offer)))
    ways.append(way('TemporaryBuydown', dict(plain, buydown={'yearlyReductions': [2, 1]}, buydownPaidBy='Seller'), split=True))
    limit = concession_limit(kind, price, down, occupancy)[1]
    budget = offer if kind == 'Va' else min(offer, limit)
    points = min(D(5), (budget / loan_of(out) * 100_000).to_integral_value(rounding='ROUND_FLOOR') / 1000)
    if points > 0:
        cut_rate = max(D(0), (rate - points * cut).quantize(D('0.001'), rounding=ROUND_HALF_UP))
        ways.append(way('DiscountPoints', dict(credited(plain, offer), annualInterestRate=cut_rate,
                                               discountPoints={'points': points, 'rateWithoutPoints': rate})))
    best = min(ways, key=lambda w: w['cost'])['use']
    return {'offer': offer, 'yearsKept': years, 'rateCutPerPoint': cut, 'options': ways, 'best': best}


def pmi_other_choice(request, today, acc):
    """Automatic PMI removal keeps to the original schedule (78%); asking at 80% follows the actual balance. With the
    same extra payments, the other way's last PMI payment and what asking saves; None when both end together."""
    costs = request.get('housingCosts')
    if not costs:
        return None
    removal = 'BorrowerRequested' if costs.get('pmiCancellation', 'BorrowerRequested') == 'Automatic' else 'Automatic'
    other = analyze(dict(request, housingCosts=dict(costs, pmiCancellation=removal)), today, other_choice=False)['accelerated']
    saved = abs(acc['totalHousingCosts']['mortgageInsurance'] - other['totalHousingCosts']['mortgageInsurance'])
    return {'removal': removal, 'endDate': other['mortgageInsuranceEndDate'], 'savedByAsking': saved} if saved > 0 else None


# ---------------------------------------------------------------------------------------------- cash to close

def discount_points(points, loan, term, first, with_points):
    """
    Points against the rate without them, each on its standard schedule: the cost (a percentage of the loan, to the
    cent), the lower payment, the interest saved, and the first payment by which the interest saved covers the cost.
    """
    count, par_rate = D(str(points['points'])), D(str(points['rateWithoutPoints']))
    without = amortize(loan, par_rate, term)
    cost = money(loan * count / 100)
    interest = lambda s: sum((r['interest'] for r in s['rows']), D(0))  # noqa: E731
    saved, break_even = D(0), None
    for n in range(1, len(with_points['rows']) + 1):
        saved += (without['rows'][n - 1]['interest'] if n <= len(without['rows']) else D(0)) - with_points['rows'][n - 1]['interest']
        if saved >= cost:
            break_even = n
            break
    interest_saved = interest(without) - interest(with_points)
    return {
        'points': count, 'cost': cost, 'rateWithoutPoints': par_rate, 'paymentWithoutPoints': without['initial'],
        'monthlySaving': without['initial'] - with_points['initial'], 'interestSaved': interest_saved,
        'netSaving': interest_saved - cost, 'breakEvenPayment': break_even,
        'breakEvenDate': add_months(first, break_even - 1).isoformat() if break_even else None,
    }


def concession_limit(program, price, down, occupancy='PrimaryResidence'):
    """
    The most a seller or builder may pay toward the buyer's costs, as a percentage of the price: Fannie Mae's Selling
    Guide B3-4.1-02 for a conventional loan (3% with a loan above 90% of the price, 6% above 75%, 9% at 75% or less),
    6% for FHA, 4% for VA (whose normal closing costs and points are left out). For a conventional loan, also the next
    tier: the down payment that leaves a loan of exactly the tier's edge, rounded up to the cent. An investment
    property's conventional loan is held to 2%, whatever is put down.
    """
    def amount(percent):
        return money(price * percent / 100)
    if program != 'Conventional':
        percent = D(6) if program == 'Fha' else D(4)
        return percent, amount(percent), None
    if occupancy == 'InvestmentProperty':
        return D(2), amount(D(2)), None
    loan_share = (price - down) / price
    if loan_share > D('0.90'):
        percent, edge, nxt = D(3), D('0.90'), D(6)
    elif loan_share > D('0.75'):
        percent, edge, nxt = D(6), D('0.75'), D(9)
    else:
        return D(9), amount(D(9)), None
    needed = (price * (1 - edge) * 100).to_integral_value(rounding='ROUND_CEILING') / 100
    return percent, amount(percent), {'downPayment': needed, 'limitPercent': nxt, 'limit': amount(nxt)}


def cash_to_close(closing, down, loan, rate, year_one, buydown_cost, points_cost, upfront_fee, seller_buydown, program, price,
                  occupancy='PrimaryResidence'):
    """
    The Loan Estimate's way: fees as entered; prepaid interest at a day's interest (a 365-day year, to the cent) for the
    days given; the first year's insurance premium; and months of the first year's taxes and insurance into escrow, a
    month being a twelfth of the year to the cent. Credits pay closing costs, never the down payment: the lender's
    first, then the seller's. What the seller pays (a buydown, and credits; for VA, not those paying the fees, prepaid
    interest and points) may not pass the loan's limit, and their credits are cut by any excess.
    """
    days = closing.get('prepaidInterestDays', 15)
    months = closing.get('escrowMonths', 3)
    daily = money(loan * rate / 100 / 365)
    taxes = year_one['propertyTax'] + year_one['schoolTax'] + year_one['localTax'] + year_one['mudTax']
    insurance = year_one['homeownersInsurance']
    monthly = money((taxes + insurance) / 12)
    loan_costs, other = D(str(closing.get('loanCosts', 0))), D(str(closing.get('otherFees', 0)))
    costs = loan_costs + other + daily * days + insurance + monthly * months + buydown_cost + points_cost + upfront_fee
    seller_offered, lender_offered = D(str(closing.get('credits', 0))), D(str(closing.get('lenderCredits', 0)))
    lender = min(lender_offered, costs)
    seller_room = min(seller_offered, costs - lender)
    exempt = min(seller_room, loan_costs + other + daily * days + points_cost) if program == 'Va' else D(0)
    percent, limit, next_tier = concession_limit(program, price, down, occupancy)
    counted = seller_buydown + seller_room - exempt
    over = max(D(0), counted - limit)
    seller = seller_room - min(over, seller_room - exempt)
    credits = lender + seller
    return {
        'downPayment': down, 'loanCosts': loan_costs, 'otherFees': other,
        'dailyInterest': daily, 'prepaidInterestDays': days, 'prepaidInterest': daily * days,
        'homeownersInsurance': insurance, 'monthlyEscrow': monthly, 'escrowMonths': months, 'escrowDeposit': monthly * months,
        'buydownCost': buydown_cost, 'discountPoints': points_cost, 'upfrontMortgageFee': upfront_fee, 'closingCosts': costs,
        'sellerCredits': seller, 'lenderCredits': lender, 'credits': credits,
        'unusedCredits': lender_offered - lender + seller_offered - seller_room,
        'total': down + costs - credits,
        'concessions': {'limitPercent': percent, 'limit': limit, 'sellerBuydown': seller_buydown, 'total': counted, 'overLimit': over,
                        'normalClosingCostsExcluded': program == 'Va', 'nextTier': next_tier},
    }


# ---------------------------------------------------------------------------------------------- refinancing

def refinance(request):
    """
    Keep the current loan, or refinance it: the rest of the current loan, the new loan (closing costs financed or
    paid up front, and any cash taken out borrowed with it), the new loan at today's payment when that is higher,
    lifetime savings (cash received counted as money in hand) and the break-even payment.
    For the plain case: fixed rates, the loan given by what is owed now. With a home value, PMI on each loan: today's
    premium on the current one, and the new rate on the new one if it is above 80% of the value; each until its
    balance is 80% of the value, the new one by law not past its midpoint.
    """
    bal, cur_rate, left = D(str(request['currentBalance'])), D(str(request['currentAnnualInterestRate'])), request['remainingTermInMonths']
    new_rate, new_term, closing = D(str(request['newAnnualInterestRate'])), request['newTermInMonths'], D(str(request['closingCosts']))
    financed = request['financeClosingCosts']
    cash_out = D(str(request.get('cashOut', 0)))
    current = amortize(bal, cur_rate, left)
    principal = bal + cash_out + (closing if financed else D(0))
    new = amortize(principal, new_rate, new_term)
    upfront = D(0) if financed else closing
    total = lambda s: sum((r['scheduled'] + r['extra'] for r in s['rows']), D(0))  # noqa: E731
    interest = lambda s: sum((r['interest'] for r in s['rows']), D(0))  # noqa: E731

    # PMI: (premium, removal balance, last payment) on each loan, or none.
    value = D(str(request['homeValue'])) if request.get('homeValue') is not None else None
    no_pmi = (D(0), D(0), 0)
    cur_pmi, new_pmi = no_pmi, no_pmi
    if value is not None:
        removal = value * D('0.8')
        premium_now = D(str(request.get('currentMonthlyPmi', 0)))
        cur_pmi = (premium_now, removal, 10**9) if premium_now > 0 else no_pmi
        rate = D(str(request.get('newPmiRate', 0.5)))
        if principal > removal and rate > 0:
            new_pmi = (money(principal * rate / 100 / 12), removal, (new_term + 1) // 2)
    pmi_of = lambda pmi, row: pmi[0] if row['p'] <= pmi[2] and row['opening'] > pmi[1] else D(0)  # noqa: E731
    pmi_total = lambda pmi, s: sum((pmi_of(pmi, r) for r in s['rows']), D(0))  # noqa: E731
    first_pmi = lambda pmi, s: pmi_of(pmi, s['rows'][0])  # noqa: E731

    # Break-even: the first payment by which the interest and PMI saved so far cover the closing costs, financed or not.
    break_even, saved = None, D(0)
    for i, row in enumerate(new['rows']):
        cur_cost = current['rows'][i]['interest'] + pmi_of(cur_pmi, current['rows'][i]) if i < len(current['rows']) else D(0)
        saved += cur_cost - (row['interest'] + pmi_of(new_pmi, row))
        if saved >= closing:
            break_even = i + 1
            break

    current_all = total(current) + pmi_total(cur_pmi, current)
    monthly = current['initial'] + first_pmi(cur_pmi, current) - (new['initial'] + first_pmi(new_pmi, new))
    keep = None
    if monthly > 0:
        k = amortize(principal, new_rate, new_term, extra=lambda p: (monthly, monthly))
        keep = {'numberOfPayments': len(k['rows']), 'totalInterest': interest(k),
                'lifetimeSavings': current_all - (total(k) + pmi_total(new_pmi, k) + upfront) + cash_out}
    return {
        'currentPayment': current['initial'], 'currentInterest': interest(current), 'currentPayments': len(current['rows']),
        'newPayment': new['initial'], 'newInterest': interest(new), 'newPayments': len(new['rows']),
        'currentPmi': pmi_total(cur_pmi, current), 'newPmi': pmi_total(new_pmi, new),
        'monthlySavings': monthly,
        'lifetimeSavings': current_all - (total(new) + pmi_total(new_pmi, new) + upfront) + cash_out,
        'monthsAdded': len(new['rows']) - len(current['rows']),
        'breakEvenPaymentNumber': break_even,
        'keepPayment': keep,
        # Cash taken out is in hand, less what is paid at closing; a cash-out loan above 80% of the value is over the limit.
        'cashOut': cash_out, 'netCash': cash_out - upfront,
        'newLoanToValuePercent': (principal / value * 100).quantize(D('0.01'), rounding=ROUND_HALF_EVEN) if value is not None else None,
        'exceedsCashOutLimit': value is not None and cash_out > 0 and principal > value * D('0.8'),
    }
