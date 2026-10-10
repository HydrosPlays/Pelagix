using System.Globalization;
using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>
/// localized.json: the games' own text in each of the ten languages PKHeX carries, for everything the other files
/// name in English. Arrays are indexed exactly like their English counterparts (species, type, ability, ball, item
/// and move ids), <c>forms</c> like forms.json's form indices and <c>locations</c> like locations.json.
/// </summary>
public static class Localized
{
    /// <summary>PKHeX's language codes, in the games' own order.</summary>
    public static readonly string[] Languages = ["ja", "en", "fr", "it", "de", "es", "es-419", "ko", "zh-Hans", "zh-Hant"];

    public static Obj Build(LocationTable locations)
    {
        int maxSpecies = PersonalTable.SV.MaxSpeciesID;
        var english = GameInfo.GetStrings("en");
        var root = new Obj();
        foreach (var language in Languages)
        {
            var strings = GameInfo.GetStrings(language);
            // Every table must line up with English, or an id would name something else in this language.
            Guard.Require(strings.specieslist.Length == english.specieslist.Length, $"{language}: species list length differs from English.");
            Guard.Require(strings.abilitylist.Length == english.abilitylist.Length, $"{language}: ability list length differs from English.");
            // Item and move lists are not checked: a language may lack the newest lines, and those ids then read in English.
            Guard.Require(strings.balllist.Length == english.balllist.Length, $"{language}: ball list length differs from English.");
            Guard.Require(strings.types.Length == english.types.Length, $"{language}: type list length differs from English.");

            var games = new Obj();
            foreach (var code in Games.Order)
            {
                int version = (int)Games.Saved(code);
                games.Add(code, version < strings.gamelist.Length ? strings.gamelist[version] : string.Empty);
            }

            var forms = new Obj();
            for (ushort species = 1; species <= maxSpecies; species++)
            {
                var names = Forms.PrimaryNames(species, strings);
                if (names.Any(z => z.Length != 0))
                    forms.Add(species.ToString(CultureInfo.InvariantCulture), names);
            }

            root.Add(language, new Obj
            {
                ["species"] = strings.specieslist.Take(maxSpecies + 1).ToArray(),
                ["types"] = strings.types,
                ["abilities"] = strings.abilitylist,
                ["balls"] = strings.balllist.Take((int)Ball.LAOrigin + 1).ToArray(),
                ["games"] = games,
                ["items"] = strings.itemlist,
                ["moves"] = strings.movelist,
                ["forms"] = forms,
                ["locations"] = locations.Localize(strings),
            });
        }
        return root;
    }
}
