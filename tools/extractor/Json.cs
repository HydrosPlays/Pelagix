using System.Collections;
using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Pelagix.Extractor;

/// <summary>Thrown by the guard rails; Program turns it into a non-zero exit code with a readable message.</summary>
public sealed class ExtractorException(string message) : Exception(message);

public static class Guard
{
    public static void Require(bool condition, string message)
    {
        if (!condition)
            throw new ExtractorException(message);
    }

    public static ExtractorException Fail(string message) => new(message);
}

/// <summary>JSON object that keeps the order its members were added in, so output is byte-stable between runs.</summary>
public sealed class Obj : IEnumerable<KeyValuePair<string, object?>>
{
    private readonly List<KeyValuePair<string, object?>> _members = [];
    private readonly HashSet<string> _keys = new(StringComparer.Ordinal);

    public int Count => _members.Count;

    public object? this[string key]
    {
        set => Add(key, value);
    }

    public Obj Add(string key, object? value)
    {
        if (!_keys.Add(key))
            throw new InvalidOperationException($"Duplicate JSON key '{key}'.");
        _members.Add(new(key, value));
        return this;
    }

    public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => _members.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>
/// Minimal JSON writer: no insignificant whitespace except a line break between the members of objects and the
/// records of record arrays shallower than <c>breakDepth</c>. That keeps the files minified while letting
/// line-based diffs show exactly which rows changed between two extractions.
/// </summary>
public static class Json
{
    private static readonly JavaScriptEncoder Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    private static readonly UTF8Encoding Utf8NoBom = new(false);

    public static string Serialize(object? value, int breakDepth = 0)
    {
        var sb = new StringBuilder(256);
        Write(sb, value, 0, breakDepth);
        return sb.ToString();
    }

    /// <summary>Writes <paramref name="value"/> to <paramref name="path"/> (UTF-8, no BOM, trailing newline) and returns the byte count.</summary>
    public static long WriteFile(string path, object? value, int breakDepth)
    {
        var sb = new StringBuilder(1 << 20);
        Write(sb, value, 0, breakDepth);
        sb.Append('\n');
        var bytes = Utf8NoBom.GetBytes(sb.ToString());
        File.WriteAllBytes(path, bytes);
        return bytes.LongLength;
    }

    private static void Write(StringBuilder sb, object? value, int depth, int breakDepth)
    {
        switch (value)
        {
            case null: sb.Append("null"); return;
            case string s: WriteString(sb, s); return;
            case bool b: sb.Append(b ? "true" : "false"); return;
            case byte or sbyte or short or ushort or int or uint or long or ulong:
                sb.Append(((IFormattable)value).ToString(null, CultureInfo.InvariantCulture));
                return;
            case Obj o:
                WriteObject(sb, o, depth, breakDepth);
                return;
            case Enum:
                throw new InvalidOperationException($"Enum value {value.GetType().Name}.{value} must be converted to a name or number before serialization.");
            case IEnumerable seq:
                WriteArray(sb, seq, depth, breakDepth);
                return;
            default:
                throw new InvalidOperationException($"Unsupported JSON value type {value.GetType().FullName}.");
        }
    }

    private static void WriteObject(StringBuilder sb, Obj o, int depth, int breakDepth)
    {
        if (o.Count == 0)
        {
            sb.Append("{}");
            return;
        }
        bool wrap = depth < breakDepth;
        sb.Append('{');
        if (wrap) sb.Append('\n');
        bool first = true;
        foreach (var (key, member) in o)
        {
            if (!first)
            {
                sb.Append(',');
                if (wrap) sb.Append('\n');
            }
            first = false;
            WriteString(sb, key);
            sb.Append(':');
            Write(sb, member, depth + 1, breakDepth);
        }
        if (wrap) sb.Append('\n');
        sb.Append('}');
    }

    private static void WriteArray(StringBuilder sb, IEnumerable seq, int depth, int breakDepth)
    {
        sb.Append('[');
        bool first = true, wrap = false;
        foreach (var item in seq)
        {
            // Only arrays of records get one element per line; arrays of scalars (ids, names) stay inline.
            if (first)
                wrap = depth < breakDepth && item is Obj or (IEnumerable and not string);
            else
                sb.Append(',');
            if (wrap) sb.Append('\n');
            first = false;
            Write(sb, item, depth + 1, breakDepth);
        }
        if (wrap) sb.Append('\n');
        sb.Append(']');
    }

    private static void WriteString(StringBuilder sb, string s)
    {
        sb.Append('"');
        sb.Append(JsonEncodedText.Encode(s, Encoder).Value);
        sb.Append('"');
    }
}
