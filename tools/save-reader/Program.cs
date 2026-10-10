using System.Reflection;
using System.Text.Json;
using PKHeX.Core;

namespace Pelagix.SaveReader;

/// <summary>
/// pelagix-save-reader &lt;save file&gt;: prints the Pokémon in a game save as one JSON document on standard output.
/// The file is only ever read. Exit code 0 with <c>{"ok":true,...}</c>, otherwise <c>{"ok":false,"error":code}</c>.
/// </summary>
public static class Program
{
    private const long MaxFileSize = 64L * 1024 * 1024;

    private const int ExitUsage = 1;
    private const int ExitNotASave = 2;
    private const int ExitUnreadable = 3;
    private const int ExitTooLarge = 4;
    private const int ExitFailed = 5;

    public static int Main(string[] args)
    {
        try
        {
            if (args.Length != 1)
                return Fail("usage", ExitUsage);
            return Run(args[0]);
        }
        catch (Exception)
        {
            // Never a message or a stack trace: the caller only understands the codes.
            return Fail("failed", ExitFailed);
        }
    }

    private static int Run(string path)
    {
        byte[] data;
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            if (stream.Length > MaxFileSize)
                return Fail("too-large", ExitTooLarge);
            data = new byte[stream.Length];
            stream.ReadExactly(data);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException or System.Security.SecurityException)
        {
            return Fail("unreadable", ExitUnreadable);
        }

        var configuration = typeof(PKM).Assembly.GetCustomAttribute<AssemblyConfigurationAttribute>()?.Configuration;
        // Debug builds of PKHeX.Core append the numeric id to every location name.
        if (!string.Equals(configuration, "Release", StringComparison.OrdinalIgnoreCase))
            return Fail("failed", ExitFailed);
        GameInfo.CurrentLanguage = "en";

        SaveFile? sav;
        try
        {
            // No path is passed on: PKHeX has to recognise the save by its content, not by what the file is called.
            if (!SaveUtil.TryGetSaveFile(data, out sav))
                sav = null;
        }
        catch (Exception)
        {
            sav = null;
        }
        if (sav is null)
            return Fail("not-a-save", ExitNotASave);

        ParseSettings.InitFromSaveFileData(sav);
        var found = Collect(sav);

        // Written to memory first, so a failure half way never leaves a broken document on standard output.
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer))
        {
            w.WriteStartObject();
            w.WriteBoolean("ok", true);
            WriteSave(w, sav, found);
            w.WriteStartArray("pokemon");
            foreach (var slot in found)
                Pokemon.Write(w, slot);
            w.WriteEndArray();
            w.WriteEndObject();
        }
        Emit(buffer);
        return 0;
    }

    private static List<Slot> Collect(SaveFile sav)
    {
        var found = new List<Slot>();
        // Let's Go keeps the party inside its one storage list, so there the boxes already hold everything.
        if (sav.HasParty && sav is not SAV7b)
        {
            var party = sav.PartyData;
            for (int i = 0; i < party.Count; i++)
            {
                if (IsPresent(party[i]))
                    found.Add(new Slot(party[i], -1, null, i));
            }
        }
        if (sav.HasBox)
        {
            var names = sav as IBoxDetailNameRead;
            for (int box = 0; box < sav.BoxCount; box++)
            {
                string? name = null;
                var data = sav.GetBoxData(box);
                for (int i = 0; i < data.Length; i++)
                {
                    if (!IsPresent(data[i]))
                        continue;
                    name ??= BoxName(names, box);
                    found.Add(new Slot(data[i], box, name, i));
                }
            }
        }
        return found;
    }

    private static bool IsPresent(PKM pk) => pk.Species != 0 && pk.Species <= pk.MaxSpeciesID && pk.Valid;

    private static string BoxName(IBoxDetailNameRead? names, int box)
    {
        string? name = null;
        try { name = names?.GetBoxName(box); }
        catch (Exception) { /* A damaged name table: fall back to the default name. */ }
        return string.IsNullOrWhiteSpace(name) ? BoxDetailNameExtensions.GetDefaultBoxName(box) : name;
    }

    private static void WriteSave(Utf8JsonWriter w, SaveFile sav, List<Slot> found)
    {
        w.WriteStartObject("save");
        w.WriteString("type", sav.GetType().Name);
        Pokemon.WriteVersion(w, "version", sav.Version);
        w.WriteNumber("generation", sav.Generation);
        w.WriteString("trainer", sav.OT);
        w.WriteNumber("boxes", sav.HasBox ? sav.BoxCount : 0);
        w.WriteNumber("boxSlots", sav.HasBox ? sav.BoxSlotCount : 0);
        w.WriteNumber("party", found.Count(z => z.Box < 0));
        w.WriteNumber("boxed", found.Count(z => z.Box >= 0));
        w.WriteNumber("eggs", found.Count(z => z.Pk.IsEgg));
        w.WriteEndObject();
    }

    private static int Fail(string code, int exit)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer))
        {
            w.WriteStartObject();
            w.WriteBoolean("ok", false);
            w.WriteString("error", code);
            w.WriteEndObject();
        }
        Emit(buffer);
        return exit;
    }

    private static void Emit(MemoryStream buffer)
    {
        using var stdout = Console.OpenStandardOutput();
        stdout.Write(buffer.GetBuffer(), 0, (int)buffer.Length);
        stdout.Flush();
    }
}

/// <summary>One occupied slot. <see cref="Box"/> is -1 for the party.</summary>
public sealed record Slot(PKM Pk, int Box, string? BoxName, int Index);
