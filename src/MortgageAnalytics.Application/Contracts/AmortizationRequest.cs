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
    /// How the buyer will use the home. A second home or an investment property allows a smaller conventional loan, no
    /// FHA or VA loan and no homestead exemption; an investment property also a smaller seller contribution.
    /// </summary>
    /// <example>PrimaryResidence</example>
    public OccupancyType Occupancy { get; init; } = OccupancyType.PrimaryResidence;

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

    /// <summary>
    /// Who pays for the buydown's subsidy. Paid by the seller or builder, it saves the borrower that much interest; paid
    /// by the borrower at closing, it only moves their money earlier. Ignored without a buydown.
    /// </summary>
    /// <example>Seller</example>
    public BuydownFunding BuydownPaidBy { get; init; } = BuydownFunding.Seller;

    /// <summary>An adjustable rate (ARM): the rate resets after a fixed period. Omit for a fixed rate.</summary>
    public AdjustableRateRequest? AdjustableRate { get; init; }

    /// <summary>An FHA or VA loan, with its upfront fee and mortgage insurance. Omit for a conventional loan.</summary>
    public LoanProgramRequest? Program { get; init; }

    /// <summary>
    /// Discount points paid for <see cref="AnnualInterestRate"/>, compared with the rate offered without them. Omit for
    /// none. Not with an <see cref="AdjustableRate"/>.
    /// </summary>
    public DiscountPointsRequest? DiscountPoints { get; init; }

    /// <summary>What is paid at closing besides the down payment, for the cash to close. Omit for no estimate.</summary>
    public ClosingCostsRequest? ClosingCosts { get; init; }

    /// <summary>
    /// Compares the ways to take what the seller or builder offers (their credits, and a buydown they pay for): off the
    /// price, toward the closing costs, for a 2-1 buydown, or for discount points. Needs <see cref="ClosingCosts"/>; not
    /// with an <see cref="AdjustableRate"/> or <see cref="DiscountPoints"/>. Omit for no comparison.
    /// </summary>
    public SellerOfferRequest? SellerOffer { get; init; }

    /// <summary>
    /// Measures the home against a household's income and debts, as a lender would, and works out the most it could
    /// pay at the same down payment share. Omit for none.
    /// </summary>
    public AffordabilityRequest? Affordability { get; init; }

    /// <summary>Weighs buying the home against renting a similar one, year by year. Omit for none.</summary>
    public RentOrBuyRequest? RentOrBuy { get; init; }

    /// <summary>
    /// Borrows part of the price as a second loan instead of paying PMI (an 80/10/10), and compares the two over the years
    /// the loans are kept. Conventional loans only. Omit for none.
    /// </summary>
    public SecondLoanRequest? SecondLoan { get; init; }

    /// <summary>Lets the home out and measures it as an investment: net operating income, cash flow, cap rate, cash-on-cash return and debt service coverage, year by year. Omit for none.</summary>
    public RentalRequest? Rental { get; init; }

    /// <summary>What selling the home would leave in hand at the end of each year, after the loan, the costs of selling and tax on the gain. Omit for none.</summary>
    public SaleRequest? Sale { get; init; }

    /// <summary>
    /// What the household wants to pay each month, all in: principal and interest, taxes, insurance, mortgage insurance
    /// and dues. The response says the highest price that fits it, at the same down payment share, rate and costs.
    /// Needs no income. Omit for none.
    /// </summary>
    /// <example>3000</example>
    public decimal? MonthlyBudget { get; init; }
}

/// <summary>What renting a similar home would cost, and what money does meanwhile.</summary>
public sealed record RentOrBuyRequest
{
    /// <summary>The rent for a similar home now, a month.</summary>
    /// <example>2100</example>
    public decimal MonthlyRent { get; init; }

    /// <summary>How much the rent rises each year, as a percentage.</summary>
    /// <example>3.5</example>
    public decimal RentIncreasePercent { get; init; } = 3.5m;

    /// <summary>What money invested earns a year, as a percentage, compounded monthly.</summary>
    /// <example>7</example>
    public decimal InvestmentReturnPercent { get; init; } = 7m;

    /// <summary>What upkeep costs the owner a year, as a percentage of the home's value that year.</summary>
    /// <example>1</example>
    public decimal MaintenancePercent { get; init; } = 1m;

    /// <summary>What selling costs, as a percentage of the home's value then: commissions and the seller's closing costs.</summary>
    /// <example>6</example>
    public decimal SellingCostPercent { get; init; } = 6m;

    /// <summary>
    /// How the owner's federal income tax differs from a renter's: the mortgage interest and property tax they can
    /// itemize, against the standard deduction. Omit to leave tax out, as the comparison does by default.
    /// </summary>
    public OwnerTaxesRequest? OwnerTaxes { get; init; }

