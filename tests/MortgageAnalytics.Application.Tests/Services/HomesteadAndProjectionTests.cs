namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for homestead exemptions, over-65 relief, the assessment cap, yearly increases
/// and the ownership projection. The home is the reference $250,000 purchase with 20% down (no PMI).
/// </summary>
[TestFixture]
public class HomesteadAndProjectionTests : SociableAnalysisTestBase
{
    [Test]
    public void Homestead_SchoolTaxIsChargedOnlyOnValueAboveTheExemption()
    {
        var month = Service.Analyze(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).AsHomestead())).Baseline.MonthlyHousingCosts;

        Assert.That(month.SchoolTax, Is.EqualTo(91.67m), "1% of ($250,000 - $140,000) = $1,100 a year");
    }

    [Test]
    public void NotAHomestead_TheExemptionIsIgnored()
    {
        var month = Service.Analyze(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m))).Baseline.MonthlyHousingCosts;

        Assert.That(month.SchoolTax, Is.EqualTo(208.33m), "1% of the full $250,000 = $2,500 a year");
    }

    [Test]
    public void Homestead_SchoolExemptionDoesNotReduceCountyCityOrMudTax()
    {
        var request = A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).WithLocalTax(1.1m).WithMudTax(0.85m).AsHomestead());

        var month = Service.Analyze(request).Baseline.MonthlyHousingCosts;

        Assert.Multiple(() =>
        {
            Assert.That(month.SchoolTax, Is.EqualTo(91.67m), "the school exemption applies to school tax");
            Assert.That(month.LocalTax, Is.EqualTo(229.17m), "county/city tax is on the full $250,000");
            Assert.That(month.MudTax, Is.EqualTo(177.08m), "MUD tax is on the full $250,000");
        });
    }

    [Test]
    public void Homestead_LocalPercentageExemptionReducesCountyAndCityTax()
    {
        var request = A.Request.WithHousingCosts(c => c.WithLocalTax(1.1m).AsHomestead(localExemptionPercent: 20m));

        var month = Service.Analyze(request).Baseline.MonthlyHousingCosts;

        Assert.That(month.LocalTax, Is.EqualTo(183.33m), "1.1% of ($250,000 less 20%) = $2,200 a year");
    }

    [Test]
    public void NotAHomestead_LocalPercentageExemptionIsIgnored()
    {
        var request = A.Request.WithHousingCosts(c => c.WithLocalTax(1.1m).With(h => h with { LocalHomesteadExemptionPercent = 20m }));

        var month = Service.Analyze(request).Baseline.MonthlyHousingCosts;

        Assert.That(month.LocalTax, Is.EqualTo(229.17m), "homestead exemptions need a homestead");
    }

    [Test]
    public void Over65_AddsTheExtraSchoolExemption()
    {
        var request = A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).AsHomestead().WithOver65());

        var projection = Service.Analyze(request).Projection;

        Assert.That(projection[0].Costs.SchoolTax, Is.EqualTo(500m), "1% of ($250,000 - $140,000 - $60,000)");
    }

    [Test]
    public void Over65_FreezesSchoolTaxFromTheQualifyingYear_ButCountyTaxKeepsRising()
    {
        var request = A.Request.WithHousingCosts(c => c
            .WithSchoolTax(1m).WithLocalTax(1m).AsHomestead().WithHomeValueGrowth(10m).WithOver65(qualifiesInYear: 3));

        var projection = Service.Analyze(request).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[2].Costs.SchoolTax, Is.EqualTo(1_025m), "($302,500 - $200,000) x 1% sets the ceiling");
            Assert.That(projection[10].Costs.SchoolTax, Is.EqualTo(1_025m), "school tax stays frozen");
            Assert.That(projection[10].Costs.LocalTax, Is.GreaterThan(projection[2].Costs.LocalTax), "county tax has no ceiling here");
        });
    }

    [TestCase(0)]
    [TestCase(20)]
    public void Over65_LocalCeilingAndExemption_ApplyWhenTheCountyOffersThem(int year)
    {
        var request = A.Request.WithHousingCosts(c => c
            .WithLocalTax(1m).AsHomestead().WithHomeValueGrowth(10m).WithOver65(localExemption: 50_000m, localTaxCeiling: true));

        var projection = Service.Analyze(request).Projection;

        Assert.That(projection[year].Costs.LocalTax, Is.EqualTo(2_000m), "($250,000 - $50,000) x 1%, frozen by the local ceiling");
    }

    [Test]
    public void Over65_IsIgnoredWhenTheHomeIsNotAHomestead()
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithSchoolTax(1m).WithOver65())).Projection;

        Assert.That(projection[0].Costs.SchoolTax, Is.EqualTo(2_500m), "over-65 relief is a homestead benefit");
    }

    [Test]
    public void Projection_HasOneRowPerLoanYear_WithStartDates()
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithLocalTax(2m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection, Has.Count.EqualTo(30), "a 30-year loan projects 30 years");
            Assert.That(projection[0].Year, Is.EqualTo(1), "years are numbered from 1");
            Assert.That(projection[0].StartDate, Is.EqualTo(ReferenceLoans.FirstPaymentDate), "year 1 starts with the first payment");
            Assert.That(projection[1].StartDate, Is.EqualTo(new DateOnly(2027, 1, 1)), "year 2 starts 12 payments later");
            Assert.That(projection[0].Costs.LocalTax, Is.EqualTo(5_000m), "a full year's tax, to the cent");
        });
    }

    [Test]
    public void Projection_HomesteadCapHoldsTaxableValueBelowAFastRisingMarket()
    {
        var request = A.Request.WithHousingCosts(c => c.WithLocalTax(2m).AsHomestead().WithHomeValueGrowth(15m));

        var year2 = Service.Analyze(request).Projection[1];

        Assert.Multiple(() =>
        {
            Assert.That(year2.MarketValue, Is.EqualTo(287_500m), "$250,000 + 15%");
            Assert.That(year2.TaxableValue, Is.EqualTo(275_000m), "capped at $250,000 + 10%");
            Assert.That(year2.Costs.LocalTax, Is.EqualTo(5_500m), "2% of $275,000; installments add up exactly");
        });
    }

    [Test]
    public void Projection_WithoutHomestead_TaxableValueTracksTheMarket()
    {
        var year2 = Service.Analyze(A.Request.WithHousingCosts(c => c.WithLocalTax(2m).WithHomeValueGrowth(15m))).Projection[1];

        Assert.That(year2.TaxableValue, Is.EqualTo(year2.MarketValue), "only a homestead gets the assessment cap");
    }

    [TestCase(0, 2_400, 1_200, TestName = "Year 1: starting amounts")]
    [TestCase(1, 2_520, 1_236, TestName = "Year 2: insurance +5%, HOA +3%")]
    public void Projection_InsuranceAndHoaRiseEachYear(int year, decimal expectedInsurance, decimal expectedHoa)
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithInsurance(2_400m, 5m).WithHoa(100m, 3m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[year].Costs.HomeownersInsurance, Is.EqualTo(expectedInsurance), "insurance compounds at 5% a year");
            Assert.That(projection[year].Costs.HoaDues, Is.EqualTo(expectedHoa), "HOA dues compound at 3% a year");
        });
    }

    [Test]
    public void Projection_FollowsTheStandardSchedule_EvenWhenExtrasPayTheLoanOffEarly()
    {
        var response = Service.Analyze(A.Request.WithMonthlyExtra(1_000m).WithHousingCosts(c => c.WithLocalTax(2m)));

        Assert.Multiple(() =>
        {
            Assert.That(response.Accelerated.NumberOfPayments, Is.LessThan(360), "the extras pay the loan off early");
            Assert.That(response.Projection, Has.Count.EqualTo(30), "but taxes continue, so the projection spans the full term");
        });
    }

    [Test]
    public void Projection_WithoutHousingCosts_StillProjectsAFlatValue()
    {
        var projection = Service.Analyze(A.Request).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[29].MarketValue, Is.EqualTo(ReferenceLoans.Standard.HomePrice), "no growth assumption means a flat value");
            Assert.That(projection[29].Costs.Total, Is.Zero, "and no costs");
        });
    }
}
