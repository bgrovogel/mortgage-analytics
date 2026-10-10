namespace MortgageAnalytics.Testing;

/// <summary>
/// Known-good refinance scenarios. Like <see cref="ReferenceLoans"/>, every value was computed by an
/// independent Python <c>Decimal</c> implementation with the same rounding rules, never copied from this code.
/// All scenarios start with the next payment on <see cref="ReferenceLoans.FirstPaymentDate"/>.
/// </summary>
public static class ReferenceRefinances
{
    /// <summary>The loan today: $300,000 left at 7%, with 300 payments (25 years) to go.</summary>
    public static class Current
    {
        /// <summary>The balance still owed.</summary>
        public const decimal Balance = 300_000m;

        /// <summary>Annual interest rate, as a percentage.</summary>
        public const decimal AnnualInterestRate = 7m;

        /// <summary>Payments left.</summary>
        public const int RemainingTermInMonths = 300;

        /// <summary>Principal and interest each month.</summary>
        public const decimal MonthlyPayment = 2_120.34m;

        /// <summary>All interest still to pay.</summary>
        public const decimal TotalInterest = 336_100.16m;

        /// <summary>Due date of the last payment.</summary>
        public static readonly DateOnly PayoffDate = new(2050, 12, 1);
    }

    /// <summary>
    /// Refinance to 6% for a new 30 years, paying $6,000 closing costs up front. The payment drops, but the
    /// clock restarts: five more years of payments, and more interest overall.
    /// </summary>
    public static class ToSixPercentFor30Years
    {
        /// <summary>The new rate.</summary>
        public const decimal AnnualInterestRate = 6m;

        /// <summary>The new term.</summary>
        public const int TermInMonths = 360;

        /// <summary>Closing costs.</summary>
        public const decimal ClosingCosts = 6_000m;

        /// <summary>The new principal-and-interest payment.</summary>
        public const decimal MonthlyPayment = 1_798.65m;

        /// <summary>How much lower the payment is.</summary>
        public const decimal MonthlySavings = 321.69m;

        /// <summary>All interest on the new loan.</summary>
        public const decimal TotalInterest = 347_515.44m;

        /// <summary>Current total paid minus (new total paid + closing costs). Negative: refinancing costs more.</summary>
        public const decimal LifetimeSavings = -17_415.28m;

        /// <summary>The payment by which the interest saved so far first covers the closing costs.</summary>
        public const int BreakEvenPaymentNumber = 25;

        /// <summary>Due date of <see cref="BreakEvenPaymentNumber"/>.</summary>
        public static readonly DateOnly BreakEvenDate = new(2028, 1, 1);

        /// <summary>Payments added to the payoff: 360 instead of 300.</summary>
        public const int MonthsAdded = 60;

        /// <summary>Due date of the last payment on the new loan.</summary>
        public static readonly DateOnly PayoffDate = new(2055, 12, 1);

        /// <summary>Keeping the current payment on the new loan: the $321.69 difference goes to principal.</summary>
        public static class KeepingCurrentPayment
        {
            /// <summary>Payments needed.</summary>
            public const int NumberOfPayments = 247;

            /// <summary>All interest paid.</summary>
            public const decimal TotalInterest = 222_510.04m;

            /// <summary>Current total paid minus (this total paid + closing costs).</summary>
            public const decimal LifetimeSavings = 107_590.12m;

            /// <summary>Due date of the last payment.</summary>
            public static readonly DateOnly PayoffDate = new(2046, 7, 1);
        }
    }

    /// <summary>The same refinance with the $6,000 closing costs rolled into the loan instead.</summary>
    public static class ToSixPercentWithCostsFinanced
    {
        /// <summary>The new loan amount: the balance plus the closing costs.</summary>
        public const decimal LoanAmount = 306_000m;

        /// <summary>The new principal-and-interest payment.</summary>
        public const decimal MonthlyPayment = 1_834.62m;

        /// <summary>Current total paid minus new total paid (nothing was paid up front).</summary>
        public const decimal LifetimeSavings = -24_367.43m;

        /// <summary>Financed costs still count: the interest saved covers them by this payment.</summary>
        public const int BreakEvenPaymentNumber = 29;
    }
}
