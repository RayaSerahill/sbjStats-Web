using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using ECommons.EzIpcManager;
using ECommons.Logging;
using Newtonsoft.Json;
using Splatoon.SplatoonScripting;
using Dalamud.Bindings.ImGui;
using ECommons.Configuration;

namespace sbjStats;

public class SimpleBlackjackUploadScript : SplatoonScript
{
    public override Metadata Metadata { get; } = new(1, "Raya Serahill");

    public override HashSet<uint>? ValidTerritories { get; } = [];

    [EzIPCEvent("OnGameFinishedEx", false)]
    public Action<StatsRecording> OnGameFinishedEx;

    private Config C = new();

    public override void OnSetup()
    {
        EzIPC.Init(this, "SimpleBlackjack");
        OnGameFinishedEx += HandleGameFinishedEx;
    }

    public override void OnDisable()
    {
        OnGameFinishedEx -= HandleGameFinishedEx;
    }

    public override void OnSettingsDraw()
    {
        ImGui.InputText("Endpoint", ref C.Endpoint, 512);
        ImGui.InputText("API Key", ref C.ApiKey, 512);

        ImGui.Checkbox("Enable Upload", ref C.EnableUpload);

        if (ImGui.CollapsingHeader("Debug"))
        {
            ImGui.Text($"Endpoint set: {!string.IsNullOrWhiteSpace(C.Endpoint)}");
            ImGui.Text($"API key set: {!string.IsNullOrWhiteSpace(C.ApiKey)}");
        }
    }

    private void HandleGameFinishedEx(StatsRecording stat)
    {
        try
        {
            if (!C.EnableUpload)
            {
                PluginLog.Information("SBJ upload skipped: upload disabled.");
                return;
            }

            SendStatAsCsv(stat, C.Endpoint, C.ApiKey);
            PluginLog.Information("SBJ stat uploaded.");
        }
        catch (Exception ex)
        {
            PluginLog.Error($"SBJ upload failed: {ex.Message}");
        }
    }

    public static void SendStatAsCsv(
        StatsRecording stat,
        string endpoint,
        string apiKey)
    {
        var csv = BuildCsv(stat);
        UploadCsv(csv, endpoint, apiKey);
    }

    public static void SendMassStatsAsCsv(
        IEnumerable<StatsRecording> stats,
        string endpoint,
        string apiKey)
    {
        var csv = BuildCsv(stats);
        UploadCsv(csv, endpoint, apiKey);
    }

    public static string BuildCsv(StatsRecording stat)
    {
        return BuildCsv(new[] { stat });
    }

    public static string BuildCsv(IEnumerable<StatsRecording> stats)
    {
        var sb = new StringBuilder();
        sb.AppendLine("sep=;");
        sb.AppendLine("Date and time;Players;Collected;Paid out;Profit;Details");

        foreach (var stat in stats.OrderBy(s => s.Time))
        {
            sb.AppendLine(BuildCsvRow(stat));
        }

        return sb.ToString();
    }

    private static string BuildCsvRow(StatsRecording stat)
    {
        var dateTime = DateTimeOffset
            .FromUnixTimeMilliseconds(stat.Time)
            .ToString("dd/MM/yyyy HH.mm.ss zzz", CultureInfo.InvariantCulture);

        var players = string.Join(", ", stat.Players ?? []);
        var collected = FormatNumber(stat.BetsCollected);
        var paidOut = FormatNumber(stat.Payouts);
        var profit = FormatNumber(stat.BetsCollected - stat.Payouts);

        var handsJson = JsonConvert.SerializeObject(stat.Hands ?? []);
        var details = Convert.ToBase64String(Encoding.UTF8.GetBytes(handsJson));

        return string.Join(";",
            EscapeCsv(dateTime),
            EscapeCsv(players),
            EscapeCsv(collected),
            EscapeCsv(paidOut),
            EscapeCsv(profit),
            EscapeCsv(details)
        );
    }

    private static string FormatNumber(long value)
    {
        return value.ToString("N0", CultureInfo.GetCultureInfo("fi-FI"));
    }

    private static string EscapeCsv(string value)
    {
        value ??= string.Empty;

        var mustQuote = value.Contains(';') || value.Contains('"') || value.Contains('\n') || value.Contains('\r');
        if (!mustQuote) return value;

        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    private static void UploadCsv(
        string csv,
        string endpoint,
        string apiKey)
    {
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            throw new Exception("Upload endpoint is missing.");
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new Exception("API key is missing.");
        }

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);

        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        form.Add(fileContent, "file", "sbj-stats.csv");

        var response = client.PostAsync(endpoint, form).GetAwaiter().GetResult();
        var responseText = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Upload failed: {(int)response.StatusCode} {response.ReasonPhrase} | {responseText}");
        }
    }

    public class Config
    {
        public string Endpoint = "https://serahill.net/api/admin/games/import ";
        public string ApiKey = "";
        public bool EnableUpload = true;
    }
}

public class StatsRecording
{
    public long Time;
    public int BetsCollected;
    public int Payouts;
    public List<string> Players = [];
    public bool Saved = false;
    public string ArchiveID = Guid.Empty.ToString();
    public List<HandStat> Hands = [];
}

public class HandStat
{
    public string PlayerName;
    public List<Card> Cards;
    public int SplitNum = 0;
    public int Bet = 0;
    public int Payout = 0;
    public bool IsDoubleDown = false;
    public Result Result;
    public bool Dealer = false;
}

public enum Result : int
{
    Bust = 0,
    Win = 1,
    Draw = 2,
    Loss = 3,
    Waiting = 4,
    Blackjack = 5,
    Surrender = 6
}

public enum Card : int
{
    Number_2 = 2,
    Number_3 = 3,
    Number_4 = 4,
    Number_5 = 5,
    Number_6 = 6,
    Number_7 = 7,
    Number_8 = 8,
    Number_9 = 9,
    Ace = 1,
    Jack = 11,
    Queen = 12,
    King = 13,
    Number_10 = 10
}