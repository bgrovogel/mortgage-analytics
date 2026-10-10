namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>
/// One recurring cost of owning the home (a tax, an assessment, insurance or dues).
/// A new kind of cost is added by implementing this interface; nothing else changes (Open/Closed).
/// </summary>
public interface IHousingCost
{
    /// <summary>The category this cost is reported under.</summary>
    HousingCostCategory Category { get; }

    /// <summary>Returns the amount due for one monthly payment period, rounded to cents.</summary>
    /// <param name="period">The payment number and the loan balance at the start of that period.</param>
    decimal AmountFor(CostPeriod period);
}

/// <summary>What a housing cost may need to know about the month it is being charged for.</summary>
/// <param name="PaymentNumber">The 1-based payment number.</param>
/// <param name="OpeningBalance">The actual loan balance before this period's payment, after any extra payments so far.</param>
/// <param name="ScheduledOpeningBalance">
/// The balance the <i>original</i> amortization schedule (no extra payments) shows for this payment.
/// Automatic PMI termination is based on this figure, not on the actual balance.
/// </param>
public readonly record struct CostPeriod(int PaymentNumber, decimal OpeningBalance, decimal ScheduledOpeningBalance);
