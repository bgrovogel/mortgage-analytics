using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;
using Testcontainers.PostgreSql;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// The storage on a real PostgreSQL server, in a throwaway container (Testcontainers, so Docker must be running).
/// Tagged so CI leaves them out, to keep its minutes for the gates; run them locally with
/// <c>dotnet test --filter TestCategory=Postgres</c>.
/// </summary>
[TestFixture]
[Category("Postgres")]
public class PostgresTests
{
    private PostgreSqlContainer _server = null!;

    [OneTimeSetUp]
    public async Task StartServer()
    {
        _server = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await _server.StartAsync();
        await using var context = NewContext();
        await context.Database.MigrateAsync();
        context.Users.AddRange(new IdentityUser { Id = "alice-id", UserName = "alice" }, new IdentityUser { Id = "bob-id", UserName = "bob" });
        await context.SaveChangesAsync();
    }

    [OneTimeTearDown]
    public async Task StopServer() => await _server.DisposeAsync();

    private PostgresCalculationsDbContext NewContext() =>
        new(new DbContextOptionsBuilder<PostgresCalculationsDbContext>().UseNpgsql(_server.GetConnectionString()).Options);

    private static SavedCalculation Saved(string name, string owner) => new()
    {
        Id = Guid.CreateVersion7(TestClock.Now), OwnerId = owner, Name = name, Inputs = A.Request.Build(),
        CreatedAt = TestClock.Now, UpdatedAt = TestClock.Now,
    };

    [Test]
    public async Task TheMigrationsBuildTheWholeSchema_AndASaveRoundTrips()
    {
        var saved = Saved("Oak St", "alice-id");
        await using (var context = NewContext())
        {
            context.SavedCalculations.Add(saved);
            await context.SaveChangesAsync();
        }

        var found = await new SavedCalculationRepository(NewContext()).FindAsync("alice-id", saved.Id, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.Name, Is.EqualTo("Oak St"), "the name is stored");
            Assert.That(found?.Inputs, Is.EqualTo(saved.Inputs), "and every input, through the same JSON column");
            Assert.That(found?.UpdatedAt, Is.EqualTo(saved.UpdatedAt), "and the time, exactly");
        });
    }

    [Test]
    public async Task EachOwnerSeesOnlyTheirOwn_AndDeletingAUserCascades()
    {
        await using (var context = NewContext())
        {
            context.Users.Add(new IdentityUser { Id = "carol-id", UserName = "carol" });
            context.SavedCalculations.AddRange(Saved("Carol's", "carol-id"), Saved("Bob's", "bob-id"));
            await context.SaveChangesAsync();
        }

        var bobs = await new SavedCalculationRepository(NewContext()).ListAsync("bob-id", null, CancellationToken.None);
        await using (var context = NewContext())
        {
            context.Users.Remove(await context.Users.SingleAsync(u => u.Id == "carol-id"));
            await context.SaveChangesAsync();
        }

        await using var check = NewContext();
        Assert.Multiple(async () =>
        {
            Assert.That(bobs.Select(c => c.Name), Is.EqualTo(new[] { "Bob's" }), "an owner lists only their own");
            Assert.That(await check.SavedCalculations.AnyAsync(c => c.OwnerId == "carol-id"), Is.False, "a deleted user's saves go with them");
        });
    }

    [Test]
    public async Task ASearch_IgnoresCase_OnPostgreSqlToo()
    {
        await using (var context = NewContext())
        {
            context.SavedCalculations.Add(Saved("Maple AVENUE", "alice-id"));
            await context.SaveChangesAsync();
        }

        var found = await new SavedCalculationRepository(NewContext()).ListAsync("alice-id", "avenue", CancellationToken.None);

        Assert.That(found.Select(c => c.Name), Has.Member("Maple AVENUE"), "PostgreSQL compares case-sensitively unless told otherwise");
    }

    [Test]
    public async Task ASavedSecondHome_BecomesTheOnlyOtherHome_AndComesBackOnTheWayDown()
    {
        // Back to before lists, a comparison saved the old way, then up again: the migration's own SQL moves it.
        const string beforeLists = "20261014005039_PostgresAddHomeComparisons";
        var id = Guid.CreateVersion7(TestClock.Now);
        var second = A.Request.Build() with { HomePrice = 450_000m, DownPayment = 90_000m };
        var format = new StoredJson<AmortizationRequest>();
        var at = (long)new DateTimeOffsetToBinaryConverter().ConvertToProvider(TestClock.Now)!;
        await using (var context = NewContext())
        {
            await context.GetService<IMigrator>().MigrateAsync(beforeLists);
            await context.Database.ExecuteSqlAsync(
                $"INSERT INTO \"SavedCalculations\" (\"Id\", \"OwnerId\", \"Name\", \"Inputs\", \"SecondHome\", \"CreatedAt\", \"UpdatedAt\") VALUES ({id}, 'alice-id', 'Oak St or Elm St', {format.Write(A.Request.Build())}, {format.Write(second)}, {at}, {at})");
            await context.GetService<IMigrator>().MigrateAsync();
        }

        var found = await new SavedCalculationRepository(NewContext()).FindAsync("alice-id", id, CancellationToken.None);
        string down;
        await using (var context = NewContext())
        {
            await context.GetService<IMigrator>().MigrateAsync(beforeLists);
            down = await context.Database.SqlQuery<string>($"SELECT \"SecondHome\" AS \"Value\" FROM \"SavedCalculations\" WHERE \"Id\" = {id}").SingleAsync();
            await context.GetService<IMigrator>().MigrateAsync();
        }

        Assert.Multiple(() =>
        {
            Assert.That(found?.OtherHomes, Is.EqualTo(new[] { second }), "a list of one, every value kept");
            Assert.That(format.Read(down), Is.EqualTo(second), "and one home again on the way down");
        });
    }
}
