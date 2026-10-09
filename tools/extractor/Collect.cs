using System.Collections;
using System.Reflection;
using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>One encounter template plus the static holder field (and wild area) it was read from.</summary>
public sealed record Item(IEncounterTemplate Enc, object? Area, string Holder, string Field)
{
    public string Source => $"{Holder}.{Field}";
}

/// <summary>What one manifest field yielded: every template reachable from it, and how many were not already seen elsewhere.</summary>
public sealed record SourceCount(string Source, string FieldType, int Total, int New);

/// <summary>
/// Enumerates every encounter template PKHeX.Core holds. The templates live in static arrays on internal
/// <c>Encounters*</c> classes (there is no InternalsVisibleTo and no public enumeration API that is complete),
/// so they are read by reflection from an explicit manifest. A PKHeX update that renames, empties or adds a
/// holder field fails the extraction instead of silently changing the data.
/// </summary>
public static class Collect
{
    private const BindingFlags StaticDeclared = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    /// <summary>Holder class, then its fields in the order they are read. Earlier fields win when two share a template instance.</summary>
    private static readonly string[][] Manifest =
    [
        ["Encounters1", "SlotsRD", "SlotsGN", "SlotsYW", "SlotsBU", "StaticRBY", "StaticRB", "StaticYW", "StaticBU", "TradeGift_RB", "TradeGift_YW", "TradeGift_BU"],
        ["Encounters1GBEra", "Gifts"],
        ["Encounters1VC", "Gift"],
        ["Encounters2", "SlotsGD", "SlotsSI", "SlotsC", "StaticGSC", "StaticGS", "StaticGD", "StaticSI", "StaticC", "StaticOddEggC", "CelebiVC", "TradeGift_GSC"],
        ["Encounters2GBEra", "Gifts"],
        ["Encounters3Colo", "Starters", "Gifts", "Shadow", "EReader"],
        ["Encounters3FRLG", "SlotsFR", "SlotsLG", "StaticFRLG", "StaticFR", "StaticLG", "TradeGift_FRLG", "TradeGift_FR", "TradeGift_LG"],
        ["Encounters3RSE", "SlotsSwarmRSE", "SlotsR", "SlotsS", "SlotsE", "ColoGiftsR", "ColoGiftsS", "StaticRSE", "StaticR", "StaticS", "StaticE", "TradeGift_RS", "TradeGift_E"],
        ["Encounters3XD", "Gifts", "Trades", "Shadow", "Slots"],
        ["Encounters4DPPt", "SlotsD", "SlotsP", "SlotsPt", "StaticDPPt", "StaticDP", "StaticPt", "StaticD", "StaticP", "RanchGifts", "TradeGift_DPPtIngame"],
        ["Encounters4HGSS", "SlotsHG", "SlotsSS", "Encounter_PokeWalker", "Encounter_HGSS", "StaticHG", "StaticSS", "TradeGift_HGSS"],
        ["Encounters5B2W2", "SlotsB2", "SlotsW2", "DreamWorld_B2W2", "Encounter_B2W2_Regular", "StaticB2", "StaticW2", "Encounter_B2W2_N", "TradeGift_B2W2", "TradeGift_W2", "TradeGift_B2"],
        ["Encounters5BW", "SlotsB", "SlotsW", "DreamWorld_BW", "Encounter_BW", "StaticB", "StaticW", "TradeGift_BW", "TradeGift_B", "TradeGift_W"],
        ["Encounters5DR", "Encounter_DreamRadar", "DreamWorld_Common"],
        ["Encounters6AO", "SlotsA", "SlotsO", "StaticA", "StaticO", "Encounter_AO", "TradeGift_AO"],
        ["Encounters6XY", "SlotsX", "SlotsY", "Encounter_XY", "StaticX", "StaticY", "TradeGift_XY"],
        ["Encounters7GG", "SlotsGP", "SlotsGE", "Encounter_GG", "StaticGP", "StaticGE", "TradeGift_GG", "TradeGift_GP", "TradeGift_GE"],
        ["Encounters7SM", "SlotsSN", "SlotsMN", "StaticSM", "StaticSN", "StaticMN", "TradeGift_SM"],
        ["Encounters7USUM", "SlotsUS", "SlotsUM", "StaticUSUM", "StaticUS", "StaticUM", "TradeGift_USUM"],
        ["Encounters8", "SlotsSW_Symbol", "SlotsSH_Symbol", "SlotsSW_Hidden", "SlotsSH_Hidden", "StaticSWSH", "StaticSW", "StaticSH", "TradeSWSH", "TradeSW", "TradeSH"],
        ["Encounters8Nest", "Nest_SW", "Nest_SH", "Dist_SW", "Dist_SH", "DynAdv_SWSH", "Crystal_SWSH"],
        ["Encounters8a", "SlotsLA", "StaticLA"],
        ["Encounters8b", "SlotsBD", "SlotsSP", "Encounter_BDSP", "StaticBD", "StaticSP", "TradeGift_BDSP"],
        ["Encounters9", "Slots", "Encounter_SV", "StaticSL", "StaticVL", "TradeGift_SV", "TeraBase", "TeraDLC1", "TeraDLC2", "Dist", "Might", "Fixed", "Outbreak"],
        ["Encounters9a", "Slots", "Hyperspace", "Gifts", "Static", "Trades"],
        ["EncountersGO", "SlotsGO_GG", "SlotsGO"],
        ["EncountersWC3", "Encounter_WC3", "PCNY", "PCJP"],
        // The one template that lives outside the Encounters* holders (a PGT; it is emitted with the mystery gifts).
        ["EncounterGenerator4", "RangerManaphy"],
    ];

