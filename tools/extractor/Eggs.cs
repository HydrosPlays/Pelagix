using PKHeX.Core;

namespace Pelagix.Extractor;

public sealed class EggDump
{
    public required Obj Json;
    public required int Pairs;
    public required Obj Counts;
}

/// <summary>
/// eggs.json: per game, the (species, form) pairs that come straight out of an egg bred in that game.
/// PKHeX has no egg tables; its egg generators answer per species, so every present pair is asked.
/// </summary>
public static class Eggs
{
    public static EggDump Build(PresenceData presence)
    {
        var root = new Obj();
        var counts = new Obj();
        int total = 0;
        foreach (var game in Games.Order)
        {
            var pairs = new List<int[]>();
            if (CanBreed(game))
            {
                var version = Games.Saved(game);
                var context = Games.Context(game);
                foreach (var (species, form) in presence.Of(game))
                {
                    if (HatchesDirectly(context, version, species, form))
                        pairs.Add([species, form]);
                }
                Guard.Require(pairs.Count != 0, $"{game}: PKHeX says the game has eggs but no species hatches from one.");
            }
            total += pairs.Count;
            counts.Add(game, pairs.Count);
            root.Add(game, pairs);
        }
        return new EggDump { Json = root, Pairs = total, Counts = counts };
    }

    private static bool CanBreed(string game)
    {
        if (game == "GO")
            return false;
        var version = Games.Saved(game);
        return EncounterGenerator.GetGenerator(version, version.Generation).CanGenerateEggs;
    }

    /// <summary>
    /// True when an egg in <paramref name="game"/> can hatch into exactly this species and form: either it is the
    /// family's egg species, or an incense-era "split breed" species (Marill, Snorlax ...) that hatches as itself.
    /// </summary>
    private static bool HatchesDirectly(EntityContext context, GameVersion game, ushort species, byte form)
    {
        // PKHeX inspects the last (most devolved) chain entry only.
        ReadOnlySpan<EvoCriteria> chain = [new EvoCriteria { Species = species, Form = form, LevelMin = 1, LevelMax = 100 }];
        IEncounterTemplate? egg, split = null;
        switch (context)
        {
            case EntityContext.Gen2:
                if (!EncounterGenerator2.TryGetEgg(chain, game, out var e2)) return false;
                egg = e2;
                break;
            case EntityContext.Gen3:
                if (!EncounterGenerator3.TryGetEgg(chain, game, out var e3)) return false;
                egg = e3;
                if (EncounterGenerator3.TryGetSplit(e3, chain, out var s3)) split = s3;
                break;
            case EntityContext.Gen4:
                if (!EncounterGenerator4.TryGetEgg(chain, game, out var e4)) return false;
                egg = e4;
                if (EncounterGenerator4.TryGetSplit(e4, chain, out var s4)) split = s4;
                break;
            case EntityContext.Gen5:
                if (!EncounterGenerator5.TryGetEgg(chain, game, out var e5)) return false;
                egg = e5;
                if (EncounterGenerator5.TryGetSplit(e5, chain, out var s5)) split = s5;
                break;
            case EntityContext.Gen6:
                if (!EncounterGenerator6.TryGetEgg(chain, game, out var e6)) return false;
                egg = e6;
                if (EncounterGenerator6.TryGetSplit(e6, chain, out var s6)) split = s6;
                break;
            case EntityContext.Gen7:
                if (!EncounterGenerator7.TryGetEgg(chain, game, out var e7)) return false;
                egg = e7;
                if (EncounterGenerator7.TryGetSplit(e7, chain, out var s7)) split = s7;
                break;
            case EntityContext.Gen8:
                if (!EncounterGenerator8.TryGetEgg(chain, game, out var e8)) return false;
                egg = e8;
                if (EncounterGenerator8.TryGetSplit(e8, chain, out var s8)) split = s8;
                break;
            case EntityContext.Gen8b:
                if (!EncounterGenerator8b.TryGetEgg(chain, game, out var e8b)) return false;
                egg = e8b;
                if (EncounterGenerator8b.TryGetSplit(e8b, chain, out var s8b)) split = s8b;
                break;
            case EntityContext.Gen9:
                if (!EncounterGenerator9.TryGetEgg(chain, game, out var e9)) return false;
                egg = e9;
                break;
            default:
                throw Guard.Fail($"No egg generator wired up for {context}; PKHeX says {game} can breed.");
        }
        return Matches(egg, context, species, form) || (split is not null && Matches(split, context, species, form));
    }

    private static bool Matches(IEncounterTemplate egg, EntityContext context, ushort species, byte form)
    {
        if (egg.Species != species)
            return false;
        // Battle-only forms, Rotom's appliances and Castform's weather forms never come out of an egg: the egg holds the
        // base state. Gen 2-4 egg templates carry no form (they report 0 and accept any), and the Gen 5 generator hands
        // the queried form straight back (its evolution tree does not devolve forms), so the rule is applied here for
        // every generation instead of trusting the template.
        bool reverts = FormInfo.IsBattleOnlyForm(species, form, context.Generation) || species is (ushort)Species.Rotom or (ushort)Species.Castform;
        if (reverts && FormInfo.GetOutOfBattleForm(species, form, context.Generation) != form)
            return false;
        return context.Generation <= 4 || egg.Form == form;
    }
}
