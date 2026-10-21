using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Domain.RentOrBuy;

/// <summary>What renting a similar home would cost, and what money does meanwhile.</summary>
/// <param name="MonthlyRent">The rent for a similar home now, a month.</param>
/// <param name="RentIncreasePercent">How much the rent rises each year, as a percentage.</param>
/// <param name="InvestmentReturnPercent">What money invested earns a year, as a percentage, compounded monthly.</param>
/// <param name="MaintenancePercent">What upkeep costs the owner a year, as a percentage of the home's value that year.</param>
/// <param name="SellingCostPercent">What selling the home costs, as a percentage of its value then: commissions and the seller's closing costs.</param>
public sealed record RentOrBuyAssumptions(
    decimal MonthlyRent, decimal RentIncreasePercent, decimal InvestmentReturnPercent, decimal MaintenancePercent, decimal SellingCostPercent)
{
    /// <summary>The most rent accepted, a month.</summary>
    public const decimal MaxMonthlyRent = 1_000_000m;

    /// <summary>Checks the assumptions are ones a market could have.</summary>
    /// <exception cref="DomainValidationException">An assumption is out of range.</exception>
    public RentOrBuyAssumptions Validated()
    {
        if (MonthlyRent is <= 0 or > MaxMonthlyRent)
            throw new DomainValidationException($"Rent must be more than $0 and at most ${MaxMonthlyRent:N0} a month.");
        if (RentIncreasePercent is < -20 or > 20)
            throw new DomainValidationException("Rent must change between -20% and 20% a year.");
        if (InvestmentReturnPercent is < -20 or > 30)
            throw new DomainValidationException("Investments must earn between -20% and 30% a year.");
        if (MaintenancePercent is < 0 or > 10)
            throw new DomainValidationException("Upkeep must be 0% to 10% of the home's value a year.");
        if (SellingCostPercent is < 0 or > 20)
            throw new DomainValidationException("Selling costs must be 0% to 20% of the home's value.");
        return this;
    }
}

/// <summary>
/// One year into renting instead of buying: what each cost that year, and where each household stands at its end.
/// </summary>
/// <param name="Year">The 1-based year.</param>
/// <param name="OwnershipCost">What owning cost that year: the payments (less a buydown's subsidy), the housing costs and upkeep.</param>
/// <param name="Rent">The rent paid that year.</param>
/// <param name="HomeEquity">What selling would leave the buyer at the year's end: the home's value, less what is owed and selling costs.</param>
/// <param name="BuyerInvestments">The buyer's savings by then: whatever owning cost less than renting, invested.</param>
/// <param name="RenterInvestments">The renter's savings by then: the cash a purchase would have taken to close, and whatever renting cost less, invested.</param>
/// <param name="TaxSaved">The federal income tax owning saved that year (see <see cref="OwnerTaxProfile"/>); the buyer invests it as it is saved. Zero when no tax profile was given.</param>
public sealed record RentOrBuyYear(
    int Year, decimal OwnershipCost, decimal Rent, decimal HomeEquity, decimal BuyerInvestments, decimal RenterInvestments, decimal TaxSaved = 0m)
{
    /// <summary>What the buyer has: the home's equity after selling costs, and their investments.</summary>
    public decimal BuyerNetWorth => HomeEquity + BuyerInvestments;

    /// <summary>What the renter has: their investments.</summary>
    public decimal RenterNetWorth => RenterInvestments;

    /// <summary>How far buying is ahead of renting; negative while renting is ahead.</summary>
    public decimal Advantage => BuyerNetWorth - RenterNetWorth;
}

/// <summary>
/// Renting against buying, year by year, for households that spend the same: each month, whichever of owning and
/// renting costs less invests the difference, and the renter also invests what buying would have taken to close.
/// The buyer is worth the home (less what is owed and what selling costs) plus their investments; the renter, their
/// investments. Taxes on investment gains are left out, as are extra payments: they are an investment choice, like the
/// renter's. The mortgage interest deduction is counted only when an <see cref="OwnerTaxProfile"/> is given.
/// </summary>
public static class RentOrBuyComparison
{
    /// <summary>The most years compared.</summary>
    public const int MaxYears = 30;

