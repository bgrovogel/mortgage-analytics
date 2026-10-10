namespace MortgageAnalytics.Testing;

/// <summary>
/// Known-good scenarios and their expected results, shared by every test layer.
/// </summary>
/// <remarks>
/// Every value was computed by an independent Python <c>Decimal</c> implementation, using the same rounding
/// rules, and the standard payments were checked against published mortgage tables. They were never copied
/// from this code's own output. Change one only after re-deriving it independently.
/// </remarks>
public static class ReferenceLoans
{
    /// <summary>The first payment date used by every reference scenario.</summary>
    public static readonly DateOnly FirstPaymentDate = new(2026, 1, 1);

    /// <summary>$250,000 home with 20% down: a $200,000 loan at 6% over 30 years. No PMI.</summary>
    public static class Standard
    {
        /// <summary>Purchase price.</summary>
        public const decimal HomePrice = 250_000m;

        /// <summary>Down payment (20%).</summary>
        public const decimal DownPayment = 50_000m;

        /// <summary>Amount borrowed.</summary>
        public const decimal LoanAmount = 200_000m;

        /// <summary>Annual interest rate, as a percentage.</summary>
        public const decimal AnnualInterestRate = 6m;

        /// <summary>Loan term in months.</summary>
        public const int TermInMonths = 360;

        /// <summary>Principal and interest each month.</summary>
        public const decimal MonthlyPayment = 1_199.10m;

        /// <summary>Interest in the first month: $200,000 × 0.5%.</summary>
        public const decimal FirstInterest = 1_000.00m;

        /// <summary>Principal repaid by the first payment.</summary>
        public const decimal FirstPrincipal = 199.10m;

        /// <summary>The final payment, which absorbs rounding drift.</summary>
        public const decimal FinalPayment = 1_200.14m;

        /// <summary>All interest over 360 payments.</summary>
        public const decimal TotalInterest = 231_677.04m;

        /// <summary>Due date of the 360th payment.</summary>
        public static readonly DateOnly PayoffDate = new(2055, 12, 1);
    }

    /// <summary>The <see cref="Standard"/> loan plus $200 extra every month.</summary>
    public static class StandardWithMonthlyExtra200
    {
        /// <summary>Extra principal each month.</summary>
        public const decimal MonthlyExtra = 200m;

        /// <summary>Payments needed to clear the loan.</summary>
        public const int NumberOfPayments = 252;

        /// <summary>All interest paid.</summary>
        public const decimal TotalInterest = 151_876.18m;

        /// <summary>Interest avoided compared with <see cref="Standard"/>.</summary>
        public const decimal InterestSaved = 79_800.86m;

        /// <summary>Payments avoided compared with <see cref="Standard"/>.</summary>
        public const int PaymentsSaved = 108;

        /// <summary>Due date of the final payment.</summary>
        public static readonly DateOnly PayoffDate = new(2046, 12, 1);
    }

    /// <summary>The <see cref="Standard"/> loan with a $50,000 lump sum at payment 12, then recast.</summary>
    public static class StandardRecastAfter50KLumpSum
    {
        /// <summary>The lump sum.</summary>
        public const decimal LumpSum = 50_000m;

        /// <summary>The payment the lump sum is made with.</summary>
        public const int LumpSumPaymentNumber = 12;

        /// <summary>Principal and interest after the recast.</summary>
        public const decimal NewPayment = 895.60m;

        /// <summary>All interest paid.</summary>
        public const decimal TotalInterest = 176_056.85m;
    }

    /// <summary>$250,000 home with 5% down: a $237,500 loan at 6.5% over 30 years, with 0.5% PMI.</summary>
    public static class FivePercentDown
    {
        /// <summary>Purchase price.</summary>
        public const decimal HomePrice = 250_000m;

        /// <summary>Down payment (5%).</summary>
        public const decimal DownPayment = 12_500m;

        /// <summary>Amount borrowed.</summary>
        public const decimal LoanAmount = 237_500m;

        /// <summary>Annual interest rate, as a percentage.</summary>
        public const decimal AnnualInterestRate = 6.5m;

        /// <summary>Annual PMI rate, as a percentage of the original loan.</summary>
        public const decimal PmiRate = 0.5m;

        /// <summary>PMI each month: 0.5% × $237,500 ÷ 12, rounded.</summary>
        public const decimal MonthlyPmi = 98.96m;

        /// <summary>Last payment with PMI when it is removed automatically at 78%.</summary>
        public const int PmiLastPayment = 135;

        /// <summary>All PMI paid when it is removed automatically at 78%.</summary>
        public const decimal PmiTotal = 13_359.60m;

        /// <summary>Last payment with PMI when the borrower requests removal at 80%.</summary>
        public const int BorrowerRequestedPmiLastPayment = 124;

        /// <summary>All PMI paid when the borrower requests removal at 80%.</summary>
        public const decimal BorrowerRequestedPmiTotal = 12_271.04m;

        /// <summary>
        /// Last payment with PMI when $300 extra is paid every month and the borrower requests removal at 80%.
        /// Requested removal may use the actual balance, so the extra payments bring it forward from 124.
        /// (Automatic removal follows the original schedule, so extra payments do not change it.)
        /// </summary>
        public const int BorrowerRequestedPmiLastPaymentWith300Extra = 62;

        /// <summary>All PMI paid when $300 extra is paid every month and removal is requested at 80%.</summary>
        public const decimal BorrowerRequestedPmiTotalWith300Extra = 6_135.52m;
    }
}
