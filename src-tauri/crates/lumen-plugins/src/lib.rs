use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Fine-grained sandbox permissions declared in a widget manifest (`FR-PL-2`).
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
    #[serde(default)]
    pub permissions: Vec<PluginPermission>,
}

/// Discovered and sandbox-ready third-party widget bundle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LoadedPlugin {
    pub manifest: WidgetManifest,
    pub html_srcdoc: String,
}

impl WidgetManifest {
    /// Validates required metadata and checks that `entry` is a safe relative subpath.
    pub fn validate(&self) -> Result<PathBuf, String> {
        if self.id.trim().is_empty()
            || self.name.trim().is_empty()
            || self.version.trim().is_empty()
        {
            return Err("manifest id, name, and version must be non-empty".into());
        }
        let rel = Path::new(self.entry.trim());
        if rel.as_os_str().is_empty() || rel.is_absolute() {
            return Err("manifest entry must be a relative path".into());
        }
        for comp in rel.components() {
            if matches!(
                comp,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            ) {
                return Err("manifest entry cannot traverse outside plugin directory".into());
            }
        }
        Ok(rel.to_path_buf())
    }
}

fn wrap_js_into_html(manifest: &WidgetManifest, script_body: &str) -> String {
    let safe_js = script_body.replace("</script>", "<\\/script>");
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{name}</title>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: #000000;
    color: #ffffff;
    font-family: "Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif;
    padding: 8px;
    overflow: hidden;
  }}
</style>
</head>
<body>
<div id="lumen-plugin-root"></div>
<script>
window.LumenPlugin = {{
  id: {id_json},
  permissions: {perms_json},
  postMessage(type, payload) {{
    window.parent.postMessage({{ source: "lumen-plugin", pluginId: {id_json}, type, payload }}, "*");
  }}
}};
{safe_js}
</script>
</body>
</html>"#,
        name = manifest.name.replace(['<', '>'], ""),
        id_json = serde_json::to_string(&manifest.id).unwrap_or_else(|_| "\"unknown\"".into()),
        perms_json = serde_json::to_string(&manifest.permissions).unwrap_or_else(|_| "[]".into()),
    )
}

/// Scans `plugins_dir` and loads every valid plugin directory while isolating broken ones (`NFR-REL-1`).
#[must_use]
pub fn discover_plugins(plugins_dir: &Path) -> Vec<LoadedPlugin> {
    let Ok(entries) = fs::read_dir(plugins_dir) else {
        return Vec::new();
    };

    let mut plugins = Vec::new();
    for entry in entries.flatten() {
        let dir_path = entry.path();
        if !dir_path.is_dir() {
            continue;
        }
        if let Some(loaded) = load_single_plugin(&dir_path) {
            plugins.push(loaded);
        }
    }
    plugins.sort_by(|a, b| a.manifest.name.cmp(&b.manifest.name));
    plugins
}

fn load_single_plugin(dir_path: &Path) -> Option<LoadedPlugin> {
    let manifest_raw = fs::read_to_string(dir_path.join("manifest.json")).ok()?;
    let manifest: WidgetManifest = serde_json::from_str(&manifest_raw).ok()?;
    let rel_entry = manifest.validate().ok()?;

    let canon_dir = fs::canonicalize(dir_path).ok()?;
    let canon_entry = fs::canonicalize(dir_path.join(&rel_entry)).ok()?;
    if !canon_entry.starts_with(&canon_dir) {
        return None;
    }

    let raw_entry = fs::read_to_string(&canon_entry).ok()?;
    let is_html = canon_entry
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("html") || e.eq_ignore_ascii_case("htm"));

    let html_srcdoc = if is_html {
        raw_entry
    } else {
        wrap_js_into_html(&manifest, &raw_entry)
    };

    Some(LoadedPlugin {
        manifest,
        html_srcdoc,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "lumen_plugins_test_{}_{}",
            std::process::id(),
            name
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp plugin dir");
        dir
    }

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
        assert!(manifest.validate().is_ok());
    }

    #[test]
    fn rejects_path_traversal_and_discovers_valid_plugins() {
        let root = temp_dir("discovery");

        let valid_dir = root.join("hello");
        fs::create_dir_all(&valid_dir).unwrap();
        fs::write(
            valid_dir.join("manifest.json"),
            r#"{"id":"io.etarnity.hello","name":"Hello World","version":"1.0.0","entry":"index.js","permissions":["storage"]}"#,
        )
        .unwrap();
        fs::write(
            valid_dir.join("index.js"),
            "document.getElementById('lumen-plugin-root').textContent = 'Hello Lumen';",
        )
        .unwrap();

        let traversal_dir = root.join("evil");
        fs::create_dir_all(&traversal_dir).unwrap();
        fs::write(
            traversal_dir.join("manifest.json"),
            r#"{"id":"bad.plugin","name":"Bad","version":"1.0.0","entry":"../secret.js","permissions":[]}"#,
        )
        .unwrap();

        let broken_dir = root.join("broken");
        fs::create_dir_all(&broken_dir).unwrap();
        fs::write(broken_dir.join("manifest.json"), "{broken json").unwrap();

        let discovered = discover_plugins(&root);
        assert_eq!(discovered.len(), 1);
        assert_eq!(discovered[0].manifest.id, "io.etarnity.hello");
        assert!(discovered[0].html_srcdoc.contains("Hello Lumen"));

        let _ = fs::remove_dir_all(&root);
    }
}
