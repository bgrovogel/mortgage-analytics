using System.Text.Json;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Infrastructure;

/// <summary>
/// The app's database: user accounts (ASP.NET Core Identity's tables), their saved calculations, and the keys that sign
/// sessions and emailed links (when they are kept here, so every instance of the app shares them). The model is here;
/// each provider has a context of its own, <see cref="SqliteCalculationsDbContext"/> and
/// <see cref="PostgresCalculationsDbContext"/>, because a migration is written for one provider.
/// </summary>
/// <param name="options">The provider and connection, from the derived context.</param>
public abstract class CalculationsDbContext(DbContextOptions options) : IdentityDbContext<IdentityUser>(options), IDataProtectionKeyContext
{
    private static readonly JsonSerializerOptions Json = StoredJson.Options;

    /// <summary>Every saved calculation.</summary>
    public DbSet<SavedCalculation> SavedCalculations => Set<SavedCalculation>();

    /// <summary>The keys that sign session cookies and emailed codes, when <c>DataProtection:Store</c> is <c>Database</c>.</summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder); // Identity's users, roles and claims

        var calculation = builder.Entity<SavedCalculation>();

        calculation.HasKey(c => c.Id);
        calculation.Property(c => c.Name).HasMaxLength(SaveCalculationRequestValidator.MaxNameLength).IsRequired();

        // Each kind of inputs is one JSON column: they are always read and written whole, never queried by
        // field, and the contracts can grow without a schema change. A row holds one kind; the others are null
        // (a home comparison is the calculator's inputs and a second home, of the same shape).
        // Each is stamped with its format version and upgraded as it loads (StoredJson).
        calculation.Property(c => c.Inputs).HasConversion(JsonConverter<AmortizationRequest>(), JsonComparer<AmortizationRequest>());
        calculation.Property(c => c.SecondHome).HasConversion(JsonConverter<AmortizationRequest>(), JsonComparer<AmortizationRequest>());
        calculation.Property(c => c.Refinance).HasConversion(JsonConverter<RefinanceRequest>(), JsonComparer<RefinanceRequest>());
        calculation.Property(c => c.Strategy).HasConversion(JsonConverter<StrategyRequest>(), JsonComparer<StrategyRequest>());
        calculation.Ignore(c => c.Kind);

        // SQLite cannot sort DateTimeOffset values, so they are stored as sortable 64-bit numbers.
        calculation.Property(c => c.CreatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        calculation.Property(c => c.UpdatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        // Every query filters by owner and sorts by update time.
        calculation.Property(c => c.OwnerId).HasMaxLength(450).IsRequired();
        calculation.HasIndex(c => new { c.OwnerId, c.UpdatedAt });
        calculation.HasOne<IdentityUser>().WithMany().HasForeignKey(c => c.OwnerId).OnDelete(DeleteBehavior.Cascade);
    }

    private static ValueConverter<T?, string?> JsonConverter<T>() where T : class
    {
        var format = new StoredJson<T>();
        return new(value => value == null ? null : format.Write(value), json => json == null ? null : format.Read(json));
    }

    // Compares the JSON, so replacing the inputs with an equal copy is not seen as a change.
    private static ValueComparer<T?> JsonComparer<T>() where T : class =>
        new((a, b) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(b, Json),
            value => JsonSerializer.Serialize(value, Json).GetHashCode(StringComparison.Ordinal),
            value => value == null ? null : JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Json), Json));
}
