using FluentValidation;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.Data;
using MortgageAnalytics.Application.Mapping;
using MortgageAnalytics.Application.Services;
using MortgageAnalytics.Domain.Closing;
using MortgageAnalytics.Domain.Loans;
using MortgageAnalytics.Domain.RentOrBuy;

namespace MortgageAnalytics.Application.Validation;

/// <summary>
/// Turns bad input into field-level messages before it reaches the domain.
/// Limits come from the domain types, so the API and the domain cannot disagree (DRY).
/// </summary>
/// <remarks>
/// An extra payment larger than the whole loan is always a mistake, so it is rejected here.
/// Whether an extra payment exceeds the balance <i>at that point</i> depends on the schedule,
/// so the engine caps it instead. Every rule names its field the way the form does
/// (<c>WithName</c>), because these messages are shown to people.
/// </remarks>
public sealed class AmortizationRequestValidator : AbstractValidator<AmortizationRequest>
{
    /// <summary>Whole dollars as people read them, "$557,750", whatever the server's culture.</summary>
    private static string Dollars(decimal amount) => "$" + amount.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>The most a conventional loan may be on this home, as a percentage of the price.</summary>
    private static decimal MaxConventionalLoanToValue(AmortizationRequest r) =>
        r.Occupancy.ToDomain().MaxConventionalLoanToValuePercent(adjustableRate: r.AdjustableRate is not null);

    /// <summary>"A conventional loan can be at most 90% of the price of a second home: put at least 10% down."</summary>
    private static string ConventionalLimitMessage(AmortizationRequest r)
    {
        var most = MaxConventionalLoanToValue(r);
        var (loan, home) = r.Occupancy switch
        {
            OccupancyType.SecondHome => ("A conventional loan", "a second home"),
            OccupancyType.InvestmentProperty => ("A conventional loan", "an investment property"),
            _ => (r.AdjustableRate is null ? "A conventional loan" : "A conventional loan with an adjustable rate", "a home you live in"),
        };
        return $"{loan} can be at most {most:0}% of the price of {home}: put at least {100m - most:0}% down.";
    }

    /// <summary>The most lump sums one request may contain.</summary>
    public const int MaxLumpSums = 120;

    /// <summary>The most co-buyers on a loan, besides the first buyer: a few people, not a crowd.</summary>
    public const int MaxCoBuyers = 3;

    /// <summary>
    /// The lowest recast minimum accepted. Lenders typically require $5,000 to $10,000; anything near zero
    /// would recast (and charge a fee) after routine monthly extras.
    /// </summary>
    public const decimal MinimumRecastLumpSum = 1_000m;

    /// <summary>The most household income accepted a year, well beyond any loan the calculator takes.</summary>
    public const decimal MaxIncome = 100_000_000m;

    /// <summary>The most a monthly budget may be: a million dollars a month.</summary>
    public const decimal MaxMonthlyBudget = 1_000_000m;

    // Keeps the last due date (up to 600 months out) well inside DateOnly's range. Shared with the refinance validator.
    internal static readonly DateOnly EarliestFirstPayment = new(1900, 1, 1);
    internal static readonly DateOnly LatestFirstPayment = new(2200, 12, 31);

    /// <summary>Defines every rule for an <see cref="AmortizationRequest"/>, with today from the system clock.</summary>
    public AmortizationRequestValidator() : this(TimeProvider.System)
    {
    }

