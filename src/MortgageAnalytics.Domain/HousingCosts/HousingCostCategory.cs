namespace MortgageAnalytics.Domain.HousingCosts;

/// <summary>The kinds of recurring cost paid on top of principal and interest.</summary>
public enum HousingCostCategory
{
    /// <summary>County, city and school district ad valorem tax.</summary>
    PropertyTax = 0,

    /// <summary>Municipal Utility District tax, which funds water, sewer and drainage infrastructure.</summary>
    MudTax = 1,

    /// <summary>Public Improvement District assessment, which repays bonds for neighborhood improvements.</summary>
    PidAssessment = 2,

    /// <summary>Hazard (homeowners) insurance premium.</summary>
    HomeownersInsurance = 3,

    /// <summary>Private mortgage insurance (PMI), required when the down payment is under 20%.</summary>
    MortgageInsurance = 4,

    /// <summary>Homeowners association dues.</summary>
    HoaDues = 5,
}
