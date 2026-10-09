using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;

namespace MortgageAnalytics.Application.Tests.Services;

[TestFixture]
public class AmortizationServiceTests
{
    private static readonly DateTimeOffset Today = new(2026, 10, 9, 15, 30, 0, TimeSpan.Zero);

    private readonly AmortizationService _service = CreateService(Today);

    /// <summary>$250,000 home with 20% down: a $200,000 loan at 6% over 30 years, and no PMI.</summary>
    private static readonly AmortizationRequest TwentyPercentDown = new()
    {
        HomePrice = 250_000m,
        DownPayment = 50_000m,
        AnnualInterestRate = 6m,
        TermInMonths = 360,
        FirstPaymentDate = new DateOnly(2026, 1, 1),
    };

    /// <summary>$250,000 home with 5% down: a $237,500 loan at 6.5%, which needs PMI.</summary>
    private static readonly AmortizationRequest FivePercentDown = TwentyPercentDown with
    {
        DownPayment = 12_500m,
        AnnualInterestRate = 6.5m,
    };

    private static AmortizationService CreateService(DateTimeOffset now) =>
        new(new LoanComparer(new AmortizationCalculator()), new FixedTimeProvider(now));

    // ---------------------------------------------------------------------------------------
    // Purchase and schedules.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_DerivesTheLoanFromPriceAndDownPayment()
    {
        var purchase = _service.Analyze(FivePercentDown).Purchase;

        Assert.Multiple(() =>
        {
            Assert.That(purchase.LoanAmount, Is.EqualTo(237_500m));
            Assert.That(purchase.DownPaymentPercent, Is.EqualTo(5m));
            Assert.That(purchase.LoanToValuePercent, Is.EqualTo(95m));
            Assert.That(purchase.MortgageInsuranceRequired, Is.True);
        });
    }

    [Test]
    public void Analyze_WithoutExtras_ReturnsIdenticalSchedulesAndNoSavings()
    {
        var response = _service.Analyze(TwentyPercentDown);

        Assert.Multiple(() =>
        {
            Assert.That(response.Baseline.MonthlyPayment, Is.EqualTo(1_199.10m));
            Assert.That(response.Baseline.TotalInterest, Is.EqualTo(231_677.04m));
            Assert.That(response.Baseline.Payments, Has.Count.EqualTo(360));
            Assert.That(response.Savings.NetSavings, Is.Zero);
            Assert.That(response.Savings.PaymentsSaved, Is.Zero);
        });
        AssertSameSchedule(response.Accelerated, response.Baseline);
    }

    [Test]
    public void Analyze_MapsEveryKindOfExtraPayment()
    {
        var request = TwentyPercentDown with
        {
            ExtraPayments = new ExtraPaymentsRequest
            {
                MonthlyAmount = 100m,
                MonthlyStartingPaymentNumber = 2,
                Annual = new AnnualExtraPaymentRequest(1_000m, 12),
                LumpSums = [new LumpSumPaymentRequest(12, 5_000m)],
            },
        };

        var payments = _service.Analyze(request).Accelerated.Payments;

        Assert.Multiple(() =>
        {
            Assert.That(payments[0].ExtraPrincipal, Is.Zero, "monthly extra starts on payment 2");
            Assert.That(payments[1].ExtraPrincipal, Is.EqualTo(100m));
            Assert.That(payments[11].ExtraPrincipal, Is.EqualTo(6_100m), "monthly + annual + lump sum");
            Assert.That(payments[23].ExtraPrincipal, Is.EqualTo(1_100m), "monthly + annual");
        });
    }

    [Test]
    public void Analyze_ReportsSavingsAndBothPayoffDates()
    {
        var request = TwentyPercentDown with { ExtraPayments = new ExtraPaymentsRequest { MonthlyAmount = 200m } };

        var savings = _service.Analyze(request).Savings;

        Assert.Multiple(() =>
        {
            Assert.That(savings.PaymentsSaved, Is.EqualTo(108));
            Assert.That(savings.InterestSaved, Is.EqualTo(79_800.86m));
            Assert.That(savings.NetSavings, Is.EqualTo(79_800.86m));
            Assert.That(savings.OriginalPayoffDate, Is.EqualTo(new DateOnly(2055, 12, 1)));
            Assert.That(savings.AcceleratedPayoffDate, Is.EqualTo(new DateOnly(2046, 12, 1)));
        });
    }

