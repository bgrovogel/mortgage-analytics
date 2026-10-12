namespace MortgageAnalytics.Domain.Loans;

/// <summary>The kind of loan, which decides its mortgage insurance and upfront fee.</summary>
public enum LoanProgram
{
    /// <summary>A conventional loan: PMI below 20% down, no upfront fee.</summary>
    Conventional = 0,

    /// <summary>An FHA-insured loan: an upfront MIP and an annual MIP, with at least 3.5% down.</summary>
    Fha = 1,

    /// <summary>A VA-guaranteed loan: a funding fee, no mortgage insurance, no minimum down payment.</summary>
    Va = 2,
}

/// <summary>Which VA funding fee applies.</summary>
public enum VaFundingFeeUse
{
    /// <summary>The first VA loan.</summary>
    FirstUse = 0,

    /// <summary>A VA loan after an earlier one: a higher fee with less than 5% down.</summary>
    SubsequentUse = 1,

    /// <summary>No fee: veterans receiving compensation for a service-connected disability, and others the VA exempts.</summary>
    Exempt = 2,
}

/// <summary>
/// An FHA or VA loan's terms: the upfront fee (FHA's upfront MIP, VA's funding fee) on the base loan, the loan with it
/// when it is financed, and FHA's annual MIP and how many payments it is charged on. The rules are HUD's Mortgagee
/// Letter 2023-05 (FHA, case numbers endorsed from 20 March 2023) and the VA's funding fee table (from 7 April 2023).
/// </summary>
/// <param name="Program">FHA or VA.</param>
/// <param name="UpfrontFeePercent">The upfront fee, as a percentage of the base loan.</param>
/// <param name="UpfrontFee">The upfront fee in dollars, to the cent.</param>
/// <param name="UpfrontFeeFinanced">True when the fee is added to the loan; false when it is paid at closing.</param>
/// <param name="LoanAmount">The amount borrowed: the base loan, plus the fee when it is financed.</param>
/// <param name="AnnualMipPercent">FHA's annual MIP rate; zero for VA.</param>
/// <param name="MipPayments">How many payments carry the annual MIP: 132 (11 years) or the whole term; zero for VA.</param>
public sealed record GovernmentLoan(
    LoanProgram Program,
    decimal UpfrontFeePercent,
    decimal UpfrontFee,
    bool UpfrontFeeFinanced,
    decimal LoanAmount,
    decimal AnnualMipPercent,
    int MipPayments)
{
    /// <summary>FHA's smallest down payment, as a percentage of the price (with a credit score of 580 or more).</summary>
    public const decimal FhaMinimumDownPaymentPercent = 3.5m;

    /// <summary>The lowest credit score FHA insures a loan for.</summary>
    public const int FhaMinimumCreditScore = 500;

    /// <summary>The credit score from which FHA's 3.5% minimum down payment applies; below it, 10%.</summary>
    public const int FhaFullFinancingCreditScore = 580;

    /// <summary>FHA's smallest down payment with a credit score from 500 to 579, as a percentage of the price.</summary>
    public const decimal FhaLowScoreMinimumDownPaymentPercent = 10m;

    /// <summary>FHA's upfront MIP, as a percentage of the base loan.</summary>
    public const decimal FhaUpfrontMipPercent = 1.75m;

    /// <summary>A term of 15 years or less has FHA's lower annual MIP.</summary>
    private const int ShortTermMonths = 180;

    /// <summary>At 90% LTV or less, FHA's annual MIP ends after 11 years.</summary>
    private const int ElevenYears = 132;

    /// <summary>An FHA loan for <paramref name="purchase"/>.</summary>
    /// <param name="purchase">The price and down payment, which give the base loan and its LTV.</param>
    /// <param name="termInMonths">The term, which picks the MIP table.</param>
    /// <param name="closingYear">The year the loan closes, whose conforming limit splits the table by loan size.</param>
    /// <param name="financeUpfrontFee">True to add the upfront MIP to the loan, as most borrowers do.</param>
    /// <param name="creditScore">The borrower's decision credit score, or null when it is 580 or more (or unknown).</param>
    /// <param name="countyLimit">The most FHA insures in the home's county (its one-unit limit), or null not to check.</param>
    /// <exception cref="DomainValidationException">
    /// A credit score below 500; less down than the score allows (3.5% from 580, 10% from 500); or a base loan above the
    /// county's limit.
    /// </exception>
    public static GovernmentLoan Fha(
        PropertyPurchase purchase, int termInMonths, int closingYear, bool financeUpfrontFee, int? creditScore = null, decimal? countyLimit = null)
    {
        if (creditScore < FhaMinimumCreditScore)
            throw new DomainValidationException($"FHA insures loans only for credit scores of {FhaMinimumCreditScore} or more.");
        var minimumDown = creditScore < FhaFullFinancingCreditScore ? FhaLowScoreMinimumDownPaymentPercent : FhaMinimumDownPaymentPercent;
        if (purchase.DownPayment < purchase.HomePrice * minimumDown / 100m)
            throw new DomainValidationException($"An FHA loan needs at least {minimumDown}% down with this credit score.");
        if (purchase.LoanAmount > countyLimit)
            throw new DomainValidationException($"FHA insures at most {countyLimit:N0} in this county.");

        var baseLoan = purchase.LoanAmount;
        var ltv = baseLoan / purchase.HomePrice;
        var aboveLimit = baseLoan > ConformingLoanLimit.For(closingYear);
        var (rate, elevenYears) = termInMonths > ShortTermMonths
            ? (ltv <= 0.95m ? (aboveLimit ? 0.70m : 0.50m) : (aboveLimit ? 0.75m : 0.55m), ltv <= 0.90m)
            : (aboveLimit
                ? (ltv <= 0.78m ? 0.15m : ltv <= 0.90m ? 0.40m : 0.65m)
                : (ltv <= 0.90m ? 0.15m : 0.40m), ltv <= 0.90m);

        var fee = Money.Round(baseLoan * FhaUpfrontMipPercent / 100m);
        return new GovernmentLoan(
            LoanProgram.Fha, FhaUpfrontMipPercent, fee, financeUpfrontFee, financeUpfrontFee ? baseLoan + fee : baseLoan,
            rate, elevenYears ? Math.Min(ElevenYears, termInMonths) : termInMonths);
    }

    /// <summary>A VA loan for <paramref name="purchase"/>: the funding fee by down payment and use; no mortgage insurance.</summary>
    /// <param name="purchase">The price and down payment.</param>
    /// <param name="use">First use, later use, or exempt.</param>
    /// <param name="financeUpfrontFee">True to add the funding fee to the loan, as most borrowers do.</param>
    public static GovernmentLoan Va(PropertyPurchase purchase, VaFundingFeeUse use, bool financeUpfrontFee)
    {
        var share = purchase.DownPayment / purchase.HomePrice;
        var rate = use switch
        {
            VaFundingFeeUse.Exempt => 0m,
            _ when share >= 0.10m => 1.25m,
            _ when share >= 0.05m => 1.5m,
            VaFundingFeeUse.FirstUse => 2.15m,
            _ => 3.3m,
        };

        var fee = Money.Round(purchase.LoanAmount * rate / 100m);
        return new GovernmentLoan(
            LoanProgram.Va, rate, fee, financeUpfrontFee, financeUpfrontFee ? purchase.LoanAmount + fee : purchase.LoanAmount, 0m, 0);
    }
}

/// <summary>
/// FHFA's baseline conforming loan limit for one-unit homes. Since HUD Mortgagee Letter 2023-05, it is the base loan
/// amount above which FHA's annual MIP is higher. FHFA sets each year's in November; add it here when it is published.
/// </summary>
public static class ConformingLoanLimit
{
    // One entry for every year from the first, so any year in between has its own.
    private static readonly Dictionary<int, decimal> Limits = new()
    {
        [2023] = 726_200m,
        [2024] = 766_550m,
        [2025] = 806_500m,
        [2026] = 832_750m,
    };

    /// <summary>The limit for <paramref name="year"/>: the latest published for a later year, 2023's for an earlier one.</summary>
    public static decimal For(int year) => Limits[Math.Clamp(year, Limits.Keys.Min(), Limits.Keys.Max())];
}
