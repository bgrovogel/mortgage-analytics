using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.ExtraPayments;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Tests;

/// <summary>
/// Base class for tests that need real amortization schedules. A fresh calculator is created for
/// every test, and the helpers keep each test focused on the scenario rather than the wiring.
/// </summary>
public abstract class AmortizationTestBase
{
    /// <summary>The calculator under test (or used to build inputs).</summary>
    protected AmortizationCalculator Calculator { get; private set; } = null!;

    [SetUp]
    public void CreateCalculator() => Calculator = new AmortizationCalculator();

    /// <summary>A standard schedule: no extra payments and no recasts.</summary>
    protected AmortizationSchedule StandardSchedule(LoanTerms loan) =>
        Calculator.Generate(loan, ExtraPaymentPlan.None, RecastPolicy.Never);

    /// <summary>A schedule with the given prepayment rules and recast policy.</summary>
    protected AmortizationSchedule WithExtras(LoanTerms loan, RecastPolicy recastPolicy, params IExtraPaymentRule[] rules) =>
        Calculator.Generate(loan, new ExtraPaymentPlan(rules), recastPolicy);
}
