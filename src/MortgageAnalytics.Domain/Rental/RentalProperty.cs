namespace MortgageAnalytics.Domain.Rental;

/// <summary>What letting the home out would bring in, and cost besides owning it.</summary>
/// <param name="MonthlyRent">The rent now, a month.</param>
/// <param name="VacancyPercent">The share of the year's rent lost to empty months and unpaid rent, as a percentage.</param>
/// <param name="ManagementPercent">What a property manager is paid, as a percentage of the rent collected; 0 for a landlord who manages it.</param>
/// <param name="MaintenancePercent">What repairs and upkeep cost a year, as a percentage of the home's value that year.</param>
/// <param name="RentIncreasePercent">How much the rent rises each year, as a percentage.</param>
public sealed record RentalAssumptions(
    decimal MonthlyRent, decimal VacancyPercent, decimal ManagementPercent, decimal MaintenancePercent, decimal RentIncreasePercent)
{
    /// <summary>The most rent accepted, a month.</summary>
    public const decimal MaxMonthlyRent = 1_000_000m;

    /// <summary>The most vacancy accepted, as a percentage of the rent.</summary>
    public const decimal MaxVacancyPercent = 50m;

    /// <summary>The most a manager can be paid, as a percentage of the rent collected.</summary>
    public const decimal MaxManagementPercent = 25m;

    /// <summary>The most upkeep accepted, as a percentage of the home's value a year.</summary>
    public const decimal MaxMaintenancePercent = 10m;

    /// <summary>Checks the assumptions are ones a market could have.</summary>
    /// <exception cref="DomainValidationException">An assumption is out of range.</exception>
    public RentalAssumptions Validated()
    {
        if (MonthlyRent is <= 0 or > MaxMonthlyRent)
            throw new DomainValidationException($"Rent must be more than $0 and at most ${MaxMonthlyRent:N0} a month.");
        if (VacancyPercent is < 0 or > MaxVacancyPercent)
            throw new DomainValidationException($"Vacancy must be 0% to {MaxVacancyPercent}% of the rent.");
        if (ManagementPercent is < 0 or > MaxManagementPercent)
            throw new DomainValidationException($"Management must be 0% to {MaxManagementPercent}% of the rent collected.");
        if (MaintenancePercent is < 0 or > MaxMaintenancePercent)
            throw new DomainValidationException($"Upkeep must be 0% to {MaxMaintenancePercent}% of the home's value a year.");
        if (RentIncreasePercent is < -20 or > 20)
            throw new DomainValidationException("Rent must change between -20% and 20% a year.");
        return this;
    }
}

/// <summary>
/// One year of letting the home out. The rent less vacancy is what is collected; less the manager, upkeep and the taxes,
/// insurance and dues of owning, it is the net operating income; less the loan's payments, the cash flow.
/// </summary>
/// <param name="Year">The 1-based year.</param>
/// <param name="GrossRent">The rent if the home were let every month.</param>
/// <param name="VacancyLoss">The rent lost to vacancy.</param>
/// <param name="ManagementFee">What the property manager is paid.</param>
/// <param name="Maintenance">Repairs and upkeep.</param>
/// <param name="OperatingCosts">Property taxes, assessments, insurance and dues: what owning costs besides the loan.</param>
/// <param name="NetOperatingIncome">What the property earns before the loan.</param>
/// <param name="DebtService">The loan's payments: principal, interest and mortgage insurance, less any buydown's subsidy.</param>
/// <param name="CashFlow">What is left after the loan; negative when the owner has to add money.</param>
public sealed record RentalYear(
    int Year, decimal GrossRent, decimal VacancyLoss, decimal ManagementFee, decimal Maintenance, decimal OperatingCosts,
    decimal NetOperatingIncome, decimal DebtService, decimal CashFlow)
{
    /// <summary>Works out one year.</summary>
    /// <param name="year">The 1-based year.</param>
    /// <param name="assumptions">The rent and what the property costs to let.</param>
    /// <param name="homeValue">The home's value that year, which upkeep is a share of.</param>
    /// <param name="operatingCosts">The year's property taxes, assessments, insurance and dues.</param>
    /// <param name="debtService">The year's loan payments.</param>
    /// <exception cref="DomainValidationException">An assumption is out of range.</exception>
    public static RentalYear For(int year, RentalAssumptions assumptions, decimal homeValue, decimal operatingCosts, decimal debtService)
    {
        assumptions.Validated();
        var gross = Growth.Compound(assumptions.MonthlyRent, assumptions.RentIncreasePercent, year - 1) * 12m;
        var vacancy = Money.Round(gross * assumptions.VacancyPercent / 100m);
        var collected = gross - vacancy;
        var management = Money.Round(collected * assumptions.ManagementPercent / 100m);
        var maintenance = Money.Round(homeValue * assumptions.MaintenancePercent / 100m);
        var income = collected - management - maintenance - operatingCosts;
        return new RentalYear(year, gross, vacancy, management, maintenance, operatingCosts, income, debtService, income - debtService);
    }
}

/// <summary>The measures an investor reads a rental by, from its first year.</summary>
/// <param name="CapRatePercent">The net operating income as a percentage of the price: what the property earns, whatever it cost to buy with.</param>
/// <param name="CashOnCashPercent">The cash flow as a percentage of the cash put in; null when none was.</param>
/// <param name="DebtServiceCoverage">The net operating income over the loan's payments; lenders want 1.25 or more. Null without a loan.</param>
/// <param name="GrossRentMultiplier">The price over a year's gross rent.</param>
/// <param name="RentToPricePercent">A month's rent as a percentage of the price (the "1% rule" looks for 1).</param>
/// <param name="BreakEvenMonthlyRent">The rent at which the first year's cash flow is nothing.</param>
public sealed record RentalReturns(
    decimal CapRatePercent, decimal? CashOnCashPercent, decimal? DebtServiceCoverage, decimal GrossRentMultiplier, decimal RentToPricePercent,
    decimal BreakEvenMonthlyRent)
{
    /// <summary>The measures for a rental's first year.</summary>
    /// <param name="assumptions">The rent and what the property costs to let.</param>
    /// <param name="first">Its first year.</param>
    /// <param name="price">What the home costs.</param>
    /// <param name="cashInvested">What the buyer puts in: the down payment and closing costs.</param>
    public static RentalReturns From(RentalAssumptions assumptions, RentalYear first, decimal price, decimal cashInvested)
    {
        // Cash flow is nil when the rent kept after vacancy and the manager pays for upkeep, operating costs and the loan.
        var kept = (1m - assumptions.VacancyPercent / 100m) * (1m - assumptions.ManagementPercent / 100m);
        var breakEven = (first.Maintenance + first.OperatingCosts + first.DebtService) / kept / 12m;

        return new RentalReturns(
            Money.Round(first.NetOperatingIncome / price * 100m),
            cashInvested > 0 ? Money.Round(first.CashFlow / cashInvested * 100m) : null,
            first.DebtService > 0 ? Money.Round(first.NetOperatingIncome / first.DebtService) : null,
            Money.Round(price / first.GrossRent),
            Money.Round(assumptions.MonthlyRent / price * 100m),
            Money.Round(breakEven));
    }
}
