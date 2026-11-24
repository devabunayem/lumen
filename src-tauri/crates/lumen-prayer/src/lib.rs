use serde::{Deserialize, Serialize};

/// Supported calculation methods (Bangladesh defaults to Karachi + Hanafi).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CalculationMethod {
    Karachi,
    MuslimWorldLeague,
    Egyptian,
    UmmAlQura,
    NorthAmerica,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Madhab {
    Hanafi,
    Shafi,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrayerConfig {
    pub method: CalculationMethod,
    pub madhab: Madhab,
    pub latitude: f64,
    pub longitude: f64,
}

impl Default for PrayerConfig {
    /// Defaults to Dhaka, Bangladesh using Karachi + Hanafi per SRS Section 5.4.
    fn default() -> Self {
        Self {
            method: CalculationMethod::Karachi,
            madhab: Madhab::Hanafi,
            latitude: 23.8103,
            longitude: 90.4125,
        }
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
}
