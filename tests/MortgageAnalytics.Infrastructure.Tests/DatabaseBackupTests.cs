using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using MortgageAnalytics.Infrastructure.Backups;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// Automatic backups: a consistent copy of the database (SQLite's <c>VACUUM INTO</c>, safe while the app runs) once
/// a day, keeping the newest few. Each test has its own database file and backup folder, and a clock it moves.
/// </summary>
[TestFixture]
public class DatabaseBackupTests
{
    private string _folder = null!;
    private string _database = null!;
    private FakeTimeProvider _clock = null!;

    [SetUp]
    public async Task CreateDatabase()
    {
        _folder = Path.Combine(Path.GetTempPath(), $"backup-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_folder);
        _database = Path.Combine(_folder, "calculations.db");
        _clock = TestClock.Create();
        await using var services = Services();
        await services.MigrateDatabaseAsync();
    }

    [TearDown]
    public void DeleteFolder()
    {
        SqliteConnection.ClearAllPools();
        Directory.Delete(_folder, recursive: true);
    }

    private string BackupFolder => Path.Combine(_folder, "backups");

    private string[] Backups() =>
        Directory.Exists(BackupFolder) ? [.. Directory.GetFiles(BackupFolder).Select(Path.GetFileName).Order()!] : [];

    private ServiceProvider Services(Dictionary<string, string?>? settings = null) =>
        new ServiceCollection()
            .AddLogging()
            .AddSingleton<TimeProvider>(_clock)
            .AddInfrastructure($"Data Source={_database}")
            .AddDatabaseBackups(new ConfigurationBuilder().AddInMemoryCollection(settings ?? []).Build(), $"Data Source={_database}")
            .BuildServiceProvider();

    private async Task BackUpIfDueAsync(Dictionary<string, string?>? settings = null)
    {
        await using var services = Services(settings);
        await services.GetRequiredService<DatabaseBackup>().BackUpIfDueAsync(CancellationToken.None);
    }

    [Test]
    public async Task TheFirstBackup_IsAWholeCopy_ThatOpensOnItsOwn()
    {
        await using (var services = Services())
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<CalculationsDbContext>();
            db.Users.Add(new Microsoft.AspNetCore.Identity.IdentityUser { Id = "alice-id", UserName = "alice" });
            await db.SaveChangesAsync();
        }

        await BackUpIfDueAsync();

        await using var copy = new CalculationsDbContext(
            new DbContextOptionsBuilder<CalculationsDbContext>().UseSqlite($"Data Source={Path.Combine(BackupFolder, Backups().Single())}").Options);
        Assert.Multiple(async () =>
        {
            Assert.That(Backups(), Is.EqualTo(new[] { "calculations-20261009T153000Z.db" }), "one copy, named for when it was taken (UTC)");
            Assert.That(await copy.Users.Select(u => u.UserName).ToListAsync(), Is.EqualTo(new[] { "alice" }), "it holds the data, and opens without the original");
        });
    }

    [Test]
    public async Task ANewBackup_WaitsUntilTheLastIsADayOld()
    {
        await BackUpIfDueAsync();
        _clock.Advance(TimeSpan.FromHours(23));
        await BackUpIfDueAsync();
        var afterADay = Backups().Length;
        _clock.Advance(TimeSpan.FromHours(1));
        await BackUpIfDueAsync();

        Assert.Multiple(() =>
        {
            Assert.That(afterADay, Is.EqualTo(1), "23 hours on, the last copy is recent enough, so restarts don't pile up copies");
            Assert.That(Backups(), Has.Length.EqualTo(2), "24 hours on, it is time for the next");
        });
    }

    [Test]
    public async Task OnlyTheNewestAreKept()
    {
        var settings = new Dictionary<string, string?> { ["Backups:Keep"] = "3" };
        for (var day = 0; day < 5; day++)
        {
            await BackUpIfDueAsync(settings);
            _clock.Advance(TimeSpan.FromDays(1));
        }

        Assert.That(Backups(), Is.EqualTo(new[]
        {
            "calculations-20261011T153000Z.db", "calculations-20261012T153000Z.db", "calculations-20261013T153000Z.db",
        }), "the oldest are deleted, so the folder never grows past the number kept");
    }

    [Test]
    public async Task HowOftenAndWhere_AreSettings()
    {
        var elsewhere = Path.Combine(_folder, "elsewhere");
        var settings = new Dictionary<string, string?> { ["Backups:Directory"] = elsewhere, ["Backups:IntervalHours"] = "6" };

        await BackUpIfDueAsync(settings);
        _clock.Advance(TimeSpan.FromHours(6));
        await BackUpIfDueAsync(settings);

        Assert.Multiple(() =>
        {
            Assert.That(Directory.GetFiles(elsewhere), Has.Length.EqualTo(2), "every six hours, into the folder given");
            Assert.That(Backups(), Is.Empty, "and nothing beside the database");
        });
    }

    [Test]
    public async Task SwitchedOff_TakesNoBackups()
    {
        await BackUpIfDueAsync(new Dictionary<string, string?> { ["Backups:Enabled"] = "false" });

        Assert.That(Backups(), Is.Empty, "backups can be left to the platform instead (a managed volume's snapshots)");
    }
}
