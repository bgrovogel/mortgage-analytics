namespace MortgageAnalytics.Domain.Closing;

/// <summary>Everything the buyer pays at closing, line by line, and the total they bring.</summary>
/// <param name="DownPayment">Cash paid toward the price.</param>
/// <param name="LoanCosts">The lender's and its services' charges.</param>
/// <param name="OtherFees">Government and other fees.</param>
/// <param name="DailyInterest">A day's interest on the loan, to the cent.</param>
/// <param name="PrepaidInterestDays">Days of interest paid at closing.</param>
/// <param name="HomeownersInsurance">The first year's insurance premium, prepaid.</param>
/// <param name="MonthlyEscrow">A month of property taxes and insurance, to the cent.</param>
/// <param name="EscrowMonths">Months of it paid into escrow.</param>
/// <param name="BuydownCost">A temporary buydown's subsidy, when the buyer pays for it.</param>
/// <param name="DiscountPoints">What discount points cost.</param>
/// <param name="UpfrontMortgageFee">An FHA upfront MIP or VA funding fee paid at closing rather than financed.</param>
/// <param name="SellerCreditsOffered">What the seller or builder offered toward closing costs.</param>
/// <param name="LenderCreditsOffered">What the lender offered toward closing costs.</param>
/// <param name="SellerBuydown">A temporary buydown's subsidy the seller or builder pays: not the buyer's money, but a concession.</param>
/// <param name="Limit">The most the seller or builder may pay toward the buyer's costs.</param>
public sealed record CashToClose(
    decimal DownPayment,
    decimal LoanCosts,
    decimal OtherFees,
    decimal DailyInterest,
    int PrepaidInterestDays,
    decimal HomeownersInsurance,
    decimal MonthlyEscrow,
    int EscrowMonths,
    decimal BuydownCost,
    decimal DiscountPoints,
    decimal UpfrontMortgageFee,
    decimal SellerCreditsOffered,
    decimal LenderCreditsOffered,
    decimal SellerBuydown,
    ConcessionLimit Limit)
{
    /// <summary>The interest from closing to the end of the month.</summary>
    public decimal PrepaidInterest => DailyInterest * PrepaidInterestDays;

    /// <summary>The deposit that starts the escrow account.</summary>
    public decimal EscrowDeposit => MonthlyEscrow * EscrowMonths;

    /// <summary>Everything paid at closing besides the down payment, before credits.</summary>
    public decimal ClosingCosts => LoanCosts + OtherFees + PrepaidInterest + HomeownersInsurance + EscrowDeposit + BuydownCost + DiscountPoints + UpfrontMortgageFee;

    /// <summary>The closing costs VA lets the seller pay besides its limit: the fees, the prepaid interest and the points.</summary>
    private decimal NormalClosingCosts => LoanCosts + OtherFees + PrepaidInterest + DiscountPoints;

    /// <summary>The lender's credits used: they pay closing costs first, and no more than them.</summary>
    public decimal LenderCredits => Math.Min(LenderCreditsOffered, ClosingCosts);

    /// <summary>The seller's credits the closing costs have room for, after the lender's.</summary>
    private decimal SellerCreditsWithinCosts => Math.Min(SellerCreditsOffered, ClosingCosts - LenderCredits);

    /// <summary>The seller's credits that VA leaves out of the limit, because they pay normal closing costs.</summary>
    private decimal SellerCreditsOutsideLimit => Limit.ExcludesNormalClosingCosts ? Math.Min(SellerCreditsWithinCosts, NormalClosingCosts) : 0m;

    /// <summary>What the seller or builder pays that counts against the limit: their buydown, and their credits the costs can take.</summary>
    public decimal Concessions => SellerBuydown + SellerCreditsWithinCosts - SellerCreditsOutsideLimit;

    /// <summary>How far the concessions go beyond the limit: the lender does not let that much of the seller's credits pay costs.</summary>
    public decimal ConcessionsOverLimit => Math.Max(0m, Concessions - Limit.Amount);

    /// <summary>The seller's credits used: within the closing costs and the limit.</summary>
    public decimal SellerCredits =>
        SellerCreditsWithinCosts - Math.Min(ConcessionsOverLimit, SellerCreditsWithinCosts - SellerCreditsOutsideLimit);

    /// <summary>All the credits used.</summary>
    public decimal Credits => LenderCredits + SellerCredits;

    /// <summary>Credits beyond the closing costs, which cannot go toward the down payment.</summary>
    public decimal UnusedCredits => LenderCreditsOffered - LenderCredits + SellerCreditsOffered - SellerCreditsWithinCosts;

    /// <summary>The cash the buyer brings to closing.</summary>
    public decimal Total => DownPayment + ClosingCosts - Credits;
}
