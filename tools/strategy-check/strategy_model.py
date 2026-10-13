"""
An independent model of the Pay off or invest comparison, in Python Decimal, written from the rules rather
than translated from the C# engine. See README.md in this folder.
"""
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_CEILING
import math, datetime, json, sys

C = D('0.01')
def r2(x): return x.quantize(C, rounding=ROUND_HALF_UP)
def rnd(x, places): return x.quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)

STANDARD = {'single': D(16100), 'mfj': D(32200), 'hoh': D(24150)}
MARGIN = {'conservative': D(4), 'balanced': D(2), 'aggressive': D(0)}

def monthly_factor(annual):
    f = math.pow(1 + float(annual / 100), 1 / 12)
    return rnd(D(format(f, '.15g')), 10)

def payment(p, rate, n):
    r = rate / 100 / 12
    if r == 0: return r2(p / n)
    g = (1 + r) ** n
    return r2(p * r * g / (g - 1))

def add_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return datetime.date(d.year + y, mo + 1, d.day)

def deductible(interest, balance):
    return interest if balance <= 750000 else r2(interest * 750000 / balance)

def deductible_pmi(pmi, agi):
    # From 2026 PMI is deductible as mortgage interest: 10% less for each $1,000 (or part) of AGI above $100,000.
    steps = (max(D(0), agi - 100000) / 1000).to_integral_value(rounding=ROUND_CEILING)
    return r2(pmi * max(D(0), 1 - steps / 10))

def tax_saved(h, ded, price=D(1)):
    # standard deduction and other deductions rise with prices; interest does not
    above = r2(h['other'] * price) + ded - r2(STANDARD[h['status']] * price)
    return r2(min(max(above, D(0)), ded) * h['tax'] / 100)

def cash_plan(i):
    h = i['h']; avail = h['cash']; after = 1 - h['tax'] / 100
    pay = payment(i['balance'], i['rate'], i['term'])
    contrib = D(0)
    if i['match'] > 0 and i['upto'] > 0 and after > 0:
        full = min(h['income'] * i['upto'] / 100, D(24500)) / 12
        contrib = r2(min(full, avail / after))
    cost = min(r2(contrib * after), avail)
    match = r2(contrib * i['match'] / 100)
    espp = D(0)
    if i['espp_pct'] > 0:
        chosen = h['income'] * i['espp_pct'] / 100 / 12
        limit = D(25000) * (100 - i['espp_disc']) / 100 / 12
        espp = min(r2(min(chosen, limit)), avail - cost)
    return dict(pay=pay, contrib=contrib, match=match, cost=cost, espp=espp, extra=avail - cost - espp)

def interest_on(bal, rate): return r2(bal * rate / 1200)

# Adjustable rates and buydowns: the rules in tools/rate-check/rate_model.py. An ARM's path is a list of
# (first payment, rate); at each change the balance is re-amortized over the payments left. A buydown's subsidy
# pays the gap between the note payment and the year's reduced payment (on the original amount, full term).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rate-check'))
from rate_model import arm_path  # noqa: E402

def rate_for(i, m):
    rate = i['rate']
    for first, r in i['changes']:
        if first <= m: rate = r
    return rate

def subsidy(i, m, scheduled):
    year = (m - 1) // 12 + 1
    if year > len(i['buydown']): return D(0)
    note = payment(i['balance'], i['rate'], i['term'])
    reduced = payment(i['balance'], max(D(0), i['rate'] - i['buydown'][year - 1]), i['term'])
    return min(note - reduced, scheduled)

class Mortgage:
    # The required payment month by month: at the note rate, re-amortized at each rate change.
    def __init__(self, i):
        self.i = i; self.rate = i['rate']; self.pay = payment(i['balance'], i['rate'], i['term'])
    def pay_month(self, m, bal):
        r = rate_for(self.i, m)
        if r != self.rate:
            self.pay = payment(bal, r, self.i['term'] - m + 1); self.rate = r
        it = interest_on(bal, self.rate)
        pr = bal if m >= self.i['term'] else min(self.pay - it, bal)
        return it, pr, subsidy(self.i, m, it + pr)

def average_rate(i):
    return r2(sum(rate_for(i, m) for m in range(1, i['term'] + 1)) / i['term'])

