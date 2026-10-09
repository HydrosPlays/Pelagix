using System.Globalization;
using PKHeX.Core;
using static PKHeX.Core.EvolutionType;

namespace Pelagix.Extractor;

public sealed class EvolutionDump
{
    public required Obj Json;
    public required int Edges;
    public required Obj Counts;
    /// <summary>Item table key (context name) -> item id -> name, for every item an edge refers to (strings.json).</summary>
    public required SortedDictionary<string, SortedDictionary<int, string>> Items;
    /// <summary>Move id -> name for every move an edge refers to (strings.json).</summary>
    public required SortedDictionary<int, string> Moves;
}

/// <summary>evolutions.json: per game, the forward evolution edges both of whose ends that game can hold.</summary>
public static class Evolutions
{
    private enum ArgKind { None, Item, Move, Species, Type, Version, Count }

    /// <summary>What EvolutionMethod.Argument means for a method. Anything not listed ignores its argument.</summary>
    private static ArgKind KindOf(EvolutionType method, EntityContext context) => method switch
    {
        TradeHeldItem or UseItem or UseItemMale or UseItemFemale or LevelUpHeldItemDay or LevelUpHeldItemNight or UseItemWormhole or UseItemFullMoon => ArgKind.Item,
        // Legends: Arceus reuses Urshifu's two ids for "use item by day / by night".
        TowerOfDarkness or TowerOfWaters when context == EntityContext.Gen8a => ArgKind.Item,
        LevelUpKnowMove or LevelUpKnowMoveECElse or LevelUpKnowMoveEC100 => ArgKind.Move,
        LevelUpWithTeammate => ArgKind.Species,
        LevelUpAffection50MoveType => ArgKind.Type,
        LevelUpVersion or LevelUpVersionDay or LevelUpVersionNight => ArgKind.Version,
        LevelUpBeauty or CriticalHitsInBattle or HitPointsLostInBattle or LevelUpWalkStepsWith or LevelUpCollect999
            or LevelUpDefeatEquals or LevelUpUseMoveSpecial or UseMoveBarbBarrage or LevelUpRecoilDamageMale or LevelUpRecoilDamageFemale => ArgKind.Count,
        _ => ArgKind.None,
    };

    public static EvolutionDump Build(PresenceData presence, GameStrings strings)
    {
        var root = new Obj();
        var counts = new Obj();
        var items = new SortedDictionary<string, SortedDictionary<int, string>>(StringComparer.Ordinal);
        var moves = new SortedDictionary<int, string>();
        int total = 0;
        foreach (var game in Games.Order)
        {
            var edges = new List<Obj>();
            if (game != "GO")
            {
                var context = Games.Context(game);
                var tree = EvolutionTree.GetEvolutionTree(context);
                // Gen 1-3 trees store that generation's own item numbering; the context picks the matching name table.
                var itemNames = strings.GetItemStrings(context, Games.Saved(game));
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var (species, form) in presence.Of(game))
                {
                    foreach (var method in tree.Forward.GetForward(species, form).Span)
                    {
                        if (method.Species == 0)
                            continue;
                        var toForm = method.GetDestinationForm(form);
                        // Species-indexed trees (Gen 1-6) attach a species' edges to every form, and some trees carry
                        // edges for Pokémon their games lack; the presence filter drops both kinds.
                        if (!presence.Has(game, method.Species, toForm))
                            continue;
                        var edge = ToJson(species, form, toForm, method, context, itemNames, strings, items, moves);
                        if (seen.Add(Json.Serialize(edge)))
                            edges.Add(edge);
                    }
                }
            }
            total += edges.Count;
            counts.Add(game, edges.Count);
            root.Add(game, edges);
        }
        return new EvolutionDump { Json = root, Edges = total, Counts = counts, Items = items, Moves = moves };
    }

    private static Obj ToJson(ushort species, byte form, byte toForm, EvolutionMethod method, EntityContext context, string[] itemNames,
        GameStrings strings, SortedDictionary<string, SortedDictionary<int, string>> items, SortedDictionary<int, string> moves)
    {
        var methodName = Enum.GetName(method.Method)
                         ?? throw Guard.Fail($"Evolution method id {(int)method.Method} ({(Species)species} in {context}) has no EvolutionType name.");
        var o = new Obj
        {
            ["from"] = new[] { (int)species, form },
            ["to"] = new[] { (int)method.Species, toForm },
            ["m"] = methodName,
            ["id"] = (int)method.Method,
            ["lv"] = (int)method.Level,
            ["up"] = (int)method.LevelUp,
            ["arg"] = (int)method.Argument,
        };
        int arg = method.Argument;
        var kind = KindOf(method.Method, context);
        if (kind == ArgKind.Count && arg == 0)
            kind = ArgKind.None; // Legends: Arceus keeps no threshold for its recoil evolution
        string? name = null;
        switch (kind)
        {
            case ArgKind.Item:
                name = Lookup(itemNames, arg, "item");
                if (!items.TryGetValue(context.ToString(), out var table))
                    items[context.ToString()] = table = [];
                table[arg] = name;
                break;
            case ArgKind.Move:
                name = Lookup(strings.movelist, arg, "move");
                moves[arg] = name;
                break;
            case ArgKind.Species:
                name = Lookup(strings.specieslist, arg, "species");
                break;
            case ArgKind.Type:
                name = Lookup(strings.types, arg, "type");
                break;
            case ArgKind.Version:
                name = Enum.IsDefined((GameVersion)arg) ? ((GameVersion)arg).ToString() : throw Guard.Fail($"Evolution version argument {arg} is not a GameVersion.");
                break;
        }
        if (kind != ArgKind.None)
            o["argKind"] = kind.ToString().ToLowerInvariant();
        if (name is not null)
            o["argName"] = name;
        return o;

        string Lookup(IReadOnlyList<string> names, int id, string what)
        {
            if (id <= 0 || id >= names.Count || string.IsNullOrWhiteSpace(names[id]))
                throw Guard.Fail($"Evolution {(Species)species}-{form} -> {(Species)method.Species}-{toForm} in {context}: {what} id {id.ToString(CultureInfo.InvariantCulture)} has no name.");
            return names[id];
        }
    }
}
