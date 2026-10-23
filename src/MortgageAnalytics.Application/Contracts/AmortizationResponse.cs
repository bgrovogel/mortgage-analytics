namespace MortgageAnalytics.Application.Contracts;

/// <summary>A standard schedule compared with an accelerated one, for a specific purchase.</summary>
/// <param name="Purchase">The price, down payment and resulting loan.</param>
/// <param name="Baseline">The loan with no extra payments.</param>
/// <param name="Accelerated">The loan with the requested extra payments (and recasts) applied.</param>
/// <param name="Savings">What the extra payments save, net of recast fees.</param>
/// <param name="Projection">Home value, taxable value and housing costs for each year of the standard schedule.</param>
/// <param name="Buydown">A temporary buydown: its yearly rates and payments, and its cost. Null without one.</param>
/// <param name="AdjustableRate">An adjustable rate's worst case. Null for a fixed rate.</param>
/// <param name="CashToClose">What the buyer brings to closing, line by line. Null when the request has no closing costs.</param>
/// <param name="DiscountPoints">What discount points are worth against the rate without them. Null without points.</param>
/// <param name="Program">An FHA or VA loan's upfront fee and mortgage insurance. Null for a conventional loan.</param>
/// <param name="PmiOtherChoice">
/// With PMI, what the other way of removing it would do. Asking at 80% follows the actual balance and automatic removal
/// at 78% the original schedule, so with extra payments the two can end years apart. Null unless they end apart.
/// </param>
/// <param name="SellerOffer">The seller's or builder's offer taken each way it can be. Null unless the request asks and there is an offer.</param>
/// <param name="Affordability">The home against the household's income and debts. Null unless the request gives them.</param>
/// <param name="RentOrBuy">Buying the home against renting a similar one, year by year. Null unless the request asks.</param>
/// <param name="Budget">The highest price a monthly budget reaches. Null unless the request gives a budget.</param>
/// <param name="Sale">What selling would leave in hand at the end of each year. Null unless the request asks.</param>
/// <param name="Rental">The home let out, measured as an investment. Null unless the request asks.</param>
/// <param name="SecondLoan">A second loan against paying PMI, over the years the loans are kept. Null unless the request asks.</param>
/// <param name="AnnualPercentageRate">
/// The loan's APR as a percentage: the rate counting the lender's costs, prepaid interest, discount points, an FHA or VA
/// upfront fee and mortgage insurance, so offers with different fees can be compared. Null when nothing was received.
/// </param>
/// <param name="InFiveYears">A Loan Estimate's "in 5 years": what the first 60 payments come to and the principal they pay off, on the standard schedule.</param>
/// <param name="TotalInterestPercentage">A Loan Estimate's total interest percentage: the interest over the whole loan as a percentage of the amount borrowed, to a thousandth.</param>
public sealed record AmortizationResponse(
    PurchaseResponse Purchase,
    ScheduleResponse Baseline,
    ScheduleResponse Accelerated,
    SavingsResponse Savings,
    IReadOnlyList<YearProjectionResponse> Projection,
    BuydownResponse? Buydown = null,
    AdjustableRateResponse? AdjustableRate = null,
    CashToCloseResponse? CashToClose = null,
    DiscountPointsResponse? DiscountPoints = null,
    LoanProgramResponse? Program = null,
    PmiOtherChoiceResponse? PmiOtherChoice = null,
    SellerOfferResponse? SellerOffer = null,
    AffordabilityResponse? Affordability = null,
    RentOrBuyResponse? RentOrBuy = null,
    decimal? AnnualPercentageRate = null,
    InFiveYearsResponse? InFiveYears = null,
    decimal? TotalInterestPercentage = null,
    BudgetResponse? Budget = null,
    SaleResponse? Sale = null,
    RentalResponse? Rental = null,
    SecondLoanResponse? SecondLoan = null);

/// <summary>What a Loan Estimate lists as "in 5 years" for the standard schedule, with no extra payments.</summary>
/// <param name="TotalPaid">The first 60 payments of principal, interest and mortgage insurance, plus the lender's loan costs.</param>
/// <param name="PrincipalPaidOff">The principal those payments pay off.</param>
public sealed record InFiveYearsResponse(decimal TotalPaid, decimal PrincipalPaidOff);

/// <summary>
/// Buying the home against renting a similar one, for households that spend the same each month: whichever of owning
/// and renting costs less invests the difference, and the renter also invests what buying takes to close. Taxes on
/// investment gains, the mortgage interest deduction and extra payments are left out.
/// </summary>
/// <param name="MonthlyRent">The rent now, a month.</param>
/// <param name="RentIncreasePercent">How much it rises each year.</param>
/// <param name="InvestmentReturnPercent">What money invested earns a year.</param>
/// <param name="MaintenancePercent">Upkeep a year, as a percentage of the home's value.</param>
/// <param name="SellingCostPercent">What selling costs, as a percentage of the home's value then.</param>
/// <param name="CashToClose">What buying takes at closing (the down payment alone without closing costs), which the renter invests.</param>
/// <param name="BreakEvenYear">The first year from which buying is ahead for good; null when it never is within the years compared.</param>
/// <param name="Years">Each year, up to 30 (or the loan's term when shorter).</param>
/// <param name="CountsTaxSavings">True when the buyer's federal income tax saving (the interest and property tax deducted) is counted; false when the comparison leaves tax out.</param>
/// <param name="Scenarios">The same comparison with the home's value changing by other yearly rates, in the order the request gave them; empty when none were asked for.</param>
public sealed record RentOrBuyResponse(
    decimal MonthlyRent,
    decimal RentIncreasePercent,
    decimal InvestmentReturnPercent,
    decimal MaintenancePercent,
    decimal SellingCostPercent,
    decimal CashToClose,
    int? BreakEvenYear,
    IReadOnlyList<RentOrBuyYearResponse> Years,
    bool CountsTaxSavings = false,
    IReadOnlyList<RentOrBuyScenarioResponse>? Scenarios = null)
{
    /// <summary>The scenarios, empty when none were asked for.</summary>
    public IReadOnlyList<RentOrBuyScenarioResponse> Scenarios { get; init; } = Scenarios ?? [];
}

