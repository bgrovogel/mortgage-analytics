using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Data;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Mapping;

/// <summary>
/// Translates between API contracts and domain objects, so neither leaks into the other.
/// Hand-written rather than AutoMapper: it is short, explicit and easy to step through in a debugger.
/// </summary>
internal static class AmortizationMapper
{
    /// <summary>Builds the purchase (price and down payment) from the request.</summary>
    public static PropertyPurchase ToPurchase(this AmortizationRequest request) =>
        new(request.HomePrice, request.DownPayment) { Occupancy = request.Occupancy.ToDomain() };

    /// <summary>
    /// The FHA or VA loan, or null for a conventional one. The year the loan closes, which picks FHA's loan-size limit,
    /// is taken as the year of the month before the first payment.
    /// </summary>
    public static GovernmentLoan? ToGovernmentLoan(this AmortizationRequest request, PropertyPurchase purchase, DateOnly firstPaymentDate) =>
        request.Program switch
        {
            { Type: LoanProgramType.Fha } p => GovernmentLoan.Fha(
                purchase, request.TermInMonths, firstPaymentDate.AddMonths(-1).Year, p.FinanceUpfrontFee, p.CreditScore,
                p.CountyFips is { } fips ? FhaLoanLimitData.Current.Find(fips)?.Limit : null),
            { Type: LoanProgramType.Va } p => GovernmentLoan.Va(purchase, p.VaUse.ToDomain(), p.FinanceUpfrontFee),
            _ => null,
        };

    private static VaFundingFeeUse ToDomain(this VaFundingFeeType? use) => use switch
    {
        null or VaFundingFeeType.FirstUse => VaFundingFeeUse.FirstUse,
        VaFundingFeeType.SubsequentUse => VaFundingFeeUse.SubsequentUse,
        VaFundingFeeType.Exempt => VaFundingFeeUse.Exempt,
        _ => throw new ArgumentOutOfRangeException(nameof(use), use, "Validated before mapping."),
    };

    /// <summary>
    /// Builds the loan terms for <paramref name="principal"/> (the purchase's loan, plus a financed FHA or VA fee),
    /// first due on <paramref name="firstPaymentDate"/> (the request's, or the default the service chose). An adjustable
    /// rate becomes its expected resets.
    /// </summary>
    public static LoanTerms ToLoanTerms(this AmortizationRequest request, decimal principal, DateOnly firstPaymentDate)
    {
        var loan = new LoanTerms(principal, request.AnnualInterestRate, request.TermInMonths, firstPaymentDate);
        return loan.WithAdjustableRate(request.ToAdjustableRate());
    }

    /// <summary>The adjustable rate, or null for a fixed rate.</summary>
    public static AdjustableRate? ToAdjustableRate(this AmortizationRequest request) => request.AdjustableRate.ToDomain();

    /// <summary>The temporary buydown, or null for none.</summary>
    public static TemporaryBuydown? ToBuydown(this AmortizationRequest request) => request.Buydown.ToDomain();

    /// <summary>The discount points, or null for none.</summary>
    public static DiscountPoints? ToDiscountPoints(this AmortizationRequest request) =>
        request.DiscountPoints is { } p ? new DiscountPoints(p.Points, p.RateWithoutPoints) : null;

    /// <summary>The closing costs, or null when the request asks for no cash-to-close estimate.</summary>
    public static ClosingCosts? ToClosingCosts(this AmortizationRequest request) =>
        request.ClosingCosts is { } c ? new ClosingCosts(c.LoanCosts, c.OtherFees, c.PrepaidInterestDays, c.EscrowMonths, c.Credits, c.LenderCredits) : null;

    /// <summary>Converts the chosen strategy into a recast policy. Only <see cref="ExtraPaymentStrategy.Recast"/> ever recasts.</summary>
    public static RecastPolicy ToRecastPolicy(this AmortizationRequest request)
    {
        if (request.Strategy != ExtraPaymentStrategy.Recast)
            return RecastPolicy.Never;

        var terms = request.Recast ?? new RecastTermsRequest();
        return RecastPolicy.OnLumpSum(terms.MinimumLumpSum, terms.Fee);
    }

