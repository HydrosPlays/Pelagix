using PKHeX.Core;

namespace Pelagix.Extractor;

/// <summary>
/// balls.json: per game, the balls an ordinary wild capture may end up in (PKHeX's legality set, not a shop list),
/// the balls individual templates force, and the balls its mystery gifts arrive in.
/// </summary>
public static class Balls
{
    public static Obj Build(EncounterDump encounters, GoDump go, GiftDump gifts)
    {
        // BallUseLegality is an internal static class; GetWildBalls(byte generation, GameVersion version) returns a bit mask (bit i = Ball i).
        var legality = typeof(PKM).Assembly.GetType("PKHeX.Core.BallUseLegality")
                       ?? throw Guard.Fail("PKHeX.Core.BallUseLegality no longer exists; balls.json reads the wild ball sets from it.");

        var fixedBalls = Games.Order.Select(_ => new SortedSet<int>()).ToArray();
        foreach (var row in encounters.Resolved)
        {
            if (row.Ball == 0)
                continue;
            foreach (var g in row.Games)
                fixedBalls[g].Add(row.Ball);
        }
        foreach (var ball in go.FixedBalls)
            fixedBalls[Games.Index("GO")].Add(ball);

        var root = new Obj();
        for (int g = 0; g < Games.Order.Length; g++)
        {
            var code = Games.Order[g];
            var version = Games.Saved(code);
            // GO has no generation of its own; PKHeX files its HOME-bound captures under generation 8.
            byte generation = code == "GO" ? (byte)8 : version.Generation;
            var mask = Reflect.InvokeStatic<ulong>(legality, "GetWildBalls", generation, version);
            Guard.Require(mask != 0, $"{code}: PKHeX returned an empty wild ball set.");
            var wild = new List<int>();
            for (int ball = 0; ball < 64; ball++)
            {
                if ((mask & (1ul << ball)) == 0)
                    continue;
                Guard.Require(Enum.IsDefined((Ball)ball) && ball != 0, $"{code}: wild ball mask has bit {ball}, which is not a Ball.");
                wild.Add(ball);
            }
            root.Add(code, new Obj
            {
                ["wild"] = wild,
                ["fixed"] = fixedBalls[g],
                ["gift"] = gifts.BallsByGame.TryGetValue(code, out var set) ? set : (IEnumerable<int>)[],
            });
        }
        return root;
    }
}
