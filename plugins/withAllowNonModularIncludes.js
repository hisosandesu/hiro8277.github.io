const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// RNFBApp imports non-modular React Native headers (RCTConvert.h, etc.)
// inside a framework module when useFrameworks:"static" is enabled.
// Fix: add pod_target_xcconfig to the podspec so the setting applies only to
// RNFBApp without touching the Podfile's post_install block (which CocoaPods
// forbids having multiple of).
function withAllowNonModularIncludes(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podspecPath = path.join(
        config.modRequest.projectRoot,
        "node_modules/@react-native-firebase/app/RNFBApp.podspec"
      );

      if (!fs.existsSync(podspecPath)) {
        console.warn(
          "[withAllowNonModularIncludes] RNFBApp.podspec not found, skipping."
        );
        return config;
      }

      const contents = fs.readFileSync(podspecPath, "utf-8");

      if (contents.includes("ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        return config;
      }

      // Insert xcconfig setting before the final `end` of the Pod::Spec block
      const xcconfig = [
        "",
        "  s.pod_target_xcconfig = {",
        "    'ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES'",
        "  }",
      ].join("\n");

      // Replace the last `end` in the file (closes the Pod::Spec.new block)
      const lastEndIdx = contents.lastIndexOf("\nend");
      if (lastEndIdx === -1) {
        console.warn(
          "[withAllowNonModularIncludes] Could not find closing `end` in RNFBApp.podspec, skipping."
        );
        return config;
      }

      const patched =
        contents.slice(0, lastEndIdx) +
        xcconfig +
        contents.slice(lastEndIdx);

      fs.writeFileSync(podspecPath, patched);
      return config;
    },
  ]);
}

module.exports = withAllowNonModularIncludes;
