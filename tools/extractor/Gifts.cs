using System.Globalization;
using PKHeX.Core;
using static PKHeX.Core.GameVersion;

namespace Pelagix.Extractor;

public sealed class GiftDump
{
    public required Obj Json;
    public required int Entities;
    public required int Rows;
    public required Obj CountsByType;
    /// <summary>Game code -> ball ids its gifts arrive in (for balls.json).</summary>
    public required Dictionary<string, SortedSet<int>> BallsByGame;
    public required KindStats Stats;
}

/// <summary>gifts.json: every Pokémon-granting mystery gift PKHeX ships, one row per distinct card variant.</summary>
public static class Gifts
{
    /// <summary>Card types in output order: generation, then release.</summary>
    private static readonly string[] TypeOrder = ["PCD", "PGT", "PGF", "WC6", "WC7", "WB7", "WC8", "WA8", "WB8", "WC9", "WA9"];

    public static GiftDump Build(IReadOnlyList<Item> rangerManaphy, LocationTable locations)
    {
        var sets = new (string Type, IEnumerable<MysteryGift> Cards)[]
        {
            ("PCD", EncounterEvent.MGDB_G4),
            ("PGT", rangerManaphy.Select(z => (MysteryGift)z.Enc)),
            ("PGF", EncounterEvent.MGDB_G5),
            ("WC6", EncounterEvent.MGDB_G6),
            ("WC7", EncounterEvent.MGDB_G7),
            ("WB7", EncounterEvent.MGDB_G7GG),
            ("WC8", EncounterEvent.MGDB_G8),
            ("WA8", EncounterEvent.MGDB_G8A),
            ("WB8", EncounterEvent.MGDB_G8B),
            ("WC9", EncounterEvent.MGDB_G9),
            ("WA9", EncounterEvent.MGDB_G9A),
        };

        var groups = new Dictionary<string, Group>(StringComparer.Ordinal);
        var countsByType = new Obj();
        var balls = new Dictionary<string, SortedSet<int>>(StringComparer.Ordinal);
        int entities = 0;
        foreach (var (type, cards) in sets)
        {
            int total = 0, entity = 0, distinct = 0;
            foreach (var card in cards)
            {
                total++;
                if (card is not { IsEntity: true, Species: not 0 })
                    continue;
                Guard.Require(card.GetType().Name == type, $"Mystery gift array for {type} contains a {card.GetType().Name}.");
                entity++;
                var games = GamesOf(card);
                Guard.Require(games.Length != 0, $"{type} card {card.CardID} ({(Species)card.Species}) maps to no game.");
                var row = ToJson(card, type, games, locations);
                var key = Json.Serialize(row);
                if (!groups.TryGetValue(key, out var group))
                {
                    groups[key] = group = new Group(row, key, Array.IndexOf(TypeOrder, type), card.CardID, card.Species, games);
                    distinct++;
                }
                group.Count++;
                foreach (var game in games)
                {
                    if (!balls.TryGetValue(game, out var set))
                        balls[game] = set = [];
                    if (card.Ball != 0)
                        set.Add(card.Ball);
                }
            }
            Guard.Require(entity != 0, $"PKHeX returned no Pokémon gifts for {type}.");
            entities += entity;
            countsByType.Add(type, new Obj { ["cards"] = total, ["entities"] = entity, ["rows"] = distinct });
        }

        // Exact repeats collapse into one row; language variants stay apart because title and OT differ.
        var stats = new KindStats();
        var rows = new List<Obj>(groups.Count);
        foreach (var group in groups.Values
                     .OrderBy(z => z.TypeOrder)
                     .ThenBy(z => z.CardId)
                     .ThenBy(z => z.Species)
                     .ThenBy(z => z.Key, StringComparer.Ordinal))
        {
            group.Row.Add("n", group.Count);
            rows.Add(group.Row);
            stats.Add([.. group.Games.Select(Games.Index)], "mystery", group.Count, 1);
        }

        return new GiftDump
        {
            Json = new Obj { ["rows"] = rows },
            Entities = entities,
            Rows = rows.Count,
            CountsByType = countsByType,
            BallsByGame = balls,
            Stats = stats,
        };
    }

