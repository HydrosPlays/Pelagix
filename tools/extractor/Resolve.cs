using PKHeX.Core;
using static PKHeX.Core.GameVersion;

namespace Pelagix.Extractor;

/// <summary>The individual games every output file is keyed by. Colosseum and XD are split out of PKHeX's shared CXD id.</summary>
public static class Games
{
    /// <summary>Canonical order; <c>g</c> indices in encounters.json point into this list (repeated in meta.json).</summary>
    public static readonly string[] Order =
    [
        "RD", "GN", "BU", "YW", "GD", "SI", "C", "R", "S", "E", "FR", "LG", "COLO", "XD",
        "D", "P", "Pt", "HG", "SS", "B", "W", "B2", "W2", "X", "Y", "OR", "AS",
        "SN", "MN", "US", "UM", "GP", "GE", "SW", "SH", "BD", "SP", "PLA", "SL", "VL", "ZA", "GO",
    ];

    private static readonly Dictionary<string, int> Indexes = Order.Select((code, i) => (code, i)).ToDictionary(z => z.code, z => z.i, StringComparer.Ordinal);

    /// <summary>Saved-version ids a grouping (RBY, SWSH, Gen3 ...) expands to. CXD and GO are only ever named explicitly.</summary>
    private static readonly GameVersion[] Singles = [.. GameUtil.GameVersions.Where(v => v is not (BATREV or CP or CXD or GO)).Reverse()];

    public static int Index(string code) => Indexes.TryGetValue(code, out var i) ? i : throw Guard.Fail($"Unknown game code '{code}'.");

    /// <summary>PKHeX value that names exactly this game (COLO / XD are grouping values in PKHeX).</summary>
    public static GameVersion Version(string code) => code switch
    {
        "COLO" => COLO,
        "XD" => XD,
        _ => Enum.Parse<GameVersion>(code),
    };

    /// <summary>The saved-version id to hand to PersonalTable / generator / ball lookups (COLO and XD share CXD).</summary>
    public static GameVersion Saved(string code) => code is "COLO" or "XD" ? CXD : Version(code);

    /// <summary>0 for GO, which has no generation of its own.</summary>
    public static byte Generation(string code) => code == "GO" ? (byte)0 : Saved(code).Generation;

    public static EntityContext Context(string code) => code == "GO" ? EntityContext.None : Saved(code).Context;

    /// <summary>Fails when PKHeX knows a game this list does not (or the other way round).</summary>
    public static void Validate()
    {
        var expected = Singles.Select(v => v.ToString()).Append("COLO").Append("XD").Append("GO").ToHashSet(StringComparer.Ordinal);
        var missing = expected.Except(Order).ToArray();
        var extra = Order.Except(expected).ToArray();
        Guard.Require(missing.Length == 0 && extra.Length == 0,
            $"Game list out of date. PKHeX games not in Games.Order: [{string.Join(", ", missing)}]; codes PKHeX no longer has: [{string.Join(", ", extra)}].");
        Guard.Require(Order.Distinct(StringComparer.Ordinal).Count() == Order.Length, "Games.Order contains a duplicate code.");
    }

    public static string[] Expand(GameVersion version, string holder)
    {
        switch (version)
        {
            case COLO: return ["COLO"];
            case XD: return ["XD"];
            // The shared id is only used by Colosseum's holder (Duking's Plusle) today; anything else is ambiguous.
            case CXD: return holder.Contains("Colo", StringComparison.Ordinal) ? ["COLO"] : holder.Contains("XD", StringComparison.Ordinal) ? ["XD"] : ["COLO", "XD"];
            case GO: return ["GO"];
            case Any or Invalid: return [];
        }
        if (version.IsValidSavedVersion())
            return Indexes.ContainsKey(version.ToString()) ? [version.ToString()] : [];
        return [.. Singles.Where(g => version.Contains(g)).Select(g => g.ToString())];
    }
}

