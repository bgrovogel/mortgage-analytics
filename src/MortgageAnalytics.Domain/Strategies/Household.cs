namespace MortgageAnalytics.Domain.Strategies;

/// <summary>The money side of the comparison: income, taxes, the cash to put to work, and what is already saved.</summary>
public sealed record Household
{
    /// <summary>The largest dollar amount accepted for any field.</summary>
    public const decimal MaxAmount = 100_000_000m;

    /// <summary>The highest tax rate accepted, as a percentage.</summary>
    public const decimal MaxTaxRate = 60m;

    /// <summary>Creates a household, rejecting any value outside the supported range.</summary>
    /// <param name="grossAnnualIncome">Pay before tax; the 401(k) match and ESPP are set as a share of it.</param>
    /// <param name="marginalTaxRate">Federal plus state tax on the next dollar earned, as a percentage.</param>
    /// <param name="capitalGainsTaxRate">Tax on long-term gains in a taxable account, as a percentage.</param>
    /// <param name="filingStatus">How the household files, which sets the standard deduction.</param>
    /// <param name="otherItemizedDeductions">Itemized deductions other than mortgage interest (state and local taxes up to the cap, charity), per year.</param>
    /// <param name="monthlyCashToPutToWork">Take-home cash left each month after the mortgage payment and living costs.</param>
    /// <param name="annualRsuVesting">What vesting RSUs are worth each year, after the tax withheld at vest.</param>
    /// <param name="sellRsusAtVest">True to sell RSUs as they vest and use the cash like any other; false to keep them as shares.</param>
    /// <param name="annualEsopContribution">What the employer puts into an employee stock ownership plan each year (pre-tax retirement money).</param>
    /// <param name="currentRetirementSavings">What is in 401(k)s and traditional IRAs today (pre-tax money).</param>
    /// <param name="currentInvestments">Taxable investments today, vested RSUs included.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public Household(
        decimal grossAnnualIncome,
        decimal marginalTaxRate,
        decimal capitalGainsTaxRate,
        FilingStatus filingStatus,
        decimal otherItemizedDeductions,
        decimal monthlyCashToPutToWork,
        decimal annualRsuVesting = 0m,
        bool sellRsusAtVest = false,
        decimal annualEsopContribution = 0m,
        decimal currentRetirementSavings = 0m,
        decimal currentInvestments = 0m)
    {
        RequireAmount(grossAnnualIncome, "Gross annual income");
        RequireRate(marginalTaxRate, "Marginal tax rate");
        RequireRate(capitalGainsTaxRate, "Capital gains tax rate");
        if (!Enum.IsDefined(filingStatus))
            throw new DomainValidationException($"Unknown filing status {filingStatus}.");
        RequireAmount(otherItemizedDeductions, "Other itemized deductions");
        RequireAmount(monthlyCashToPutToWork, "Monthly cash to put to work");
        RequireAmount(annualRsuVesting, "Yearly RSU vesting");
        RequireAmount(annualEsopContribution, "Yearly ESOP contribution");
        RequireAmount(currentRetirementSavings, "Current retirement savings");
        RequireAmount(currentInvestments, "Current investments");

        GrossAnnualIncome = grossAnnualIncome;
        MarginalTaxRate = marginalTaxRate;
        CapitalGainsTaxRate = capitalGainsTaxRate;
        FilingStatus = filingStatus;
        OtherItemizedDeductions = otherItemizedDeductions;
        MonthlyCashToPutToWork = monthlyCashToPutToWork;
        AnnualRsuVesting = annualRsuVesting;
        SellRsusAtVest = sellRsusAtVest;
        AnnualEsopContribution = annualEsopContribution;
        CurrentRetirementSavings = currentRetirementSavings;
        CurrentInvestments = currentInvestments;
    }

    /// <summary>Pay before tax.</summary>
    public decimal GrossAnnualIncome { get; }

    /// <summary>Federal plus state tax on the next dollar earned, as a percentage.</summary>
    public decimal MarginalTaxRate { get; }

    /// <summary>Tax on long-term gains in a taxable account, as a percentage.</summary>
    public decimal CapitalGainsTaxRate { get; }

    /// <summary>How the household files.</summary>
    public FilingStatus FilingStatus { get; }

    /// <summary>Itemized deductions other than mortgage interest, per year.</summary>
    public decimal OtherItemizedDeductions { get; }

    /// <summary>Take-home cash left each month after the mortgage payment and living costs.</summary>
    public decimal MonthlyCashToPutToWork { get; }

    /// <summary>What vesting RSUs are worth each year, after the tax withheld at vest.</summary>
    public decimal AnnualRsuVesting { get; }

    /// <summary>True when RSUs are sold as they vest; false when they are kept as shares.</summary>
    public bool SellRsusAtVest { get; }

    /// <summary>What the employer puts into an ESOP each year.</summary>
    public decimal AnnualEsopContribution { get; }

    /// <summary>
    /// What goes into the market each year whatever the strategy: RSUs kept as shares and ESOP contributions.
    /// (The 401(k) and its match are added by <see cref="MonthlyCashPlan"/>.)
    /// </summary>
    public decimal AnnualAutomaticStock => (SellRsusAtVest ? 0m : AnnualRsuVesting) + AnnualEsopContribution;

    /// <summary>Pre-tax retirement savings today.</summary>
    public decimal CurrentRetirementSavings { get; }

    /// <summary>Taxable investments today, vested RSUs included.</summary>
    public decimal CurrentInvestments { get; }

    /// <summary>What a dollar of income keeps after tax, as a fraction (0.76 at a 24% rate).</summary>
    public decimal AfterTaxShare => 1 - MarginalTaxRate / 100m;

    private static void RequireAmount(decimal amount, string name)
    {
        if (amount is < 0 or > MaxAmount)
            throw new DomainValidationException($"{name} must be between 0 and {MaxAmount:N0}.");
    }

    private static void RequireRate(decimal rate, string name)
    {
        if (rate is < 0 or > MaxTaxRate)
            throw new DomainValidationException($"{name} must be between 0 and {MaxTaxRate}%.");
    }
}
