const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// RNFBApp imports non-modular React Native headers (RCTConvert.h, etc.)
// inside a framework module when useFrameworks:"static" is enabled.
// Fix: inject ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES into the
// RNFBApp target's build configurations via the existing post_install hook.
//
// Root cause of previous failures:
//   - Expo Podfile places post_install INDENTED inside the target block ("  post_install do |installer|")
//   - Old regex /^(post_install do \|installer\|)/m required zero leading whitespace → never matched
//   - s.pod_target_xcconfig in the podspec generates .xcconfig but does not propagate to
//     the actual Xcode build settings that the compiler uses → compile error persists
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
        console.warn(
          "[withAllowNonModularIncludes] Podfile not found, skipping."
        );
        return config;
      }

      const contents = fs.readFileSync(podfilePath, "utf-8");

      if (
        contents.includes("ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")
      ) {
        return config; // already patched
      }

      // Match post_install regardless of leading indent (Expo puts it inside target block)
      // Captures: [1] = leading whitespace, [2] = installer variable name
      const postInstallRegex = /^(\s*)post_install\s+do\s+\|(\w+)\|/m;
      const match = contents.match(postInstallRegex);

      if (!match) {
        console.warn(
          "[withAllowNonModularIncludes] post_install block not found in Podfile, skipping."
        );
        return config;
      }

      const outerIndent = match[1]; // e.g. "  " when inside target block
      const installerVar = match[2]; // e.g. "installer"
      const innerIndent = outerIndent + "  "; // body of post_install block

      // Use 'build_config' to avoid shadowing the outer 'config' variable
      // that Expo defines via `config = use_native_modules!`
      const injection = [
        `${innerIndent}${installerVar}.pods_project.targets.each do |target|`,
        `${innerIndent}  if target.name == "RNFBApp"`,
        `${innerIndent}    target.build_configurations.each do |build_config|`,
        `${innerIndent}      build_config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
        `${innerIndent}    end`,
        `${innerIndent}  end`,
        `${innerIndent}end`,
        "",
      ].join("\n");

      // Append injection immediately after the opening "post_install do |installer|" line
      const patched = contents.replace(
        postInstallRegex,
        (matched) => matched + "\n" + injection
      );

      fs.writeFileSync(podfilePath, patched);
      console.log(
        "[withAllowNonModularIncludes] Injected ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES into RNFBApp target."
      );
      return config;
    },
  ]);
}

module.exports = withAllowNonModularIncludes;