/// <summary>One resolved template, before aggregation. Field meanings are documented in SCHEMA.md (encounters.json).</summary>
public sealed class Row
{
    public required int[] Games;
    public required ushort Species;
    public required byte Form;
    public required byte LevelMin;
    public required byte LevelMax;
    public required string Kind;
    public required string Clr;
    public required string Source;
    public required string Set;
    public required string Label;
    public string? Method;
    public ushort[] Locations = [];
    public ushort[] AltLocations = [];
    public bool EggLocation;
    public string? Shiny;
    public int Ball;
    public int Gender = -1;
    public Obj? Conditions;
    public string? Nickname;
    public string? Ot;
    public string[]? Ots;
    public string? Trainer;
    public string? Distribution;
    public bool IsEgg;
}

public static class Resolver
{
    private const int English = (int)LanguageID.English;

    // Gen 1 / 2 templates always report Ball.Poke, so PKHeX cannot tell a gift from a battle there.
    // These sets classify every EncounterStatic1 / EncounterStatic2 species; an unlisted species fails the run.
    private static readonly HashSet<ushort> Gen1Battles = [100, 101, 143, 144, 145, 146, 150];
    private static readonly HashSet<ushort> Gen1Gifts =
    [
        1, 4, 7, // starters
        25, // Yellow starter; Blue (JP) Game Corner
        30, 33, 35, 36, 37, 40, 63, 116, 123, 127, 137, 147, 148, // Game Corner prizes
        129, // Magikarp salesman
        106, 107, 131, 133, // Fighting Dojo, Silph Co., Celadon Mansion
        138, 140, 142, // fossils
    ];
    private static readonly HashSet<ushort> Gen2Battles = [74, 100, 101, 109, 130, 131, 143, 185, 211, 223, 243, 244, 245, 249, 250, 251];
    private static readonly HashSet<ushort> Gen2Gifts =
    [
        152, 155, 158, // starters
        133, 236, // Bill's Eevee, Kiyo's Tyrogue
        147, // Game Corner (G/S), Dragon's Den (C)
        23, 25, 27, 63, 104, 122, 137, 202, 246, // Game Corner prizes
    ];

    public static string Kind(IEncounterTemplate e)
    {
        switch (e)
        {
            case MysteryGift: return "mystery";
            case EncounterSlot7GO or EncounterSlot8GO: return "go";
            case EncounterStatic4Pokewalker: return "pokewalker";
            case EncounterStatic5Entree: return "dream-world";
            case EncounterStatic5Radar: return "dream-radar";
            case EncounterStatic5N: return "n-pokemon";
            case EncounterStatic8N: return "raid";
            case EncounterStatic8ND: return "raid-event";
            case EncounterStatic8NC: return "raid-crystal";
            case EncounterStatic8U: return "max-lair";
            case EncounterTera9: return "tera";
            case EncounterDist9: return "tera-event";
            case EncounterMight9: return "tera-7star";
            case EncounterOutbreak9: return "outbreak-event";
            case EncounterFixed9: return "static-fixed";
            case EncounterShadow3Colo or EncounterShadow3XD: return "shadow";
            case EncounterStarter3Colo: return "starter";
            case EncounterTrade4RanchGift: return "ranch-gift";
            case EncounterGift1 or EncounterGift2 or EncounterGift3 or EncounterGift3NY or EncounterGift3JPN: return e.IsEgg ? "event-egg" : "event";
            case EncounterGift3Colo or EncounterGift9a: return "gift";
            case EncounterStatic1 s1: return GameBoyKind(s1.Species, Gen1Gifts, Gen1Battles, "EncounterStatic1");
            case EncounterStatic2 s2: return s2.IsEgg ? "gift-egg" : GameBoyKind(s2.Species, Gen2Gifts, Gen2Battles, "EncounterStatic2");
            // Temple of Sinnoh Dialga / Palkia / Arceus are battles that end in a forced ball, not hand-outs.
            case EncounterStatic8a s8a: return s8a is { FixedBall: Ball.LAPoke, FatefulEncounter: false } ? "gift" : "static";
        }
        var name = e.GetType().Name;
        if (name.StartsWith("EncounterSlot", StringComparison.Ordinal))
            return "wild";
        if (name.StartsWith("EncounterTrade", StringComparison.Ordinal))
            return "trade";
        if (!name.StartsWith("EncounterStatic", StringComparison.Ordinal))
            throw Guard.Fail($"No kind rule for template type {name}. Add one to Resolver.Kind.");
        if (e.IsEgg)
            return "gift-egg";
        return e.FixedBall != Ball.None ? "gift" : "static";
    }

