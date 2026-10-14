using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Testing.Builders;

/// <summary>
/// Fluent builder for <see cref="AmortizationRequest"/>. It starts from <see cref="ReferenceLoans.Standard"/>,
/// so a test states only what makes its scenario different.
/// </summary>
/// <example><code>var request = A.Request.FivePercentDown().WithMonthlyExtra(300).Build();</code></example>
public sealed class AmortizationRequestBuilder
{
    private AmortizationRequest _request = new()
    {
        HomePrice = ReferenceLoans.Standard.HomePrice,
        DownPayment = ReferenceLoans.Standard.DownPayment,
        AnnualInterestRate = ReferenceLoans.Standard.AnnualInterestRate,
        TermInMonths = ReferenceLoans.Standard.TermInMonths,
        FirstPaymentDate = ReferenceLoans.FirstPaymentDate,
    };

    private ExtraPaymentsRequest? _extras;

    /// <summary>Switches to <see cref="ReferenceLoans.FivePercentDown"/>: 5% down at 6.5%, which needs PMI.</summary>
    public AmortizationRequestBuilder FivePercentDown() =>
        With(r => r with
        {
            HomePrice = ReferenceLoans.FivePercentDown.HomePrice,
            DownPayment = ReferenceLoans.FivePercentDown.DownPayment,
            AnnualInterestRate = ReferenceLoans.FivePercentDown.AnnualInterestRate,
        });

    /// <summary>Sets the purchase price.</summary>
    public AmortizationRequestBuilder WithHomePrice(decimal homePrice) => With(r => r with { HomePrice = homePrice });

    /// <summary>Sets the down payment.</summary>
    public AmortizationRequestBuilder WithDownPayment(decimal downPayment) => With(r => r with { DownPayment = downPayment });

    /// <summary>Sets the annual interest rate, as a percentage.</summary>
    public AmortizationRequestBuilder WithRate(decimal annualInterestRate) => With(r => r with { AnnualInterestRate = annualInterestRate });

    /// <summary>Sets the term in months.</summary>
    public AmortizationRequestBuilder WithTermInMonths(int months) => With(r => r with { TermInMonths = months });

    /// <summary>Sets the first payment date; null asks the API for its default.</summary>
    public AmortizationRequestBuilder WithFirstPaymentDate(DateOnly? date) => With(r => r with { FirstPaymentDate = date });

    /// <summary>Sets the extra-payment strategy directly, without recast terms.</summary>
    public AmortizationRequestBuilder WithStrategy(ExtraPaymentStrategy strategy) => With(r => r with { Strategy = strategy });

    /// <summary>Chooses <see cref="ExtraPaymentStrategy.Recast"/> with the given lender terms.</summary>
    public AmortizationRequestBuilder WithRecast(decimal minimumLumpSum = 10_000m, decimal fee = 250m) =>
        With(r => r with
        {
            Strategy = ExtraPaymentStrategy.Recast,
            Recast = new RecastTermsRequest { MinimumLumpSum = minimumLumpSum, Fee = fee },
        });

    /// <summary>Sets recast terms without changing the strategy, to test that they are ignored.</summary>
    public AmortizationRequestBuilder WithRecastTerms(decimal minimumLumpSum, decimal fee) =>
        With(r => r with { Recast = new RecastTermsRequest { MinimumLumpSum = minimumLumpSum, Fee = fee } });

    /// <summary>Adds a recurring monthly extra payment.</summary>
    public AmortizationRequestBuilder WithMonthlyExtra(decimal amount, int startingPaymentNumber = 1) =>
        WithExtras(e => e with { MonthlyAmount = amount, MonthlyStartingPaymentNumber = startingPaymentNumber });

    /// <summary>Adds a once-a-year extra payment.</summary>
    public AmortizationRequestBuilder WithAnnualExtra(decimal amount, int firstPaymentNumber = 12) =>
        WithExtras(e => e with { Annual = new AnnualExtraPaymentRequest(amount, firstPaymentNumber) });

    /// <summary>Adds a one-time lump sum.</summary>
    public AmortizationRequestBuilder WithLumpSum(int paymentNumber, decimal amount) =>
        WithExtras(e => e with { LumpSums = [.. e.LumpSums, new LumpSumPaymentRequest(paymentNumber, amount)] });

    /// <summary>Replaces the lump sums with exactly <paramref name="lumpSums"/>.</summary>
    public AmortizationRequestBuilder WithLumpSums(IReadOnlyList<LumpSumPaymentRequest> lumpSums) =>
        WithExtras(e => e with { LumpSums = lumpSums });

    /// <summary>Includes an extra-payments section with every amount zero, to test that it is treated as none.</summary>
    public AmortizationRequestBuilder WithEmptyExtras() => WithExtras(e => e);

