using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;
using MortgageAnalytics.Application.Validation;

namespace MortgageAnalytics.Infrastructure;

/// <summary>The database of saved calculations.</summary>
/// <param name="options">Provider and connection, set by <see cref="DependencyInjection.AddInfrastructure"/> or a test.</param>
public sealed class CalculationsDbContext(DbContextOptions<CalculationsDbContext> options) : DbContext(options)
{
    // The same JSON shape the API uses, so a stored row reads like the request that created it.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    /// <summary>Every saved calculation.</summary>
    public DbSet<SavedCalculation> SavedCalculations => Set<SavedCalculation>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var calculation = modelBuilder.Entity<SavedCalculation>();

        calculation.HasKey(c => c.Id);
        calculation.Property(c => c.Name).HasMaxLength(SaveCalculationRequestValidator.MaxNameLength).IsRequired();

        // The inputs are one JSON column: they are always read and written whole, never queried by field,
        // and the request contract can grow without a schema change. The comparer compares the JSON, so
        // replacing the inputs with an equal copy is not seen as a change.
        calculation.Property(c => c.Inputs)
            .HasConversion(
                inputs => JsonSerializer.Serialize(inputs, Json),
                json => JsonSerializer.Deserialize<AmortizationRequest>(json, Json)!,
                new ValueComparer<AmortizationRequest>(
                    (a, b) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(b, Json),
                    inputs => JsonSerializer.Serialize(inputs, Json).GetHashCode(StringComparison.Ordinal),
                    inputs => JsonSerializer.Deserialize<AmortizationRequest>(JsonSerializer.Serialize(inputs, Json), Json)!))
            .IsRequired();

        // SQLite cannot sort DateTimeOffset values, so they are stored as sortable 64-bit numbers.
        calculation.Property(c => c.CreatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        calculation.Property(c => c.UpdatedAt).HasConversion(new DateTimeOffsetToBinaryConverter());
        calculation.HasIndex(c => c.UpdatedAt);
    }
}