/// <summary>Buying against renting if the home's value changed by one yearly rate.</summary>
/// <param name="YearlyChangePercent">The yearly change in the home's value this assumes.</param>
/// <param name="BreakEvenYear">The first year from which buying is ahead for good under it; null when it never is within the years compared.</param>
/// <param name="Years">Each year compared, as the plan's own.</param>
public sealed record RentOrBuyScenarioResponse(decimal YearlyChangePercent, int? BreakEvenYear, IReadOnlyList<RentOrBuyYearResponse> Years);

/// <summary>
/// A second loan against paying PMI, each the request analyzed again and costed over the years the loans are kept:
/// the cash to close, every payment (principal, interest and housing costs, for both loans) and what is still owed.
/// Extra payments are left out of both.
/// </summary>
/// <param name="Amount">The second loan.</param>
/// <param name="AnnualInterestRate">Its rate.</param>
/// <param name="TermInMonths">Its term.</param>
/// <param name="YearsKept">The years the loans are kept.</param>
/// <param name="WithMortgageInsurance">The request as made: one loan, with PMI if it needs it.</param>
/// <param name="WithSecondLoan">The first loan smaller by the second loan's amount, and the second loan.</param>
/// <param name="Saved">What the second loan saves over the years kept; negative when it costs more.</param>
public sealed record SecondLoanResponse(
    decimal Amount, decimal AnnualInterestRate, int TermInMonths, int YearsKept,
    SecondLoanOptionResponse WithMortgageInsurance, SecondLoanOptionResponse WithSecondLoan, decimal Saved);

/// <summary>One way of borrowing: with PMI on one loan, or a smaller first loan and a second.</summary>
/// <param name="FirstLoan">The first loan.</param>
/// <param name="SecondLoan">The second loan; 0 for none.</param>
/// <param name="FirstLoanPayment">The first loan's principal and interest in its first month.</param>
/// <param name="SecondLoanPayment">The second loan's monthly payment; 0 for none.</param>
/// <param name="MortgageInsurance">The first month's PMI; 0 when the first loan needs none.</param>
/// <param name="MonthlyPayment">The first month, all in: both loans, taxes, insurance, dues and PMI.</param>
/// <param name="CashToClose">What the buyer brings to closing.</param>
/// <param name="Payments">Every payment in the years kept, for both loans.</param>
/// <param name="Balance">What both loans still owe at the end of the years kept.</param>
/// <param name="Cost">The cash to close, the payments and the balance: what the buyer pays.</param>
public sealed record SecondLoanOptionResponse(
    decimal FirstLoan, decimal SecondLoan, decimal FirstLoanPayment, decimal SecondLoanPayment, decimal MortgageInsurance,
    decimal MonthlyPayment, decimal CashToClose, decimal Payments, decimal Balance, decimal Cost);

/// <summary>
/// The home let out, measured as an investment, year by year. Net operating income is the rent collected less the manager,
/// upkeep and the taxes, assessments, insurance and dues of owning; cash flow is that less the loan's payments (principal,
/// interest and mortgage insurance). The loan is the standard schedule: extra payments are left out.
/// </summary>
/// <param name="MonthlyRent">The rent now, a month.</param>
/// <param name="VacancyPercent">The share of the rent lost to vacancy.</param>
/// <param name="ManagementPercent">The manager's share of the rent collected.</param>
/// <param name="MaintenancePercent">Upkeep a year, as a percentage of the home's value.</param>
/// <param name="RentIncreasePercent">How much the rent rises each year.</param>
/// <param name="CashInvested">What the buyer puts in at closing (the down payment alone without closing costs).</param>
/// <param name="CapRatePercent">The first year's net operating income as a percentage of the price.</param>
/// <param name="CashOnCashPercent">The first year's cash flow as a percentage of the cash invested; null when none was.</param>
/// <param name="DebtServiceCoverage">The first year's net operating income over the loan's payments; lenders ask for 1.25 or more. Null without a loan.</param>
/// <param name="GrossRentMultiplier">The price over a year's gross rent.</param>
/// <param name="RentToPricePercent">A month's rent as a percentage of the price; the "1% rule" looks for 1.</param>
/// <param name="BreakEvenMonthlyRent">The rent at which the first year's cash flow is nothing.</param>
/// <param name="Years">Each year, up to 30 (or the loan's term when shorter).</param>
public sealed record RentalResponse(
    decimal MonthlyRent,
    decimal VacancyPercent,
    decimal ManagementPercent,
    decimal MaintenancePercent,
    decimal RentIncreasePercent,
    decimal CashInvested,
    decimal CapRatePercent,
    decimal? CashOnCashPercent,
    decimal? DebtServiceCoverage,
    decimal GrossRentMultiplier,
    decimal RentToPricePercent,
    decimal BreakEvenMonthlyRent,
    IReadOnlyList<RentalYearResponse> Years);

