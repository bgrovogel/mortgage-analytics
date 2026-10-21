using System.Net;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using MortgageAnalytics.Api.Rates;

namespace MortgageAnalytics.Api.IntegrationTests.Rates;

/// <summary>
/// The average rates from Freddie Mac's survey: fetched, read, and kept for hours so a page is not a request to another
/// site; when the site fails, the last rates are served, and nothing is hammered. A fake handler stands in for the site.
/// </summary>
[TestFixture]
public class FreddieMacAverageRatesTests
{
    private const string Csv = "date,pmms30,pmms30p,pmms15\r\n10/8/2026,7.4,,6.73\r\n10/15/2026,7.41,,6.71\r\n";

    private sealed class FakeSite(Func<HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            return Task.FromResult(respond());
        }
    }

    private static HttpResponseMessage Ok(string body = Csv) => new(HttpStatusCode.OK) { Content = new StringContent(body) };

    private static (FreddieMacAverageRates Rates, FakeSite Site, FakeTimeProvider Clock) Create(Func<HttpResponseMessage> respond, bool enabled = true)
    {
        var site = new FakeSite(respond);
        var clock = TestClock.Create();
        var options = Options.Create(new RatesOptions { Enabled = enabled, SourceUrl = "https://example.test/pmms.csv" });
        return (new FreddieMacAverageRates(new HttpClient(site), clock, options), site, clock);
    }

    [Test]
    public async Task ItFetchesTheSurvey_AndReadsTheLatestWeek()
    {
        var (rates, _, _) = Create(() => Ok());

        var average = await rates.GetAsync(CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(average?.ThirtyYearFixed, Is.EqualTo(7.41m), "the 30-year average");
            Assert.That(average?.FifteenYearFixed, Is.EqualTo(6.71m), "the 15-year average");
            Assert.That(average?.AsOf, Is.EqualTo(new DateOnly(2026, 10, 15)), "of that week");
        });
    }

    [Test]
    public async Task ItKeepsTheRatesForHours_SoAPageIsNotARequestToAnotherSite()
    {
        var (rates, site, clock) = Create(() => Ok());

        await rates.GetAsync(CancellationToken.None);
        clock.Advance(TimeSpan.FromHours(5));
        await rates.GetAsync(CancellationToken.None);
        var requestsWithinSixHours = site.Requests;
        clock.Advance(TimeSpan.FromHours(2));
        await rates.GetAsync(CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(requestsWithinSixHours, Is.EqualTo(1), "five hours on, the same rates are served");
            Assert.That(site.Requests, Is.EqualTo(2), "seven hours on, it asks again: the survey comes out weekly");
        });
    }

    [Test]
    public async Task ManyAtOnce_AreOneRequest()
    {
        var (rates, site, _) = Create(() => Ok());

        await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => rates.GetAsync(CancellationToken.None)));

        Assert.That(site.Requests, Is.EqualTo(1), "twenty visitors at once do not make twenty requests");
    }

    [Test]
    public async Task WhenTheSiteFails_NothingIsReturned_AndItIsNotAskedAgainForAWhile()
    {
        var (rates, site, clock) = Create(() => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

        var first = await rates.GetAsync(CancellationToken.None);
        clock.Advance(TimeSpan.FromMinutes(5));
        await rates.GetAsync(CancellationToken.None);
        var soon = site.Requests;
        clock.Advance(TimeSpan.FromMinutes(10));
        await rates.GetAsync(CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(first, Is.Null, "no rates to offer");
            Assert.That(soon, Is.EqualTo(1), "five minutes on, it has not asked again: a failing site is not hammered");
            Assert.That(site.Requests, Is.EqualTo(2), "fifteen minutes on, it tries once more");
        });
    }

    [Test]
    public async Task WhenTheSiteFailsAfterWorking_TheLastRatesAreStillServed()
    {
        var works = true;
        var (rates, _, clock) = Create(() => works ? Ok() : new HttpResponseMessage(HttpStatusCode.BadGateway));
        await rates.GetAsync(CancellationToken.None);

        works = false;
        clock.Advance(TimeSpan.FromHours(7));
        var average = await rates.GetAsync(CancellationToken.None);

        Assert.That(average?.ThirtyYearFixed, Is.EqualTo(7.41m), "last week's rate is better than none, and it says which week it is");
    }

    [Test]
    public async Task AnErrorPageInsteadOfTheSurvey_IsNotAnAverageRate()
    {
        var (rates, _, _) = Create(() => Ok("<html>Access denied</html>"));

        Assert.That(await rates.GetAsync(CancellationToken.None), Is.Null, "nothing is better than a wrong rate");
    }

    [Test]
    public async Task WhenSwitchedOff_ItNeverAsks()
    {
        var (rates, site, _) = Create(() => Ok(), enabled: false);

        var average = await rates.GetAsync(CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(average, Is.Null, "no rates");
            Assert.That(site.Requests, Is.EqualTo(0), "and no request to anyone: a deployment that must not call out can say so");
        });
    }

    [Test]
    public async Task ASiteThatNeverAnswers_IsGivenUpOn_SoNobodyWaits()
    {
        using var hang = new CancellationTokenSource();
        var site = new HangingSite();
        var rates = new FreddieMacAverageRates(new HttpClient(site), TestClock.Create(),
            Options.Create(new RatesOptions { Enabled = true, SourceUrl = "https://example.test/pmms.csv", TimeoutSeconds = 1 }));

        var average = await rates.GetAsync(CancellationToken.None);

        Assert.That(average, Is.Null, "after its timeout it gives up and the page goes on without a rate");
    }

    private sealed class HangingSite : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}
