namespace MortgageAnalytics.Application.SavedCalculations;

/// <summary>
/// Storage for saved calculations. The application layer defines what it needs; the infrastructure
/// layer decides how (EF Core and SQLite), so this layer has no database dependency.
/// </summary>
public interface ISavedCalculationRepository
{
    /// <summary>Lists saved calculations, most recently changed first.</summary>
    /// <param name="search">Keeps only names containing this text, ignoring case. Null or blank keeps all.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The matching calculations.</returns>
    Task<IReadOnlyList<SavedCalculation>> ListAsync(string? search, CancellationToken cancellationToken);

    /// <summary>Finds one by id.</summary>
    /// <param name="id">The id.</param>
    /// <param name="cancellationToken">Cancels the query.</param>
    /// <returns>The calculation, or null when there is none with that id.</returns>
    Task<SavedCalculation?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Adds a new saved calculation.</summary>
    /// <param name="calculation">The calculation to add.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once it is stored.</returns>
    Task AddAsync(SavedCalculation calculation, CancellationToken cancellationToken);

    /// <summary>Writes the changes made to a calculation returned by <see cref="FindAsync"/>.</summary>
    /// <param name="calculation">The changed calculation.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the changes are stored.</returns>
    Task UpdateAsync(SavedCalculation calculation, CancellationToken cancellationToken);

    /// <summary>Deletes one by id.</summary>
    /// <param name="id">The id.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>False when there was nothing to delete.</returns>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