    /// <summary>Adds housing costs, configured through a <see cref="HousingCostsRequestBuilder"/>.</summary>
    public AmortizationRequestBuilder WithHousingCosts(Func<HousingCostsRequestBuilder, HousingCostsRequestBuilder> configure) =>
        With(r => r with { HousingCosts = configure(new HousingCostsRequestBuilder()).Build() });

    /// <summary>Adds a temporary buydown: <c>WithBuydown(2, 1)</c> is a 2-1 buydown.</summary>
    public AmortizationRequestBuilder WithBuydown(params decimal[] yearlyReductions) =>
        With(r => r with { Buydown = new TemporaryBuydownRequest { YearlyReductions = yearlyReductions } });

    /// <summary>Says who pays for the buydown's subsidy (the seller or builder, unless set).</summary>
    public AmortizationRequestBuilder WithBuydownPaidBy(BuydownFunding paidBy) =>
        With(r => r with { BuydownPaidBy = paidBy });

    /// <summary>Makes the rate adjustable: a 7/1 ARM by default, resetting toward <paramref name="expectedRate"/> within 5/2/5 caps.</summary>
    public AmortizationRequestBuilder WithAdjustableRate(
        decimal expectedRate, int initialFixedMonths = 84, int intervalMonths = 12, decimal initialCap = 5m, decimal periodicCap = 2m, decimal lifetimeCap = 5m) =>
        With(r => r with
        {
            AdjustableRate = new AdjustableRateRequest
            {
                InitialFixedMonths = initialFixedMonths, AdjustmentIntervalMonths = intervalMonths, ExpectedRate = expectedRate,
                InitialCap = initialCap, PeriodicCap = periodicCap, LifetimeCap = lifetimeCap,
            },
        });

    /// <summary>Makes the loan FHA or VA (conventional unless set), with its funding-fee use and whether the upfront fee is financed.</summary>
    public AmortizationRequestBuilder WithProgram(
        LoanProgramType type, VaFundingFeeType? vaUse = null, bool financeUpfrontFee = true, int? creditScore = null, string? countyFips = null) =>
        With(r => r with
        {
            Program = new LoanProgramRequest
            {
                Type = type, VaUse = vaUse, FinanceUpfrontFee = financeUpfrontFee, CreditScore = creditScore, CountyFips = countyFips,
            },
        });

    /// <summary>Pays <paramref name="points"/> discount points for the request's rate, against <paramref name="rateWithoutPoints"/> without them.</summary>
    public AmortizationRequestBuilder WithDiscountPoints(decimal points, decimal rateWithoutPoints) =>
        With(r => r with { DiscountPoints = new DiscountPointsRequest { Points = points, RateWithoutPoints = rateWithoutPoints } });

    /// <summary>
    /// Adds closing costs: by default $4,000 of loan costs, $1,000 of other fees, 15 days of interest and 3 months of
    /// escrow. <paramref name="credits"/> are the seller's.
    /// </summary>
    public AmortizationRequestBuilder WithClosingCosts(
        decimal loanCosts = 4_000m, decimal otherFees = 1_000m, int prepaidInterestDays = 15, int escrowMonths = 3, decimal credits = 0m,
        decimal lenderCredits = 0m) =>
        With(r => r with
        {
            ClosingCosts = new ClosingCostsRequest
            {
                LoanCosts = loanCosts, OtherFees = otherFees, PrepaidInterestDays = prepaidInterestDays, EscrowMonths = escrowMonths, Credits = credits,
                LenderCredits = lenderCredits,
            },
        });

    /// <summary>Asks for the ways to take the seller's offer, costed over <paramref name="yearsKept"/> with <paramref name="rateCutPerPoint"/> a point.</summary>
    public AmortizationRequestBuilder WithSellerOffer(int yearsKept = 7, decimal rateCutPerPoint = 0.25m) =>
        With(r => r with { SellerOffer = new SellerOfferRequest { YearsKept = yearsKept, RateCutPerPoint = rateCutPerPoint } });

    /// <summary>Builds the request.</summary>
    public AmortizationRequest Build() => _extras is null ? _request : _request with { ExtraPayments = _extras };

    /// <summary>Lets tests convert a builder to a request without calling <see cref="Build"/>.</summary>
    public static implicit operator AmortizationRequest(AmortizationRequestBuilder builder) => builder.Build();

    private AmortizationRequestBuilder With(Func<AmortizationRequest, AmortizationRequest> change)
    {
        _request = change(_request);
        return this;
    }

    private AmortizationRequestBuilder WithExtras(Func<ExtraPaymentsRequest, ExtraPaymentsRequest> change)
    {
        _extras = change(_extras ?? new ExtraPaymentsRequest());
        return this;
    }
}
