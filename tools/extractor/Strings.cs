using System.Globalization;
using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>strings.json: the English name tables the other files' numeric ids point into.</summary>
public static class Strings
{
    public static Obj Build(GameStrings strings, EvolutionDump evolutions)
    {
        int maxSpecies = PersonalTable.SV.MaxSpeciesID;
        Guard.Require(strings.specieslist.Length > maxSpecies, $"PKHeX species list has {strings.specieslist.Length} entries; expected more than {maxSpecies}.");
        Guard.Require(strings.balllist.Length > (int)Ball.LAOrigin, "PKHeX ball list is shorter than the Ball enum.");

        var games = new Obj();
        foreach (var code in Games.Order)
            games.Add(code, GameInfo.GetVersionName(Games.Saved(code)));

        var items = new Obj();
        foreach (var (table, names) in evolutions.Items)
            items.Add(table, IdMap(names));

        return new Obj
        {
            ["species"] = strings.specieslist.Take(maxSpecies + 1).ToArray(),
            ["types"] = strings.types,
            ["balls"] = strings.balllist.Take((int)Ball.LAOrigin + 1).ToArray(),
            ["games"] = games,
            ["items"] = items,
            ["moves"] = IdMap(evolutions.Moves),
        };
    }

    private static Obj IdMap(SortedDictionary<int, string> names)
    {
        var o = new Obj();
        foreach (var (id, name) in names)
            o.Add(id.ToString(CultureInfo.InvariantCulture), name);
        return o;
    }
}
