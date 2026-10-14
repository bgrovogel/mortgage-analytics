using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Affordability;

/// <summary>Why a lender qualifies a loan at the rate it does.</summary>
public enum QualifyingRateBasis
{
    /// <summary>The note rate: a fixed rate, or an adjustable one whose rule asks no more (a temporary buydown's lower years are never counted).</summary>
    NoteRate = 0,

    /// <summary>A conventional ARM fixed three years or less: the most its rate can reach in the first five years.</summary>
    MostInFirstFiveYears = 1,

    /// <summary>A conventional ARM fixed five years: the higher of the note rate plus its first cap, and the fully indexed rate.</summary>
    FirstResetOrFullyIndexed = 2,

    /// <summary>An FHA 1-year ARM with a loan of 95% or more: the starting rate plus a percentage point.</summary>
    StartPlusOnePoint = 3,
}

/// <summary>
/// The rate a lender qualifies a borrower at, and why. A fixed rate is the note rate. An adjustable rate follows the
/// loan program: Fannie Mae's Selling Guide B3-6-04 for a conventional loan (the most it reaches in five years if fixed
/// three years or less; the first reset's cap or the fully indexed rate if fixed five; the note rate if longer), and
/// HUD Handbook 4000.1's Section 251 ARMs for FHA (the starting rate, plus a point for a 1-year ARM with a loan of 95%
/// or more). VA's rule is not modelled: a VA ARM is qualified at its starting rate.
/// </summary>
/// <param name="Rate">The qualifying rate, as a percentage.</param>
/// <param name="Basis">Why it is that rate.</param>
public sealed record QualifyingRate(decimal Rate, QualifyingRateBasis Basis)
{
    /// <summary>The first five years of payments, which Fannie Mae's short-ARM rule looks across.</summary>
    private const int FiveYears = 60;

    /// <summary>The qualifying rate for a loan.</summary>
    /// <param name="program">The loan's program.</param>
    /// <param name="noteRate">The note rate: an ARM's starting rate.</param>
    /// <param name="arm">The adjustable rate, or null for a fixed one.</param>
    /// <param name="termInMonths">The loan's term.</param>
    /// <param name="loanToValuePercent">The loan as a percentage of the price.</param>
    public static QualifyingRate For(LoanProgram program, decimal noteRate, AdjustableRate? arm, int termInMonths, decimal loanToValuePercent)
    {
        var note = new QualifyingRate(noteRate, QualifyingRateBasis.NoteRate);
        if (arm is null)
            return note;

        if (program == LoanProgram.Fha)
            return arm.InitialFixedMonths <= 12 && loanToValuePercent >= 95m
                ? new QualifyingRate(Math.Min(LoanTerms.MaxAnnualInterestRate, noteRate + 1m), QualifyingRateBasis.StartPlusOnePoint)
                : note;
        if (program == LoanProgram.Va)
            return note;

        if (arm.InitialFixedMonths <= 36)
        {
            var highest = arm.WorstCase(noteRate).RatePath(noteRate, termInMonths)
                .Where(change => change.FromPaymentNumber <= FiveYears)
                .Select(change => change.AnnualInterestRate)
                .Append(noteRate)
                .Max();
            return new QualifyingRate(highest, QualifyingRateBasis.MostInFirstFiveYears);
        }

        if (arm.InitialFixedMonths <= FiveYears)
        {
            var firstReset = Math.Min(LoanTerms.MaxAnnualInterestRate, noteRate + Math.Min(arm.InitialCap, arm.LifetimeCap));
            return new QualifyingRate(Math.Max(firstReset, arm.ExpectedRate), QualifyingRateBasis.FirstResetOrFullyIndexed);
        }

        return note;
    }
}
