using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MortgageAnalytics.Infrastructure.Backups;

/// <summary>Where backups go, how often, and how many are kept (the <c>Backups</c> settings).</summary>
/// <param name="Enabled">False leaves backups to the platform (a managed volume's snapshots, say).</param>
/// <param name="Directory">The folder the copies are written to.</param>
/// <param name="Interval">The least time between two copies.</param>
/// <param name="Keep">How many copies are kept; older ones are deleted.</param>
public sealed record BackupOptions(bool Enabled, string Directory, TimeSpan Interval, int Keep);

/// <summary>
/// Copies the database to a timestamped file once the last copy is old enough, and deletes all but the newest few.
/// The copy is SQLite's <c>VACUUM INTO</c>: one consistent snapshot, taken while the app keeps serving, that opens on
/// its own (no <c>-wal</c> file needed). Restoring is copying one back while the app is stopped.
/// </summary>
/// <param name="scopes">Opens a database context for each copy.</param>
/// <param name="options">The <c>Backups</c> settings.</param>
/// <param name="clock">Decides when a copy is due and names it.</param>
/// <param name="logger">Records each copy.</param>
public sealed partial class DatabaseBackup(IServiceScopeFactory scopes, BackupOptions options, TimeProvider clock, ILogger<DatabaseBackup> logger)
{
    private const string Prefix = "calculations-";
    private const string Extension = ".db";
    private const string StampFormat = "yyyyMMdd'T'HHmmss'Z'";

    /// <summary>Takes a copy if none has been taken within the interval, then prunes to the number kept.</summary>
    /// <param name="cancellationToken">Cancels the copy.</param>
    /// <returns>The new copy's path, or null when none was due (or backups are off).</returns>
    public async Task<string?> BackUpIfDueAsync(CancellationToken cancellationToken)
    {
        if (!options.Enabled)
            return null;

        var now = clock.GetUtcNow();
        Directory.CreateDirectory(options.Directory);
        var existing = Existing();
        if (existing.Count > 0 && now - existing[^1].TakenAt < options.Interval)
            return null;

        var path = Path.Combine(options.Directory, Prefix + now.UtcDateTime.ToString(StampFormat, CultureInfo.InvariantCulture) + Extension);
        await using (var scope = scopes.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CalculationsDbContext>();
            await db.Database.ExecuteSqlAsync($"VACUUM INTO {path}", cancellationToken);
        }
        LogBackedUp(logger, path);

        foreach (var old in Existing().SkipLast(options.Keep))
            File.Delete(old.Path);
        return path;
    }

    /// <summary>The copies in the folder, oldest first, with when each was taken (from its name; other files are left alone).</summary>
    private List<(string Path, DateTimeOffset TakenAt)> Existing() =>
        [.. Directory.GetFiles(options.Directory, Prefix + "*" + Extension)
            .Select(path => (Path: path, TakenAt: TakenAt(path)))
            .Where(f => f.TakenAt is not null)
            .Select(f => (f.Path, f.TakenAt!.Value))
            .OrderBy(f => f.Item2)];

    private static DateTimeOffset? TakenAt(string path) =>
        DateTimeOffset.TryParseExact(Path.GetFileNameWithoutExtension(path)[Prefix.Length..], StampFormat, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var takenAt) ? takenAt : null;

    [LoggerMessage(Level = LogLevel.Information, Message = "Backed up the database to {Path}")]
    private static partial void LogBackedUp(ILogger logger, string path);
}
