using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain;
using MortgageAnalytics.Domain.Affordability;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Application.Services;

/// <summary>
/// Measures the home against a household's income and debts, and finds the most it could pay under each limit: the
/// request priced again at other prices, with the same down payment share, rate and costs, the way the calculator
/// prices a loan.
/// </summary>
internal static class AffordabilityAnalysis
{
    /// <summary>The home's ratios and each limit, or null when the request gives no income.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    /// <param name="qualifyingPayment">The first month's payment of a request with its principal and interest at a rate.</param>
    public static AffordabilityResponse? For(
        AmortizationRequest request, Analysis analysis, Func<AmortizationRequest, decimal, decimal> qualifyingPayment)
    {
        if (request.Affordability is not { } household)
            return null;

        // Found once, from this home's loan-to-value, and held at every price: the share of the price borrowed stays the same.
        var program = analysis.Rates.Program?.Program ?? LoanProgram.Conventional;
        var rate = QualifyingRate.For(
            program, analysis.Rates.Loan.AnnualInterestRate, request.ToAdjustableRate(), request.TermInMonths,
            analysis.Purchase.LoanAmount / analysis.Purchase.HomePrice * 100m);

        var income = Money.Round(household.AnnualIncome / 12m);
        var debts = household.MonthlyDebts;
        var ratios = new DebtToIncome(income, debts, qualifyingPayment(request, rate.Rate));

        // Only the price changes: no extra payments, closing costs or other comparisons, which a lender does not qualify on.
        var share = request.DownPayment / request.HomePrice;
        var plain = request with { ExtraPayments = null, ClosingCosts = null, SellerOffer = null, Affordability = null };
        decimal? Qualify(decimal price)
        {
            // The down payment rounded up to the cent, so it never falls below a program's minimum share.
            var down = Math.Ceiling(price * share * 100m) / 100m;
            try { return qualifyingPayment(plain with { HomePrice = price, DownPayment = down }, rate.Rate); }
            catch (DomainValidationException) { return null; } // no loan at this price: past a county's FHA limit
        }
        var payments = new Dictionary<decimal, decimal?>();
        decimal? PaymentAt(decimal price) =>
            payments.TryGetValue(price, out var payment) ? payment : payments[price] = Qualify(price);

        AffordabilityLimitResponse Measure(DebtToIncomeLimit limit)
        {
            var most = limit.MaxHousingPayment(income, debts);
            return new AffordabilityLimitResponse(
                limit.HousingPercent, limit.TotalPercent, most, MostAffordable.Price(PaymentAt, most, request.HomePrice),
                limit.Allows(income, debts, ratios.HousingPayment));
        }

        return new AffordabilityResponse(
            income, debts, ratios.HousingPayment, ratios.HousingPercent, ratios.TotalPercent,
            Measure(DebtToIncomeLimit.Comfortable),
            Measure(DebtToIncomeLimit.MostAllowed(program)),
            rate.Rate, ToResponse(rate.Basis));
    }

    private static Contracts.QualifyingRateBasis ToResponse(Domain.Affordability.QualifyingRateBasis basis) => basis switch
    {
        Domain.Affordability.QualifyingRateBasis.MostInFirstFiveYears => Contracts.QualifyingRateBasis.MostInFirstFiveYears,
        Domain.Affordability.QualifyingRateBasis.FirstResetOrFullyIndexed => Contracts.QualifyingRateBasis.FirstResetOrFullyIndexed,
        Domain.Affordability.QualifyingRateBasis.StartPlusOnePoint => Contracts.QualifyingRateBasis.StartPlusOnePoint,
        _ => Contracts.QualifyingRateBasis.NoteRate,
    };
}