/// <summary>One year of letting the home out.</summary>
/// <param name="Year">The 1-based year.</param>
/// <param name="GrossRent">The rent if let every month.</param>
/// <param name="VacancyLoss">The rent lost to vacancy.</param>
/// <param name="ManagementFee">What the manager is paid.</param>
/// <param name="Maintenance">Repairs and upkeep.</param>
/// <param name="OperatingCosts">Property taxes, assessments, insurance and dues.</param>
/// <param name="NetOperatingIncome">What the property earns before the loan.</param>
/// <param name="DebtService">The loan's payments, less any buydown's subsidy.</param>
/// <param name="CashFlow">What is left after the loan; negative when the owner has to add money.</param>
public sealed record RentalYearResponse(
    int Year, decimal GrossRent, decimal VacancyLoss, decimal ManagementFee, decimal Maintenance, decimal OperatingCosts,
    decimal NetOperatingIncome, decimal DebtService, decimal CashFlow);

/// <summary>
/// What selling the home would leave in hand, for each year it might be sold. The gain is the sale, less its costs, over
/// the price paid; a home lived in has the first $250,000 of it ($500,000 for a couple filing jointly) free of tax after
/// two years. Improvements and the costs of buying would lower the gain, so the tax shown leans high.
/// </summary>
/// <param name="SellingCostPercent">What selling costs, as a percentage of the home's value then.</param>
/// <param name="GainsTaxRatePercent">The federal rate on the gain taxed.</param>
/// <param name="ExclusionPerSale">The gain a sale of this home could shelter from tax once owned two years: $250,000 or $500,000, and nothing for a home that is not lived in.</param>
/// <param name="Years">Each year the loan runs, up to 30, with the home's value changing as the plan says.</param>
/// <param name="Scenarios">The same sale with the home's value changing by other yearly rates, in the order the request gave them; empty when none were asked for.</param>
public sealed record SaleResponse(
    decimal SellingCostPercent, decimal GainsTaxRatePercent, decimal ExclusionPerSale, IReadOnlyList<SaleYearResponse> Years,
    IReadOnlyList<SaleScenarioResponse> Scenarios);

/// <summary>The sale of the home had its value changed by one yearly rate instead of the plan's.</summary>
/// <param name="YearlyChangePercent">The change in the home's value each year, as a percentage; negative for a fall.</param>
/// <param name="Years">Each year the loan runs, up to 30.</param>
public sealed record SaleScenarioResponse(decimal YearlyChangePercent, IReadOnlyList<SaleYearResponse> Years);

/// <summary>Selling at the end of one year.</summary>
/// <param name="Year">The 1-based year.</param>
/// <param name="HomeValue">What the home sells for.</param>
/// <param name="LoanBalance">What is owed then, on the plan with its extra payments.</param>
/// <param name="SellingCosts">Commissions and the seller's closing costs.</param>
/// <param name="Gain">The sale less its costs, over the price paid; negative for a loss.</param>
/// <param name="TaxFreeGain">The part of the gain the exclusion shelters.</param>
/// <param name="TaxOnGain">The federal tax on the rest.</param>
/// <param name="NetProceeds">What is left after the loan, the costs and the tax; negative when the sale does not cover them.</param>
public sealed record SaleYearResponse(
    int Year, decimal HomeValue, decimal LoanBalance, decimal SellingCosts, decimal Gain, decimal TaxFreeGain, decimal TaxOnGain, decimal NetProceeds);

/// <summary>One year of renting instead of buying.</summary>
/// <param name="Year">The 1-based year.</param>
/// <param name="OwnershipCost">What owning cost that year: payments, housing costs and upkeep.</param>
/// <param name="Rent">The rent paid that year.</param>
/// <param name="HomeEquity">What selling would leave at the year's end: the value, less what is owed and selling costs.</param>
/// <param name="BuyerInvestments">The buyer's invested savings by then.</param>
/// <param name="BuyerNetWorth">The equity and the buyer's investments.</param>
/// <param name="RenterNetWorth">The renter's investments.</param>
/// <param name="Advantage">How far buying is ahead; negative while renting is.</param>
/// <param name="TaxSaved">The federal income tax owning saved that year, which the buyer invests as it is saved; zero when tax is left out.</param>
public sealed record RentOrBuyYearResponse(
    int Year, decimal OwnershipCost, decimal Rent, decimal HomeEquity, decimal BuyerInvestments, decimal BuyerNetWorth, decimal RenterNetWorth, decimal Advantage,
    decimal TaxSaved = 0m);

