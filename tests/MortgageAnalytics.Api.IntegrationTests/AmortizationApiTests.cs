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
    public async Task Calculate_ABuydownOrAnAdjustableRate_RoundTripsAsJson()
    {
        var buydown = await ReadJsonAsync(await PostCalculateAsync(A.Request.WithBuydown(2m, 1m).Build()));
        var arm = await ReadJsonAsync(await PostCalculateAsync(A.Request.WithAdjustableRate(7.5m).Build()));

        Assert.Multiple(() =>
        {
            Assert.That(buydown.GetProperty("buydown").GetProperty("totalSubsidy").GetDecimal(), Is.EqualTo(4_436.76m), "the buydown's cost");
            Assert.That(buydown.GetProperty("baseline").GetProperty("payments")[0].GetProperty("buydownSubsidy").GetDecimal(), Is.EqualTo(244.27m),
                "each row says what the subsidy pays");
            Assert.That(arm.GetProperty("baseline").GetProperty("rateChanges")[0].GetProperty("newPayment").GetDecimal(), Is.EqualTo(1_365.01m),
                "the reset and its new payment");
            Assert.That(arm.GetProperty("adjustableRate").GetProperty("worstCasePeakPayment").GetDecimal(), Is.EqualTo(1_787.42m), "the worst case");
            Assert.That(arm.GetProperty("buydown").ValueKind, Is.EqualTo(JsonValueKind.Null), "no buydown on an ARM");
        });
    }

    [Test]
    public async Task Calculate_ClosingCosts_FillInTheirDefaults_AndReturnTheCashToClose()
    {
        // Only the loan costs are sent: 15 days of interest and 3 months of escrow are the request's defaults.
        var response = await PostCalculateAsync(new
        {
            homePrice = Standard.HomePrice, downPayment = Standard.DownPayment, annualInterestRate = Standard.AnnualInterestRate,
            termInMonths = Standard.TermInMonths, closingCosts = new { loanCosts = 4_000 },
        });
        var invalid = await PostCalculateAsync(A.Request.WithClosingCosts(escrowMonths: 15).Build());

        var cash = (await ReadJsonAsync(response)).GetProperty("cashToClose");
        Assert.Multiple(async () =>
        {
            Assert.That(cash.GetProperty("prepaidInterestDays").GetInt32(), Is.EqualTo(15), "half a month of interest unless told otherwise");
            Assert.That(cash.GetProperty("escrowMonths").GetInt32(), Is.EqualTo(3), "and three months of escrow");
            Assert.That(cash.GetProperty("prepaidInterest").GetDecimal(), Is.EqualTo(493.20m), "200,000 × 6% ÷ 365 = $32.88 a day, for 15 days");
            Assert.That(cash.GetProperty("total").GetDecimal(), Is.EqualTo(54_493.20m), "50,000 down, 4,000 of loan costs and the interest: no taxes or insurance to prepay");
            Assert.That((await ReadJsonAsync(invalid)).GetProperty("errors").TryGetProperty("closingCosts.escrowMonths", out _), Is.True,
                "a bad closing cost is reported at its JSON path");
        });
    }

    [Test]
    public async Task Calculate_WithoutPayments_LeavesOutTheMonthlyRowsButKeepsEverythingElse()
    {
        var response = await PostCalculateAsync(A.Request.WithMonthlyExtra(Extra200.MonthlyExtra).Build(), query: "?includePayments=false");

        var json = await ReadJsonAsync(response);
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "the option is valid");
            Assert.That(json.GetProperty("baseline").GetProperty("payments").GetArrayLength(), Is.Zero, "no baseline rows");
            Assert.That(json.GetProperty("accelerated").GetProperty("payments").GetArrayLength(), Is.Zero, "no accelerated rows");
            Assert.That(json.GetProperty("accelerated").GetProperty("numberOfPayments").GetInt32(), Is.EqualTo(Extra200.NumberOfPayments), "summaries are unaffected");
            Assert.That(json.GetProperty("savings").GetProperty("interestSaved").GetDecimal(), Is.EqualTo(Extra200.InterestSaved), "savings are unaffected");
            Assert.That(json.GetProperty("projection").GetArrayLength(), Is.EqualTo(30), "the yearly projection is kept");
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

    [Test]
    public async Task FhaLoanLimits_AreHudsTable_ForTheCountyList()
    {
        var response = await Client.GetAsync("/api/v1/fha/loan-limits");
        var json = await ReadJsonAsync(response);
        var bexar = json.GetProperty("counties").EnumerateArray().Single(c => c.GetProperty("fips").GetString() == "48029");

        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "anyone may read them");
            Assert.That(response.Headers.CacheControl?.MaxAge, Is.EqualTo(TimeSpan.FromDays(1)), "and keep them for a day: they change once a year");
            Assert.That(json.GetProperty("year").GetInt32(), Is.EqualTo(2026), "HUD's 2026 table");
            Assert.That(json.GetProperty("counties").GetArrayLength(), Is.EqualTo(3_235), "every county");
            Assert.That((bexar.GetProperty("name").GetString(), bexar.GetProperty("limit").GetDecimal()), Is.EqualTo(("Bexar County", 557_750m)), "with its limit");
            Assert.That(json.GetProperty("states").GetProperty("TX").GetString(), Is.EqualTo("Texas"), "and each state's name");
        });
    }

    [Test]
    public async Task AnFhaLoanOverItsCountysLimit_IsAValidationProblem_InDollars()
    {
        var response = await PostCalculateAsync(new
        {
            homePrice = 600_000, downPayment = 21_000, annualInterestRate = 6.5, termInMonths = 360,
            program = new { type = "Fha", countyFips = "48029" },
        });

        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.That(errors.GetProperty("downPayment")[0].GetString(), Does.StartWith("FHA insures at most $557,750 in Bexar County, TX (2026)"),
            "the limit in dollars, whatever the server's culture");
    }
}
