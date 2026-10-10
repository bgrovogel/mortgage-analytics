using MortgageAnalytics.Api.IntegrationTests.Infrastructure;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Starts one in-memory API for the whole test run and shares it, instead of booting a host per
/// fixture. It lives in the root test namespace because NUnit applies a SetUpFixture only to tests in
/// its own namespace and below.
/// </summary>
[SetUpFixture]
public sealed class ApiFixture
{
    /// <summary>The shared host.</summary>
    public static MortgageApiFactory Factory { get; private set; } = null!;

    /// <summary>A client for the shared host.</summary>
    public static HttpClient Client { get; private set; } = null!;

    [OneTimeSetUp]
    public void StartApi()
    {
        Factory = new MortgageApiFactory();
        Client = Factory.CreateClient();
    }

    [OneTimeTearDown]
    public void StopApi()
    {
        Client.Dispose();
        Factory.Dispose();
    }
}
