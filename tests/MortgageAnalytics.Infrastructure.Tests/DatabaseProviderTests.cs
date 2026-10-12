using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MortgageAnalytics.Infrastructure.Backups;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// The database is SQLite unless configured as PostgreSQL, each with its own migrations; either can hold the keys that
/// sign sessions, so several instances of the app can share them. These need no PostgreSQL server: see
/// <see cref="PostgresTests"/> for the ones that run against a real one.
/// </summary>
[TestFixture]
public class DatabaseProviderTests : RepositoryTestBase
{
    private static ServiceProvider Services(DatabaseProvider provider, string connectionString) =>
        new ServiceCollection().AddLogging().AddInfrastructure(connectionString, provider).BuildServiceProvider();

    [Test]
    public void SqliteIsTheDefault()
    {
        using var services = new ServiceCollection().AddLogging().AddInfrastructure("Data Source=:memory:").BuildServiceProvider();
        using var scope = services.CreateScope();

        Assert.That(scope.ServiceProvider.GetRequiredService<CalculationsDbContext>().Database.ProviderName, Is.EqualTo("Microsoft.EntityFrameworkCore.Sqlite"),
            "one file, no server: the demo's database");
    }

    [Test]
    public void PostgreSql_IsChosenByConfiguration_WithItsOwnContextAndMigrations()
    {
        using var services = Services(DatabaseProvider.Postgres, "Host=localhost;Database=calculations");
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CalculationsDbContext>();

        Assert.Multiple(() =>
        {
            Assert.That(context, Is.TypeOf<PostgresCalculationsDbContext>(), "the context whose migrations are PostgreSQL's");
            Assert.That(context.Database.ProviderName, Is.EqualTo("Npgsql.EntityFrameworkCore.PostgreSQL"), "on Npgsql");
            Assert.That(context.Database.GetMigrations(), Has.Some.Contains("Postgres"), "with the PostgreSQL migrations, not SQLite's");
        });
    }

    [Test]
    public void ThePostgresMigrations_MatchTheModel()
    {
        using var context = new PostgresCalculationsDbContext(
            new DbContextOptionsBuilder<PostgresCalculationsDbContext>().UseNpgsql("Host=unused").Options);

        Assert.That(context.Database.HasPendingModelChanges(), Is.False,
            "run `dotnet ef migrations add <Name> --context PostgresCalculationsDbContext --output-dir Migrations/Postgres` after changing the model");
    }

    [Test]
    public async Task TheKeysThatSignSessions_CanBeKeptInTheDatabase()
    {
        await using (var context = NewContext())
        {
            context.DataProtectionKeys.Add(new DataProtectionKey { FriendlyName = "key-1", Xml = "<key />" });
            await context.SaveChangesAsync();
        }

        await using var check = NewContext();
        Assert.That(await check.DataProtectionKeys.Select(k => k.FriendlyName).ToListAsync(), Is.EqualTo(new[] { "key-1" }),
            "a table the migrations create, so every instance reads the same keys");
    }

    [Test]
    public void BackupsAreLeftToPostgreSql()
    {
        var configuration = new ConfigurationBuilder().Build();
        using var services = new ServiceCollection().AddLogging().AddSingleton(TimeProvider.System)
            .AddInfrastructure("Host=localhost", DatabaseProvider.Postgres)
            .AddDatabaseBackups(configuration, "Host=localhost", DatabaseProvider.Postgres)
            .BuildServiceProvider();

        Assert.That(services.GetRequiredService<BackupOptions>().Enabled, Is.False,
            "the app's backups copy a SQLite file; PostgreSQL has pg_dump and its host's snapshots");
    }
}
