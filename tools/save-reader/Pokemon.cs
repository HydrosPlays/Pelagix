using System.Globalization;
using System.Text.Json;
using PKHeX.Core;
using static PKHeX.Core.GameVersion;

namespace Pelagix.SaveReader;

/// <summary>One Pokémon as PKHeX facts: ids are PKHeX's own, the same ones the app's datasets were generated from.</summary>
public static class Pokemon
{
    public static void Write(Utf8JsonWriter w, Slot slot)
    {
        var pk = slot.Pk;
        w.WriteStartObject();
        if (slot.Box < 0)
        {
            w.WriteString("place", "party");
            w.WriteNull("box");
            w.WriteNull("boxName");
        }
        else
        {
            w.WriteString("place", "box");
            w.WriteNumber("box", slot.Box);
            w.WriteString("boxName", slot.BoxName);
        }
        w.WriteNumber("slot", slot.Index);

        w.WriteNumber("species", pk.Species);
        w.WriteNumber("form", pk.Form);
        // Only where the argument picks a named sub-variant (Alcremie's sweet); elsewhere it counts days, coins or damage.
        if (pk is IFormArgument arg && FormConverter.GetFormArgumentIsNamedIndex(pk.Species))
            w.WriteNumber("formArgument", arg.FormArgument);
        else
            w.WriteNull("formArgument");
        w.WriteString("gender", pk.Gender switch { 0 => "m", 1 => "f", _ => "n" });
        w.WriteBoolean("shiny", pk.IsShiny);
        w.WriteBoolean("gmax", pk is IGigantamaxReadOnly { CanGigantamax: true });
        w.WriteBoolean("alpha", pk is IAlphaReadOnly { IsAlpha: true });
        w.WriteBoolean("egg", pk.IsEgg);
        w.WriteNumber("ball", pk.Ball);
        WriteVersion(w, "version", pk.Version);

        WriteLocation(w, "metLocation", MetLocation(pk));
        WriteLocation(w, "eggLocation", EggLocation(pk));
        w.WriteNumber("metLevel", pk.MetLevel);
        if (MetDate(pk) is { } date)
            w.WriteString("metDate", date);
        else
            w.WriteNull("metDate");
        w.WriteNumber("level", pk.CurrentLevel);
        if (pk is { IsNicknamed: true, IsEgg: false } && pk.Nickname.Length != 0)
            w.WriteString("nickname", pk.Nickname);
        else
            w.WriteNull("nickname");
        w.WriteString("ot", pk.OriginalTrainerName);
        w.WriteBoolean("fateful", pk.FatefulEncounter);
        WriteValues(w, pk);

        IEncounterable? match = null;
        var legal = false;
        try
        {
            var la = new LegalityAnalysis(pk, slot.Box < 0 ? StorageSlotType.Party : StorageSlotType.Box);
            match = la.EncounterMatch;
            legal = la.Valid;
        }
        catch (Exception)
        {
            // PKHeX could not analyse it: reported as "no encounter matched".
        }
        w.WriteBoolean("legal", legal);
        WriteEncounter(w, pk, match);
        w.WriteString("fingerprint", Fingerprint(pk));
        w.WriteEndObject();
    }

    /// <summary>
    /// PID, IVs and EVs, each null where the format has no such value. IVs and EVs are in the order HP, Attack,
    /// Defense, Sp. Atk, Sp. Def, Speed, read through the named properties: PKHeX's own arrays put Speed fourth.
    ///
    /// Generation 1 and 2 formats have no PID, and their IVs are the DVs (0 to 15, Special for both Sp. Atk and
    /// Sp. Def, HP derived from the other four). No EVs where the game trains stats on another scale: Game Boy
    /// stat experience (0 to 65535), Let's Go awakening values, Legends: Arceus effort levels. Legends: Z-A keeps
    /// ordinary EVs.
    /// </summary>
    private static void WriteValues(Utf8JsonWriter w, PKM pk)
    {
        if (pk is GBPKM)
            w.WriteNull("pid");
        else
            w.WriteString("pid", pk.PID.ToString("X8", CultureInfo.InvariantCulture));

        w.WriteStartArray("ivs");
        w.WriteNumberValue(pk.IV_HP);
        w.WriteNumberValue(pk.IV_ATK);
        w.WriteNumberValue(pk.IV_DEF);
        w.WriteNumberValue(pk.IV_SPA);
        w.WriteNumberValue(pk.IV_SPD);
        w.WriteNumberValue(pk.IV_SPE);
        w.WriteEndArray();

        if (pk is GBPKM or IAwakened or IGanbaru)
        {
            w.WriteNull("evs");
            return;
        }
        w.WriteStartArray("evs");
        w.WriteNumberValue(pk.EV_HP);
        w.WriteNumberValue(pk.EV_ATK);
        w.WriteNumberValue(pk.EV_DEF);
        w.WriteNumberValue(pk.EV_SPA);
        w.WriteNumberValue(pk.EV_SPD);
        w.WriteNumberValue(pk.EV_SPE);
        w.WriteEndArray();
    }

