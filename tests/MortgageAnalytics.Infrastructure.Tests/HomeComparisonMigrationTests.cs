using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// A comparison saved when it held one second home (a <c>SecondHome</c> column) still opens once the database is
/// migrated to compare up to four homes (an <c>OtherHomes</c> list), and migrating back keeps that home. The migrations
/// move the data with SQL of their own, so a real SQLite database checks it.
/// </summary>
[TestFixture]
public class HomeComparisonMigrationTests
{
    private const string BeforeLists = "20261014005028_AddHomeComparisons";
    private static readonly Guid Id = Guid.CreateVersion7(TestClock.Now);

    private SqliteConnection _connection = null!;

    [SetUp]
    public void Open()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    [TearDown]
    public void Close() => _connection.Dispose();

    private SqliteCalculationsDbContext NewContext() =>
        new(new DbContextOptionsBuilder<SqliteCalculationsDbContext>().UseSqlite(_connection).Options);

    private async Task MigrateToAsync(string? migration = null)
    {
        await using var context = NewContext();
        await context.GetService<IMigrator>().MigrateAsync(migration);
    }

    /// <summary>A saved comparison as the app wrote it before lists: the second home stamped like any save.</summary>
    private async Task SaveTheOldWayAsync(AmortizationRequest first, AmortizationRequest second)
    {
        var format = new StoredJson<AmortizationRequest>();
        var at = (long)new DateTimeOffsetToBinaryConverter().ConvertToProvider(TestClock.Now)!;
        await using var context = NewContext();
        await context.Database.ExecuteSqlAsync($"INSERT INTO AspNetUsers (Id, UserName, AccessFailedCount, EmailConfirmed, LockoutEnabled, PhoneNumberConfirmed, TwoFactorEnabled) VALUES ('alice-id', 'alice', 0, 0, 0, 0, 0)");
        await context.Database.ExecuteSqlAsync(
            $"INSERT INTO SavedCalculations (Id, OwnerId, Name, Inputs, SecondHome, CreatedAt, UpdatedAt) VALUES ({Id.ToString().ToUpperInvariant()}, 'alice-id', 'Oak St or Elm St', {format.Write(first)}, {format.Write(second)}, {at}, {at})");
    }

    [Test]
    public async Task ASavedSecondHome_BecomesTheOnlyOtherHome()
    {
        var first = A.Request.Build();
        var second = A.Request.Build() with { HomePrice = 450_000m, DownPayment = 90_000m };
        await MigrateToAsync(BeforeLists);
        await SaveTheOldWayAsync(first, second);

        await MigrateToAsync();
        var found = await new SavedCalculationRepository(NewContext()).FindAsync("alice-id", Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.OtherHomes, Has.Count.EqualTo(1), "a list of one");
            Assert.That(found?.OtherHomes?[0], Is.EqualTo(second), "holding the second home, every value kept");
            Assert.That(found?.Inputs, Is.EqualTo(first), "and the first home as it was");
            Assert.That(found?.Kind, Is.EqualTo(SavedCalculationKind.HomeComparison), "still a comparison");
        });
    }

    [Test]
    public async Task MigratingBack_KeepsTheFirstOtherHome_AsTheSecondHome()
    {
        var second = A.Request.Build() with { HomePrice = 450_000m };
        await MigrateToAsync(BeforeLists);
        await SaveTheOldWayAsync(A.Request.Build(), second);
        await MigrateToAsync();

        await MigrateToAsync(BeforeLists);
        await using var context = NewContext();
        var stored = await context.Database.SqlQuery<string>($"SELECT SecondHome AS Value FROM SavedCalculations").SingleAsync();

        Assert.That(new StoredJson<AmortizationRequest>().Read(stored), Is.EqualTo(second), "one home again, as the old app stored it");
    }
}
