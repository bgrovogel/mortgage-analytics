using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace MortgageAnalytics.Api.Email;

/// <summary>Sends email through an SMTP server with MailKit (Mailpit locally, any provider in production).</summary>
/// <param name="options">The email settings, including the server.</param>
public sealed class SmtpMailTransport(IOptions<EmailOptions> options) : IMailTransport
{
    /// <inheritdoc />
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var host = settings.Smtp.Host ?? throw new InvalidOperationException("Email:Smtp:Host is not set.");
        using var client = new SmtpClient();
        // Auto: TLS on 465, STARTTLS when the server offers it, plain only for a local catcher like Mailpit.
        await client.ConnectAsync(host, settings.Smtp.Port, SecureSocketOptions.Auto, cancellationToken);
        if (!string.IsNullOrEmpty(settings.Smtp.Username))
            await client.AuthenticateAsync(settings.Smtp.Username, settings.Smtp.Password ?? "", cancellationToken);
        await client.SendAsync(ToMimeMessage(message, settings.From), cancellationToken);
        await client.DisconnectAsync(quit: true, cancellationToken);
    }

    /// <summary>The email as a MIME message with plain-text and HTML parts.</summary>
    /// <param name="message">The email.</param>
    /// <param name="from">The sender, e.g. <c>Mortgage Analytics &lt;no-reply@example.com&gt;</c>.</param>
    /// <returns>The MIME message.</returns>
    public static MimeMessage ToMimeMessage(EmailMessage message, string from)
    {
        var mime = new MimeMessage { Subject = message.Subject, Date = message.SentAt };
        mime.From.Add(MailboxAddress.Parse(from));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Body = new BodyBuilder { TextBody = message.Text, HtmlBody = message.Html }.ToMessageBody();
        return mime;
    }
}
