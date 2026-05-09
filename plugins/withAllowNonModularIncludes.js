const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// RNFBApp imports non-modular React Native headers inside a framework module
// when useFrameworks:"static" is enabled.
//
// Fix strategy (v3):
//   - Anchor on `react_native_post_install(` which is always present in the
//     Expo-generated Podfile, instead of trying to match the post_install
//     block header (which was previously fragile and silently missed).
//   - Use the canonical Xcode key CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES
//     (not the shorter alias that does not propagate to Xcode 15+ explicit
//     module precompilation / ExplicitPrecompiledModules).
//   - Apply to all pod targets so the filter-by-name cannot be the failure point.
function withAllowNonModularIncludes(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.projectRoot,
        "ios",
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withAllowNonModularIncludes] Podfile not found, skipping.");
        return config;
      }

      const contents = fs.readFileSync(podfilePath, "utf-8");

      if (contents.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        return config;
      }

      // Extract the installer variable name (defaults to "installer" if not found)
      const installerMatch = contents.match(/post_install\s+do\s+\|(\w+)\|/);
      const installerVar = installerMatch ? installerMatch[1] : "installer";

      // The Expo Podfile always calls react_native_post_install() inside post_install.
      // Inject our build-setting fix immediately before that call so we are
      // guaranteed to be inside the post_install block and after pod install.
      const anchor = "react_native_post_install(";
      if (!contents.includes(anchor)) {
        console.warn(
          "[withAllowNonModularIncludes] react_native_post_install not found in Podfile, skipping."
        );
        return config;
      }

      // Ruby code injected before the anchor (leading 4-space indent comes from
      // the original whitespace that precedes "react_native_post_install(" in
      // the Expo template).
      const injection = [
        `${installerVar}.pods_project.targets.each do |target|`,
        `      target.build_configurations.each do |build_config|`,
        `        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
        `      end`,
        `    end`,
        `    `,
      ].join("\n");

      const patched = contents.replace(anchor, injection + anchor);
      fs.writeFileSync(podfilePath, patched);
      console.log(
        "[withAllowNonModularIncludes] Injected CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES before react_native_post_install."
      );
      return config;
    },
  ]);
}

module.exports = withAllowNonModularIncludes;
