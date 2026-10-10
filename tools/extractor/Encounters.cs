using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>Location id -> English name, per location set. Shared by encounters.json and gifts.json; written as locations.json.</summary>
public sealed class LocationTable
{
    private readonly SortedDictionary<string, SortedDictionary<int, string>> _sets = new(StringComparer.Ordinal);
    private readonly Dictionary<(string Set, ushort Id, bool Egg), string> _cache = [];
    private readonly List<string> _unresolved = [];
    /// <summary>How each named id was looked up, so the same lookup can be repeated in another language (localized.json).</summary>
    private readonly SortedDictionary<string, SortedDictionary<int, (bool Egg, byte Generation, GameVersion Version)>> _lookups = new(StringComparer.Ordinal);

    public int Count => _sets.Sum(z => z.Value.Count);
    public IReadOnlyList<string> Unresolved => _unresolved;

    /// <summary>Looks the name up exactly as PKHeX does for a Pokémon still in its origin generation (format = generation).</summary>
    public string Resolve(string set, ushort id, bool egg, byte generation, GameVersion version, Func<string> describe)
    {
        if (_cache.TryGetValue((set, id, egg), out var cached))
            return cached;
        var name = GameInfo.GetLocationName(egg, id, generation, generation, version) ?? string.Empty;
        _cache[(set, id, egg)] = name;
        if (name.Length == 0)
        {
            _unresolved.Add($"{set} #{id}{(egg ? " (egg)" : "")}: {describe()}");
            return name;
        }
        if (!_sets.TryGetValue(set, out var names))
            _sets[set] = names = [];
        // One table per set only works if an id never means two things inside it (egg and met ids share number ranges).
        if (names.TryGetValue(id, out var existing) && existing != name)
            throw Guard.Fail($"Location set {set} id {id} resolves to both \"{existing}\" and \"{name}\"; the set needs to be split.");
        names[id] = name;
        if (!_lookups.TryGetValue(set, out var lookups))
            _lookups[set] = lookups = [];
        lookups[id] = (egg, generation, version);
        return name;
    }

    /// <summary>The same table as <see cref="ToJson"/>, read from another language's strings. Same sets, same ids.</summary>
    public Obj Localize(GameStrings strings)
    {
        var root = new Obj();
        foreach (var (set, lookups) in _lookups)
        {
            var table = new Obj();
            foreach (var (id, (egg, generation, version)) in lookups)
                table.Add(id.ToString(System.Globalization.CultureInfo.InvariantCulture), strings.GetLocationName(egg, (ushort)id, generation, generation, version) ?? string.Empty);
            root.Add(set, table);
        }
        return root;
    }

    public Obj ToJson()
    {
        var root = new Obj();
        foreach (var (set, names) in _sets)
        {
            var table = new Obj();
            foreach (var (id, name) in names)
                table.Add(id.ToString(System.Globalization.CultureInfo.InvariantCulture), name);
            root.Add(set, table);
        }
        return root;
    }

    public Obj Counts()
    {
        var o = new Obj();
        foreach (var (set, names) in _sets)
            o.Add(set, names.Count);
        return o;
    }
}

/// <summary>Per game, per kind: how many templates went in and how many aggregated rows came out.</summary>
public sealed class KindStats
{
    private readonly Dictionary<(int Game, string Kind), (int Templates, int Rows)> _cells = [];
    private readonly Dictionary<string, (int Templates, int Rows)> _kinds = new(StringComparer.Ordinal);

    public void Add(int[] games, string kind, int templates, int rows)
    {
        foreach (var g in games)
        {
            var cell = _cells.GetValueOrDefault((g, kind));
            _cells[(g, kind)] = (cell.Templates + templates, cell.Rows + rows);
        }
        var total = _kinds.GetValueOrDefault(kind);
        _kinds[kind] = (total.Templates + templates, total.Rows + rows);
    }

