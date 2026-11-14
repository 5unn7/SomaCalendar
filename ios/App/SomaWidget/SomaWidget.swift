import WidgetKit
import SwiftUI
import UIKit

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
        .containerBackground(for: .widget) { Palette.ground }
    }
    .configurationDisplayName("Soma Panchang")
    .description("The day as a dial: Choghadiya now, Rahu Kaal and your next vrat.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
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
    // Every boundary, plus every 15 minutes so the dot on the dial keeps moving.
    let quarters = (1...96).map { now.addingTimeInterval(Double($0) * 900) }
    let dates = ([now] + feed.boundaries(from: now).map { $0.addingTimeInterval(1) } + quarters).sorted()
    let entries = dates.map { Entry(date: $0, snap: feed.snapshot(at: $0)) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

/// Kaal Chakra palette: bone by day, OLED black by night (spec from the redesign).
enum Palette {
  static func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
  }
  static let ground = dyn(0xF3EFE7, 0x050505)
  static let ink = dyn(0x151310, 0xF2EDE3)
  static let muted = dyn(0x6F695E, 0x9A948A)
  static let gold = dyn(0xA8741C, 0xE8B964)
  static let good = dyn(0x2F7D55, 0x7CC39A)
  static let ok = dyn(0xA88A3C, 0xC9B37C)
  static let bad = dyn(0xC2482E, 0xE2725B)
  static func quality(_ q: String) -> Color { q == "good" ? good : q == "bad" ? bad : ok }
}

extension UIColor {
  convenience init(hex: UInt32) {
    self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
  }
}

/// 24-hour dial: midnight at the bottom, noon at the top, clockwise. SwiftUI angle 0 is 3 o'clock, so midnight is 90°.
func dialDegrees(_ hours: Double) -> Double { 90 + hours / 24 * 360 }

struct ArcShape: Shape {
  let start: Angle, end: Angle
  func path(in rect: CGRect) -> Path {
    var p = Path()
    p.addArc(center: CGPoint(x: rect.midX, y: rect.midY), radius: min(rect.width, rect.height) / 2, startAngle: start, endAngle: end, clockwise: false)
    return p
  }
}

/// The Choghadiya ring with a gold dot at now. `labels` adds the tithi and current window in the centre.
struct Dial: View {
  let s: WidgetSnapshot
  var labels = true
  var accessory = false

  var body: some View {
    GeometryReader { g in
      let side = min(g.size.width, g.size.height)
      let stroke = side * (accessory ? 0.11 : 0.075)
      let r = side / 2 - stroke / 2 - 2
      let c = CGPoint(x: g.size.width / 2, y: g.size.height / 2)
      ZStack {
        Circle().stroke(Palette.muted.opacity(0.3), lineWidth: 1).frame(width: r * 2, height: r * 2)
        ForEach(Array(s.arcs.enumerated()), id: \.offset) { _, a in
          let sweep = a.hours * 15 - 1.2
          if sweep > 0 {
            ArcShape(start: .degrees(dialDegrees(a.startHours) + 0.6), end: .degrees(dialDegrees(a.startHours) + 0.6 + sweep))
              .stroke(accessory ? Color.primary.opacity(a.day ? 1 : 0.35) : Palette.quality(a.quality).opacity(a.day ? 1 : 0.3), lineWidth: stroke)
              .frame(width: r * 2, height: r * 2)
          }
        }
        let t = dialDegrees(s.nowHours) * .pi / 180
        let dot = CGPoint(x: c.x + cos(t) * r, y: c.y + sin(t) * r)
        Path { p in
          p.move(to: CGPoint(x: c.x + cos(t) * r * 0.62, y: c.y + sin(t) * r * 0.62))
          p.addLine(to: dot)
        }
        .stroke(accessory ? Color.primary : Palette.gold, lineWidth: 1.2)
        Circle().fill(accessory ? Color.clear : Palette.ground).frame(width: stroke * 1.7, height: stroke * 1.7).position(dot)
        Circle().fill(accessory ? Color.primary : Palette.gold).frame(width: stroke * 1.25, height: stroke * 1.25).position(dot)
        if labels {
          VStack(spacing: 2) {
            Text(s.tithiName).font(.system(size: r * 0.30, design: .serif)).foregroundStyle(Palette.ink)
              .lineLimit(1).minimumScaleFactor(0.6)
            Text(s.caption).font(.system(size: r * 0.12, weight: .semibold)).tracking(r * 0.12 * 0.14)
              .foregroundStyle(s.inRahu ? Palette.bad : Palette.quality(s.chogQuality)).lineLimit(1).minimumScaleFactor(0.6)
          }
          .frame(width: r * 1.3)
          .position(c)
        }
      }
      .frame(width: g.size.width, height: g.size.height)
    }
  }
}

/// Moon disc lit by tithi: waxing lights the right side, waning the left; the terminator is a half-ellipse.
struct MoonShape: Shape {
  let tithiIndex: Int
  func path(in rect: CGRect) -> Path {
    let r = min(rect.width, rect.height) / 2, cx = rect.midX, cy = rect.midY
    guard tithiIndex >= 0 else { return Path() }
    let waxing = tithiIndex < 15
    let theta = (Double(tithiIndex) + 0.5) * 12 * .pi / 180
    let k = waxing ? cos(theta) : cos(2 * .pi - theta)
    let side: Double = waxing ? 1 : -1, n = 48
    var p = Path()
    for i in 0...n {
      let y = -r + 2 * r * Double(i) / Double(n), w = (max(0, r * r - y * y)).squareRoot()
      let pt = CGPoint(x: cx + side * w, y: cy + y)
      if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
    }
    for i in stride(from: n, through: 0, by: -1) {
      let y = -r + 2 * r * Double(i) / Double(n), w = (max(0, r * r - y * y)).squareRoot()
      p.addLine(to: CGPoint(x: cx + side * k * w, y: cy + y))
    }
    p.closeSubpath()
    return p
  }
}

struct SomaWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: Entry

  var body: some View {
    if let s = entry.snap {
      switch family {
      case .accessoryInline: Text("\(s.tithiName) · \(s.nowLine)")
      case .accessoryCircular: Dial(s: s, labels: false, accessory: true).widgetAccentable()
      case .accessoryRectangular: rectangular(s)
      case .systemSmall: Dial(s: s)
      default: medium(s)
      }
    } else {
      empty
    }
  }

  private var empty: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Soma").font(.system(.title3, design: .serif)).foregroundStyle(Palette.ink)
      Text("Open Soma to set your city.").font(.caption).foregroundStyle(Palette.muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  private func rectangular(_ s: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(s.tithiName).font(.system(.headline, design: .serif)).widgetAccentable().lineLimit(1)
      Text(s.nowLine).font(.caption).lineLimit(1)
      Text(s.thenLine).font(.caption2).lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// Moon, NOW, "Shubh until 9:47", what comes next, the next vrat.
  private func medium(_ s: WidgetSnapshot) -> some View {
    HStack(spacing: 16) {
      ZStack {
        Circle().fill(Palette.muted.opacity(0.28))
        MoonShape(tithiIndex: s.tithiIndex).fill(Palette.ink)
      }
      .frame(width: 56, height: 56)
      VStack(alignment: .leading, spacing: 3) {
        Text("NOW").font(.system(size: 10, weight: .semibold)).tracking(1.4).foregroundStyle(Palette.muted)
        Text(s.nowLine).font(.system(size: 23, design: .serif)).foregroundStyle(s.inRahu ? Palette.bad : Palette.ink)
          .lineLimit(1).minimumScaleFactor(0.7)
        Text(s.thenLine).font(.caption).foregroundStyle(Palette.muted).lineLimit(1)
        if let v = s.vrats.first {
          Text("\(s.dayLabel(v.date)) · \(v.english.isEmpty ? v.name : v.english)")
            .font(.caption2).foregroundStyle(Palette.gold).lineLimit(1).padding(.top, 4)
        }
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}
