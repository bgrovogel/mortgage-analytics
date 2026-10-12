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
/// <param name="CreditsOffered">What the seller and lender offered toward closing costs.</param>
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
    decimal CreditsOffered)
{
    /// <summary>The interest from closing to the end of the month.</summary>
    public decimal PrepaidInterest => DailyInterest * PrepaidInterestDays;

    /// <summary>The deposit that starts the escrow account.</summary>
    public decimal EscrowDeposit => MonthlyEscrow * EscrowMonths;

    /// <summary>Everything paid at closing besides the down payment, before credits.</summary>
    public decimal ClosingCosts => LoanCosts + OtherFees + PrepaidInterest + HomeownersInsurance + EscrowDeposit + BuydownCost;

    /// <summary>The credits used: they pay closing costs, and no more.</summary>
    public decimal Credits => Math.Min(CreditsOffered, ClosingCosts);

    /// <summary>Credits beyond the closing costs, which cannot go toward the down payment.</summary>
    public decimal UnusedCredits => CreditsOffered - Credits;

    /// <summary>The cash the buyer brings to closing.</summary>
    public decimal Total => DownPayment + ClosingCosts - Credits;
}