    private static string GameBoyKind(ushort species, HashSet<ushort> gifts, HashSet<ushort> battles, string type)
    {
        if (gifts.Contains(species))
            return "gift";
        if (battles.Contains(species))
            return "static";
        throw Guard.Fail($"{type} for species {species} ({(Species)species}) is not classified as gift or battle. Add it to the Gen 1 / Gen 2 sets in Resolve.cs.");
    }

    public static string[] GamesOf(Item it)
    {
        var e = it.Enc;
        switch (e)
        {
            // A Tera raid can be joined from either game; the row lists the games that can host (find) it.
            case EncounterTera9 t:
                return Hosts(t.IsAvailableHostScarlet, t.IsAvailableHostViolet);
            case EncounterDist9 d:
                return Hosts(d.RandRate0TotalScarlet + d.RandRate1TotalScarlet + d.RandRate2TotalScarlet + d.RandRate3TotalScarlet != 0,
                    d.RandRate0TotalViolet + d.RandRate1TotalViolet + d.RandRate2TotalViolet + d.RandRate3TotalViolet != 0);
            case EncounterMight9 m:
                return Hosts(m.RandRate0TotalScarlet + m.RandRate1TotalScarlet + m.RandRate2TotalScarlet + m.RandRate3TotalScarlet != 0,
                    m.RandRate0TotalViolet + m.RandRate1TotalViolet + m.RandRate2TotalViolet + m.RandRate3TotalViolet != 0);
            // Bonus-disc and Mt. Battle gifts are handed out by Colosseum itself; Version (R / S) is only the origin mark they carry.
            case EncounterGift3Colo:
                return ["COLO"];
        }
        return Games.Expand(e.Version, it.Holder);

        static string[] Hosts(bool scarlet, bool violet) => (scarlet, violet) switch
        {
            (true, false) => ["SL"],
            (false, true) => ["VL"],
            _ => ["SL", "VL"],
        };
    }

    /// <summary>Name of the location-name table (locations.json key) a template's ids belong to.</summary>
    public static string LocationSet(IEncounterTemplate e) => e.Version is COLO or XD or CXD ? "CXD" : e.Context.ToString();

    /// <summary>Version PKHeX needs to pick the right string table for a context that shares its generation number with another.</summary>
    public static GameVersion LocationVersion(IEncounterTemplate e) => e.Context switch
    {
        EntityContext.Gen7b => GG,
        EntityContext.Gen8a => PLA,
        EntityContext.Gen8b => BDSP,
        EntityContext.Gen9a => ZA,
        _ => e.Version,
    };

    /// <summary>0 everywhere, and 65535 in BDSP (Locations.Default8bNone), mean "no location".</summary>
    public static bool IsNoLocation(ushort id) => id is 0 or Locations.Default8bNone;

