using MortgageAnalytics.Application.Contracts;
using Extra200 = MortgageAnalytics.Testing.ReferenceLoans.StandardWithMonthlyExtra200;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

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
    public void Homestead_MudPercentageExemptionReducesMudTax_WithTheSameMinimum()
    {
        var mud = (decimal percent) => Service.Analyze(A.Request.WithHousingCosts(c => c.WithMudTax(0.85m).AsHomestead()
            .With(h => h with { MudHomesteadExemptionPercent = percent }))).Baseline.MonthlyHousingCosts.MudTax;
        var notHomestead = Service.Analyze(A.Request.WithHousingCosts(c => c.WithMudTax(0.85m)
            .With(h => h with { MudHomesteadExemptionPercent = 20m }))).Baseline.MonthlyHousingCosts.MudTax;

        Assert.Multiple(() =>
        {
            Assert.That(mud(20m), Is.EqualTo(141.67m), "0.85% of $200,000: 20% of $250,000 is exempt");
            Assert.That(mud(1m), Is.EqualTo(173.54m), "1% would be $2,500, but a percentage exemption is never under $5,000");
            Assert.That(notHomestead, Is.EqualTo(177.08m), "only a homestead is exempt");
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
    public void Projection_HomesteadCapHoldsTheAssessedValueBelowAFastRisingMarket()
    {
        var request = A.Request.WithHousingCosts(c => c.WithLocalTax(2m).AsHomestead().WithHomeValueGrowth(15m));

        var year2 = Service.Analyze(request).Projection[1];

        Assert.Multiple(() =>
        {
            Assert.That(year2.MarketValue, Is.EqualTo(287_500m), "$250,000 + 15%");
            Assert.That(year2.AssessedValue, Is.EqualTo(275_000m), "capped at $250,000 + 10%");
            Assert.That(year2.Costs.LocalTax, Is.EqualTo(5_500m), "2% of $275,000; installments add up exactly");
        });
    }

    [Test]
    public void Projection_WithoutHomestead_TheAssessedValueTracksTheMarket()
    {
        var year2 = Service.Analyze(A.Request.WithHousingCosts(c => c.WithLocalTax(2m).WithHomeValueGrowth(15m))).Projection[1];

        Assert.That(year2.AssessedValue, Is.EqualTo(year2.MarketValue), "only a homestead gets the assessment cap");
    }

    [Test]
    public void Projection_ShowsTheValueEachTaxIsChargedOn_AfterItsOwnExemptions()
    {
        var request = A.Request.WithHousingCosts(c => c
            .WithSchoolTax(1m).WithLocalTax(1m).WithMudTax(0.85m)
            .AsHomestead(schoolExemption: 140_000m, localExemptionPercent: 20m));

        var year1 = Service.Analyze(request).Projection[0];

        Assert.Multiple(() =>
        {
            Assert.That(year1.AssessedValue, Is.EqualTo(250_000m), "the home's value");
            Assert.That(year1.SchoolTaxableValue, Is.EqualTo(110_000m), "school tax: $250,000 - $140,000");
            Assert.That(year1.LocalTaxableValue, Is.EqualTo(200_000m), "county/city tax: $250,000 - 20%");
            Assert.That(year1.MudTaxableValue, Is.EqualTo(250_000m), "MUD tax: no homestead exemption");
            Assert.That(year1.Costs.SchoolTax, Is.EqualTo(1_100m), "and the tax follows it: 1% of $110,000");
        });
    }

    [Test]
    public void Projection_HasNoTaxableValue_ForATaxThatIsNotCharged()
    {
        var year1 = Service.Analyze(A.Request.WithHousingCosts(c => c.WithLocalTax(2m))).Projection[0];

        Assert.Multiple(() =>
        {
            Assert.That(year1.SchoolTaxableValue, Is.Null, "no school tax, no school taxable value");
            Assert.That(year1.MudTaxableValue, Is.Null, "nor MUD");
            Assert.That(year1.LocalTaxableValue, Is.EqualTo(250_000m), "the tax that is charged has one");
        });
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

    [Test]
    public void OnePropertyTaxRate_IsChargedOnTheValueLessItsHomesteadExemption()
    {
        var homestead = Service.Analyze(A.Request.WithHousingCosts(c => c.WithPropertyTax(2m, 50_000m).AsHomestead()));
        var rental = Service.Analyze(A.Request.WithHousingCosts(c => c.WithPropertyTax(2m, 50_000m)));

        Assert.Multiple(() =>
        {
            Assert.That(homestead.Baseline.MonthlyHousingCosts.PropertyTax, Is.EqualTo(333.33m), "2% of $200,000 = $4,000 a year: $50,000 of the $250,000 is exempt");
            Assert.That(homestead.Baseline.MonthlyHousingCosts.SchoolTax, Is.Zero, "no separate taxes");
            Assert.That(homestead.Projection[0].PropertyTaxableValue, Is.EqualTo(200_000m), "what it is charged on");
            Assert.That(homestead.Projection[0].SchoolTaxableValue, Is.Null, "and no school tax at all");
            Assert.That(rental.Baseline.MonthlyHousingCosts.PropertyTax, Is.EqualTo(416.67m), "a home that is not a homestead pays on the full $250,000");
        });
    }

    [Test]
    public void OnePropertyTaxRate_FollowsTheAppraisalCap_LikeTheSeparateTaxes()
    {
        // The home gains 10% in a year; a homestead's taxable value may rise only 5%: $262,500, less the $50,000 exempt.
        var year2 = Service.Analyze(A.Request.WithHousingCosts(c => c.WithHomeValueGrowth(10m).AsHomestead(assessmentCap: 5m).WithPropertyTax(2m, 50_000m))).Projection[1];

        Assert.Multiple(() =>
        {
            Assert.That(year2.MarketValue, Is.EqualTo(275_000m), "the market value");
            Assert.That(year2.AssessedValue, Is.EqualTo(262_500m), "capped at 5% more");
            Assert.That(year2.PropertyTaxableValue, Is.EqualTo(212_500m), "less the exemption");
            Assert.That(year2.Costs.PropertyTax, Is.EqualTo(4_250m), "2% of it, for the year");
        });
    }

    [Test]
    public void Equity_IsTheHomesValue_LessWhatIsStillOwed_AtTheStartOfEachYear()
    {
        var projection = Service.Analyze(A.Request.WithHousingCosts(c => c.WithHomeValueGrowth(3m))).Projection;

        Assert.Multiple(() =>
        {
            Assert.That(projection[0].LoanBalance, Is.EqualTo(Standard.LoanAmount), "year 1 starts owing the whole loan");
            Assert.That(projection[0].Equity, Is.EqualTo(Standard.DownPayment), "so the equity is the down payment");
            Assert.That(projection[1].LoanBalance, Is.EqualTo(197_543.99m), "year 2 starts after 12 payments (tools/calculator-check)");
            Assert.That(projection[1].Equity, Is.EqualTo(257_500m - 197_543.99m), "against the home's value then: $250,000 grown 3%");
            Assert.That(projection[10].LoanBalance, Is.EqualTo(167_371.60m), "year 11 starts after 120 payments");
        });
    }

    [Test]
    public void Equity_FollowsTheExtraPayments_AndIsTheWholeHomeOncePaidOff()
    {
        var response = Service.Analyze(A.Request.WithMonthlyExtra(Extra200.MonthlyExtra));
        var projection = response.Projection;
        var paidOffInYear = Extra200.NumberOfPayments / 12 + 1;

        Assert.Multiple(() =>
        {
            Assert.That(projection[1].LoanBalance, Is.EqualTo(response.Accelerated.Payments[11].RemainingBalance),
                "the balance is what you will owe on your plan, extra payments included");
            Assert.That(projection[1].LoanBalance, Is.LessThan(197_543.99m), "less than without them");
            Assert.That(projection[paidOffInYear].LoanBalance, Is.Zero, $"nothing is owed once the loan is paid off in year {paidOffInYear}");
            Assert.That(projection[paidOffInYear].Equity, Is.EqualTo(projection[paidOffInYear].MarketValue), "so the whole home is equity");
        });
    }

    [Test]
    public void Projection_PmiStopsWhenThePlanWithExtraPaymentsReaches80Percent()
    {
        // Taxes, insurance and dues run the full term whatever is paid extra; PMI stops with the loan actually paid.
        var request = A.Request.FivePercentDown().WithMonthlyExtra(300m)
            .WithHousingCosts(c => c.WithPmi(0.5m, PmiCancellation.BorrowerRequested).WithHoa(50m));

        var response = Service.Analyze(request);
        var projected = response.Projection.Sum(y => y.Costs.MortgageInsurance);

        Assert.Multiple(() =>
        {
            Assert.That(projected, Is.EqualTo(response.Accelerated.TotalHousingCosts.MortgageInsurance), "the PMI the plan pays, as the overview says");
            Assert.That(projected, Is.LessThan(response.Baseline.TotalHousingCosts.MortgageInsurance), "not the standard schedule's");
            Assert.That(response.Projection.Sum(y => y.Costs.HoaDues), Is.EqualTo(response.Projection.Count * 600m), "dues run every year");
            Assert.That(response.Projection.All(y => y.Costs.Total == y.Costs.MortgageInsurance + y.Costs.HoaDues), Is.True, "each total follows");
        });
    }
}
