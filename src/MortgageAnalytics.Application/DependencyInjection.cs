using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Application.Validation;
using MortgageAnalytics.Domain.Amortization;

namespace MortgageAnalytics.Application;

/// <summary>Registers this layer (and the domain it wraps) with the dependency-injection container.</summary>
public static class DependencyInjection
{
    /// <summary>Registers the domain engine, the use case and the validators. The host calls only this method.</summary>
    /// <param name="services">The container to add to.</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Stateless, so one shared instance of each is safe.
        services.AddSingleton<IAmortizationCalculator, AmortizationCalculator>();
        services.AddSingleton<ILoanComparer, LoanComparer>();
        services.AddSingleton<IAmortizationService, AmortizationService>();
        services.AddSingleton(TimeProvider.System);

        services.AddValidatorsFromAssemblyContaining<AmortizationRequestValidator>(ServiceLifetime.Singleton);

        return services;
    }
}
