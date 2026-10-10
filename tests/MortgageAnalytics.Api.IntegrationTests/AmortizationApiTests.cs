using System.Net;
using System.Text.Json;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using Extra200 = MortgageAnalytics.Testing.ReferenceLoans.StandardWithMonthlyExtra200;
using Standard = MortgageAnalytics.Testing.ReferenceLoans.Standard;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// The real HTTP pipeline in memory: routing, JSON binding (enums as strings), the validation filter,
/// ProblemDetails and serialization. Only the network socket is missing.
/// </summary>
[TestFixture]
public class AmortizationApiTests : ApiTestBase
{
    [Test]
    public async Task Calculate_ValidRequest_ReturnsBothSchedulesAndSavings()
    {
        var response = await PostCalculateAsync(A.Request.WithMonthlyExtra(Extra200.MonthlyExtra).Build());

        var json = await ReadJsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "a valid request succeeds");
            Assert.That(json.GetProperty("baseline").GetProperty("monthlyPayment").GetDecimal(), Is.EqualTo(Standard.MonthlyPayment), "decimals serialize exactly");
            Assert.That(json.GetProperty("baseline").GetProperty("payments").GetArrayLength(), Is.EqualTo(Standard.TermInMonths), "every payment row is returned");
            Assert.That(json.GetProperty("accelerated").GetProperty("numberOfPayments").GetInt32(), Is.EqualTo(Extra200.NumberOfPayments), "the accelerated schedule");
            Assert.That(json.GetProperty("savings").GetProperty("interestSaved").GetDecimal(), Is.EqualTo(Extra200.InterestSaved), "the savings summary");
            Assert.That(json.GetProperty("savings").GetProperty("acceleratedPayoffDate").GetString(), Is.EqualTo("2046-12-01"), "dates serialize as ISO yyyy-MM-dd");
            Assert.That(json.GetProperty("purchase").GetProperty("loanAmount").GetDecimal(), Is.EqualTo(Standard.LoanAmount), "the purchase summary");
            Assert.That(json.GetProperty("projection").GetArrayLength(), Is.EqualTo(30), "one projection row per year");
        });
    }

    [Test]
    public async Task Calculate_EnumsAreAcceptedAsStrings()
    {
        var response = await PostCalculateAsync(new
        {
            homePrice = 250_000,
            downPayment = 12_500,
            annualInterestRate = 6.5,
            termInMonths = 360,
            strategy = "Recast",
            extraPayments = new { lumpSums = new[] { new { paymentNumber = 12, amount = 25_000 } } },
            housingCosts = new { pmiRate = 0.5, pmiCancellation = "BorrowerRequested" },
        });

        var json = await ReadJsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "string enum values bind");
            Assert.That(json.GetProperty("accelerated").GetProperty("recasts").GetArrayLength(), Is.EqualTo(1), "\"Recast\" selected the recast strategy");
            Assert.That(json.GetProperty("purchase").GetProperty("mortgageInsuranceRequired").GetBoolean(), Is.True, "5% down requires PMI");
        });
    }

    [Test]
    public async Task Calculate_WithoutAFirstPaymentDate_UsesTheInjectedClock()
    {
        var response = await PostCalculateAsync(A.Request.WithFirstPaymentDate(null).Build());

        var json = await ReadJsonAsync(response);
        Assert.That(
            json.GetProperty("baseline").GetProperty("payments")[0].GetProperty("dueDate").GetString(),
            Is.EqualTo("2026-11-01"),
            "the API's default comes from TimeProvider, which the test host freezes");
    }

    [Test]
    public async Task Calculate_InvalidRequest_ReturnsValidationProblemWithJsonFieldPaths()
    {
        var response = await PostCalculateAsync(new
        {
            homePrice = 300_000,
            downPayment = 300_000,
            annualInterestRate = 45,
            termInMonths = 360,
            extraPayments = new { lumpSums = new[] { new { paymentNumber = 400, amount = 1_000 } } },
            housingCosts = new { pid = new { annualAssessment = 1_200, remainingYears = 99 } },
        });

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid input is a validation problem");
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.Multiple(() =>
        {
            Assert.That(
                errors.EnumerateObject().Select(e => e.Name),
                Is.SupersetOf(new[] { "downPayment", "annualInterestRate", "extraPayments.lumpSums[0].paymentNumber", "housingCosts.pid.remainingYears" }),
                "error keys are camelCase JSON paths that match the request body");
            Assert.That(
                errors.GetProperty("housingCosts.pid.remainingYears")[0].GetString(),
                Is.EqualTo("'PID remaining years' must be between 1 and 50. You entered 99."),
                "messages use readable field names");
        });
    }

    [TestCase("{ not json", TestName = "Malformed JSON")]
    [TestCase("""{ "homePrice": 1000, "downPayment": 0, "annualInterestRate": 5, "termInMonths": 12, "strategy": "Sideways" }""", TestName = "Unknown strategy")]
    [TestCase("""{ "homePrice": "lots", "downPayment": 0, "annualInterestRate": 5, "termInMonths": 12 }""", TestName = "Wrong type")]
    [TestCase("null", TestName = "Null body")]
    public async Task Calculate_UnreadableBody_ReturnsBadRequestProblem(string body)
    {
        var response = await PostRawAsync(body);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "a body that cannot be bound is the client's error");
    }
}