    private sealed class Group(Obj row, string key, int typeOrder, int cardId, ushort species, string[] games)
    {
        public readonly Obj Row = row;
        public readonly string Key = key;
        public readonly int TypeOrder = typeOrder;
        public readonly int CardId = cardId;
        public readonly ushort Species = species;
        public readonly string[] Games = games;
        public int Count;
    }

    /// <summary>
    /// Games whose save can receive the card. PKHeX's MysteryGift.Version is a single (sometimes wrong) grouping,
    /// so each card type is decoded by its own restriction field.
    /// </summary>
    private static string[] GamesOf(MysteryGift card)
    {
        switch (card)
        {
            case PCD pcd:
            {
                // CardCompatibility: bit index = (int)GameVersion. A few cards carry junk in the other bits.
                var bits = pcd.CardCompatibility & 0x1D80;
                return [.. new[] { D, P, Pt, HG, SS }.Where(v => (bits & (1 << (int)v)) != 0).Select(v => v.ToString())];
            }
            case PGT { IsManaphyEgg: true }:
                return ["D", "P", "Pt", "HG", "SS"]; // Pokémon Ranger sends the egg to any Gen 4 game
            case WC9 wc9:
                return wc9.RestrictVersion switch { 1 => ["SL"], 2 => ["VL"], _ => ["SL", "VL"] };
            case WA9:
                return ["ZA"]; // WA9.Version reports SV
            case WA8:
                return ["PLA"];
            case WB8:
                return ["BD", "SP"];
            case IRestrictVersion restricted:
            {
                GameVersion[] candidates = card.Context switch
                {
                    EntityContext.Gen5 => [B, W, B2, W2],
                    EntityContext.Gen6 => [X, Y, OR, AS],
                    EntityContext.Gen7 => [SN, MN, US, UM],
                    EntityContext.Gen7b => [GP, GE],
                    EntityContext.Gen8 => [SW, SH],
                    _ => throw Guard.Fail($"No game list for {card.GetType().Name} in context {card.Context}."),
                };
                return [.. candidates.Where(restricted.CanBeReceivedByVersion).Select(v => v.ToString())];
            }
        }
        throw Guard.Fail($"No game rule for mystery gift type {card.GetType().Name}. Add one to Gifts.GamesOf.");
    }

    private static GameVersion LocationVersion(EntityContext context) => context switch
    {
        EntityContext.Gen7b => GG,
        EntityContext.Gen8a => PLA,
        EntityContext.Gen8b => BDSP,
        EntityContext.Gen9a => ZA,
        _ => context.GetSingleGameVersion(),
    };

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>
    /// Receipt date stored in the card. Cards loaded from the "full" wonder-card dumps get today's date stamped
    /// on them by PKHeX, so anything outside the generation's own lifetime is dropped.
    /// </summary>
    private static DateOnly? CardDate(MysteryGift card)
    {
        var (date, first, last) = card switch
        {
            PGF x => (x.Date, 2010, 2014),
            WC6 x => (x.Date, 2013, 2018),
            WC7 x => (x.Date, 2016, 2020),
            WB7 x => (x.Date, 2018, 2022),
            _ => ((DateOnly?)null, 0, 0),
        };
        return date is { } d && d.Year >= first && d.Year <= last ? d : null;
    }

    private static DistributionWindow? Window(MysteryGift card)
    {
        DistributionWindow window = default;
        bool found = card switch
        {
            WB7 x => x.GetDistributionWindow(out window),
            WC8 x => x.GetDistributionWindow(out window),
            WA8 x => x.GetDistributionWindow(out window),
            WB8 x => x.GetDistributionWindow(out window),
            WC9 x => x.GetDistributionWindow(out window),
            WA9 x => x.GetDistributionWindow(out window),
            _ => false,
        };
        return found ? window : null;
    }

