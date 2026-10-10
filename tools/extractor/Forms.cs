using PKHeX.Core;
using static PKHeX.Core.EntityContext;

namespace Pelagix.Extractor;

public sealed class FormDump
{
    public required Obj Json;
    public required int Species;
    public required int Forms;
}

/// <summary>forms.json: every form index PKHeX knows for every species, its English name per context, and its form-level flags.</summary>
public static class Forms
{
    /// <summary>Newest first: the first context that names a form supplies its primary name.</summary>
    public static readonly EntityContext[] Contexts = [Gen9a, Gen9, Gen8a, Gen8b, Gen8, Gen7b, Gen7, Gen6, Gen5, Gen4, Gen3, Gen2, Gen1];

    private sealed record TableInfo(string Name, IPersonalTable Table, EntityContext Context);

    /// <summary>Every PersonalTable, newest first.</summary>
    private static readonly TableInfo[] Tables =
    [
        new("ZA", PersonalTable.ZA, Gen9a), new("SV", PersonalTable.SV, Gen9), new("LA", PersonalTable.LA, Gen8a),
        new("BDSP", PersonalTable.BDSP, Gen8b), new("SWSH", PersonalTable.SWSH, Gen8), new("GG", PersonalTable.GG, Gen7b),
        new("USUM", PersonalTable.USUM, Gen7), new("SM", PersonalTable.SM, Gen7), new("AO", PersonalTable.AO, Gen6), new("XY", PersonalTable.XY, Gen6),
        new("B2W2", PersonalTable.B2W2, Gen5), new("BW", PersonalTable.BW, Gen5),
        new("HGSS", PersonalTable.HGSS, Gen4), new("Pt", PersonalTable.Pt, Gen4), new("DP", PersonalTable.DP, Gen4),
        new("E", PersonalTable.E, Gen3), new("FR", PersonalTable.FR, Gen3), new("LG", PersonalTable.LG, Gen3), new("RS", PersonalTable.RS, Gen3),
        new("C", PersonalTable.C, Gen2), new("GS", PersonalTable.GS, Gen2), new("Y", PersonalTable.Y, Gen1), new("RB", PersonalTable.RB, Gen1),
    ];

    /// <summary>
    /// Typing and gender ratio are only read from Gen 5+ tables: older ones use their own type numbering
    /// (a "???" type sits at 9) and every species they hold also exists in a newer table.
    /// </summary>
    private static bool HasModernTypeIds(TableInfo t) => t.Context.Generation >= 5;

    private const int FormProbeLimit = 64;

    public static FormDump Build(GameStrings strings)
    {
        Guard.Require(Tables.Select(z => z.Context).Distinct().Count() == Contexts.Length, "Forms.Tables does not cover every context.");
        int maxSpecies = Tables.Max(z => z.Table.MaxSpeciesID);
        var rows = new List<Obj>(maxSpecies);
        int formTotal = 0;
        for (ushort species = 1; species <= maxSpecies; species++)
        {
            var row = BuildSpecies(species, strings, out int forms);
            formTotal += forms;
            rows.Add(row);
        }
        var json = new Obj
        {
            ["contexts"] = Contexts.Select(z => z.ToString()).ToArray(),
            ["rows"] = rows,
        };
        return new FormDump { Json = json, Species = rows.Count, Forms = formTotal };
    }

    /// <summary>
    /// The primary name of every form index of a species in the given language: what <c>names[0].n</c> of forms.json
    /// is in English (the name in the newest context that lists the index). "" for an index no context names.
    /// </summary>
    public static string[] PrimaryNames(ushort species, GameStrings strings)
    {
        var lists = new List<string[]>();
        foreach (var context in Contexts)
        {
            if (Tables.Any(t => t.Context == context && InGame(t, species)))
                lists.Add(FormConverter.GetFormList(species, strings.types, strings.forms, GameInfo.GenderSymbolUnicode, context));
        }
        int count = lists.Count == 0 ? 0 : lists.Max(z => z.Length);
        var names = new string[count];
        for (int f = 0; f < count; f++)
            names[f] = lists.First(z => f < z.Length)[f];
        return names;
    }

    private static bool InGame(TableInfo t, ushort species) => species <= t.Table.MaxSpeciesID && t.Table.IsSpeciesInGame(species);
    private static bool Present(TableInfo t, ushort species, int form) => species <= t.Table.MaxSpeciesID && t.Table.IsPresentInGame(species, (byte)form);

    private static Obj BuildSpecies(ushort species, GameStrings strings, out int formCount)
    {
        // Form-name lists, for the contexts that have the species in at least one of their games.
        var lists = new List<(EntityContext Context, string[] Names)>();
        foreach (var context in Contexts)
        {
            if (!Tables.Any(t => t.Context == context && InGame(t, species)))
                continue;
            lists.Add((context, FormConverter.GetFormList(species, strings.types, strings.forms, GameInfo.GenderSymbolUnicode, context)));
        }
        Guard.Require(lists.Count != 0, $"Species {species} is in no PersonalTable.");

        int count = lists.Max(z => z.Names.Length);
        foreach (var t in Tables)
        {
            if (!InGame(t, species))
                continue;
            count = Math.Max(count, t.Table[species].FormCount);
            for (int f = count; f < FormProbeLimit; f++)
            {
                if (Present(t, species, f))
                    count = f + 1;
            }
        }
        formCount = count;

        var forms = new List<Obj>(count);
        for (int f = 0; f < count; f++)
            forms.Add(BuildForm(species, (byte)f, lists));

        var row = new Obj { ["s"] = (int)species, ["forms"] = forms };
        if (FormConverter.GetFormArgumentIsNamedIndex(species))
            row["formArgs"] = FormConverter.GetFormArgumentStrings(species);
        return row;
    }

