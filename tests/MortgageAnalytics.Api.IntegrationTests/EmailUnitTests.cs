using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using MimeKit;
using MortgageAnalytics.Api.Email;

namespace MortgageAnalytics.Api.IntegrationTests;

/// <summary>
/// Unit tests for the email pieces the HTTP flows cannot reach: links built with no current request,
/// Identity's link variant, and the SMTP message format. The transport is an NSubstitute substitute.
/// </summary>
[TestFixture]
public class EmailUnitTests
{
    private IMailTransport _transport = null!;
    private EmailMessage? _sent;

    [SetUp]
    public void CreateTransport()
    {
        _sent = null;
        _transport = Substitute.For<IMailTransport>();
        _transport.SendAsync(Arg.Do<EmailMessage>(m => _sent = m), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
    }

    private AccountEmailSender SenderWithoutARequest() =>
        new(_transport, new HttpContextAccessor(), Options.Create(new EmailOptions { PublicUrl = "https://mortgage.example/" }), TestClock.Create());

    [Test]
    public async Task WithNoCurrentRequest_LinksUseTheConfiguredPublicAddress()
    {
        await SenderWithoutARequest().SendPasswordResetCodeAsync(new IdentityUser(), "a@example.com", "abc-123");

        Assert.That(_sent?.ActionUrl, Is.EqualTo("https://mortgage.example/reset-password?email=a@example.com&code=abc-123"),
            "a background job still produces working links, without a doubled slash");
    }

    [Test]
    public async Task ConfirmationLinks_KeepIdentitysUserIdAndCode_DecodingItsHtmlEscaping()
    {
        await SenderWithoutARequest().SendConfirmationLinkAsync(new IdentityUser(), "a@example.com",
            "http://api/api/v1/account/confirmEmail?userId=u1&amp;code=c%2B1");

        Assert.That(_sent?.ActionUrl, Is.EqualTo("https://mortgage.example/confirm-email?userId=u1&code=c%2B1"),
            "Identity HTML-encodes the link; the app page needs the plain query");
    }

    [Test]
    public async Task AResetLinkFromIdentity_IsSentAsGiven()
    {
        await SenderWithoutARequest().SendPasswordResetLinkAsync(new IdentityUser(), "a@example.com", "https://x.example/reset?code=1&amp;e=2");

        Assert.Multiple(() =>
        {
            Assert.That(_sent?.ActionUrl, Is.EqualTo("https://x.example/reset?code=1&e=2"), "the link, decoded");
            Assert.That(_sent?.Html, Does.Contain("href=\"https://x.example/reset?code=1&amp;e=2\""), "and safely encoded again in the HTML");
        });
    }

    [Test]
    public void ForSmtp_AnEmailBecomesATextAndHtmlMimeMessage()
    {
        var message = new EmailMessage("to@example.com", "Subject", "Plain", "<p>Html</p>", "https://x.example", TestClock.Now);

        var mime = SmtpMailTransport.ToMimeMessage(message, "Mortgage Analytics <no-reply@example.com>");

        Assert.Multiple(() =>
        {
            Assert.That(mime.From.Mailboxes.Single().Address, Is.EqualTo("no-reply@example.com"), "from the configured sender");
            Assert.That(mime.To.Mailboxes.Single().Address, Is.EqualTo("to@example.com"), "to the recipient");
            Assert.That(mime.TextBody, Is.EqualTo("Plain"), "with a plain-text part");
            Assert.That(mime.HtmlBody, Is.EqualTo("<p>Html</p>"), "and an HTML part");
            Assert.That(mime.Body, Is.TypeOf<MultipartAlternative>(), "as alternatives, so mail apps pick the best one");
        });
    }
}
