using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Application.Services;

namespace MortgageAnalytics.Application.Tests;

[TestFixture]
public class DependencyInjectionTests
{
    [Test]
    public void AddApplication_KeepsATimeProviderTheHostAlreadyRegistered()
    {
        var hostClock = TestClock.Create();
        var services = new ServiceCollection().AddSingleton<TimeProvider>(hostClock);

        using var provider = services.AddApplication().BuildServiceProvider();

        Assert.That(provider.GetRequiredService<TimeProvider>(), Is.SameAs(hostClock), "the host's clock (or a test's) must win over the default");
    }

    [Test]
    public void AddApplication_RegistersEverythingTheServiceNeeds()
    {
        using var provider = new ServiceCollection().AddApplication().BuildServiceProvider();

        Assert.That(() => provider.GetRequiredService<IAmortizationService>(), Throws.Nothing, "the use case resolves with its dependencies");
    }
}
