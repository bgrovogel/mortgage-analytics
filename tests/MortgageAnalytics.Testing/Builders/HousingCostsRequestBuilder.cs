using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Testing.Builders;

/// <summary>
/// Fluent builder for <see cref="HousingCostsRequest"/>. It starts with every cost at zero and no homestead,
/// so a test switches on only the costs it is about.
/// </summary>
public sealed class HousingCostsRequestBuilder
{
    private HousingCostsRequest _costs = new();

    /// <summary>Sets the school district tax rate.</summary>
    public HousingCostsRequestBuilder WithSchoolTax(decimal rate) => With(c => c with { SchoolTaxRate = rate });

    /// <summary>Sets the county, city and other local tax rate.</summary>
    public HousingCostsRequestBuilder WithLocalTax(decimal rate) => With(c => c with { LocalTaxRate = rate });

    /// <summary>Sets the MUD tax rate.</summary>
    public HousingCostsRequestBuilder WithMudTax(decimal rate) => With(c => c with { MudTaxRate = rate });

    /// <summary>All property taxes as one rate, with the dollars of a homestead's value exempt from it.</summary>
    public HousingCostsRequestBuilder WithPropertyTax(decimal rate, decimal homesteadExemption = 0m) =>
        With(c => c with { PropertyTaxRate = rate, PropertyTaxHomesteadExemption = homesteadExemption });

    /// <summary>Marks the home as a homestead, with Texas defaults unless overridden.</summary>
    public HousingCostsRequestBuilder AsHomestead(decimal schoolExemption = 140_000m, decimal localExemptionPercent = 0m, decimal assessmentCap = 10m) =>
        With(c => c with
        {
            IsHomestead = true,
            SchoolHomesteadExemption = schoolExemption,
            LocalHomesteadExemptionPercent = localExemptionPercent,
            HomesteadAssessmentCap = assessmentCap,
        });

    /// <summary>Adds over-65 / disabled relief, with Texas defaults unless overridden.</summary>
    public HousingCostsRequestBuilder WithOver65(
        int qualifiesInYear = 1, decimal schoolExemption = 60_000m, decimal localExemption = 0m, bool localTaxCeiling = false,
        decimal? transferredCeilingPercent = null) =>
        With(c => c with
        {
            Over65OrDisabled = new Over65OrDisabledRequest
            {
                QualifiesInYear = qualifiesInYear,
                SchoolExemption = schoolExemption,
                LocalExemption = localExemption,
                LocalTaxCeiling = localTaxCeiling,
                TransferredCeilingPercent = transferredCeilingPercent,
            },
        });

    /// <summary>Sets the annual market growth of the home's value.</summary>
    public HousingCostsRequestBuilder WithHomeValueGrowth(decimal percent) => With(c => c with { HomeValueGrowthRate = percent });

    /// <summary>Adds a PID assessment.</summary>
    public HousingCostsRequestBuilder WithPid(decimal annualAssessment, int? remainingYears = null) =>
        With(c => c with { Pid = new PidAssessmentRequest(annualAssessment, remainingYears) });

    /// <summary>Adds homeowners insurance, optionally rising each year.</summary>
    public HousingCostsRequestBuilder WithInsurance(decimal annualPremium, decimal annualIncreasePercent = 0m) =>
        With(c => c with { AnnualHomeownersInsurance = annualPremium, InsuranceIncreaseRate = annualIncreasePercent });

    /// <summary>Adds HOA dues, optionally rising each year.</summary>
    public HousingCostsRequestBuilder WithHoa(decimal monthlyDues, decimal annualIncreasePercent = 0m) =>
        With(c => c with { MonthlyHoaDues = monthlyDues, HoaIncreaseRate = annualIncreasePercent });

    /// <summary>Adds PMI at <paramref name="rate"/>, removed automatically at 78% unless told otherwise.</summary>
    public HousingCostsRequestBuilder WithPmi(decimal rate, PmiCancellation cancellation = PmiCancellation.Automatic) =>
        With(c => c with { PmiRate = rate, PmiCancellation = cancellation });

    /// <summary>Applies any other change, for fields with no dedicated method.</summary>
    public HousingCostsRequestBuilder With(Func<HousingCostsRequest, HousingCostsRequest> change)
    {
        _costs = change(_costs);
        return this;
    }

    /// <summary>Adds a change to the tax rates from loan year <paramref name="fromYear"/> (1-based), naming only the rates that change.</summary>
    public HousingCostsRequestBuilder WithRateChange(
        int fromYear, decimal? propertyTaxRate = null, decimal? schoolTaxRate = null, decimal? localTaxRate = null, decimal? mudTaxRate = null) =>
        With(c => c with
        {
            RateChanges = [.. c.RateChanges, new TaxRateChangeRequest
            {
                FromYear = fromYear, PropertyTaxRate = propertyTaxRate, SchoolTaxRate = schoolTaxRate, LocalTaxRate = localTaxRate, MudTaxRate = mudTaxRate,
            }],
        });

    /// <summary>Builds the request section.</summary>
    public HousingCostsRequest Build() => _costs;
}