    public static void WriteVersion(Utf8JsonWriter w, string property, GameVersion version)
    {
        w.WriteStartObject(property);
        w.WriteNumber("id", (int)version);
        w.WriteString("name", version.ToString());
        w.WriteEndObject();
    }

    private static void WriteLocation(Utf8JsonWriter w, string property, (ushort Id, string Name)? location)
    {
        if (location is not { } l)
        {
            w.WriteNull(property);
            return;
        }
        w.WriteStartObject(property);
        w.WriteNumber("id", l.Id);
        w.WriteString("name", l.Name);
        w.WriteEndObject();
    }

    /// <summary>Null when the format stores no met location (Generation 1, Gold / Silver) or PKHeX has no name for the id.</summary>
    private static (ushort, string)? MetLocation(PKM pk)
    {
        if (pk is PK1 or ICaughtData2 { CaughtData: 0 })
            return null;
        var id = pk.MetLocation;
        // An unhatched egg has not been "met" yet; where it was received is its egg location.
        if (pk.IsEgg && id == 0)
            return null;
        var name = GameInfo.GetLocationName(false, id, pk.Format, pk.Generation, pk.Version);
        return string.IsNullOrEmpty(name) ? null : (id, name);
    }

    private static (ushort, string)? EggLocation(PKM pk)
    {
        var id = pk.EggLocation;
        if (IsNoLocation(id))
            return null;
        var name = GameInfo.GetLocationName(true, id, pk.Format, pk.Generation, pk.Version);
        return string.IsNullOrEmpty(name) ? null : (id, name);
    }

    private static string? MetDate(PKM pk)
    {
        try
        {
            return pk.MetDate is { } d ? d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
        }
        catch (ArgumentOutOfRangeException)
        {
            return null;
        }
    }

    /// <summary>0 everywhere, and 65535 in BDSP (Locations.Default8bNone), mean "no location".</summary>
    private static bool IsNoLocation(ushort id) => id is 0 or Locations.Default8bNone;

    // ---- how it was first obtained ----

    private static void WriteEncounter(Utf8JsonWriter w, PKM pk, IEncounterable? e)
    {
        var type = e is null ? null : Type(e);
        if (e is null || type is null)
        {
            w.WriteNull("encounter");
            return;
        }
        w.WriteStartObject("encounter");
        w.WriteString("kind", Kind(type));
        w.WriteString("type", type);
        w.WriteNumber("species", e.Species);
        w.WriteNumber("form", Form(pk, e));
        WriteVersion(w, "version", e.Version);
        WriteLocation(w, "location", Location(e));
        w.WriteNumber("levelMin", e.LevelMin);
        w.WriteNumber("levelMax", e.LevelMax);
        w.WriteEndObject();
    }

    /// <summary>Templates that leave the form open (Vivillon patterns, random Unown) take the form the Pokémon has.</summary>
    private static byte Form(PKM pk, IEncounterable e)
    {
        if (e.Form < EncounterUtil.FormDynamic)
            return e.Form;
        return e.Species == pk.Species || (Species)e.Species is Species.Scatterbug or Species.Spewpa ? pk.Form : (byte)0;
    }

    /// <summary>Looked up exactly as tools/extractor does, so the name equals the one in the datasets.</summary>
    private static (ushort, string)? Location(IEncounterable e)
    {
        var egg = IsNoLocation(e.Location);
        var id = egg ? e.EggLocation : e.Location;
        if (IsNoLocation(id))
            return null;
        var name = GameInfo.GetLocationName(egg, id, e.Generation, e.Generation, LocationVersion(e));
        return string.IsNullOrEmpty(name) ? null : (id, name);
    }

    private static GameVersion LocationVersion(IEncounterTemplate e) => e.Context switch
    {
        EntityContext.Gen7b => GG,
        EntityContext.Gen8a => PLA,
        EntityContext.Gen8b => BDSP,
        EntityContext.Gen9a => ZA,
        _ => e.Version,
    };

    // The two functions below repeat tools/extractor/Resolve.cs (Resolver.Kind) and tools/build-data/methods.ts (KIND),
    // so that an imported Pokémon and the dataset row of the same encounter get the same kind. Keep them in step.

