using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MortgageAnalytics.Infrastructure.Backups;

/// <summary>
/// Runs <see cref="DatabaseBackup"/> when the app starts and then every hour; a copy is taken only when one is due, so
/// restarts never pile up copies. A failed copy is logged and tried again next hour; it never stops the app.
/// </summary>
/// <param name="backup">Takes the copies.</param>
/// <param name="clock">Paces the checks.</param>
/// <param name="logger">Records failures.</param>
public sealed partial class DatabaseBackupService(DatabaseBackup backup, TimeProvider clock, ILogger<DatabaseBackupService> logger) : BackgroundService
{
    /// <summary>How often to check whether a copy is due.</summary>
    private static readonly TimeSpan CheckEvery = TimeSpan.FromHours(1);

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckEvery, clock);
        do
        {
            try
            {
                await backup.BackUpIfDueAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                LogFailed(logger, exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Backing up the database failed; it will be tried again within the hour")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
