using MortgageAnalytics.Domain.Loans;

namespace MortgageAnalytics.Domain.Refinancing;

/// <summary>A lender's refinance offer: the new rate and term, and what it costs to close.</summary>
public sealed record RefinanceOffer
{
    /// <summary>Creates an offer, rejecting any value outside the supported range.</summary>
    /// <param name="annualInterestRate">The new nominal annual rate as a percentage.</param>
    /// <param name="termInMonths">The new loan's term, in months.</param>
    /// <param name="closingCosts">Fees, points and other costs to close the new loan.</param>
    /// <param name="financeClosingCosts">True to add the closing costs to the new loan instead of paying them up front.</param>
    /// <exception cref="DomainValidationException">A value is out of range.</exception>
    public RefinanceOffer(decimal annualInterestRate, int termInMonths, decimal closingCosts, bool financeClosingCosts)
    {
        if (annualInterestRate is < 0 or > LoanTerms.MaxAnnualInterestRate)
            throw new DomainValidationException($"Annual interest rate must be between 0 and {LoanTerms.MaxAnnualInterestRate}%.");
        if (termInMonths is <= 0 or > LoanTerms.MaxTermInMonths)
            throw new DomainValidationException($"Term must be between 1 and {LoanTerms.MaxTermInMonths} months.");
        if (closingCosts is < 0 or > LoanTerms.MaxPrincipal)
            throw new DomainValidationException($"Closing costs must be between 0 and {LoanTerms.MaxPrincipal:N0}.");

        AnnualInterestRate = annualInterestRate;
        TermInMonths = termInMonths;
        ClosingCosts = closingCosts;
        FinanceClosingCosts = financeClosingCosts;
    }

    /// <summary>The new nominal annual rate as a percentage.</summary>
    public decimal AnnualInterestRate { get; }

    /// <summary>The new loan's term, in months.</summary>
    public int TermInMonths { get; }

    /// <summary>Fees, points and other costs to close the new loan.</summary>
    public decimal ClosingCosts { get; }

    /// <summary>True when the closing costs are added to the new loan rather than paid up front.</summary>
    public bool FinanceClosingCosts { get; }

    /// <summary>What is paid in cash at closing: the closing costs, unless they are financed.</summary>
    public decimal UpfrontCosts => FinanceClosingCosts ? 0m : ClosingCosts;

    /// <summary>The new loan's rate adjusts (its rate is the starting rate), or null for a fixed rate.</summary>
    public AdjustableRate? AdjustableRate { get; init; }

    /// <summary>
    /// A temporary buydown on the new loan, or null. In a refinance the borrower pays for it, in cash at closing, and
    /// gets the same amount back as lower payments in its years: it changes when the money is paid, not how much.
    /// </summary>
    public TemporaryBuydown? Buydown { get; init; }

    /// <summary>The new loan amount: the balance being paid off, plus the closing costs when they are financed.</summary>
    /// <param name="balance">The balance of the loan being replaced.</param>
    public decimal NewLoanAmount(decimal balance) => FinanceClosingCosts ? balance + ClosingCosts : balance;
}