    /// <summary>
    /// Yearly changes in the home's value, as percentages (up to three, each from -20 to 20), to weigh buying against renting under as
    /// well as the plan's own: whether buying still pays off if prices fell, or stood still. The loan, the rent and the housing costs
    /// are the same either way; the home's worth and its upkeep move. Omit for none.
    /// </summary>
    /// <example>[-3, 0]</example>
    public IReadOnlyList<decimal>? ValueChangesPercent { get; init; }
}

/// <summary>
/// A second loan taken with the first, behind it: what is borrowed, at what rate and for how long. The first loan is
/// smaller by the same amount, which can bring it to 80% of the price and so out of PMI.
/// </summary>
public sealed record SecondLoanRequest
{
    /// <summary>The amount borrowed as a second loan; less than what the request already borrows.</summary>
    /// <example>25000</example>
    public decimal Amount { get; init; }

    /// <summary>The second loan's yearly interest rate, as a percentage, fixed for its term.</summary>
    /// <example>8</example>
    public decimal AnnualInterestRate { get; init; }

    /// <summary>The second loan's term, in months: 12 to 360.</summary>
    /// <example>180</example>
    public int TermInMonths { get; init; } = 180;

    /// <summary>The years the loans are kept, for comparing what each way costs.</summary>
    /// <example>7</example>
    public int YearsKept { get; init; } = 7;
}

/// <summary>What letting the home out would bring in, and cost besides owning it.</summary>
public sealed record RentalRequest
{
    /// <summary>The rent now, a month.</summary>
    /// <example>2500</example>
    public decimal MonthlyRent { get; init; }

    /// <summary>The share of the year's rent lost to empty months and unpaid rent, as a percentage.</summary>
    /// <example>5</example>
    public decimal VacancyPercent { get; init; } = 5m;

    /// <summary>What a property manager is paid, as a percentage of the rent collected; 0 for an owner who manages it.</summary>
    /// <example>8</example>
    public decimal ManagementPercent { get; init; } = 8m;

    /// <summary>What repairs and upkeep cost a year, as a percentage of the home's value that year.</summary>
    /// <example>1</example>
    public decimal MaintenancePercent { get; init; } = 1m;

    /// <summary>How much the rent rises each year, as a percentage.</summary>
    /// <example>3</example>
    public decimal RentIncreasePercent { get; init; } = 3m;
}

/// <summary>How a sale is weighed: what it costs, and how the gain is taxed.</summary>
public sealed record SaleRequest
{
    /// <summary>What selling costs, as a percentage of the home's value then: commissions and the seller's closing costs.</summary>
    /// <example>6</example>
    public decimal SellingCostPercent { get; init; } = 6m;

    /// <summary>How the seller files, which sets how much of the gain a home they lived in shelters from tax ($250,000, or $500,000 for a couple filing jointly).</summary>
    public TaxFilingStatus FilingStatus { get; init; }

    /// <summary>The federal rate on a long-term capital gain, as a percentage: 0, 15 or 20, and 3.8 more at high incomes.</summary>
    /// <example>15</example>
    public decimal GainsTaxRatePercent { get; init; } = 15m;

    /// <summary>
    /// Yearly changes in the home's value, as percentages (up to three, each from -20 to 20), to work the same sale out under as
    /// well as the plan's own: what a sale would leave if prices fell, or stood still. The loan owes the same either way. Omit for none.
    /// </summary>
    /// <example>[-3, 0]</example>
    public IReadOnlyList<decimal>? ValueChangesPercent { get; init; }
}

/// <summary>The tax side of owning against renting: who the owner is, for federal income tax, and what else they deduct.</summary>
public sealed record OwnerTaxesRequest
{
    /// <summary>How the household files, which sets its standard deduction (2026).</summary>
    public TaxFilingStatus FilingStatus { get; init; }

    /// <summary>The federal rate on the last dollars of income, as a percentage.</summary>
    /// <example>24</example>
    public decimal MarginalTaxRatePercent { get; init; }

    /// <summary>State income (or sales) and other local taxes paid a year besides this home's property tax, in today's dollars. State and local taxes are deductible up to $40,400.</summary>
    /// <example>8000</example>
    public decimal OtherStateAndLocalTaxes { get; init; }

    /// <summary>Charity and other itemized deductions a year, in today's dollars.</summary>
    /// <example>0</example>
    public decimal OtherItemizedDeductions { get; init; }
}

