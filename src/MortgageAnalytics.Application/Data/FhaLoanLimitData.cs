using System.Text.Json;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.Data;

/// <summary>
/// HUD's FHA loan limits for every county, one-unit homes, as built from HUD's own file by
/// <c>tools/fha-limits/build_fha_limits.py</c> into <c>fha-loan-limits.json</c>, which is compiled into this assembly.
/// HUD publishes each year's in December; rebuilding the file is the whole update.
/// </summary>
public static class FhaLoanLimitData
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>The limits in force: the year, HUD's floor and ceiling, the states, and every county's limit.</summary>
    public static FhaLoanLimitsResponse Current { get; } = Load();

    private static FhaLoanLimitsResponse Load()
    {
        using var stream = typeof(FhaLoanLimitData).Assembly.GetManifestResourceStream("MortgageAnalytics.Application.Data.fha-loan-limits.json")
            ?? throw new InvalidOperationException("The FHA loan limits are not compiled into the assembly.");
        return JsonSerializer.Deserialize<FhaLoanLimitsResponse>(stream, Json)
            ?? throw new InvalidOperationException("The FHA loan limits file is empty.");
    }
}
