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

    /// <summary>
    /// The tax the mortgage interest saves in a year: the tax on the part of itemized deductions above the
    /// standard deduction, but never more than the tax on the interest itself.
    /// </summary>
    /// <param name="household">Filing status, tax rate and other itemized deductions.</param>
    /// <param name="deductibleInterest">Deductible mortgage interest for the year.</param>
    /// <returns>Zero when taking the standard deduction is better.</returns>
    public static decimal TaxSavedByInterest(Household household, decimal deductibleInterest)
    {
        var aboveStandard = household.OtherItemizedDeductions + deductibleInterest - StandardDeduction(household.FilingStatus);
        var deducted = Math.Clamp(aboveStandard, 0m, deductibleInterest);
        return Money.Round(deducted * household.MarginalTaxRate / 100m);
    }
}
