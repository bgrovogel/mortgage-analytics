using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MortgageAnalytics.Infrastructure;

/// <summary>
/// The app's database in a SQLite file, with the migrations in <c>Migrations/</c>. The default, and the demo's.
/// </summary>
/// <param name="options">The SQLite connection, set by <see cref="DependencyInjection.AddInfrastructure"/> or a test.</param>
public sealed class SqliteCalculationsDbContext(DbContextOptions<SqliteCalculationsDbContext> options) : CalculationsDbContext(options);

/// <summary>
/// Lets <c>dotnet ef</c> build the SQLite context, to add a migration:
/// <c>dotnet ef migrations add Name --context SqliteCalculationsDbContext --project src/MortgageAnalytics.Infrastructure
/// --startup-project src/MortgageAnalytics.Api</c>.
/// </summary>
public sealed class SqliteDesignTimeFactory : IDesignTimeDbContextFactory<SqliteCalculationsDbContext>
{
    /// <inheritdoc />
    public SqliteCalculationsDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<SqliteCalculationsDbContext>().UseSqlite("Data Source=design-time.db").Options);
}
