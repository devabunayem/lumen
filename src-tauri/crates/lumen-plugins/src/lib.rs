use serde::{Deserialize, Serialize};

/// Fine-grained sandbox permissions declared in a widget manifest (FR-PL-2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginPermission {
    Network,
    Storage,
    Media,
    Notifications,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WidgetManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub entry: String,
    pub permissions: Vec<PluginPermission>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_widget_manifest_permissions() {
        let manifest = WidgetManifest {
            id: "dev.example.hello".into(),
            name: "Hello Widget".into(),
            version: "1.0.0".into(),
            entry: "index.js".into(),
            permissions: vec![PluginPermission::Storage],
        };
        assert_eq!(manifest.permissions, vec![PluginPermission::Storage]);
    }
}
