using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using static MortgageAnalytics.Testing.ReferenceRefinances;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>The refinance comparison through HTTP: JSON in, the reference numbers out.</summary>
[TestFixture]
public class RefinanceApiTests : ApiTestBase
{
    private const string AnalyzeUrl = "/api/v1/refinance/analyze";

    private static readonly object ReferenceBody = new
    {
        currentBalance = Current.Balance,
        currentAnnualInterestRate = Current.AnnualInterestRate,
        remainingTermInMonths = Current.RemainingTermInMonths,
        nextPaymentDate = "2026-01-01",
        newAnnualInterestRate = ToSixPercentFor30Years.AnnualInterestRate,
        newTermInMonths = ToSixPercentFor30Years.TermInMonths,
        closingCosts = ToSixPercentFor30Years.ClosingCosts,
        financeClosingCosts = false,
    };

    [Test]
    public async Task Analyze_ReturnsTheComparison()
    {
        var response = await Client.PostAsJsonAsync(AnalyzeUrl, ReferenceBody);
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"a valid request succeeds; body: {body}");
            Assert.That(body.GetProperty("monthlySavings").GetDecimal(), Is.EqualTo(ToSixPercentFor30Years.MonthlySavings), "the payment drops");
            Assert.That(body.GetProperty("lifetimeSavings").GetDecimal(), Is.EqualTo(ToSixPercentFor30Years.LifetimeSavings), "but it costs more overall");
            Assert.That(body.GetProperty("monthsAdded").GetInt32(), Is.EqualTo(ToSixPercentFor30Years.MonthsAdded), "because the clock restarts");
            Assert.That(body.GetProperty("breakEvenDate").GetString(), Is.EqualTo("2028-01-01"), "dates are ISO strings");
            Assert.That(body.GetProperty("keepingCurrentPayment").GetProperty("numberOfPayments").GetInt32(),
                Is.EqualTo(ToSixPercentFor30Years.KeepingCurrentPayment.NumberOfPayments), "the keep-the-payment option is included");
        });
    }

    [Test]
    public async Task Analyze_WithCashOut_ReturnsTheCashAndWhatItCosts()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync(AnalyzeUrl, new
        {
            currentBalance = Current.Balance,
            currentAnnualInterestRate = Current.AnnualInterestRate,
            remainingTermInMonths = Current.RemainingTermInMonths,
            nextPaymentDate = "2026-01-01",
            newAnnualInterestRate = ToSixPercentTakingFiftyThousandOut.AnnualInterestRate,
            newTermInMonths = ToSixPercentTakingFiftyThousandOut.TermInMonths,
            closingCosts = ToSixPercentTakingFiftyThousandOut.ClosingCosts,
            cashOut = ToSixPercentTakingFiftyThousandOut.CashOut,
            homeValue = 400_000,
        }));

        Assert.Multiple(() =>
        {
            Assert.That(body.GetProperty("cashOut").GetDecimal(), Is.EqualTo(50_000m), "the cash taken out");
            Assert.That(body.GetProperty("netCash").GetDecimal(), Is.EqualTo(44_000m), "less the closing costs");
            Assert.That(body.GetProperty("refinanced").GetProperty("loanAmount").GetDecimal(), Is.EqualTo(350_000m), "is borrowed on the new loan");
            Assert.That(body.GetProperty("newLoanToValuePercent").GetDecimal(), Is.EqualTo(87.5m), "$350,000 of a $400,000 home");
            Assert.That(body.GetProperty("exceedsCashOutLimit").GetBoolean(), Is.True, "above the 80% a cash-out refinance allows");
        });
    }

    [Test]
    public async Task Analyze_CanLeaveOutThePaymentRows()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{AnalyzeUrl}?includePayments=false", ReferenceBody));

        Assert.Multiple(() =>
        {
            foreach (var option in new[] { "current", "refinanced", "keepingCurrentPayment" })
                Assert.That(body.GetProperty(option).GetProperty("payments").GetArrayLength(), Is.Zero, $"no payment rows in {option}");
            Assert.That(body.GetProperty("refinanced").GetProperty("numberOfPayments").GetInt32(),
                Is.EqualTo(ToSixPercentFor30Years.TermInMonths), "the summaries are still there");
        });
    }

    [Test]
    public async Task Analyze_GivenTheOriginalLoan_StartsFromWhatIsOwedToday()
    {
        // Five years ago: what is owed today is less than was borrowed, with fewer payments left. (The exact
        // figures, on a pinned date, are in RefinanceServiceTests.)
        var start = DateTime.Today.AddYears(-5);
        var original = new { amount = 200_000, termInMonths = 360, firstPaymentDate = $"{start:yyyy-MM}-01" };
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync(AnalyzeUrl, new
        {
            currentAnnualInterestRate = 6, originalLoan = original, newAnnualInterestRate = 5, newTermInMonths = 360, closingCosts = 4_000,
        }));
        var current = body.GetProperty("current");

        Assert.Multiple(() =>
        {
            Assert.That(current.GetProperty("loanAmount").GetDecimal(), Is.InRange(180_000m, 190_000m), $"about five years of principal is paid; body: {body}");
            Assert.That(current.GetProperty("numberOfPayments").GetInt32(), Is.InRange(299, 301), "about 25 years of payments are left");
            Assert.That(current.GetProperty("monthlyPayment").GetDecimal(), Is.EqualTo(1_199.10m), "the original payment carries on");
        });
    }

    [Test]
    public async Task Analyze_RejectsAnOriginalLoanThatIsAlreadyPaidOff()
    {
        var response = await Client.PostAsJsonAsync(AnalyzeUrl, new
        {
            currentAnnualInterestRate = 6,
            originalLoan = new { amount = 200_000, termInMonths = 360, firstPaymentDate = "1990-01-01" },
            newAnnualInterestRate = 5, newTermInMonths = 360, closingCosts = 0,
        });
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "nothing is left to refinance");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");

        Assert.That(errors.TryGetProperty("originalLoan.firstPaymentDate", out _), Is.True, $"the date is the problem; errors: {errors}");
    }

    [Test]
    public async Task Analyze_RejectsAnInvalidRequest_WithFieldErrors()
    {
        var response = await Client.PostAsJsonAsync(AnalyzeUrl, new { currentBalance = 0, newTermInMonths = 0 });
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid input is a validation problem");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");

        Assert.Multiple(() =>
        {
            Assert.That(errors.TryGetProperty("currentBalance", out _), Is.True, $"the balance is reported; errors: {errors}");
            Assert.That(errors.TryGetProperty("newTermInMonths", out _), Is.True, $"and the term; errors: {errors}");
        });
    }

    [Test]
    public async Task AHomeEquityLoan_IsComparedWithTheCashOutRefinance_WhenAskedFor()
    {
        var request = new
        {
            currentBalance = 300_000, currentAnnualInterestRate = 7, remainingTermInMonths = 300, newAnnualInterestRate = 6, newTermInMonths = 360,
            closingCosts = 6_000, cashOut = 50_000, homeValue = 500_000,
            homeEquityLoan = new { annualInterestRate = 8, termInMonths = 180, yearsKept = 7 },
        };

        var response = await Client.PostAsJsonAsync("/api/v1/refinance/analyze?includePayments=false", request);
        var equity = (await ReadJsonAsync(response)).GetProperty("homeEquity");

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the request is valid");
            Assert.That(equity.GetProperty("availableEquity").GetDecimal(), Is.EqualTo(100_000m), "80% of the home's value less what is owed");
            Assert.That(equity.GetProperty("savedByEquityLoan").GetDecimal(), Is.EqualTo(-16_044.28m), "the comparison, as the service works it out");
        });
    }

    [Test]
    public async Task AHomeEquityLine_IsComparedAsInterestOnlyThenRepaid_WhenADrawPeriodIsGiven()
    {
        var request = new
        {
            currentBalance = 300_000, currentAnnualInterestRate = 7, remainingTermInMonths = 300, newAnnualInterestRate = 6, newTermInMonths = 360,
            closingCosts = 6_000, cashOut = 50_000, homeValue = 500_000,
            homeEquityLoan = new { annualInterestRate = 8, termInMonths = 240, yearsKept = 7, drawPeriodInMonths = 120, repaymentRate = 9 },
        };

        var response = await Client.PostAsJsonAsync("/api/v1/refinance/analyze?includePayments=false", request);
        var equity = (await ReadJsonAsync(response)).GetProperty("homeEquity");

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the request is valid");
            Assert.That(equity.GetProperty("drawPeriodInMonths").GetInt32(), Is.EqualTo(120), "the draw period is echoed");
            Assert.That(equity.GetProperty("repaymentPayment").GetDecimal(), Is.EqualTo(449.86m), "the payment once it is being repaid, at 9%");
            Assert.That(equity.GetProperty("keepAndBorrow").GetProperty("equityLoanPayment").GetDecimal(), Is.EqualTo(333.33m), "interest only while drawn");
            Assert.That(equity.GetProperty("savedByEquityLoan").GetDecimal(), Is.EqualTo(-20_106.24m), "the comparison, as the service works it out");
        });
    }

    [Test]
    public async Task AHomeEquityLine_WithADrawPeriodOverThirtyYears_Returns400()
    {
        var request = new
        {
            currentBalance = 300_000, currentAnnualInterestRate = 7, remainingTermInMonths = 300, newAnnualInterestRate = 6, newTermInMonths = 360,
            cashOut = 50_000,
            homeEquityLoan = new { annualInterestRate = 8, termInMonths = 240, yearsKept = 7, drawPeriodInMonths = 361 },
        };

        var response = await Client.PostAsJsonAsync("/api/v1/refinance/analyze", request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "a draw period is at most 30 years");
    }

    [Test]
    public async Task AHomeEquityLoan_WithoutCashOut_Returns400()
    {
        var request = new
        {
            currentBalance = 300_000, currentAnnualInterestRate = 7, remainingTermInMonths = 300, newAnnualInterestRate = 6, newTermInMonths = 360,
            homeEquityLoan = new { annualInterestRate = 8, termInMonths = 180, yearsKept = 7 },
        };

        var response = await Client.PostAsJsonAsync("/api/v1/refinance/analyze", request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "there is no cash to borrow against the home");
    }
}