/// <summary>
/// The buyers' income and debts, for what they can afford. The first buyer is given here; others on the loan are
/// <see cref="CoBuyers"/>, and a lender counts everyone's income and debts together.
/// </summary>
public sealed record AffordabilityRequest
{
    /// <summary>Gross income a year, before taxes, as a lender counts it: the first buyer's, or the whole household's when nobody else is on the loan.</summary>
    /// <example>150000</example>
    public decimal AnnualIncome { get; init; }

    /// <summary>
    /// Other debts a month: car, student and personal loans, credit card minimums, child support. Not rent, utilities
    /// or the home being bought.
    /// </summary>
    /// <example>600</example>
    public decimal MonthlyDebts { get; init; }

    /// <summary>
    /// Others buying with the first buyer, up to <see cref="Validation.AmortizationRequestValidator.MaxCoBuyers"/>.
    /// Their income and debts count with the first buyer's, and each puts in a share of the down payment.
    /// </summary>
    public IReadOnlyList<CoBuyerRequest> CoBuyers { get; init; } = [];
}

/// <summary>Someone buying the home with the first buyer, and what they bring to it.</summary>
public sealed record CoBuyerRequest
{
    /// <summary>Gross income a year, before taxes, as a lender counts it.</summary>
    /// <example>60000</example>
    public decimal AnnualIncome { get; init; }

    /// <summary>Other debts a month, as for the first buyer.</summary>
    /// <example>200</example>
    public decimal MonthlyDebts { get; init; }

    /// <summary>The share of the down payment this buyer puts in, as a percentage; the first buyer puts in the rest.</summary>
    /// <example>40</example>
    public decimal DownPaymentPercent { get; init; }
}

/// <summary>How to weigh the ways to take the seller's or builder's offer.</summary>
public sealed record SellerOfferRequest
{
    /// <summary>The years the loan is kept before the home is sold or the loan refinanced: each way is costed over them.</summary>
    /// <example>7</example>
    public int YearsKept { get; init; } = 7;

    /// <summary>How much each discount point lowers the rate, in percentage points: usually about a quarter.</summary>
    /// <example>0.25</example>
    public decimal RateCutPerPoint { get; init; } = 0.25m;
}

/// <summary>
/// The kind of loan. FHA: a 1.75% upfront MIP and an annual MIP (HUD Mortgagee Letter 2023-05), at least 3.5% down.
/// VA: a funding fee by down payment and use, no mortgage insurance. Neither has PMI, so <c>HousingCosts.PmiRate</c>
/// must be 0.
/// </summary>
public sealed record LoanProgramRequest
{
    /// <summary>Conventional, FHA or VA.</summary>
    /// <example>Fha</example>
    public LoanProgramType Type { get; init; } = LoanProgramType.Conventional;

    /// <summary>For a VA loan: a first use, a later one, or exempt from the fee. Defaults to a first use; only for VA.</summary>
    /// <example>FirstUse</example>
    public VaFundingFeeType? VaUse { get; init; }

    /// <summary>True (the default) to add the upfront fee to the loan; false to pay it at closing.</summary>
    /// <example>true</example>
    public bool FinanceUpfrontFee { get; init; } = true;

    /// <summary>
    /// For FHA: the borrower's decision credit score. 580 or more needs 3.5% down; 500 to 579, 10%; below 500, FHA does
    /// not insure the loan. Omit for 580 or more.
    /// </summary>
    /// <example>620</example>
    public int? CreditScore { get; init; }

    /// <summary>
    /// For FHA: the home's county, as its five-digit FIPS code ("48029" is Bexar County, Texas). The base loan must be
    /// within HUD's limit there (<c>GET /api/v1/fha/loan-limits</c>). Omit not to check it.
    /// </summary>
    /// <example>48029</example>
    public string? CountyFips { get; init; }
}

/// <summary>How the buyer will use the home.</summary>
public enum OccupancyType
{
    /// <summary>The home the buyer lives in for most of the year.</summary>
    PrimaryResidence,

    /// <summary>A home the buyer lives in part of the year, and does not rent out.</summary>
    SecondHome,

    /// <summary>A home the buyer does not live in: to rent out, or hold.</summary>
    InvestmentProperty,
}

/// <summary>The kind of loan.</summary>
public enum LoanProgramType
{
    /// <summary>A conventional loan: PMI below 20% down.</summary>
    Conventional,

    /// <summary>An FHA-insured loan.</summary>
    Fha,

    /// <summary>A VA-guaranteed loan.</summary>
    Va,
}

/// <summary>Which VA funding fee applies.</summary>
public enum VaFundingFeeType
{
    /// <summary>The first VA loan.</summary>
    FirstUse,

    /// <summary>A VA loan after an earlier one.</summary>
    SubsequentUse,

