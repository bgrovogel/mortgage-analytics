using MortgageAnalytics.Application.Sessions;

namespace MortgageAnalytics.Application.Tests.Sessions;

/// <summary>What a person sees for where they are signed in: the browser and the system, read from its user agent.</summary>
[TestFixture]
public class DeviceLabelTests
{
    [TestCase("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome on Windows", TestName = "Chrome on Windows")]
    [TestCase("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "Edge on Windows", TestName = "Edge, which also says Chrome and Safari")]
    [TestCase("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox on macOS", TestName = "Firefox on a Mac")]
    [TestCase("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Safari on macOS", TestName = "Safari on a Mac")]
    [TestCase("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari on iPhone", TestName = "Safari on an iPhone")]
    [TestCase("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari on iPad", TestName = "Safari on an iPad")]
    [TestCase("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1", "Chrome on iPhone", TestName = "Chrome on an iPhone says CriOS")]
    [TestCase("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "Chrome on Android", TestName = "Chrome on Android")]
    [TestCase("Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0", "Firefox on Android", TestName = "Firefox on Android")]
    [TestCase("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome on Linux", TestName = "Chrome on Linux")]
    [TestCase("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0", "Opera on Windows", TestName = "Opera")]
    public void TheBrowserAndTheSystem_AreNamed(string userAgent, string expected) =>
        Assert.That(DeviceLabel.From(userAgent), Is.EqualTo(expected), "what the person recognizes");

    [Test]
    public void ASystemWithNoBrowserWeKnow_IsNamedByItsSystemOrJustABrowser()
    {
        Assert.Multiple(() =>
        {
            Assert.That(DeviceLabel.From("curl/8.0"), Is.EqualTo("A browser"), "nothing recognised");
            Assert.That(DeviceLabel.From("Mozilla/5.0 (Windows NT 10.0) SomethingNew/1.0"), Is.EqualTo("A browser on Windows"), "a system but no known browser");
        });
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public void NoUserAgent_IsJustABrowser(string? userAgent) =>
        Assert.That(DeviceLabel.From(userAgent), Is.EqualTo("A browser"), "nothing was sent");

    [Test]
    public void ALongUserAgent_StillGivesAShortLabel() =>
        Assert.That(DeviceLabel.From(new string('x', 5_000)).Length, Is.LessThanOrEqualTo(DeviceLabel.MaxLength), "the label fits its column");
}