    /// <summary>
    /// Primary met locations (where the template is found) and alternates that are only reachable by the
    /// Pokémon wandering across an area border or by joining someone else's den.
    /// </summary>
    private static ushort[] LocationsOf(Item it, out bool egg, out ushort[] alternates)
    {
        var e = it.Enc;
        egg = false;
        var primary = new List<ushort>(4);
        var alt = new List<ushort>(0);
        void Add(int id)
        {
            if (!IsNoLocation((ushort)id) && !primary.Contains((ushort)id))
                primary.Add((ushort)id);
        }
        void AddAlt(int id)
        {
            if (!IsNoLocation((ushort)id) && !primary.Contains((ushort)id) && !alt.Contains((ushort)id))
                alt.Add((ushort)id);
        }

        switch (e)
        {
            case EncounterSlot8a:
                // One PLA area covers several met locations; EncounterArea8a.Location only exposes the first.
                foreach (var id in Reflect.Get<byte[]>(it.Area ?? throw Guard.Fail("EncounterSlot8a without its area."), "Locations"))
                    Add(id);
                break;
            case EncounterStatic8N:
                foreach (var id in Encounters8Nest.GetNestLocations(Reflect.Get<byte>(e, "NestIndex")))
                    Add(id);
                AddAlt(e.Location); // 162 "Pokémon Den": caught in a raid hosted by someone else
                break;
            case EncounterFixed9:
                foreach (var name in (ReadOnlySpan<string>)["Location0", "Location1", "Location2", "Location3"])
                    Add(Reflect.Get<byte>(e, name));
                break;
            case EncounterOutbreak9 outbreak:
                for (int i = 0; i < 128; i++)
                {
                    if (((outbreak.MetFlags >> i) & 1) != 0)
                        Add(outbreak.MetBase + i);
                }
                break;
            case EncounterSlot8 slot8:
                Add(slot8.Location);
                if (slot8.Parent.PermitCrossover && slot8.Type.CanCrossover())
                {
                    foreach (var id in EncounterArea8.GetAreasCanWanderTo(slot8.Parent.Location))
                        AddAlt(id);
                }
                break;
            case EncounterStatic8 static8:
                Add(static8.Location);
                var cross = static8.Crossover;
                AddAlt(cross.L1); AddAlt(cross.L2); AddAlt(cross.L3); AddAlt(cross.L4); AddAlt(cross.L5); AddAlt(cross.L6); AddAlt(cross.L7);
                break;
            case EncounterSlot7b slot7b:
                Add(slot7b.Location);
                if ((slot7b.CrossoverFlags & 1) != 0) AddAlt(slot7b.Parent.ToArea1);
                if ((slot7b.CrossoverFlags & 2) != 0) AddAlt(slot7b.Parent.ToArea2);
                break;
            case EncounterSlot9 slot9:
                Add(slot9.Location);            // Parent.ActualLocation(): the area it spawns in
                AddAlt(slot9.Parent.Location);  // the met location it gets when it has wandered over the border
                break;
        }
        if (primary.Count == 0)
        {
            Add(e.Location);
            if (primary.Count == 0 && !IsNoLocation(e.EggLocation))
            {
                Add(e.EggLocation);
                egg = true;
            }
        }
        // A den without a location list falls back to the shared "Pokémon Den" id, which is then no alternate.
        alternates = [.. alt.Where(id => !primary.Contains(id))];
        return [.. primary];
    }

    private static string Name<T>(T value) where T : struct, Enum
        => Enum.GetName(value) ?? throw Guard.Fail($"{typeof(T).Name} value {Convert.ToInt64(value)} has no name; PKHeX data and enum are out of sync.");

    /// <summary>Names of the single-bit members set in a [Flags] value (composite members such as AreaWeather8.All are never used).</summary>
    private static List<string> FlagNames<T>(T value, ulong mask) where T : struct, Enum
    {
        var bits = Convert.ToUInt64(value) & mask;
        var names = new List<string>();
        for (int i = 0; i < 64; i++)
        {
            if ((bits & (1ul << i)) != 0)
                names.Add(Name((T)Enum.ToObject(typeof(T), 1ul << i)));
        }
        return names;
    }

    private const ulong WeatherBits8 = (ulong)AreaWeather8.All;

