using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Closing;
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

/// <summary>
/// Takes the seller's or builder's offer each way it can be: off the price, toward the closing costs, for a 2-1
/// buydown, or for discount points. Each way is the request analyzed again as it would be, so it is priced exactly as
/// the calculator prices a loan, and costed over the years the buyer keeps it.
/// </summary>
internal static class SellerOfferComparison
{
    private static readonly TemporaryBuydownRequest TwoOne = new() { YearlyReductions = [2m, 1m] };

    /// <summary>The ways to take the offer, or null when the request does not ask, or offers nothing.</summary>
    /// <param name="request">The request as made.</param>
    /// <param name="analysis">The request analyzed.</param>
    /// <param name="analyze">Analyzes another request.</param>
    public static SellerOfferResponse? For(AmortizationRequest request, Analysis analysis, Func<AmortizationRequest, Analysis> analyze)
    {
        if (request is not { SellerOffer: { } weighing, ClosingCosts: { } closing, AdjustableRate: null, DiscountPoints: null })
            return null;

        var sellersBuydown = analysis.Rates is { Buydown: { } buydown, BuydownPaidBy: BuydownPayer.Seller } rates
            ? buydown.TotalSubsidy(rates.Loan, analysis.Comparison.Baseline)
            : 0m;
        var offer = closing.Credits + sellersBuydown;
        if (offer == 0m)
            return null;

        // Each way starts from the loan as it would be without the offer: no seller's credits or buydown, and no extra payments.
        var plain = request with { ExtraPayments = null, Buydown = null, SellerOffer = null, ClosingCosts = closing with { Credits = 0m } };
        AmortizationRequest WithCredits(AmortizationRequest r, decimal credits) => r with { ClosingCosts = closing with { Credits = credits } };
        SellerOfferOptionResponse Way(SellerOfferUse use, AmortizationRequest r, Func<Analysis, CashToClose>? cash = null)
        {
            var a = analyze(r);
            return ToResponse(use, a, cash?.Invoke(a) ?? MappedCashToClose(r, a), offer, weighing.YearsKept);
        }

        var ways = new List<SellerOfferOptionResponse>();
        if (request.HomePrice - offer > request.DownPayment)
            ways.Add(Way(SellerOfferUse.PriceCut, plain with { HomePrice = request.HomePrice - offer }));

        var credited = WithCredits(plain, offer);
        var toClosingCosts = Way(SellerOfferUse.ClosingCosts, credited);
        ways.Add(toClosingCosts);

        // The buydown and the points are on the request's own purchase, so its limit holds them.
        var limit = ConcessionLimit.For(analysis.Rates.Program?.Program ?? LoanProgram.Conventional, analysis.Purchase);
        ways.Add(Way(SellerOfferUse.TemporaryBuydown, plain with { Buydown = TwoOne, BuydownPaidBy = BuydownFunding.Seller }, a =>
        {
            var subsidy = a.Rates.Buydown!.TotalSubsidy(a.Rates.Loan, a.Comparison.Baseline);
            var share = SellerOffer.BuydownShare(offer, subsidy, limit);
            return AmortizationMapper.CashToCloseFor(WithCredits(plain, offer - share).ToClosingCosts()!, a.Purchase, a.Comparison, a.Rates, subsidy - share, share);
        }));

        var points = SellerOffer.PointsFor(offer, analysis.Rates.Loan.Principal, limit);
        if (points > 0m)
        {
            ways.Add(Way(SellerOfferUse.DiscountPoints, credited with
            {
                AnnualInterestRate = SellerOffer.RateWithPoints(request.AnnualInterestRate, points, weighing.RateCutPerPoint),
                DiscountPoints = new DiscountPointsRequest { Points = points, RateWithoutPoints = request.AnnualInterestRate },
            }));
        }

        return new SellerOfferResponse(offer, weighing.YearsKept, weighing.RateCutPerPoint, ways, ways.MinBy(w => w.Cost)!.Use);
    }

    private static CashToClose MappedCashToClose(AmortizationRequest request, Analysis a) =>
        AmortizationMapper.CashToCloseFor(request.ToClosingCosts()!, a.Purchase, a.Comparison, a.Rates);

    private static SellerOfferOptionResponse ToResponse(SellerOfferUse use, Analysis a, CashToClose cash, decimal offer, int yearsKept)
    {
        var (schedule, costs, loan) = (a.Comparison.Baseline, a.Comparison.BaselineCosts, a.Rates.Loan);
        var cost = OwnershipCost.Over(yearsKept, cash.Total, loan, schedule, costs, a.Rates.Buydown);
        var first = schedule.Payments[0];
        var later = first.TotalPaid + costs.Periods[0].Total;

        return new SellerOfferOptionResponse(
            use,
            a.Purchase.HomePrice,
            loan.Principal,
            loan.AnnualInterestRate,
            a.Rates.Points?.Points ?? 0m,
            later - (a.Rates.Buydown?.SubsidyFor(loan, first.PaymentNumber, first.ScheduledAmount) ?? 0m),
            later,
            cash.Total,
            cost.Payments,
            cost.Balance,
            cost.Total,
            use == SellerOfferUse.PriceCut ? 0m : offer - cash.SellerCredits - cash.SellerBuydown);
    }
}
