using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Testing.Builders;
using FivePercentDown = MortgageAnalytics.Testing.ReferenceLoans.FivePercentDown;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Sociable scenarios for affordability: this home's debt-to-income ratios, and the most a household could pay at the
/// same down payment share. The purchase is <see cref="FivePercentDown"/> ($250,000, 5% down, 6.5%) with Texas taxes,
/// insurance, dues and PMI. The household earns $90,000 a year ($7,500 a month) and pays $400 a month on other debts.
/// Each most-affordable price is checked by analyzing that price, and a dollar more, on their own.
/// </summary>
[TestFixture]
public class AffordabilityScenarioTests : SociableAnalysisTestBase
{
    private static AmortizationRequestBuilder TexasPurchase() =>
        A.Request.FivePercentDown().WithHousingCosts(c => c
            .WithSchoolTax(1.0m).WithLocalTax(1.1m).WithMudTax(0.85m)
            .WithInsurance(2_400m).WithHoa(50m).WithPmi(FivePercentDown.PmiRate));

    private AffordabilityResponse AffordabilityOf(AmortizationRequestBuilder request, decimal income = 90_000m, decimal debts = 400m) =>
        Service.Analyze(request.WithAffordability(income, debts)).Affordability!;

    /// <summary>The housing payment at <paramref name="price"/>, with the same 5% down: what the search compares.</summary>
    private decimal PaymentAt(decimal price, AmortizationRequestBuilder? request = null) =>
        Service.Analyze((request ?? TexasPurchase()).WithHomePrice(price).WithDownPayment(price * 0.05m)).Baseline.TotalMonthlyPayment;

    [Test]
    public void ThereIsNoBudgetAnswer_WithoutABudget()
    {
        Assert.That(Service.Analyze(TexasPurchase()).Budget, Is.Null, "nothing was asked");
    }

    [Test]
    public void ABudget_ReachesTheHighestPriceWhosePaymentFits_AtTheSameDownPaymentShare()
    {
        var budget = Service.Analyze(TexasPurchase().WithMonthlyBudget(1_800m)).Budget!;

        Assert.Multiple(() =>
        {
            Assert.That(budget.MonthlyBudget, Is.EqualTo(1_800m), "the budget asked about");
            Assert.That(PaymentAt(budget.MaxHomePrice), Is.LessThanOrEqualTo(1_800m), "the payment at that price fits");
            Assert.That(PaymentAt(budget.MaxHomePrice + 1m), Is.GreaterThan(1_800m), "and a dollar more does not");
            Assert.That(budget.DownPayment, Is.EqualTo(budget.MaxHomePrice * 0.05m), "keeping the 5% down");
        });
    }

    [Test]
    public void ABudget_DoesNotNeedAnIncome()
    {
        var response = Service.Analyze(TexasPurchase().WithMonthlyBudget(1_800m));

        Assert.Multiple(() =>
        {
            Assert.That(response.Affordability, Is.Null, "no income was given");
            Assert.That(response.Budget!.MaxHomePrice, Is.GreaterThan(0m), "but the budget is answered");
        });
    }

    [Test]
    public void ABiggerBudget_ReachesAMoreExpensiveHome()
    {
        var small = Service.Analyze(TexasPurchase().WithMonthlyBudget(1_500m)).Budget!;
        var large = Service.Analyze(TexasPurchase().WithMonthlyBudget(2_500m)).Budget!;

        Assert.That(large.MaxHomePrice, Is.GreaterThan(small.MaxHomePrice), "more a month buys more house");
    }

    [Test]
    public void CoBuyers_AreMeasuredTogether_AsOneHouseholdWithTheirIncomeAndDebtsAdded()
    {
        var together = Service.Analyze(TexasPurchase().WithAffordability(90_000m, 400m).WithCoBuyer(60_000m, 200m, 40m)).Affordability!;
        var one = AffordabilityOf(TexasPurchase(), 150_000m, 600m);

        Assert.Multiple(() =>
        {
            Assert.That(together.MonthlyIncome, Is.EqualTo(12_500m), "$150,000 a year between them");
            Assert.That(together.MonthlyDebts, Is.EqualTo(600m), "$400 and $200 of debts");
            Assert.That(together with { Buyers = null }, Is.EqualTo(one with { Buyers = null }), "every ratio and limit is the one a lender finds for that household");
        });
    }