    /// <summary>No fee, as for a veteran compensated for a service-connected disability.</summary>
    Exempt,
}

/// <summary>Discount points: a fee at closing, a percentage of the loan, for a lower rate for the whole loan.</summary>
public sealed record DiscountPointsRequest
{
    /// <summary>The points paid, as a percentage of the loan: 1 is one point, 1% of the loan.</summary>
    /// <example>1</example>
    public decimal Points { get; init; }

    /// <summary>The rate the lender offers without points, as a percentage; higher than the loan's rate.</summary>
    /// <example>6.75</example>
    public decimal RateWithoutPoints { get; init; }
}

/// <summary>
/// Closing costs as a Loan Estimate shows them: the fees as totals, and the prepaids and escrow as counts the loan
/// turns into dollars. The first year of homeowners insurance is always prepaid.
/// </summary>
public sealed record ClosingCostsRequest
{
    /// <summary>The lender's and its services' charges: origination, appraisal, credit report, title (Loan Estimate section D).</summary>
    /// <example>4000</example>
    public decimal LoanCosts { get; init; }

    /// <summary>Recording fees and transfer taxes, an owner's title policy, HOA transfer fees (Loan Estimate sections E and H).</summary>
    /// <example>1000</example>
    public decimal OtherFees { get; init; }

    /// <summary>Days of interest paid at closing, from the closing date to the end of that month.</summary>
    /// <example>15</example>
    public int PrepaidInterestDays { get; init; } = 15;

    /// <summary>Months of property taxes and insurance paid into escrow at closing, cushion included.</summary>
    /// <example>3</example>
    public int EscrowMonths { get; init; } = 3;

    /// <summary>
    /// What the seller or builder pays toward closing costs. Credits never pay the down payment, and the seller's are
    /// limited by the loan (3% to 9% conventional, 6% FHA, 4% VA, of the price), with a buydown they pay for.
    /// </summary>
    /// <example>0</example>
    public decimal Credits { get; init; }

    /// <summary>What the lender pays toward closing costs, usually for a higher rate. Not limited as the seller's are.</summary>
    /// <example>0</example>
    public decimal LenderCredits { get; init; }
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

/// <summary>Who pays for a temporary buydown's subsidy.</summary>
public enum BuydownFunding
{
    /// <summary>The seller or builder, as a concession: the borrower pays that much less interest.</summary>
    Seller,

    /// <summary>The borrower, up front at closing: lower early payments, the same interest overall.</summary>
    Borrower,
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

    /// <summary>
    /// The margin over the index: the rate's floor. Resets never take the rate below it, and the lifetime cap then only
    /// limits the rise. It can be no higher than the starting rate. Omit it to let the lifetime cap limit the fall too.
    /// </summary>
    /// <example>2.75</example>
    public decimal? Margin { get; init; }
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

    /// <summary>
    /// Whether PMI comes off on request at 80% loan-to-value (the default: a borrower paying extra asks as soon as they
    /// can) or automatically at 78% on the original schedule.
    /// </summary>
    /// <example>BorrowerRequested</example>
    public PmiCancellation PmiCancellation { get; init; } = PmiCancellation.BorrowerRequested;

    /// <summary>
    /// New tax rates from given loan years, as taxing units adopt them: each change sets the rates it names from its
    /// year until a later change. Only for taxes that are charged. Omit for rates that never change.
    /// </summary>
    public IReadOnlyList<TaxRateChangeRequest> RateChanges { get; init; } = [];
}

/// <summary>Tax rates that change from a loan year on. A rate left out keeps its value.</summary>
public sealed record TaxRateChangeRequest
{
    /// <summary>The loan year (1-based, from 2) the new rates start in.</summary>
    /// <example>3</example>
    public int FromYear { get; init; }

    /// <summary>The new combined property tax rate, with one rate.</summary>
    /// <example>2.1</example>
    public decimal? PropertyTaxRate { get; init; }

    /// <summary>The new school tax rate, with separate taxes.</summary>
    public decimal? SchoolTaxRate { get; init; }

    /// <summary>The new county/city tax rate, with separate taxes.</summary>
    public decimal? LocalTaxRate { get; init; }

    /// <summary>The new MUD tax rate, with separate taxes.</summary>
    public decimal? MudTaxRate { get; init; }
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

    /// <summary>
    /// For an owner who brings a school tax ceiling from a former Texas home (Tax Code §11.26(g)): the share of school
    /// tax paid there under its ceiling, as a percentage of the tax without it. The new home's ceiling is that share of
    /// its own first-year school tax. Omit when the ceiling is set at this home.
    /// </summary>
    /// <example>40</example>
    public decimal? TransferredCeilingPercent { get; init; }
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