    /// <summary>Each year compared: up to 30, or the loan's own term when that is shorter.</summary>
    /// <param name="assumptions">Renting's cost, and what money earns.</param>
    /// <param name="cashToClose">What buying takes at closing, which the renter invests instead.</param>
    /// <param name="loan">The loan, at its note rate.</param>
    /// <param name="schedule">Its standard schedule, without extra payments.</param>
    /// <param name="costs">The housing costs charged with each payment.</param>
    /// <param name="buydown">A temporary buydown whose subsidy pays part of the early payments, or null.</param>
    /// <param name="valuation">The home's market value, year by year.</param>
    /// <param name="tax">How the owner's income tax differs from a renter's, or null to leave tax out.</param>
    public static IReadOnlyList<RentOrBuyYear> Years(
        RentOrBuyAssumptions assumptions, decimal cashToClose, LoanTerms loan, AmortizationSchedule schedule, HousingCostSchedule costs,
        TemporaryBuydown? buydown, PropertyValuation valuation, OwnerTaxProfile? tax = null)
    {
        assumptions.Validated();
        tax?.Validated();
        var monthlyGrowth = 1m + assumptions.InvestmentReturnPercent / 100m / 12m;
        var (buyer, renter) = (0m, cashToClose);
        var years = new List<RentOrBuyYear>();

        for (var year = 1; year <= Math.Min(MaxYears, schedule.NumberOfPayments / 12); year++)
        {
            var value = valuation.MarketValueInYear(year - 1);
            var upkeep = Money.Round(value * assumptions.MaintenancePercent / 100m / 12m);
            var rent = Growth.Compound(assumptions.MonthlyRent, assumptions.RentIncreasePercent, year - 1);
            var (owned, rented) = (0m, 0m);
            var taxSaved = tax is null ? 0m : TaxSavedIn(tax, year, loan, schedule, costs);

            foreach (var payment in schedule.Payments.Skip((year - 1) * 12).Take(12))
            {
                var owning = payment.TotalPaid + costs.Periods[payment.PaymentNumber - 1].Total + upkeep
                    - (buydown?.SubsidyFor(loan, payment.PaymentNumber, payment.ScheduledAmount) ?? 0m);
                // The year's tax saving is felt as the year goes: a twelfth of it each month the owner pays less than they would have.
                var felt = owning - taxSaved / 12m;
                buyer = buyer * monthlyGrowth + Math.Max(0m, rent - felt);
                renter = renter * monthlyGrowth + Math.Max(0m, felt - rent);
                owned += owning;
                rented += rent;
            }

            var sold = valuation.MarketValueInYear(year);
            var owed = schedule.Payments[year * 12 - 1].RemainingBalance;
            years.Add(new RentOrBuyYear(
                year, owned, rented, sold - owed - Money.Round(sold * assumptions.SellingCostPercent / 100m), Money.Round(buyer), Money.Round(renter), taxSaved));
        }
        return years;
    }

    /// <summary>The tax owning saves in a year: the interest paid (up to the limit on the debt) and the property tax charged, against a renter's deductions.</summary>
    private static decimal TaxSavedIn(OwnerTaxProfile tax, int year, LoanTerms loan, AmortizationSchedule schedule, HousingCostSchedule costs)
    {
        var months = schedule.Payments.Skip((year - 1) * 12).Take(12).ToList();
        var balanceAtStart = year == 1 ? loan.Principal : schedule.Payments[(year - 1) * 12 - 1].RemainingBalance;
        var interest = TaxDeductions.DeductibleInterest(months.Sum(p => p.Interest), balanceAtStart);
        var propertyTax = months.Sum(p => PropertyTaxIn(costs.Periods[p.PaymentNumber - 1]));
        return tax.TaxSavedByOwning(year, interest, propertyTax);
    }

    private static decimal PropertyTaxIn(HousingCostBreakdown month) =>
        month[HousingCostCategory.PropertyTax] + month[HousingCostCategory.SchoolTax] + month[HousingCostCategory.LocalTax] + month[HousingCostCategory.MudTax];

    /// <summary>The first year from which buying is ahead (or level) every year after, or null when it never is for good.</summary>
    /// <param name="years">The years compared.</param>
    public static int? BreakEvenYear(IReadOnlyList<RentOrBuyYear> years)
    {
        int? since = null;
        foreach (var year in years)
            since = year.Advantage >= 0 ? since ?? year.Year : null;
        return since;
    }
}
