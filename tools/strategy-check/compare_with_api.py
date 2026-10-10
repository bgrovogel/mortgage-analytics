"""Random households through the live API, compared field by field with the independent model. See README.md."""
import json, random, urllib.request, datetime
from decimal import Decimal as D
from strategy_model import compare, inputs as model_inputs

STATUS = {'single': 'Single', 'mfj': 'MarriedFilingJointly', 'hoh': 'HeadOfHousehold'}
RISK = {'conservative': 'Conservative', 'balanced': 'Balanced', 'aggressive': 'Aggressive'}
KIND = {'payoff': 'PayOffFirst', 'invest': 'InvestTheDifference', 'hybrid': 'Hybrid'}
SCEN = {'expected': 'expected', 'risk': 'riskAdjusted', 'bad': 'badDecade'}


def money(lo, hi, step=1):
    return D(random.randrange(lo // step, hi // step + 1) * step)


def household(rng):
    i = model_inputs(
        balance=money(20_000, 1_500_000, 1000), rate=D(random.randrange(0, 1001)) / 100, term=random.randrange(12, 361),
        first=datetime.date(2026, random.randrange(1, 13), 1), home=money(0, 2_000_000, 1000), growth=D(random.randrange(-50, 101)) / 10,
        match=D(random.choice([0, 25, 50, 100, 150])), upto=D(random.choice([0, 3, 4, 6, 10])),
        espp_pct=D(random.choice([0, 0, 5, 10, 15])), espp_disc=D(random.choice([0, 5, 10, 15])), espp_period=random.choice([1, 3, 5, 6, 7, 12, 27]),
        ira=money(0, 7_500, 500), ret=D(random.randrange(-50, 151)) / 10, infl=D(random.randrange(-10, 61)) / 10,
        risk=random.choice(list(RISK)),
        h=dict(income=money(0, 600_000, 1000), tax=D(random.randrange(0, 51)), cg=D(random.choice([0, 15, 20, 24])),
               status=random.choice(list(STATUS)), other=money(0, 60_000, 500), cash=money(0, 8_000, 50),
               rsu=money(0, 80_000, 1000) if random.random() < .4 else D(0), sell_rsu=random.random() < .5,
               esop=money(0, 20_000, 500) if random.random() < .3 else D(0),
               retire=money(0, 800_000, 1000), invest=money(0, 500_000, 1000)))
    return i


def request(i):
    h = i['h']
    return dict(currentBalance=float(i['balance']), annualInterestRate=float(i['rate']), remainingTermInMonths=i['term'],
                nextPaymentDate=i['first'].isoformat(), homeValue=float(i['home']), homeGrowthRate=float(i['growth']),
                grossAnnualIncome=float(h['income']), marginalTaxRate=float(h['tax']), capitalGainsTaxRate=float(h['cg']),
                filingStatus=STATUS[h['status']], otherItemizedDeductions=float(h['other']), monthlyCashToPutToWork=float(h['cash']),
                employerMatchPercent=float(i['match']), matchUpToPercentOfPay=float(i['upto']), esppContributionPercent=float(i['espp_pct']),
                esppDiscountPercent=float(i['espp_disc']), esppPurchasePeriodMonths=i['espp_period'], annualIraContribution=float(i['ira']),
                annualRsuVesting=float(h['rsu']), sellRsusAtVest=h['sell_rsu'], annualEsopContribution=float(h['esop']),
                currentRetirementSavings=float(h['retire']), currentInvestments=float(h['invest']), expectedAnnualReturn=float(i['ret']),
                inflationRate=float(i['infl']), riskProfile=RISK[i['risk']])


def call(body):
    req = urllib.request.Request('http://localhost:5080/api/v1/strategies/compare', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req))


def check(i, api, problems):
    plan, rates, out = compare(i)
    def same(label, mine, theirs):
        if theirs is None and mine is None: return
        if mine is None or theirs is None or D(str(theirs)) != D(mine):
            problems.append(f'{label}: model {mine} api {theirs}')
    for k, a in (('pay', 'mortgagePayment'), ('contrib', 'retirementContribution'), ('match', 'employerMatch'),
                 ('cost', 'retirementContributionCost'), ('espp', 'esppContribution'), ('extra', 'extraCash')):
        same(f'plan.{a}', plan[k], api['plan'][a])
    for k, a in (('first_year_interest', 'firstYearInterest'), ('first_year_tax_saved', 'firstYearTaxSaved'), ('after_tax_mortgage', 'afterTaxMortgageRate'),
                 ('risk_adjusted', 'riskAdjustedReturn'), ('sheltered', 'iraShelteredPercent'), ('taxable', 'taxableAfterTaxReturn'),
                 ('after_tax_market', 'afterTaxRiskAdjustedReturn'), ('target', 'targetInvestPercent'), ('hybrid', 'hybridInvestPercent')):
        same(f'rates.{a}', rates[k], api['rates'][a])
    if bool(rates['deducted']) != api['rates']['interestIsDeducted']:
        problems.append('rates.interestIsDeducted')
    finals = {}
    for kind, scen in out.items():
        o = next(x for x in api['strategies'] if x['strategy'] == KIND[kind])
        for s, m in scen.items():
            p = o[SCEN[s]]
            tag = f'{kind}.{s}'
            same(f'{tag}.totalInterest', m['total_interest'], p['totalInterest'])
            same(f'{tag}.totalTaxSaved', m['total_tax_saved'], p['totalTaxSaved'])
            same(f'{tag}.payoffMonth', m['payoff'], p['payoffMonth'])
            same(f'{tag}.crossoverMonth', m['cross'], p['crossoverMonth'])
            if (m['payoff_date'].isoformat() if m['payoff_date'] else None) != p['payoffDate']:
                problems.append(f'{tag}.payoffDate')
            for y, ay in zip(m['years'], p['years']):
                for k, a in (('home', 'homeValue'), ('balance', 'mortgageBalance'), ('investments', 'investments'),
                             ('net_worth', 'netWorth'), ('todays', 'netWorthInTodaysDollars')):
                    same(f'{tag}.year{y["year"]}.{a}', y[k], ay[a])
            finals[(kind, s)] = m['years'][-1]['net_worth']
    # The ranking: highest risk-adjusted net worth, ties to the earlier strategy.
    order = ['payoff', 'invest', 'hybrid']
    best = max(order, key=lambda k: (finals[(k, 'risk')], -order.index(k)))
    if KIND[best] != api['recommended']:
        problems.append(f'recommended: model {best} api {api["recommended"]}')
    bad = max(order, key=lambda k: (finals[(k, 'bad')], -order.index(k)))
    if KIND[bad] != api['badDecadeWinner']:
        problems.append(f'badDecadeWinner: model {bad} api {api["badDecadeWinner"]}')


if __name__ == '__main__':
    random.seed(20261010)
    total, failed, fields = 300, 0, 0
    for n in range(total):
        i = household(random)
        api = call(request(i))
        problems = []
        check(i, api, problems)
        fields += 1
        if problems:
            failed += 1
            if failed <= 5:
                print(f'household {n}: {len(problems)} differences, e.g. {problems[:4]}')
    print(f'{total} random households: {total - failed} identical in every field, {failed} with differences')
