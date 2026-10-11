namespace MortgageAnalytics.Api.Security;

/// <summary>The browser security headers every response carries.</summary>
public static class SecurityHeaders
{
    /// <summary>
    /// The app's Content-Security-Policy. Scripts come only from the app's own files: no inline script, no
    /// <c>eval</c>, nothing injected from elsewhere. Styles may be inline, because Angular adds each component's
    /// styles as a <c>&lt;style&gt;</c> element. Data goes only to this API, and no other site may frame the page.
    /// </summary>
    public const string ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
        + "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    /// <summary>
    /// Adds the headers before the rest of the pipeline runs, so errors and static files carry them too.
    /// </summary>
    /// <param name="app">The application's pipeline.</param>
    /// <returns>The same pipeline, for chaining.</returns>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            var headers = context.Response.Headers;
            headers.ContentSecurityPolicy = ContentSecurityPolicy;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            // Reset and confirmation links carry their codes in the URL; never pass it on to another site.
            headers["Referrer-Policy"] = "no-referrer";
            return next(context);
        });
}
