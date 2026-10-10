using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Base class for <b>sociable</b> scenario tests: the real domain engine behind the service, with a
/// fixed clock. These prove that mapping and calculation together produce the reference numbers.
/// Tagged so they can be run (or excluded) separately from the isolated unit tests.
/// </summary>
[Category("Sociable")]
public abstract class SociableAnalysisTestBase
{
    /// <summary>The service, wired to the real comparer and calculator.</summary>
    protected AmortizationService Service { get; private set; } = null!;

    [SetUp]
    public void CreateService() =>
        Service = new AmortizationService(new LoanComparer(new AmortizationCalculator()), TestClock.Create());
}
