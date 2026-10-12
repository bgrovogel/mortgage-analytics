namespace MortgageAnalytics.Domain.Loans;

/// <summary>Who pays a temporary buydown's subsidy, which decides whether it saves the borrower anything.</summary>
public enum BuydownPayer
{
    /// <summary>The seller or builder, as a concession: the borrower pays that much less, all of it interest.</summary>
    Seller = 0,

    /// <summary>The borrower, up front at closing: lower early payments, bought with their own money, so no saving.</summary>
    Borrower = 1,
}