    public IEnumerable<string> Kinds => _kinds.Keys.OrderBy(z => z, StringComparer.Ordinal);
    public (int Templates, int Rows) Kind(string kind) => _kinds.GetValueOrDefault(kind);
    public (int Templates, int Rows) Cell(int game, string kind) => _cells.GetValueOrDefault((game, kind));
    public (int Templates, int Rows) Game(int game)
    {
        int t = 0, r = 0;
        foreach (var (key, value) in _cells)
        {
            if (key.Game != game)
                continue;
            t += value.Templates;
            r += value.Rows;
        }
        return (t, r);
    }
}

public sealed class EncounterDump
{
    public required Obj Json;
    public required int Templates;
    public required int Rows;
    public required KindStats Stats;
    /// <summary>Resolved rows before aggregation, one per template. balls.json reads their fixed balls.</summary>
    public required IReadOnlyList<Row> Resolved;
    public required Obj Vocabulary;
}

/// <summary>encounters.json: every non-GO, non-mystery-gift template, with rows that only differ by level merged.</summary>
public static class Encounters
{
    public static EncounterDump Build(IReadOnlyList<Item> items, LocationTable locations)
    {
        var resolved = new List<Row>(items.Count);
        var noGame = new List<string>();
        foreach (var it in items)
        {
            var row = Resolver.Resolve(it);
            if (row.Games.Length == 0 && noGame.Count < 20)
                noGame.Add($"{row.Clr} species={row.Species} version={it.Enc.Version} source={row.Source}");
            var e = it.Enc;
            var version = Resolver.LocationVersion(e);
            foreach (var id in row.Locations)
                locations.Resolve(row.Set, id, row.EggLocation, e.Generation, version, () => Describe(it));
            foreach (var id in row.AltLocations)
                locations.Resolve(row.Set, id, false, e.Generation, version, () => Describe(it));
            resolved.Add(row);
        }
        Guard.Require(noGame.Count == 0, $"Templates that map to no game (first {noGame.Count}): {string.Join("; ", noGame)}");

        // Group on every emitted field except the level range.
        var groups = new Dictionary<string, Group>(resolved.Count / 2, StringComparer.Ordinal);
        foreach (var row in resolved)
        {
            var key = Json.Serialize(ToJson(row, 0, 0, 0, null));
            if (!groups.TryGetValue(key, out var group))
                groups[key] = group = new Group(row, key);
            group.Count++;
            group.Levels.Add((row.LevelMin, row.LevelMax));
        }

        var ordered = groups.Values
            .OrderBy(z => z.First.Species)
            .ThenBy(z => z.First.Form)
            .ThenBy(z => z.First.Games[0])
            .ThenBy(z => z.Key, StringComparer.Ordinal)
            .ToList();

        var stats = new KindStats();
        var rows = new List<Obj>(ordered.Count);
        foreach (var group in ordered)
        {
            var segments = group.Segments();
            rows.Add(ToJson(group.First, segments[0][0], segments[^1][1], group.Count, segments.Count > 1 ? segments : null));
            stats.Add(group.First.Games, group.First.Kind, group.Count, 1);
        }

        var json = new Obj
        {
            ["games"] = Games.Order,
            ["rows"] = rows,
        };
        return new EncounterDump
        {
            Json = json,
            Templates = resolved.Count,
            Rows = rows.Count,
            Stats = stats,
            Resolved = resolved,
            Vocabulary = Vocabulary(resolved),
        };
    }

    private sealed class Group(Row first, string key)
    {
        public readonly Row First = first;
        public readonly string Key = key;
        public int Count;
        public readonly SortedSet<(int Min, int Max)> Levels = [];

        /// <summary>The merged templates' level ranges as disjoint, ascending [min, max] segments.</summary>
        public List<int[]> Segments()
        {
            var result = new List<int[]>();
            foreach (var (min, max) in Levels)
            {
                if (result.Count != 0 && min <= result[^1][1] + 1)
                    result[^1][1] = Math.Max(result[^1][1], max);
                else
                    result.Add([min, max]);
            }
            return result;
        }
    }

    private static string Describe(Item it)
        => $"{it.Enc.GetType().Name} {(Species)it.Enc.Species} gen={it.Enc.Generation} version={it.Enc.Version} source={it.Source}";

