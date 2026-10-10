using Microsoft.AspNetCore.Diagnostics;

namespace MortgageAnalytics.Api.Errors;

/// <summary>
/// The last line of defense: turns unhandled exceptions into ProblemDetails responses that never
/// leak internal details.
/// </summary>
/// <remarks>
/// A request the server could not read keeps its own status (400, 413, ...). Anything else is the
/// server's fault and becomes a generic 500. That includes a broken domain rule: input is validated
/// before it reaches the domain, so a domain guard firing means a bug, and its message is internal.
/// </remarks>
/// <param name="problemDetails">Writes RFC 9457 problem responses.</param>
/// <param name="logger">Records server-side failures.</param>
public sealed partial class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    /// <summary>Maps <paramref name="exception"/> to a status code and writes a ProblemDetails body.</summary>
    /// <returns>True when a response was written, so the exception is considered handled.</returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception is BadHttpRequestException badRequest
            ? (badRequest.StatusCode, "The request could not be read.")
            : (StatusCodes.Status500InternalServerError, "An unexpected error occurred.");

        if (status >= StatusCodes.Status500InternalServerError)
            LogUnhandled(logger, exception, httpContext.Request.Method, httpContext.Request.Path);

        httpContext.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = { Status = status, Title = title },
        });
    }

    /// <summary>Logs a server-side failure. Source-generated, so there is no boxing or template parsing at runtime.</summary>
    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception for {Method} {Path}")]
    private static partial void LogUnhandled(ILogger logger, Exception exception, string method, string path);
}