    /// <summary>Builds the prepayment plan. Zero amounts are left out, so an all-zero request means no plan.</summary>
    public static ExtraPaymentPlan ToExtraPaymentPlan(this ExtraPaymentsRequest? extras)
    {
        if (extras is null)
            return ExtraPaymentPlan.None;

        var rules = new List<IExtraPaymentRule>();

        if (extras.MonthlyAmount > 0)
            rules.Add(new MonthlyExtraPayment(extras.MonthlyAmount, extras.MonthlyStartingPaymentNumber));

        if (extras.Annual is { Amount: > 0 } annual)
            rules.Add(new AnnualExtraPayment(annual.Amount, annual.FirstPaymentNumber));

        rules.AddRange(extras.LumpSums.Select(l => new LumpSumExtraPayment(l.Amount, l.PaymentNumber)));

        return rules.Count == 0 ? ExtraPaymentPlan.None : new ExtraPaymentPlan(rules);
    }

    /// <summary>
    /// Projects the home's market and taxable value. The assessment cap applies only to a homestead.
    /// Without housing costs the value is held flat.
    /// </summary>
    public static PropertyValuation ToValuation(this HousingCostsRequest? costs, PropertyPurchase purchase) =>
        costs is null
            ? new PropertyValuation(purchase.HomePrice)
            : new PropertyValuation(
                purchase.HomePrice,
                costs.HomeValueGrowthRate,
                costs.IsHomestead ? costs.HomesteadAssessmentCap : null);

    /// <summary>
    /// Builds the housing-cost plan. Zero amounts are left out, so each cost is optional.
    /// Homestead exemptions and over-65 relief apply only when <see cref="HousingCostsRequest.IsHomestead"/> is set.
    /// </summary>
    public static HousingCostPlan ToHousingCostPlan(this HousingCostsRequest? costs, PropertyPurchase purchase, PropertyValuation valuation, int termInMonths)
    {
        if (costs is null)
            return HousingCostPlan.None;

        var schoolExemption = costs.IsHomestead ? new TaxExemption(amount: costs.SchoolHomesteadExemption) : TaxExemption.None;
        var localExemption = costs.IsHomestead ? new TaxExemption(percent: costs.LocalHomesteadExemptionPercent) : TaxExemption.None;
        var mudExemption = costs.IsHomestead ? new TaxExemption(percent: costs.MudHomesteadExemptionPercent) : TaxExemption.None;
        var senior = costs.IsHomestead ? costs.Over65OrDisabled : null;

        // By law the school ceiling always applies to qualifying owners, and can be brought from a former home (as a
        // share of the tax); the county/city ceiling is a local option.
        var schoolRelief = senior is null
            ? null
            : new SeniorTaxRelief(senior.QualifiesInYear - 1, senior.SchoolExemption, hasTaxCeiling: true, senior.TransferredCeilingPercent / 100m);
        var localRelief = senior is null ? null : new SeniorTaxRelief(senior.QualifiesInYear - 1, senior.LocalExemption, senior.LocalTaxCeiling);

        var items = new List<IHousingCost>();

        // Each tax's new rates, by the 0-based year they start in.
        Dictionary<int, decimal> ChangesTo(Func<TaxRateChangeRequest, decimal?> rate) =>
            costs.RateChanges.Where(c => rate(c) is not null).ToDictionary(c => c.FromYear - 1, c => rate(c)!.Value);

        // One combined rate, when that is what is known: the homestead exemption comes off the value it is charged on.
        if (costs.PropertyTaxRate > 0)
        {
            var exemption = costs.IsHomestead ? new TaxExemption(amount: costs.PropertyTaxHomesteadExemption) : TaxExemption.None;
            items.Add(new ValueBasedTax(HousingCostCategory.PropertyTax, valuation, costs.PropertyTaxRate, exemption, rateChanges: ChangesTo(c => c.PropertyTaxRate)));
        }

        if (costs.SchoolTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.SchoolTax, valuation, costs.SchoolTaxRate, schoolExemption, schoolRelief, ChangesTo(c => c.SchoolTaxRate)));

