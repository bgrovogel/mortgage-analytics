using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
            Assert.That(swagger, Does.Contain("homestead"), "the API description covers taxes and exemptions, not only amortization");
            Assert.That(swagger, Does.Contain("includePayments"), "the option to leave out monthly rows is documented");
            Assert.That(swagger, Does.Contain("\"500\""), "the server-error response is documented");
        });
    }

    [TestCase("br")]
    [TestCase("gzip")]
    public async Task Calculate_CompressesTheResponse_ForAClientThatAcceptsIt(string encoding)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, CalculateUrl) { Content = JsonContent.Create(A.Request.Build()) };
        request.Headers.AcceptEncoding.ParseAdd(encoding);

        using var response = await Client.SendAsync(request);
        var compressed = await response.Content.ReadAsByteArrayAsync();
        await using var reader = encoding == "br"
            ? (Stream)new BrotliStream(new MemoryStream(compressed), CompressionMode.Decompress)
            : new GZipStream(new MemoryStream(compressed), CompressionMode.Decompress);
        var body = await JsonDocument.ParseAsync(reader);

        Assert.Multiple(() =>
        {
            Assert.That(response.Content.Headers.ContentEncoding, Is.EquivalentTo(new[] { encoding }), "the response says how it is compressed");
            Assert.That(body.RootElement.GetProperty("baseline").GetProperty("payments").GetArrayLength(), Is.EqualTo(360), "it decompresses to the full response");
            Assert.That(compressed.Length, Is.LessThan(40_000), "a 30-year schedule (about 270 KB of JSON) shrinks several times over");
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