    /// <summary>Defines every rule for an <see cref="AmortizationRequest"/>.</summary>
    /// <param name="clock">Today, which tells a loan still to be made from one already being paid.</param>
    public AmortizationRequestValidator(TimeProvider clock)
    {
        RuleFor(r => r.HomePrice)
            .GreaterThan(0)
            .WholeCents()
            .WithName("Home price");

        RuleFor(r => r.DownPayment)
            .GreaterThanOrEqualTo(0)
            .LessThan(r => r.HomePrice).WithMessage("Down payment must be less than the home price.")
            .WholeCents()
            .WithName("Down payment");

        RuleFor(r => r.HomePrice - r.DownPayment)
            .LessThanOrEqualTo(LoanTerms.MaxPrincipal)
            .WithMessage($"The loan amount (home price minus down payment) cannot exceed {LoanTerms.MaxPrincipal:N0}.")
            .OverridePropertyName(nameof(AmortizationRequest.DownPayment));

        // How the home is used: the most a conventional loan may be, FHA and VA, and a homestead (Domain/Loans/Occupancy.cs).
        RuleFor(r => r.Occupancy).IsInEnum().WithName("Occupancy");
        RuleFor(r => r.HomePrice - r.DownPayment)
            .Must((r, loan) => loan * 100m <= r.HomePrice * MaxConventionalLoanToValue(r))
            .WithMessage(r => ConventionalLimitMessage(r))
            .OverridePropertyName(nameof(AmortizationRequest.DownPayment))
            .When(r => r.Program is null or { Type: LoanProgramType.Conventional } && Enum.IsDefined(r.Occupancy)
                && (r.FirstPaymentDate is not { } first || first >= clock.Today())); // a loan being made (a payment due today is not yet made), not one being paid
        RuleFor(r => r.Occupancy)
            .Must(o => o.ToDomain().AllowsGovernmentLoan())
            .WithMessage("FHA and VA loans are only for a home you will live in.")
            .When(r => r.Program is { Type: LoanProgramType.Fha or LoanProgramType.Va } && Enum.IsDefined(r.Occupancy));
        RuleFor(r => r.HousingCosts!.IsHomestead)
            .Equal(false)
            .WithMessage("A homestead exemption is only for the home you live in.")
            .OverridePropertyName("HousingCosts.IsHomestead")
            .When(r => r.HousingCosts is not null && Enum.IsDefined(r.Occupancy) && !r.Occupancy.ToDomain().AllowsHomestead());

        RuleFor(r => r.AnnualInterestRate)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .WithName("Interest rate");

        RuleFor(r => r.TermInMonths)
            .InclusiveBetween(1, LoanTerms.MaxTermInMonths)
            .WithName("Term in months");

        RuleFor(r => r.FirstPaymentDate)
            .InclusiveBetween(EarliestFirstPayment, LatestFirstPayment)
            .WithName("First payment date")
            .When(r => r.FirstPaymentDate is not null);

        RuleFor(r => r.Strategy).IsInEnum();
        RuleFor(r => r.BuydownPaidBy).IsInEnum().WithName("Who pays for the buydown");

        // Terms that would be silently ignored are a client mistake, so they are rejected rather than dropped.
        RuleFor(r => r.Recast)
            .Null().WithMessage("Recast terms are only used with the Recast strategy.")
            .When(r => r.Strategy == ExtraPaymentStrategy.ShortenTerm);

        RuleFor(r => r.Recast!)
            .SetValidator(new RecastTermsValidator())
            .When(r => r.Recast is not null);

        RuleFor(r => r.ExtraPayments!)
            .SetValidator(r => new ExtraPaymentsValidator(r.HomePrice - r.DownPayment, r.TermInMonths))
            .When(r => r.ExtraPayments is not null);

        RuleFor(r => r.Program!.Type).IsInEnum().OverridePropertyName("Program.Type").WithName("Loan type").When(r => r.Program is not null);
        RuleFor(r => r.Program!.VaUse)
            .IsInEnum().OverridePropertyName("Program.VaUse").WithName("VA funding fee")
            .When(r => r.Program?.VaUse is not null);
        RuleFor(r => r.Program!.VaUse)
            .Null().WithMessage("Only a VA loan has a funding fee.").OverridePropertyName("Program.VaUse")
            .When(r => r.Program is { Type: not LoanProgramType.Va });

        RuleFor(r => r.DownPayment)
            .Must((r, down) => down >= r.HomePrice * GovernmentLoan.FhaMinimumDownPaymentPercent / 100m)
            .WithMessage($"An FHA loan needs at least {GovernmentLoan.FhaMinimumDownPaymentPercent}% down.")
            .When(r => r.Program?.Type == LoanProgramType.Fha);
        RuleFor(r => r.DownPayment)
            .Must((r, down) => down >= r.HomePrice * GovernmentLoan.FhaLowScoreMinimumDownPaymentPercent / 100m)
            .WithMessage($"With a credit score below {GovernmentLoan.FhaFullFinancingCreditScore}, an FHA loan needs at least {GovernmentLoan.FhaLowScoreMinimumDownPaymentPercent}% down.")
            .When(r => r.Program is { Type: LoanProgramType.Fha, CreditScore: >= GovernmentLoan.FhaMinimumCreditScore and < GovernmentLoan.FhaFullFinancingCreditScore });
        RuleFor(r => r.DownPayment)
            .Must((r, _) => r.HomePrice - r.DownPayment <= FhaLoanLimitData.Current.Find(r.Program!.CountyFips!)!.Limit)
            .WithMessage(r =>
            {
                var county = FhaLoanLimitData.Current.Find(r.Program!.CountyFips!)!;
                return $"FHA insures at most {Dollars(county.Limit)} in {county.Name}, {county.State} ({FhaLoanLimitData.Current.Year}); "
                    + $"this loan is {Dollars(r.HomePrice - r.DownPayment)}. Put more down, or choose another loan type.";
            })
            .When(r => r.Program is { Type: LoanProgramType.Fha, CountyFips: { } fips } && FhaLoanLimitData.Current.Find(fips) is not null);

        RuleFor(r => r.Program!.CreditScore)
            .InclusiveBetween(300, 850).OverridePropertyName("Program.CreditScore").WithName("Credit score")
            .When(r => r.Program?.CreditScore is not null);
        RuleFor(r => r.Program!.CreditScore)
            .GreaterThanOrEqualTo(GovernmentLoan.FhaMinimumCreditScore)
            .WithMessage($"FHA insures loans only for credit scores of {GovernmentLoan.FhaMinimumCreditScore} or more.")
            .OverridePropertyName("Program.CreditScore")
            .When(r => r.Program is { Type: LoanProgramType.Fha, CreditScore: >= 300 });
        RuleFor(r => r.Program!.CountyFips)
            .Must(fips => FhaLoanLimitData.Current.Find(fips!) is not null)
            .WithMessage(r => $"Choose a county from the list: '{r.Program!.CountyFips}' is not one HUD sets a limit for.")
            .OverridePropertyName("Program.CountyFips")
            .When(r => r.Program is { Type: LoanProgramType.Fha, CountyFips: not null });
        RuleFor(r => r.Program!.CreditScore)
            .Null().WithMessage("A credit score is used only for an FHA loan here.").OverridePropertyName("Program.CreditScore")
            .When(r => r.Program is not null && r.Program.Type != LoanProgramType.Fha);
        RuleFor(r => r.Program!.CountyFips)
            .Null().WithMessage("A county is used only for an FHA loan's limit here.").OverridePropertyName("Program.CountyFips")
            .When(r => r.Program is not null && r.Program.Type != LoanProgramType.Fha);

        RuleFor(r => r.HousingCosts!.PmiRate)
            .Equal(0m).WithMessage("FHA and VA loans have no PMI: FHA has its own mortgage insurance, worked out from the loan, and VA none.")
            .OverridePropertyName("HousingCosts.PmiRate")
            .When(r => r.HousingCosts is not null && r.Program?.Type is LoanProgramType.Fha or LoanProgramType.Va);

        RuleFor(r => r.DiscountPoints!.Points)
            .GreaterThan(0).LessThanOrEqualTo(DiscountPoints.MaxPoints)
            .Must(points => decimal.Round(points, 3) == points).WithMessage("'Points' can have at most 3 decimal places.")
            .OverridePropertyName("DiscountPoints.Points").WithName("Points")
            .When(r => r.DiscountPoints is not null);

        RuleFor(r => r.DiscountPoints!.RateWithoutPoints)
            .Percentage(max: LoanTerms.MaxAnnualInterestRate)
            .GreaterThan(r => r.AnnualInterestRate).WithMessage("The rate without points must be higher than the rate with them.")
            .OverridePropertyName("DiscountPoints.RateWithoutPoints").WithName("Rate without points")
            .When(r => r.DiscountPoints is not null);

        RuleFor(r => r.DiscountPoints)
            .Null().WithMessage("Discount points are compared on a fixed rate; an adjustable rate's resets would differ.")
            .When(r => r.AdjustableRate is not null);

        RuleFor(r => r.ClosingCosts!)
            .SetValidator(new ClosingCostsValidator())
            .When(r => r.ClosingCosts is not null);

        RuleFor(r => r.SellerOffer!.YearsKept)
            .InclusiveBetween(1, LoanTerms.MaxTermInMonths / 12)
            .OverridePropertyName("SellerOffer.YearsKept").WithName("Years the loan is kept")
            .When(r => r.SellerOffer is not null);

        RuleFor(r => r.SellerOffer!.RateCutPerPoint)
            .GreaterThan(0).LessThanOrEqualTo(SellerOffer.MaxRateCutPerPoint)
            .Must(cut => decimal.Round(cut, 3) == cut).WithMessage("'Rate cut per point' can have at most 3 decimal places.")
            .OverridePropertyName("SellerOffer.RateCutPerPoint").WithName("Rate cut per point")
            .When(r => r.SellerOffer is not null);

        RuleFor(r => r.Affordability!.AnnualIncome)
            .GreaterThan(0).LessThanOrEqualTo(MaxIncome).WholeCents()
            .OverridePropertyName("Affordability.AnnualIncome").WithName("Income")
            .When(r => r.Affordability is not null);

        RuleFor(r => r.Affordability!.MonthlyDebts)
            .InclusiveBetween(0, MaxIncome / 12).WholeCents()
            .OverridePropertyName("Affordability.MonthlyDebts").WithName("Monthly debts")
            .When(r => r.Affordability is not null);

        RuleFor(r => r.Affordability!.CoBuyers)
            .Must(coBuyers => coBuyers.Count <= MaxCoBuyers).WithMessage($"'Co-buyers' can be at most {MaxCoBuyers}.")
            .Must(coBuyers => coBuyers.Sum(c => c.DownPaymentPercent) <= 100m).WithMessage("The co-buyers' shares of the down payment add up to more than all of it.")
            .OverridePropertyName("Affordability.CoBuyers").WithName("Co-buyers")
            .When(r => r.Affordability is not null);

        RuleForEach(r => r.Affordability!.CoBuyers)
            .SetValidator(new CoBuyerValidator())
            .When(r => r.Affordability is not null);

        RuleFor(r => r.MonthlyBudget!.Value)
            .GreaterThan(0).LessThanOrEqualTo(MaxMonthlyBudget).WholeCents()
            .OverridePropertyName(nameof(AmortizationRequest.MonthlyBudget)).WithName("Monthly budget")
            .When(r => r.MonthlyBudget is not null);

        RuleFor(r => r.RentOrBuy!).SetValidator(new RentOrBuyValidator()).When(r => r.RentOrBuy is not null);

        RuleFor(r => r.HousingCosts!)
            .SetValidator(r => new HousingCostsValidator(r.TermInMonths))
            .When(r => r.HousingCosts is not null);

        RuleFor(r => r.AdjustableRate)
            .Null().WithMessage("Choose a buydown or an adjustable rate, not both.")
            .When(r => r.Buydown is not null);

        RuleFor(r => r.Buydown!)
            .SetValidator(new TemporaryBuydownRequestValidator())
            .When(r => r.Buydown is not null);

        RuleFor(r => r.AdjustableRate!)
            .SetValidator(r => new AdjustableRateRequestValidator(r.TermInMonths, r.AnnualInterestRate))
            .When(r => r.AdjustableRate is not null);
    }

