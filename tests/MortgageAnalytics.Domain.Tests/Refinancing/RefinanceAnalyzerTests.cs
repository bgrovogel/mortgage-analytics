using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.Refinancing;
using static MortgageAnalytics.Testing.ReferenceRefinances;

namespace MortgageAnalytics.Domain.Tests.Refinancing;

/// <summary>
/// The refinance comparison, checked against independently computed values (<see cref="ReferenceRefinances"/>).
/// The analyzer runs on the real amortization calculator, so every schedule follows the engine's rounding.
/// </summary>
[TestFixture]
public class RefinanceAnalyzerTests : AmortizationTestBase
{
    private static readonly LoanTerms CurrentLoan =
        new(Current.Balance, Current.AnnualInterestRate, Current.RemainingTermInMonths, ReferenceLoans.FirstPaymentDate);

    private static readonly RefinanceOffer SixPercentUpfront = new(
        ToSixPercentFor30Years.AnnualInterestRate, ToSixPercentFor30Years.TermInMonths, ToSixPercentFor30Years.ClosingCosts, financeClosingCosts: false);

    private RefinanceAnalysis Analyze(RefinanceOffer offer) => new RefinanceAnalyzer(Calculator).Analyze(CurrentLoan, offer);

    [Test]
    public void TheCurrentLoan_IsTheRestOfItsScheduleAsItStands()
    {
        var analysis = Analyze(SixPercentUpfront);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.Current.InitialMonthlyPayment, Is.EqualTo(Current.MonthlyPayment), "today's payment, from balance, rate and payments left");
            Assert.That(analysis.Current.TotalInterest, Is.EqualTo(Current.TotalInterest), "the interest still to pay");
            Assert.That(analysis.Current.PayoffDate, Is.EqualTo(Current.PayoffDate), "and when it ends");
        });
    }

    [Test]
    public void ALowerRateOverANewThirtyYears_LowersThePayment_ButRestartsTheClock()
    {
        var analysis = Analyze(SixPercentUpfront);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.Refinanced.InitialMonthlyPayment, Is.EqualTo(ToSixPercentFor30Years.MonthlyPayment), "the new payment");
            Assert.That(analysis.MonthlySavings, Is.EqualTo(ToSixPercentFor30Years.MonthlySavings), "is lower each month");
            Assert.That(analysis.Refinanced.TotalInterest, Is.EqualTo(ToSixPercentFor30Years.TotalInterest), "but interest starts over on a new 30 years");
            Assert.That(analysis.MonthsAdded, Is.EqualTo(ToSixPercentFor30Years.MonthsAdded), "five more years of payments");
            Assert.That(analysis.Refinanced.PayoffDate, Is.EqualTo(ToSixPercentFor30Years.PayoffDate), "a later payoff date");
            Assert.That(analysis.LifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings), "so in total it costs more, closing costs included");
        });
    }

    [Test]
    public void BreakEven_IsWhenTheInterestSavedCoversTheClosingCosts()
    {
        var analysis = Analyze(SixPercentUpfront);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.BreakEvenPaymentNumber, Is.EqualTo(ToSixPercentFor30Years.BreakEvenPaymentNumber), "the first payment by which interest saved >= closing costs");
            Assert.That(analysis.BreakEvenDate, Is.EqualTo(ToSixPercentFor30Years.BreakEvenDate), "and its due date");
        });
    }

    [Test]
    public void KeepingTheCurrentPayment_OnTheNewLoan_PaysItOffSoonerAndSavesMoney()
    {
        var keeping = Analyze(SixPercentUpfront);

        Assert.Multiple(() =>
        {
            Assert.That(keeping.KeepingCurrentPayment, Is.Not.Null, "offered whenever the new payment is lower");
            Assert.That(keeping.KeepingCurrentPayment!.NumberOfPayments, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.NumberOfPayments), "the difference goes to principal");
            Assert.That(keeping.KeepingCurrentPayment.TotalInterest, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.TotalInterest), "so far less interest");
            Assert.That(keeping.KeepingCurrentPayment.PayoffDate, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.PayoffDate), "and paid off years before the current loan");
            Assert.That(keeping.KeepingCurrentPaymentLifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.LifetimeSavings), "a real saving, closing costs included");
        });
    }

    [Test]
    public void FinancedClosingCosts_AreAddedToTheLoan_AndStillCountTowardBreakEven()
    {
        var analysis = Analyze(new RefinanceOffer(6m, 360, 6_000m, financeClosingCosts: true));

        Assert.Multiple(() =>
        {
            Assert.That(analysis.Refinanced.TotalPrincipal, Is.EqualTo(ToSixPercentWithCostsFinanced.LoanAmount), "the costs are borrowed");
            Assert.That(analysis.Refinanced.InitialMonthlyPayment, Is.EqualTo(ToSixPercentWithCostsFinanced.MonthlyPayment), "which raises the payment a little");
            Assert.That(analysis.Offer.UpfrontCosts, Is.Zero, "nothing is paid at closing");
            Assert.That(analysis.LifetimeSavings, Is.EqualTo(ToSixPercentWithCostsFinanced.LifetimeSavings), "the borrowed costs are repaid, with interest");
            Assert.That(analysis.BreakEvenPaymentNumber, Is.EqualTo(ToSixPercentWithCostsFinanced.BreakEvenPaymentNumber), "financing the costs does not make them free");
        });
    }

    [Test]
    public void AHigherRate_NeverBreaksEven_AndHasNoKeepThePaymentOption()
    {
        var analysis = Analyze(new RefinanceOffer(8m, 300, 3_000m, financeClosingCosts: false));

        Assert.Multiple(() =>
        {
            Assert.That(analysis.MonthlySavings, Is.Negative, "the payment goes up");
            Assert.That(analysis.BreakEvenPaymentNumber, Is.Null, "the interest saved never covers the costs");
            Assert.That(analysis.BreakEvenDate, Is.Null, "so there is no break-even date");
            Assert.That(analysis.KeepingCurrentPayment, Is.Null, "there is no lower payment to keep up");
            Assert.That(analysis.KeepingCurrentPaymentLifetimeSavings, Is.Null, "so no savings for it either");
        });
    }

    [Test]
    public void ARefinanceWithNoCosts_BreaksEvenOnTheFirstPayment()
    {
        var analysis = Analyze(new RefinanceOffer(6m, 300, 0m, financeClosingCosts: false));

        Assert.That(analysis.BreakEvenPaymentNumber, Is.EqualTo(1), "with nothing to recover, a lower rate pays from the start");
    }

    [TestCase(-0.01, 360, 0, TestName = "a negative rate")]
    [TestCase(30.01, 360, 0, TestName = "a rate above 30%")]
    [TestCase(6, 0, 0, TestName = "a zero term")]
    [TestCase(6, 601, 0, TestName = "a term over 50 years")]
    [TestCase(6, 360, -1, TestName = "negative closing costs")]
    public void AnOfferOutsideTheSupportedRange_IsRejected(decimal rate, int term, decimal closingCosts)
    {
        Assert.That(() => new RefinanceOffer(rate, term, closingCosts, financeClosingCosts: false), Throws.TypeOf<DomainValidationException>(),
            "an offer the engine cannot model must not be constructed");
    }
}