/// <summary>
/// The home against a household's income and debts: its debt-to-income ratios, and for each limit, the most the housing
/// payment may be and the most the household could pay for a home with the same down payment share and costs.
/// </summary>
/// <param name="MonthlyIncome">Gross income a month: the year's divided by 12, to the cent.</param>
/// <param name="MonthlyDebts">The other debts a month.</param>
/// <param name="HousingPayment">This home's payment as a lender counts it: principal and interest at the qualifying
/// rate (a buydown's lower years are not qualified on), taxes, insurance, mortgage insurance, dues and PID, in the first month.</param>
/// <param name="HousingPercent">The housing payment as a percentage of income.</param>
/// <param name="TotalPercent">It and the debts as a percentage of income.</param>
/// <param name="Comfortable">The classic rule of thumb: 28% for housing, 36% in all.</param>
/// <param name="MostAllowed">The loan program's limit: conventional 45% in all, FHA 31% and 43%, VA 41% in all.</param>
/// <param name="QualifyingRate">The rate the principal and interest are qualified at, here and at every price searched.</param>
/// <param name="QualifyingRateBasis">Why it is that rate: the note rate, or an adjustable rate's program rule.</param>
/// <param name="Buyers">Each buyer, the first first, when there are co-buyers; null for a buyer alone.</param>
public sealed record AffordabilityResponse(
    decimal MonthlyIncome,
    decimal MonthlyDebts,
    decimal HousingPayment,
    decimal HousingPercent,
    decimal TotalPercent,
    AffordabilityLimitResponse Comfortable,
    AffordabilityLimitResponse MostAllowed,
    decimal QualifyingRate,
    QualifyingRateBasis QualifyingRateBasis,
    IReadOnlyList<BuyerResponse>? Buyers = null);

/// <summary>One of the buyers: what they bring, and the share of the home's payment that follows their income.</summary>
/// <param name="MonthlyIncome">Gross income a month.</param>
/// <param name="MonthlyDebts">Other debts a month.</param>
/// <param name="DownPaymentPercent">The share of the down payment they put in, as a percentage.</param>
/// <param name="DownPayment">That share, in dollars; every buyer's adds up to the down payment.</param>
/// <param name="MonthlyPayment">Their share of the first month's payment if it is split in proportion to income; every buyer's adds up to the payment.</param>
public sealed record BuyerResponse(
    decimal MonthlyIncome,
    decimal MonthlyDebts,
    decimal DownPaymentPercent,
    decimal DownPayment,
    decimal MonthlyPayment);

/// <summary>Why a loan is qualified at the rate it is.</summary>
public enum QualifyingRateBasis
{
    /// <summary>The note rate: a fixed rate, an ARM fixed longer than five years, or one whose program asks no more.</summary>
    NoteRate,

    /// <summary>A conventional ARM fixed three years or less: the most its rate can reach in the first five years.</summary>
    MostInFirstFiveYears,

    /// <summary>A conventional ARM fixed five years: the note rate plus its first cap, or the fully indexed rate if higher.</summary>
    FirstResetOrFullyIndexed,

    /// <summary>An FHA 1-year ARM with a loan of 95% or more: the starting rate plus a point.</summary>
    StartPlusOnePoint,
}

/// <summary>One debt-to-income limit, and what it allows.</summary>
/// <param name="HousingPercent">The most of income for housing; null when only the total is limited.</param>
/// <param name="TotalPercent">The most of income for housing and the debts.</param>
/// <param name="MaxHousingPayment">The most the housing payment may be.</param>
/// <param name="MaxHomePrice">The highest price whose payment is within it, with the same down payment share, rate and
/// costs, to the dollar; 0 when none is. An FHA loan's county limit holds it too.</param>
/// <param name="Fits">True when this home's payment is within it.</param>
public sealed record AffordabilityLimitResponse(decimal? HousingPercent, decimal TotalPercent, decimal MaxHousingPayment, decimal MaxHomePrice, bool Fits);

/// <summary>
/// The seller's or builder's offer taken each way it can be, each on the standard schedule with no extra payments, and
/// costed over the years the loan is kept: the cash to close, the payments, and the balance still owed then.
/// </summary>
/// <param name="Offer">What the seller or builder offers: their credits, and a buydown they pay for.</param>
/// <param name="YearsKept">The years each way is costed over.</param>
/// <param name="RateCutPerPoint">How much each discount point lowers the rate.</param>
/// <param name="Options">Each way: off the price (unless the offer leaves nothing to borrow), toward the closing costs, for
/// a 2-1 buydown, and for discount points (unless the offer buys none).</param>
/// <param name="Best">The way that costs the least over the years kept.</param>
public sealed record SellerOfferResponse(
    decimal Offer, int YearsKept, decimal RateCutPerPoint, IReadOnlyList<SellerOfferOptionResponse> Options, SellerOfferUse Best);

/// <summary>The offer taken one way.</summary>
/// <param name="Use">The way it is taken.</param>
/// <param name="HomePrice">The price: less by the offer when it comes off the price.</param>
/// <param name="LoanAmount">The amount borrowed.</param>
/// <param name="AnnualInterestRate">The loan's rate: lower with points.</param>
/// <param name="Points">The discount points the offer buys; zero for the other ways.</param>
/// <param name="FirstPayment">The first month's payment: principal, interest and housing costs, less a buydown's subsidy.</param>
/// <param name="LaterPayment">The same month's payment without the subsidy, as it is once a buydown ends; the first payment otherwise.</param>
/// <param name="CashToClose">What the buyer brings to closing.</param>
/// <param name="Payments">Every payment over the years kept.</param>
/// <param name="Balance">What is still owed after them.</param>
/// <param name="Cost">The cash to close, the payments and the balance: what the buyer pays over the years kept.</param>
/// <param name="NotUsed">The part of the offer the loan does not let pay the buyer's costs, beyond them or the limit.</param>
public sealed record SellerOfferOptionResponse(
    SellerOfferUse Use,
    decimal HomePrice,
    decimal LoanAmount,
    decimal AnnualInterestRate,
    decimal Points,
    decimal FirstPayment,
    decimal LaterPayment,
    decimal CashToClose,
    decimal Payments,
    decimal Balance,
    decimal Cost,
    decimal NotUsed);