    private sealed class RecastTermsValidator : AbstractValidator<RecastTermsRequest>
    {
        public RecastTermsValidator()
        {
            RuleFor(r => r.MinimumLumpSum)
                .GreaterThanOrEqualTo(MinimumRecastLumpSum)
                .WithMessage($"The recast minimum must be at least {MinimumRecastLumpSum:C0}; lenders recast only after a large lump sum.")
                .WholeCents()
                .WithName("Recast minimum");
            RuleFor(r => r.Fee).InclusiveBetween(0, 10_000).WholeCents().WithName("Recast fee");
        }
    }

    private sealed class ExtraPaymentsValidator : AbstractValidator<ExtraPaymentsRequest>
    {
        public ExtraPaymentsValidator(decimal loanAmount, int termInMonths)
        {
            RuleFor(e => e.MonthlyAmount).ExtraAmount(loanAmount, allowZero: true).WithName("Monthly extra payment");
            RuleFor(e => e.MonthlyStartingPaymentNumber).PaymentNumberWithin(termInMonths).WithName("Monthly extra start");

            RuleFor(e => e.Annual!.Amount)
                .ExtraAmount(loanAmount, allowZero: true)
                .OverridePropertyName("Annual.Amount").WithName("Annual extra payment")
                .When(e => e.Annual is not null);

            RuleFor(e => e.Annual!.FirstPaymentNumber)
                .PaymentNumberWithin(termInMonths)
                .OverridePropertyName("Annual.FirstPaymentNumber").WithName("Annual extra starting payment")
                .When(e => e.Annual is not null);

            RuleFor(e => e.LumpSums)
                .NotNull()
                .Must(l => l.Count <= MaxLumpSums).WithMessage($"No more than {MaxLumpSums} lump sums are allowed.")
                .WithName("Lump sums");

            RuleForEach(e => e.LumpSums).ChildRules(lumpSum =>
            {
                lumpSum.RuleFor(l => l.Amount).ExtraAmount(loanAmount, allowZero: false).WithName("Lump sum");
                lumpSum.RuleFor(l => l.PaymentNumber).PaymentNumberWithin(termInMonths).WithName("Lump sum payment number");
            });
        }
    }