    private static Obj? Conditions(Item it)
    {
        var e = it.Enc;
        var c = new SortedDictionary<string, object>(StringComparer.Ordinal);
        void Flag(string key, bool on)
        {
            if (on)
                c[key] = true;
        }

        // Cross-cutting interfaces first; the type switch below adds what only one template type knows.
        Flag("fateful", e is IFatefulEncounterReadOnly { FatefulEncounter: true });
        Flag("gmax", e is IGigantamaxReadOnly { CanGigantamax: true });
        if (e is IDynamaxLevelReadOnly { DynamaxLevel: not 0 } dynamax)
            c["dynamaxLevel"] = (int)dynamax.DynamaxLevel;
        if (e is IGemType { TeraType: not GemType.Default } gem)
            c["teraType"] = Name(gem.TeraType);
        if (e is IAlphaReadOnly { IsAlpha: true })
            c["alpha"] = e is EncounterSlot8a { AlphaType: 1 } ? "random" : "always";
        if (e is IEncounterTime { EncounterTime: not EncounterTime.Any } timed)
        {
            // Gen 2: bit set = can be met in that period.
            var t = timed.EncounterTime;
            var times = new List<string>(3);
            if (t.HasFlag(EncounterTime.Morning)) times.Add("Morning");
            if (t.HasFlag(EncounterTime.Day)) times.Add("Day");
            if (t.HasFlag(EncounterTime.Night)) times.Add("Night");
            c["time"] = times;
        }
        if (e is ITeraRaid9 tera)
        {
            c["stars"] = (int)tera.Stars;
            if (tera.IsDistribution)
                c["distIndex"] = (int)tera.Index;
            c["host"] = GamesOf(it);
        }

        switch (e)
        {
            case EncounterStatic1 x:
                Flag("starterPikachu", x.IsStarterPikachu);
                break;
            case EncounterSlot2 x:
                Flag("headbutt", x.IsHeadbutt);
                Flag("headbuttSpecial", x.Type == SlotType2.HeadbuttSpecial);
                Flag("bugContest", x.Type == SlotType2.BugContest);
                // PKHeX's slot tables list Headbutt groups for maps that have no Headbutt tree (and the special group of
                // maps whose trees never use it). Which tree a save can shake depends on the Trainer ID's last digit.
                Flag("noTree", x.IsHeadbutt && !HasHeadbuttTree(x));
                break;
            case EncounterStatic2 x:
                Flag("roaming", x.IsRoaming);
                Flag("oddEgg", x.IsDizzyPunchEgg);
                break;
            case EncounterGift1 x:
                if (x.Language != EncounterGift1.LanguageRestriction.Any)
                    c["language"] = Name(x.Language);
                break;
            case EncounterGift2 x:
                c["language"] = Name(x.Language);
                break;
            case EncounterSlot3 x:
                Flag("safari", x.IsSafari);
                Flag("swarm", x.Type == SlotType3.SwarmGrass50 || x.GetType().Name == "EncounterSlot3Swarm");
                // PKHeX files Route 119's six random Feebas tiles under a "swarm" fishing type; nothing else uses it.
                if (x.Type == SlotType3.SwarmFish50)
                {
                    if (x.Species != (ushort)Species.Feebas)
                        throw Guard.Fail($"SlotType3.SwarmFish50 now also holds {(Species)x.Species}; it was assumed to be the Feebas tiles only.");
                    c["feebasTiles"] = true;
                }
                break;
            case EncounterStatic3 x:
                Flag("roaming", x.IsRoaming);
                break;
            case EncounterGift3 x:
                if (x.Language != 0)
                    c["language"] = Name((LanguageID)x.Language);
                break;
            case EncounterGift3Colo x:
                // Bonus-disc / Mt. Battle gifts are stamped as coming from Ruby or Sapphire.
                if (x.Version.IsValidSavedVersion() && x.Version != CXD)
                    c["originGame"] = x.Version.ToString();
                if (x.IsJapaneseBonusDisk)
                    c["bonusDisc"] = "JP";
                break;
            case EncounterShadow3Colo x:
                c["shadowId"] = (int)x.Index;
                c["gauge"] = (int)x.Gauge;
                Flag("eReader", x.IsEReader);
                break;
            case EncounterShadow3XD x:
                c["shadowId"] = (int)x.Index;
                c["gauge"] = (int)x.Gauge;
                break;
            case EncounterSlot3XD x:
                c["pokeSpot"] = Name(x.Parent.Type);
                break;
            case EncounterSlot4 x:
                Flag("radar", x.CanUseRadar);
                Flag("bugContest", x.IsBugContest);
                Flag("safari", x.IsSafariHGSS || x.FixedBall == Ball.Safari);
                Flag("marsh", Locations4.IsMarsh(x.Location));
                Flag("honeyTree", x.Type == SlotType4.HoneyTree);
                Flag("headbutt", x.Type is SlotType4.Headbutt or SlotType4.HeadbuttSpecial);
                Flag("headbuttSpecial", x.Type == SlotType4.HeadbuttSpecial);
                Flag("feebasTiles", x.Parent.IsCoronetFeebasArea);
                break;
            case EncounterStatic4 x:
                Flag("roaming", x.IsRoaming);
                break;
            case EncounterStatic4Pokewalker x:
            {
                var courses = GameInfo.Strings.walkercourses;
                var id = (int)x.Course;
                Guard.Require(id < courses.Length, $"Pokéwalker course {x.Course} has no name in PKHeX's strings.");
                c["course"] = courses[id];
                c["courseId"] = id;
                break;
            }
            case EncounterSlot5 x:
                Flag("hiddenGrotto", x.IsHiddenGrotto);
                Flag("swarm", x.Type == SlotType5.Swarm);
                break;
            case EncounterStatic5 x:
                Flag("roaming", x.IsRoaming);
                break;
            case EncounterStatic5Entree x:
                if (x.Promotion != GlobalLinkPromotion.NotPromotion)
                    c["promotion"] = Name(x.Promotion);
                break;
            case EncounterSlot6XY x:
                Flag("friendSafari", x.IsFriendSafari);
                Flag("horde", x.IsHorde);
                break;
            case EncounterSlot6AO x:
                Flag("dexNav", x.CanDexNav);
                Flag("horde", x.IsHorde);
                break;
            case EncounterSlot7 x:
                Flag("sos", x.IsSOS);
                Flag("pelago", x.Location == Locations.Pelago7);
                break;
            case EncounterStatic7 x:
                Flag("totem", x.IsTotem);
                break;
            case EncounterTrade1 x:
                Flag("evolveOnTrade", x.EvolveOnTrade);
                break;
            case EncounterTrade7 x:
                Flag("evolveOnTrade", x.EvolveOnTrade);
                break;
            case EncounterTrade9 x:
                Flag("evolveOnTrade", x.EvolveOnTrade);
                break;
            case EncounterSlot8 x:
                AddWeather8(x.Weather);
                Flag("fishing", x.CanEncounterViaFishing);
                Flag("curry", x.CanEncounterViaCurry);
                break;
            case EncounterStatic8 x:
                // Normal is the property's default and only means "no weather was specified" for a static.
                if (x.Weather != AreaWeather8.Normal)
                    AddWeather8(x.Weather);
                break;
            case EncounterStatic8N x:
                // Ranks are stored 0-4; the games show them as 1-5 stars.
                c["rank"] = new[] { Reflect.Get<byte>(x, "MinRank") + 1, Reflect.Get<byte>(x, "MaxRank") + 1 };
                c["nest"] = (int)Reflect.Get<byte>(x, "NestIndex");
                break;
            case EncounterStatic8ND x:
                c["distIndex"] = (int)x.Index;
                break;
            case EncounterSlot8b x:
                Flag("underground", x.IsUnderground);
                Flag("marsh", x.IsMarsh);
                Flag("safari", x.FixedBall == Ball.Safari);
                Flag("radar", x.CanUseRadar);
                break;
            case EncounterStatic8b x:
                Flag("roaming", x.IsRoaming);
                break;
            case EncounterSlot9 x:
                AddWeather9(x.Weather);
                if ((x.Time & 0xF) != 0)
                {
                    // Bit set = cannot spawn then: 0 Lunchtime, 1 Sleepy-Time, 2 Dusk, 3 Dawn (the marks' names).
                    var times = new List<string>(4);
                    if ((x.Time & 8) == 0) times.Add("Morning");
                    if ((x.Time & 1) == 0) times.Add("Day");
                    if ((x.Time & 4) == 0) times.Add("Evening");
                    if ((x.Time & 2) == 0) times.Add("Night");
                    c["time"] = times;
                }
                break;
            case EncounterOutbreak9 x:
                AddWeather9(x.Weather);
                if (Enum.IsDefined(x.Ribbon))
                    c["mark"] = Name(x.Ribbon);
                break;
            case EncounterStatic9 x:
                Flag("titan", x.IsTitan);
                Flag("rideLegend", x.StarterBoxLegend);
                break;
            case EncounterTera9 x:
                c["map"] = Name(x.Map);
                break;
            case EncounterSlot9a x:
                Flag("hyperspace", x.Type == SlotType9a.Hyperspace);
                break;
            case EncounterStatic9a x:
                Flag("hyperspace", x.Location == EncounterArea9a.LocationHyperspace);
                break;
        }

        if (c.Count == 0)
            return null;
        var result = new Obj();
        foreach (var (key, value) in c)
            result.Add(key, value);
        return result;

        void AddWeather8(AreaWeather8 weather)
        {
            var names = FlagNames(weather, WeatherBits8);
            if (names.Count != 0)
                c["weather"] = names;
            // Two non-weather spawn conditions share the weather bit field.
            Flag("shakingTrees", weather.HasFlag(AreaWeather8.Shaking_Trees));
            Flag("fishing", weather.HasFlag(AreaWeather8.Fishing));
        }

        void AddWeather9(AreaWeather9 weather)
        {
            var names = FlagNames(weather, 0xFF);
            if (names.Count != 0)
                c["weather"] = names;
        }
    }