    // Gen 1 / 2 templates always report Ball.Poke, so PKHeX cannot tell a gift from a battle there.
    private static readonly HashSet<ushort> Gen1Gifts =
    [
        1, 4, 7, 25, 30, 33, 35, 36, 37, 40, 63, 116, 123, 127, 137, 147, 148, 129, 106, 107, 131, 133, 138, 140, 142,
    ];
    private static readonly HashSet<ushort> Gen2Gifts = [152, 155, 158, 133, 236, 147, 23, 25, 27, 63, 104, 122, 137, 202, 246];

    /// <summary>The extractor's fine-grained kind, plus "bred", "transfer" and "go" which have no dataset rows. Null: not an encounter.</summary>
    private static string? Type(IEncounterTemplate e)
    {
        switch (e)
        {
            case EncounterInvalid: return null;
            case IEncounterEgg: return "bred";
            // A Virtual Console Pokémon after Poké Transporter: PKHeX no longer knows the Game Boy encounter behind it.
            case EncounterTransfer7: return "transfer";
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
            case EncounterStatic1 s1: return Gen1Gifts.Contains(s1.Species) ? "gift" : "static";
            case EncounterStatic2 s2: return s2.IsEgg ? "gift-egg" : Gen2Gifts.Contains(s2.Species) ? "gift" : "static";
            // Temple of Sinnoh Dialga / Palkia / Arceus are battles that end in a forced ball, not hand-outs.
            case EncounterStatic8a s8a: return s8a is { FixedBall: Ball.LAPoke, FatefulEncounter: false } ? "gift" : "static";
        }
        var name = e.GetType().Name;
        if (name.StartsWith("EncounterSlot", StringComparison.Ordinal))
            return "wild";
        if (name.StartsWith("EncounterTrade", StringComparison.Ordinal))
            return "trade";
        if (!name.StartsWith("EncounterStatic", StringComparison.Ordinal))
            return null;
        if (e.IsEgg)
            return "gift-egg";
        return e.FixedBall != Ball.None ? "gift" : "static";
    }

    /// <summary>The twelve kinds of the datasets, "bred" for an egg from the Day Care / Nursery / a picnic, or "transfer".</summary>
    private static string Kind(string type) => type switch
    {
        "static-fixed" or "n-pokemon" => "static",
        "starter" or "ranch-gift" => "gift",
        "gift-egg" => "egg",
        "pokewalker" => "walker",
        "dream-world" or "dream-radar" => "dream",
        "raid-event" or "raid-crystal" or "max-lair" => "raid",
        "tera-event" or "tera-7star" => "tera",
        "outbreak-event" => "outbreak",
        "mystery" or "event-egg" => "event",
        // The datasets list Pokémon GO catches as wild rows of the game GO.
        "go" => "wild",
        _ => type,
    };

    // ---- fingerprint ----

    /// <summary>
    /// Identifies one Pokémon across saves, so that importing it twice is noticed.
    ///
    /// Generation 3 and later formats: origin game, trainer id + secret id, encryption constant (the PID before
    /// Generation 6; a transfer copies the PID into the encryption constant). It survives evolving, levelling,
    /// renaming, form changes, trades and every move to a later game or to HOME. It does not survive the move of a
    /// Virtual Console Pokémon into Generation 7 (see below). Two different Pokémon share it when the game fixes all
    /// three values: Shedinja and the Ninjask it split from, and copies of the same in-game trade or fixed-PID
    /// gift received on saves with the same trainer ids.
    ///
    /// Generation 1 and 2 formats have neither a secret id nor an encryption constant: trainer id, the DVs, the
    /// base species of the evolution family and the Original Trainer name. It survives evolving, levelling,
    /// renaming and trading between Generation 1 and 2 games. It does not survive Poké Transporter, which gives
    /// the Pokémon a new random encryption constant, and two Pokémon of one family with the same DVs caught by
    /// the same trainer cannot be told apart.
    /// </summary>
    private static string Fingerprint(PKM pk)
    {
        if (pk is GBPKM gb)
        {
            var family = EvolutionTree.Evolves2.GetBaseSpeciesForm(pk.Species, 0).Species;
            return string.Create(CultureInfo.InvariantCulture, $"gb:{pk.TID16:x4}:{gb.DV16:x4}:{family}:{pk.OriginalTrainerName}");
        }
        return string.Create(CultureInfo.InvariantCulture, $"{(int)pk.Version}:{pk.ID32:x8}:{pk.EncryptionConstant:x8}");
    }
}
