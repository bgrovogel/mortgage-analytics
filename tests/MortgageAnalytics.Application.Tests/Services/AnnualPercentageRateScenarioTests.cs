using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Testing.Builders;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for the APR. The loan is $200,000 at 6.5% over 30 years, a payment of $1,264.14, on a $250,000
/// home with 20% down (so no PMI). With the default $4,000 of loan costs and 15 days of prepaid interest at $35.62
/// a day ($534.30), the borrower receives $195,465.70 for the same payments; expected values come from an independent
/// bisection in Python's Decimal.
/// </summary>
[TestFixture]
public class AnnualPercentageRateScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder TwentyPercentDown() =>
        A.Request.WithHomePrice(250_000m).WithDownPayment(50_000m).WithRate(6.5m);

    [Test]
    public void WithNoFeesAndNoMortgageInsurance_IsTheNoteRate()
    {
        Assert.That(Service.Analyze(TwentyPercentDown()).AnnualPercentageRate, Is.EqualTo(6.5m), "nothing paid up front, nothing added");
    }

    [Test]
    public void LoanCostsAndPrepaidInterest_RaiseIt_ButOtherFeesDoNot()
    {
        var withFees = Service.Analyze(TwentyPercentDown().WithClosingCosts(otherFees: 1_000m)).AnnualPercentageRate;
        var withMoreOtherFees = Service.Analyze(TwentyPercentDown().WithClosingCosts(otherFees: 9_000m)).AnnualPercentageRate;

        Assert.Multiple(() =>
        {
            Assert.That(withFees, Is.EqualTo(6.722m), "$4,000 of loan costs and $534.30 of prepaid interest");
            Assert.That(withMoreOtherFees, Is.EqualTo(withFees), "recording, transfer taxes and title are not finance charges");
        });
    }

    [Test]
    public void DiscountPoints_AreAFinanceCharge()
    {
        var response = Service.Analyze(TwentyPercentDown().WithClosingCosts().WithDiscountPoints(1m, 6.75m));

        Assert.That(response.AnnualPercentageRate, Is.EqualTo(6.822m), "one point, $2,000, on top of the fees");
    }

    [Test]
    public void MortgageInsurance_IsInThePayments()
    {
        var withPmi = A.Request.WithHomePrice(250_000m).WithDownPayment(12_500m).WithRate(6.5m).WithHousingCosts(c => c.WithPmi(0.5m));
        var without = A.Request.WithHomePrice(250_000m).WithDownPayment(12_500m).WithRate(6.5m);

        var apr = Service.Analyze(withPmi);
        var plain = Service.Analyze(without);
        var payments = apr.Baseline.Payments.Select(p => p.ScheduledPayment + p.Costs.MortgageInsurance).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(plain.AnnualPercentageRate, Is.EqualTo(6.5m), "no PMI charged without a rate for it");
            Assert.That(apr.AnnualPercentageRate, Is.GreaterThan(6.5m), "PMI is a cost of borrowing");
            Assert.That(apr.AnnualPercentageRate, Is.EqualTo(AnnualPercentageRate.Of(237_500m, payments)),
                "the payments with each month's PMI added, for what was received");
        });
    }

    [Test]
    public void AGovernmentLoansUpfrontFee_AndItsMonthlyMip_AreCounted()
    {
        var fha = A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithRate(6.5m).WithProgram(LoanProgramType.Fha);

        var response = Service.Analyze(fha);
        var received = response.Program!.LoanAmount - response.Program.UpfrontFee;
        var payments = response.Baseline.Payments.Select(p => p.ScheduledPayment + p.Costs.MortgageInsurance).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(response.AnnualPercentageRate, Is.EqualTo(AnnualPercentageRate.Of(received, payments)),
                "the upfront MIP is a finance charge whether it is borrowed or paid at closing");
            Assert.That(response.AnnualPercentageRate, Is.GreaterThan(6.5m), "MIP is a cost of borrowing");
        });
    }
}
