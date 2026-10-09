using System.Text.Json;
using FluentValidation;

namespace MortgageAnalytics.Api.Filters;

/// <summary>
/// Generic endpoint filter that validates the <typeparamref name="TRequest"/> argument and
/// short-circuits with an RFC 9457 validation problem. One filter serves every endpoint (DRY).
/// </summary>
/// <typeparam name="TRequest">The request body type to validate.</typeparam>
/// <param name="validator">The FluentValidation validator for <typeparamref name="TRequest"/>.</param>
public sealed class ValidationFilter<TRequest>(IValidator<TRequest> validator) : IEndpointFilter
{
    /// <summary>Validates the request. Returns a 400 problem if it is invalid; otherwise calls the endpoint.</summary>
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.Arguments.OfType<TRequest>().FirstOrDefault();
        if (request is null)
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "A request body is required.");

        var result = await validator.ValidateAsync(request, context.HttpContext.RequestAborted);
        if (result.IsValid)
            return await next(context);

        var errors = result.ToDictionary().ToDictionary(e => ToJsonPath(e.Key), e => e.Value);
        return TypedResults.ValidationProblem(errors);
    }

    /// <summary>"ExtraPayments.LumpSums[0].Amount" becomes "extraPayments.lumpSums[0].amount", matching the JSON body.</summary>
    private static string ToJsonPath(string propertyPath) =>
        string.Join('.', propertyPath.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));
}
