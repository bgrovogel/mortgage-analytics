"""
An independent model of adjustable rates and temporary buydowns, written from the rules (not from the C#), that
prints the reference values pinned in tests/MortgageAnalytics.Domain.Tests/Loans/AdjustableRateTests.cs and
TemporaryBuydownTests.cs.

Rules: interest each month = balance x rate / 1200, rounded half away from zero to the cent; the payment is the
standard annuity payment, rounded the same way; at a rate change the opening balance is re-amortized over the
payments left; the final scheduled payment clears the balance. ARM resets move toward the expected rate by at
most the cap for that reset (initial, then periodic), and stay within the lifetime cap of the starting rate.
A buydown year's payment is the payment on the original amount, over the full term, at the reduced rate.
"""
from decimal import Decimal as D, ROUND_HALF_UP

CENT = D('0.01')


def money(x):
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


def payment(principal, annual_rate, n):
    r = annual_rate / D(1200)
    if r == 0:
        return money(principal / n)
    g = (1 + r) ** n
    return money(principal * r * g / (g - 1))


def arm_path(initial, term, fixed, interval, expected, initial_cap, periodic_cap, lifetime_cap, margin=None):
    # With a margin, the rate never falls below it (and the lifetime cap only limits the rise); without one, the
    # lifetime cap limits the fall as well. Each reset moves by at most its cap first.
    floor = min(margin, initial) if margin is not None else max(D(0), initial - lifetime_cap)
    ceiling = min(D(30), initial + lifetime_cap)
    rate, changes = initial, []
    p = fixed + 1
    while p <= term:
        cap = initial_cap if p == fixed + 1 else periodic_cap
        nxt = min(max(min(max(expected, rate - cap), rate + cap), floor), ceiling)
        if nxt != rate:
            changes.append((p, nxt))
        rate = nxt
        p += interval
    return changes


def schedule(principal, initial, term, changes):
    rates = dict(changes)
    rate, pay = initial, payment(principal, initial, term)
    balance, total_interest, events = principal, D(0), []
    for period in range(1, term + 1):
        if period in rates and rates[period] != rate:
            new = payment(balance, rates[period], term - period + 1)
            events.append((period, rate, rates[period], pay, new))
            rate, pay = rates[period], new
        interest = money(balance * rate / D(1200))
        principal_paid = balance if period == term else min(pay - interest, balance)
        balance -= principal_paid
        total_interest += interest
        if balance <= 0:
            break
    return events, total_interest, period


def show_arm(name, *, expected, caps):
    principal, initial, term = D(200000), D(6), 360
    path = arm_path(initial, term, 84, 12, D(expected), *[D(c) for c in caps])
    events, interest, payments = schedule(principal, initial, term, path)
    print(name, 'path', [(p, str(r)) for p, r in path])
    for e in events:
        print('   change at', e[0], str(e[1]), '->', str(e[2]), 'payment', e[3], '->', e[4])
    print('   total interest', interest, 'payments', payments)


if __name__ == '__main__':
    print('Fixed 6%: payment', payment(D(200000), D(6), 360))
    show_arm('7/1 ARM to 7.5% (caps 5/2/5)', expected='7.5', caps=('5', '2', '5'))
    show_arm('7/1 ARM to 9% (caps 2/1/5)', expected='9', caps=('2', '1', '5'))
    show_arm('7/1 ARM worst case (caps 2/2/5)', expected='11', caps=('2', '2', '5'))
    show_arm('7/1 ARM down to 4% (caps 2/1/5)', expected='4', caps=('2', '1', '5'))

    loan, note = D(356250), D('5.99')
    note_payment = payment(loan, note, 360)
    y1, y2 = payment(loan, D('3.99'), 360), payment(loan, D('4.99'), 360)
    print('2-1 buydown on $356,250 at 5.99%: note payment', note_payment, 'year 1', y1, 'year 2', y2,
          'subsidy', (note_payment - y1) * 12 + (note_payment - y2) * 12)
