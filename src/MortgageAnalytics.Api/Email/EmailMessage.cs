namespace MortgageAnalytics.Api.Email;

/// <summary>An email the app sends: one message with one action (a link to follow).</summary>
/// <param name="To">The recipient's address.</param>
/// <param name="Subject">The subject line.</param>
/// <param name="Text">The plain-text body, which includes the link for mail apps that show no buttons.</param>
/// <param name="Html">The HTML body, with the link as a button.</param>
/// <param name="ActionUrl">The link the email asks the reader to follow.</param>
/// <param name="SentAt">When it was sent.</param>
public sealed record EmailMessage(string To, string Subject, string Text, string Html, string ActionUrl, DateTimeOffset SentAt);

/// <summary>Delivers emails: by SMTP, or into a local outbox when no mail server is configured.</summary>
public interface IMailTransport
{
    /// <summary>Sends one email.</summary>
    /// <param name="message">The email.</param>
    /// <param name="cancellationToken">Cancels sending.</param>
    /// <returns>A task that completes once the email has been handed over.</returns>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

/// <summary>Email settings (the "Email" configuration section).</summary>
public sealed class EmailOptions
{
    /// <summary>The sender, e.g. <c>Mortgage Analytics &lt;no-reply@example.com&gt;</c>.</summary>
    public string From { get; set; } = "Mortgage Analytics <no-reply@mortgage-analytics.local>";

    /// <summary>Where emails go when no SMTP host is set. Relative paths are under the app's content root.</summary>
    public string OutboxDirectory { get; set; } = "App_Data/outbox";

    /// <summary>The site's address for links in emails, used when there is no current request to take it from.</summary>
    public string PublicUrl { get; set; } = "http://localhost:4200";

    /// <summary>The mail server. Leave the host empty to use the local outbox.</summary>
    public SmtpOptions Smtp { get; set; } = new();
}

/// <summary>SMTP settings ("Email:Smtp").</summary>
public sealed class SmtpOptions
{
    /// <summary>The server's host name. Empty means "no mail server: use the outbox".</summary>
    public string? Host { get; set; }

    /// <summary>The port: 587 for STARTTLS (the default), 465 for TLS, 1025 for Mailpit.</summary>
    public int Port { get; set; } = 587;

    /// <summary>The user name, when the server requires sign-in.</summary>
    public string? Username { get; set; }

    /// <summary>The password, when the server requires sign-in. Supply it through user secrets or the environment.</summary>
    public string? Password { get; set; }
}
