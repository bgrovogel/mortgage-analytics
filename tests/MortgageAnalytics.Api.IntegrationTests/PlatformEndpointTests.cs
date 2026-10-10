using System.Net;
using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>Swagger, health and routing behavior that is not specific to one endpoint.</summary>
[TestFixture]
public class PlatformEndpointTests : ApiTestBase
{
    [Test]
    public async Task SwaggerDocument_DescribesTheCalculateEndpoint()
    {
        var swagger = await Client.GetStringAsync("/swagger/v1/swagger.json");

        Assert.Multiple(() =>
        {
            Assert.That(swagger, Does.Contain(CalculateUrl), "the endpoint is documented");
            Assert.That(swagger, Does.Contain("AmortizationRequest"), "the request schema is documented");
            Assert.That(swagger, Does.Contain("Nominal annual interest rate"), "XML comments flow into the schema");
        });
    }

    [Test]
    public async Task Health_ReportsHealthy()
    {
        var body = await Client.GetStringAsync("/health");

        Assert.That(body, Is.EqualTo("Healthy"), "the health endpoint is used by container orchestrators");
    }

    [Test]
    public async Task UnknownApiRoute_Returns404Problem_NotTheSpaShell()
    {
        var response = await Client.GetAsync("/api/v1/does-not-exist");

        await AssertProblemAsync(response, HttpStatusCode.NotFound, "unknown API routes must not fall through to index.html");
    }
}