/// <summary>A way to take a seller's or builder's offer.</summary>
public enum SellerOfferUse
{
    /// <summary>Off the price: a smaller loan, and lower taxes and mortgage insurance. Not a concession, so not limited.</summary>
    PriceCut,

    /// <summary>As credits toward the closing costs.</summary>
    ClosingCosts,

    /// <summary>For a 2-1 buydown the seller pays, as far as the offer and the limit go; the rest toward the closing costs.</summary>
    TemporaryBuydown,

    /// <summary>For discount points: a lower rate for the whole loan.</summary>
    DiscountPoints,
}

/// <summary>PMI removed the other way from the request's, with the same extra payments.</summary>
/// <param name="Removal">The other way: on request at 80%, or automatically at 78%.</param>
/// <param name="EndDate">Due date of the last payment that would include PMI that way.</param>
/// <param name="SavedByAsking">The PMI that asking at 80% saves over automatic removal.</param>
public sealed record PmiOtherChoiceResponse(PmiCancellation Removal, DateOnly EndDate, decimal SavedByAsking);

/// <summary>An FHA or VA loan's upfront fee and mortgage insurance.</summary>
/// <param name="Type">FHA or VA.</param>
/// <param name="UpfrontFeePercent">The upfront fee (FHA's upfront MIP, VA's funding fee), as a percentage of the base loan.</param>
/// <param name="UpfrontFee">The upfront fee in dollars.</param>
/// <param name="UpfrontFeeFinanced">True when it is added to the loan; false when it is paid at closing.</param>
/// <param name="LoanAmount">The amount borrowed: the base loan, plus the fee when financed. Payments, interest and equity use it.</param>
/// <param name="AnnualMipPercent">FHA's annual MIP rate; zero for VA.</param>
/// <param name="MipPayments">How many payments carry FHA's annual MIP: 132 (11 years) or the whole term; zero for VA.</param>
/// <param name="CountyName">For FHA in a given county: its name and state ("Bexar County, TX"); otherwise null.</param>
/// <param name="CountyLoanLimit">The most FHA insures there (its one-unit limit); otherwise null.</param>
/// <param name="LoanLimitYear">The year of HUD's limits; otherwise null.</param>
public sealed record LoanProgramResponse(
    LoanProgramType Type,
    decimal UpfrontFeePercent,
    decimal UpfrontFee,
    bool UpfrontFeeFinanced,
    decimal LoanAmount,
    decimal AnnualMipPercent,
    int MipPayments,
    string? CountyName = null,
    decimal? CountyLoanLimit = null,
    int? LoanLimitYear = null);

/// <summary>HUD's FHA loan limits for one-unit homes, by county.</summary>
/// <param name="Year">The year they apply to.</param>
/// <param name="Source">Where they come from.</param>
/// <param name="Floor">The lowest limit: most counties have it.</param>
/// <param name="Ceiling">The highest in the contiguous states (Alaska, Hawaii and the territories can be higher).</param>
/// <param name="States">Each state's and territory's name, by its two-letter code.</param>
/// <param name="Counties">Every county and county equivalent, by FIPS code.</param>
public sealed record FhaLoanLimitsResponse(
    int Year, string Source, decimal Floor, decimal Ceiling, IReadOnlyDictionary<string, string> States, IReadOnlyList<FhaCountyLimitResponse> Counties)
{
    private readonly Dictionary<string, FhaCountyLimitResponse> _byFips = Counties.ToDictionary(c => c.Fips);

    /// <summary>The county with this five-digit FIPS code, or null when HUD lists none.</summary>
    public FhaCountyLimitResponse? Find(string fips) => _byFips.GetValueOrDefault(fips);
}

/// <summary>One county's FHA limit.</summary>
/// <param name="Fips">Its five-digit FIPS code: the state's two digits, then the county's three.</param>
/// <param name="State">Its state's two-letter code.</param>
/// <param name="Name">Its name, such as "Bexar County".</param>
/// <param name="Limit">The most FHA insures there for a one-unit home.</param>
public sealed record FhaCountyLimitResponse(string Fips, string State, string Name, decimal Limit);

/// <summary>Discount points against the rate without them, each loan on its standard schedule.</summary>
/// <param name="Points">The points paid, as a percentage of the loan.</param>
/// <param name="Cost">What they cost at closing.</param>
/// <param name="RateWithoutPoints">The rate the lender offers without them.</param>
/// <param name="PaymentWithoutPoints">The monthly principal and interest at that rate.</param>
/// <param name="MonthlySaving">How much lower the payment is with the points.</param>
/// <param name="InterestSaved">The interest saved over the whole loan.</param>
/// <param name="NetSaving">The interest saved less the cost; negative when the points lose money.</param>
/// <param name="BreakEvenPayment">The payment by which the interest saved covers the cost, or null when it never does.</param>
/// <param name="BreakEvenDate">That payment's due date, or null.</param>
public sealed record DiscountPointsResponse(
    decimal Points,
    decimal Cost,
    decimal RateWithoutPoints,
    decimal PaymentWithoutPoints,
    decimal MonthlySaving,
    decimal InterestSaved,
    decimal NetSaving,
    int? BreakEvenPayment,
    DateOnly? BreakEvenDate);

