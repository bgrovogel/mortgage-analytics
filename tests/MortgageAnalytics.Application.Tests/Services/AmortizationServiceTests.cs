using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Unit tests: the domain comparer is substituted, so each test checks one mapping decision
/// the service makes, never the financial math.
/// </summary>
[TestFixture]
public class AmortizationServiceTests : AmortizationServiceTestBase
{
    // ---------------------------------------------------------------------------------------
    // Request -> domain.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_DerivesTheLoanFromPriceAndDownPayment()
    {
        Service.Analyze(A.Request.FivePercentDown());

        var (loan, _, _, _) = CompareArguments();
        Assert.Multiple(() =>
        {
            Assert.That(loan.Principal, Is.EqualTo(ReferenceLoans.FivePercentDown.LoanAmount), "the loan is the price minus the down payment");
            Assert.That(loan.AnnualInterestRate, Is.EqualTo(ReferenceLoans.FivePercentDown.AnnualInterestRate), "the rate is passed through");
            Assert.That(loan.TermInMonths, Is.EqualTo(Standard.TermInMonths), "the term is passed through");
            Assert.That(loan.FirstPaymentDate, Is.EqualTo(ReferenceLoans.FirstPaymentDate), "an explicit first payment date is used as-is");
        });
    }

    [Test]
    public void Analyze_WithoutAFirstPaymentDate_DefaultsToTheFirstOfNextMonth()
    {
        Service.Analyze(A.Request.WithFirstPaymentDate(null));

        Assert.That(CompareArguments().Loan.FirstPaymentDate, Is.EqualTo(TestClock.FirstOfNextMonth), "the default is the first of next month, from the injected clock");
    }

    [Test]
    public void Analyze_InDecember_DefaultFirstPaymentRollsIntoNextYear()
    {
        Clock.SetUtcNow(new DateTimeOffset(2026, 12, 15, 0, 0, 0, TimeSpan.Zero));

        Service.Analyze(A.Request.WithFirstPaymentDate(null));

        Assert.That(CompareArguments().Loan.FirstPaymentDate, Is.EqualTo(new DateOnly(2027, 1, 1)), "December's next month is January of next year");
    }

    [Test]
    public void Analyze_ShortenTerm_NeverRecasts_EvenWhenRecastTermsAreSent()
    {
        Service.Analyze(A.Request.WithStrategy(ExtraPaymentStrategy.ShortenTerm).WithRecastTerms(0m, 0m));

        Assert.That(CompareArguments().Recast, Is.EqualTo(RecastPolicy.Never), "recast terms only matter when the Recast strategy is chosen");
    }

    [Test]
    public void Analyze_Recast_UsesTheLendersTerms()
    {
        Service.Analyze(A.Request.WithRecast(minimumLumpSum: 15_000m, fee: 400m));

        Assert.That(CompareArguments().Recast, Is.EqualTo(RecastPolicy.OnLumpSum(15_000m, 400m)), "the request's minimum and fee become the policy");
    }

    [Test]
    public void Analyze_RecastWithoutTerms_DefaultsToTenThousandAndTwoFifty()
    {
        Service.Analyze(A.Request.WithStrategy(ExtraPaymentStrategy.Recast));

        Assert.That(CompareArguments().Recast, Is.EqualTo(RecastPolicy.OnLumpSum(10_000m, 250m)), "the typical lender terms are the default");
    }

    [Test]
    public void Analyze_WithoutExtras_PassesAnEmptyPlan()
    {
        Service.Analyze(A.Request);

        Assert.That(CompareArguments().Extras.IsEmpty, Is.True, "no extra-payments section means no plan");
    }

    [Test]
    public void Analyze_ZeroExtraAmounts_AreTreatedAsNoPlan()
    {
        Service.Analyze(A.Request.WithMonthlyExtra(0m).WithAnnualExtra(0m));

        Assert.That(CompareArguments().Extras.IsEmpty, Is.True, "an all-zero section adds no rules, so the comparison can reuse the baseline");
    }