    /// <summary>True when at least one Trainer ID can find this Headbutt slot (PKHeX's own tree table).</summary>
    private static bool HasHeadbuttTree(EncounterSlot2 slot)
    {
        for (ushort id = 0; id < 10; id++)
        {
            if (slot.IsTreeAvailable(id))
                return true;
        }
        return false;
    }

    private static string? Method(IEncounterTemplate e) => e switch
    {
        EncounterSlot1 x => Name(x.Type),
        EncounterSlot2 x => Name(x.Type),
        EncounterSlot3 x => Name(x.Type),
        EncounterSlot4 x => Name(x.Type),
        EncounterSlot5 x => Name(x.Type),
        EncounterSlot6XY x => Name(x.Type),
        EncounterSlot6AO x => Name(x.Type),
        EncounterSlot7 x => Name(x.Type),
        EncounterSlot8 x => Name(x.Type),
        EncounterSlot8a x => Name(x.Type),
        EncounterSlot8b x => Name(x.Type),
        EncounterSlot9a x => Name(x.Type),
        _ => null,
    };

    private static int FixedGender(IEncounterTemplate e) => e switch
    {
        // The Gender enum aliases Random to 2, so only Male / Female are ever fixed here.
        EncounterSlot8a { Gender: Gender.Male or Gender.Female } x => (int)x.Gender,
        IFixedGender { IsFixedGender: true } x => x.Gender,
        _ => -1,
    };

