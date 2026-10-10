using Microsoft.AspNetCore.Http.HttpResults;
using MortgageAnalytics.Api.Filters;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Application.SavedCalculations;

namespace MortgageAnalytics.Api.Endpoints;

/// <summary>
/// The HTTP surface for saved calculations: list (with search), get, save, replace and delete.
/// Like the amortization endpoints, these only translate between HTTP and the application service.
/// </summary>
public static class SavedCalculationEndpoints
{
    private const string NotFoundTitle = "There is no saved calculation with that id.";

    /// <summary>Maps every saved-calculation endpoint under <c>/api/v1/calculations</c>.</summary>
    /// <param name="routes">The application's route builder.</param>
    /// <returns>The same route builder, for chaining.</returns>
    public static IEndpointRouteBuilder MapSavedCalculationEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/calculations")
            .WithTags("Saved calculations")
            .ProducesProblem(StatusCodes.Status500InternalServerError);

        group.MapGet("/", List)
            .WithName("ListCalculations")
            .WithSummary("List saved calculations, most recently changed first.")
            .WithDescription("Pass search to keep only names that contain it, ignoring case.");

        group.MapGet("/{id:guid}", Get)
            .WithName("GetCalculation")
            .WithSummary("Get one saved calculation.");

        group.MapPost("/", Save)
            .WithName("SaveCalculation")
            .WithSummary("Save a calculation under a name.")
            .WithDescription("The inputs must pass the same rules as the calculate endpoint.")
            .AddEndpointFilter<ValidationFilter<SaveCalculationRequest>>()
            .ProducesValidationProblem();

        group.MapPut("/{id:guid}", Update)
            .WithName("UpdateCalculation")
            .WithSummary("Rename a saved calculation, or replace its inputs.")
            .AddEndpointFilter<ValidationFilter<SaveCalculationRequest>>()
            .ProducesValidationProblem();

        group.MapDelete("/{id:guid}", Delete)
            .WithName("DeleteCalculation")
            .WithSummary("Delete a saved calculation.");

        return routes;
    }

    private static async Task<Ok<IReadOnlyList<SavedCalculationResponse>>> List(
        ISavedCalculationService service, CancellationToken cancellationToken, string? search = null) =>
        TypedResults.Ok(await service.ListAsync(search, cancellationToken));

    private static async Task<Results<Ok<SavedCalculationResponse>, ProblemHttpResult>> Get(
        Guid id, ISavedCalculationService service, CancellationToken cancellationToken) =>
        await service.GetAsync(id, cancellationToken) is { } found ? TypedResults.Ok(found) : NotFound();

    private static async Task<Created<SavedCalculationResponse>> Save(
        SaveCalculationRequest request, ISavedCalculationService service, CancellationToken cancellationToken)
    {
        var saved = await service.SaveAsync(request, cancellationToken);
        return TypedResults.Created($"/api/v1/calculations/{saved.Id}", saved);
    }

    private static async Task<Results<Ok<SavedCalculationResponse>, ProblemHttpResult>> Update(
        Guid id, SaveCalculationRequest request, ISavedCalculationService service, CancellationToken cancellationToken) =>
        await service.UpdateAsync(id, request, cancellationToken) is { } updated ? TypedResults.Ok(updated) : NotFound();

    private static async Task<Results<NoContent, ProblemHttpResult>> Delete(
        Guid id, ISavedCalculationService service, CancellationToken cancellationToken) =>
        await service.DeleteAsync(id, cancellationToken) ? TypedResults.NoContent() : NotFound();

    private static ProblemHttpResult NotFound() =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: NotFoundTitle);
}