/// <summary>The cash the buyer brings to closing, laid out as a Loan Estimate lays it out.</summary>
/// <param name="DownPayment">Cash paid toward the price.</param>
/// <param name="LoanCosts">The lender's and its services' charges.</param>
/// <param name="OtherFees">Government and other fees.</param>
/// <param name="DailyInterest">A day's interest on the loan at the note rate, over a 365-day year, to the cent.</param>
/// <param name="PrepaidInterestDays">Days of interest paid at closing.</param>
/// <param name="PrepaidInterest">The daily interest times the days.</param>
/// <param name="HomeownersInsurance">The first year's homeowners insurance premium, prepaid.</param>
/// <param name="MonthlyEscrow">A month of the first year's property taxes and insurance, to the cent.</param>
/// <param name="EscrowMonths">Months of it paid into escrow.</param>
/// <param name="EscrowDeposit">The deposit that starts the escrow account.</param>
/// <param name="BuydownCost">A temporary buydown's subsidy when the buyer pays for it; zero otherwise.</param>
/// <param name="DiscountPoints">What discount points cost; zero without them.</param>
/// <param name="UpfrontMortgageFee">An FHA upfront MIP or VA funding fee paid at closing rather than financed; zero otherwise.</param>
/// <param name="ClosingCosts">Everything paid at closing besides the down payment, before credits.</param>
/// <param name="SellerCredits">The seller's credits used: within the closing costs left after the lender's, and the limit.</param>
/// <param name="LenderCredits">The lender's credits used, before the seller's: never more than the closing costs.</param>
/// <param name="Credits">All the credits used.</param>
/// <param name="UnusedCredits">Credits beyond the closing costs, which cannot pay the down payment.</param>
/// <param name="Total">The cash to close: the down payment plus closing costs, less credits.</param>
/// <param name="Concessions">What the seller or builder pays toward the buyer's costs, against the most the loan allows.</param>
public sealed record CashToCloseResponse(
    decimal DownPayment,
    decimal LoanCosts,
    decimal OtherFees,
    decimal DailyInterest,
    int PrepaidInterestDays,
    decimal PrepaidInterest,
    decimal HomeownersInsurance,
    decimal MonthlyEscrow,
    int EscrowMonths,
    decimal EscrowDeposit,
    decimal BuydownCost,
    decimal DiscountPoints,
    decimal UpfrontMortgageFee,
    decimal ClosingCosts,
    decimal SellerCredits,
    decimal LenderCredits,
    decimal Credits,
    decimal UnusedCredits,
    decimal Total,
    ConcessionsResponse Concessions);

/// <summary>
/// What the seller or builder pays toward the buyer's closing costs, prepaids, points and buydowns, against the most the
/// loan allows: for a conventional loan 3% of the price above 90% loan-to-value, 6% to 75%, 9% below; FHA 6%; VA 4%.
/// </summary>
/// <param name="LimitPercent">The limit, as a percentage of the price.</param>
/// <param name="Limit">The limit in dollars.</param>
/// <param name="SellerBuydown">A temporary buydown the seller pays for: it counts against the limit.</param>
/// <param name="Total">Everything the seller pays that counts against the limit: the buydown and the credits the costs can take.</param>
/// <param name="OverLimit">How far that goes beyond the limit; the credits are cut by as much, and the buyer could ask for it off the price instead.</param>
/// <param name="NormalClosingCostsExcluded">True for VA, whose limit leaves out the normal closing costs and points the seller pays.</param>
/// <param name="NextTier">For a conventional loan below 25% down, the down payment that raises the limit; otherwise null.</param>
public sealed record ConcessionsResponse(
    decimal LimitPercent,
    decimal Limit,
    decimal SellerBuydown,
    decimal Total,
    decimal OverLimit,
    bool NormalClosingCostsExcluded,
    ConcessionTierResponse? NextTier);

/// <summary>A higher conventional limit on what the seller may pay, and the down payment that reaches it.</summary>
/// <param name="DownPayment">The least down payment for it.</param>
/// <param name="LimitPercent">Its limit, as a percentage of the price.</param>
/// <param name="Limit">Its limit in dollars.</param>
public sealed record ConcessionTierResponse(decimal DownPayment, decimal LimitPercent, decimal Limit);

/// <summary>A temporary buydown: each bought-down year's rate and payment, and what the subsidy costs.</summary>
/// <param name="NoteRate">The loan's actual rate, paid from the year after the buydown.</param>
/// <param name="Years">Each bought-down year, then the first year at the note rate.</param>
/// <param name="TotalSubsidy">Everything the subsidy covers over the standard schedule: the buydown's cost.</param>
/// <param name="PaidBy">Who pays for it: the seller or builder (which saves the borrower that much interest), or the borrower.</param>
public sealed record BuydownResponse(decimal NoteRate, IReadOnlyList<BuydownYearResponse> Years, decimal TotalSubsidy, BuydownFunding PaidBy);

/// <summary>One year of a buydown.</summary>
/// <param name="Year">The 1-based year of the loan.</param>
/// <param name="AnnualInterestRate">The rate the payment is figured at.</param>
/// <param name="MonthlyPayment">The principal and interest the borrower pays each month that year.</param>
/// <param name="Subsidy">What the buydown pays that year, on the standard schedule; 0 once the loan is at its note rate.
/// The years add up to the buydown's cost.</param>
public sealed record BuydownYearResponse(int Year, decimal AnnualInterestRate, decimal MonthlyPayment, decimal Subsidy);