    /// <summary>Game the received Pokémon is stamped with when the card forces one, whatever game redeems it.</summary>
    private static string? OriginGame(MysteryGift card)
    {
        int id = card switch
        {
            PGF x => x.OriginGame,
            WC6 x => x.OriginGame,
            WC7 x => x.OriginGame,
            WB7 x => x.OriginGame,
            WC8 x => x.OriginGame,
            WA8 x => x.OriginGame,
            WB8 x => x.OriginGame,
            WC9 x => x.OriginGame,
            WA9 x => x.OriginGame,
            _ => 0,
        };
        if (id is <= 0 or > byte.MaxValue)
            return null;
        var version = (GameVersion)id;
        return version.IsValidSavedVersion() && Enum.IsDefined(version) ? version.ToString() : null;
    }

    /// <summary>
    /// Language of the card, where PKHeX knows it: the language a card from the "full" dumps is restricted to (its
    /// title is written in it), else the language the Pokémon itself is stamped with. Gen 7b+ titles are generated in
    /// English by PKHeX and carry no language.
    /// </summary>
    private static string? CardLanguage(MysteryGift card)
    {
        int id = card switch
        {
            PGF x => x.RestrictLanguage != 0 ? x.RestrictLanguage : x.Language,
            WC6 x => x.RestrictLanguage != 0 ? x.RestrictLanguage : x.Language,
            WC7 x => x.RestrictLanguage != 0 ? x.RestrictLanguage : x.Language,
            PCD x => x.Gift.PK.Language,
            _ => 0,
        };
        if (id <= 0 || id > byte.MaxValue)
            return null;
        var language = (LanguageID)id;
        return Enum.IsDefined(language) && language != LanguageID.None ? language.ToString() : null;
    }

    private static int FixedGender(MysteryGift card) => card switch
    {
        PCD or PGT => card.IsEgg ? -1 : card.Gender <= 2 ? card.Gender : -1,
        PGF => card.Gender <= 1 ? card.Gender : -1, // 2 = random
        _ => card.Gender <= 2 ? card.Gender : -1,    // 3 = random
    };

    private static Obj ToJson(MysteryGift card, string type, string[] games, LocationTable locations)
    {
        var set = card.Context.ToString();
        var version = LocationVersion(card.Context);
        string Where() => $"{type} card {card.CardID} {(Species)card.Species}";

        var o = new Obj
        {
            ["type"] = type,
            ["id"] = card.CardID,
            ["title"] = card.CardTitle,
            ["s"] = (int)card.Species,
            ["f"] = (int)card.Form,
            ["lv"] = (int)card.Level,
            ["games"] = games,
        };
        if (card.Shiny != Shiny.Random) o["h"] = card.Shiny.ToString();
        if (card.Ball != 0) o["b"] = (int)card.Ball;
        var gender = FixedGender(card);
        if (gender >= 0) o["d"] = gender;
        if (card.IsEgg) o["egg"] = 1;
        if (card.FatefulEncounter) o["fateful"] = 1;
        if (!string.IsNullOrWhiteSpace(card.OriginalTrainerName)) o["ot"] = card.OriginalTrainerName;
        if (CardLanguage(card) is { } language) o["lang"] = language;
        if (card is WB7 or WC8 or WA8 or WB8 or WC9 or WA9 && card.CardID >= 9000) o["home"] = 1;
        if (OriginGame(card) is { } origin) o["origin"] = origin;

        if (CardDate(card) is { } date) o["date"] = Iso(date);
        if (Window(card) is { } window)
        {
            o["from"] = Iso(window.Start);
            if (window.End is { } end)
                o["to"] = Iso(end);
        }

        o["x"] = set;
        if (!Resolver.IsNoLocation(card.Location))
        {
            o["loc"] = (int)card.Location;
            var name = locations.Resolve(set, card.Location, false, card.Generation, version, Where);
            if (name.Length != 0)
                o["locName"] = name;
        }
        if (!Resolver.IsNoLocation(card.EggLocation))
        {
            o["eggLoc"] = (int)card.EggLocation;
            var name = locations.Resolve(set, card.EggLocation, true, card.Generation, version, Where);
            if (name.Length != 0)
                o["eggLocName"] = name;
        }
        return o;
    }
}
