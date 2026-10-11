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

    /// <summary>
    /// Nominal annual interest rate as a percentage (6.5 means 6.5%). With a <see cref="Buydown"/> it is the note
    /// rate, the one the loan amortizes at; with an <see cref="AdjustableRate"/>, the starting rate.
    /// </summary>
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

    /// <summary>A temporary buydown (2-1, 3-2-1...): lower payments for the first years. Omit for none.</summary>
    public TemporaryBuydownRequest? Buydown { get; init; }

    /// <summary>An adjustable rate (ARM): the rate resets after a fixed period. Omit for a fixed rate.</summary>
    public AdjustableRateRequest? AdjustableRate { get; init; }
}

/// <summary>
/// A temporary buydown: for the first years the payment is figured at a lower rate, and a subsidy (usually paid
/// up front by the seller or builder) covers the difference. The loan itself stays at the note rate.
/// </summary>
public sealed record TemporaryBuydownRequest
{
    /// <summary>How many points below the note rate each year is paid at, year 1 first: [2, 1] is a 2-1 buydown.</summary>
    /// <example>[2, 1]</example>
    public IReadOnlyList<decimal> YearlyReductions { get; init; } = [];
}

/// <summary>
/// An adjustable rate: <see cref="AmortizationRequest.AnnualInterestRate"/> for a fixed period, then a reset at
/// each interval toward the rate expected, as far as the caps allow ("5/2/5": first reset, later resets, lifetime).
/// </summary>
public sealed record AdjustableRateRequest
{
    /// <summary>How many payments the starting rate lasts: 84 for a 7/1 or 7/6 ARM.</summary>
    /// <example>84</example>
    public int InitialFixedMonths { get; init; } = 84;

    /// <summary>How often the rate resets after that, in months: 12, or 6 for most newer (SOFR) ARMs.</summary>
    /// <example>12</example>
    public int AdjustmentIntervalMonths { get; init; } = 12;

    /// <summary>The rate each reset moves toward: an assumption about the index plus the margin, as a percentage.</summary>
    /// <example>7.5</example>
    public decimal ExpectedRate { get; init; }

    /// <summary>The most the first reset can move the rate, in points.</summary>
    /// <example>5</example>
    public decimal InitialCap { get; init; } = 5m;

    /// <summary>The most each later reset can move the rate, in points.</summary>
    /// <example>1</example>
    public decimal PeriodicCap { get; init; } = 1m;

    /// <summary>The most the rate can ever differ from the starting rate, in points.</summary>
    /// <example>5</example>
    public decimal LifetimeCap { get; init; } = 5m;
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

/// <summary>Recurring costs of owning the home, paid on top of principal and interest, and how they change over time.</summary>
/// <remarks>
/// Tax rates are annual percentages of the home's taxable value. Texas quotes them "per $100 of value",
/// and that number is entered as-is: $0.85 per $100 is 0.85.
/// </remarks>
public sealed record HousingCostsRequest
{
    /// <summary>
    /// All property taxes as one combined rate, for when that is what is known (most places). Use it instead of the
    /// separate <see cref="SchoolTaxRate"/>, <see cref="LocalTaxRate"/> and <see cref="MudTaxRate"/>, which must then be 0.
    /// </summary>
    /// <example>2.2</example>
    public decimal PropertyTaxRate { get; init; }

    /// <summary>
    /// With <see cref="PropertyTaxRate"/>: the dollars of a homestead's value exempt from it. Applies only when
    /// <see cref="IsHomestead"/> is set.
    /// </summary>
    /// <example>50000</example>
    public decimal PropertyTaxHomesteadExemption { get; init; }

    /// <summary>School district tax rate. Kept separate because it has its own homestead exemption.</summary>
    /// <example>1.0</example>
    public decimal SchoolTaxRate { get; init; }

    /// <summary>Combined county, city and other local tax rate (everything except school and MUD).</summary>
    /// <example>1.1</example>
    public decimal LocalTaxRate { get; init; }

