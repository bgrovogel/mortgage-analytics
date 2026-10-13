namespace MortgageAnalytics.Domain.Strategies;

/// <summary>How a household files its federal return, which sets its standard deduction.</summary>
public enum FilingStatus
{
    /// <summary>Single filer.</summary>
    SingleFiler = 0,

    /// <summary>Married, filing one joint return.</summary>
    MarriedFilingJointly = 1,

    /// <summary>Head of household.</summary>
    HeadOfHousehold = 2,
}

/// <summary>
/// What deducting mortgage interest is really worth. A deduction only saves tax on the amount by which
/// itemized deductions (mortgage interest plus everything else) beat the standard deduction, so the
/// first several thousand dollars of interest often save nothing. Figures are for 2026 (IRS Rev. Proc. 2025-32).
/// </summary>
public static class TaxDeductions
{
    /// <summary>Interest is deductible only on this much mortgage debt (acquisition debt after 15 December 2017).</summary>
    public const decimal DeductibleDebtLimit = 750_000m;

    /// <summary>The standard deduction for <paramref name="status"/>.</summary>
    /// <param name="status">How the household files.</param>
    public static decimal StandardDeduction(FilingStatus status) => status switch
    {
        FilingStatus.SingleFiler => 16_100m,
        FilingStatus.MarriedFilingJointly => 32_200m,
        FilingStatus.HeadOfHousehold => 24_150m,
        _ => throw new DomainValidationException($"Unknown filing status {status}."),
    };

    /// <summary>
    /// The mortgage interest that can be deducted: all of it on a loan up to $750,000, and the matching share
    /// of it on a larger one.
    /// </summary>
    /// <param name="interest">Interest paid in the year.</param>
    /// <param name="balance">The loan balance at the start of the year.</param>
    public static decimal DeductibleInterest(decimal interest, decimal balance) =>
        balance <= DeductibleDebtLimit ? interest : Money.Round(interest * DeductibleDebtLimit / balance);

    /// <summary>The adjusted gross income above which the PMI deduction starts to phase out.</summary>
    public const decimal PmiPhaseOutStart = 100_000m;

    /// <summary>
    /// The PMI that can be deducted as mortgage interest (from 2026, IRC 163(h)(3)(E), made permanent by the One Big
    /// Beautiful Bill Act): all of it up to $100,000 of adjusted gross income, then 10% less for each $1,000, or part
    /// of $1,000, above that, so none from $110,000. The limit is not indexed to inflation.
    /// </summary>
    /// <param name="pmi">PMI paid in the year.</param>
    /// <param name="adjustedGrossIncome">The household's adjusted gross income.</param>
    public static decimal DeductiblePmi(decimal pmi, decimal adjustedGrossIncome)
    {
        var steps = Math.Ceiling(Math.Max(0m, adjustedGrossIncome - PmiPhaseOutStart) / 1_000m);
        return Money.Round(pmi * Math.Max(0m, 1m - steps / 10m));
    }

    /// <summary>
    /// The tax the mortgage interest saves in a year: the tax on the part of itemized deductions above the
    /// standard deduction, but never more than the tax on the interest itself.
    /// </summary>
    /// <remarks>
    /// The standard deduction is indexed to inflation by law, and the other deductions (property and state
    /// taxes, charity) tend to rise with prices too, so both grow by <paramref name="priceLevel"/>. Mortgage
    /// interest does not: it falls as the balance does. Over the years, then, the interest deduction is worth less.
    /// </remarks>
    /// <param name="household">Filing status, tax rate and other itemized deductions (in today's dollars).</param>
    /// <param name="deductibleInterest">Deductible mortgage interest for the year.</param>
    /// <param name="priceLevel">Prices relative to today: 1 in the first year, (1 + inflation)ⁿ⁻¹ in year n.</param>
    /// <returns>Zero when taking the standard deduction is better.</returns>
    public static decimal TaxSavedByInterest(Household household, decimal deductibleInterest, decimal priceLevel = 1m)
    {
        var standard = Money.Round(StandardDeduction(household.FilingStatus) * priceLevel);
        var other = Money.Round(household.OtherItemizedDeductions * priceLevel);
        var aboveStandard = other + deductibleInterest - standard;
        var deducted = Math.Clamp(aboveStandard, 0m, deductibleInterest);
        return Money.Round(deducted * household.MarginalTaxRate / 100m);
    }
}
