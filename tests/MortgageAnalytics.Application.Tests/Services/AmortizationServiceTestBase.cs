using Microsoft.Extensions.Time.Testing;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Tests.Services;

/// <summary>
/// Base class for <b>unit</b> tests of <see cref="AmortizationService"/>. The domain comparer is an
/// NSubstitute substitute, so these tests check only the service's own decisions: how the request
/// is mapped into domain objects, and how the result is mapped back.
/// </summary>
public abstract class AmortizationServiceTestBase
{
    /// <summary>The substitute domain comparer.</summary>
    protected ILoanComparer Comparer { get; private set; } = null!;

    /// <summary>A clock frozen at <see cref="TestClock.Now"/>; tests may move it.</summary>
    protected FakeTimeProvider Clock { get; private set; } = null!;

    /// <summary>The service under test.</summary>
    protected AmortizationService Service { get; private set; } = null!;

    [SetUp]
    public void CreateService()
    {
        Comparer = Substitute.For<ILoanComparer>();
        Comparer.Compare(default!, default!, default!, default!).ReturnsForAnyArgs(CannedComparison);
        Clock = TestClock.Create();
        Service = new AmortizationService(Comparer, Clock);
    }

    /// <summary>
    /// Restarts the service on a clock fixed at <paramref name="now"/>, optionally in another local time zone.
    /// (A fake clock can only move forward, so tests that need an earlier moment start a new one.)
    /// </summary>
    protected void UseClock(DateTimeOffset now, TimeZoneInfo? localTimeZone = null)
    {
        Clock = TestClock.Create(now);
        if (localTimeZone is not null)
            Clock.SetLocalTimeZone(localTimeZone);
        Service = new AmortizationService(Comparer, Clock);
    }

    /// <summary>A real comparison for the reference loan, returned by the substitute for any input.</summary>
    protected static LoanComparison CannedComparison { get; } =
        new LoanComparer(new AmortizationCalculator()).Compare(A.Loan(), ExtraPaymentPlan.None, RecastPolicy.Never, HousingCostPlan.None);

    /// <summary>
    /// The arguments of the service's main comparison: its first call to <see cref="ILoanComparer.Compare"/>. A loan
    /// with automatic PMI removal is then compared once more, with removal on request (an FHA loan's MIP comparison
    /// comes first, so FHA tests do not use this).
    /// </summary>
    protected (LoanTerms Loan, ExtraPaymentPlan Extras, RecastPolicy Recast, HousingCostPlan Costs) CompareArguments()
    {
        var args = Comparer.ReceivedCalls().First().GetArguments();
        return ((LoanTerms)args[0]!, (ExtraPaymentPlan)args[1]!, (RecastPolicy)args[2]!, (HousingCostPlan)args[3]!);
    }
}
