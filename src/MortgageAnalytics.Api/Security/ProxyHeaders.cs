using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace MortgageAnalytics.Api.Security;

/// <summary>
/// Running behind a reverse proxy that ends HTTPS. The proxy's <c>X-Forwarded-For</c> and <c>X-Forwarded-Proto</c>
/// are believed only from the proxies named in configuration (<c>ForwardedHeaders:KnownProxies</c>, addresses, and
/// <c>ForwardedHeaders:KnownNetworks</c>, CIDR ranges); from anyone else they are ignored. Believed, a request that
/// reached the proxy over HTTPS is HTTPS here, so the session cookie is marked <c>Secure</c> and HSTS is sent; and the
/// attempt limit counts each real client rather than the proxy.
/// </summary>
public static class ProxyHeaders
{
    /// <summary>How long browsers are told to use only HTTPS: a year, the usual value once HTTPS is settled.</summary>
    private static readonly TimeSpan HstsMaxAge = TimeSpan.FromDays(365);

    /// <summary>Registers which proxies to believe, and HSTS.</summary>
    /// <param name="services">The container to add to.</param>
    /// <param name="configuration">The app's configuration (<c>ForwardedHeaders</c>).</param>
    /// <returns>The same container, for chaining.</returns>
    public static IServiceCollection AddProxyHeaders(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var proxy in configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            foreach (var network in configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [])
                options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
        });
        services.AddHsts(options => options.MaxAge = HstsMaxAge);
        return services;
    }

    /// <summary>
    /// Applies the believed headers, first, so everything after sees the client's address and scheme; then HSTS, which
    /// is only ever sent on HTTPS (and never for localhost, so a developer's other local sites keep working).
    /// </summary>
    /// <param name="app">The application's pipeline.</param>
    /// <returns>The same pipeline, for chaining.</returns>
    public static IApplicationBuilder UseProxyHeaders(this IApplicationBuilder app) =>
        app.UseForwardedHeaders().UseHsts();
}
