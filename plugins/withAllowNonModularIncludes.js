const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// RNFBApp imports non-modular React Native headers (RCTConvert.h, etc.)
// inside a framework module when useFrameworks:"static" is enabled.
// Fix: set ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES for all pod targets.
// We inject into the EXISTING post_install block (CocoaPods forbids multiple blocks).
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

      const injection = [
        "  installer.pods_project.targets.each do |target|",
        "    target.build_configurations.each do |cfg|",
        "      cfg.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        "    end",
        "  end",
      ].join("\n");

      // Inject at the top of the existing post_install block
      const patched = contents.replace(
        /^(post_install do \|installer\|)/m,
        `$1\n${injection}`
      );

      if (patched === contents) {
        // No existing post_install — append a new block as fallback
        const newBlock = [
          "",
          "post_install do |installer|",
          injection,
          "end",
          "",
        ].join("\n");
        fs.writeFileSync(podfilePath, contents + newBlock);
      } else {
        fs.writeFileSync(podfilePath, patched);
      }

      return config;
    },
  ]);
}

module.exports = withAllowNonModularIncludes;
