import Foundation

/// The week of Panchang intervals built by src/redesign/widget.js (`SomaWidgetFeed.build`). Times are epoch milliseconds.
/// Shared by the widget extension and the unit tests; the app only stores the JSON string in the App Group.
struct WidgetFeed: Decodable {
  struct Day: Decodable {
    let date: String
    let vaar: String
    let rise: Double
    let set: Double
    let next: Double
    let rahu: [Double]
    let yama: [Double]?
    let gulika: [Double]?
    let abhijit: [Double]?
  }
  struct Chog: Decodable { let s: Double; let e: Double; let n: String; let en: String; let q: String; let day: Int }
  struct Tithi: Decodable { let s: Double; let e: Double; let n: String; let m: String?; let p: String? }
  struct Nak: Decodable { let s: Double; let e: Double; let n: String }
  struct Vrat: Decodable { let date: String; let n: String; let en: String?; let d: String? }

  let v: Int
  let city: String
  let zone: String
  let gen: Double
  let days: [Day]
  let chog: [Chog]
  let tithi: [Tithi]
  let nak: [Nak]
  let vrat: [Vrat]

  static func decode(_ json: String?) -> WidgetFeed? {
    guard let data = json?.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetFeed.self, from: data)
  }

  var timeZone: TimeZone { TimeZone(identifier: zone) ?? .current }
  /// The last instant the feed can describe.
  var coveredUntil: Date { Date(timeIntervalSince1970: (chog.map(\.e).max() ?? gen) / 1000) }

  /// What holds at `date`. Nil when the feed no longer covers it (the app has not been opened for a week).
  func snapshot(at date: Date) -> WidgetSnapshot? {
    let t = date.timeIntervalSince1970 * 1000
    guard let c = chog.first(where: { $0.s <= t && t < $0.e }) else { return nil }
    let ti = tithi.first(where: { $0.s <= t && t < $0.e })
    let nk = nak.first(where: { $0.s <= t && t < $0.e })
    // The Vedic day runs sunrise to sunrise.
    let vd = days.first(where: { $0.rise <= t && t < $0.next })
    let rahu = vd.flatMap { $0.rahu.count == 2 ? $0.rahu : nil }
    let today = Self.dayKey(date, timeZone)
    let upcoming = vrat.filter { $0.date >= today }
    let later = chog.filter { $0.s >= c.e }.prefix(8)
    return WidgetSnapshot(
      date: date, zone: timeZone, city: city,
      vaar: vd?.vaar ?? "",
      tithi: ti?.n ?? "", tithiEnds: ti.map { Self.date($0.e) }, month: ti?.m ?? "", paksha: ti?.p ?? "",
      nakshatra: nk?.n ?? "", nakshatraEnds: nk.map { Self.date($0.e) },
      chog: c.n, chogEnglish: c.en, chogQuality: c.q, chogStart: Self.date(c.s), chogEnds: Self.date(c.e),
      rahuStart: rahu.map { Self.date($0[0]) }, rahuEnd: rahu.map { Self.date($0[1]) },
      sunrise: vd.map { Self.date($0.rise) }, sunset: vd.map { Self.date($0.set) },
      nextGood: chog.first(where: { $0.s >= c.e && $0.q == "good" }).map { (name: $0.n, start: Self.date($0.s), end: Self.date($0.e)) },
      laterChog: later.map { (name: $0.n, quality: $0.q, start: Self.date($0.s), end: Self.date($0.e)) },
      vrats: upcoming.prefix(4).map { (date: $0.date, name: $0.n, english: $0.en ?? "", note: $0.d ?? "") },
      arcs: ringArcs(around: date),
      nowHours: Self.localHours(date, timeZone),
      tithiIndex: WidgetSnapshot.tithiIndex(ti?.n),
      nextChog: chog.first(where: { $0.s >= c.e }).map { (name: $0.en, end: Self.date($0.e)) }
    )
  }

  /// Every Choghadiya inside the 24 hours centred on `date`, clipped, so arcs on the dial never overlap.
  func ringArcs(around date: Date) -> [WidgetSnapshot.Arc] {
    let t = date.timeIntervalSince1970 * 1000, lo = t - 12 * 3_600_000, hi = t + 12 * 3_600_000
    return chog.compactMap { c in
      let s = max(lo, c.s), e = min(hi, c.e)
      guard e > s else { return nil }
      return WidgetSnapshot.Arc(startHours: Self.localHours(Self.date(s), timeZone), hours: (e - s) / 3_600_000, quality: c.q, day: c.day == 1)
    }
  }

  static func localHours(_ date: Date, _ zone: TimeZone) -> Double {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = zone
    let p = cal.dateComponents([.hour, .minute, .second], from: date)
    return Double(p.hour ?? 0) + Double(p.minute ?? 0) / 60 + Double(p.second ?? 0) / 3600
  }

  /// Moments within `hours` after `from` at which something the widget shows changes.
  func boundaries(from: Date, hours: Double = 24, limit: Int = 90) -> [Date] {
    let lo = from.timeIntervalSince1970 * 1000, hi = lo + hours * 3_600_000
    var ms = Set<Double>()
    chog.forEach { ms.insert($0.s); ms.insert($0.e) }
    tithi.forEach { ms.insert($0.e) }
    nak.forEach { ms.insert($0.e) }
    days.forEach { d in d.rahu.forEach { ms.insert($0) }; ms.insert(d.rise) }
    // Local midnights, so the date line rolls over.
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = timeZone
    var m = cal.startOfDay(for: from)
    for _ in 0..<3 { m = cal.date(byAdding: .day, value: 1, to: m)!; ms.insert(m.timeIntervalSince1970 * 1000) }
    return ms.filter { $0 > lo && $0 <= hi }.sorted().prefix(limit).map(Self.date)
  }

  static func date(_ ms: Double) -> Date { Date(timeIntervalSince1970: ms / 1000) }
  static func dayKey(_ date: Date, _ zone: TimeZone) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = zone
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }
}

