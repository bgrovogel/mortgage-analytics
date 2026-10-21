using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.RentOrBuy;

namespace MortgageAnalytics.Domain.Tests.RentOrBuy;

/// <summary>
/// Renting against buying, year by year: a $250,000 home bought with $50,000 to close and a $200,000 loan at 6% for
/// 30 years ($1,199.10 a month, $197,543.99 owed after a year), against renting at $1,200. Whichever costs less each
/// month invests the difference; the renter also invests the $50,000. Expected values from the cent-rounded schedule
/// and compounding worked in Python.
/// </summary>
[TestFixture]
public class RentOrBuyComparisonTests
{
    private static readonly LoanTerms Loan = new(200_000m, 6m, 360, new DateOnly(2026, 11, 1));
    private static readonly LoanComparison Schedules =
        new LoanComparer(new AmortizationCalculator()).Compare(Loan, ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

    private static IReadOnlyList<RentOrBuyYear> Compare(
        decimal rent = 1_200m, decimal rentIncrease = 0m, decimal investmentReturn = 0m, decimal maintenance = 0m, decimal selling = 0m,
        decimal growth = 0m) =>
        RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(rent, rentIncrease, investmentReturn, maintenance, selling), 50_000m, Loan,
            Schedules.Baseline, Schedules.BaselineCosts, null, new PropertyValuation(250_000m, growth));

    [Test]
    public void TheTaxOwningSaves_IsCountedEachYear_AndInvestedByTheBuyerAsItIsSaved()
    {
        // 24% on the interest, which is all the home adds: the other deductions already beat the standard one.
        var tax = new OwnerTaxProfile(MortgageAnalytics.Domain.Strategies.FilingStatus.SingleFiler, 24m, 10_000m, 10_000m);
        var without = Compare();
        var with = RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(1_200m, 0m, 0m, 0m, 0m), 50_000m, Loan, Schedules.Baseline, Schedules.BaselineCosts, null, new PropertyValuation(250_000m, 0m), tax);
        var firstYearInterest = Schedules.Baseline.Payments.Take(12).Sum(p => p.Interest);