    private sealed class ClosingCostsValidator : AbstractValidator<ClosingCostsRequest>
    {
        /// <summary>The most any one closing-cost amount may be.</summary>
        private const decimal MaxAmount = 1_000_000m;

        public ClosingCostsValidator()
        {
            RuleFor(c => c.LoanCosts).InclusiveBetween(0, MaxAmount).WholeCents().WithName("Loan costs");
            RuleFor(c => c.OtherFees).InclusiveBetween(0, MaxAmount).WholeCents().WithName("Other fees");
            RuleFor(c => c.PrepaidInterestDays).InclusiveBetween(0, ClosingCosts.MaxPrepaidInterestDays).WithName("Days of prepaid interest");
            RuleFor(c => c.EscrowMonths).InclusiveBetween(0, ClosingCosts.MaxEscrowMonths).WithName("Months of escrow");
            RuleFor(c => c.Credits).InclusiveBetween(0, MaxAmount).WholeCents().WithName("Credits");
            RuleFor(c => c.LenderCredits).InclusiveBetween(0, MaxAmount).WholeCents().WithName("Lender credits");
        }
    }

    /// <summary>Someone buying with the first buyer: an income and debts in dollars and cents, and a share of the down payment.</summary>
    private sealed class CoBuyerValidator : AbstractValidator<CoBuyerRequest>
    {
        public CoBuyerValidator()
        {
            RuleFor(c => c.AnnualIncome).GreaterThan(0).LessThanOrEqualTo(MaxIncome).WholeCents().WithName("Co-buyer income");
            RuleFor(c => c.MonthlyDebts).InclusiveBetween(0, MaxIncome / 12).WholeCents().WithName("Co-buyer debts");
            RuleFor(c => c.DownPaymentPercent)
                .InclusiveBetween(0, 100)
                .Must(percent => decimal.Round(percent, 2) == percent).WithMessage("'Co-buyer share of the down payment' can have at most 2 decimal places.")
                .WithName("Co-buyer share of the down payment");
        }
    }

