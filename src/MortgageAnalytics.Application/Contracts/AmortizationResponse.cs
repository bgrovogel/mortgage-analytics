namespace MortgageAnalytics.Application.Contracts;

/// <summary>A standard schedule compared with an accelerated one, for a specific purchase.</summary>
/// <param name="Purchase">The price, down payment and resulting loan.</param>
/// <param name="Baseline">The loan with no extra payments.</param>
/// <param name="Accelerated">The loan with the requested extra payments (and recasts) applied.</param>
/// <param name="Savings">What the extra payments save, net of recast fees.</param>
/// <param name="Projection">Home value, taxable value and housing costs for each year of the standard schedule.</param>
public sealed record AmortizationResponse(
    PurchaseResponse Purchase,
    ScheduleResponse Baseline,
    ScheduleResponse Accelerated,
    SavingsResponse Savings,
    IReadOnlyList<YearProjectionResponse> Projection);

/// <summary>One loan year of the ownership projection.</summary>
/// <param name="Year">The 1-based loan year.</param>
/// <param name="StartDate">Due date of the year's first payment.</param>
/// <param name="MarketValue">Projected market value of the home.</param>
/// <param name="AssessedValue">The value the appraisal district assesses: market value, held down by the homestead cap. Before any exemption.</param>
/// <param name="SchoolTaxableValue">What school tax is charged on: the assessed value minus the school homestead (and over-65) exemptions. Null when there is no school tax.</param>
/// <param name="LocalTaxableValue">What county/city tax is charged on, after its own exemptions. Null when there is no county/city tax.</param>
/// <param name="MudTaxableValue">What MUD tax is charged on (MUDs grant no homestead exemption). Null when there is no MUD tax.</param>
/// <param name="Costs">Housing costs paid during the year, by category.</param>
public sealed record YearProjectionResponse(
    int Year,
    DateOnly StartDate,
    decimal MarketValue,
    decimal AssessedValue,
    decimal? SchoolTaxableValue,
    decimal? LocalTaxableValue,
    decimal? MudTaxableValue,
    HousingCostsResponse Costs);

/// <summary>The purchase and the loan it produces.</summary>
/// <param name="HomePrice">The purchase price.</param>
/// <param name="DownPayment">Cash paid up front.</param>
/// <param name="DownPaymentPercent">The down payment as a percentage of the price.</param>
/// <param name="LoanAmount">The amount borrowed.</param>
/// <param name="LoanToValuePercent">The loan as a percentage of the price.</param>
/// <param name="MortgageInsuranceRequired">True when less than 20% is put down.</param>
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
    IReadOnlyList<PaymentResponse> Payments);

/// <summary>Housing costs by category, for one month, one year, or summed over the loan.</summary>
/// <param name="SchoolTax">School district tax, after its homestead exemption.</param>
/// <param name="LocalTax">County, city and other local taxes.</param>
/// <param name="MudTax">Municipal Utility District tax.</param>
/// <param name="PidAssessment">Public Improvement District assessment.</param>
/// <param name="HomeownersInsurance">Homeowners insurance.</param>
/// <param name="MortgageInsurance">Private mortgage insurance (PMI).</param>
/// <param name="HoaDues">Homeowners association dues.</param>
/// <param name="Total">The sum of every category.</param>
public sealed record HousingCostsResponse(
    decimal SchoolTax,
    decimal LocalTax,
    decimal MudTax,
    decimal PidAssessment,
    decimal HomeownersInsurance,
    decimal MortgageInsurance,
    decimal HoaDues,
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
/// <param name="TotalOutlay">Everything paid this month: scheduled payment, extra principal and housing costs.</param>
/// <param name="RemainingBalance">The loan balance after this payment.</param>
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
    decimal RemainingBalance);

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
