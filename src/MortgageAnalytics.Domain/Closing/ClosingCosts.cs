using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Closing;

/// <summary>
/// What a buyer pays at closing on top of the down payment, entered the way a Loan Estimate shows it: the fees as
/// totals, and the prepaids and escrow as counts (days of interest, months of escrow) that the loan turns into dollars.
/// </summary>
public sealed record ClosingCosts
{
    /// <summary>The most days of prepaid interest: closing on the first day of a 31-day month.</summary>
    public const int MaxPrepaidInterestDays = 31;

    /// <summary>
    /// The most months of escrow collected at closing: up to a year until the first bill is due, plus the two-month
    /// cushion RESPA allows (12 CFR 1024.17).
    /// </summary>
    public const int MaxEscrowMonths = 14;

    /// <summary>Lenders figure prepaid interest with a 365-day year.</summary>
    private const decimal DaysInYear = 365m;

    /// <summary>Nothing beyond the year of insurance every buyer prepays.</summary>
    public static ClosingCosts None { get; } = new(0m, 0m, 0, 0, 0m);

    /// <summary>Creates the closing costs, rejecting amounts no Loan Estimate could show.</summary>
    /// <param name="loanCosts">The lender's and its services' charges: origination, appraisal, title (section D).</param>
    /// <param name="otherFees">Recording fees and transfer taxes, an owner's title policy, HOA transfer fees (sections E and H).</param>
    /// <param name="prepaidInterestDays">Days of interest from closing to the end of that month.</param>
    /// <param name="escrowMonths">Months of property taxes and insurance that start the escrow account.</param>
    /// <param name="sellerCredits">What the seller or builder pays toward closing costs.</param>
    /// <param name="lenderCredits">What the lender pays toward closing costs.</param>
    /// <exception cref="DomainValidationException">An amount is negative, or a count is beyond its limit.</exception>
    public ClosingCosts(decimal loanCosts, decimal otherFees, int prepaidInterestDays, int escrowMonths, decimal sellerCredits, decimal lenderCredits = 0m)
    {
        if (loanCosts < 0)
            throw new DomainValidationException("Loan costs cannot be negative.");
        if (otherFees < 0)
            throw new DomainValidationException("Other fees cannot be negative.");
        if (prepaidInterestDays is < 0 or > MaxPrepaidInterestDays)
            throw new DomainValidationException($"Prepaid interest is for 0 to {MaxPrepaidInterestDays} days.");
        if (escrowMonths is < 0 or > MaxEscrowMonths)
            throw new DomainValidationException($"Escrow is collected for 0 to {MaxEscrowMonths} months.");
        if (sellerCredits < 0)
            throw new DomainValidationException("Seller credits cannot be negative.");
        if (lenderCredits < 0)
            throw new DomainValidationException("Lender credits cannot be negative.");

        LoanCosts = loanCosts;
        OtherFees = otherFees;
        PrepaidInterestDays = prepaidInterestDays;
        EscrowMonths = escrowMonths;
        SellerCredits = sellerCredits;
        LenderCredits = lenderCredits;
    }

    /// <summary>The lender's and its services' charges (Loan Estimate section D).</summary>
    public decimal LoanCosts { get; }

    /// <summary>Government and other fees (Loan Estimate sections E and H).</summary>
    public decimal OtherFees { get; }

    /// <summary>Days of interest paid at closing, from closing to the end of that month.</summary>
    public int PrepaidInterestDays { get; }

    /// <summary>Months of property taxes and insurance paid into escrow at closing.</summary>
    public int EscrowMonths { get; }

    /// <summary>What the seller or builder pays toward closing costs.</summary>
    public decimal SellerCredits { get; }

    /// <summary>What the lender pays toward closing costs.</summary>
    public decimal LenderCredits { get; }

    /// <summary>
    /// The cash the buyer brings to closing. Each daily and monthly amount is rounded to the cent before it is
    /// multiplied, as a Loan Estimate shows it ("$63.44 per day for 15 days"). Credits pay closing costs only, never
    /// the down payment, so any beyond them go unused; and the seller's are allowed only up to the loan's limit.
    /// </summary>
    /// <param name="purchase">The price and down payment.</param>
    /// <param name="loan">The loan: its amount (with any financed upfront fee) and note rate (an adjustable rate's starting rate).</param>
    /// <param name="yearOneTaxes">The property taxes billed for the first loan year.</param>
    /// <param name="yearOneInsurance">The first year's homeowners insurance premium.</param>
    /// <param name="buydownCost">A temporary buydown's subsidy, when the buyer pays for it; otherwise zero.</param>
    /// <param name="discountPoints">What discount points cost; otherwise zero.</param>
    /// <param name="upfrontMortgageFee">An FHA upfront MIP or VA funding fee paid at closing; otherwise zero.</param>
    /// <param name="sellerBuydown">A temporary buydown's subsidy, when the seller or builder pays for it; otherwise zero.</param>
    /// <param name="program">The loan's program, which sets the limit on what the seller may pay.</param>
    public CashToClose CashToClose(
        PropertyPurchase purchase, LoanTerms loan, decimal yearOneTaxes, decimal yearOneInsurance, decimal buydownCost = 0m,
        decimal discountPoints = 0m, decimal upfrontMortgageFee = 0m, decimal sellerBuydown = 0m, LoanProgram program = LoanProgram.Conventional)
    {
        var dailyInterest = Money.Round(loan.Principal * loan.AnnualInterestRate / 100m / DaysInYear);
        var monthlyEscrow = Money.Round((yearOneTaxes + yearOneInsurance) / 12m);

        return new CashToClose(
            purchase.DownPayment,
            LoanCosts,
            OtherFees,
            dailyInterest,
            PrepaidInterestDays,
            yearOneInsurance,
            monthlyEscrow,
            EscrowMonths,
            buydownCost,
            discountPoints,
            upfrontMortgageFee,
            SellerCredits,
            LenderCredits,
            sellerBuydown,
            ConcessionLimit.For(program, purchase));
    }
}
