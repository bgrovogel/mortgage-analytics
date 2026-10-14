"""
Sends random households (seeded, so every run is the same) to the live API and compares every number in each
response with the independent model in calculator_model.py:

- POST /api/v1/amortization/calculate: both schedules row by row (principal, interest, extra, each cost, the
  outlay, the balance, the rate, the buydown subsidy, the due date), every total, PMI's end, the payoff, the
  recasts and rate changes, the savings, the yearly projection, the buydown table, the ARM's worst case and the
  cash to close.
- POST /api/v1/refinance/analyze: both loans, keeping today's payment, lifetime savings, months added, break-even.

    dotnet run --project src/MortgageAnalytics.Api      # the API on http://localhost:5080
    python tools/calculator-check/compare_with_api.py   # expect every household identical
"""
import json
import random
import sys
import urllib.error
import urllib.request
from datetime import date
from decimal import Decimal as D

from calculator_model import FHA_LIMITS, analyze, refinance

API = 'http://localhost:5080/api/v1'


def post(path, body):
    request = urllib.request.Request(f'{API}/{path}', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read(), parse_float=D, parse_int=D)
    except urllib.error.HTTPError as error:
        return {'__error__': error.code, 'body': error.read().decode()[:400]}


def differences(expected, actual, path='$'):
    """Every place `actual` differs from `expected`; keys the model does not produce are not compared."""
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            yield f'{path}: expected an object, got {actual!r}'
            return
        for key, value in expected.items():
            if key not in actual:
                yield f'{path}.{key}: missing from the response'
            else:
                yield from differences(value, actual[key], f'{path}.{key}')
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            yield f'{path}: expected {len(expected)} items, got {len(actual) if isinstance(actual, list) else actual!r}'
            return
        for i, (e, a) in enumerate(zip(expected, actual)):
            yield from differences(e, a, f'{path}[{i}]')
    elif isinstance(expected, bool) or expected is None or isinstance(expected, str):
        if expected != actual:
            yield f'{path}: expected {expected!r}, got {actual!r}'
    elif D(expected) != D(actual):
        yield f'{path}: expected {expected}, got {actual}'


