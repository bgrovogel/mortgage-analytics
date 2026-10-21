namespace MortgageAnalytics.Application.Sessions;

/// <summary>
/// Names a device the way a person would, from the browser's user agent: "Chrome on Windows", "Safari on iPhone". It reads
/// only the few words that tell one device from another, never the full string, which would identify a browser to the byte.
/// </summary>
public static class DeviceLabel
{
    /// <summary>The longest label, which the column holds.</summary>
    public const int MaxLength = 100;

    private const string Unknown = "A browser";

    /// <summary>The label for a user agent; "A browser" when nothing is recognised.</summary>
    /// <param name="userAgent">The request's User-Agent header, or null.</param>
    public static string From(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return Unknown;

        var ua = userAgent.Length > 1_000 ? userAgent[..1_000] : userAgent;
        var browser = BrowserOf(ua);
        var system = SystemOf(ua);

        var label = (browser, system) switch
        {
            (not null, not null) => $"{browser} on {system}",
            (not null, null) => browser,
            (null, not null) => $"{Unknown} on {system}",
            _ => Unknown,
        };
        return label.Length > MaxLength ? label[..MaxLength] : label;
    }

    // Order matters: Edge, Opera and Chrome on iOS all say "Chrome" or "Safari" too, and Chrome says "Safari".
    private static string? BrowserOf(string ua) =>
        Has(ua, "Edg/", "EdgA/", "EdgiOS/") ? "Edge"
        : Has(ua, "OPR/") ? "Opera"
        : Has(ua, "CriOS/") ? "Chrome"
        : Has(ua, "FxiOS/", "Firefox/") ? "Firefox"
        : Has(ua, "Chrome/") ? "Chrome"
        : Has(ua, "Safari/") ? "Safari"
        : null;

    // Order matters again: an iPhone says "like Mac OS X", and Android says "Linux".
    private static string? SystemOf(string ua) =>
        Has(ua, "iPhone") ? "iPhone"
        : Has(ua, "iPad") ? "iPad"
        : Has(ua, "Android") ? "Android"
        : Has(ua, "Windows") ? "Windows"
        : Has(ua, "CrOS") ? "ChromeOS"
        : Has(ua, "Macintosh", "Mac OS X") ? "macOS"
        : Has(ua, "Linux", "X11") ? "Linux"
        : null;

    private static bool Has(string ua, params string[] words) => words.Any(w => ua.Contains(w, StringComparison.Ordinal));
}