    // ---------------------------------------------------------------------------------------
    // Recasting.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_Recast_LowersThePaymentAfterAQualifyingLumpSum_AndChargesTheFee()
    {
        var request = TwentyPercentDown with
        {
            Strategy = ExtraPaymentStrategy.Recast,
            Recast = new RecastTermsRequest { MinimumLumpSum = 10_000m, Fee = 250m },
            ExtraPayments = new ExtraPaymentsRequest { LumpSums = [new LumpSumPaymentRequest(12, 50_000m)] },
        };

        var response = _service.Analyze(request);

        var recast = response.Accelerated.Recasts.Single();
        Assert.Multiple(() =>
        {
            Assert.That(recast.AfterPaymentNumber, Is.EqualTo(12));
            Assert.That(recast.EffectiveDate, Is.EqualTo(new DateOnly(2027, 1, 1)), "the new payment starts with payment 13");
            Assert.That(recast.NewPayment, Is.EqualTo(895.60m));
            Assert.That(response.Accelerated.NumberOfPayments, Is.EqualTo(360));
            Assert.That(response.Savings.RecastFees, Is.EqualTo(250m));
            Assert.That(response.Savings.NetSavings, Is.EqualTo(response.Savings.InterestSaved - 250m));
        });
    }

    [Test]
    public void Analyze_Recast_DefaultsToTheTypicalTenThousandDollarMinimum()
    {
        var request = TwentyPercentDown with
        {
            Strategy = ExtraPaymentStrategy.Recast,
            ExtraPayments = new ExtraPaymentsRequest
            {
                LumpSums = [new LumpSumPaymentRequest(12, 9_999.99m), new LumpSumPaymentRequest(24, 10_000m)],
            },
        };

        var recasts = _service.Analyze(request).Accelerated.Recasts;

        Assert.That(recasts.Select(r => r.AfterPaymentNumber), Is.EqualTo(new[] { 24 }));
    }

    [Test]
    public void Analyze_ShortenTerm_IgnoresRecastTerms()
    {
        var request = TwentyPercentDown with
        {
            Strategy = ExtraPaymentStrategy.ShortenTerm,
            Recast = new RecastTermsRequest { MinimumLumpSum = 0m, Fee = 0m },
            ExtraPayments = new ExtraPaymentsRequest { LumpSums = [new LumpSumPaymentRequest(12, 50_000m)] },
        };

        var accelerated = _service.Analyze(request).Accelerated;

        Assert.Multiple(() =>
        {
            Assert.That(accelerated.Recasts, Is.Empty);
            Assert.That(accelerated.NumberOfPayments, Is.LessThan(360));
        });
    }

    // ---------------------------------------------------------------------------------------
    // Housing costs.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_BreaksDownTheFirstMonthsHousingCosts()
    {
        var request = FivePercentDown with
        {
            HousingCosts = new HousingCostsRequest
            {
                PropertyTaxRate = 2.1m,
                MudTaxRate = 0.85m,
                Pid = new PidAssessmentRequest(1_200m, 10),
                AnnualHomeownersInsurance = 2_400m,
                MonthlyHoaDues = 75m,
                PmiRate = 0.5m,
            },
        };

        var baseline = _service.Analyze(request).Baseline;

        var costs = baseline.MonthlyHousingCosts;
        Assert.Multiple(() =>
        {
            Assert.That(costs.PropertyTax, Is.EqualTo(437.50m));
            Assert.That(costs.MudTax, Is.EqualTo(177.08m));
            Assert.That(costs.PidAssessment, Is.EqualTo(100m));
            Assert.That(costs.HomeownersInsurance, Is.EqualTo(200m));
            Assert.That(costs.MortgageInsurance, Is.EqualTo(98.96m));
            Assert.That(costs.HoaDues, Is.EqualTo(75m));
            Assert.That(costs.Total, Is.EqualTo(1_088.54m));
            Assert.That(baseline.TotalMonthlyPayment, Is.EqualTo(baseline.MonthlyPayment + 1_088.54m));
            Assert.That(baseline.Payments[0].TotalOutlay, Is.EqualTo(baseline.TotalMonthlyPayment));
        });
    }

