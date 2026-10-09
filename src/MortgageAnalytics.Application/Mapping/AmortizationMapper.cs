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

    /// <summary>Builds the loan terms, using <paramref name="defaultFirstPaymentDate"/> when the request has none.</summary>
    public static LoanTerms ToLoanTerms(this AmortizationRequest request, PropertyPurchase purchase, DateOnly defaultFirstPaymentDate) =>
        new(purchase.LoanAmount, request.AnnualInterestRate, request.TermInMonths, request.FirstPaymentDate ?? defaultFirstPaymentDate);

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
    /// Homestead exemptions apply only when <see cref="HousingCostsRequest.IsHomestead"/> is set.
    /// </summary>
    public static HousingCostPlan ToHousingCostPlan(this HousingCostsRequest? costs, PropertyPurchase purchase, PropertyValuation valuation)
    {
        if (costs is null)
            return HousingCostPlan.None;

        var schoolExemption = costs.IsHomestead ? new TaxExemption(amount: costs.SchoolHomesteadExemption) : TaxExemption.None;
        var localExemption = costs.IsHomestead ? new TaxExemption(percent: costs.LocalHomesteadExemptionPercent) : TaxExemption.None;

        var items = new List<IHousingCost>();

        if (costs.SchoolTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.SchoolTax, valuation, costs.SchoolTaxRate, schoolExemption));

        if (costs.PropertyTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.PropertyTax, valuation, costs.PropertyTaxRate, localExemption));

        if (costs.MudTaxRate > 0)
            items.Add(new ValueBasedTax(HousingCostCategory.MudTax, valuation, costs.MudTaxRate));

        if (costs.Pid is { AnnualAssessment: > 0 } pid)
            items.Add(new AnnualFixedCost(HousingCostCategory.PidAssessment, pid.AnnualAssessment, pid.RemainingYears));

        if (costs.AnnualHomeownersInsurance > 0)
            items.Add(new AnnualFixedCost(
                HousingCostCategory.HomeownersInsurance, costs.AnnualHomeownersInsurance, annualIncreasePercent: costs.InsuranceIncreaseRate));

        if (costs.MonthlyHoaDues > 0)
            items.Add(new MonthlyFixedCost(HousingCostCategory.HoaDues, costs.MonthlyHoaDues, costs.HoaIncreaseRate));

        if (costs.PmiRate > 0 && purchase.RequiresMortgageInsurance)
            items.Add(new MortgageInsurance(costs.PmiRate, purchase, costs.PmiCancellation));

        return items.Count == 0 ? HousingCostPlan.None : new HousingCostPlan(items);
    }

    /// <summary>Converts the domain comparison into the API response.</summary>
    /// <param name="comparison">The standard and accelerated schedules with their costs.</param>
    /// <param name="purchase">The price and down payment.</param>
    /// <param name="valuation">The home's projected market and taxable values.</param>
    public static AmortizationResponse ToResponse(this LoanComparison comparison, PropertyPurchase purchase, PropertyValuation valuation) =>
        new(
            new PurchaseResponse(
                purchase.HomePrice,
                purchase.DownPayment,
                purchase.DownPaymentPercent,
                purchase.LoanAmount,
                purchase.LoanToValuePercent,
                purchase.RequiresMortgageInsurance),
            ToResponse(comparison.Baseline, comparison.BaselineCosts),
            ToResponse(comparison.Accelerated, comparison.AcceleratedCosts),
            new SavingsResponse(
                comparison.InterestSaved,
                comparison.MortgageInsuranceSaved,
                comparison.RecastFees,
                comparison.NetSavings,
                comparison.PaymentsSaved,
                comparison.TotalExtraPrincipal,
                comparison.Baseline.PayoffDate,
                comparison.Accelerated.PayoffDate),
            ToProjection(comparison.Baseline, comparison.BaselineCosts, valuation));

    /// <summary>
    /// One row per year of the standard schedule. The standard schedule is used because it spans
    /// the full term, and taxes, insurance and dues continue whether or not the loan is paid off early.
    /// </summary>
    private static List<YearProjectionResponse> ToProjection(
        AmortizationSchedule schedule, HousingCostSchedule costs, PropertyValuation valuation) =>
        costs.ByYear
            .Select((year, index) => new YearProjectionResponse(
                index + 1,
                schedule.Payments[index * 12].DueDate,
                valuation.MarketValueInYear(index),
                valuation.AssessedValueInYear(index),
                ToResponse(year)))
            .ToList();

    private static ScheduleResponse ToResponse(AmortizationSchedule schedule, HousingCostSchedule costs)
    {
        var firstMonth = costs.Periods[0];
        var dueDates = schedule.Payments.ToDictionary(p => p.PaymentNumber, p => p.DueDate);

        return new ScheduleResponse(
            schedule.InitialMonthlyPayment,
            ToResponse(firstMonth),
            schedule.InitialMonthlyPayment + firstMonth.Total,
            schedule.NumberOfPayments,
            schedule.TotalInterest,
            schedule.TotalPaid,
            ToResponse(costs.Totals),
            costs.MortgageInsuranceLastPayment is { } last ? dueDates[last] : null,
            schedule.PayoffDate,
            schedule.Recasts.Select(r => new RecastResponse(
                r.AfterPaymentNumber,
                dueDates[r.AfterPaymentNumber + 1],
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
                costs.Periods[i][HousingCostCategory.MortgageInsurance],
                p.TotalPaid + costs.Periods[i].Total,
                p.RemainingBalance)).ToList());
    }

    private static HousingCostsResponse ToResponse(HousingCostBreakdown breakdown) =>
        new(
            breakdown[HousingCostCategory.SchoolTax],
            breakdown[HousingCostCategory.PropertyTax],
            breakdown[HousingCostCategory.MudTax],
            breakdown[HousingCostCategory.PidAssessment],
            breakdown[HousingCostCategory.HomeownersInsurance],
            breakdown[HousingCostCategory.MortgageInsurance],
            breakdown[HousingCostCategory.HoaDues],
            breakdown.Total);
}
