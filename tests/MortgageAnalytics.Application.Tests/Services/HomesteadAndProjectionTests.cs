using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>Homestead exemptions, the assessment cap, yearly increases and the ownership projection.</summary>
[TestFixture]
public class HomesteadAndProjectionTests
{
    private readonly AmortizationService _service =
        new(new LoanComparer(new AmortizationCalculator()), TimeProvider.System);

    /// <summary>$250,000 home with 20% down, so PMI never muddies the tax figures.</summary>
    private static readonly AmortizationRequest Home = new()
    {
        HomePrice = 250_000m,
        DownPayment = 50_000m,
        AnnualInterestRate = 6m,
        TermInMonths = 360,
        FirstPaymentDate = new DateOnly(2026, 1, 1),
    };

    private static AmortizationRequest With(HousingCostsRequest costs) => Home with { HousingCosts = costs };

    [Test]
    public void Homestead_SchoolTaxIsChargedOnlyOnValueAboveTheExemption()
    {
        // School 1% on ($250,000 - $140,000) = $1,100 a year = $91.67 a month.
        var costs = new HousingCostsRequest { SchoolTaxRate = 1m, IsHomestead = true, SchoolHomesteadExemption = 140_000m };

        var month = _service.Analyze(With(costs)).Baseline.MonthlyHousingCosts;

        Assert.That(month.SchoolTax, Is.EqualTo(91.67m));
    }

    [Test]
    public void NotAHomestead_TheExemptionIsIgnored()
    {
        // School 1% on the full $250,000 = $2,500 a year = $208.33 a month.
        var costs = new HousingCostsRequest { SchoolTaxRate = 1m, IsHomestead = false, SchoolHomesteadExemption = 140_000m };

        var month = _service.Analyze(With(costs)).Baseline.MonthlyHousingCosts;

        Assert.That(month.SchoolTax, Is.EqualTo(208.33m));
    }

    [Test]
    public void Homestead_SchoolExemptionDoesNotReduceCountyCityOrMudTax()
    {
        var costs = new HousingCostsRequest
        {
            SchoolTaxRate = 1m,
            PropertyTaxRate = 1.1m,
            MudTaxRate = 0.85m,
            IsHomestead = true,
            SchoolHomesteadExemption = 140_000m,
        };

        var month = _service.Analyze(With(costs)).Baseline.MonthlyHousingCosts;

        Assert.Multiple(() =>
        {
            Assert.That(month.SchoolTax, Is.EqualTo(91.67m), "exempted");
            Assert.That(month.PropertyTax, Is.EqualTo(229.17m), "1.1% of the full $250,000");
            Assert.That(month.MudTax, Is.EqualTo(177.08m), "0.85% of the full $250,000");
        });
    }

    [Test]
    public void Homestead_LocalPercentageExemptionReducesCountyAndCityTax()
    {
        // 1.1% on $250,000 less 20% = $200,000 -> $2,200 a year -> $183.33 a month.
        var costs = new HousingCostsRequest { PropertyTaxRate = 1.1m, IsHomestead = true, LocalHomesteadExemptionPercent = 20m };

        var month = _service.Analyze(With(costs)).Baseline.MonthlyHousingCosts;

        Assert.That(month.PropertyTax, Is.EqualTo(183.33m));
    }

    [Test]
    public void Over65_AddsTheExtraSchoolExemption()
    {
        // School 1% on ($250,000 - $140,000 - $60,000) = $500 a year.
        var costs = new HousingCostsRequest
        {
            SchoolTaxRate = 1m,
            IsHomestead = true,
            Over65OrDisabled = new Over65OrDisabledRequest { QualifiesInYear = 1, SchoolExemption = 60_000m },
        };

        var projection = _service.Analyze(With(costs)).Projection;

        Assert.That(projection[0].Costs.SchoolTax, Is.EqualTo(500m));
    }

