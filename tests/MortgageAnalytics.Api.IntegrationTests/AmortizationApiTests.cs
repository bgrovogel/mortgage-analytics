using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Exercises the real HTTP pipeline in memory: routing, JSON binding, the validation filter,
/// ProblemDetails and serialization. Only the network socket is missing.
/// </summary>
[TestFixture]
public class AmortizationApiTests
{
    private const string CalculateUrl = "/api/v1/amortization/calculate";

    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public void StartServer()
    {
        _factory = new WebApplicationFactory<Program>();
        _client = _factory.CreateClient();
    }

    [OneTimeTearDown]
    public void StopServer()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Test]
    public async Task Calculate_ValidRequest_ReturnsBothSchedulesAndSavings()
    {
        var response = await _client.PostAsJsonAsync(CalculateUrl, new
        {
            homePrice = 250_000,
            downPayment = 50_000,
            annualInterestRate = 6,
            termInMonths = 360,
            firstPaymentDate = "2026-01-01",
            strategy = "ShortenTerm",
            extraPayments = new { monthlyAmount = 200 },
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        using var json = await ReadJson(response);
        var root = json.RootElement;
        Assert.Multiple(() =>
        {
            Assert.That(root.GetProperty("baseline").GetProperty("monthlyPayment").GetDecimal(), Is.EqualTo(1_199.10m));
            Assert.That(root.GetProperty("baseline").GetProperty("payments").GetArrayLength(), Is.EqualTo(360));
            Assert.That(root.GetProperty("accelerated").GetProperty("numberOfPayments").GetInt32(), Is.EqualTo(252));
            Assert.That(root.GetProperty("savings").GetProperty("paymentsSaved").GetInt32(), Is.EqualTo(108));
            Assert.That(root.GetProperty("savings").GetProperty("interestSaved").GetDecimal(), Is.EqualTo(79_800.86m));
            Assert.That(root.GetProperty("savings").GetProperty("acceleratedPayoffDate").GetString(), Is.EqualTo("2046-12-01"));
            Assert.That(root.GetProperty("purchase").GetProperty("loanAmount").GetDecimal(), Is.EqualTo(200_000m));
        });
    }

    [Test]
    public async Task Calculate_WithHousingCostsAndRecast_SerializesEveryNewField()
    {
        var response = await _client.PostAsJsonAsync(CalculateUrl, new
        {
            homePrice = 250_000,
            downPayment = 12_500,
            annualInterestRate = 6.5,
            termInMonths = 360,
            firstPaymentDate = "2026-01-01",
            strategy = "Recast",
            recast = new { minimumLumpSum = 10_000, fee = 250 },
            extraPayments = new { lumpSums = new[] { new { paymentNumber = 12, amount = 25_000 } } },
            housingCosts = new
            {
                propertyTaxRate = 2.1,
                mudTaxRate = 0.85,
                pid = new { annualAssessment = 1_200, remainingYears = 10 },
                annualHomeownersInsurance = 2_400,
                monthlyHoaDues = 75,
                pmiRate = 0.5,
                pmiCancellation = "BorrowerRequested",
            },
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        using var json = await ReadJson(response);
        var root = json.RootElement;
        var accelerated = root.GetProperty("accelerated");
        Assert.Multiple(() =>
        {
            Assert.That(root.GetProperty("purchase").GetProperty("mortgageInsuranceRequired").GetBoolean(), Is.True);
            Assert.That(accelerated.GetProperty("monthlyHousingCosts").GetProperty("total").GetDecimal(), Is.EqualTo(1_088.54m));
            Assert.That(accelerated.GetProperty("recasts").GetArrayLength(), Is.EqualTo(1));
            Assert.That(accelerated.GetProperty("mortgageInsuranceEndDate").ValueKind, Is.EqualTo(JsonValueKind.String));
            Assert.That(root.GetProperty("savings").GetProperty("recastFees").GetDecimal(), Is.EqualTo(250m));
            Assert.That(root.GetProperty("savings").GetProperty("mortgageInsuranceSaved").GetDecimal(), Is.GreaterThan(0m));
        });
    }

    [Test]
    public async Task Calculate_InvalidRequest_ReturnsValidationProblemWithJsonFieldPaths()
    {
        var response = await _client.PostAsJsonAsync(CalculateUrl, new
        {
            homePrice = 300_000,
            downPayment = 300_000,
            annualInterestRate = 45,
            termInMonths = 360,
            extraPayments = new { lumpSums = new[] { new { paymentNumber = 400, amount = 1_000 } } },
            housingCosts = new { pid = new { annualAssessment = 1_200, remainingYears = 99 } },
        });

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(response.Content.Headers.ContentType?.MediaType, Is.EqualTo("application/problem+json"));

        using var json = await ReadJson(response);
        var errors = json.RootElement.GetProperty("errors").EnumerateObject().Select(e => e.Name).ToList();
        Assert.That(errors, Is.EquivalentTo(new[]
        {
            "downPayment",
            "annualInterestRate",
            "extraPayments.lumpSums[0].amount", // exceeds the (zero) loan amount
            "extraPayments.lumpSums[0].paymentNumber",
            "housingCosts.pid.remainingYears",
        }));
    }

    [TestCase("{ not json", TestName = "Malformed JSON")]
    [TestCase("""{ "homePrice": 1000, "downPayment": 0, "annualInterestRate": 5, "termInMonths": 12, "strategy": "Sideways" }""", TestName = "Unknown strategy")]
    [TestCase("""{ "homePrice": "lots", "downPayment": 0, "annualInterestRate": 5, "termInMonths": 12 }""", TestName = "Wrong type")]
    public async Task Calculate_UnreadableBody_ReturnsBadRequestProblem(string body)
    {
        var response = await _client.PostAsync(CalculateUrl, new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
            Assert.That(response.Content.Headers.ContentType?.MediaType, Is.EqualTo("application/problem+json"));
        });
    }

    [Test]
    public async Task SwaggerDocument_DescribesTheCalculateEndpoint()
    {
        var swagger = await _client.GetStringAsync("/swagger/v1/swagger.json");

        Assert.Multiple(() =>
        {
            Assert.That(swagger, Does.Contain(CalculateUrl));
            Assert.That(swagger, Does.Contain("AmortizationRequest"));
            Assert.That(swagger, Does.Contain("Nominal annual interest rate"), "XML comments should flow into the schema");
        });
    }

    [Test]
    public async Task UnknownApiRoute_Returns404Problem_NotTheSpaShell()
    {
        var response = await _client.GetAsync("/api/v1/does-not-exist");

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(response.Content.Headers.ContentType?.MediaType, Is.EqualTo("application/problem+json"));
        });
    }

    [Test]
    public async Task Health_ReportsHealthy()
    {
        var body = await _client.GetStringAsync("/health");

        Assert.That(body, Is.EqualTo("Healthy"));
    }

    private static async Task<JsonDocument> ReadJson(HttpResponseMessage response) =>
        await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
}