    /// <summary>English nickname of a template that forces one (in-game trades, one Z-A gift).</summary>
    private static string? Nickname(IEncounterTemplate e)
    {
        if (e is not IFixedNickname { IsFixedNickname: true } fixedNickname)
            return null;
        try
        {
            var name = fixedNickname.GetNickname(English);
            return string.IsNullOrWhiteSpace(name) ? null : name;
        }
        catch (Exception ex) when (ex is IndexOutOfRangeException or ArgumentOutOfRangeException)
        {
            // EncounterTrade3XD indexes a shorter language table than it advertises.
            return null;
        }
    }

    private static readonly SimpleTrainerInfo EnglishTrainer1 = new(RD);
    private static readonly SimpleTrainerInfo EnglishTrainer2 = new(C);

    /// <summary>Original Trainer name(s) a template forces, as an English-language game shows them.</summary>
    private static string[] TrainerNames(IEncounterTemplate e)
    {
        switch (e)
        {
            case EncounterGift1 { Trainer: not EncounterGift1.TrainerType.Recipient } x:
                return [x.ConvertToPKM(EnglishTrainer1).OriginalTrainerName];
            case EncounterGift2 { Trainer: not EncounterGift2.TrainerType.Recipient } x:
                return [x.ConvertToPKM(EnglishTrainer2).OriginalTrainerName];
            case EncounterGift3 x:
                return string.IsNullOrWhiteSpace(x.OriginalTrainerName) ? [] : [x.OriginalTrainerName];
            case EncounterGift3NY x:
                return [.. new[] { x.Distribution.GetTrainerName(false), x.Distribution.GetTrainerName(true) }.Distinct(StringComparer.Ordinal)];
            case EncounterGift3JPN x:
                return [.. Enumerable.Range(0, 6).Select(i => x.Distribution.GetTrainerName((ushort)i)).Distinct(StringComparer.Ordinal)];
            case EncounterStatic5N:
                return [Reflect.InvokeStatic<string>(typeof(EncounterStatic5N), "GetOT", English)];
            case EncounterTrade4RanchGift:
                return [Reflect.InvokeStatic<string>(typeof(EncounterTrade4RanchGift), "GetTrainerName", English)];
            case EncounterGift9a { IsFixedTrainer: true } x:
                return [Reflect.InvokeStatic<string>(typeof(EncounterGift9a), "GetFixedTrainerName", x.Trainer, English)];
        }
        // In-game trades and Colosseum gifts keep one name per language in a TrainerNames member (private on most types).
        if (e is IFixedTrainer { IsFixedTrainer: true } && Reflect.Has(e, "TrainerNames"))
        {
            var names = Reflect.Get<ReadOnlyMemory<string>>(e, "TrainerNames").Span;
            if (names.Length > English && !string.IsNullOrWhiteSpace(names[English]))
                return [names[English]];
        }
        return [];
    }

