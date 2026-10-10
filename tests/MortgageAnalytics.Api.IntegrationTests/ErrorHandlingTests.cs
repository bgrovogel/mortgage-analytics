using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain;
using NSubstitute.ExceptionExtensions;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// The global exception handler. A substitute <see cref="IAmortizationService"/> throws on demand,
/// because valid input never makes the real service fail.
/// </summary>
[TestFixture]
public class ErrorHandlingTests : ApiTestBase
{
    private IAmortizationService _service = null!;
    private MortgageApiFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void StartApiWithSubstituteService()
    {
        _service = Substitute.For<IAmortizationService>();
        _factory = new MortgageApiFactory(services => services.AddSingleton(_service));
        _client = _factory.CreateClient();
    }

    [TearDown]
    public void StopApi()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private void ServiceThrows(Exception exception) =>
        _service.Analyze(Arg.Any<AmortizationRequest>()).Throws(exception);

    private static IEnumerable<TestCaseData> ServerSideFailures()
    {
        // Validation runs before the domain, so a broken domain rule means a bug, not bad input:
        // it is a server error like any other, and its internal message must not leak.
        yield return new TestCaseData(new DomainValidationException("Principal must be greater than 0."), "Principal must")
            .SetName("A broken domain rule is a bug: 500, message hidden");
        yield return new TestCaseData(new InvalidOperationException("secret connection string"), "secret connection string")
            .SetName("An unexpected exception: 500, details hidden");
    }

    [TestCaseSource(nameof(ServerSideFailures))]
    public async Task ServerSideFailure_Returns500_WithoutLeakingDetails(Exception exception, string secret)
    {
        ServiceThrows(exception);

        var response = await PostCalculateAsync(A.Request.Build(), _client);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Multiple(() =>
        {
            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.InternalServerError), $"this is the server's fault, not the client's; body: {body}");
            Assert.That(body, Does.Contain("An unexpected error occurred."), "the client gets a generic title");
            Assert.That(body, Does.Not.Contain(secret), "exception details must never reach the client");
        });
    }

    [Test]
    public async Task BadRequestThrownWithASpecificStatus_KeepsThatStatus()
    {
        ServiceThrows(new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge));

        var response = await PostCalculateAsync(A.Request.Build(), _client);

        await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "a 413 must not be reported as a generic 400");
    }

    [Test]
    public async Task BadRequestThrownDuringProcessing_Returns400Problem()
    {
        ServiceThrows(new BadHttpRequestException("Unexpected end of request content."));

        var response = await PostCalculateAsync(A.Request.Build(), _client);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "an unreadable request is the client's error");
    }

    [Test]
    public async Task ValidRequest_ReachesTheServiceOnce()
    {
        _service.Analyze(Arg.Any<AmortizationRequest>()).Returns(callInfo => new MortgageAnalytics.Application.Services.AmortizationService(
            new MortgageAnalytics.Domain.Amortization.LoanComparer(new MortgageAnalytics.Domain.Amortization.AmortizationCalculator()),
            TestClock.Create()).Analyze(callInfo.Arg<AmortizationRequest>()));

        await PostCalculateAsync(A.Request.Build(), _client);

        Assert.That(() => _service.Received(1).Analyze(Arg.Any<AmortizationRequest>()), Throws.Nothing, "the endpoint delegates to the service exactly once");
    }

    [Test]
    public async Task InvalidRequest_NeverReachesTheService()
    {
        await PostCalculateAsync(A.Request.WithRate(45m).Build(), _client);

        Assert.That(() => _service.DidNotReceiveWithAnyArgs().Analyze(default!), Throws.Nothing, "the validation filter stops bad input before the service");
    }
}