    /// <summary>Municipal Utility District tax rate.</summary>
    /// <example>0.85</example>
    public decimal MudTaxRate { get; init; }

    /// <summary>True when the home is the owner's primary residence, which turns on the homestead exemptions and the assessment cap.</summary>
    /// <example>true</example>
    public bool IsHomestead { get; init; }

    /// <summary>Dollars of value the school district exempts for a homestead. Texas requires $140,000.</summary>
    /// <example>140000</example>
    public decimal SchoolHomesteadExemption { get; init; } = 140_000m;

    /// <summary>Percentage of value the county and city exempt for a homestead. Texas allows up to 20%; many grant none.</summary>
    /// <example>0</example>
    public decimal LocalHomesteadExemptionPercent { get; init; }

    /// <summary>Percentage of value the MUD exempts for a homestead. Like a county, a MUD may grant up to 20%; most grant none.</summary>
    /// <example>0</example>
    public decimal MudHomesteadExemptionPercent { get; init; }

    /// <summary>The most a homestead's taxable value may rise in one year, as a percentage. Texas caps it at 10%.</summary>
    /// <example>10</example>
    public decimal HomesteadAssessmentCap { get; init; } = 10m;

    /// <summary>Extra relief for an owner who is 65 or older, or disabled. Applies only to a homestead. Omit if neither applies.</summary>
    public Over65OrDisabledRequest? Over65OrDisabled { get; init; }

    /// <summary>Expected market appreciation per year, as a percentage. Drives future tax bills. May be negative.</summary>
    /// <example>3</example>
    public decimal HomeValueGrowthRate { get; init; }

    /// <summary>Yearly increase in the homeowners insurance premium, as a percentage.</summary>
    /// <example>5</example>
    public decimal InsuranceIncreaseRate { get; init; }

    /// <summary>Yearly increase in HOA dues, as a percentage.</summary>
    /// <example>3</example>
    public decimal HoaIncreaseRate { get; init; }

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
    public PmiCancellation PmiCancellation { get; init; } = PmiCancellation.Automatic;
}

/// <summary>Homestead relief for an owner who is 65 or older, or disabled.</summary>
/// <remarks>
/// Texas school districts must grant both an extra exemption and a tax ceiling that freezes school tax at the
/// qualifying year's amount. Counties and cities may choose to grant their own extra exemption and ceiling.
/// MUD taxes have no ceiling.
/// </remarks>
public sealed record Over65OrDisabledRequest
{
    /// <summary>The loan year in which the owner first qualifies (turns 65 or becomes disabled). 1 means they already qualify.</summary>
    /// <example>1</example>
    public int QualifiesInYear { get; init; } = 1;

    /// <summary>Extra school exemption on top of the regular homestead exemption. Texas: $60,000 (since 2025).</summary>
    /// <example>60000</example>
    public decimal SchoolExemption { get; init; } = 60_000m;

    /// <summary>Extra county/city exemption in dollars, if the local government grants one.</summary>
    /// <example>0</example>
    public decimal LocalExemption { get; init; }

    /// <summary>True if the county/city has adopted a tax ceiling for these owners. The school ceiling always applies.</summary>
    /// <example>false</example>
    public bool LocalTaxCeiling { get; init; }
}

/// <summary>How PMI comes off the loan, under the Homeowners Protection Act.</summary>
public enum PmiCancellation
{
    /// <summary>Removed automatically when the original schedule reaches 78% loan-to-value. Extra payments do not move it.</summary>
    Automatic = 0,

    /// <summary>Removed on the borrower's request at 80% loan-to-value, measured on the actual balance.</summary>
    BorrowerRequested = 1,
}

/// <summary>A Public Improvement District assessment.</summary>
/// <param name="AnnualAssessment" example="1200">The yearly assessment in dollars.</param>
/// <param name="RemainingYears" example="20">Years until the district's bonds are repaid. Omit if it has no end date.</param>
public sealed record PidAssessmentRequest(decimal AnnualAssessment, int? RemainingYears = null);