    private static Obj ToJson(Row r, int levelMin, int levelMax, int count, List<int[]>? levelSegments)
    {
        var o = new Obj
        {
            ["g"] = r.Games,
            ["s"] = (int)r.Species,
            ["f"] = (int)r.Form,
            ["l"] = new[] { levelMin, levelMax },
        };
        // Only when the merged templates leave gaps, e.g. a static met at 20 or at 70 but never in between.
        if (levelSegments is not null) o["ls"] = levelSegments;
        o["k"] = r.Kind;
        o["t"] = r.Clr;
        o["src"] = r.Source;
        if (r.Method is not null) o["m"] = r.Method;
        o["x"] = r.Set;
        if (r.Locations.Length != 0) o["L"] = r.Locations.Select(z => (int)z);
        if (r.AltLocations.Length != 0) o["A"] = r.AltLocations.Select(z => (int)z);
        if (r.EggLocation) o["e"] = 1;
        if (r.Shiny is not null) o["h"] = r.Shiny;
        if (r.Ball != 0) o["b"] = r.Ball;
        if (r.Gender >= 0) o["d"] = r.Gender;
        if (r.Conditions is not null) o["c"] = r.Conditions;
        if (r.IsEgg) o["egg"] = 1;
        if (r.Nickname is not null) o["nick"] = r.Nickname;
        if (r.Trainer is not null) o["tr"] = r.Trainer;
        if (r.Distribution is not null) o["dist"] = r.Distribution;
        if (r.Ot is not null) o["ot"] = r.Ot;
        if (r.Ots is not null) o["ots"] = r.Ots;
        o["label"] = r.Label;
        o["n"] = count;
        return o;
    }

    /// <summary>Every enumerated string the rows actually use, so SCHEMA.md can be checked against real output.</summary>
    private static Obj Vocabulary(List<Row> rows)
    {
        static List<string> Distinct(IEnumerable<string?> values)
            => [.. values.Where(z => z is not null).Select(z => z!).Distinct(StringComparer.Ordinal).OrderBy(z => z, StringComparer.Ordinal)];

        // Per condition key: its value type, and for strings the values seen.
        var conditionValues = new SortedDictionary<string, SortedSet<string>>(StringComparer.Ordinal);
        var conditionTypes = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (row.Conditions is null)
                continue;
            foreach (var (key, value) in row.Conditions)
            {
                if (!conditionValues.TryGetValue(key, out var set))
                    conditionValues[key] = set = new SortedSet<string>(StringComparer.Ordinal);
                string type;
                switch (value)
                {
                    case string s: set.Add(s); type = "string"; break;
                    case IEnumerable<string> list:
                        foreach (var s in list) set.Add(s);
                        type = "string[]";
                        break;
                    case bool: type = "true"; break;
                    case int: type = "number"; break;
                    case int[]: type = "number[]"; break;
                    default: throw Guard.Fail($"Condition '{key}' has an undocumented value type {value?.GetType().Name}.");
                }
                if (conditionTypes.TryGetValue(key, out var known) && known != type)
                    throw Guard.Fail($"Condition '{key}' is emitted both as {known} and as {type}.");
                conditionTypes[key] = type;
            }
        }
        var conditions = new Obj();
        foreach (var (key, type) in conditionTypes)
            conditions.Add(key, new Obj { ["type"] = type, ["values"] = conditionValues[key].ToArray() });

        return new Obj
        {
            ["kind"] = Distinct(rows.Select(z => z.Kind)),
            ["type"] = Distinct(rows.Select(z => z.Clr)),
            ["source"] = Distinct(rows.Select(z => z.Source)),
            ["method"] = Distinct(rows.Select(z => z.Method)),
            ["locationSet"] = Distinct(rows.Select(z => z.Set)),
            ["shiny"] = Distinct(rows.Select(z => z.Shiny)),
            ["trainer"] = Distinct(rows.Select(z => z.Trainer)),
            ["distribution"] = Distinct(rows.Select(z => z.Distribution)),
            ["conditions"] = conditions,
        };
    }
}
