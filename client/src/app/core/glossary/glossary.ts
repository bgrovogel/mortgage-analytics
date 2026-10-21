import { msg, t } from '../i18n/i18n';

/** A term the app uses, and what it means in a sentence or two. */
export interface GlossaryEntry {
  term: string;
  meaning: string;
}

/** In alphabetical order (a spec holds it there), so a reader can find a term without a search box. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Amortization', get meaning() { return t('Paying a loan off in equal installments. Early payments are mostly interest and later ones mostly principal, so the balance falls slowly at first.'); } },
  { term: msg('Appraisal cap'), get meaning() { return t('A limit on how fast the taxable value of a homestead can rise in a year (10% in Texas), even when the market rises faster, so its tax bill climbs more slowly than the market does.'); } },
  { term: msg('APR'), get meaning() { return t('Annual percentage rate: the yearly cost of the loan counting its fees as well as its rate, so offers with different fees can be compared. It is higher than the rate whenever there are fees to count.'); } },
  { term: msg('ARM'), get meaning() { return t('An adjustable-rate mortgage. The rate is fixed for the first years (a 5/1 ARM for five), then resets on a schedule, within caps on how far it can move at once and over the loan.'); } },
  { term: 'Buydown', get meaning() { return t('Money paid up front to lower the payment: for the first years only (a temporary buydown such as 2-1), or for the whole loan (discount points).'); } },
  { term: 'Closing costs', get meaning() { return t('What is paid on the day the loan is made besides the down payment: the lender’s fees, title and recording, prepaid interest, and the first deposits into escrow.'); } },
  { term: msg('Co-buyer'), get meaning() { return t('Someone buying the home with you. A lender counts everyone’s income and debts together, and each person puts in a share of the down payment.'); } },
  { term: 'Debt-to-income', get meaning() { return t('Your monthly debts, with the new housing payment, as a share of your gross monthly income. Lenders limit it: 28% and 36% is the classic comfortable measure, and a conventional loan may go to 45%.'); } },
  { term: 'Down payment', get meaning() { return t('The part of the price you pay in cash. The loan is the price less the down payment.'); } },
  { term: msg('Equity'), get meaning() { return t('What you own of the home: its value less what you still owe on it.'); } },
  { term: msg('Escrow'), get meaning() { return t('An account the lender holds to pay your property tax and insurance. A twelfth of each year’s bill goes in with every payment.'); } },
  { term: 'Exemption', get meaning() { return t('A part of the home’s value that a taxing authority does not tax, such as the $140,000 a Texas school district exempts from a homestead.'); } },
  { term: 'FHA loan', get meaning() { return t('A loan insured by the Federal Housing Administration, with as little as 3.5% down. It carries an upfront mortgage insurance premium and a yearly one.'); } },
  { term: msg('HOA'), get meaning() { return t('A homeowners association, which charges dues for shared parts of a community. They count in your monthly housing cost.'); } },
  { term: msg('Homestead'), get meaning() { return t('The home you live in as your principal residence. In Texas it earns exemptions from property tax and a cap on how fast its taxable value can rise.'); } },
  { term: 'Loan-to-value', get meaning() { return t('The loan as a share of the home’s value. 90% means 10% down. Rules about PMI, loan limits and what a seller may pay all turn on it.'); } },
  { term: msg('MIP'), get meaning() { return t('The mortgage insurance premium on an FHA loan: a fee at the start and a yearly charge. Unlike PMI it often lasts for the whole loan.'); } },
  { term: msg('MUD'), get meaning() { return t('A Municipal Utility District: a Texas special district that levies its own tax on the homes inside it, on top of the county and school taxes, to pay for water, sewer and drainage.'); } },
  { term: msg('Note rate'), get meaning() { return t('The interest rate written on the loan. The APR is what it costs once fees are counted.'); } },
  { term: msg('Passkey'), get meaning() { return t('A way to sign in with your device’s fingerprint, face or screen lock instead of a password. The device keeps the private key; the site keeps only the public half, so there is nothing to steal or guess.'); } },
  { term: msg('PID'), get meaning() { return t('A Public Improvement District: a Texas district that bills the homes inside it a yearly assessment for streets, lighting or amenities, usually for some years after they were built.'); } },
  { term: msg('PMI'), get meaning() { return t('Private mortgage insurance on a conventional loan with less than 20% down. It protects the lender, and ends when you reach 80% of the home’s value (if you ask) or 78% (automatically).'); } },
  { term: 'Points', get meaning() { return t('A fee paid at closing for a lower rate. One point is 1% of the loan.'); } },
  { term: 'Prepaid interest', get meaning() { return t('The interest from the day you close to the end of that month, paid at closing because payments are made in arrears.'); } },
  { term: 'Principal', get meaning() { return t('The part of the loan you still owe, apart from interest. Each payment pays some of it down.'); } },
  { term: msg('Recast'), get meaning() { return t('Recalculating the payment after a large lump sum, so the same term has a smaller payment. Lenders charge a fee and ask for a minimum lump sum.'); } },
  { term: 'Tax ceiling', get meaning() { return t('For owners 65 or older (or disabled), a limit that freezes the school tax at what it was in the year they qualified, even as the home’s value rises.'); } },
  { term: 'VA loan', get meaning() { return t('A loan guaranteed by the Department of Veterans Affairs for eligible veterans and service members, with no down payment and no mortgage insurance, but a one-time funding fee.'); } },
];

/** A term's anchor: "Loan-to-value" is `term-loan-to-value`. */
export const glossaryAnchor = (term: string) => `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
