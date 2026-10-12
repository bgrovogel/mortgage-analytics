using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace MortgageAnalytics.Api.IntegrationTests.Infrastructure;

/// <summary>One log entry as the API wrote it: its category, level, message, structured values and scopes.</summary>
/// <param name="Category">The logger's category, usually the writing class.</param>
/// <param name="Level">How serious it is.</param>
/// <param name="Message">The formatted message.</param>
/// <param name="Values">The message's structured values, by name.</param>
/// <param name="ScopeValues">Every structured value of the scopes it was written in, by name.</param>
/// <param name="Exception">The exception logged with it, if any.</param>
public sealed record LogEntry(
    string Category, LogLevel Level, string Message, IReadOnlyDictionary<string, object?> Values,
    IReadOnlyDictionary<string, object?> ScopeValues, Exception? Exception);

/// <summary>A logger provider that keeps everything the API logs, with its scopes, for tests to read.</summary>
public sealed class CapturedLogs : ILoggerProvider, ISupportExternalScope
{
    private readonly ConcurrentQueue<LogEntry> _entries = new();
    private IExternalScopeProvider _scopes = new LoggerExternalScopeProvider();

    /// <summary>Every entry so far, oldest first.</summary>
    public IReadOnlyList<LogEntry> Entries => [.. _entries];

    /// <inheritdoc />
    public ILogger CreateLogger(string categoryName) => new Logger(categoryName, this);

    /// <inheritdoc />
    public void SetScopeProvider(IExternalScopeProvider scopeProvider) => _scopes = scopeProvider;

    /// <inheritdoc />
    public void Dispose()
    {
    }

    private static Dictionary<string, object?> ValuesOf(object? state) =>
        state is IEnumerable<KeyValuePair<string, object?>> pairs
            ? pairs.Where(p => p.Key != "{OriginalFormat}").GroupBy(p => p.Key).ToDictionary(g => g.Key, g => g.Last().Value)
            : [];

    private sealed class Logger(string category, CapturedLogs owner) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => owner._scopes.Push(state);

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var scopeValues = new Dictionary<string, object?>();
            owner._scopes.ForEachScope((scope, values) =>
            {
                foreach (var (key, value) in ValuesOf(scope))
                    values[key] = value;
            }, scopeValues);
            owner._entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception), ValuesOf(state), scopeValues, exception));
        }
    }
}
