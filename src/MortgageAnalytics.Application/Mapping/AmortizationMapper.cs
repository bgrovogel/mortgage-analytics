using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Amortization;
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
        new(request.HomePrice, request.DownPayment);

    /// <summary>
    /// Builds the loan terms, using <paramref name="defaultFirstPaymentDate"/> when the request has none. An
    /// adjustable rate becomes its expected resets.
    /// </summary>
    public static LoanTerms ToLoanTerms(this AmortizationRequest request, PropertyPurchase purchase, DateOnly defaultFirstPaymentDate)
    {
        var loan = new LoanTerms(purchase.LoanAmount, request.AnnualInterestRate, request.TermInMonths, request.FirstPaymentDate ?? defaultFirstPaymentDate);
        return request.ToAdjustableRate() is { } arm ? loan.WithRateChanges(arm.RatePath(loan.AnnualInterestRate, loan.TermInMonths)) : loan;
    }

    /// <summary>The adjustable rate, or null for a fixed rate.</summary>
    public static AdjustableRate? ToAdjustableRate(this AmortizationRequest request) =>
        request.AdjustableRate is { } arm
            ? new AdjustableRate(arm.InitialFixedMonths, arm.AdjustmentIntervalMonths, arm.ExpectedRate, arm.InitialCap, arm.PeriodicCap, arm.LifetimeCap)
            : null;

    /// <summary>The temporary buydown, or null for none.</summary>
    public static TemporaryBuydown? ToBuydown(this AmortizationRequest request) =>
        request.Buydown is { } buydown ? new TemporaryBuydown(buydown.YearlyReductions) : null;

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
    public static HousingCostPlan ToHousingCostPlan(this HousingCostsRequest? costs, PropertyPurchase purchase, PropertyValuation valuation)
    {
        if (costs is null)
            return HousingCostPlan.None;

        var schoolExemption = costs.IsHomestead ? new TaxExemption(amount: costs.SchoolHomesteadExemption) : TaxExemption.None;
        var localExemption = costs.IsHomestead ? new TaxExemption(percent: costs.LocalHomesteadExemptionPercent) : TaxExemption.None;
        var mudExemption = costs.IsHomestead ? new TaxExemption(percent: costs.MudHomesteadExemptionPercent) : TaxExemption.None;
        var senior = costs.IsHomestead ? costs.Over65OrDisabled : null;

        // By law the school ceiling always applies to qualifying owners; the county/city ceiling is a local option.
        var schoolRelief = senior is null ? null : new SeniorTaxRelief(senior.QualifiesInYear - 1, senior.SchoolExemption, hasTaxCeiling: true);
        var localRelief = senior is null ? null : new SeniorTaxRelief(senior.QualifiesInYear - 1, senior.LocalExemption, senior.LocalTaxCeiling);

        var items = new List<IHousingCost>();

        // One combined rate, when that is what is known: the homestead exemption comes off the value it is charged on.
        if (costs.PropertyTaxRate > 0)
        {
            var exemption = costs.IsHomestead ? new TaxExemption(amount: costs.PropertyTaxHomesteadExemption) : TaxExemption.None;
            items.Add(new ValueBasedTax(HousingCostCategory.PropertyTax, valuation, costs.PropertyTaxRate, exemption));
        }

        if (costs.SchoolTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.SchoolTax, valuation, costs.SchoolTaxRate, schoolExemption, schoolRelief));

        if (costs.LocalTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.LocalTax, valuation, costs.LocalTaxRate, localExemption, localRelief));

        if (costs.MudTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.MudTax, valuation, costs.MudTaxRate, mudExemption));

        if (costs.Pid is { AnnualAssessment: > 0 } pid)
            items.Add(new AnnualFixedCost(HousingCostCategory.PidAssessment, pid.AnnualAssessment, pid.RemainingYears));

        if (costs.AnnualHomeownersInsurance > 0)
            items.Add(new AnnualFixedCost(
                HousingCostCategory.HomeownersInsurance, costs.AnnualHomeownersInsurance, annualIncreasePercent: costs.InsuranceIncreaseRate));

        if (costs.MonthlyHoaDues > 0)
            items.Add(new MonthlyFixedCost(HousingCostCategory.HoaDues, costs.MonthlyHoaDues, costs.HoaIncreaseRate));

        // MortgageInsurance itself charges nothing when the purchase does not require PMI.
        if (costs.PmiRate > 0)
            items.Add(new MortgageInsurance(costs.PmiRate, purchase, costs.PmiCancellation.ToDomain()));

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
    public static AmortizationResponse ToResponse(
        this LoanComparison comparison, PropertyPurchase purchase, PropertyValuation valuation, HousingCostPlan plan, LoanRates rates) =>
        new(
            new PurchaseResponse(
                purchase.HomePrice,
                purchase.DownPayment,
                purchase.DownPaymentPercent,
                purchase.LoanAmount,
                purchase.LoanToValuePercent,
                purchase.RequiresMortgageInsurance),
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
            ToProjection(comparison.Baseline, comparison.BaselineCosts, valuation, plan),
            rates.Buydown is { } buydown ? ToResponse(buydown, rates.Loan, comparison.Baseline) : null,
            rates.WorstCase is { } worst ? ToResponse(worst) : null);

    /// <summary>The bought-down years, then the first at the note rate, and the subsidy over the standard schedule.</summary>
    private static BuydownResponse ToResponse(TemporaryBuydown buydown, LoanTerms loan, AmortizationSchedule schedule) =>
        new(
            loan.AnnualInterestRate,
            [.. Enumerable.Range(1, buydown.YearlyReductions.Count + 1)
                .Select(year => new BuydownYearResponse(year, buydown.RateForYear(loan, year), buydown.PaymentForYear(loan, year)))],
            schedule.Payments.Sum(p => buydown.SubsidyFor(loan, p.PaymentNumber, p.ScheduledAmount)));

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
    /// the full term, and taxes, insurance and dues continue whether or not the loan is paid off early.
    /// </summary>
    private static List<YearProjectionResponse> ToProjection(
        AmortizationSchedule schedule, HousingCostSchedule costs, PropertyValuation valuation, HousingCostPlan plan)
    {
        var taxes = plan.Taxes.ToDictionary(t => t.Category);
        decimal? TaxableValue(HousingCostCategory category, int year) =>
            taxes.TryGetValue(category, out var tax) ? tax.TaxableValueInYear(year) : null;

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
                ToResponse(year)))
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
            ToRateChanges(schedule));
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