    [TestCase(1, 0, TestName = "Monthly extra starts on payment 2")]
    [TestCase(2, 100, TestName = "Monthly extra only")]
    [TestCase(12, 6_100, TestName = "Monthly + annual + lump sum")]
    [TestCase(24, 1_100, TestName = "Monthly + annual")]
    public void Analyze_MapsEveryKindOfExtraPayment(int paymentNumber, decimal expected)
    {
        Service.Analyze(A.Request.WithMonthlyExtra(100m, startingPaymentNumber: 2).WithAnnualExtra(1_000m, 12).WithLumpSum(12, 5_000m));

        Assert.That(CompareArguments().Extras.AmountFor(paymentNumber), Is.EqualTo(expected), $"extra principal due with payment {paymentNumber}");
    }

    [Test]
    public void Analyze_WithoutHousingCosts_PassesAnEmptyPlan()
    {
        Service.Analyze(A.Request);

        Assert.That(CompareArguments().Costs.IsEmpty, Is.True, "no housing-costs section means principal and interest only");
    }

    [Test]
    public void Analyze_ZeroHousingCosts_AreTreatedAsNoPlan()
    {
        Service.Analyze(A.Request.WithHousingCosts(c => c));

        Assert.That(CompareArguments().Costs.IsEmpty, Is.True, "an all-zero section adds no costs");
    }

    [Test]
    public void Analyze_PmiRate_IsIgnoredWithTwentyPercentDown()
    {
        Service.Analyze(A.Request.WithHousingCosts(c => c.WithPmi(0.5m)));

        Assert.That(CompareArguments().Costs.IsEmpty, Is.True, "PMI is not added when the purchase does not require it");
    }

    [Test]
    public void Analyze_PmiRate_IsAppliedWithLessThanTwentyPercentDown()
    {
        Service.Analyze(A.Request.FivePercentDown().WithHousingCosts(c => c.WithPmi(ReferenceLoans.FivePercentDown.PmiRate)));

        var firstMonth = CompareArguments().Costs.ApplyTo(CannedComparison.Baseline).Periods[0];
        Assert.That(firstMonth[HousingCostCategory.MortgageInsurance], Is.EqualTo(ReferenceLoans.FivePercentDown.MonthlyPmi), "PMI is charged on the original $237,500 loan");
    }

    // ---------------------------------------------------------------------------------------
    // Domain -> response.
    // ---------------------------------------------------------------------------------------

    [Test]
    public void Analyze_ReportsThePurchase()
    {
        var purchase = Service.Analyze(A.Request.FivePercentDown()).Purchase;

        Assert.Multiple(() =>
        {
            Assert.That(purchase.HomePrice, Is.EqualTo(ReferenceLoans.FivePercentDown.HomePrice), "the price is echoed back");
            Assert.That(purchase.LoanAmount, Is.EqualTo(ReferenceLoans.FivePercentDown.LoanAmount), "the derived loan amount");
            Assert.That(purchase.DownPaymentPercent, Is.EqualTo(5m), "$12,500 of $250,000");
            Assert.That(purchase.LoanToValuePercent, Is.EqualTo(95m), "100% - 5%");
            Assert.That(purchase.MortgageInsuranceRequired, Is.True, "under 20% down needs PMI");
        });
    }

    [Test]
    public void Analyze_ReportsTheComparisonItWasGiven()
    {
        var response = Service.Analyze(A.Request);

        Assert.Multiple(() =>
        {
            Assert.That(response.Baseline.MonthlyPayment, Is.EqualTo(CannedComparison.Baseline.InitialMonthlyPayment), "the baseline payment comes from the comparison");
            Assert.That(response.Baseline.Payments, Has.Count.EqualTo(CannedComparison.Baseline.NumberOfPayments), "one row per payment");
            Assert.That(response.Savings.NetSavings, Is.EqualTo(CannedComparison.NetSavings), "savings come from the comparison");
            Assert.That(response.Projection, Has.Count.EqualTo(30), "one projection row per year of the baseline");
        });
    }

    [Test]
    public void Analyze_CallsTheComparerExactlyOnce()
    {
        Service.Analyze(A.Request);

        Assert.That(
            () => Comparer.ReceivedWithAnyArgs(1).Compare(default!, default!, default!, default!),
            Throws.Nothing,
            "one request is one comparison; the comparer builds both schedules itself");
    }
}
