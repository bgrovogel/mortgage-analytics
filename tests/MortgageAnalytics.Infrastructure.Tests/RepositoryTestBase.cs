using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// Base class for storage tests: a real SQLite database, in memory, built by the real migrations.
/// Each test gets a fresh database. Reads go through a new <see cref="CalculationsDbContext"/>, so a
/// test sees what was actually written to the database, not what one context has cached.
/// </summary>
public abstract class RepositoryTestBase
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    // An in-memory SQLite database lives as long as its first connection, so the base class holds one open.
    private SqliteConnection _connection = null!;

    [SetUp]
    public void CreateDatabase()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        using var context = NewContext();
        context.Database.Migrate();
        // Saved calculations belong to real users (a foreign key), so the test owners exist.
        context.Users.AddRange(new IdentityUser { Id = Alice, UserName = "alice" }, new IdentityUser { Id = Bob, UserName = "bob" });
        context.SaveChanges();
    }

    [TearDown]
    public void DropDatabase() => _connection.Dispose();

    /// <summary>A new context on the test's database.</summary>
    protected CalculationsDbContext NewContext() =>
        new SqliteCalculationsDbContext(new DbContextOptionsBuilder<SqliteCalculationsDbContext>().UseSqlite(_connection).Options);

    /// <summary>A repository on a new context, the way each HTTP request gets one.</summary>
    protected SavedCalculationRepository NewRepository() => new(NewContext());

    /// <summary>The owner most tests save as.</summary>
    protected const string Alice = "alice-id";

    /// <summary>Another owner, for tests that keep owners apart.</summary>
    protected const string Bob = "bob-id";

    /// <summary>A saved calculation with the given name, saved at <see cref="TestClock.Now"/> plus <paramref name="minutesLater"/>.</summary>
    protected static SavedCalculation ACalculation(string name = "Oak St", int minutesLater = 0, AmortizationRequest? inputs = null, string owner = Alice)
    {
        var at = TestClock.Now.AddMinutes(minutesLater);
        return new SavedCalculation
        {
            Id = Guid.CreateVersion7(at), OwnerId = owner, Name = name, Inputs = inputs ?? A.Request.Build(), CreatedAt = at, UpdatedAt = at,
        };
    }

    /// <summary>Saves calculations through a repository of their own.</summary>
    protected async Task SeedAsync(params SavedCalculation[] calculations)
    {
        foreach (var calculation in calculations)
            await NewRepository().AddAsync(calculation, CancellationToken.None);
    }

    /// <summary>Inputs as JSON, for comparing two requests field by field (records compare lists by reference).</summary>
    protected static string JsonOf(AmortizationRequest request) => JsonSerializer.Serialize(request, Json);
}
