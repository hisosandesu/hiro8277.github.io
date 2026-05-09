const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// RNFBApp (react-native-firebase) imports React Native non-modular headers
// (RCTConvert.h, RCTBridgeModule.h, etc.) inside a framework module, which the
// compiler rejects with -Wnon-modular-include-in-framework-module when
// useFrameworks:"static" is enabled (required for Firebase Swift pods).
// This hook suppresses that error for all pod targets.
function withAllowNonModularIncludes(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      const contents = fs.readFileSync(podfilePath, "utf-8");
      if (
        contents.includes("ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")
      ) {
        return config;
      }
      const hook = [
        "",
        "post_install do |installer|",
        "  installer.pods_project.targets.each do |target|",
        "    target.build_configurations.each do |cfg|",
        "      cfg.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        "    end",
        "  end",
        "end",
        "",
      ].join("\n");
      fs.writeFileSync(podfilePath, contents + hook);
      return config;
    },
  ]);
}

module.exports = withAllowNonModularIncludes;
