using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace MortgageAnalytics.Infrastructure;

/// <summary>The stored format of saved calculations, which every JSON column is written in.</summary>
public static class StoredJson
{
    /// <summary>
    /// The format the app writes. Version 1 is the request's JSON as the API takes it. A change that renames, removes
    /// or reshapes a field raises this and adds an upgrade from the old version (<see cref="StoredJson{T}"/>), so
    /// every earlier save still loads; adding a field needs neither, as old saves load it as its default.
    /// </summary>
    public const int CurrentVersion = 1;

    /// <summary>The JSON property holding a save's format version.</summary>
    internal const string VersionProperty = "formatVersion";

    /// <summary>The same JSON shape the API uses, so a stored row reads like the request that created it.</summary>
    internal static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    /// <summary>A JSON array of <paramref name="values"/>, each written by <paramref name="format"/>.</summary>
    public static string WriteList<T>(IEnumerable<T> values, StoredJson<T> format) where T : class =>
        new JsonArray([.. values.Select(value => JsonNode.Parse(format.Write(value)))]).ToJsonString(Options);

    /// <summary>Reads a JSON array of saves, each by <paramref name="format"/>, so each is upgraded on its own.</summary>
    public static IReadOnlyList<T> ReadList<T>(string stored, StoredJson<T> format) where T : class =>
        [.. JsonNode.Parse(stored)!.AsArray().Select(item => format.Read(item!.ToJsonString(Options)))];
}

/// <summary>
/// Writes a <typeparamref name="T"/> as JSON stamped with the current format version, and reads it back, first
/// upgrading a save from an older version step by step. A save with no version predates versions, so it is version 1.
/// A save from a newer version is refused rather than read with values missing.
/// </summary>
/// <typeparam name="T">What is stored.</typeparam>
public sealed class StoredJson<T> where T : class
{
    private readonly int _currentVersion;
    private readonly IReadOnlyDictionary<int, Action<JsonObject>> _upgrades;

    /// <summary>Creates the format at <paramref name="currentVersion"/>, with one upgrade per earlier version.</summary>
    /// <param name="currentVersion">The version written.</param>
    /// <param name="upgrades">For each version from 1 below the current, the change that takes a save to the next version.</param>
    /// <exception cref="ArgumentException">An upgrade is missing, which would load some saves wrongly.</exception>
    public StoredJson(int currentVersion = StoredJson.CurrentVersion, IReadOnlyDictionary<int, Action<JsonObject>>? upgrades = null)
    {
        _currentVersion = currentVersion;
        _upgrades = upgrades ?? new Dictionary<int, Action<JsonObject>>();
        var missing = Enumerable.Range(1, currentVersion - 1).Where(version => !_upgrades.ContainsKey(version)).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"No upgrade from format {string.Join(", ", missing)} to the next.", nameof(upgrades));
    }

    /// <summary>The JSON for <paramref name="value"/>, stamped with the current version.</summary>
    public string Write(T value)
    {
        var json = JsonSerializer.SerializeToNode(value, StoredJson.Options)!.AsObject();
        json[StoredJson.VersionProperty] = _currentVersion;
        return json.ToJsonString(StoredJson.Options);
    }

    /// <summary>Reads a save of any version up to the current one.</summary>
    /// <exception cref="InvalidOperationException">The save is from a newer version than this app knows.</exception>
    public T Read(string stored)
    {
        var json = JsonNode.Parse(stored)!.AsObject();
        var version = json[StoredJson.VersionProperty]?.GetValue<int>() ?? 1;
        if (version > _currentVersion)
            throw new InvalidOperationException(
                $"This save is in format {version}, written by a newer version of the app; this one reads up to format {_currentVersion}.");

        json.Remove(StoredJson.VersionProperty);
        for (; version < _currentVersion; version++)
            _upgrades[version](json);
        return json.Deserialize<T>(StoredJson.Options)!;
    }
}
