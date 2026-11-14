import WidgetKit
import SwiftUI

/// Home Screen and Lock Screen widget. Reads the week of Panchang the app shares through the App Group,
/// and lays out a timeline entry at every Choghadiya, tithi, nakshatra and Rahu Kaal boundary,
/// so it stays current with no app running. Fully offline.
@main
struct SomaWidgetBundle: WidgetBundle {
  var body: some Widget { SomaTodayWidget() }
}

struct SomaTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SomaToday", provider: Provider()) { entry in
      SomaWidgetView(entry: entry)
        .containerBackground(for: .widget) { Palette.background }
    }
    .configurationDisplayName("Soma Panchang")
    .description("Tithi, Choghadiya, Rahu Kaal and your next vrat, for your city.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular])
  }
}

struct Entry: TimelineEntry {
  let date: Date
  let snap: WidgetSnapshot?
}

struct Provider: TimelineProvider {
  private var feed: WidgetFeed? {
    let group = Bundle.main.object(forInfoDictionaryKey: "SomaAppGroup") as? String ?? "group.app.soma.calendar"
    return WidgetFeed.decode(UserDefaults(suiteName: group)?.string(forKey: "feed"))
  }

  func placeholder(in context: Context) -> Entry { Entry(date: Date(), snap: nil) }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    let now = Date()
    completion(Entry(date: now, snap: feed?.snapshot(at: now)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let now = Date()
    guard let feed, feed.snapshot(at: now) != nil else {
      // No feed yet, or a week without opening Soma: ask again in an hour.
      return completion(Timeline(entries: [Entry(date: now, snap: nil)], policy: .after(now.addingTimeInterval(3600))))
    }
    let dates = [now] + feed.boundaries(from: now).map { $0.addingTimeInterval(1) }
    let entries = dates.map { Entry(date: $0, snap: feed.snapshot(at: $0)) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

enum Palette {
  static let background = Color(red: 0x10 / 255, green: 0x1c / 255, blue: 0x1a / 255)
  static let panel = Color(red: 0x19 / 255, green: 0x28 / 255, blue: 0x25 / 255)
  static let ink = Color(red: 0xf3 / 255, green: 0xf0 / 255, blue: 0xe5 / 255)
  static let muted = Color(red: 0x9f / 255, green: 0xae / 255, blue: 0xa5 / 255)
  static let gold = Color(red: 0xdf / 255, green: 0xc4 / 255, blue: 0x93 / 255)
  static let good = Color(red: 0xb8 / 255, green: 0xd6 / 255, blue: 0xb4 / 255)
  static let bad = Color(red: 0xe8 / 255, green: 0xa0 / 255, blue: 0x91 / 255)
  static func quality(_ q: String) -> Color { q == "good" ? good : q == "bad" ? bad : gold }
}

struct SomaWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: Entry

  var body: some View {
    if let s = entry.snap {
      switch family {
      case .accessoryInline: Text("\(s.tithi) · \(s.chog)")
      case .accessoryCircular: circular(s)
      case .accessoryRectangular: rectangular(s)
      case .systemSmall: small(s)
      case .systemLarge: large(s)
      default: medium(s)
      }
    } else {
      empty
    }
  }

  private var empty: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("સોમ · Soma").font(.headline).foregroundStyle(Palette.gold)
      Text("Open Soma to set your city.").font(.caption).foregroundStyle(Palette.muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  // MARK: Lock Screen

  private func circular(_ s: WidgetSnapshot) -> some View {
    Gauge(value: s.chogProgress) { Text("") } currentValueLabel: {
      Text(String(s.chogEnglish.prefix(4))).font(.system(size: 11, weight: .semibold))
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .widgetAccentable()
  }

  private func rectangular(_ s: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(s.tithi).font(.headline).widgetAccentable().lineLimit(1)
      Text("\(s.chog) till \(s.time(s.chogEnds))").font(.caption).lineLimit(1)
      Text(s.inRahu ? "Rahu Kaal till \(s.time(s.rahuEnd))" : s.nakshatra).font(.caption2).lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: Home Screen

  private func small(_ s: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(s.vaar).font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
      Text(s.tithi).font(.title3.weight(.medium)).foregroundStyle(Palette.ink).lineLimit(2).minimumScaleFactor(0.7)
      Spacer(minLength: 4)
      chogLine(s)
      Text(s.verdict).font(.caption2).foregroundStyle(s.inRahu ? Palette.bad : Palette.muted).lineLimit(2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  private func medium(_ s: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      header(s)
      HStack(alignment: .top, spacing: 14) {
        VStack(alignment: .leading, spacing: 2) {
          Text(s.tithi).font(.title3.weight(.medium)).foregroundStyle(Palette.ink).lineLimit(1).minimumScaleFactor(0.7)
          Text([s.paksha, s.month].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
          Text(s.nakshatra).font(.caption).foregroundStyle(Palette.ink.opacity(0.85)).lineLimit(1)
        }
        Spacer(minLength: 0)
        VStack(alignment: .leading, spacing: 3) {
          chogLine(s)
          ProgressView(value: s.chogProgress).tint(Palette.quality(s.chogQuality))
          rahuLine(s)
        }
        .frame(maxWidth: 150)
      }
      Spacer(minLength: 0)
      if let v = s.vrats.first { vratLine(s, v) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func large(_ s: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      header(s)
      Text(s.tithi).font(.title2.weight(.medium)).foregroundStyle(Palette.ink).lineLimit(1)
      Text([s.paksha, s.month, s.nakshatra].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(Palette.muted).lineLimit(1)
      chogLine(s)
      ProgressView(value: s.chogProgress).tint(Palette.quality(s.chogQuality))
      rahuLine(s)
      Text("Sunrise \(s.time(s.sunrise)) · Sunset \(s.time(s.sunset))").font(.caption2).foregroundStyle(Palette.muted)
      Divider().overlay(Palette.panel)
      ForEach(Array(s.laterChog.prefix(4).enumerated()), id: \.offset) { _, c in
        HStack {
          Circle().fill(Palette.quality(c.quality)).frame(width: 6, height: 6)
          Text(c.name).font(.caption).foregroundStyle(Palette.ink)
          Spacer()
          Text("\(s.time(c.start)) – \(s.time(c.end))").font(.caption2).foregroundStyle(Palette.muted)
        }
      }
      Divider().overlay(Palette.panel)
      ForEach(Array(s.vrats.prefix(3).enumerated()), id: \.offset) { _, v in vratLine(s, v) }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // MARK: Pieces

  private func header(_ s: WidgetSnapshot) -> some View {
    HStack {
      Text(s.city.isEmpty ? "Soma" : s.city).font(.caption2.weight(.semibold)).foregroundStyle(Palette.gold).lineLimit(1)
      Spacer()
      Text("\(s.vaar) · \(s.dateLine)").font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
    }
  }

  private func chogLine(_ s: WidgetSnapshot) -> some View {
    HStack(spacing: 5) {
      Circle().fill(Palette.quality(s.chogQuality)).frame(width: 7, height: 7)
      Text(s.chog).font(.subheadline.weight(.medium)).foregroundStyle(Palette.quality(s.chogQuality)).lineLimit(1)
      Text("till \(s.time(s.chogEnds))").font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
    }
  }

  private func rahuLine(_ s: WidgetSnapshot) -> some View {
    Text("Rahu \(s.time(s.rahuStart)) – \(s.time(s.rahuEnd))")
      .font(.caption2).foregroundStyle(s.inRahu ? Palette.bad : Palette.muted).lineLimit(1)
  }

  private func vratLine(_ s: WidgetSnapshot, _ v: (date: String, name: String, english: String, note: String)) -> some View {
    HStack(spacing: 6) {
      Text(s.dayLabel(v.date)).font(.caption2.weight(.semibold)).foregroundStyle(Palette.gold)
      Text(v.name).font(.caption).foregroundStyle(Palette.ink).lineLimit(1)
      Spacer(minLength: 0)
    }
  }
}