struct WidgetSnapshot {
  let date: Date
  let zone: TimeZone
  let city: String
  let vaar: String
  let tithi: String
  let tithiEnds: Date?
  let month: String
  let paksha: String
  let nakshatra: String
  let nakshatraEnds: Date?
  let chog: String
  let chogEnglish: String
  let chogQuality: String
  let chogStart: Date
  let chogEnds: Date
  let rahuStart: Date?
  let rahuEnd: Date?
  let sunrise: Date?
  let sunset: Date?
  let nextGood: (name: String, start: Date, end: Date)?
  let laterChog: [(name: String, quality: String, start: Date, end: Date)]
  let vrats: [(date: String, name: String, english: String, note: String)]
  let arcs: [Arc]
  /// Local clock hours of `date`, for the dot on the dial.
  let nowHours: Double
  /// 0–14 Shukla, 15–29 Krishna (29 = Amavasya); -1 if unknown.
  let tithiIndex: Int
  let nextChog: (name: String, end: Date)?

  struct Arc { let startHours: Double; let hours: Double; let quality: String; let day: Bool }

  static let tithiGu = ["પડવો", "બીજ", "ત્રીજ", "ચોથ", "પાંચમ", "છઠ", "સાતમ", "આઠમ", "નોમ", "દશમ", "અગિયારસ", "બારસ", "તેરસ", "ચૌદશ", "પૂનમ"]
  static let tithiEn = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"]

  /// "સુદ પાંચમ" → 4, "વદ પાંચમ" → 19, "વદ અમાસ" → 29.
  static func tithiIndex(_ label: String?) -> Int {
    guard let label else { return -1 }
    if label.contains("અમાસ") { return 29 }
    let vad = label.hasPrefix("વદ")
    guard let i = tithiGu.firstIndex(where: { label.hasSuffix($0) }) else { return -1 }
    return (vad ? 15 : 0) + i
  }
  var tithiName: String { tithiIndex < 0 ? tithi : tithiIndex == 29 ? "Amavasya" : Self.tithiEn[tithiIndex % 15] }

  /// Small dial caption, e.g. "SHUBH · 9:47".
  var caption: String { inRahu ? "RAHU · \(clock(rahuEnd))" : "\(chogEnglish.uppercased()) · \(clock(chogEnds))" }
  /// Medium widget: "Shubh until 9:47".
  var nowLine: String { inRahu ? "Rahu Kaal until \(clock(rahuEnd))" : "\(chogEnglish) until \(clock(chogEnds))" }
  /// What comes next: Rahu Kaal if it starts within three hours of this window ending, else the next window.
  var thenLine: String {
    if inRahu { return "Hold new starts" }
    if let rs = rahuStart, let re = rahuEnd, rs > date, rs.timeIntervalSince(chogEnds) < 3 * 3600 {
      return "Then Rahu Kaal \(clock(rs)) – \(clock(re))"
    }
    return nextChog.map { "Then \($0.name) until \(clock($0.end))" } ?? ""
  }

  func clock(_ d: Date?) -> String {
    guard let d else { return "—" }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = zone
    f.dateFormat = "h:mm"
    return f.string(from: d)
  }

  var inRahu: Bool {
    guard let s = rahuStart, let e = rahuEnd else { return false }
    return s <= date && date < e
  }
  var chogProgress: Double {
    let total = chogEnds.timeIntervalSince(chogStart)
    return total > 0 ? min(1, max(0, date.timeIntervalSince(chogStart) / total)) : 0
  }

  func time(_ d: Date?) -> String {
    guard let d else { return "—" }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_IN")
    f.timeZone = zone
    f.dateFormat = "h:mm a"
    return f.string(from: d)
  }

  /// One line: what to do right now.
  var verdict: String {
    if inRahu { return "Rahu Kaal till \(time(rahuEnd))" }
    switch chogQuality {
    case "good": return "Shubh time till \(time(chogEnds))"
    case "bad": return nextGood.map { "Wait for \($0.name) at \(time($0.start))" } ?? "Avoid new starts"
    default: return "Neutral till \(time(chogEnds))"
    }
  }

  func dayLabel(_ key: String) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = zone
    f.dateFormat = "yyyy-MM-dd"
    guard let d = f.date(from: key) else { return key }
    if key == WidgetFeed.dayKey(date, zone) { return "Today" }
    let out = DateFormatter()
    out.locale = Locale(identifier: "en_IN")
    out.timeZone = zone
    out.dateFormat = "EEE d MMM"
    return out.string(from: d)
  }

  var dateLine: String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_IN")
    f.timeZone = zone
    f.dateFormat = "EEE d MMM"
    return f.string(from: date)
  }
}