    [Test]
    public void ABuyerAlone_HasNoBuyersToShowSeparately()
    {
        Assert.That(AffordabilityOf(TexasPurchase()).Buyers, Is.Null, "one buyer: nothing to split");
    }

    [Test]
    public void TheBuyers_EachBringTheirOwnIncome_DebtsAndShareOfTheDownPayment_TheFirstTakingWhatIsLeft()
    {
        var response = Service.Analyze(TexasPurchase().WithAffordability(90_000m, 400m).WithCoBuyer(60_000m, 200m, 40m));
        var buyers = response.Affordability!.Buyers!;

        Assert.Multiple(() =>
        {
            Assert.That(buyers.Select(b => b.MonthlyIncome), Is.EqualTo(new[] { 7_500m, 5_000m }), "the first buyer, then the co-buyer");
            Assert.That(buyers.Select(b => b.MonthlyDebts), Is.EqualTo(new[] { 400m, 200m }), "debts, each their own");
            Assert.That(buyers.Select(b => b.DownPaymentPercent), Is.EqualTo(new[] { 60m, 40m }), "the co-buyer's 40%, and the rest");
            Assert.That(buyers.Select(b => b.DownPayment), Is.EqualTo(new[] { 7_500m, 5_000m }), "5% of $250,000 is $12,500, shared 60/40");
        });
    }

    [Test]
    public void TheBuyers_SharePaymentInProportionToIncome_AddingUpToTheFirstMonthsPayment()
    {
        var response = Service.Analyze(TexasPurchase().WithAffordability(90_000m, 400m).WithCoBuyer(60_000m, 200m, 40m));
        var buyers = response.Affordability!.Buyers!;

        Assert.Multiple(() =>
        {
            Assert.That(buyers.Sum(b => b.MonthlyPayment), Is.EqualTo(response.Baseline.TotalMonthlyPayment), "no cent lost");
            Assert.That(buyers[0].MonthlyPayment, Is.EqualTo(Math.Round(response.Baseline.TotalMonthlyPayment * 0.6m, 2)).Within(0.01m), "$90,000 of $150,000 is 60%");
        });
    }

    [Test]
    public void TheDownPaymentShares_AddUpToTheDownPayment_WhenTheCentsDoNotDivide()
    {
        var response = Service.Analyze(TexasPurchase().WithAffordability(90_000m).WithCoBuyer(60_000m, 0m, 33.33m).WithCoBuyer(30_000m, 0m, 33.33m));
        var buyers = response.Affordability!.Buyers!;

        Assert.Multiple(() =>
        {
            Assert.That(buyers.Select(b => b.DownPaymentPercent), Is.EqualTo(new[] { 33.34m, 33.33m, 33.33m }), "the first buyer takes the remainder");
            Assert.That(buyers.Sum(b => b.DownPayment), Is.EqualTo(12_500m), "the whole down payment");
        });
    }

    [Test]
    public void ABudgetBelowAnyLoansPayment_ReachesNoHome()
    {
        var budget = Service.Analyze(TexasPurchase().WithMonthlyBudget(1m)).Budget!;

        Assert.That((budget.MaxHomePrice, budget.DownPayment), Is.EqualTo((0m, 0m)), "not even a $1 home has a payment this low");
    }

    [Test]
    public void ABudget_IsCountedAtTheNoteRate_NotAtABuydownsFirstYear()
    {
        var plain = Service.Analyze(TexasPurchase().WithMonthlyBudget(1_800m)).Budget!;
        var bought = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithMonthlyBudget(1_800m)).Budget!;

