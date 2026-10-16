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

        // A lender counts everyone on the loan together: the first buyer's income and debts, and each co-buyer's.
        var income = Money.Round((household.AnnualIncome + household.CoBuyers.Sum(c => c.AnnualIncome)) / 12m);
        var debts = household.MonthlyDebts + household.CoBuyers.Sum(c => c.MonthlyDebts);
        var ratios = new DebtToIncome(income, debts, qualifyingPayment(request, rate.Rate));

        var paymentAt = PricedPayments.At(request, rate.Rate, qualifyingPayment);
        decimal? PaymentAt(decimal price) => paymentAt(price);

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
            rate.Rate, ToResponse(rate.Basis),
            household.CoBuyers.Count == 0 ? null : BuyersOf(household, analysis.Purchase.DownPayment, qualifyingPayment(request, analysis.Rates.Loan.AnnualInterestRate)));
    }

    /// <summary>
    /// Each buyer, the first first: their own income and debts, their share of the down payment (the first buyer's is
    /// what the co-buyers leave) and their share of the first month's payment, in proportion to income.
    /// </summary>
    private static List<BuyerResponse> BuyersOf(AffordabilityRequest household, decimal downPayment, decimal payment)
    {
        var incomes = new[] { household.AnnualIncome }.Concat(household.CoBuyers.Select(c => c.AnnualIncome)).ToList();
        var debts = new[] { household.MonthlyDebts }.Concat(household.CoBuyers.Select(c => c.MonthlyDebts)).ToList();
        var coPercents = household.CoBuyers.Select(c => c.DownPaymentPercent).ToList();
        var percents = new[] { 100m - coPercents.Sum() }.Concat(coPercents).ToList();

        // The co-buyers' shares are rounded to the cent; the first buyer puts in what is left, so the shares add up.
        var coDownPayments = coPercents.Select(percent => Money.Round(downPayment * percent / 100m)).ToList();
        var downPayments = new[] { downPayment - coDownPayments.Sum() }.Concat(coDownPayments).ToList();

        var payments = PaymentSplit.ByIncome(payment, incomes);
        return incomes.Select((annual, i) => new BuyerResponse(Money.Round(annual / 12m), debts[i], percents[i], downPayments[i], payments[i])).ToList();
    }

    private static Contracts.QualifyingRateBasis ToResponse(Domain.Affordability.QualifyingRateBasis basis) => basis switch
    {
        Domain.Affordability.QualifyingRateBasis.MostInFirstFiveYears => Contracts.QualifyingRateBasis.MostInFirstFiveYears,
        Domain.Affordability.QualifyingRateBasis.FirstResetOrFullyIndexed => Contracts.QualifyingRateBasis.FirstResetOrFullyIndexed,
        Domain.Affordability.QualifyingRateBasis.StartPlusOnePoint => Contracts.QualifyingRateBasis.StartPlusOnePoint,
        _ => Contracts.QualifyingRateBasis.NoteRate,
    };
}
