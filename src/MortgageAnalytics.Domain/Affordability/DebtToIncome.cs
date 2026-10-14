using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Affordability;

/// <summary>
/// A household's debt-to-income ratios: the housing payment (principal, interest, taxes, insurance, mortgage insurance
/// and dues), and it with the other monthly debts, each as a share of gross monthly income. Lenders qualify a buyer by
/// these.
/// </summary>
/// <param name="MonthlyIncome">Gross income a month, before taxes.</param>
/// <param name="MonthlyDebts">Other debts a month: car, student and personal loans, card minimums, support.</param>
/// <param name="HousingPayment">The home's monthly payment as a lender counts it.</param>
public sealed record DebtToIncome(decimal MonthlyIncome, decimal MonthlyDebts, decimal HousingPayment)
{
    /// <summary>The housing payment as a percentage of income (the "front-end" ratio), to two decimals.</summary>
    public decimal HousingPercent => Percent(HousingPayment);

    /// <summary>The housing payment and the debts as a percentage of income (the "back-end" ratio), to two decimals.</summary>
    public decimal TotalPercent => Percent(HousingPayment + MonthlyDebts);

    private decimal Percent(decimal payment) => Math.Round(payment / MonthlyIncome * 100m, 2, MidpointRounding.AwayFromZero);
}

/// <summary>
/// A limit on debt-to-income: the most of income the housing payment may take, if anything limits it alone, and the
/// most it may take with the other debts.
/// </summary>
/// <param name="HousingPercent">The most for housing, as a percentage of income; null when only the total is limited.</param>
/// <param name="TotalPercent">The most for housing and the other debts together.</param>
public sealed record DebtToIncomeLimit(decimal? HousingPercent, decimal TotalPercent)
{
    /// <summary>The classic rule of thumb: 28% of income for housing, 36% with every debt.</summary>
    public static DebtToIncomeLimit Comfortable { get; } = new(28m, 36m);

    /// <summary>
    /// The most a loan program allows on a manually underwritten loan. Conventional: 45% in all, for a borrower with
    /// the credit score and reserves Fannie Mae asks (Selling Guide B3-6-02; its automated underwriting may go to 50%).
    /// FHA: 31% for housing and 43% in all (HUD's manual underwriting rule; Mortgagee Letter 2014-02 lets compensating
    /// factors raise them to 37%/47% and 40%/50%). VA: 41% in all (38 CFR 36.4340); above it, VA asks for 20% more
    /// residual income than its guideline.
    /// </summary>
    /// <param name="program">The loan's program.</param>
    public static DebtToIncomeLimit MostAllowed(LoanProgram program) => program switch
    {
        LoanProgram.Fha => new(31m, 43m),
        LoanProgram.Va => new(null, 41m),
        _ => new(null, 45m),
    };

    /// <summary>The most the housing payment may be, to the cent below, and never less than nothing.</summary>
    /// <param name="monthlyIncome">Gross income a month.</param>
    /// <param name="monthlyDebts">The other debts a month.</param>
    public decimal MaxHousingPayment(decimal monthlyIncome, decimal monthlyDebts)
    {
        decimal Share(decimal percent) => monthlyIncome * percent / 100m;
        var most = Share(TotalPercent) - monthlyDebts;
        if (HousingPercent is { } housing)
            most = Math.Min(most, Share(housing));
        return Math.Max(0m, Math.Floor(most * 100m) / 100m);
    }

    /// <summary>True when a housing payment is within the limit.</summary>
    /// <param name="monthlyIncome">Gross income a month.</param>
    /// <param name="monthlyDebts">The other debts a month.</param>
    /// <param name="housingPayment">The home's monthly payment as a lender counts it.</param>
    public bool Allows(decimal monthlyIncome, decimal monthlyDebts, decimal housingPayment) =>
        housingPayment <= MaxHousingPayment(monthlyIncome, monthlyDebts);
}