def money(rng, low, high, step=1):
    return rng.randrange(low // step, high // step + 1) * step


def random_purchase(rng):
    price = money(rng, 120_000, 1_500_000, 1_000)
    # Some high rates too, where a small down payment keeps PMI to the loan's midpoint.
    rate = D(rng.randrange(250, 900) if rng.random() < 0.85 else rng.randrange(900, 1400)) / 100
    term = rng.choice([120, 180, 240, 300, 360, 360, 360])
    first = rng.choice([None, '2026-11-01', '2026-11-01', '2023-04-01', '2019-08-01'])
    single = rng.random() < 0.5
    homestead = rng.random() < 0.7
    request = {
        'homePrice': price,
        'downPayment': int(price * rng.choice([3, 5, 5, 10, 15, 19.99, 20, 25, 40]) / 100),
        'annualInterestRate': float(rate),
        'termInMonths': term,
        'firstPaymentDate': first,
        'strategy': 'ShortenTerm',
        'recast': None,
        'extraPayments': {
            'monthlyAmount': rng.choice([0, 0, 100, 200, 450, 1_200]),
            'monthlyStartingPaymentNumber': rng.choice([1, 1, 13, 40]),
            'annual': rng.choice([None, {'amount': money(rng, 500, 10_000, 100), 'firstPaymentNumber': rng.randint(1, 24)}]),
            'lumpSums': [{'paymentNumber': rng.randint(1, term // 2), 'amount': money(rng, 1_000, 60_000, 500)} for _ in range(rng.choice([0, 0, 1, 2, 3]))],
        },
        'housingCosts': {
            'propertyTaxRate': float(D(rng.randrange(80, 300)) / 100) if single else 0,
            'propertyTaxHomesteadExemption': money(rng, 0, 100_000, 5_000) if single else 0,
            'schoolTaxRate': 0 if single else float(D(rng.randrange(60, 130)) / 100),
            'localTaxRate': 0 if single else float(D(rng.randrange(0, 120)) / 100),
            'mudTaxRate': 0 if single else rng.choice([0, 0.5, 0.85, 1.1]),
            'isHomestead': homestead,
            'schoolHomesteadExemption': rng.choice([100_000, 140_000]),
            'localHomesteadExemptionPercent': rng.choice([0, 0, 10, 20]),
            'mudHomesteadExemptionPercent': rng.choice([0, 0, 10]),
            'homesteadAssessmentCap': rng.choice([10, 10, 5, 100]),
            'over65OrDisabled': None if single or rng.random() < 0.6 else {
                'qualifiesInYear': rng.randint(1, min(15, term // 12)), 'schoolExemption': 60_000,
                'localExemption': rng.choice([0, 10_000]), 'localTaxCeiling': rng.random() < 0.5},
            'homeValueGrowthRate': float(D(rng.randrange(-200, 800)) / 100),
            'insuranceIncreaseRate': float(D(rng.randrange(0, 800)) / 100),
            'hoaIncreaseRate': float(D(rng.randrange(0, 600)) / 100),
            'pid': rng.choice([None, None, {'annualAssessment': money(rng, 500, 3_000, 50), 'remainingYears': rng.choice([None, 5, 20])}]),
            'annualHomeownersInsurance': money(rng, 0, 4_000, 50),
            'monthlyHoaDues': money(rng, 0, 300, 5),
            'pmiRate': rng.choice([0, 0.3, 0.5, 0.85, 1.2]),
            'pmiCancellation': rng.choice(['Automatic', 'BorrowerRequested']),
        },
        'buydown': None,
        'adjustableRate': None,
        # Sometimes none, sometimes credits larger than the costs, so unused credits are checked too; the seller's large
        # enough at times to pass the limit, with or without a buydown they pay for.
        'closingCosts': None if rng.random() < 0.2 else {
            'loanCosts': money(rng, 0, 12_000, 25), 'otherFees': money(rng, 0, 5_000, 25),
            'prepaidInterestDays': rng.randint(0, 31), 'escrowMonths': rng.randint(0, 14),
            'credits': rng.choice([0, 0, money(rng, 500, 10_000, 100), money(rng, 10_000, 30_000, 100), 50_000]),
            'lenderCredits': rng.choice([0, 0, 0, money(rng, 500, 5_000, 100)]),
        },
    }
    # FHA (at least 3.5% down) or VA (any down payment), neither with PMI; the fee financed or paid at closing.
    program = rng.choice(['Conventional', 'Conventional', 'Fha', 'Va'])
    if program != 'Conventional':
        request['program'] = {'type': program, 'financeUpfrontFee': rng.random() < 0.8,
                              'vaUse': rng.choice(['FirstUse', 'SubsequentUse', 'Exempt']) if program == 'Va' else None}
        request['housingCosts']['pmiRate'] = 0
        if program == 'Fha':
            # Half at the 3.5% minimum, the usual FHA purchase (over 95% LTV); the rest with their own down payment.
            minimum = int(price * 35 / 1000) + 1
            request['downPayment'] = minimum if rng.random() < 0.5 else max(request['downPayment'], minimum)
            # Sometimes a credit score (from 500 to 579, 10% down), and a county whose limit the loan is within.
            if rng.random() < 0.3:
                request['program']['creditScore'] = rng.randint(500, 579)
                request['downPayment'] = max(request['downPayment'], int(price / 10) + 1)
            elif rng.random() < 0.3:
                request['program']['creditScore'] = rng.randint(580, 850)
            fitting = [f for f, c in FHA_LIMITS['counties'].items() if c['limit'] >= price - request['downPayment']]
            if fitting and rng.random() < 0.5:
                request['program']['countyFips'] = rng.choice(sorted(fitting))
        elif rng.random() < 0.4:
            request['downPayment'] = 0
    # Tax rates that change: a few later years, each changing one or more of the taxes charged.
    costs = request['housingCosts']
    charged = [k for k in ('propertyTaxRate', 'schoolTaxRate', 'localTaxRate', 'mudTaxRate') if costs[k]]
    if charged and rng.random() < 0.4:
        years = sorted(rng.sample(range(2, term // 12 + 1), rng.randint(1, 3)))
        costs['rateChanges'] = [dict({'fromYear': y}, **{k: float(D(costs[k]) * D(rng.randrange(80, 121)) / 100)
                                                          for k in rng.sample(charged, rng.randint(1, len(charged)))})
                                for y in years]
        for change in costs['rateChanges']:
            for k in charged:
                if k in change:
                    change[k] = float(D(str(change[k])).quantize(D('0.0001')))
    if costs['over65OrDisabled'] and rng.random() < 0.4:
        costs['over65OrDisabled']['transferredCeilingPercent'] = rng.choice([25, 40, 62.5, 100])
    if rng.random() < 0.3:
        request['strategy'] = 'Recast'
        request['recast'] = {'minimumLumpSum': money(rng, 5_000, 20_000, 500), 'fee': money(rng, 0, 500, 50)}
    kind = rng.random()
    # Points on a fixed rate (with or without a buydown): sometimes a good deal, sometimes one that never pays back.
    if kind < 0.45 and rng.random() < 0.4:
        request['discountPoints'] = {'points': rng.choice([0.5, 1, 1.375, 2, 3]),
                                     'rateWithoutPoints': float(rate + D(rng.choice([1, 12, 25, 50, 75])) / 100)}
    if kind < 0.2 and rate > 3:
        request['buydown'] = {'yearlyReductions': rng.choice([[1], [2, 1], [3, 2, 1], [1, 1]])}
        request['buydownPaidBy'] = rng.choice(['Seller', 'Borrower'])
    elif kind < 0.45 and 'discountPoints' not in request:
        fixed = rng.choice([60, 84, 120])
        if fixed < term:
            caps = rng.choice([(2, 1, 5), (5, 2, 5), (2, 2, 5), (5, 1, 5)])
            margin = rng.choice([None, 2.75, 2.0])
            request['adjustableRate'] = {
                'initialFixedMonths': fixed, 'adjustmentIntervalMonths': rng.choice([12, 6]),
                'expectedRate': float(D(rng.randrange(200, 1100)) / 100),
                'initialCap': caps[0], 'periodicCap': caps[1], 'lifetimeCap': caps[2],
                'margin': margin if margin is None or margin <= rate else None,
            }
    return request


def random_refinance(rng):
    request = {
        'currentBalance': money(rng, 50_000, 900_000, 1_000),
        'currentAnnualInterestRate': float(D(rng.randrange(300, 900)) / 100),
        'remainingTermInMonths': rng.randint(60, 360),
        'newAnnualInterestRate': float(D(rng.randrange(250, 850)) / 100),
        'newTermInMonths': rng.choice([120, 180, 240, 300, 360]),
        'closingCosts': money(rng, 0, 15_000, 250),
        'financeClosingCosts': rng.random() < 0.4,
    }
    # Half with a home value, so PMI on either loan: from well under 80% of it to well over.
    if rng.random() < 0.5:
        request['homeValue'] = int(request['currentBalance'] / rng.choice([0.6, 0.75, 0.79, 0.82, 0.9, 0.97]))
        request['currentMonthlyPmi'] = rng.choice([0, 0, 85.5, 150, 240])
        request['newPmiRate'] = rng.choice([0.3, 0.5, 0.85])
    return request


def refinance_view(r):
    """The refinance response in the model's shape."""
    keep = r.get('keepingCurrentPayment')
    return {
        'currentPayment': r['current']['monthlyPayment'], 'currentInterest': r['current']['totalInterest'],
        'currentPayments': r['current']['numberOfPayments'],
        'newPayment': r['refinanced']['monthlyPayment'], 'newInterest': r['refinanced']['totalInterest'],
        'newPayments': r['refinanced']['numberOfPayments'],
        'currentPmi': r['current']['totalPmi'], 'newPmi': r['refinanced']['totalPmi'],
        'monthlySavings': r['monthlySavings'], 'lifetimeSavings': r['lifetimeSavings'], 'monthsAdded': r['monthsAdded'],
        'breakEvenPaymentNumber': r['breakEvenPaymentNumber'],
        'keepPayment': keep and {'numberOfPayments': keep['numberOfPayments'], 'totalInterest': keep['totalInterest'],
                                 'lifetimeSavings': r['keepingCurrentPaymentLifetimeSavings']},
    }


def main(count=300):
    rng = random.Random(20261011)
    today = date.today()
    identical, rejected, failures = 0, 0, []
    for i in range(count):
        request = random_purchase(rng)
        response = post('amortization/calculate', request)
        if '__error__' in response:
            rejected += 1
            failures.append((f'purchase {i}: rejected {response["__error__"]}', [response['body']], request))
            continue
        problems = list(differences(analyze(request, today), response))
        if problems:
            failures.append((f'purchase {i}', problems, request))
        else:
            identical += 1
    print(f'Purchases: {identical} of {count} identical in every field ({rejected} rejected by validation)')

    ref_identical = 0
    for i in range(count):
        request = random_refinance(rng)
        response = post('refinance/analyze', request)
        if '__error__' in response:
            failures.append((f'refinance {i}: rejected {response["__error__"]}', [response['body']], request))
            continue
        problems = list(differences(refinance(request), refinance_view(response)))
        if problems:
            failures.append((f'refinance {i}', problems, request))
        else:
            ref_identical += 1
    print(f'Refinances: {ref_identical} of {count} identical in every field')

    for name, problems, request in failures[:5]:
        print(f'\n{name}: {len(problems)} difference(s)')
        for p in problems[:8]:
            print('   ', p)
        print('    request:', json.dumps(request))
    return 0 if not failures else 1


if __name__ == '__main__':
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 300))