        Assert.That(bought.MaxHomePrice, Is.EqualTo(plain.MaxHomePrice), "the buydown's early payments are not a budget the loan can keep");
    }

    [Test]
    public void ThereIsNone_WithoutIncome()
    {
        Assert.That(Service.Analyze(TexasPurchase()).Affordability, Is.Null, "nothing to measure the home against");
    }

    [Test]
    public void ThisHome_IsMeasuredAgainstIncome()
    {
        var response = Service.Analyze(TexasPurchase().WithAffordability(90_000m, 400m));
        var a = response.Affordability!;
        var housing = response.Baseline.TotalMonthlyPayment;

        Assert.Multiple(() =>
        {
            Assert.That(a.MonthlyIncome, Is.EqualTo(7_500m), "$90,000 a year");
            Assert.That(a.MonthlyDebts, Is.EqualTo(400m), "the other debts");
            Assert.That(a.HousingPayment, Is.EqualTo(housing), "principal, interest, taxes, insurance, PMI and dues");
            Assert.That(a.HousingPercent, Is.EqualTo(Math.Round(housing / 7_500m * 100m, 2)), "the housing payment's share of income");
            Assert.That(a.TotalPercent, Is.EqualTo(Math.Round((housing + 400m) / 7_500m * 100m, 2)), "and with the debts");
        });
    }

    [Test]
    public void WithABuydown_TheHomeIsQualifiedAtTheNoteRate()
    {
        var response = Service.Analyze(TexasPurchase().WithBuydown(2, 1).WithAffordability(90_000m, 400m));

        Assert.That(response.Affordability!.HousingPayment, Is.EqualTo(response.Baseline.TotalMonthlyPayment),
            "lenders qualify a temporary buydown at the note rate, not year 1's lower payment");
    }

    [Test]
    public void AFixedRate_IsQualifiedAtTheNoteRate()
    {
        var a = AffordabilityOf(TexasPurchase());

        Assert.That((a.QualifyingRate, a.QualifyingRateBasis), Is.EqualTo((6.5m, QualifyingRateBasis.NoteRate)), "the 6.5% note rate");
    }

    [Test]
    public void AFiveYearArm_IsQualifiedAtItsFirstResetsCap_AsIfFixedThere()
    {
        // A 5/1 ARM at 6.5% whose first change may add 2 points: 8.5%, above the 7% it is expected to reset to.
        var arm = TexasPurchase().WithAdjustableRate(7m, initialFixedMonths: 60, initialCap: 2m);
        var a = AffordabilityOf(arm);
        var fixedThere = AffordabilityOf(TexasPurchase().WithRate(8.5m));

        Assert.Multiple(() =>
        {
            Assert.That((a.QualifyingRate, a.QualifyingRateBasis), Is.EqualTo((8.5m, QualifyingRateBasis.FirstResetOrFullyIndexed)),
                "Fannie Mae qualifies a 5-year ARM at the note rate plus its first cap, or the fully indexed rate if higher");
            Assert.That(a.HousingPayment, Is.EqualTo(fixedThere.HousingPayment), "the payment as if fixed at 8.5%");
            Assert.That(a.Comfortable.MaxHomePrice, Is.EqualTo(fixedThere.Comfortable.MaxHomePrice), "and so is every price searched");
            Assert.That(a.HousingPayment, Is.GreaterThan(Service.Analyze(arm).Baseline.TotalMonthlyPayment), "more than the first payment");
        });
    }

    [Test]
    public void AnFhaOneYearArm_WithThreeAndAHalfPercentDown_IsQualifiedAPointHigher()
    {
        var request = A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithProgram(LoanProgramType.Fha)
            .WithAdjustableRate(7m, initialFixedMonths: 12, initialCap: 1m, periodicCap: 1m);

        var a = AffordabilityOf(request);

        Assert.That((a.QualifyingRate, a.QualifyingRateBasis), Is.EqualTo((7m, QualifyingRateBasis.StartPlusOnePoint)),
            "HUD: a 1-year ARM with a loan of 95% or more is qualified at the starting 6% plus a point");
    }

    [Test]
    public void AnFhaOneYearArm_WithTenPercentDown_IsQualifiedAtItsStartingRate()
    {
        var request = A.Request.WithHomePrice(300_000m).WithDownPayment(30_000m).WithProgram(LoanProgramType.Fha)
            .WithAdjustableRate(7m, initialFixedMonths: 12, initialCap: 1m, periodicCap: 1m);

        var a = AffordabilityOf(request);

        Assert.That((a.QualifyingRate, a.QualifyingRateBasis), Is.EqualTo((6m, QualifyingRateBasis.NoteRate)),
            "a 90% loan, below the 95% that adds a point");
    }

    [Test]
    public void TheComfortableLimit_Is28And36_AndThePriceIsTheMostItReaches()
    {
        var comfortable = AffordabilityOf(TexasPurchase()).Comfortable;

        Assert.Multiple(() =>
        {
            Assert.That((comfortable.HousingPercent, comfortable.TotalPercent), Is.EqualTo(((decimal?)28m, 36m)), "28/36");
            Assert.That(comfortable.MaxHousingPayment, Is.EqualTo(2_100m), "28% of $7,500 is $2,100; 36% less $400 is $2,300");
            Assert.That(PaymentAt(comfortable.MaxHomePrice), Is.LessThanOrEqualTo(2_100m), $"the payment at {comfortable.MaxHomePrice:C0} fits");
            Assert.That(PaymentAt(comfortable.MaxHomePrice + 1m), Is.GreaterThan(2_100m), "and a dollar more does not");
        });
    }

    [Test]
    public void TheMostAllowed_IsTheProgramsLimit()
    {
        var conventional = AffordabilityOf(TexasPurchase()).MostAllowed;
        var fha = AffordabilityOf(A.Request.FivePercentDown().WithProgram(LoanProgramType.Fha)).MostAllowed;
        var va = AffordabilityOf(A.Request.FivePercentDown().WithProgram(LoanProgramType.Va)).MostAllowed;

        Assert.Multiple(() =>
        {
            Assert.That((conventional.HousingPercent, conventional.TotalPercent), Is.EqualTo(((decimal?)null, 45m)), "conventional: 45% in all");
            Assert.That(conventional.MaxHousingPayment, Is.EqualTo(2_975m), "45% of $7,500 less $400");
            Assert.That((fha.HousingPercent, fha.TotalPercent), Is.EqualTo(((decimal?)31m, 43m)), "FHA: 31/43");
            Assert.That((va.HousingPercent, va.TotalPercent), Is.EqualTo(((decimal?)null, 41m)), "VA: 41% in all");
        });
    }

    [Test]
    public void ThisHome_FitsALimit_WhenItsPaymentIsWithin()
    {
        var a = AffordabilityOf(TexasPurchase(), income: 80_000m);

        Assert.Multiple(() =>
        {
            Assert.That(a.Comfortable.Fits, Is.EqualTo(a.HousingPayment <= a.Comfortable.MaxHousingPayment), "measured against 28% of $6,666.67");
            Assert.That(a.Comfortable.Fits, Is.False, "$2,464.71 a month is past 28%, $1,866.67");
            Assert.That(a.MostAllowed.Fits, Is.True, "but within 45% less the debts, $2,600");
            Assert.That(a.Comfortable.MaxHomePrice, Is.LessThan(250_000m), "so the comfortable price is below this one");
        });
    }

    [Test]
    public void DebtsBeyondTheLimit_AffordNothing()
    {
        var a = AffordabilityOf(TexasPurchase(), debts: 3_000m);

        Assert.Multiple(() =>
        {
            Assert.That(a.Comfortable.MaxHousingPayment, Is.Zero, "36% of $7,500 is $2,700, less than the debts");
            Assert.That(a.Comfortable.MaxHomePrice, Is.Zero, "no price fits");
        });
    }

    [Test]
    public void AnFhaLoan_IsHeldToItsCountysLimit()
    {
        // Bexar County, Texas: HUD's 2026 limit is $557,750. With 3.5% down, a base loan of $557,750 is a $577,979.27 price.
        var request = A.Request.WithHomePrice(300_000m).WithDownPayment(10_500m).WithProgram(LoanProgramType.Fha, countyFips: "48029");

        var price = AffordabilityOf(request, income: 400_000m, debts: 0m).MostAllowed.MaxHomePrice;

        Assert.That(price, Is.EqualTo(577_979m), "the income would reach far higher, but FHA insures no more there");
    }

    [Test]
    public void ExtraPayments_AndClosingCosts_DoNotChangeIt()
    {
        var plain = AffordabilityOf(TexasPurchase());
        var busy = AffordabilityOf(TexasPurchase().WithMonthlyExtra(300m).WithClosingCosts(credits: 2_000m));

        Assert.Multiple(() =>
        {
            Assert.That(busy.Comfortable, Is.EqualTo(plain.Comfortable), "lenders qualify the scheduled payment");
            Assert.That(busy.MostAllowed, Is.EqualTo(plain.MostAllowed), "at either limit");
        });
    }
}
