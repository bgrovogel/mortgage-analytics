using MortgageAnalytics.Application.Contracts;

namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>Saving, finding, renaming and deleting named calculations.</summary>
public interface ISavedCalculationService
{
    /// <summary>Lists saved calculations, most recently changed first, optionally filtered by name.</summary>
    /// <param name="search">Keeps only names containing this text, ignoring case.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The matching calculations.</returns>
    Task<IReadOnlyList<SavedCalculationResponse>> ListAsync(string? search, CancellationToken cancellationToken);

    /// <summary>Returns one saved calculation.</summary>
    /// <param name="id">The id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The calculation, or null when there is none with that id.</returns>
    Task<SavedCalculationResponse?> GetAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Saves a new calculation from an already-validated request.</summary>
    /// <param name="request">The name and inputs.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The saved calculation, with its new id.</returns>
    Task<SavedCalculationResponse> SaveAsync(SaveCalculationRequest request, CancellationToken cancellationToken);

    /// <summary>Replaces a saved calculation's name and inputs.</summary>
    /// <param name="id">The id.</param>
    /// <param name="request">The new name and inputs, already validated.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The updated calculation, or null when there is none with that id.</returns>
    Task<SavedCalculationResponse?> UpdateAsync(Guid id, SaveCalculationRequest request, CancellationToken cancellationToken);

    /// <summary>Deletes a saved calculation.</summary>
    /// <param name="id">The id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>False when there was none with that id.</returns>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>
/// Stamps times from <see cref="TimeProvider"/> (so tests can pin them), trims names, and maps between
/// the stored entity and the API contract. Storage itself is behind <see cref="ISavedCalculationRepository"/>.
/// </summary>
/// <param name="repository">Where calculations are stored.</param>
/// <param name="clock">Supplies the save and update times.</param>
public sealed class SavedCalculationService(ISavedCalculationRepository repository, TimeProvider clock) : ISavedCalculationService
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<SavedCalculationResponse>> ListAsync(string? search, CancellationToken cancellationToken)
    {
        var calculations = await repository.ListAsync(search, cancellationToken);
        return [.. calculations.Select(ToResponse)];
    }

    /// <inheritdoc />
    public async Task<SavedCalculationResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var calculation = await repository.FindAsync(id, cancellationToken);
        return calculation is null ? null : ToResponse(calculation);
    }

    /// <inheritdoc />
    public async Task<SavedCalculationResponse> SaveAsync(SaveCalculationRequest request, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var calculation = new SavedCalculation
        {
            Id = Guid.CreateVersion7(now),
            Name = request.Name.Trim(),
            Inputs = request.Inputs,
            Refinance = request.Refinance,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await repository.AddAsync(calculation, cancellationToken);
        return ToResponse(calculation);
    }

    /// <inheritdoc />
    public async Task<SavedCalculationResponse?> UpdateAsync(Guid id, SaveCalculationRequest request, CancellationToken cancellationToken)
    {
        var calculation = await repository.FindAsync(id, cancellationToken);
        if (calculation is null)
            return null;

        calculation.Name = request.Name.Trim();
        calculation.Inputs = request.Inputs;
        calculation.Refinance = request.Refinance;
        calculation.UpdatedAt = clock.GetUtcNow();

        await repository.UpdateAsync(calculation, cancellationToken);
        return ToResponse(calculation);
    }

    /// <inheritdoc />
    public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken) =>
        repository.DeleteAsync(id, cancellationToken);

    private static SavedCalculationResponse ToResponse(SavedCalculation calculation) => new()
    {
        Id = calculation.Id,
        Name = calculation.Name,
        Kind = calculation.Kind,
        Inputs = calculation.Inputs,
        Refinance = calculation.Refinance,
        CreatedAt = calculation.CreatedAt,
        UpdatedAt = calculation.UpdatedAt,
    };
}