    private static Obj BuildForm(ushort species, byte form, List<(EntityContext Context, string[] Names)> lists)
    {
        var o = new Obj { ["f"] = (int)form };

        // Names, grouped: [{ n: name, ctx: [contexts that use it] }], newest context first.
        var names = new List<(string Name, List<string> Contexts)>();
        foreach (var (context, list) in lists)
        {
            if (form >= list.Length)
                continue;
            var entry = names.Find(z => z.Name == list[form]);
            if (entry.Contexts is null)
                names.Add(entry = (list[form], []));
            entry.Contexts.Add(context.ToString());
        }
        o["names"] = names.Select(z => new Obj { ["n"] = z.Name, ["ctx"] = z.Contexts }).ToArray();

        // Contexts in which the form index means something: named there, or accepted by one of that context's tables.
        var live = Contexts.Where(c =>
            lists.Any(z => z.Context == c && form < z.Names.Length) ||
            Tables.Any(t => t.Context == c && Present(t, species, form))).ToArray();
        var newestPresent = Contexts.Cast<EntityContext?>().FirstOrDefault(c => Tables.Any(t => t.Context == c && Present(t, species, form)));
        var reference = newestPresent ?? (live.Length != 0 ? live[0] : lists[0].Context);
        byte generation = reference.Generation;

        if (FormInfo.IsMegaForm(species, form)) o["mega"] = 1;
        if (FormInfo.IsPrimalForm(species, form)) o["primal"] = 1;

        // Listed by context rather than bare generation: generation 9 covers both SV (no Megas) and Z-A.
        var battleOnly = live.Where(c => FormInfo.IsBattleOnlyForm(species, form, c.Generation)).ToArray();
        if (battleOnly.Length != 0)
        {
            o["battleOnly"] = battleOnly.Select(z => z.ToString()).ToArray();
            // Only meaningful for battle-only forms: PKHeX returns out-of-range indexes for anything else (e.g. Minior cores).
            var targets = battleOnly.Select(c => (Context: c, Form: (int)FormInfo.GetOutOfBattleForm(species, form, c.Generation))).ToArray();
            o["outOfBattle"] = targets[0].Form;
            if (targets.Select(z => z.Form).Distinct().Count() > 1)
            {
                var map = new Obj();
                foreach (var (c, f) in targets)
                    map.Add(c.ToString(), f);
                o["outOfBattleIn"] = map;
            }
        }

        if (FormInfo.IsFusedForm(species, form, generation)) o["fused"] = 1;
        if (FormInfo.IsTotemForm(species, form)) o["totem"] = 1;
        if (FormInfo.IsLordForm(species, form, Gen8a)) o["lord"] = 1;

        // "Can the player switch another form into this one" - asked from form 0 (or from form 1 for form 0).
        byte other = form == 0 ? (byte)1 : (byte)0;
        var changeableIn = live.Where(c => FormInfo.IsFormChangeable(species, other, form, c, c)).ToArray();
        if (changeableIn.Contains(reference)) o["changeable"] = 1;
        if (changeableIn.Length != 0 && changeableIn.Length != live.Length)
            o["changeableIn"] = changeableIn.Select(z => z.ToString()).ToArray();

        if (TradeRestrictions.IsUntradable(species, form, 0, generation)) o["untradable"] = 1;
        // The Gigantamax factor only exists in Sword / Shield, so the form has to exist there too.
        if (Gigantamax.CanToggle(species, form) && PersonalTable.SWSH.IsPresentInGame(species, form)) o["gmax"] = 1;

        var source = Tables.FirstOrDefault(t => HasModernTypeIds(t) && Present(t, species, form));
        PersonalInfo info;
        if (source is not null)
        {
            info = source.Table.GetFormEntry(species, form);
            o["pt"] = source.Name;
        }
        else
        {
            // No modern table has the form (Spiky-eared Pichu, name-only indexes): fall back to the species' base entry.
            var fallback = Tables.FirstOrDefault(t => HasModernTypeIds(t) && InGame(t, species))
                           ?? throw Guard.Fail($"Species {species} is in no Gen 5+ PersonalTable.");
            info = fallback.Table.GetFormEntry(species, 0);
            o["pt"] = fallback.Name;
            o["ptBase"] = 1;
        }
        o["gr"] = (int)info.Gender;
        o["t"] = info.Type1 == info.Type2
            ? new[] { TypeName(info.Type1) }
            : new[] { TypeName(info.Type1), TypeName(info.Type2) };
        return o;
    }

    private static string TypeName(byte type)
    {
        var types = GameInfo.Strings.types;
        return type < types.Length ? types[type] : throw Guard.Fail($"Type id {type} has no name.");
    }
}
