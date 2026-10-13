using MortgageAnalytics.Domain.HousingCosts;
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

    [Test]
    public void InterestSaved_IsTheCurrentLoansInterestLessTheNewOnes_NegativeWhenTheNewLoanChargesMore() =>
        Assert.That(Analyze(SixPercentUpfront).InterestSaved, Is.EqualTo(Current.TotalInterest - ToSixPercentFor30Years.TotalInterest),
            "a lower rate over a new 30 years still charges $11,415.28 more interest");

    [Test]
    public void ABuydownBoughtAtClosing_IsPaidWithTheClosingCosts()
    {
        // The 2-1 buydown on $356,250 at 5.99% costs $7,898.76 (TemporaryBuydownTests); paid up front with $3,000 of costs.
        var offer = new RefinanceOffer(5.99m, 360, 3_000m, financeClosingCosts: false) { Buydown = new TemporaryBuydown([2m, 1m]) };

        var analysis = new RefinanceAnalyzer(Calculator).Analyze(new LoanTerms(356_250m, 7m, 360, ReferenceLoans.FirstPaymentDate), offer);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.BuydownCost, Is.EqualTo(7_898.76m), "every bought-down payment's subsidy, added up");
            Assert.That(analysis.CashAtClosing, Is.EqualTo(10_898.76m), "the closing costs and the buydown, both due at closing");
        });
    }

    [Test]
    public void ANewPaymentNoLowerThanTodays_OffersNoWayToKeepPayingTodaysPayment() =>
        // The same rate over the same payments left: the payment does not change, so there is no difference to prepay.
        Assert.That(Analyze(new RefinanceOffer(Current.AnnualInterestRate, Current.RemainingTermInMonths, 0m, financeClosingCosts: false)).KeepingCurrentPayment,
            Is.Null, "paying today's payment on the new loan only makes sense when the new payment is lower");

    [Test]
    public void ACurrentLoanThatEndsFirst_IsCountedAsChargingNothing_SoTheRefinanceNeverBreaksEven() =>
        // A year left on the current loan: after it ends, every new payment only adds interest, so the $5,000 never comes back.
        Assert.That(new RefinanceAnalyzer(Calculator).Analyze(new LoanTerms(10_000m, 7m, 12, ReferenceLoans.FirstPaymentDate),
                new RefinanceOffer(6m, 360, 5_000m, financeClosingCosts: false)).BreakEvenPaymentNumber,
            Is.Null, "the break-even search walks past the end of the shorter, current loan");

    // ---- PMI on either loan ----

    /// <summary>A home now worth $360,000: PMI on either loan until it is down to $288,000 (80%).</summary>
    private static readonly RefinancePmi BothWithPmi = new(360_000m, CurrentMonthlyPremium: 120m, NewAnnualRatePercent: 0.5m);

    [Test]
    public void PmiOnBothLoans_CountsInTheMonthlySavings_AndOverTheLifeOfEach()
    {
        var analysis = new RefinanceAnalyzer(Calculator).Analyze(CurrentLoan, SixPercentUpfront, BothWithPmi);
        var currentPmi = LoanPmi.OnCurrentLoan(120m, 360_000m).TotalOn(analysis.Current);
        var newPmi = LoanPmi.ForNewLoan(300_000m, 360_000m, 0.5m, 360).TotalOn(analysis.Refinanced);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.CurrentPmi.MonthlyPremium, Is.EqualTo(120m), "the PMI on today's statement");
            Assert.That(analysis.NewPmi.MonthlyPremium, Is.EqualTo(125m), "0.5% of $300,000 a year: the new loan is 83% of the value");
            Assert.That(analysis.MonthlySavings, Is.EqualTo(ToSixPercentFor30Years.MonthlySavings + 120m - 125m), "the payment with PMI, each way");
            Assert.That(analysis.CurrentPmiTotal, Is.EqualTo(currentPmi), "PMI left on the current loan");
            Assert.That(analysis.RefinancedPmiTotal, Is.EqualTo(newPmi), "PMI on the new one, which pays down more slowly");
            Assert.That(newPmi, Is.GreaterThan(currentPmi), "a new 30 years keeps PMI longer");
            Assert.That(analysis.LifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings + currentPmi - newPmi), "both counted in the total");
        });
    }

    [Test]
    public void PmiOnBothLoans_CountsInTheBreakEven()
    {
        var analysis = new RefinanceAnalyzer(Calculator).Analyze(CurrentLoan, SixPercentUpfront, BothWithPmi);

        Assert.That(analysis.BreakEvenPaymentNumber, Is.GreaterThan(ToSixPercentFor30Years.BreakEvenPaymentNumber),
            "$5 more PMI a month, for longer, takes longer to earn the closing costs back");
    }

    [Test]
    public void KeepingTodaysPayment_KeepsPayingWhatPmiNoLongerTakes()
    {
        var withoutCurrentPmi = new RefinancePmi(360_000m, CurrentMonthlyPremium: 0m, NewAnnualRatePercent: 0.5m);
        var analysis = new RefinanceAnalyzer(Calculator).Analyze(CurrentLoan, SixPercentUpfront, BothWithPmi);
        var noPmiNow = new RefinanceAnalyzer(Calculator).Analyze(CurrentLoan, SixPercentUpfront, withoutCurrentPmi);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.KeepingCurrentPayment!.Payments[0].ExtraPrincipal, Is.EqualTo(analysis.MonthlySavings),
                "today's payment and PMI, less the new payment and PMI, goes to principal");
            Assert.That(analysis.KeepingCurrentPaymentLifetimeSavings, Is.GreaterThan(noPmiNow.KeepingCurrentPaymentLifetimeSavings!.Value),
                "PMI paid today is PMI the refinance can stop paying");
        });
    }

    [Test]
    public void FinancingTheClosingCosts_AboveEightyPercentOfTheValue_BringsPmiOnTheNewLoan()
    {
        // $285,000 owed on $360,000 (79%) carries no PMI; $6,000 of closing costs borrowed makes it $291,000 (81%).
        var current = new LoanTerms(285_000m, 7m, 300, ReferenceLoans.FirstPaymentDate);
        var financed = new RefinanceOffer(6m, 360, 6_000m, financeClosingCosts: true);

        var analysis = new RefinanceAnalyzer(Calculator).Analyze(current, financed, new RefinancePmi(360_000m, 0m, 0.5m));

        Assert.Multiple(() =>
        {
            Assert.That(analysis.CurrentPmiTotal, Is.Zero, "the current loan is under 80%");
            Assert.That(analysis.NewPmi.MonthlyPremium, Is.EqualTo(121.25m), "0.5% of $291,000 a year");
            Assert.That(analysis.RefinancedPmiTotal, Is.Positive, "until the new balance is back to $288,000");
        });
    }

    [Test]
    public void WithoutAHomeValue_NeitherLoanCarriesPmi()
    {
        var analysis = Analyze(SixPercentUpfront);

        Assert.Multiple(() =>
        {
            Assert.That(analysis.CurrentPmi, Is.EqualTo(LoanPmi.None), "nothing to measure 80% against");
            Assert.That(analysis.NewPmi, Is.EqualTo(LoanPmi.None), "on either loan");
            Assert.That(analysis.LifetimeSavings, Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings), "so the comparison is as before");
        });
    }
}
