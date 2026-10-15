using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Domain;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// A request priced again at other prices, the way the calculator prices a loan: only the price changes, with the same
/// down payment share, rate and costs. The searches for the most a household or a budget reaches use it.
/// </summary>
internal static class PricedPayments
{
    /// <summary>
    /// The first month's payment at a price, remembered, or null when no loan can be had at it (past a county's FHA
    /// limit). Extra payments, closing costs and other comparisons are left out: they are not part of what a lender
    /// qualifies on, or of a budget.
    /// </summary>
    /// <param name="request">The request as made.</param>
    /// <param name="annualRate">The rate the principal and interest are figured at.</param>
    /// <param name="qualifyingPayment">The first month's payment of a request, with its principal and interest at a rate.</param>
    public static Func<decimal, decimal?> At(
        AmortizationRequest request, decimal annualRate, Func<AmortizationRequest, decimal, decimal> qualifyingPayment)
    {
        var share = request.DownPayment / request.HomePrice;
        var plain = request with { ExtraPayments = null, ClosingCosts = null, SellerOffer = null, Affordability = null, MonthlyBudget = null };
        var payments = new Dictionary<decimal, decimal?>();

        decimal? Qualify(decimal price)
        {
            // The down payment rounded up to the cent, so it never falls below a program's minimum share.
            var down = DownPaymentAt(price, share);
            try { return qualifyingPayment(plain with { HomePrice = price, DownPayment = down }, annualRate); }
            catch (DomainValidationException) { return null; } // no loan at this price: past a county's FHA limit
        }

        return price => payments.TryGetValue(price, out var payment) ? payment : payments[price] = Qualify(price);
    }

    /// <summary>The down payment at a price, keeping the share of the price the request puts down: up to the cent.</summary>
    /// <param name="price">The price.</param>
    /// <param name="share">The down payment as a share of the price (0.05 for 5%).</param>
    public static decimal DownPaymentAt(decimal price, decimal share) => Math.Ceiling(price * share * 100m) / 100m;
}