def rates(i, plan):
    h = i['h']; after = 1 - h['tax'] / 100
    bal = i['balance']; fy = D(0); mortgage = Mortgage(i)
    for m in range(1, min(12, i['term']) + 1):
        if bal <= 0: break
        it, pr, _ = mortgage.pay_month(m, bal); fy += it
        bal -= pr
    ded = deductible(fy, i['balance'])
    std = STANDARD[h['status']]
    deducted = h['other'] + ded > std
    avg = average_rate(i)
    # Paying down earns the rate, less the share of the interest the deduction actually gives back: all of it at the
    # full tax rate only when every dollar is deducted; a little when itemizing barely beats the standard deduction.
    ts = tax_saved(h, ded)
    atm = r2(avg * (1 - ts / fy)) if fy > 0 else avg
    ra = i['ret'] - MARGIN[i['risk']]
    disc = 12 * (plan['extra'] + plan['espp']) + (h['rsu'] if h['sell_rsu'] else D(0))
    sheltered = D(100) if disc == 0 else (min(D(1), i['ira'] / disc) * 100).quantize(D(1), rounding=ROUND_HALF_UP)
    if ra <= 0 or h['cg'] == 0:
        taxable = ra
    else:
        n = i['term'] / 12
        grow = (1 + float(ra) / 100) ** n
        kept = grow - (grow - 1) * float(h['cg']) / 100
        taxable = rnd(D(format((kept ** (1 / n) - 1) * 100, '.15g')), 2)
    atr = r2((sheltered * ra + (100 - sheltered) * taxable) / 100)
    target = min(max((50 + 25 * (atr - atm)).quantize(D(1), rounding=ROUND_HALF_UP), D(0)), D(100))
    auto = (D(0) if h['sell_rsu'] else h['rsu']) + h['esop']
    if disc == 0: hyb = target
    else:
        hyb = ((target / 100 * (auto + disc) - auto) / disc * 100).quantize(D(1), rounding=ROUND_HALF_UP)
        hyb = min(max(hyb, D(0)), D(100))
    sub_total = sum(subsidy(i, m, payment(i['balance'], i['rate'], i['term'])) for m in range(1, 12 * len(i['buydown']) + 1))
    return dict(first_year_interest=fy, first_year_tax_saved=tax_saved(h, ded), deducted=deducted, sheltered=sheltered, taxable=taxable,
                average_rate=avg, buydown_subsidy=sub_total,
                after_tax_mortgage=atm, risk_adjusted=ra, after_tax_market=atr, target=target, hybrid=hyb)

def simulate(i, invest, scenario):
    h = i['h']; plan = cash_plan(i); after = 1 - h['tax'] / 100
    ret, bad_years = scenario
    ret_b = D(-1)
    retire = h['retire']; roth = D(0); taxable = h['invest']; basis = h['invest']
    def at_value():
        gains = max(D(0), taxable - basis)
        return r2(retire * after) + roth + taxable - r2(gains * h['cg'] / 100)
    bal = i['balance']; bal_ys = bal
    tot_i = D(0); tot_t = D(0); i_year = D(0); saved = D(0); room = D(0)
    payoff = None; cross = 0 if at_value() >= bal else None
    mortgage = Mortgage(i)
    # The monthly budget is what the household pays on the mortgage now (less any buydown subsidy) plus the extra
    # cash: a reset that raises the payment leaves less to put to work, a lower one more.
    budget = plan['pay'] - subsidy(i, 1, plan['pay'])
    # PMI on the statement, until the balance is 80% of today's home value; paid from the same budget.
    removal = i['home'] * D('0.8')
    pmi_of = lambda b: i['pmi'] if i['pmi'] > 0 and b > removal else D(0)  # noqa: E731
    budget += pmi_of(bal)
    agi = h['income'] - plan['contrib'] * 12
    tot_pmi = D(0); pmi_year = D(0); last_pmi = None
    def year_end(y):
        home = i['home'] if (i['growth'] == 0 or y == 0) else r2(i['home'] * (1 + i['growth'] / 100) ** y)
        inv = at_value() + saved; nw = home - bal + inv
        return dict(year=y, home=home, balance=bal, investments=inv, net_worth=nw,
                    todays=r2(nw / (1 + i['infl'] / 100) ** y))
    years = [year_end(0)]
    for m in range(1, 361):
        y = (m + 11) // 12
        if m % 12 == 1: room = i['ira']
        g = monthly_factor(ret_b if y <= bad_years else ret)
        retire = r2(retire * g); roth = r2(roth * g); taxable = r2(taxable * g)
        cash = plan['extra']
        if bal > 0:
            pmi = pmi_of(bal)
            it, pr, sub = mortgage.pay_month(m, bal)
            bal -= pr; tot_i += it; i_year += it
            tot_pmi += pmi; pmi_year += pmi
            if pmi > 0: last_pmi = m
            cash += budget - (it + pr - sub) - pmi
        else:
            cash += budget
        retire += plan['contrib'] + plan['match']
        if plan['espp'] > 0:
            saved += plan['espp']
            if m % i['espp_period'] == 0:
                proceeds = r2(saved * 100 / (100 - i['espp_disc']))
                cash += proceeds - r2((proceeds - saved) * h['tax'] / 100)
                saved = D(0)
        if m % 12 == 0:
            ded = deductible(i_year, bal_ys) + deductible_pmi(pmi_year, agi)
            ts = tax_saved(h, ded, (1 + i['infl'] / 100) ** (y - 1)); tot_t += ts; cash += ts; i_year = D(0); pmi_year = D(0)
            retire += h['esop']
            if h['sell_rsu']: cash += h['rsu']
            else: taxable += h['rsu']; basis += h['rsu']
        if bal > 0 and cash > 0:
            to_m = min(r2(cash * (100 - invest) / 100), bal); bal -= to_m; cash -= to_m
        to_ira = min(max(cash, D(0)), room); room -= to_ira; roth += to_ira
        taxable += cash - to_ira; basis += cash - to_ira
        if bal == 0 and payoff is None: payoff = m
        if cross is None and at_value() + saved >= bal: cross = m
        if m % 12 == 0:
            years.append(year_end(y)); bal_ys = bal
    return dict(years=years, total_interest=tot_i, total_tax_saved=tot_t, payoff=payoff,
                payoff_date=add_months(i['first'], payoff - 1) if payoff else None,
                cross=cross, cross_date=add_months(i['first'], cross - 1) if cross else None,
                total_pmi=tot_pmi, pmi_end=add_months(i['first'], last_pmi - 1) if last_pmi else None)

