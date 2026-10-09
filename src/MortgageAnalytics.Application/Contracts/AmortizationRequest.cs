using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Application.Contracts;

/// <summary>Everything needed to analyze a home purchase and its mortgage.</summary>
public sealed record AmortizationRequest
{
    /// <summary>Purchase price of the home. Also used as the value for property tax, MUD tax and PMI.</summary>
    /// <example>375000</example>
    public decimal HomePrice { get; init; }

    /// <summary>Cash paid up front. The loan amount is the home price minus this.</summary>
    /// <example>18750</example>
    public decimal DownPayment { get; init; }

    /// <summary>Nominal annual interest rate as a percentage (6.5 means 6.5%).</summary>
    /// <example>6.5</example>
    public decimal AnnualInterestRate { get; init; }

    /// <summary>Loan term in months (360 for a 30-year mortgage).</summary>
    /// <example>360</example>
    public int TermInMonths { get; init; }

    /// <summary>Due date of the first payment. Defaults to the first day of next month.</summary>
    /// <example>2026-11-01</example>
    public DateOnly? FirstPaymentDate { get; init; }

    /// <summary>Whether extra principal shortens the loan (default) or, after a qualifying lump sum, lowers the payment through a recast.</summary>
    /// <example>ShortenTerm</example>
    public ExtraPaymentStrategy Strategy { get; init; } = ExtraPaymentStrategy.ShortenTerm;

    /// <summary>The lender's recast terms. Used only when <see cref="Strategy"/> is <see cref="ExtraPaymentStrategy.Recast"/>.</summary>
    public RecastTermsRequest? Recast { get; init; }

    /// <summary>Optional prepayments. Omit to get the standard schedule only.</summary>
    public ExtraPaymentsRequest? ExtraPayments { get; init; }

    /// <summary>Optional taxes, insurance, PMI and dues. Omit to see principal and interest only.</summary>
    public HousingCostsRequest? HousingCosts { get; init; }
}

/// <summary>What the borrower does with extra principal.</summary>
public enum ExtraPaymentStrategy
{
    /// <summary>Keep the monthly payment and pay the loan off sooner.</summary>
    ShortenTerm = 0,

    /// <summary>
    /// Ask the lender to recast after each qualifying lump sum: same payoff date, lower payment.
    /// Smaller extras still shorten the term.
    /// </summary>
    Recast = 1,
}

/// <summary>A lender's conditions for recasting a loan.</summary>
public sealed record RecastTermsRequest
{
    /// <summary>The smallest single lump sum the lender will recast for. Most banks require $10,000.</summary>
    /// <example>10000</example>
    public decimal MinimumLumpSum { get; init; } = 10_000m;

    /// <summary>The lender's fee for each recast.</summary>
    /// <example>250</example>
    public decimal Fee { get; init; } = 250m;
}

/// <summary>Prepayments of principal.</summary>
public sealed record ExtraPaymentsRequest
{
    /// <summary>Extra principal added to every payment.</summary>
    /// <example>200</example>
    public decimal MonthlyAmount { get; init; }

    /// <summary>The payment number the monthly extra starts on.</summary>
    /// <example>1</example>
    public int MonthlyStartingPaymentNumber { get; init; } = 1;

    /// <summary>An optional once-a-year extra payment.</summary>
    public AnnualExtraPaymentRequest? Annual { get; init; }

    /// <summary>One-time extra payments.</summary>
    public IReadOnlyList<LumpSumPaymentRequest> LumpSums { get; init; } = [];
}

/// <summary>An extra payment made once a year.</summary>
/// <param name="Amount" example="2000">Extra principal paid each year.</param>
/// <param name="FirstPaymentNumber" example="12">The payment that carries the first annual extra. It repeats every 12 payments.</param>
public sealed record AnnualExtraPaymentRequest(decimal Amount, int FirstPaymentNumber = 12);

/// <summary>A one-time extra payment.</summary>
/// <param name="PaymentNumber" example="24">The payment the lump sum is made with.</param>
/// <param name="Amount" example="10000">Extra principal paid.</param>
public sealed record LumpSumPaymentRequest(int PaymentNumber, decimal Amount);

/// <summary>Recurring costs of owning the home, paid on top of principal and interest.</summary>
public sealed record HousingCostsRequest
{
    /// <summary>Combined county, city and school tax rate, as an annual percentage of the home's value.</summary>
    /// <example>2.1</example>
    public decimal PropertyTaxRate { get; init; }

    /// <summary>Municipal Utility District tax rate, as an annual percentage. "$0.85 per $100" is entered as 0.85.</summary>
    /// <example>0.85</example>
    public decimal MudTaxRate { get; init; }

    /// <summary>Public Improvement District assessment, if the home is in one.</summary>
    public PidAssessmentRequest? Pid { get; init; }

    /// <summary>Annual homeowners (hazard) insurance premium.</summary>
    /// <example>2400</example>
    public decimal AnnualHomeownersInsurance { get; init; }

    /// <summary>Monthly homeowners association dues.</summary>
    /// <example>75</example>
    public decimal MonthlyHoaDues { get; init; }

    /// <summary>Annual PMI rate as a percentage of the loan. Charged only with less than 20% down.</summary>
    /// <example>0.5</example>
    public decimal PmiRate { get; init; }

    /// <summary>Whether PMI comes off automatically at 78% loan-to-value or on request at 80%.</summary>
    /// <example>Automatic</example>
    public MortgageInsuranceCancellation PmiCancellation { get; init; } = MortgageInsuranceCancellation.Automatic;
}

/// <summary>A Public Improvement District assessment.</summary>
/// <param name="AnnualAssessment" example="1200">The yearly assessment in dollars.</param>
/// <param name="RemainingYears" example="20">Years until the district's bonds are repaid. Omit if it has no end date.</param>
public sealed record PidAssessmentRequest(decimal AnnualAssessment, int? RemainingYears = null);
