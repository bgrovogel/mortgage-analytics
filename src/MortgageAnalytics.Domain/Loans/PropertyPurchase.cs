namespace MortgageAnalytics.Domain.Loans;

/// <summary>
/// A home purchase: the price and the down payment. Everything that depends on how much was
/// put down (loan amount, loan-to-value, whether PMI applies) is derived here, in one place.
/// </summary>
public sealed record PropertyPurchase
{
    /// <summary>The loan-to-value percentage above which conventional lenders require PMI.</summary>
    public const decimal MortgageInsuranceRequiredAboveLoanToValue = 80m;

    /// <summary>Creates a purchase, rejecting a down payment that is negative or covers the whole price.</summary>
    /// <param name="homePrice">The purchase price, also used as the value for taxes and PMI.</param>
    /// <param name="downPayment">Cash paid up front, in dollars.</param>
    /// <exception cref="DomainValidationException">The price is not positive, or the down payment is negative or leaves nothing to borrow.</exception>
    public PropertyPurchase(decimal homePrice, decimal downPayment)
    {
        if (homePrice <= 0)
            throw new DomainValidationException("Home price must be greater than zero.");
        if (downPayment < 0)
            throw new DomainValidationException("Down payment cannot be negative.");
        if (downPayment >= homePrice)
            throw new DomainValidationException("Down payment must be less than the home price, or there is no loan.");

        HomePrice = homePrice;
        DownPayment = downPayment;
    }

    /// <summary>The purchase price, in dollars.</summary>
    public decimal HomePrice { get; }

    /// <summary>Cash paid up front, in dollars.</summary>
    public decimal DownPayment { get; }

    /// <summary>How the buyer will use the home: a principal residence unless said otherwise.</summary>
    public Occupancy Occupancy { get; init; } = Occupancy.PrimaryResidence;

    /// <summary>The amount borrowed: price minus down payment.</summary>
    public decimal LoanAmount => HomePrice - DownPayment;

    /// <summary>
    /// The down payment as a percentage of the price, truncated (not rounded) to two decimal places,
    /// so 19.996% shows as 19.99% and never contradicts <see cref="RequiresMortgageInsurance"/>.
    /// </summary>
    public decimal DownPaymentPercent => decimal.Truncate(DownPayment / HomePrice * 10_000m) / 100m;

    /// <summary>The loan as a percentage of the price (loan-to-value), to two decimal places.</summary>
    public decimal LoanToValuePercent => 100m - DownPaymentPercent;

    /// <summary>True when less than 20% is put down, so a conventional loan needs PMI.</summary>
    public bool RequiresMortgageInsurance => LoanAmount > HomePrice * MortgageInsuranceRequiredAboveLoanToValue / 100m;
}
