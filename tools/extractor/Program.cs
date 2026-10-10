using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Text;
using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>
/// Usage: Pelagix.Extractor &lt;output directory&gt;
/// Dumps PKHeX.Core's data as JSON (see SCHEMA.md). Everything is built and checked in memory first; files are only
/// written once every guard rail has passed, so a failed run never leaves a half-updated data set behind.
/// </summary>
public static class Program
{
    /// <summary>Lowest acceptable number of real templates (encounters + GO slots + gift Pokémon). v26.08.26 has 218,274.</summary>
    private const int MinimumTemplates = 200_000;

    public static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Length != 1)
        {
            Console.Error.WriteLine("usage: Pelagix.Extractor <output directory>");
            return 2;
        }
        try
        {
            Run(Path.GetFullPath(args[0]));
            return 0;
        }
        catch (ExtractorException ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine($"EXTRACTION FAILED: {ex.Message}");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine($"EXTRACTION FAILED (unexpected {ex.GetType().Name}): {ex}");
            return 1;
        }
    }

    private static void Run(string outDir)
    {
        var total = Stopwatch.StartNew();
        var core = typeof(PKM).Assembly;
        var configuration = core.GetCustomAttribute<AssemblyConfigurationAttribute>()?.Configuration;
        // Debug builds of PKHeX.Core append the numeric id to every location name.
        Guard.Require(string.Equals(configuration, "Release", StringComparison.OrdinalIgnoreCase),
            $"PKHeX.Core was built as '{configuration}'. Build Release (use tools/extractor/run.mjs).");
        // Directory.Build.props stamps the build time after a '+'; only the part before it identifies the PKHeX release.
        var informational = core.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? core.GetName().Version?.ToString() ?? "unknown";
        var pkhexVersion = informational.Split('+')[0];

        GameInfo.CurrentLanguage = "en";
        var strings = GameInfo.GetStrings("en");
        Guard.Require(ReferenceEquals(strings, GameInfo.Strings), "PKHeX's default strings are not English; card titles and names would come out localized.");
        Games.Validate();
        Console.WriteLine($"PKHeX.Core {pkhexVersion} ({configuration}); output -> {outDir}");

        // ---- collect
        var step = Stopwatch.StartNew();
        var items = Collect.All(out var sources);
        var placeholders = items.Count(z => z.Enc.Species == 0);
        var real = items.Where(z => z.Enc.Species != 0).ToList();
        var goItems = real.Where(z => z.Enc is IPogoSlot).ToList();
        var giftItems = real.Where(z => z.Enc is MysteryGift).ToList();
        var encounterItems = real.Where(z => z.Enc is not (IPogoSlot or MysteryGift)).ToList();
        Console.WriteLine($"collect      {step.ElapsedMilliseconds,6} ms  {items.Count} template instances from {sources.Count} holder fields ({placeholders} species-0 placeholders dropped)");

        // ---- encounters, gifts, GO
        step.Restart();
        var locations = new LocationTable();
        var encounters = Encounters.Build(encounterItems, locations);
        Console.WriteLine($"encounters   {step.ElapsedMilliseconds,6} ms  {encounters.Templates} templates -> {encounters.Rows} rows");

        step.Restart();
        var gifts = Gifts.Build(giftItems, locations);
        Console.WriteLine($"gifts        {step.ElapsedMilliseconds,6} ms  {gifts.Entities} gift Pokémon -> {gifts.Rows} rows");

        step.Restart();
        var go = Go.Build(goItems);
        Console.WriteLine($"go           {step.ElapsedMilliseconds,6} ms  {go.Templates} slots -> {go.Rows} species-forms");

        int templateTotal = encounters.Templates + go.Templates + gifts.Entities;
        Guard.Require(templateTotal >= MinimumTemplates,
            $"Only {templateTotal} templates found (encounters {encounters.Templates}, GO {go.Templates}, gifts {gifts.Entities}); expected at least {MinimumTemplates}. PKHeX's data layout has probably changed.");
        Guard.Require(locations.Unresolved.Count == 0,
            $"{locations.Unresolved.Count} location ids have no name in PKHeX's strings (first {Math.Min(20, locations.Unresolved.Count)}): {string.Join("; ", locations.Unresolved.Take(20))}");

        // ---- everything keyed by game or species
        step.Restart();
        var presence = PresenceData.Build();
        Console.WriteLine($"presence     {step.ElapsedMilliseconds,6} ms  {presence.Total} (game, species, form) entries");

        step.Restart();
        var forms = Forms.Build(strings);
        Console.WriteLine($"forms        {step.ElapsedMilliseconds,6} ms  {forms.Species} species, {forms.Forms} forms");

        step.Restart();
        var evolutions = Evolutions.Build(presence, strings);
        Console.WriteLine($"evolutions   {step.ElapsedMilliseconds,6} ms  {evolutions.Edges} edges");

        step.Restart();
        var eggs = Eggs.Build(presence);
        Console.WriteLine($"eggs         {step.ElapsedMilliseconds,6} ms  {eggs.Pairs} (game, species, form) entries");

        var balls = Balls.Build(encounters, go, gifts);
        var stringTables = Strings.Build(strings, evolutions);
        var localized = Localized.Build(locations);

        // ---- meta
        var gamesMeta = Games.Order.Select(code => new Obj
        {
            ["code"] = code,
            ["generation"] = (int)Games.Generation(code),
            ["context"] = Games.Context(code).ToString(),
        }).ToArray();

        var perGame = new Obj();
        var perKind = new Obj();
        var kinds = encounters.Stats.Kinds.Concat(gifts.Stats.Kinds).Distinct(StringComparer.Ordinal).OrderBy(z => z, StringComparer.Ordinal).ToArray();
        for (int g = 0; g < Games.Order.Length; g++)
        {
            var o = new Obj();
            foreach (var kind in kinds)
            {
                var a = encounters.Stats.Cell(g, kind);
                var b = gifts.Stats.Cell(g, kind);
                if (a.Templates + b.Templates != 0)
                    o.Add(kind, new[] { a.Templates + b.Templates, a.Rows + b.Rows });
            }
            perGame.Add(Games.Order[g], o);
        }
        foreach (var kind in kinds)
        {
            var a = encounters.Stats.Kind(kind);
            var b = gifts.Stats.Kind(kind);
            perKind.Add(kind, new[] { a.Templates + b.Templates, a.Rows + b.Rows });
        }

        var meta = new Obj
        {
            ["schema"] = 1,
            ["pkhexVersion"] = pkhexVersion,
            ["language"] = "en",
            ["games"] = gamesMeta,
            ["files"] = new Obj
            {
                ["encounters.json"] = new Obj { ["rows"] = encounters.Rows, ["templates"] = encounters.Templates },
                ["locations.json"] = new Obj { ["names"] = locations.Count, ["bySet"] = locations.Counts() },
                ["gifts.json"] = new Obj { ["rows"] = gifts.Rows, ["entities"] = gifts.Entities, ["byType"] = gifts.CountsByType },
                ["go.json"] = new Obj { ["rows"] = go.Rows, ["templates"] = go.Templates, ["templatesHome"] = go.TemplatesHome, ["templatesLgpe"] = go.TemplatesLgpe },
                ["forms.json"] = new Obj { ["species"] = forms.Species, ["forms"] = forms.Forms },
                ["presence.json"] = new Obj { ["entries"] = presence.Total, ["byGame"] = presence.Counts() },
                ["evolutions.json"] = new Obj { ["edges"] = evolutions.Edges, ["byGame"] = evolutions.Counts },
                ["eggs.json"] = new Obj { ["entries"] = eggs.Pairs, ["byGame"] = eggs.Counts },
                ["balls.json"] = new Obj { ["games"] = Games.Order.Length },
                ["strings.json"] = new Obj
                {
                    ["species"] = PersonalTable.SV.MaxSpeciesID + 1,
                    ["types"] = strings.types.Length,
                    ["balls"] = (int)Ball.LAOrigin + 1,
                    ["items"] = evolutions.Items.Sum(z => z.Value.Count),
                    ["moves"] = evolutions.Moves.Count,
                },
            },
            ["templates"] = new Obj
            {
                ["reflected"] = items.Count,
                ["placeholders"] = placeholders,
                ["encounters"] = encounters.Templates,
                ["go"] = go.Templates,
                ["giftEntities"] = gifts.Entities,
                ["total"] = templateTotal,
            },
            ["perKind"] = perKind,
            ["perGame"] = perGame,
            ["sources"] = sources.Select(z => new Obj { ["src"] = z.Source, ["type"] = z.FieldType, ["total"] = z.Total, ["new"] = z.New }).ToArray(),
            ["vocab"] = encounters.Vocabulary,
        };

        // ---- write (nothing has touched the disk until here)
        step.Restart();
        Directory.CreateDirectory(outDir);
        (string Name, Obj Value, int BreakDepth)[] files =
        [
            ("meta.json", meta, 2),
            ("encounters.json", encounters.Json, 2),
            ("locations.json", locations.ToJson(), 2),
            ("gifts.json", gifts.Json, 2),
            ("go.json", go.Json, 2),
            ("forms.json", forms.Json, 2),
            ("presence.json", presence.ToJson(), 1),
            ("evolutions.json", evolutions.Json, 2),
            ("eggs.json", eggs.Json, 1),
            ("balls.json", balls, 1),
            ("strings.json", stringTables, 1),
            ("localized.json", localized, 2),
        ];
        var sizes = new List<(string Name, long Bytes)>();
        foreach (var (name, value, breakDepth) in files)
            sizes.Add((name, Json.WriteFile(Path.Combine(outDir, name), value, breakDepth)));
        Console.WriteLine($"write        {step.ElapsedMilliseconds,6} ms");

        PrintSummary(encounters, gifts, go, kinds, sizes, templateTotal, items.Count, placeholders);
        Console.WriteLine($"done in {total.ElapsedMilliseconds} ms, peak working set {Process.GetCurrentProcess().PeakWorkingSet64 / (1024 * 1024)} MB");
    }

    private static void PrintSummary(EncounterDump encounters, GiftDump gifts, GoDump go, string[] kinds,
        List<(string Name, long Bytes)> sizes, int templateTotal, int reflected, int placeholders)
    {
        var inv = CultureInfo.InvariantCulture;
        Console.WriteLine();
        Console.WriteLine("Rows per game per kind (aggregated rows; mystery = gifts.json rows)");
        Console.WriteLine($"{"game",-5} {"templates",9} {"rows",7}  kinds");
        for (int g = 0; g < Games.Order.Length; g++)
        {
            var code = Games.Order[g];
            if (code == "GO")
            {
                Console.WriteLine($"{code,-5} {go.Templates.ToString(inv),9} {go.Rows.ToString(inv),7}  go.json: {go.TemplatesHome} HOME slots, {go.TemplatesLgpe} GO Park slots");
                continue;
            }
            var (te, re) = encounters.Stats.Game(g);
            var (tg, rg) = gifts.Stats.Game(g);
            var parts = new List<string>();
            foreach (var kind in kinds)
            {
                int rows = encounters.Stats.Cell(g, kind).Rows + gifts.Stats.Cell(g, kind).Rows;
                if (rows != 0)
                    parts.Add($"{kind} {rows.ToString(inv)}");
            }
            Console.WriteLine($"{code,-5} {(te + tg).ToString(inv),9} {(re + rg).ToString(inv),7}  {string.Join(", ", parts)}");
        }

        Console.WriteLine();
        Console.WriteLine($"{"kind",-16} {"templates",9} {"rows",7}");
        foreach (var kind in kinds)
        {
            var a = encounters.Stats.Kind(kind);
            var b = gifts.Stats.Kind(kind);
            Console.WriteLine($"{kind,-16} {(a.Templates + b.Templates).ToString(inv),9} {(a.Rows + b.Rows).ToString(inv),7}");
        }
        Console.WriteLine($"{"go",-16} {go.Templates.ToString(inv),9} {go.Rows.ToString(inv),7}");
        Console.WriteLine();
        Console.WriteLine($"templates: {reflected} reflected - {placeholders} species-0 placeholders = {encounters.Templates} encounters + {go.Templates} GO slots + 1 Ranger Manaphy gift");
        Console.WriteLine($"           {encounters.Templates} encounters + {go.Templates} GO slots + {gifts.Entities} gift Pokémon = {templateTotal} total");
        Console.WriteLine($"rows:      encounters.json {encounters.Rows}, gifts.json {gifts.Rows}, go.json {go.Rows}");
        Console.WriteLine();
        foreach (var (name, bytes) in sizes)
            Console.WriteLine($"{name,-18} {bytes.ToString("N0", inv),12} bytes");
    }
}
