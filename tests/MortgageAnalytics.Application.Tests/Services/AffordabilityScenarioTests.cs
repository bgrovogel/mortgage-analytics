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
