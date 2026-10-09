using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>How PMI comes off the loan.</summary>
public enum MortgageInsuranceCancellation
{
    /// <summary>The servicer removes it automatically at 78% loan-to-value (Homeowners Protection Act).</summary>
    Automatic = 0,

    /// <summary>The borrower asks for removal at 80% loan-to-value, which ends it a little sooner.</summary>
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
/// </list>
/// The cancellation test uses the <i>actual</i> balance, so extra payments end PMI sooner. That is
/// where the comparison's PMI savings come from.
/// </remarks>
public sealed class MortgageInsurance : IHousingCost
{
    private readonly decimal _cancellationBalance;

    /// <summary>Creates PMI for <paramref name="purchase"/>.</summary>
    /// <param name="annualRatePercent">The annual premium as a percentage of the original loan (0.5 means 0.5%).</param>
    /// <param name="purchase">The purchase, which supplies the loan amount and the home's value.</param>
    /// <param name="cancellation">Whether PMI is removed automatically (78%) or on the borrower's request (80%).</param>
    /// <exception cref="DomainValidationException">The rate is negative.</exception>
    public MortgageInsurance(
        decimal annualRatePercent,
        PropertyPurchase purchase,
        MortgageInsuranceCancellation cancellation = MortgageInsuranceCancellation.Automatic)
    {
        HousingCostGuard.AgainstNegative(annualRatePercent, nameof(annualRatePercent));

        CancelAtLoanToValue = cancellation == MortgageInsuranceCancellation.BorrowerRequested ? 80m : 78m;
        IsRequired = purchase.RequiresMortgageInsurance;
        MonthlyPremium = IsRequired ? Money.Round(purchase.LoanAmount * annualRatePercent / 100m / 12m) : 0m;
        _cancellationBalance = purchase.HomePrice * CancelAtLoanToValue / 100m;
    }

    /// <inheritdoc />
    public HousingCostCategory Category => HousingCostCategory.MortgageInsurance;

    /// <summary>The loan-to-value percentage at which PMI is removed: 78 (automatic) or 80 (requested).</summary>
    public decimal CancelAtLoanToValue { get; }

    /// <summary>True when the down payment is small enough that PMI applies at all.</summary>
    public bool IsRequired { get; }

    /// <summary>The monthly charge while PMI is in force. Zero when it is not required.</summary>
    public decimal MonthlyPremium { get; }

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) => period.OpeningBalance > _cancellationBalance ? MonthlyPremium : 0m;
}