    public static Row Resolve(Item it)
    {
        var e = it.Enc;
        var games = GamesOf(it);
        var locations = LocationsOf(it, out var egg, out var alternates);
        var ots = TrainerNames(e);
        return new Row
        {
            Games = [.. games.Select(Games.Index).Order()],
            Species = e.Species,
            Form = e.Form,
            // EncounterTrade1.LevelMin depends on ParseSettings (tradeback rules); LevelMinRBY is what the game hands out.
            LevelMin = e is EncounterTrade1 trade1 ? trade1.LevelMinRBY : e.LevelMin,
            LevelMax = e.LevelMax,
            Kind = Kind(e),
            Clr = e.GetType().Name,
            Source = it.Source,
            Set = LocationSet(e),
            Label = e is IEncounterable named ? named.LongName : e.GetType().Name,
            Method = Method(e),
            Locations = locations,
            AltLocations = alternates,
            EggLocation = egg,
            Shiny = e.Shiny == PKHeX.Core.Shiny.Random ? null : Name(e.Shiny),
            Ball = (int)e.FixedBall,
            Gender = FixedGender(e),
            Conditions = Conditions(it),
            Nickname = Nickname(e),
            Ot = ots.Length == 0 ? null : ots[0],
            Ots = ots.Length > 1 ? ots : null,
            Trainer = e switch
            {
                EncounterGift1 { Trainer: not EncounterGift1.TrainerType.Recipient } x => Name(x.Trainer),
                EncounterGift2 { Trainer: not EncounterGift2.TrainerType.Recipient } x => Name(x.Trainer),
                EncounterGift9a { Trainer: not TrainerGift9a.None } x => Name(x.Trainer),
                _ => null,
            },
            Distribution = e switch
            {
                EncounterGift3NY x => Name(x.Distribution),
                EncounterGift3JPN x => Name(x.Distribution),
                _ => null,
            },
            IsEgg = e.IsEgg,
        };
    }
}