    [Test]
    public void Analyze_PidAssessmentEndsAfterItsRemainingYears()
    {
        var request = TwentyPercentDown with
        {
            HousingCosts = new HousingCostsRequest { Pid = new PidAssessmentRequest(1_200m, RemainingYears: 10) },
        };

        var payments = _service.Analyze(request).Baseline.Payments;

        Assert.Multiple(() =>
        {
            Assert.That(payments[119].HousingCosts, Is.EqualTo(100m));
            Assert.That(payments[120].HousingCosts, Is.Zero);
        });
    }

    [Test]
    public void Analyze_ReportsPmiEndDateAndPmiSavings()
    {
        var request = FivePercentDown with
        {
            ExtraPayments = new ExtraPaymentsRequest { MonthlyAmount = 300m },
            HousingCosts = new HousingCostsRequest { PmiRate = 0.5m },
        };

        var response = _service.Analyze(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Baseline.MortgageInsuranceEndDate, Is.EqualTo(new DateOnly(2037, 3, 1)), "payment 135");
            Assert.That(response.Accelerated.MortgageInsuranceEndDate, Is.EqualTo(new DateOnly(2031, 9, 1)), "payment 69");
            Assert.That(response.Savings.MortgageInsuranceSaved, Is.EqualTo(6_531.36m));
            Assert.That(response.Savings.NetSavings, Is.EqualTo(response.Savings.InterestSaved + 6_531.36m));
        });
    }

    [Test]
    public void Analyze_PmiRateIsIgnoredWithTwentyPercentDown()
    {
        var request = TwentyPercentDown with { HousingCosts = new HousingCostsRequest { PmiRate = 0.5m } };

        var response = _service.Analyze(request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Purchase.MortgageInsuranceRequired, Is.False);
            Assert.That(response.Baseline.TotalHousingCosts.MortgageInsurance, Is.Zero);
            Assert.That(response.Baseline.MortgageInsuranceEndDate, Is.Null);
        });
    }

    [Test]
    public void Analyze_BorrowerRequestedPmiRemoval_EndsSooner()
    {
        var automatic = FivePercentDown with { HousingCosts = new HousingCostsRequest { PmiRate = 0.5m } };
        var requested = FivePercentDown with
        {
            HousingCosts = new HousingCostsRequest { PmiRate = 0.5m, PmiCancellation = MortgageInsuranceCancellation.BorrowerRequested },
        };

        var automaticEnd = _service.Analyze(automatic).Baseline.MortgageInsuranceEndDate;
        var requestedEnd = _service.Analyze(requested).Baseline.MortgageInsuranceEndDate;

        Assert.That(requestedEnd, Is.LessThan(automaticEnd!.Value));
    }

    // ---------------------------------------------------------------------------------------
    // Defaults.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_ZeroAmounts_AreTreatedAsNotProvided()
    {
        var request = TwentyPercentDown with
        {
            ExtraPayments = new ExtraPaymentsRequest { MonthlyAmount = 0m, Annual = new AnnualExtraPaymentRequest(0m) },
            HousingCosts = new HousingCostsRequest(),
        };

        var response = _service.Analyze(request);

        AssertSameSchedule(response.Accelerated, response.Baseline);
        Assert.That(response.Baseline.TotalHousingCosts.Total, Is.Zero);
    }

    [Test]
    public void Analyze_WithoutAFirstPaymentDate_DefaultsToTheFirstOfNextMonth()
    {
        var response = _service.Analyze(TwentyPercentDown with { FirstPaymentDate = null });

        Assert.That(response.Baseline.Payments[0].DueDate, Is.EqualTo(new DateOnly(2026, 11, 1)));
    }

    [Test]
    public void Analyze_InDecember_DefaultFirstPaymentRollsIntoNextYear()
    {
        var service = CreateService(new DateTimeOffset(2026, 12, 15, 0, 0, 0, TimeSpan.Zero));

        var response = service.Analyze(TwentyPercentDown with { FirstPaymentDate = null });

        Assert.That(response.Baseline.Payments[0].DueDate, Is.EqualTo(new DateOnly(2027, 1, 1)));
    }

    /// <summary>Records compare collection members by reference, so the rows are compared explicitly.</summary>
    private static void AssertSameSchedule(ScheduleResponse actual, ScheduleResponse expected)
    {
        Assert.That(actual with { Payments = expected.Payments, Recasts = expected.Recasts }, Is.EqualTo(expected));
        Assert.That(actual.Payments, Is.EqualTo(expected.Payments));
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