    [Test]
    public void Over65_FreezesSchoolTaxFromTheQualifyingYear_ButCountyTaxKeepsRising()
    {
        // Value +10% a year. The owner qualifies in year 3; school tax freezes there, county tax does not.
        var costs = new HousingCostsRequest
        {
            SchoolTaxRate = 1m,
            PropertyTaxRate = 1m,
            IsHomestead = true,
            HomeValueGrowthRate = 10m,
            Over65OrDisabled = new Over65OrDisabledRequest { QualifiesInYear = 3, SchoolExemption = 60_000m },
        };

        var projection = _service.Analyze(With(costs)).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[2].Costs.SchoolTax, Is.EqualTo(1_025m), "($302,500 - $200,000) x 1% sets the ceiling");
            Assert.That(projection[10].Costs.SchoolTax, Is.EqualTo(1_025m), "frozen");
            Assert.That(projection[10].Costs.PropertyTax, Is.GreaterThan(projection[2].Costs.PropertyTax), "no local ceiling");
        });
    }

    [Test]
    public void Over65_LocalCeilingAndExemption_ApplyWhenTheCountyOffersThem()
    {
        var costs = new HousingCostsRequest
        {
            PropertyTaxRate = 1m,
            IsHomestead = true,
            HomeValueGrowthRate = 10m,
            Over65OrDisabled = new Over65OrDisabledRequest { LocalExemption = 50_000m, LocalTaxCeiling = true },
        };

        var projection = _service.Analyze(With(costs)).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[0].Costs.PropertyTax, Is.EqualTo(2_000m), "($250,000 - $50,000) x 1%");
            Assert.That(projection[20].Costs.PropertyTax, Is.EqualTo(2_000m), "frozen by the local ceiling");
        });
    }

    [Test]
    public void Over65_IsIgnoredWhenTheHomeIsNotAHomestead()
    {
        var costs = new HousingCostsRequest
        {
            SchoolTaxRate = 1m,
            IsHomestead = false,
            Over65OrDisabled = new Over65OrDisabledRequest(),
        };

        var projection = _service.Analyze(With(costs)).Projection;

        Assert.That(projection[0].Costs.SchoolTax, Is.EqualTo(2_500m), "1% of the full $250,000");
    }

    [Test]
    public void Projection_HasOneRowPerLoanYear_WithStartDates()
    {
        var projection = _service.Analyze(With(new HousingCostsRequest { PropertyTaxRate = 2m })).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection, Has.Count.EqualTo(30));
            Assert.That(projection[0].Year, Is.EqualTo(1));
            Assert.That(projection[0].StartDate, Is.EqualTo(new DateOnly(2026, 1, 1)));
            Assert.That(projection[1].StartDate, Is.EqualTo(new DateOnly(2027, 1, 1)));
            Assert.That(projection[0].Costs.PropertyTax, Is.EqualTo(5_000m));
        });
    }

    [Test]
    public void Projection_HomesteadCapHoldsTaxableValueBelowAFastRisingMarket()
    {
        var costs = new HousingCostsRequest
        {
            PropertyTaxRate = 2m,
            IsHomestead = true,
            HomesteadAssessmentCap = 10m,
            HomeValueGrowthRate = 15m,
        };

        var year2 = _service.Analyze(With(costs)).Projection[1];

        Assert.Multiple(() =>
        {
            Assert.That(year2.MarketValue, Is.EqualTo(287_500m), "$250,000 + 15%");
            Assert.That(year2.TaxableValue, Is.EqualTo(275_000m), "capped at $250,000 + 10%");
            Assert.That(year2.Costs.PropertyTax, Is.EqualTo(5_500m), "2% of $275,000; installments add up exactly");
        });
    }

    [Test]
    public void Projection_WithoutHomestead_TaxableValueTracksTheMarket()
    {
        var costs = new HousingCostsRequest { PropertyTaxRate = 2m, IsHomestead = false, HomeValueGrowthRate = 15m };

        var year2 = _service.Analyze(With(costs)).Projection[1];

        Assert.That(year2.TaxableValue, Is.EqualTo(year2.MarketValue));
    }

    [Test]
    public void Projection_InsuranceAndHoaRiseEachYear()
    {
        var costs = new HousingCostsRequest
        {
            AnnualHomeownersInsurance = 2_400m,
            InsuranceIncreaseRate = 5m,
            MonthlyHoaDues = 100m,
            HoaIncreaseRate = 3m,
        };

        var projection = _service.Analyze(With(costs)).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[0].Costs.HomeownersInsurance, Is.EqualTo(2_400m));
            Assert.That(projection[1].Costs.HomeownersInsurance, Is.EqualTo(2_520m));
            Assert.That(projection[0].Costs.HoaDues, Is.EqualTo(1_200m));
            Assert.That(projection[1].Costs.HoaDues, Is.EqualTo(1_236m));
        });
    }

    [Test]
    public void Projection_FollowsTheStandardSchedule_EvenWhenExtrasPayTheLoanOffEarly()
    {
        var request = With(new HousingCostsRequest { PropertyTaxRate = 2m }) with
        {
            ExtraPayments = new ExtraPaymentsRequest { MonthlyAmount = 1_000m },
        };

        var response = _service.Analyze(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Accelerated.NumberOfPayments, Is.LessThan(360));
            Assert.That(response.Projection, Has.Count.EqualTo(30), "taxes continue after payoff");
        });
    }
}