def compare(i):
    plan = cash_plan(i); rt = rates(i, plan)
    ra = rt['risk_adjusted']
    scen = {'expected': (i['ret'], 0), 'risk': (ra, 0), 'bad': (ra, 10)}
    out = {}
    for kind, inv in (('payoff', D(0)), ('invest', D(100)), ('hybrid', rt['hybrid'])):
        out[kind] = {k: simulate(i, inv, s) for k, s in scen.items()}
    return plan, rt, out

def household(**kw):
    h = dict(income=D(120000), tax=D(17), cg=D(20), status='mfj', other=D(14000), cash=D(1000),
             rsu=D(0), sell_rsu=False, esop=D(0), retire=D(50000), invest=D(20000))
    h.update(kw); return h

def inputs(**kw):
    i = dict(balance=D(300000), rate=D('6.5'), term=300, changes=[], buydown=[], first=datetime.date(2026, 1, 1), home=D(400000),
             growth=D('4.3'), h=household(), match=D(50), upto=D(6), espp_pct=D(0), espp_disc=D(15),
             espp_period=6, ira=D(7500), ret=D(10), infl=D(3), risk='balanced', pmi=D(0))
    h = kw.pop('h', {}); arm = kw.pop('arm', None); i.update(kw); i['h'] = household(**h)
    if arm:  # (fixed months, interval, expected, initial cap, periodic cap, lifetime cap)
        f, n, e, c1, c2, c3 = arm
        i['changes'] = arm_path(i['rate'], i['term'], f, n, D(e), D(c1), D(c2), D(c3))
    return i

SCENARIOS = {
    'Typical': inputs(),
    'StockHeavy': inputs(h=dict(rsu=D(30000), esop=D(5000))),
    'Itemizer': inputs(balance=D(700000), rate=D(7), term=360, home=D(900000), h=dict(status='single', other=D(28000), income=D(250000), tax=D(29), cg=D('23.8'), cash=D(3000))),
    'WithEspp': inputs(espp_pct=D(10), h=dict(cash=D(2000))),
    'Conservative': inputs(risk='conservative'),
    'EsppEvery5': inputs(espp_pct=D(10), espp_period=5, h=dict(cash=D(2000))),
    # A 7/1 ARM with 5 years still fixed, expected to reset to 8.5% (caps 2/1/5), and a 2-1 buydown on a new loan.
    'Arm': inputs(arm=(60, 12, '8.5', '2', '1', '5')),
    'Buydown': inputs(term=360, buydown=[D(2), D(1)]),
}

if __name__ == '__main__':
    for name, i in SCENARIOS.items():
        plan, rt, out = compare(i)
        print('==', name)
        print(' plan', {k: str(v) for k, v in plan.items()})
        print(' rates', {k: str(v) for k, v in rt.items()})
        for kind, sc in out.items():
            for k, s in sc.items():
                y = s['years']
                print(f"  {kind:7} {k:8} nw5={y[5]['net_worth']} nw10={y[10]['net_worth']} nw30={y[30]['net_worth']} today30={y[30]['todays']} inv30={y[30]['investments']} bal10={y[10]['balance']} int={s['total_interest']} tax={s['total_tax_saved']} payoff={s['payoff']} {s['payoff_date']} cross={s['cross']} {s['cross_date']}")