        if (costs.LocalTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.LocalTax, valuation, costs.LocalTaxRate, localExemption, localRelief, ChangesTo(c => c.LocalTaxRate)));

        if (costs.MudTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.MudTax, valuation, costs.MudTaxRate, mudExemption, rateChanges: ChangesTo(c => c.MudTaxRate)));

        if (costs.Pid is { AnnualAssessment: > 0 } pid)
            items.Add(new AnnualFixedCost(HousingCostCategory.PidAssessment, pid.AnnualAssessment, pid.RemainingYears));

        if (costs.AnnualHomeownersInsurance > 0)
            items.Add(new AnnualFixedCost(
                HousingCostCategory.HomeownersInsurance, costs.AnnualHomeownersInsurance, annualIncreasePercent: costs.InsuranceIncreaseRate));

        if (costs.MonthlyHoaDues > 0)
            items.Add(new MonthlyFixedCost(HousingCostCategory.HoaDues, costs.MonthlyHoaDues, costs.HoaIncreaseRate));

        // MortgageInsurance itself charges nothing when the purchase does not require PMI.
        if (costs.PmiRate > 0)
            items.Add(new MortgageInsurance(costs.PmiRate, purchase, costs.PmiCancellation.ToDomain(), termInMonths));

        return items.Count == 0 ? HousingCostPlan.None : new HousingCostPlan(items);
    }

    /// <summary>Maps the contract's PMI option to the domain's.</summary>
    private static MortgageInsuranceCancellation ToDomain(this PmiCancellation cancellation) => cancellation switch
    {
        PmiCancellation.Automatic => MortgageInsuranceCancellation.Automatic,
        PmiCancellation.BorrowerRequested => MortgageInsuranceCancellation.BorrowerRequested,
        _ => throw new ArgumentOutOfRangeException(nameof(cancellation), cancellation, "Validated before mapping."),
    };

    /// <summary>Converts the domain comparison into the API response.</summary>
    /// <param name="comparison">The standard and accelerated schedules with their costs.</param>
    /// <param name="purchase">The price and down payment.</param>
    /// <param name="valuation">The home's projected market and assessed values.</param>
    /// <param name="plan">The housing costs, whose taxes report what each one is charged on.</param>
    /// <param name="rates">The loan, and how its payments are figured: any buydown, and an adjustable rate's worst case.</param>
    /// <param name="closing">The closing costs, or null for no cash-to-close estimate.</param>
    public static AmortizationResponse ToResponse(
        this LoanComparison comparison, PropertyPurchase purchase, PropertyValuation valuation, HousingCostPlan plan, LoanRates rates,
        ClosingCosts? closing = null) =>
        new(
            new PurchaseResponse(
                purchase.HomePrice,
                purchase.DownPayment,
                purchase.DownPaymentPercent,
                purchase.LoanAmount,
                purchase.LoanToValuePercent,
                rates.Program is null && purchase.RequiresMortgageInsurance,
                ConformingLoanLimit.For(rates.Loan.FirstPaymentDate.AddMonths(-1).Year),
                rates.Program is null && purchase.LoanAmount > ConformingLoanLimit.For(rates.Loan.FirstPaymentDate.AddMonths(-1).Year)),
            ToResponse(comparison.Baseline, comparison.BaselineCosts, rates),
            ToResponse(comparison.Accelerated, comparison.AcceleratedCosts, rates),
            new SavingsResponse(
                comparison.InterestSaved,
                comparison.MortgageInsuranceSaved,
                comparison.RecastFees,
                comparison.NetSavings,
                comparison.PaymentsSaved,
                comparison.TotalExtraPrincipal,
                comparison.Baseline.PayoffDate,
                comparison.Accelerated.PayoffDate),
            ToProjection(comparison.Baseline, comparison.BaselineCosts, comparison.Accelerated, comparison.AcceleratedCosts, rates.Loan.Principal, valuation, plan),
            rates.Buydown is { } buydown ? ToResponse(buydown, rates.Loan, comparison.Baseline, rates.BuydownPaidBy) : null,
            rates.WorstCase is { } worst ? ToResponse(worst) : null,
            closing is null ? null : ToResponse(CashToCloseFor(closing, purchase, comparison, rates)),
            rates is { Points: { } points, WithoutPoints: { } without } ? ToResponse(points, rates.Loan.Principal, comparison.Baseline, without) : null,
            rates.Program is { } program ? ToResponse(program, rates.County) : null);

    private static LoanProgramResponse ToResponse(GovernmentLoan program, FhaCountyLimitResponse? county) =>
        new(
            program.Program == LoanProgram.Fha ? LoanProgramType.Fha : LoanProgramType.Va,
            program.UpfrontFeePercent,
            program.UpfrontFee,
            program.UpfrontFeeFinanced,
            program.LoanAmount,
            program.AnnualMipPercent,
            program.MipPayments,
            county is null ? null : $"{county.Name}, {county.State}",
            county?.Limit,
            county is null ? null : FhaLoanLimitData.Current.Year);

    /// <summary>The points against the rate without them, each on its standard schedule.</summary>
    private static DiscountPointsResponse ToResponse(DiscountPoints points, decimal loanAmount, AmortizationSchedule withPoints, AmortizationSchedule without)
    {
        var comparison = points.Compare(loanAmount, withPoints, without);
        return new DiscountPointsResponse(
            points.Points,
            comparison.Cost,
            points.RateWithoutPoints,
            without.InitialMonthlyPayment,
            comparison.MonthlySaving,
            comparison.InterestSaved,
            comparison.NetSaving,
            comparison.BreakEvenPayment,
            comparison.BreakEvenPayment is { } number ? DueDateOf(withPoints, number) : null);
    }

    /// <summary>
    /// Prices the closing costs from the loan: interest at the note rate, and the first loan year's property taxes and
    /// insurance (the escrowed costs; PID, HOA dues and PMI are left out). A buydown the buyer pays for, and discount
    /// points, are paid at closing; one the seller pays for counts against the limit on what they may pay.
    /// </summary>
    internal static CashToClose CashToCloseFor(ClosingCosts closing, PropertyPurchase purchase, LoanComparison comparison, LoanRates rates)
    {
        var subsidy = rates.Buydown?.TotalSubsidy(rates.Loan, comparison.Baseline) ?? 0m;
        var paidByBuyer = rates.BuydownPaidBy == BuydownPayer.Borrower;
        return CashToCloseFor(closing, purchase, comparison, rates, paidByBuyer ? subsidy : 0m, paidByBuyer ? 0m : subsidy);
    }

    /// <summary>The cash to close, with a buydown's subsidy split between the buyer and the seller.</summary>
    internal static CashToClose CashToCloseFor(
        ClosingCosts closing, PropertyPurchase purchase, LoanComparison comparison, LoanRates rates, decimal buyersBuydown, decimal sellersBuydown)
    {
        var yearOne = comparison.BaselineCosts.ByYear[0];
        var taxes = yearOne[HousingCostCategory.PropertyTax] + yearOne[HousingCostCategory.SchoolTax]
            + yearOne[HousingCostCategory.LocalTax] + yearOne[HousingCostCategory.MudTax];

        return closing.CashToClose(purchase, rates.Loan, taxes, yearOne[HousingCostCategory.HomeownersInsurance], buyersBuydown,
            rates.Points?.CostFor(rates.Loan.Principal) ?? 0m,
            rates.Program is { UpfrontFeeFinanced: false } program ? program.UpfrontFee : 0m,
            sellersBuydown,
            rates.Program?.Program ?? LoanProgram.Conventional);
    }

    private static CashToCloseResponse ToResponse(CashToClose cash) =>
        new(
            cash.DownPayment,
            cash.LoanCosts,
            cash.OtherFees,
            cash.DailyInterest,
            cash.PrepaidInterestDays,
            cash.PrepaidInterest,
            cash.HomeownersInsurance,
            cash.MonthlyEscrow,
            cash.EscrowMonths,
            cash.EscrowDeposit,
            cash.BuydownCost,
            cash.DiscountPoints,
            cash.UpfrontMortgageFee,
            cash.ClosingCosts,
            cash.SellerCredits,
            cash.LenderCredits,
            cash.Credits,
            cash.UnusedCredits,
            cash.Total,
            new ConcessionsResponse(
                cash.Limit.Percent,
                cash.Limit.Amount,
                cash.SellerBuydown,
                cash.Concessions,
                cash.ConcessionsOverLimit,
                cash.Limit.ExcludesNormalClosingCosts,
                cash.Limit.NextTier is { } next ? new ConcessionTierResponse(next.DownPayment, next.Percent, next.Amount) : null));

    /// <summary>The bought-down years, then the first at the note rate, the subsidy over the standard schedule, and who pays it.</summary>
    private static BuydownResponse ToResponse(TemporaryBuydown buydown, LoanTerms loan, AmortizationSchedule schedule, BuydownPayer paidBy) =>
        new(
            loan.AnnualInterestRate,
            [.. Enumerable.Range(1, buydown.YearlyReductions.Count + 1)
                .Select(year => new BuydownYearResponse(
                    year, buydown.RateForYear(loan, year), buydown.PaymentForYear(loan, year), buydown.SubsidyForYear(loan, schedule, year)))],
            buydown.TotalSubsidy(loan, schedule),
            paidBy.ToResponse());

    /// <summary>Who pays for a buydown, in the request's terms.</summary>
    private static BuydownFunding ToResponse(this BuydownPayer paidBy) =>
        paidBy == BuydownPayer.Borrower ? BuydownFunding.Borrower : BuydownFunding.Seller;

    /// <summary>Who pays for a buydown, in the domain's terms.</summary>
    internal static BuydownPayer ToDomain(this BuydownFunding paidBy) => paidBy switch
    {
        BuydownFunding.Seller => BuydownPayer.Seller,
        BuydownFunding.Borrower => BuydownPayer.Borrower,
        _ => throw new ArgumentOutOfRangeException(nameof(paidBy), paidBy, "Validated before mapping."),
    };

    /// <summary>How the home is used, in the domain's terms.</summary>
    internal static Occupancy ToDomain(this OccupancyType occupancy) => occupancy switch
    {
        OccupancyType.PrimaryResidence => Occupancy.PrimaryResidence,
        OccupancyType.SecondHome => Occupancy.SecondHome,
        OccupancyType.InvestmentProperty => Occupancy.InvestmentProperty,
        _ => throw new ArgumentOutOfRangeException(nameof(occupancy), occupancy, "Validated before mapping."),
    };

    /// <summary>The worst case of an adjustable rate: its resets, the highest payment, and the interest.</summary>
    private static AdjustableRateResponse ToResponse(AmortizationSchedule worst) =>
        new(
            ToRateChanges(worst),
            worst.RateChanges.Select(c => c.NewPayment).Append(worst.InitialMonthlyPayment).Max(),
            worst.TotalInterest);

    private static List<RateChangeResponse> ToRateChanges(AmortizationSchedule schedule) =>
        [.. schedule.RateChanges.Select(c => new RateChangeResponse(
            c.PaymentNumber, DueDateOf(schedule, c.PaymentNumber), c.PreviousRate, c.NewRate, c.PreviousPayment, c.NewPayment))];

    /// <summary>
    /// One row per year of the standard schedule. The standard schedule is used because it spans
    /// the full term, and taxes, insurance and dues continue whether or not the loan is paid off early. Mortgage
    /// insurance, the balance and equity follow the <paramref name="accelerated"/> schedule instead: PMI stops when the
    /// loan actually paid reaches 80% (or is paid off), and the balance is what will actually be owed on the plan.
    /// </summary>
    private static List<YearProjectionResponse> ToProjection(
        AmortizationSchedule schedule, HousingCostSchedule costs, AmortizationSchedule accelerated, HousingCostSchedule acceleratedCosts,
        decimal principal, PropertyValuation valuation, HousingCostPlan plan)
    {
        // Owed at the start of a year: the loan before the first payment, then the balance after the year before's last
        // payment, and nothing once the loan is paid off.
        decimal BalanceAtStartOf(int index) =>
            index == 0 ? principal : accelerated.Payments.ElementAtOrDefault((index * 12) - 1)?.RemainingBalance ?? 0m;

        var taxes = plan.Taxes.ToDictionary(t => t.Category);
        decimal? TaxableValue(HousingCostCategory category, int year) =>
            taxes.TryGetValue(category, out var tax) ? tax.TaxableValueInYear(year) : null;

        // The plan's mortgage insurance that year, and none once its loan is paid off.
        decimal InsuranceIn(int index) =>
            acceleratedCosts.ByYear.ElementAtOrDefault(index)?[HousingCostCategory.MortgageInsurance] ?? 0m;

        return costs.ByYear
            .Select((year, index) => new YearProjectionResponse(
                index + 1,
                schedule.Payments[index * 12].DueDate,
                valuation.MarketValueInYear(index),
                valuation.AssessedValueInYear(index),
                TaxableValue(HousingCostCategory.SchoolTax, index),
                TaxableValue(HousingCostCategory.LocalTax, index),
                TaxableValue(HousingCostCategory.MudTax, index),
                TaxableValue(HousingCostCategory.PropertyTax, index),
                ToResponse(year.With(HousingCostCategory.MortgageInsurance, InsuranceIn(index))),
                BalanceAtStartOf(index),
                valuation.MarketValueInYear(index) - BalanceAtStartOf(index)))
            .ToList();
    }

    private static ScheduleResponse ToResponse(AmortizationSchedule schedule, HousingCostSchedule costs, LoanRates rates)
    {
        decimal Subsidy(ScheduledPayment p) => rates.Buydown?.SubsidyFor(rates.Loan, p.PaymentNumber, p.ScheduledAmount) ?? 0m;

        var firstMonth = costs.Periods[0];

        return new ScheduleResponse(
            schedule.InitialMonthlyPayment,
            ToResponse(firstMonth),
            schedule.InitialMonthlyPayment + firstMonth.Total,
            schedule.NumberOfPayments,
            schedule.TotalInterest,
            schedule.TotalPaid,
            ToResponse(costs.Totals),
            costs.MortgageInsuranceLastPayment is { } last ? DueDateOf(schedule, last) : null,
            schedule.PayoffDate,
            schedule.Recasts.Select(r => new RecastResponse(
                r.AfterPaymentNumber,
                DueDateOf(schedule, r.AfterPaymentNumber + 1),
                r.PreviousPayment,
                r.NewPayment,
                r.Fee)).ToList(),
            schedule.Payments.Select((p, i) => new PaymentResponse(
                p.PaymentNumber,
                p.DueDate,
                p.ScheduledAmount,
                p.Principal,
                p.Interest,
                p.ExtraPrincipal,
                costs.Periods[i].Total,
                ToResponse(costs.Periods[i]),
                p.TotalPaid + costs.Periods[i].Total - Subsidy(p),
                p.RemainingBalance,
                rates.Loan.AnnualRateFor(p.PaymentNumber),
                Subsidy(p))).ToList(),
            ToRateChanges(schedule),
            rates.Buydown?.TotalSubsidy(rates.Loan, schedule) ?? 0m,
            rates.Buydown?.InterestYouPay(rates.Loan, schedule, rates.BuydownPaidBy) ?? schedule.TotalInterest);
    }

    /// <summary>The due date of payment <paramref name="paymentNumber"/>; payments are numbered from 1 in order.</summary>
    private static DateOnly DueDateOf(AmortizationSchedule schedule, int paymentNumber) =>
        schedule.Payments[paymentNumber - 1].DueDate;

    private static HousingCostsResponse ToResponse(HousingCostBreakdown breakdown) =>
        new(
            breakdown[HousingCostCategory.SchoolTax],
            breakdown[HousingCostCategory.LocalTax],
            breakdown[HousingCostCategory.MudTax],
            breakdown[HousingCostCategory.PidAssessment],
            breakdown[HousingCostCategory.HomeownersInsurance],
            breakdown[HousingCostCategory.MortgageInsurance],
            breakdown[HousingCostCategory.HoaDues],
            breakdown[HousingCostCategory.PropertyTax],
            breakdown.Total);
}
