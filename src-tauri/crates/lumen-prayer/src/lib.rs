use adhan::{Madhab as AdhanMadhab, Method as AdhanMethod, Parameters, prayer_times};
use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, Utc, Weekday};
use serde::{Deserialize, Serialize};

/// Supported calculation methods (Bangladesh defaults to Karachi per SRS Section 5.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CalculationMethod {
    Karachi,
    MuslimWorldLeague,
    Egyptian,
    UmmAlQura,
    NorthAmerica,
}

impl From<CalculationMethod> for AdhanMethod {
    fn from(value: CalculationMethod) -> Self {
        match value {
            CalculationMethod::Karachi => Self::Karachi,
            CalculationMethod::MuslimWorldLeague => Self::MuslimWorldLeague,
            CalculationMethod::Egyptian => Self::Egyptian,
            CalculationMethod::UmmAlQura => Self::UmmAlQura,
            CalculationMethod::NorthAmerica => Self::NorthAmerica,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Madhab {
    Hanafi,
    Shafi,
}

impl From<Madhab> for AdhanMadhab {
    fn from(value: Madhab) -> Self {
        match value {
            Madhab::Hanafi => Self::Hanafi,
            Madhab::Shafi => Self::Shafi,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrayerCityPreset {
    pub id: &'static str,
    pub name_en: &'static str,
    pub name_bn: &'static str,
    pub latitude: f64,
    pub longitude: f64,
    pub tz_offset_minutes: i32,
}

pub const BANGLADESH_CITIES: &[PrayerCityPreset] = &[
    PrayerCityPreset {
        id: "dhaka",
        name_en: "Dhaka",
        name_bn: "ঢাকা",
        latitude: 23.8103,
        longitude: 90.4125,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "khulna",
        name_en: "Khulna",
        name_bn: "খুলনা",
        latitude: 22.8456,
        longitude: 89.5403,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "chattogram",
        name_en: "Chattogram",
        name_bn: "চট্টগ্রাম",
        latitude: 22.3569,
        longitude: 91.7832,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "rajshahi",
        name_en: "Rajshahi",
        name_bn: "রাজশাহী",
        latitude: 24.3745,
        longitude: 88.6042,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "sylhet",
        name_en: "Sylhet",
        name_bn: "সিলেট",
        latitude: 24.8949,
        longitude: 91.8687,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "barishal",
        name_en: "Barishal",
        name_bn: "বরিশাল",
        latitude: 22.7010,
        longitude: 90.3535,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "rangpur",
        name_en: "Rangpur",
        name_bn: "রংপুর",
        latitude: 25.7439,
        longitude: 89.2752,
        tz_offset_minutes: 360,
    },
    PrayerCityPreset {
        id: "mymensingh",
        name_en: "Mymensingh",
        name_bn: "ময়মনসিংহ",
        latitude: 24.7471,
        longitude: 90.4203,
        tz_offset_minutes: 360,
    },
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrayerConfig {
    pub city_name: String,
    pub method: CalculationMethod,
    pub madhab: Madhab,
    pub latitude: f64,
    pub longitude: f64,
    pub tz_offset_minutes: i32,
    pub fajr_offset_min: i32,
    pub dhuhr_offset_min: i32,
    pub asr_offset_min: i32,
    pub maghrib_offset_min: i32,
    pub isha_offset_min: i32,
}

impl Default for PrayerConfig {
    /// Defaults to Dhaka, Bangladesh using Karachi + Hanafi per SRS Section 5.4.
    fn default() -> Self {
        Self {
            city_name: "Dhaka".into(),
            method: CalculationMethod::Karachi,
            madhab: Madhab::Hanafi,
            latitude: 23.8103,
            longitude: 90.4125,
            tz_offset_minutes: 360,
            fajr_offset_min: 0,
            dhuhr_offset_min: 0,
            asr_offset_min: 0,
            maghrib_offset_min: 0,
            isha_offset_min: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrayerSlot {
    pub id: String,
    pub name_en: String,
    pub name_bn: String,
    pub time_12h: String,
    pub minute_of_day: i32,
    pub arc_ratio: f64,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrayerSchedule {
    pub city_name: String,
    #[serde(default)]
    pub latitude: f64,
    #[serde(default)]
    pub longitude: f64,
    pub next_name_en: String,
    pub next_name_bn: String,
    pub next_time_12h: String,
    pub next_is_tomorrow: bool,
    pub next_diff_min: i32,
    pub countdown_text: String,
    pub progress_pct: f64,
    pub sun_arc_ratio: f64,
    pub now_min: i32,
    pub is_friday: bool,
    pub is_ramadan: bool,
    pub is_night_mode: bool,
    pub sehri_min: i32,
    pub iftar_min: i32,
    pub night_start_min: i32,
    pub night_end_min: i32,
    pub tomorrow_fajr_min: i32,
    pub hijri_date: String,
    pub sehri_iftar_label: String,
    pub slots: Vec<PrayerSlot>,
}

fn to_local_minute(
    utc_tuple: Option<(i64, u32, u32)>,
    tz_offset_minutes: i32,
    adj_min: i32,
) -> i32 {
    let Some((h, m, _s)) = utc_tuple else {
        return 0;
    };
    let utc_min = (h as i32) * 60 + (m as i32);
    (utc_min + tz_offset_minutes + adj_min).rem_euclid(1440)
}

fn format_12h(minute_of_day: i32) -> String {
    let mins = minute_of_day.rem_euclid(1440);
    let h24 = mins / 60;
    let m = mins % 60;
    let suffix = if h24 >= 12 { "PM" } else { "AM" };
    let h12 = match h24 % 12 {
        0 => 12,
        other => other,
    };
    format!("{h12}:{m:02} {suffix}")
}

fn format_countdown(mins: i32) -> String {
    let total = mins.max(0);
    let h = total / 60;
    let m = total % 60;
    if h > 0 {
        format!("in {h} h {m} min")
    } else {
        format!("in {m} min")
    }
}

fn approximate_hijri_date(date: NaiveDate) -> (i32, String) {
    // Tabular Civil Islamic date approximation (Kuwaiti algorithm).
    let y = date.year();
    let m = date.month() as i32;
    let d = date.day() as i32;
    let jd = (1461 * (y + 4800 + (m - 14) / 12)) / 4 + (367 * (m - 2 - 12 * ((m - 14) / 12))) / 12
        - (3 * ((y + 4900 + (m - 14) / 12) / 100)) / 4
        + d
        - 32075;
    let l = jd - 1_948_440 + 10_632;
    let n = (l - 1) / 10_631;
    let l = l - 10_631 * n + 354;
    let j = ((10_985 - l) / 5316) * ((50 * l) / 17_719) + (l / 5670) * ((43 * l) / 15_238);
    let l = l - ((30 - j) / 15) * ((17_719 * j) / 50) - (j / 16) * ((15_238 * j) / 43) + 29;
    let h_month = ((24 * l) / 709).clamp(1, 12);
    let h_day = l - (709 * h_month) / 24;
    let h_year = 30 * n + j - 30;
    const MONTHS: [&str; 12] = [
        "Muharram",
        "Safar",
        "Rabi I",
        "Rabi II",
        "Jumada I",
        "Jumada II",
        "Rajab",
        "Sha'ban",
        "Ramadan",
        "Shawwal",
        "Dhu al-Qi'dah",
        "Dhu al-Hijjah",
    ];
    let month_name = MONTHS[(h_month - 1) as usize];
    (h_month, format!("{h_day} {month_name} {h_year} AH"))
}

const REGIONAL_CITIES: &[(&str, f64, f64)] = &[
    ("Gazipur", 23.9999, 90.4203),
    ("Narayanganj", 23.6238, 90.5000),
    ("Cumilla", 23.4607, 91.1809),
    ("Bogura", 24.8465, 89.3773),
    ("Cox's Bazar", 21.4272, 92.0058),
    ("Jessore", 23.1664, 89.2081),
    ("Kolkata", 22.5726, 88.3639),
    ("Delhi", 28.6139, 77.2090),
    ("Mumbai", 19.0760, 72.8777),
    ("Makkah", 21.3891, 39.8579),
    ("Madinah", 24.5247, 39.5692),
    ("Riyadh", 24.7136, 46.6753),
    ("Dubai", 25.2048, 55.2708),
    ("Singapore", 1.3521, 103.8198),
    ("Kuala Lumpur", 3.1390, 101.6869),
    ("London", 51.5072, -0.1276),
    ("New York", 40.7128, -74.0060),
    ("Toronto", 43.6532, -79.3832),
    ("Sydney", -33.8688, 151.2093),
    ("Tokyo", 35.6762, 139.6503),
];

/// Resolves an offline city label for auto-tracked coordinates, falling back to `lat°, lon°`.
#[must_use]
pub fn resolve_city_name_for_coords(lat: f64, lon: f64) -> String {
    let mut best: Option<(&str, f64)> = None;
    for city in BANGLADESH_CITIES {
        let d2 = (city.latitude - lat).powi(2) + (city.longitude - lon).powi(2);
        if best.is_none_or(|(_, cur)| d2 < cur) {
            best = Some((city.name_en, d2));
        }
    }
    for &(name, clat, clon) in REGIONAL_CITIES {
        let d2 = (clat - lat).powi(2) + (clon - lon).powi(2);
        if best.is_none_or(|(_, cur)| d2 < cur) {
            best = Some((name, d2));
        }
    }
    // ~0.60 deg (~65 km) radius match for nearest metropolitan area
    if let Some((name, d2)) = best
        && d2 <= 0.36
    {
        return name.to_string();
    }
    format!("{lat:.2}°, {lon:.2}°")
}

/// Computes the offline prayer schedule for `now_utc` and `config` (`FR-PR-1..6`).
#[must_use]
pub fn compute_prayer_schedule(now_utc: DateTime<Utc>, config: &PrayerConfig) -> PrayerSchedule {
    let offset = FixedOffset::east_opt(config.tz_offset_minutes * 60)
        .unwrap_or_else(|| FixedOffset::east_opt(360 * 60).expect("valid +6 offset"));
    let local_now = now_utc.with_timezone(&offset);
    let date = local_now.date_naive();
    let now_min = (local_now
        .format("%H")
        .to_string()
        .parse::<i32>()
        .unwrap_or(0)
        * 60)
        + local_now
            .format("%M")
            .to_string()
            .parse::<i32>()
            .unwrap_or(0);

    let params = Parameters::for_method(config.method.into()).with_madhab(config.madhab.into());
    let today = prayer_times(
        date.year(),
        date.month(),
        date.day(),
        config.latitude,
        config.longitude,
        &params,
    );

    let fajr = to_local_minute(today.fajr, config.tz_offset_minutes, config.fajr_offset_min);
    let dhuhr = to_local_minute(
        today.dhuhr,
        config.tz_offset_minutes,
        config.dhuhr_offset_min,
    );
    let asr = to_local_minute(today.asr, config.tz_offset_minutes, config.asr_offset_min);
    let maghrib = to_local_minute(
        today.maghrib,
        config.tz_offset_minutes,
        config.maghrib_offset_min,
    );
    let isha = to_local_minute(today.isha, config.tz_offset_minutes, config.isha_offset_min);

    let tomorrow_date = date + Duration::days(1);
    let tmr = prayer_times(
        tomorrow_date.year(),
        tomorrow_date.month(),
        tomorrow_date.day(),
        config.latitude,
        config.longitude,
        &params,
    );
    let tomorrow_fajr = to_local_minute(tmr.fajr, config.tz_offset_minutes, config.fajr_offset_min);
    let tmr_fajr_rel = tomorrow_fajr + 1440;

    let yesterday_date = date - Duration::days(1);
    let yest = prayer_times(
        yesterday_date.year(),
        yesterday_date.month(),
        yesterday_date.day(),
        config.latitude,
        config.longitude,
        &params,
    );
    let yest_isha = to_local_minute(yest.isha, config.tz_offset_minutes, config.isha_offset_min);

    let is_friday = local_now.weekday() == Weekday::Fri;
    let dhuhr_en = if is_friday { "Jumu'ah" } else { "Dhuhr" };
    let dhuhr_bn = if is_friday {
        "জুমা"
    } else {
        "যোহর"
    };

    let raw_slots = [
        ("fajr", "Fajr", "ফজর", fajr),
        ("dhuhr", dhuhr_en, dhuhr_bn, dhuhr),
        ("asr", "Asr", "আসর", asr),
        ("maghrib", "Maghrib", "মাগরিব", maghrib),
        ("isha", "Isha", "এশা", isha),
    ];

    let arc_span = (isha - fajr).max(1) as f64;
    let slots: Vec<PrayerSlot> = raw_slots
        .iter()
        .map(|(id, en, bn, min)| PrayerSlot {
            id: (*id).into(),
            name_en: (*en).into(),
            name_bn: (*bn).into(),
            time_12h: format_12h(*min),
            minute_of_day: *min,
            arc_ratio: (((*min - fajr) as f64) / arc_span).clamp(0.0, 1.0),
            passed: now_min >= *min,
        })
        .collect();

    let (next_en, next_bn, next_min, prev_min, next_is_tomorrow) =
        if let Some(idx) = slots.iter().position(|s| s.minute_of_day > now_min) {
            let next = &slots[idx];
            let prev = if idx > 0 {
                slots[idx - 1].minute_of_day
            } else {
                yest_isha - 1440
            };
            (
                next.name_en.clone(),
                next.name_bn.clone(),
                next.minute_of_day,
                prev,
                false,
            )
        } else {
            ("Fajr".into(), "ফজর".into(), tmr_fajr_rel, isha, true)
        };

    let diff_mins = (next_min - now_min).max(0);
    let interval_span = (next_min - prev_min).max(1) as f64;
    let progress_pct = (((now_min - prev_min) as f64) / interval_span * 100.0).clamp(0.0, 100.0);
    let is_night_mode = now_min >= isha || now_min < fajr;
    let (night_start_min, night_end_min) = if now_min >= isha {
        (isha, tmr_fajr_rel)
    } else {
        (yest_isha - 1440, fajr)
    };
    let sun_arc_ratio = if is_night_mode {
        (((now_min - night_start_min) as f64) / (night_end_min - night_start_min).max(1) as f64)
            .clamp(0.0, 1.0)
    } else {
        (((now_min - fajr) as f64) / arc_span).clamp(0.0, 1.0)
    };

    let (hijri_month, hijri_date) = approximate_hijri_date(date);
    let is_ramadan = hijri_month == 9;
    let sehri_iftar_label = if is_ramadan {
        if now_min < fajr {
            format!("Sehri ends {}", format_countdown(fajr - now_min))
        } else if now_min < maghrib {
            format!("Iftar {}", format_countdown(maghrib - now_min))
        } else {
            format!("Sehri {}", format_12h(tomorrow_fajr))
        }
    } else {
        String::new()
    };

    PrayerSchedule {
        city_name: config.city_name.clone(),
        latitude: config.latitude,
        longitude: config.longitude,
        next_name_en: next_en,
        next_name_bn: next_bn,
        next_time_12h: format_12h(next_min),
        next_is_tomorrow,
        next_diff_min: diff_mins,
        countdown_text: format_countdown(diff_mins),
        progress_pct,
        sun_arc_ratio,
        now_min,
        is_friday,
        is_ramadan,
        is_night_mode,
        sehri_min: fajr,
        iftar_min: maghrib,
        night_start_min,
        night_end_min,
        tomorrow_fajr_min: tomorrow_fajr,
        hijri_date,
        sehri_iftar_label,
        slots,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_bangladesh_karachi_hanafi() {
        let cfg = PrayerConfig::default();
        assert_eq!(cfg.method, CalculationMethod::Karachi);
        assert_eq!(cfg.madhab, Madhab::Hanafi);
    }

    #[test]
    fn computes_ordered_prayer_times_for_dhaka_and_khulna() {
        let now = DateTime::parse_from_rfc3339("2026-11-24T06:00:00Z")
            .expect("valid ts")
            .with_timezone(&Utc);

        for city in ["dhaka", "khulna"] {
            let preset = BANGLADESH_CITIES
                .iter()
                .find(|c| c.id == city)
                .expect("city preset");
            let cfg = PrayerConfig {
                city_name: preset.name_en.into(),
                latitude: preset.latitude,
                longitude: preset.longitude,
                tz_offset_minutes: preset.tz_offset_minutes,
                ..Default::default()
            };
            let sched = compute_prayer_schedule(now, &cfg);
            assert_eq!(sched.slots.len(), 5);
            for pair in sched.slots.windows(2) {
                assert!(
                    pair[0].minute_of_day < pair[1].minute_of_day,
                    "prayers must be strictly ordered in {city}"
                );
            }
            // Dhaka/Khulna Fajr in November sits around 04:45 - 05:25 AM
            assert!((270..=335).contains(&sched.slots[0].minute_of_day));
            // Maghrib in November sits around 17:05 - 17:40
            assert!((1015..=1065).contains(&sched.slots[3].minute_of_day));
        }
    }

    #[test]
    fn hanafi_asr_is_later_than_shafi_asr() {
        let now = DateTime::parse_from_rfc3339("2026-11-24T06:00:00Z")
            .expect("valid ts")
            .with_timezone(&Utc);
        let hanafi = compute_prayer_schedule(now, &PrayerConfig::default());
        let shafi_cfg = PrayerConfig {
            madhab: Madhab::Shafi,
            ..Default::default()
        };
        let shafi = compute_prayer_schedule(now, &shafi_cfg);
        assert!(hanafi.slots[2].minute_of_day > shafi.slots[2].minute_of_day);
    }

    #[test]
    fn labels_dhuhr_as_jumuah_on_friday() {
        // 2026-11-27 is a Friday
        let fri = DateTime::parse_from_rfc3339("2026-11-27T04:00:00Z")
            .expect("valid fri ts")
            .with_timezone(&Utc);
        let sched = compute_prayer_schedule(fri, &PrayerConfig::default());
        assert!(sched.is_friday);
        assert_eq!(sched.slots[1].name_en, "Jumu'ah");
        assert_eq!(sched.slots[1].name_bn, "জুমা");
        assert_eq!(sched.next_name_en, "Jumu'ah");
    }

    #[test]
    fn enters_night_mode_after_isha_and_tracks_tomorrow_fajr() {
        // 20:30 local (UTC+6 = 14:30Z) -> after Isha (~18:35), night mode active
        let late_night = DateTime::parse_from_rfc3339("2026-11-26T14:30:00Z")
            .expect("valid night ts")
            .with_timezone(&Utc);
        let sched = compute_prayer_schedule(late_night, &PrayerConfig::default());
        assert!(sched.is_night_mode);
        assert!(sched.next_is_tomorrow);
        assert_eq!(sched.next_name_en, "Fajr");
        assert!(sched.night_end_min > sched.night_start_min);
        assert!(sched.sun_arc_ratio > 0.0 && sched.sun_arc_ratio < 1.0);
    }

    #[test]
    fn detects_ramadan_and_exposes_sehri_and_iftar() {
        // 2026-02-20 falls inside Ramadan 1447 AH
        let ramadan = DateTime::parse_from_rfc3339("2026-02-20T09:00:00Z")
            .expect("valid ramadan ts")
            .with_timezone(&Utc);
        let sched = compute_prayer_schedule(ramadan, &PrayerConfig::default());
        assert!(sched.is_ramadan);
        assert!(sched.sehri_min < sched.iftar_min);
        assert!(!sched.sehri_iftar_label.is_empty());
    }

    #[test]
    fn resolves_nearest_city_and_embeds_coordinates() {
        assert_eq!(resolve_city_name_for_coords(23.81, 90.41), "Dhaka");
        assert_eq!(resolve_city_name_for_coords(22.85, 89.54), "Khulna");
        assert_eq!(resolve_city_name_for_coords(25.20, 55.27), "Dubai");
        assert_eq!(resolve_city_name_for_coords(12.34, 45.67), "12.34°, 45.67°");

        let sched = compute_prayer_schedule(Utc::now(), &PrayerConfig::default());
        assert!((sched.latitude - 23.8103).abs() < 0.001);
        assert!((sched.longitude - 90.4125).abs() < 0.001);
    }
}
