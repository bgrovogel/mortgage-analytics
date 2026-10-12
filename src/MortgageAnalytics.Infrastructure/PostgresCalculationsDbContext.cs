using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MortgageAnalytics.Infrastructure;

/// <summary>
/// The app's database on PostgreSQL: the same model as <see cref="SqliteCalculationsDbContext"/>, with migrations of its own
/// (<c>Migrations/Postgres</c>), because a migration is written for one provider. Chosen with
/// <c>Database:Provider = Postgres</c>, for more than one writer and more than one instance of the app.
/// </summary>
/// <param name="options">The PostgreSQL connection.</param>
public sealed class PostgresCalculationsDbContext(DbContextOptions<PostgresCalculationsDbContext> options) : CalculationsDbContext(options);

/// <summary>
/// Lets <c>dotnet ef</c> build the PostgreSQL context without a server, to add a migration:
/// <c>dotnet ef migrations add Name --context PostgresCalculationsDbContext --output-dir Migrations/Postgres
/// --project src/MortgageAnalytics.Infrastructure --startup-project src/MortgageAnalytics.Api</c>.
/// </summary>
public sealed class PostgresDesignTimeFactory : IDesignTimeDbContextFactory<PostgresCalculationsDbContext>
{
    /// <inheritdoc />
    public PostgresCalculationsDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<PostgresCalculationsDbContext>().UseNpgsql("Host=localhost;Database=calculations").Options);
}

