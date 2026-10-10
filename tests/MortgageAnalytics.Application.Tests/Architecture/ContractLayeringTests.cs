using System.Reflection;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Tests.Architecture;

/// <summary>
/// The API contract belongs to the Application layer. If a contract exposed a Domain type, renaming
/// that type would silently change the public API, so this test keeps the two apart.
/// </summary>
[TestFixture]
public class ContractLayeringTests
{
    [Test]
    public void ContractTypes_NeverExposeDomainTypes()
    {
        var domain = typeof(MortgageAnalytics.Domain.Money).Assembly;
        var contracts = typeof(AmortizationRequest).Assembly.GetTypes()
            .Where(t => t.Namespace == typeof(AmortizationRequest).Namespace);

        var leaks = contracts
            .SelectMany(t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => (Type: t, Property: p)))
            .Where(x => UnderlyingTypes(x.Property.PropertyType).Any(type => type.Assembly == domain))
            .Select(x => $"{x.Type.Name}.{x.Property.Name} ({x.Property.PropertyType.Name})")
            .ToList();

        Assert.That(leaks, Is.Empty, "contracts must use their own types; map domain types in AmortizationMapper:\n" + string.Join('\n', leaks));
    }

    private static IEnumerable<Type> UnderlyingTypes(Type type) =>
        type.IsGenericType ? type.GetGenericArguments().SelectMany(UnderlyingTypes).Prepend(type) : [type];
}
