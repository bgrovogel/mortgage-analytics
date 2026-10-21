using Microsoft.Extensions.Options;
using MortgageAnalytics.Application.Rates;

namespace MortgageAnalytics.Api.Rates;

/// <summary>
/// The average rates, read from Freddie Mac's weekly survey. The survey comes out once a week, so the rates are kept for
/// hours and a page is never a request to another site; many visitors at once make one. When the site cannot be reached
/// the last rates it gave are still served (the response says which week they are for), and a failing site is tried again
/// only every few minutes, never hammered. Nothing of any visitor is sent.
/// </summary>
/// <param name="http">The client that asks the site.</param>
/// <param name="clock">The time, for how long the rates are kept.</param>
/// <param name="options">Whether to ask at all, where, and how long to wait.</param>
public sealed class FreddieMacAverageRates(HttpClient http, TimeProvider clock, IOptions<RatesOptions> options) : IAverageRates, IDisposable
{
    private static readonly TimeSpan KeepFor = TimeSpan.FromHours(6);
    private static readonly TimeSpan TryAgainAfter = TimeSpan.FromMinutes(10);

    private readonly SemaphoreSlim _one = new(1, 1);
    private AverageRates? _last;
    private DateTimeOffset _askAgainAt = DateTimeOffset.MinValue;

    /// <inheritdoc />
    public async Task<AverageRates?> GetAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
            return null;
        if (clock.GetUtcNow() < _askAgainAt)
            return _last;

        await _one.WaitAsync(cancellationToken);
        try
        {
            var now = clock.GetUtcNow();
            if (now < _askAgainAt)
                return _last;

            var read = await ReadAsync(settings, cancellationToken);
            if (read is not null)
                _last = read;
            _askAgainAt = now + (read is null ? TryAgainAfter : KeepFor);
            return _last;
        }
        finally
        {
            _one.Release();
        }
    }

    /// <inheritdoc />
    public void Dispose() => _one.Dispose();

    private async Task<AverageRates?> ReadAsync(RatesOptions settings, CancellationToken cancellationToken)
    {
        using var giveUp = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        giveUp.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        try
        {
            return PmmsCsv.Parse(await http.GetStringAsync(settings.SourceUrl, giveUp.Token));
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // Unreachable, refused or too slow: no new rates, which is not an error for anyone.
            return null;
        }
    }
}
