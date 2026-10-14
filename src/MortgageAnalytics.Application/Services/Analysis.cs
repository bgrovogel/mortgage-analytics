using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.HousingCosts;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Services;

/// <summary>A loan analyzed: the purchase, its housing costs, its schedules, and how its payments are figured.</summary>
/// <param name="Purchase">The price and down payment.</param>
/// <param name="Valuation">The home's projected market and assessed values.</param>
/// <param name="Plan">The housing costs.</param>
/// <param name="Comparison">The standard and accelerated schedules, with their housing costs.</param>
/// <param name="Rates">The loan, and any buydown, points or program.</param>
internal sealed record Analysis(PropertyPurchase Purchase, PropertyValuation Valuation, HousingCostPlan Plan, LoanComparison Comparison, LoanRates Rates);