    /// <summary>Renting's cost and what money earns: values a market could have, the domain's own limits.</summary>
    private sealed class RentOrBuyValidator : AbstractValidator<RentOrBuyRequest>
    {
        public RentOrBuyValidator()
        {
            RuleFor(r => r.MonthlyRent).GreaterThan(0).LessThanOrEqualTo(RentOrBuyAssumptions.MaxMonthlyRent).WholeCents().WithName("Rent");
            RuleFor(r => r.RentIncreasePercent).InclusiveBetween(-20, 20).WithName("Rent increase");
            RuleFor(r => r.InvestmentReturnPercent).InclusiveBetween(-20, 30).WithName("Investment return");
            RuleFor(r => r.MaintenancePercent).InclusiveBetween(0, 10).WithName("Upkeep");
            RuleFor(r => r.SellingCostPercent).InclusiveBetween(0, 20).WithName("Selling costs");
        }
    }

    /// <summary>One tax rate change: a later year within the loan, changing at least one rate, each for a tax that is charged.</summary>
    private sealed class TaxRateChangeValidator : AbstractValidator<TaxRateChangeRequest>
    {
        public TaxRateChangeValidator(HousingCostsRequest costs, int loanYears)
        {
            RuleFor(c => c.FromYear)
                .InclusiveBetween(2, loanYears)
                .WithMessage($"'Rate change year' must be a later year of the loan: between 2 and {loanYears}.")
                .WithName("Rate change year");
            RuleFor(c => c)
                .Must(c => c.PropertyTaxRate is not null || c.SchoolTaxRate is not null || c.LocalTaxRate is not null || c.MudTaxRate is not null)
                .WithMessage("A rate change must change at least one rate.")
                .OverridePropertyName(string.Empty);

            Rate(c => c.PropertyTaxRate, costs.PropertyTaxRate, 15, "Property tax rate");
            Rate(c => c.SchoolTaxRate, costs.SchoolTaxRate, 10, "School tax rate");
            Rate(c => c.LocalTaxRate, costs.LocalTaxRate, 10, "County/city tax rate");
            Rate(c => c.MudTaxRate, costs.MudTaxRate, 5, "MUD tax rate");
        }

