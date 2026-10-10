using System.Net;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace MortgageAnalytics.Api.Email;

/// <summary>
/// Writes the account emails Identity asks for, with links that open the app's own pages (confirm-email,
/// reset-password) instead of bare API responses. The pages then call the API. Links use the address the
/// request came in on, so they work behind the Angular dev proxy, in Docker and in production alike.
/// </summary>
/// <param name="transport">Delivers the email.</param>
/// <param name="http">The current request, for the site's address.</param>
/// <param name="options">The email settings (the fallback address).</param>
/// <param name="clock">Stamps the send time.</param>
public sealed class AccountEmailSender(
    IMailTransport transport, IHttpContextAccessor http, IOptions<EmailOptions> options, TimeProvider clock) : IEmailSender<IdentityUser>
{
    /// <summary>Sends the "confirm your email" message.</summary>
    /// <param name="user">The new account.</param>
    /// <param name="email">Where to send it.</param>
    /// <param name="confirmationLink">Identity's link to the API, HTML-encoded; its query (user id and code) is kept.</param>
    /// <returns>A task that completes once the email is sent.</returns>
    public Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink)
    {
        var query = new Uri(WebUtility.HtmlDecode(confirmationLink)).Query;
        var link = $"{SiteAddress()}/confirm-email{query}";
        return SendAsync(email, "Confirm your email for Mortgage Analytics",
            "Welcome! Confirm your email address to finish creating your account, so you can save calculations and find them again later.",
            "Confirm my email", link,
            "If you did not create an account, you can ignore this email.");
    }

    /// <summary>Sends the "reset your password" message, as a link to the app's reset page.</summary>
    /// <param name="user">The account.</param>
    /// <param name="email">Where to send it.</param>
    /// <param name="resetCode">Identity's reset code, HTML-encoded.</param>
    /// <returns>A task that completes once the email is sent.</returns>
    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode)
    {
        var query = QueryString.Create([new KeyValuePair<string, string?>("email", email), new("code", WebUtility.HtmlDecode(resetCode))]);
        var link = $"{SiteAddress()}/reset-password{query}";
        return SendAsync(email, "Reset your Mortgage Analytics password",
            "Someone (hopefully you) asked to reset your password. Choose a new one with the link below.",
            "Choose a new password", link,
            "If you did not ask for this, you can ignore this email: your password stays the same.");
    }

    /// <summary>Sends a reset link as given. (Identity's API endpoints send a code instead; see above.)</summary>
    /// <param name="user">The account.</param>
    /// <param name="email">Where to send it.</param>
    /// <param name="resetLink">The link, HTML-encoded.</param>
    /// <returns>A task that completes once the email is sent.</returns>
    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink) =>
        SendAsync(email, "Reset your Mortgage Analytics password",
            "Someone (hopefully you) asked to reset your password. Choose a new one with the link below.",
            "Choose a new password", WebUtility.HtmlDecode(resetLink),
            "If you did not ask for this, you can ignore this email: your password stays the same.");

    private Task SendAsync(string to, string subject, string intro, string action, string link, string footer)
    {
        var text = $"{intro}\n\n{action}: {link}\n\n{footer}\n";
        var html = $"""
            <p>{WebUtility.HtmlEncode(intro)}</p>
            <p><a href="{WebUtility.HtmlEncode(link)}" style="display:inline-block;padding:10px 16px;background:#2a78d6;color:#fff;border-radius:8px;text-decoration:none">{WebUtility.HtmlEncode(action)}</a></p>
            <p style="color:#6f6e69">Or paste this link into your browser: {WebUtility.HtmlEncode(link)}</p>
            <p style="color:#6f6e69">{WebUtility.HtmlEncode(footer)}</p>
            """;
        return transport.SendAsync(new EmailMessage(to, subject, text, html, link, clock.GetUtcNow()), http.HttpContext?.RequestAborted ?? default);
    }

    /// <summary>"http://localhost:4200", taken from the current request, or the configured public address.</summary>
    private string SiteAddress()
    {
        var request = http.HttpContext?.Request;
        return request is null ? options.Value.PublicUrl.TrimEnd('/') : $"{request.Scheme}://{request.Host}{request.PathBase}";
    }
}