    public static List<Item> All(out List<SourceCount> counts)
    {
        var asm = typeof(IEncounterTemplate).Assembly;
        var seen = new HashSet<object>(ReferenceEqualityComparer.Instance);
        var result = new List<Item>(300_000);
        counts = [];
        var listed = new HashSet<string>(StringComparer.Ordinal);

        foreach (var entry in Manifest)
        {
            var holder = entry[0];
            var type = asm.GetType($"PKHeX.Core.{holder}")
                       ?? throw Guard.Fail($"Manifest holder PKHeX.Core.{holder} no longer exists. Update the manifest in Collect.cs.");
            foreach (var fieldName in entry.AsSpan(1))
            {
                var source = $"{holder}.{fieldName}";
                listed.Add(source);
                var field = type.GetField(fieldName, StaticDeclared)
                            ?? throw Guard.Fail($"Manifest field {source} no longer exists. Update the manifest in Collect.cs.");
                int total = 0, added = 0;
                foreach (var (enc, area) in Flatten(field.GetValue(null)))
                {
                    total++;
                    if (!seen.Add(enc))
                        continue;
                    added++;
                    result.Add(new Item(enc, area, holder, fieldName));
                }
                Guard.Require(total != 0, $"Manifest field {source} is empty: PKHeX returned no encounter templates for it.");
                counts.Add(new SourceCount(source, field.FieldType.Name, total, added));
            }
        }

        // Anything template-bearing that the manifest does not know about means PKHeX gained data we would silently drop.
        var unknown = new List<string>();
        foreach (var type in asm.GetTypes())
        {
            if (type.Namespace != "PKHeX.Core" || !type.Name.StartsWith("Encounters", StringComparison.Ordinal))
                continue;
            if (type is not { IsAbstract: true, IsSealed: true })
                continue;
            foreach (var field in type.GetFields(StaticDeclared))
            {
                if (field.IsLiteral || field.Name.Contains('<'))
                    continue;
                var source = $"{type.Name}.{field.Name}";
                if (listed.Contains(source))
                    continue;
                // Private fields are building blocks that a listed field concatenates, so every template in them
                // must already have been seen; any other unlisted field must hold no templates at all.
                var templates = Flatten(field.GetValue(null));
                if (field.IsPrivate ? templates.Any(z => !seen.Contains(z.Enc)) : templates.Any())
                    unknown.Add(source);
            }
        }
        Guard.Require(unknown.Count == 0,
            $"PKHeX has encounter holder fields that are not in the manifest: {string.Join(", ", unknown)}. Add them to Collect.cs (and decide their kind in Resolve.cs).");
        return result;
    }

