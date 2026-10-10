using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MortgageAnalytics.Application.SavedCalculations;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Application.Validation;
using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Application;

/// <summary>Registers this layer (and the domain it wraps) with the dependency-injection container.</summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers the domain engine, the use cases and the validators. The host calls this, and also
    /// registers an <see cref="ISavedCalculationRepository"/> (the infrastructure layer provides one).
    /// </summary>
    /// <param name="services">The container to add to.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Stateless, so one shared instance of each is safe.
        services.AddSingleton<IAmortizationCalculator, AmortizationCalculator>();
        services.AddSingleton<ILoanComparer, LoanComparer>();
        services.AddSingleton<IAmortizationService, AmortizationService>();
        // Scoped, like the database storage behind ISavedCalculationRepository (registered by the host).
        services.AddScoped<ISavedCalculationService, SavedCalculationService>();
        // TryAdd: a clock the host (or a test) registered first must win.
        services.TryAddSingleton(TimeProvider.System);

        services.AddValidatorsFromAssemblyContaining<AmortizationRequestValidator>(ServiceLifetime.Singleton);

        return services;
    }
}
