using MortgageAnalytics.Domain.Amortization;
using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// FHA's annual mortgage insurance premium, charged monthly. Each loan year it is a twelfth of the annual rate on that
/// year's average balance on the <i>original</i> schedule (the loan at its starting rate, no extra payments), as HUD
/// computes it, so extra payments do not lower it. It is charged for 11 years at 90% LTV or less, otherwise for the
/// whole term; paying the loan off ends it, which is how extra payments save MIP.
/// </summary>
public sealed class FhaMortgageInsurance : IHousingCost
{
    private readonly decimal[] _monthlyByYear;
    private readonly int _lastPayment;

    /// <summary>Works out each year's monthly premium from the original schedule.</summary>
    /// <param name="loan">The FHA loan, with its annual rate and how many payments carry it.</param>
    /// <param name="originalSchedule">The loan's standard schedule at its starting rate.</param>
    public FhaMortgageInsurance(GovernmentLoan loan, AmortizationSchedule originalSchedule)
    {
        var openings = originalSchedule.Payments.Select(p => p.OpeningBalance).ToList();
        _monthlyByYear = [.. openings.Chunk(12).Select(year =>
            Money.Round(Money.Round(year.Sum() / year.Length * loan.AnnualMipPercent / 100m) / 12m))];
        _lastPayment = loan.MipPayments;
    }

    /// <inheritdoc />
    public HousingCostCategory Category => HousingCostCategory.MortgageInsurance;

    /// <inheritdoc />
    public decimal AmountFor(CostPeriod period) =>
        period.PaymentNumber <= _lastPayment ? _monthlyByYear[(period.PaymentNumber - 1) / 12] : 0m;
}
