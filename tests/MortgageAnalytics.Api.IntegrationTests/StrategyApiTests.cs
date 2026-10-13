using System.Net;
using System.Net.Http.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using static MortgageAnalytics.Testing.ReferenceStrategies;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>The strategy comparison through HTTP: JSON in, the reference numbers out.</summary>
[TestFixture]
public class StrategyApiTests : ApiTestBase
{
    private const string CompareUrl = "/api/v1/strategies/compare";

    [Test]
    public async Task Compare_ReturnsTheRankedStrategies()
    {
        var response = await Client.PostAsJsonAsync(CompareUrl, TypicalRequest);
        var body = await ReadJsonAsync(response);
        var payOff = body.GetProperty("strategies")[0];

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"a valid request succeeds; body: {body}");
            Assert.That(body.GetProperty("recommended").GetString(), Is.EqualTo("InvestTheDifference"), "enums are names, not numbers");
            Assert.That(body.GetProperty("badDecadeWinner").GetString(), Is.EqualTo("PayOffFirst"), "the downside winner is reported too");
            Assert.That(payOff.GetProperty("strategy").GetString(), Is.EqualTo("PayOffFirst"), "strategies in a fixed order");
            Assert.That(payOff.GetProperty("riskAdjusted").GetProperty("payoffDate").GetString(), Is.EqualTo("2041-11-01"), "dates are ISO strings");
            Assert.That(payOff.GetProperty("riskAdjusted").GetProperty("years")[30].GetProperty("netWorth").GetDecimal(),
                Is.EqualTo(Typical.PayOffFirst.RiskAdjustedNetWorthAtYear30), "the reference net worth, to the cent");
        });
    }

    [Test]
    public async Task Compare_AcceptsEnumNames()
    {
        var response = await Client.PostAsJsonAsync(CompareUrl, new
        {
            currentBalance = 300_000,
            annualInterestRate = 6.5,
            remainingTermInMonths = 300,
            homeValue = 400_000,
            grossAnnualIncome = 120_000,
            marginalTaxRate = 24,
            filingStatus = "Single",
            monthlyCashToPutToWork = 1_000,
            expectedAnnualReturn = 10,
            riskProfile = "Conservative",
        });
        var body = await ReadJsonAsync(response);

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"names bind; body: {body}");
            Assert.That(body.GetProperty("rates").GetProperty("standardDeduction").GetDecimal(), Is.EqualTo(16_100m), "Single filer");
            Assert.That(body.GetProperty("rates").GetProperty("riskMargin").GetDecimal(), Is.EqualTo(4m), "Conservative");
        });
    }

    [Test]
    public async Task Compare_RejectsAnInvalidRequest_WithFieldErrors()
    {
        var response = await Client.PostAsJsonAsync(CompareUrl, TypicalRequest with { CurrentBalance = 0, RemainingTermInMonths = 400 });
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid input is a validation problem");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");

        Assert.Multiple(() =>
        {
            Assert.That(errors.TryGetProperty("currentBalance", out _), Is.True, $"the balance is reported; errors: {errors}");
            Assert.That(errors.TryGetProperty("remainingTermInMonths", out _), Is.True, $"and the term; errors: {errors}");
        });
    }
}
