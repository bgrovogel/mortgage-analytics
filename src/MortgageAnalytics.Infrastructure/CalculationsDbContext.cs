using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Infrastructure;

/// <summary>The app's database: user accounts (ASP.NET Core Identity's tables) and their saved calculations.</summary>
/// <param name="options">Provider and connection, set by <see cref="DependencyInjection.AddInfrastructure"/> or a test.</param>
public sealed class CalculationsDbContext(DbContextOptions<CalculationsDbContext> options) : IdentityDbContext<IdentityUser>(options)
{
    // The same JSON shape the API uses, so a stored row reads like the request that created it.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    /// <summary>Every saved calculation.</summary>
    public DbSet<SavedCalculation> SavedCalculations => Set<SavedCalculation>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder); // Identity's users, roles and claims

        var calculation = builder.Entity<SavedCalculation>();

        calculation.HasKey(c => c.Id);
        calculation.Property(c => c.Name).HasMaxLength(SaveCalculationRequestValidator.MaxNameLength).IsRequired();

        // Each kind of inputs is one JSON column: they are always read and written whole, never queried by
        // field, and the contracts can grow without a schema change. A row holds one kind; the other is null.
        calculation.Property(c => c.Inputs).HasConversion(JsonConverter<AmortizationRequest>(), JsonComparer<AmortizationRequest>());
        calculation.Property(c => c.Refinance).HasConversion(JsonConverter<RefinanceRequest>(), JsonComparer<RefinanceRequest>());
        calculation.Ignore(c => c.Kind);

        // SQLite cannot sort DateTimeOffset values, so they are stored as sortable 64-bit numbers.
        calculation.Property(c => c.CreatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        calculation.Property(c => c.UpdatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        // Every query filters by owner and sorts by update time.
        calculation.Property(c => c.OwnerId).HasMaxLength(450).IsRequired();
        calculation.HasIndex(c => new { c.OwnerId, c.UpdatedAt });
        calculation.HasOne<IdentityUser>().WithMany().HasForeignKey(c => c.OwnerId).OnDelete(DeleteBehavior.Cascade);
    }

    private static ValueConverter<T?, string?> JsonConverter<T>() where T : class =>
        new(value => value == null ? null : JsonSerializer.Serialize(value, Json),
            json => json == null ? null : JsonSerializer.Deserialize<T>(json, Json));

    // Compares the JSON, so replacing the inputs with an equal copy is not seen as a change.
    private static ValueComparer<T?> JsonComparer<T>() where T : class =>
        new((a, b) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(b, Json),
            value => JsonSerializer.Serialize(value, Json).GetHashCode(StringComparison.Ordinal),
            value => value == null ? null : JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Json), Json));
}
