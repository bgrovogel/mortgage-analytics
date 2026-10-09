using Microsoft.AspNetCore.Diagnostics;
using MortgageAnalytics.Domain;

namespace MortgageAnalytics.Api.Errors;

/// <summary>
/// The last line of defense: turns unhandled exceptions into ProblemDetails responses that never
/// leak stack traces. Malformed JSON gets a 400; a broken domain invariant is logged as a bug.
/// </summary>
/// <param name="problemDetails">Writes RFC 9457 problem responses.</param>
/// <param name="logger">Records unexpected failures.</param>
public sealed partial class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    /// <summary>Maps <paramref name="exception"/> to a status code and writes a ProblemDetails body.</summary>
    /// <returns>True when a response was written, so the exception is considered handled.</returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "The request body could not be read."),
            DomainValidationException => (StatusCodes.Status422UnprocessableEntity, exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred."),
        };

        if (status >= StatusCodes.Status500InternalServerError || exception is DomainValidationException)
            LogUnhandled(logger, exception, httpContext.Request.Method, httpContext.Request.Path);

        httpContext.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = { Status = status, Title = title },
        });
    }

    /// <summary>Logs an unhandled exception. Source-generated, so there is no boxing or template parsing at runtime.</summary>
    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception for {Method} {Path}")]
    private static partial void LogUnhandled(ILogger logger, Exception exception, string method, string path);
}
