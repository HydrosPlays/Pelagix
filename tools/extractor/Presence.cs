using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>
/// presence.json: per game, every (species, form) its PersonalTable accepts. "Present" means the game can hold
/// the Pokémon (it has data for it), not that it can be obtained there.
/// </summary>
public sealed class PresenceData
{
    /// <summary>Form indexes probed per species. Real data tops out at 27 (Unown); the margin catches a table that grows.</summary>
    private const int FormProbeLimit = 64;
    private const int FormSanityLimit = 40;

    private readonly Dictionary<string, List<(ushort Species, byte Form)>> _byGame = new(StringComparer.Ordinal);
    private readonly Dictionary<string, HashSet<int>> _lookup = new(StringComparer.Ordinal);

    /// <summary>GO has no PersonalTable of its own; every other game code maps to one (COLO / XD use the shared CXD table).</summary>
    public static IPersonalTable? Table(string game) => game == "GO" ? null : GameData.GetPersonal(Games.Saved(game));

    public IReadOnlyList<(ushort Species, byte Form)> Of(string game) => _byGame[game];
    public bool Has(string game, ushort species, byte form) => _lookup[game].Contains(species << 8 | form);
    public int Total => _byGame.Sum(z => z.Value.Count);

    public static PresenceData Build()
    {
        var result = new PresenceData();
        foreach (var game in Games.Order)
        {
            var list = new List<(ushort, byte)>();
            var lookup = new HashSet<int>();
            if (Table(game) is { } table)
            {
                for (ushort species = 1; species <= table.MaxSpeciesID; species++)
                {
                    // Older tables report FormCount 1 for species whose forms carry no stats (Unown, Arceus, Vivillon ...),
                    // so every form index is asked individually instead of trusting FormCount or a form-name list.
                    for (int form = 0; form < FormProbeLimit; form++)
                    {
                        if (!table.IsPresentInGame(species, (byte)form))
                            continue;
                        Guard.Require(form < FormSanityLimit, $"{game}: {(Species)species} reports form {form} as present; raise the probe limits in Presence.cs after checking PKHeX.");
                        list.Add((species, (byte)form));
                        lookup.Add(species << 8 | form);
                    }
                }
                Guard.Require(list.Count != 0, $"{game}: PersonalTable reports no species at all.");
            }
            result._byGame[game] = list;
            result._lookup[game] = lookup;
        }
        return result;
    }

    public Obj ToJson()
    {
        var root = new Obj();
        foreach (var game in Games.Order)
            root.Add(game, _byGame[game].Select(z => new[] { (int)z.Species, z.Form }));
        return root;
    }

    public Obj Counts()
    {
        var o = new Obj();
        foreach (var game in Games.Order)
            o.Add(game, _byGame[game].Count);
        return o;
    }
}
