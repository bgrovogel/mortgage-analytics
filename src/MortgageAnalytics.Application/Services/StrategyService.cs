using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Strategies;

namespace MortgageAnalytics.Application.Services;

/// <summary>Compares paying the mortgage off first, investing the difference, and a hybrid.</summary>
public interface IStrategyService
{
    /// <summary>Runs the comparison for an already-validated request.</summary>
    /// <param name="request">A request that has passed <see cref="Validation.StrategyRequestValidator"/>.</param>
    /// <returns>Every strategy in every market scenario, and the one to recommend.</returns>
    StrategyComparisonResponse Compare(StrategyRequest request);
}

/// <summary>Maps the request into the domain, runs the optimizer, and maps the result back.</summary>
/// <param name="optimizer">The domain comparison.</param>
/// <param name="clock">Supplies today's date for the default next payment.</param>
public sealed class StrategyService(IStrategyOptimizer optimizer, TimeProvider clock) : IStrategyService
{
    /// <inheritdoc />
    public StrategyComparisonResponse Compare(StrategyRequest request)
    {
        var inputs = request.ToInputs(clock.FirstOfNextMonth());
        return optimizer.Compare(inputs).ToResponse(inputs);
    }
}