    /// <summary>Yields every template in a holder field value: a single template, a template array, or an area array (whose slots are yielded).</summary>
    private static IEnumerable<(IEncounterTemplate Enc, object? Area)> Flatten(object? value)
    {
        switch (value)
        {
            case null or string:
                yield break;
            case IEncounterTemplate single:
                yield return (single, null);
                yield break;
            case IEnumerable seq:
                foreach (var item in seq)
                {
                    if (item is IEncounterTemplate template)
                    {
                        yield return (template, null);
                        continue;
                    }
                    if (item is null || SlotsOf(item) is not { } slots)
                        continue;
                    foreach (var slot in slots)
                    {
                        if (slot is IEncounterTemplate t)
                            yield return (t, item);
                    }
                }
                break;
        }
    }

    /// <summary>EncounterAreaN.Slots is a property everywhere except EncounterArea7g / 8g, where it is a public field.</summary>
    private static IEnumerable? SlotsOf(object area)
    {
        var type = area.GetType();
        var value = type.GetProperty("Slots", BindingFlags.Instance | BindingFlags.Public)?.GetValue(area)
                    ?? type.GetField("Slots", BindingFlags.Instance | BindingFlags.Public)?.GetValue(area);
        return value as IEnumerable;
    }
}

/// <summary>Cached reflection access to the handful of private members the dump needs. A missing member is a hard failure.</summary>
public static class Reflect
{
    private const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
    private const BindingFlags Static = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
    private static readonly Dictionary<(Type, string), Func<object, object?>?> Getters = [];
    private static readonly Dictionary<(Type, string), MethodInfo?> StaticMethods = [];

    private static Func<object, object?>? Getter(Type type, string name)
    {
        if (Getters.TryGetValue((type, name), out var cached))
            return cached;
        Func<object, object?>? result = null;
        for (var t = type; t is not null && result is null; t = t.BaseType)
        {
            var property = t.GetProperty(name, Instance);
            if (property?.GetMethod is not null && property.GetIndexParameters().Length == 0)
                result = property.GetValue;
            else if (t.GetField(name, Instance) is { } field)
                result = field.GetValue;
        }
        Getters[(type, name)] = result;
        return result;
    }

    public static bool Has(object target, string name) => Getter(target.GetType(), name) is not null;

    /// <summary>Reads an instance property or field by name, walking up the type hierarchy.</summary>
    public static T Get<T>(object target, string name)
    {
        var getter = Getter(target.GetType(), name)
                     ?? throw Guard.Fail($"PKHeX member {target.GetType().Name}.{name} no longer exists; the extractor reads it by reflection.");
        return getter(target) is T value
            ? value
            : throw Guard.Fail($"PKHeX member {target.GetType().Name}.{name} is no longer a {typeof(T).Name}.");
    }

    /// <summary>Invokes a (usually private) static method declared on <paramref name="type"/>.</summary>
    public static T InvokeStatic<T>(Type type, string name, params object?[] args)
    {
        if (!StaticMethods.TryGetValue((type, name), out var method))
            StaticMethods[(type, name)] = method = type.GetMethod(name, Static);
        if (method is null)
            throw Guard.Fail($"PKHeX method {type.Name}.{name} no longer exists; the extractor calls it by reflection.");
        return method.Invoke(null, args) is T value
            ? value
            : throw Guard.Fail($"PKHeX method {type.Name}.{name} no longer returns a {typeof(T).Name}.");
    }
}
