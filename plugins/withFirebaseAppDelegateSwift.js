const { withAppDelegate } = require("@expo/config-plugins");

// Expo SDK 54 ships an AppDelegate.swift whose structure no longer matches the
// regex used by @react-native-firebase/app v21's bundled config plugin
// (it looks for `self.moduleName = "..."`, which no longer exists). The
// upstream plugin therefore silently skips inserting `FirebaseApp.configure()`,
// and the JS layer crashes at runtime with:
//   "No Firebase App '[DEFAULT]' has been created - call firebase.initializeApp()"
//
// This plugin patches the Swift AppDelegate directly:
//   1. Adds `import FirebaseCore` after `import Expo` (idempotent).
//   2. Inserts `FirebaseApp.configure()` as the first statement inside
//      `application(_:didFinishLaunchingWithOptions:)`, guaranteeing the
//      default Firebase app exists before any RN module touches it.
//
// Idempotent: bails out early if both edits are already applied.
function withFirebaseAppDelegateSwift(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      return cfg;
    }

    let contents = cfg.modResults.contents;
    const importLine = "import FirebaseCore";
    const configureCall = "FirebaseApp.configure()";

    // 1. Add import (after `import Expo` if present, otherwise at top).
    if (!contents.includes(importLine)) {
      if (contents.includes("import Expo")) {
        contents = contents.replace(
          /import Expo\n/,
          `import Expo\n${importLine}\n`
        );
      } else {
        contents = `${importLine}\n${contents}`;
      }
    }

    // 2. Insert FirebaseApp.configure() inside didFinishLaunchingWithOptions.
    if (!contents.includes(configureCall)) {
      // Match the function signature spanning multiple lines and capture the
      // opening brace so we can insert immediately after it.
      const didFinishLaunchingRegex =
        /(override func application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;

      if (didFinishLaunchingRegex.test(contents)) {
        contents = contents.replace(
          didFinishLaunchingRegex,
          `$1\n    ${configureCall}`
        );
      } else {
        // Should not happen with the standard Expo template, but warn loudly
        // so the build log makes the failure obvious instead of silent.
        console.warn(
          "[withFirebaseAppDelegateSwift] Could not find didFinishLaunchingWithOptions in AppDelegate.swift. FirebaseApp.configure() was NOT inserted."
        );
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withFirebaseAppDelegateSwift;