/// <summary>An adjustable rate's worst case: rates rising as far and as fast as the caps allow.</summary>
/// <param name="WorstCaseRateChanges">The resets in that case, with the payment before and after each.</param>
/// <param name="WorstCasePeakPayment">The highest principal-and-interest payment it reaches.</param>
/// <param name="WorstCaseTotalInterest">The interest over the loan in that case (without extra payments).</param>
public sealed record AdjustableRateResponse(
    IReadOnlyList<RateChangeResponse> WorstCaseRateChanges,
    decimal WorstCasePeakPayment,
    decimal WorstCaseTotalInterest);

/// <summary>A rate reset and what it did to the payment.</summary>
/// <param name="PaymentNumber">The first payment at the new rate.</param>
/// <param name="EffectiveDate">Its due date.</param>
/// <param name="PreviousRate">The annual rate before, as a percentage.</param>
/// <param name="NewRate">The annual rate from then on.</param>
/// <param name="PreviousPayment">The principal and interest before.</param>
/// <param name="NewPayment">The principal and interest from then on.</param>
public sealed record RateChangeResponse(
    int PaymentNumber, DateOnly EffectiveDate, decimal PreviousRate, decimal NewRate, decimal PreviousPayment, decimal NewPayment);

/// <summary>One loan year of the ownership projection.</summary>
/// <param name="Year">The 1-based loan year.</param>
/// <param name="StartDate">Due date of the year's first payment.</param>
/// <param name="MarketValue">Projected market value of the home.</param>
/// <param name="AssessedValue">The value the appraisal district assesses: market value, held down by the homestead cap. Before any exemption.</param>
/// <param name="SchoolTaxableValue">What school tax is charged on: the assessed value minus the school homestead (and over-65) exemptions. Null when there is no school tax.</param>
/// <param name="LocalTaxableValue">What county/city tax is charged on, after its own exemptions. Null when there is no county/city tax.</param>
/// <param name="MudTaxableValue">What MUD tax is charged on (MUDs grant no homestead exemption). Null when there is no MUD tax.</param>
/// <param name="PropertyTaxableValue">What the single combined property tax is charged on, after its homestead exemption. Null when the taxes are given separately.</param>
/// <param name="Costs">Housing costs paid during the year, by category.</param>
/// <param name="LoanBalance">What is owed at the start of the year, on the plan with its extra payments: the whole loan
/// in year 1, nothing once it is paid off.</param>
/// <param name="Equity">The home's market value less <paramref name="LoanBalance"/>: the part of the home that is yours.</param>
public sealed record YearProjectionResponse(
    int Year,
    DateOnly StartDate,
    decimal MarketValue,
    decimal AssessedValue,
    decimal? SchoolTaxableValue,
    decimal? LocalTaxableValue,
    decimal? MudTaxableValue,
    decimal? PropertyTaxableValue,
    HousingCostsResponse Costs,
    decimal LoanBalance,
    decimal Equity);

/// <summary>The purchase and the loan it produces.</summary>
/// <param name="HomePrice">The purchase price.</param>
/// <param name="DownPayment">Cash paid up front.</param>
/// <param name="DownPaymentPercent">The down payment as a percentage of the price.</param>
/// <param name="LoanAmount">The amount borrowed.</param>
/// <param name="LoanToValuePercent">The loan as a percentage of the price.</param>
/// <param name="MortgageInsuranceRequired">True when a conventional loan needs PMI: less than 20% down. FHA and VA loans have no PMI.</param>
/// <param name="ConformingLoanLimit">FHFA's conforming loan limit for the year the loan closes (the month before the first payment).</param>
/// <param name="IsJumbo">True for a conventional loan above that limit, which has stricter rules and its own rates. FHA and VA have limits of their own.</param>
public sealed record PurchaseResponse(
    decimal HomePrice,
    decimal DownPayment,
    decimal DownPaymentPercent,
    decimal LoanAmount,
    decimal LoanToValuePercent,
    bool MortgageInsuranceRequired,
    decimal ConformingLoanLimit,
    bool IsJumbo);

/// <summary>One complete repayment schedule and its totals.</summary>
/// <param name="MonthlyPayment">Principal and interest at origination.</param>
/// <param name="MonthlyHousingCosts">Taxes, insurance, PMI and dues in the first month.</param>
/// <param name="TotalMonthlyPayment">Everything due in the first month: principal, interest and housing costs.</param>
/// <param name="NumberOfPayments">How many payments it takes to clear the loan.</param>
/// <param name="TotalInterest">All interest paid.</param>
/// <param name="TotalPaid">All principal and interest paid to the lender.</param>
/// <param name="TotalHousingCosts">Housing costs paid while the loan is outstanding.</param>
/// <param name="MortgageInsuranceEndDate">Due date of the last payment that included PMI, or null if PMI was never charged.</param>
/// <param name="PayoffDate">Due date of the final payment.</param>
/// <param name="Recasts">Recasts that happened, in order.</param>
/// <param name="Payments">Every monthly payment.</param>
/// <param name="RateChanges">Rate resets that happened (an adjustable rate), in order; empty for a fixed rate.</param>
/// <param name="BuydownSubsidy">What a temporary buydown's subsidy pays over this schedule; zero without one.</param>
/// <param name="InterestYouPay">The interest the borrower pays: <paramref name="TotalInterest"/>, less the subsidy when the
/// seller or builder pays for a buydown (the subsidy pays part of the early payments' interest).</param>
public sealed record ScheduleResponse(
    decimal MonthlyPayment,
    HousingCostsResponse MonthlyHousingCosts,
    decimal TotalMonthlyPayment,
    int NumberOfPayments,
    decimal TotalInterest,
    decimal TotalPaid,
    HousingCostsResponse TotalHousingCosts,
    DateOnly? MortgageInsuranceEndDate,
    DateOnly PayoffDate,
    IReadOnlyList<RecastResponse> Recasts,
    IReadOnlyList<PaymentResponse> Payments,
    IReadOnlyList<RateChangeResponse> RateChanges,
    decimal BuydownSubsidy,
    decimal InterestYouPay);

