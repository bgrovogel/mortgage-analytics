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
    LoanProgramResponse? Program = null);

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
/// <param name="Credits">The seller's and lender's credits used: never more than the closing costs.</param>
/// <param name="UnusedCredits">Credits beyond the closing costs, which cannot pay the down payment.</param>
/// <param name="Total">The cash to close: the down payment plus closing costs, less credits.</param>
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
    decimal Credits,
    decimal UnusedCredits,
    decimal Total);

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
public sealed record BuydownYearResponse(int Year, decimal AnnualInterestRate, decimal MonthlyPayment);

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
public sealed record PurchaseResponse(
    decimal HomePrice,
    decimal DownPayment,
    decimal DownPaymentPercent,
    decimal LoanAmount,
    decimal LoanToValuePercent,
    bool MortgageInsuranceRequired);

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
