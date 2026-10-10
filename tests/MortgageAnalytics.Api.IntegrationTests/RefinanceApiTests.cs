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
    public async Task Analyze_CanLeaveOutThePaymentRows()
    {
        var body = await ReadJsonAsync(await Client.PostAsJsonAsync($"{AnalyzeUrl}?includePayments=false", ReferenceBody));

        Assert.That(body.GetProperty("refinanced").GetProperty("payments").GetArrayLength(), Is.Zero, "summaries only");
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
}
