using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Application.SavedCalculations;
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

        Assert.Multiple(() =>
        {
            Assert.That(() => provider.GetRequiredService<IAmortizationService>(), Throws.Nothing, "the purchase analysis resolves with its dependencies");
            Assert.That(() => provider.GetRequiredService<IRefinanceService>(), Throws.Nothing, "and so does the refinance comparison");
        });
    }

    [Test]
    public void AddApplication_RegistersTheSavedCalculationService_OnceTheHostProvidesStorage()
    {
        var services = new ServiceCollection().AddScoped(_ => Substitute.For<ISavedCalculationRepository>());

        using var provider = services.AddApplication().BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        using var scope = provider.CreateScope();

        Assert.That(() => scope.ServiceProvider.GetRequiredService<ISavedCalculationService>(), Throws.Nothing,
            "the service is scoped, like the database storage it uses");
    }
}
