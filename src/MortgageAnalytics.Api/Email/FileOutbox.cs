using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MortgageAnalytics.Api.Email;

/// <summary>
/// The local outbox: with no mail server configured, each email is written as a JSON file. A local run,
/// the end-to-end tests and the development mailbox page all read them from there, so sign-up and password
/// reset work without any mail infrastructure.
/// </summary>
public sealed class FileOutbox : IMailTransport
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly string _directory;
    private long _sequence;

    /// <summary>Creates the outbox in the configured directory (relative paths are under the content root).</summary>
    /// <param name="options">The email settings.</param>
    /// <param name="environment">Supplies the content root.</param>
    public FileOutbox(IOptions<EmailOptions> options, IHostEnvironment environment)
    {
        _directory = Path.GetFullPath(options.Value.OutboxDirectory, environment.ContentRootPath);
    }

    /// <inheritdoc />
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        // Time, then a sequence number, so files sort in sending order even within one clock tick;
        // a GUID so two app instances writing to one folder never collide.
        var name = $"{message.SentAt.UtcTicks:D19}-{Interlocked.Increment(ref _sequence):D10}-{Guid.NewGuid():N}.json";
        var path = Path.Combine(_directory, name);

        // Write to a temporary file, then rename it into place: a reader sees a whole email or none.
        var temporary = path + ".tmp";
        await using (var file = File.Create(temporary))
            await JsonSerializer.SerializeAsync(file, message, Json, cancellationToken);
        File.Move(temporary, path);
    }

    /// <summary>Every email in the outbox, newest first.</summary>
    /// <param name="cancellationToken">Cancels reading.</param>
    /// <returns>The emails.</returns>
    public async Task<IReadOnlyList<EmailMessage>> ReadAllAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_directory))
            return [];

        var messages = new List<EmailMessage>();
        foreach (var path in Directory.EnumerateFiles(_directory, "*.json").OrderDescending(StringComparer.Ordinal))
        {
            try
            {
                await using var file = File.OpenRead(path);
                if (await JsonSerializer.DeserializeAsync<EmailMessage>(file, Json, cancellationToken) is { } message)
                    messages.Add(message);
            }
            catch (Exception ex) when (ex is JsonException or IOException)
            {
                // A file someone edited or a clear in progress: skip it rather than fail the whole mailbox.
            }
        }

        return messages;
    }

    /// <summary>Deletes every email in the outbox (for a fresh demo).</summary>
    public void Clear()
    {
        if (!Directory.Exists(_directory))
            return;
        foreach (var path in Directory.EnumerateFiles(_directory, "*.json"))
            File.Delete(path);
    }
}
