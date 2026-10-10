using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.OpenApi;
using MortgageAnalytics.Api.Endpoints;
using MortgageAnalytics.Api.Errors;
using MortgageAnalytics.Application;
using MortgageAnalytics.Application.Contracts;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
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
            + "property taxes with homestead exemptions and the appraisal cap, PMI, insurance and HOA, and a yearly cost projection.",
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

app.MapHealthChecks("/health");
app.MapAmortizationEndpoints();

// Unknown API routes must 404 as JSON, not fall through to the SPA's index.html.
app.Map("/api/{**path}", () => TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "API endpoint not found."));
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>Exposed so integration tests can host the app with <c>WebApplicationFactory</c>.</summary>
public partial class Program;
