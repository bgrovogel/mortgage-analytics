using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.OpenApi;
using MortgageAnalytics.Api.Email;
using MortgageAnalytics.Api.Endpoints;
using MortgageAnalytics.Api.Errors;
using MortgageAnalytics.Api.Observability;
using MortgageAnalytics.Api.Security;
using MortgageAnalytics.Application;
using MortgageAnalytics.Application.Contracts;
using MortgageAnalytics.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration.GetConnectionString("Calculations")
    ?? throw new InvalidOperationException("Set ConnectionStrings:Calculations to a SQLite connection string."));
builder.Services.AddAccounts(builder.Configuration, builder.Environment);
builder.Services.AddEmail(builder.Configuration);

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// A 30-year analysis is about 270 KB of JSON, sent again after each pause in typing; Brotli or gzip makes it a
// fraction of that. Safe over HTTPS too (BREACH needs a secret in the compressed body, and the session is a cookie
// header, never in one).
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = RequestLogging.AddRequestIdToProblems);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddHealthChecks();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Mortgage Analytics API",
        Version = "v1",
        Description = "Home-purchase and mortgage analysis: fixed-rate amortization, extra payments and recasting, "
            + "property taxes with homestead exemptions and the appraisal cap, PMI, insurance and HOA, a yearly cost projection, "
            + "refinance comparisons, and paying the mortgage off versus investing.",
    });

    // Pull /// comments (summaries and <example> values) from the API and the contracts assembly.
    foreach (var assembly in new[] { Assembly.GetExecutingAssembly(), typeof(AmortizationRequest).Assembly })
    {
        var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{assembly.GetName().Name}.xml");
        if (File.Exists(xmlPath))
            options.IncludeXmlComments(xmlPath);
    }
});

var app = builder.Build();

// Create the saved-calculations database, or apply new migrations, before taking requests.
await app.Services.MigrateDatabaseAsync();

// First, so the request id is on every log line and response, and the request's line has its final status.
app.UseRequestLogging();
app.UseSecurityHeaders();
app.UseResponseCompression();
app.UseExceptionHandler();
app.UseStatusCodePages();

// API docs are part of the showcase, so they are served in every environment.
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Mortgage Analytics API v1");
    options.DocumentTitle = "Mortgage Analytics API";
});

// In the container the Angular build is copied into wwwroot, so one process serves both.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health");
app.MapAmortizationEndpoints();
app.MapAccountEndpoints();
// Development only: lists the emails in the local outbox, so sign-up and password reset can be demoed
// without a mail server. Never in Production: it would show every user's links.
if (app.Environment.IsDevelopment())
    app.MapDevOutbox();
app.MapSavedCalculationEndpoints();
app.MapRefinanceEndpoints();
app.MapStrategyEndpoints();

// Unknown API routes must 404 as JSON, not fall through to the SPA's index.html.
app.Map("/api/{**path}", () => TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "API endpoint not found."));
app.MapFallbackToFile("index.html");

await app.RunAsync();

/// <summary>Exposed so integration tests can host the app with <c>WebApplicationFactory</c>.</summary>
public partial class Program;
