using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>How PMI comes off the loan, under the Homeowners Protection Act.</summary>
public enum MortgageInsuranceCancellation
{
    /// <summary>
    /// The servicer removes it automatically when the <i>original</i> amortization schedule reaches 78%
    /// loan-to-value. Extra payments do not bring this date forward.
    /// </summary>
    Automatic = 0,

    /// <summary>
    /// The borrower asks for removal at 80% loan-to-value, which may be based on the <i>actual</i> balance,
    /// so extra payments bring it forward.
    /// </summary>
    BorrowerRequested = 1,
}

/// <summary>Borrower-paid private mortgage insurance (PMI) on a conventional loan.</summary>
/// <remarks>
/// Rules applied:
/// <list type="bullet">
///   <item>PMI is required only when <see cref="PropertyPurchase.RequiresMortgageInsurance"/> (less than 20% down).</item>
///   <item>The premium is a flat annual rate on the <i>original</i> loan amount, charged monthly.</item>
///   <item>It stops once the balance falls to <see cref="CancelAtLoanToValue"/>% of the original value.
///         The balance never rises, so PMI never comes back.</item>
///   <item>Which balance is tested depends on <see cref="MortgageInsuranceCancellation"/>: automatic removal
///         uses the original schedule's balance, a borrower's request uses the actual balance.</item>
///   <item>Either way it ends at the loan's midpoint (payment 180 of 360) whatever the balance: the Act's final
///         termination, which matters at high rates, where the balance falls slowly.</item>
/// </list>
/// So extra payments save PMI only when the borrower requests removal. That is where the comparison's
/// PMI savings come from.
/// </remarks>
public sealed class MortgageInsurance : IHousingCost
{
    private readonly decimal _cancellationBalance;

    /// <summary>Creates PMI for <paramref name="purchase"/>.</summary>
    /// <param name="annualRatePercent">The annual premium as a percentage of the original loan (0.5 means 0.5%).</param>
    /// <param name="purchase">The purchase, which supplies the loan amount and the home's value.</param>
    /// <param name="cancellation">Whether PMI is removed automatically (78%) or on the borrower's request (80%).</param>
    /// <param name="termInMonths">The loan's term, whose midpoint ends PMI at the latest; null not to apply it.</param>
    /// <exception cref="DomainValidationException">The rate is negative.</exception>
    public MortgageInsurance(
        decimal annualRatePercent,
        PropertyPurchase purchase,
        MortgageInsuranceCancellation cancellation = MortgageInsuranceCancellation.Automatic,
        int? termInMonths = null)
    {
        HousingCostGuard.AgainstNegative(annualRatePercent, nameof(annualRatePercent));

        Cancellation = cancellation;
        CancelAtLoanToValue = cancellation == MortgageInsuranceCancellation.BorrowerRequested ? 80m : 78m;
        IsRequired = purchase.RequiresMortgageInsurance;
        MonthlyPremium = IsRequired ? Money.Round(purchase.LoanAmount * annualRatePercent / 100m / 12m) : 0m;
        _cancellationBalance = purchase.HomePrice * CancelAtLoanToValue / 100m;
        LastPayment = termInMonths is { } term ? (term + 1) / 2 : int.MaxValue;
    }

    /// <inheritdoc />
    public HousingCostCategory Category => HousingCostCategory.MortgageInsurance;

    /// <summary>How PMI is removed, which decides whether extra payments bring removal forward.</summary>
    public MortgageInsuranceCancellation Cancellation { get; }

    /// <summary>The loan-to-value percentage at which PMI is removed: 78 (automatic) or 80 (requested).</summary>
    public decimal CancelAtLoanToValue { get; }

    /// <summary>True when the down payment is small enough that PMI applies at all.</summary>
    public bool IsRequired { get; }

    /// <summary>The monthly charge while PMI is in force. Zero when it is not required.</summary>
    public decimal MonthlyPremium { get; }

    /// <summary>The last payment PMI can be charged with: the loan's midpoint, rounded up for an odd term.</summary>
    public int LastPayment { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period)
    {
        var balance = Cancellation == MortgageInsuranceCancellation.Automatic
            ? period.ScheduledOpeningBalance
            : period.OpeningBalance;

        return period.PaymentNumber <= LastPayment && balance > _cancellationBalance ? MonthlyPremium : 0m;
    }
}
