using System.Globalization;
using PKHeX.Core;

namespace Pelagix.Extractor;

public sealed class GoDump
{
    public required Obj Json;
    public required int Templates;
    public required int Rows;
    public required int TemplatesHome;
    public required int TemplatesLgpe;
    /// <summary>Distinct fixed balls GO slots force (for balls.json).</summary>
    public required SortedSet<int> FixedBalls;
}

/// <summary>
/// go.json: Pokémon GO is a list of ~22k date-bounded slots with no locations, so it is reduced to one summary per
/// species-form: can it reach HOME, can it reach Let's Go through GO Park, can it be shiny, and when.
/// </summary>
public static class Go
{
    // IPogoDateRange.FirstDay (internal const): day 0 is the day before launch (2016-07-06), 0 itself means "no bound".
    private const int FirstDay = 736150 - 1;

    public static GoDump Build(IReadOnlyList<Item> items)
    {
        var groups = new SortedDictionary<(ushort Species, byte Form), (List<IPogoSlot> Home, List<IPogoSlot> Lgpe)>();
        var fixedBalls = new SortedSet<int>();
        int home = 0, lgpe = 0;
        foreach (var it in items)
        {
            var e = it.Enc;
            if (e is not IPogoSlot slot)
                throw Guard.Fail($"GO template {e.GetType().Name} is not an IPogoSlot.");
            if (!groups.TryGetValue((e.Species, e.Form), out var lists))
                groups[(e.Species, e.Form)] = lists = ([], []);
            switch (e)
            {
                case EncounterSlot8GO: lists.Home.Add(slot); home++; break;
                case EncounterSlot7GO: lists.Lgpe.Add(slot); lgpe++; break;
                default: throw Guard.Fail($"Unknown GO template type {e.GetType().Name}.");
            }
            if (e.FixedBall != Ball.None)
                fixedBalls.Add((int)e.FixedBall);
        }

        var rows = new List<Obj>(groups.Count);
        foreach (var ((species, form), (homeSlots, lgpeSlots)) in groups)
        {
            var row = new Obj { ["s"] = (int)species, ["f"] = (int)form };
            if (homeSlots.Count != 0) row["home"] = Summary(homeSlots);
            if (lgpeSlots.Count != 0) row["lgpe"] = Summary(lgpeSlots);
            rows.Add(row);
        }
        return new GoDump
        {
            Json = new Obj { ["rows"] = rows },
            Templates = items.Count,
            Rows = rows.Count,
            TemplatesHome = home,
            TemplatesLgpe = lgpe,
            FixedBalls = fixedBalls,
        };
    }

    private static Obj Summary(List<IPogoSlot> slots)
    {
        var o = new Obj { ["n"] = slots.Count };
        if (slots.Any(z => z.Shiny != Shiny.Never)) o["shiny"] = 1;
        // Shown the way PKHeX prints them: slots flagged "local time" store the day before / after the real one.
        if (slots.All(z => z.DayStart != 0))
            o["from"] = Date(slots.Min(z => z.DayStart + (z.IsLocalDayStart ? 1 : 0)));
        if (slots.All(z => z.DayEnd != 0))
            o["to"] = Date(slots.Max(z => z.DayEnd - (z.IsLocalDayEnd ? 1 : 0)));
        o["types"] = slots.Select(z => z.Type).Distinct().Order().Select(TypeName).ToArray();
        o["lvMin"] = slots.Min(z => (int)((IEncounterTemplate)z).LevelMin);
        // GO -> HOME only: the earliest format the transfer can land in. PKHeX stores it once per species-form.
        var formats = slots.OfType<EncounterSlot8GO>().Select(z => z.OriginFormat).Distinct().ToArray();
        if (formats.Length > 1)
            throw Guard.Fail($"GO species {((IEncounterTemplate)slots[0]).Species} has slots with different import formats ({string.Join(", ", formats)}).");
        if (formats.Length == 1)
            o["fmt"] = Enum.GetName(formats[0]) ?? throw Guard.Fail($"PogoImportFormat {(int)formats[0]} has no name.");
        return o;
    }

    private static string TypeName(PogoType type)
        => Enum.GetName(type) ?? throw Guard.Fail($"PogoType {(int)type} has no name.");

    private static string Date(int day) => DateOnly.FromDayNumber(FirstDay + day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