/// <summary>Housing costs by category, for one month, one year, or summed over the loan.</summary>
/// <param name="SchoolTax">School district tax, after its homestead exemption.</param>
/// <param name="LocalTax">County, city and other local taxes.</param>
/// <param name="MudTax">Municipal Utility District tax.</param>
/// <param name="PidAssessment">Public Improvement District assessment.</param>
/// <param name="HomeownersInsurance">Homeowners insurance.</param>
/// <param name="MortgageInsurance">Private mortgage insurance (PMI).</param>
/// <param name="HoaDues">Homeowners association dues.</param>
/// <param name="PropertyTax">All property taxes as one rate, after its homestead exemption (instead of the separate taxes).</param>
/// <param name="Total">The sum of every category.</param>
public sealed record HousingCostsResponse(
    decimal SchoolTax,
    decimal LocalTax,
    decimal MudTax,
    decimal PidAssessment,
    decimal HomeownersInsurance,
    decimal MortgageInsurance,
    decimal HoaDues,
    decimal PropertyTax,
    decimal Total);

/// <summary>A recast of the loan.</summary>
/// <param name="AfterPaymentNumber">The payment whose lump sum triggered the recast.</param>
/// <param name="EffectiveDate">Due date of the first payment at the new amount.</param>
/// <param name="PreviousPayment">Principal and interest before the recast.</param>
/// <param name="NewPayment">Principal and interest after the recast.</param>
/// <param name="Fee">The lender's fee.</param>
public sealed record RecastResponse(
    int AfterPaymentNumber,
    DateOnly EffectiveDate,
    decimal PreviousPayment,
    decimal NewPayment,
    decimal Fee);

/// <summary>One monthly payment.</summary>
/// <param name="PaymentNumber">The 1-based payment number.</param>
/// <param name="DueDate">When the payment is due.</param>
/// <param name="ScheduledPayment">Principal plus interest.</param>
/// <param name="Principal">Principal repaid by the scheduled payment.</param>
/// <param name="Interest">Interest charged this month.</param>
/// <param name="ExtraPrincipal">Additional principal prepaid this month.</param>
/// <param name="HousingCosts">Taxes, insurance, PMI and dues this month.</param>
/// <param name="Costs">The same housing costs, by category (school tax, PMI, HOA dues and so on).</param>
/// <param name="TotalOutlay">Everything the borrower pays this month: scheduled payment, extra principal and housing costs, less any buydown subsidy.</param>
/// <param name="RemainingBalance">The loan balance after this payment.</param>
/// <param name="AnnualInterestRate">The rate this payment's interest is charged at.</param>
/// <param name="BuydownSubsidy">What a buydown's subsidy pays of this payment; 0 without one.</param>
public sealed record PaymentResponse(
    int PaymentNumber,
    DateOnly DueDate,
    decimal ScheduledPayment,
    decimal Principal,
    decimal Interest,
    decimal ExtraPrincipal,
    decimal HousingCosts,
    HousingCostsResponse Costs,
    decimal TotalOutlay,
    decimal RemainingBalance,
    decimal AnnualInterestRate,
    decimal BuydownSubsidy);

/// <summary>What the extra payments are worth.</summary>
/// <param name="InterestSaved">Interest avoided.</param>
/// <param name="MortgageInsuranceSaved">PMI avoided because the balance reached the cancellation point sooner.</param>
/// <param name="RecastFees">Fees paid to recast, subtracted from the savings.</param>
/// <param name="NetSavings">Interest saved plus PMI saved, minus recast fees. Taxes, insurance and dues are excluded because they continue after payoff.</param>
/// <param name="PaymentsSaved">How many fewer payments are needed.</param>
/// <param name="TotalExtraPrincipal">All extra principal paid.</param>
/// <param name="OriginalPayoffDate">Payoff date without extra payments.</param>
/// <param name="AcceleratedPayoffDate">Payoff date with extra payments.</param>
public sealed record SavingsResponse(
    decimal InterestSaved,
    decimal MortgageInsuranceSaved,
    decimal RecastFees,
    decimal NetSavings,
    int PaymentsSaved,
    decimal TotalExtraPrincipal,
    DateOnly OriginalPayoffDate,
    DateOnly AcceleratedPayoffDate);

/// <summary>What a monthly budget buys: the highest price whose payment fits it, at the same down payment share, rate and costs.</summary>
/// <param name="MonthlyBudget">The budget asked about: the whole payment, with taxes, insurance, mortgage insurance and dues.</param>
/// <param name="MaxHomePrice">The highest whole-dollar price whose first month's payment is within the budget; 0 when none is.</param>
/// <param name="DownPayment">The down payment at that price, keeping the home's down payment share.</param>
public sealed record BudgetResponse(decimal MonthlyBudget, decimal MaxHomePrice, decimal DownPayment);
