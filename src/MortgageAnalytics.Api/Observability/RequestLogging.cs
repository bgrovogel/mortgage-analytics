namespace MortgageAnalytics.Api.Observability;

/// <summary>
/// Gives every request an id and logs it once. The id is the caller's <c>X-Request-ID</c> when that is safe to reuse
/// (a proxy's or client's, so their logs and ours line up), or a new one. It goes back in the response's
/// <c>X-Request-ID</c>, into every error body (see <see cref="AddRequestIdToProblems"/>), and on every log line written
/// while the request runs, so one failure can be followed from the browser to the logs.
/// </summary>
public static class RequestLogging
{
    /// <summary>The header that carries the request id, both ways.</summary>
    public const string Header = "X-Request-ID";

    /// <summary>The longest caller id reused; anything longer is replaced.</summary>
    private const int MaxLength = 64;

    /// <summary>Adds the middleware. Put it first, so it sees the final status of every request, errors included.</summary>
    /// <param name="app">The application's pipeline.</param>
    /// <returns>The same pipeline, for chaining.</returns>
    public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder app) => app.UseMiddleware<RequestLoggingMiddleware>();

    /// <summary>Puts the request id in every RFC 9457 problem body, as <c>requestId</c>.</summary>
    /// <param name="context">The problem being written.</param>
    public static void AddRequestIdToProblems(ProblemDetailsContext context) =>
        context.ProblemDetails.Extensions["requestId"] = context.HttpContext.TraceIdentifier;

    /// <summary>
    /// The caller's id when it is short and made only of letters, digits and <c>-_.:</c> (nothing that could forge a
    /// log field or line); otherwise a new one.
    /// </summary>
    internal static string IdFor(HttpRequest request)
    {
        var incoming = request.Headers[Header].ToString();
        return incoming.Length is > 0 and <= MaxLength && incoming.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.' or ':')
            ? incoming
            : Guid.NewGuid().ToString("N");
    }
}

/// <summary>
/// The request id and the one log line per request. API requests are logged at Information; health checks and static
/// files only at Debug, so they don't drown the lines that matter. The path is logged without its query string, which
/// can hold the codes from emailed links.
/// </summary>
/// <param name="next">The rest of the pipeline.</param>
/// <param name="logger">Where the lines go.</param>
/// <param name="clock">Times each request.</param>
internal sealed partial class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger, TimeProvider clock)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var id = RequestLogging.IdFor(context.Request);
        context.TraceIdentifier = id;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[RequestLogging.Header] = id;
            return Task.CompletedTask;
        });

        using var scope = logger.BeginScope(new Dictionary<string, object> { ["RequestId"] = id });
        var started = clock.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var path = context.Request.PathBase + context.Request.Path;
            var level = path.StartsWithSegments("/api") ? LogLevel.Information : LogLevel.Debug;
            if (logger.IsEnabled(level))
            {
                var elapsed = Math.Round(clock.GetElapsedTime(started).TotalMilliseconds, 1);
                LogRequest(logger, level, context.Request.Method, path.Value ?? "/", context.Response.StatusCode, elapsed, id);
            }
        }
    }

    [LoggerMessage(Message = "{Method} {Path} responded {StatusCode} in {ElapsedMilliseconds} ms (request {RequestId})")]
    private static partial void LogRequest(ILogger logger, LogLevel level, string method, string path, int statusCode, double elapsedMilliseconds, string requestId);
}