        /// <summary>A new rate: within the tax's own limits, and only for a tax that is charged (its first rate above 0).</summary>
        private void Rate(System.Linq.Expressions.Expression<Func<TaxRateChangeRequest, decimal?>> rate, decimal firstRate, decimal max, string name)
        {
            RuleFor(rate)
                .Must(value => value is null || (value >= 0 && value <= max && decimal.Round(value.Value, 4) == value))
                .WithMessage($"'{name}' must be between 0 and {max}, with at most 4 decimal places.");
            RuleFor(rate)
                .Null().WithMessage($"'{name}' can only change for a tax that is charged; it is not.")
                .When(_ => firstRate == 0);
        }
    }

    private sealed class HousingCostsValidator : AbstractValidator<HousingCostsRequest>
    {
        public HousingCostsValidator(int termInMonths)
        {
            // Relief that starts after the last payment would silently do nothing.
            var loanYears = Math.Max(1, (termInMonths + 11) / 12);

            RuleFor(h => h.PropertyTaxRate).Percentage(max: 15).WithName("Property tax rate");
            RuleFor(h => h.PropertyTaxHomesteadExemption).InclusiveBetween(0, 10_000_000).WholeCents().WithName("Homestead exemption");
            RuleFor(h => h)
                .Must(h => h.SchoolTaxRate == 0 && h.LocalTaxRate == 0 && h.MudTaxRate == 0)
                .WithMessage("Use one property tax rate or the separate school, county/city and MUD rates, not both.")
                .OverridePropertyName(nameof(HousingCostsRequest.PropertyTaxRate))
                .When(h => h.PropertyTaxRate > 0);
            RuleFor(h => h.Over65OrDisabled)
                .Null().WithMessage("Over-65 relief applies to the separate school and county/city taxes; enter them separately to use it.")
                .When(h => h.PropertyTaxRate > 0);
            RuleFor(h => h.SchoolTaxRate).Percentage(max: 10).WithName("School tax rate");
            RuleFor(h => h.LocalTaxRate).Percentage(max: 10).WithName("County/city tax rate");
            RuleFor(h => h.MudTaxRate).Percentage(max: 5).WithName("MUD tax rate");
            RuleFor(h => h.SchoolHomesteadExemption).InclusiveBetween(0, 10_000_000).WholeCents().WithName("School homestead exemption");
            RuleFor(h => h.LocalHomesteadExemptionPercent).Percentage(max: 100).WithName("County/city exemption");
            RuleFor(h => h.MudHomesteadExemptionPercent).Percentage(max: 100).WithName("MUD exemption");
            RuleFor(h => h.HomesteadAssessmentCap).Percentage(max: 100).WithName("Appraisal cap");
            RuleFor(h => h.HomeValueGrowthRate).Rate(-20, 25).WithName("Home value growth");
            RuleFor(h => h.InsuranceIncreaseRate).Rate(-20, 50).WithName("Insurance increase");
            RuleFor(h => h.HoaIncreaseRate).Rate(-20, 50).WithName("HOA increase");
            RuleFor(h => h.PmiRate).Percentage(max: 5).WithName("PMI rate");
            RuleFor(h => h.PmiCancellation).IsInEnum().WithName("PMI removal");
            RuleFor(h => h.AnnualHomeownersInsurance).InclusiveBetween(0, 1_000_000).WholeCents().WithName("Home insurance");
            RuleFor(h => h.MonthlyHoaDues).InclusiveBetween(0, 100_000).WholeCents().WithName("HOA dues");

            RuleFor(h => h.Over65OrDisabled!.QualifiesInYear)
                .InclusiveBetween(1, loanYears)
                .WithMessage($"'Qualifying year' must fall within the loan: between 1 and {loanYears}.")
                .OverridePropertyName("Over65OrDisabled.QualifiesInYear").WithName("Qualifying year")
                .When(h => h.Over65OrDisabled is not null);

            RuleFor(h => h.Over65OrDisabled!.SchoolExemption)
                .InclusiveBetween(0, 10_000_000).WholeCents()
                .OverridePropertyName("Over65OrDisabled.SchoolExemption").WithName("Over-65 school exemption")
                .When(h => h.Over65OrDisabled is not null);

            RuleFor(h => h.Over65OrDisabled!.LocalExemption)
                .InclusiveBetween(0, 10_000_000).WholeCents()
                .OverridePropertyName("Over65OrDisabled.LocalExemption").WithName("Over-65 county/city exemption")
                .When(h => h.Over65OrDisabled is not null);

            RuleFor(h => h.Over65OrDisabled!.TransferredCeilingPercent)
                .GreaterThan(0).LessThanOrEqualTo(100)
                .OverridePropertyName("Over65OrDisabled.TransferredCeilingPercent").WithName("Share of school tax paid before")
                .When(h => h.Over65OrDisabled?.TransferredCeilingPercent is not null);

            RuleFor(h => h.RateChanges)
                .Must(changes => changes.Select(c => c.FromYear).Distinct().Count() == changes.Count)
                .WithMessage("Each year can have one tax rate change; put the rates that change that year together.");
            RuleForEach(h => h.RateChanges).SetValidator(h => new TaxRateChangeValidator(h, loanYears));

            RuleFor(h => h.Pid!.AnnualAssessment)
                .InclusiveBetween(0, 1_000_000).WholeCents()
                .OverridePropertyName("Pid.AnnualAssessment").WithName("PID annual assessment")
                .When(h => h.Pid is not null);

            RuleFor(h => h.Pid!.RemainingYears)
                .InclusiveBetween(1, 50)
                .OverridePropertyName("Pid.RemainingYears").WithName("PID remaining years")
                .When(h => h.Pid?.RemainingYears is not null);
        }
    }
}