        Assert.Multiple(() =>
        {
            Assert.That(with[0].TaxSaved, Is.EqualTo(Money.Round(firstYearInterest * 0.24m)), "24% of the first year's interest");
            Assert.That(without[0].TaxSaved, Is.EqualTo(0m), "nothing when no tax profile is given");
            Assert.That(with[0].BuyerInvestments - without[0].BuyerInvestments, Is.EqualTo(with[0].TaxSaved).Within(0.01m),
                "with no return on investments, the buyer is exactly the year's saving better off");
            Assert.That(with[0].OwnershipCost, Is.EqualTo(without[0].OwnershipCost), "what owning cost is the same: the saving is on the tax return, not the bills");
            Assert.That(with[0].RenterInvestments, Is.EqualTo(without[0].RenterInvestments), "and the renter is unchanged");
        });
    }

    [Test]
    public void TheTaxSaving_FallsAsTheInterestFalls_ButNeverBelowNothing()
    {
        var tax = new OwnerTaxProfile(MortgageAnalytics.Domain.Strategies.FilingStatus.SingleFiler, 24m, 10_000m, 10_000m);
        var years = RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(1_200m, 0m, 0m, 0m, 0m), 50_000m, Loan, Schedules.Baseline, Schedules.BaselineCosts, null, new PropertyValuation(250_000m, 0m), tax);

        Assert.Multiple(() =>
        {
            Assert.That(years.Select(y => y.TaxSaved), Is.Ordered.Descending, "each year's interest is less than the last, so the saving is too");
            Assert.That(years.All(y => y.TaxSaved >= 0m), Is.True, "and a saving is never negative");
        });
    }

    [Test]
    public void TheBuyer_HasTheHomeLessWhatIsOwed_AndInvestsWhatOwningSaves()
    {
        var year = Compare()[0];

        Assert.Multiple(() =>
        {
            Assert.That(year.Year, Is.EqualTo(1), "after the first year");
            Assert.That(year.OwnershipCost, Is.EqualTo(14_389.20m), "12 × $1,199.10");
            Assert.That(year.Rent, Is.EqualTo(14_400m), "12 × $1,200");
            Assert.That(year.HomeEquity, Is.EqualTo(52_456.01m), "$250,000 less $197,543.99 owed");
            Assert.That(year.BuyerInvestments, Is.EqualTo(10.80m), "owning costs $0.90 a month less, invested");
            Assert.That(year.RenterInvestments, Is.EqualTo(50_000m), "what the buyer brought to closing, invested instead");
            Assert.That(year.Advantage, Is.EqualTo(2_466.81m), "buying is ahead by the equity and savings, less the renter's $50,000");
        });
    }

    [Test]
    public void Investments_GrowMonthByMonth()
    {
        var year = Compare(investmentReturn: 12m)[0];

        Assert.Multiple(() =>
        {
            Assert.That(year.RenterInvestments, Is.EqualTo(56_341.25m), "$50,000 at 1% a month for 12 months");
            Assert.That(year.BuyerInvestments, Is.EqualTo(11.41m), "$0.90 a month, each growing from when it is saved");
        });
    }

    [Test]
    public void Rent_RisesEachYear()
    {
        Assert.That(Compare(rentIncrease: 3m)[1].Rent, Is.EqualTo(14_832m), "$1,236 a month in year 2");
    }

    [Test]
    public void Owning_CostsUpkeep_OnTheHomesValueThatYear()
    {
        var years = Compare(maintenance: 1m, growth: 10m);

        Assert.Multiple(() =>
        {
            Assert.That(years[0].OwnershipCost, Is.EqualTo(14_389.20m + 12 * 208.33m), "1% of $250,000 a year: $208.33 a month");
            Assert.That(years[1].OwnershipCost, Is.EqualTo(14_389.20m + 12 * 229.17m), "on $275,000 in year 2");
            Assert.That(years[0].RenterInvestments, Is.EqualTo(50_000m + 12 * 207.43m), "the renter invests what owning costs more: $1,407.43 less $1,200");
        });
    }

    [Test]
    public void Selling_CostsAShareOfTheValue_AndTheValueGrows()
    {
        var year = Compare(selling: 6m, growth: 10m)[0];

        Assert.That(year.HomeEquity, Is.EqualTo(275_000m - 197_543.99m - 16_500m), "sold for $275,000 after a year, less 6%");
    }

    [Test]
    public void EachYearIsCompared_UpTo30Years()
    {
        var years = Compare();

        Assert.Multiple(() =>
        {
            Assert.That(years.Select(y => y.Year), Is.EqualTo(Enumerable.Range(1, 30)), "a year at a time, for the whole loan");
            Assert.That(years[^1].HomeEquity, Is.EqualTo(250_000m), "paid off: the whole home");
        });
    }

    [Test]
    public void ALoanShorterThan30Years_IsComparedToItsEnd()
    {
        var loan = new LoanTerms(200_000m, 6m, 180, new DateOnly(2026, 11, 1));
        var schedules = new LoanComparer(new AmortizationCalculator()).Compare(loan, ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

        var years = RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(1_200m, 0m, 0m, 0m, 0m), 50_000m, loan, schedules.Baseline, schedules.BaselineCosts, null, new PropertyValuation(250_000m));

        Assert.That(years, Has.Count.EqualTo(15), "the housing costs are known only while the loan runs");
    }

    [Test]
    public void ABuydownsSubsidy_IsNotPaidByTheBuyer()
    {
        var buydown = new TemporaryBuydown([2m]);
        var years = RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(1_200m, 0m, 0m, 0m, 0m), 50_000m, Loan, Schedules.Baseline, Schedules.BaselineCosts, buydown, new PropertyValuation(250_000m));

        Assert.Multiple(() =>
        {
            Assert.That(years[0].OwnershipCost, Is.EqualTo(12 * (1_199.10m - buydown.SubsidyFor(Loan, 1, 1_199.10m))), "year 1 is paid at 4%");
            Assert.That(years[1].OwnershipCost, Is.EqualTo(12 * 1_199.10m), "year 2 is its own twelve payments, at the note rate");
        });
    }

    [Test]
    public void Owning_CostsTheHousingCosts_TooAsThePaymentsDo()
    {
        var withDues = new LoanComparer(new AmortizationCalculator()).Compare(
            Loan, ExtraPaymentPlan.None, RecastPolicy.Never, new HousingCostPlan([new MonthlyFixedCost(HousingCostCategory.HoaDues, 75m)]));

        var years = RentOrBuyComparison.Years(
            new RentOrBuyAssumptions(1_200m, 0m, 0m, 0m, 0m), 50_000m, Loan, withDues.Baseline, withDues.BaselineCosts, null, new PropertyValuation(250_000m));

        Assert.That(years[0].OwnershipCost, Is.EqualTo(12 * (1_199.10m + 75m)), "the payment and $75 of dues each month");
    }

    [Test]
    public void TheComparison_RefusesAssumptionsOutOfRange()
    {
        Assert.That(() => Compare(rent: 0m), Throws.TypeOf<DomainValidationException>(), "there is no comparing against no rent");
    }

    [TestCase(1_000_000, 20, 30, 10, 20, TestName = "The most of each")]
    [TestCase(0.01, -20, -20, 0, 0, TestName = "The least of each")]
    public void Assumptions_AtTheirLimits_AreAccepted(decimal rent, decimal increase, decimal investmentReturn, decimal maintenance, decimal selling)
    {
        Assert.That(() => new RentOrBuyAssumptions(rent, increase, investmentReturn, maintenance, selling).Validated(), Throws.Nothing,
            "each limit is a value a market could have");
    }

    [TestCase(1_000_000.01, 3, 7, 1, 6, "Rent must be more than $0 and at most $1,000,000 a month.", TestName = "Rent past the most")]
    [TestCase(1_200, 20.01, 7, 1, 6, "Rent must change between -20% and 20% a year.", TestName = "Rent rising past 20%")]
    [TestCase(1_200, -20.01, 7, 1, 6, "Rent must change between -20% and 20% a year.", TestName = "Rent falling past 20%")]
    [TestCase(1_200, 3, -20.01, 1, 6, "Investments must earn between -20% and 30% a year.", TestName = "Investments losing past 20%")]
    [TestCase(1_200, 3, 30.01, 1, 6, "Investments must earn between -20% and 30% a year.", TestName = "Investments earning past 30%")]
    [TestCase(1_200, 3, 7, -0.01, 6, "Upkeep must be 0% to 10% of the home's value a year.", TestName = "Upkeep below nothing")]
    [TestCase(1_200, 3, 7, 10.01, 6, "Upkeep must be 0% to 10% of the home's value a year.", TestName = "Upkeep past 10%")]
    [TestCase(1_200, 3, 7, 1, -0.01, "Selling costs must be 0% to 20% of the home's value.", TestName = "Selling costs below nothing")]
    [TestCase(1_200, 3, 7, 1, 20.01, "Selling costs must be 0% to 20% of the home's value.", TestName = "Selling costs past 20%")]
    public void Assumptions_PastTheirLimits_SayWhatIsAllowed(decimal rent, decimal increase, decimal investmentReturn, decimal maintenance, decimal selling, string message)
    {
        Assert.That(() => new RentOrBuyAssumptions(rent, increase, investmentReturn, maintenance, selling).Validated(),
            Throws.TypeOf<DomainValidationException>().With.Message.EqualTo(message), "the message says the limit");
    }

    [Test]
    public void BuyingBreaksEven_TheYearItGetsAheadForGood()
    {
        var years = new[] { -5m, 1m, -1m, 2m, 3m }.Select((a, i) => new RentOrBuyYear(i + 1, 0m, 0m, a, 0m, 0m)).ToList();

        Assert.Multiple(() =>
        {
            Assert.That(RentOrBuyComparison.BreakEvenYear(years), Is.EqualTo(4), "ahead in year 2, behind in year 3, ahead from year 4 on");
            Assert.That(RentOrBuyComparison.BreakEvenYear(years.Take(3).ToList()), Is.Null, "never ahead for good");
            Assert.That(RentOrBuyComparison.BreakEvenYear([new RentOrBuyYear(1, 0m, 0m, 0m, 0m, 0m)]), Is.EqualTo(1), "level counts as caught up");
        });
    }

    [TestCase(0, 3, 7, 1, 6, TestName = "No rent")]
    [TestCase(1_200, -21, 7, 1, 6, TestName = "Rent falling more than 20% a year")]
    [TestCase(1_200, 3, 31, 1, 6, TestName = "Investments earning more than 30%")]
    [TestCase(1_200, 3, 7, 11, 6, TestName = "Upkeep over 10% of the value")]
    [TestCase(1_200, 3, 7, 1, 21, TestName = "Selling costs over 20%")]
    public void Assumptions_OutOfRange_AreRefused(decimal rent, decimal increase, decimal investmentReturn, decimal maintenance, decimal selling)
    {
        Assert.That(() => new RentOrBuyAssumptions(rent, increase, investmentReturn, maintenance, selling).Validated(),
            Throws.TypeOf<DomainValidationException>(), "no market behaves like that");
    }
}