/// <summary>Reusable rule fragments, so each rule is written once (DRY).</summary>
internal static class SharedRules
{
    /// <summary>Rejects amounts with fractions of a cent.</summary>
    public static IRuleBuilderOptions<T, decimal> WholeCents<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.PrecisionScale(15, 2, ignoreTrailingZeros: true).WithMessage("'{PropertyName}' cannot include fractions of a cent.");

    /// <summary>Requires a percentage between 0 and <paramref name="max"/>, with up to four decimal places.</summary>
    public static IRuleBuilderOptions<T, decimal> Percentage<T>(this IRuleBuilder<T, decimal> rule, decimal max) =>
        rule.Rate(0, max);

    /// <summary>
    /// Requires a rate between <paramref name="min"/> and <paramref name="max"/>, with up to four decimal places.
    /// Seven digits in all, so three-digit rates (a 100% or 200% employer match) fit.
    /// </summary>
    public static IRuleBuilderOptions<T, decimal> Rate<T>(this IRuleBuilder<T, decimal> rule, decimal min, decimal max) =>
        rule.InclusiveBetween(min, max).PrecisionScale(7, 4, ignoreTrailingZeros: true);

    /// <summary>Requires an extra payment that is not negative (or, unless <paramref name="allowZero"/>, positive), no larger than the loan, and in whole cents.</summary>
    public static IRuleBuilderOptions<T, decimal> ExtraAmount<T>(this IRuleBuilder<T, decimal> rule, decimal loanAmount, bool allowZero)
    {
        var floor = allowZero ? rule.GreaterThanOrEqualTo(0) : rule.GreaterThan(0);

        // Without a valid loan amount there is nothing to compare against; the down payment
        // error explains the real problem, so this check stays quiet instead of piling on.
        return floor
            .LessThanOrEqualTo(loanAmount).WithMessage("'{PropertyName}' cannot exceed the loan amount.")
            .When(_ => loanAmount > 0, ApplyConditionTo.CurrentValidator)
            .WholeCents();
    }

    /// <summary>Requires a payment number between 1 and the loan term.</summary>
    public static IRuleBuilderOptions<T, int> PaymentNumberWithin<T>(this IRuleBuilder<T, int> rule, int termInMonths) =>
        rule.InclusiveBetween(1, Math.Max(1, termInMonths))
            .WithMessage($"'{{PropertyName}}' must be between 1 and the loan term ({termInMonths}).");
}
